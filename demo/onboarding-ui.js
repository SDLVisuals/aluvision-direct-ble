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
  const pinRequired=()=>window.AluvisionSecurityMode?.pinRequired!==false;
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const t=(key,fallback,params={})=>{
    const language=document.documentElement.lang||'nl';
    const translated=window.LightningSetupTranslations?.[language]?.[key]||window.LightningPreferences?.t(key,language,params);
    return (translated&&translated!==key?translated:fallback).replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g,(match,name)=>Object.prototype.hasOwnProperty.call(params,name)?String(params[name]):match);
  };
  // Only app-owned copy uses this lookup; names and identities stay escaped.
  const tx=(source,params={})=>t(source,source,params);
  const button=(action,label,extra='')=>{
    const classes=extra.match(/\bclass="([^"]*)"/);
    return `<button type="button" class="${classes?classes[1]:'button'}" data-onboarding-action="${action}" ${extra.replace(/\bclass="[^"]*"/,'')}>${tx(label)}</button>`;
  };
  const labels={stand:'Je stand',zones:'Zones maken',receiver:'Receiver zoeken',placement:'Kies een passende zone',outputs:'Kies je uitgangen',pixels:'Pixels instellen',connection:'Beginpunt kiezen',pin:'Kies je installatie-PIN',get security(){return pinRequired()?'Verbinding bevestigen':'Receiver verbinden';},zone:'Kies de zone',review:'Klaar om toe te voegen',done:'Je receiver is klaar'};
  const phaseLabels={configuring:'Instellingen opslaan',claiming:'Receiver koppelen',reconnecting:'Verbinding herstellen',verifying:'Verbinding controleren',resuming:'Verbinding controleren'};
  const unavailable='Er is nog geen verbindingsdienst beschikbaar. Je keuzes blijven bewaard.';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const uniqueId=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
  const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
  function bounded(promise,milliseconds=15000){let timer;return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('TIMEOUT'),{code:'TIMEOUT'})),milliseconds);})]).finally(()=>clearTimeout(timer));}
  const membershipKey=model=>canonical(window.LightningModel.membershipStructure(model));
  // Only a verified native new-MAIN publication may add this one public MAC
  // field. Every other graph/value must remain byte-canonically identical.
  function nativeMainPublication(model,expected,draft){
    if(draft?.role!=='main'||!model||!expected)return false;
    const next=clone(model),rows=next.receivers;
    if(!Array.isArray(rows)||rows.filter(receiver=>receiver.id===draft.receiver.id).length!==1)return false;
    const receiver=rows.find(receiver=>receiver.id===draft.receiver.id),old=expected.receivers?.find(item=>item.id===draft.receiver.id);
    if(!old||receiver.role!=='main'||receiver.rid!==old.rid||receiver.deviceFingerprint!==old.deviceFingerprint||
       !/^[0-9A-F]{12}$/.test(receiver.physicalId)||/^0+$/.test(receiver.physicalId)||
       rows.some(item=>item!==receiver&&item.physicalId===receiver.physicalId))return false;
    if(old.physicalId===undefined)delete receiver.physicalId;
    else if(receiver.physicalId!==old.physicalId)return false;
    return canonical(next)===canonical(expected);
  }
  // Native errors contain only bounded codes. Never render an exception's raw
  // message: network responses can contain credentials or untrusted content.
  function connectionFailure(failure,{viaMain=false}={}){
    const code=typeof failure?.code==='string'?failure.code:'';
    if(code==='LOCAL_NETWORK_DENIED')return {message:'Geef de Aluvision-app toegang tot het lokale netwerk via Instellingen. Heropen de app. Reset je receiver niet.'};
    if(code==='MAIN_WRONG_RECEIVER_NETWORK')return {message:viaMain?'Verkeerde wifi. Kies in Instellingen → Wifi je bestaande ALUVISION-standnetwerk (niet de nieuwe receiver) en tik op Verbinding controleren.':'Verkeerde wifi. Kies het ALUVISION-netwerk van deze receiver en tik op Verbinding controleren.'};
    if(!pinRequired()&&['MAIN_RECOVERY_UNAVAILABLE','MAIN_RECOVERY_CONFLICT','MAIN_REGISTRATION_UNCONFIRMED','REMOVAL_PIN_REQUIRED'].includes(code))return {message:'Receiver niet bereikbaar. Laat hem aan en controleer de verbinding opnieuw.'};
    if(code==='DISCOVERY_EXPIRED')return {expired:true,message:'Controle verlopen. Tik op Verbinding controleren.'};
    if(['DISCOVERY_UNAVAILABLE','MAIN_MANUAL_WIFI_REQUIRED','MAIN_CONNECTION_UNAVAILABLE','NATIVE_TIMEOUT','TIMEOUT'].includes(code))return {message:viaMain?'Verbind met je bestaande standwifi. Laat de nieuwe receiver aan en probeer opnieuw.':'Verbind met het ALUVISION-wifi van deze receiver en tik op Verbinding controleren.'};
    if(code==='OWNED_DISCOVERY_UNSUPPORTED')return {message:'Een receiver zoeken via je bestaande stand is nog niet beschikbaar in deze versie.'};
    if(['MAIN_PROTOCOL_UNSUPPORTED','ACTION_UNSUPPORTED'].includes(code))return {message:'App en receiver zijn niet compatibel. Werk beide bij; reset de receiver niet.'};
    if(code==='MAIN_MANAGEMENT_REFUSED')return {message:'De hoofdreceiver heeft de koppelcontrole geweigerd. Je gegevens blijven bewaard. Laat de receiver aan en controleer opnieuw.'};
    if(['MAIN_IDENTITY_UNCONFIRMED','IDENTITY_MISMATCH','DISCOVERY_INVALID'].includes(code))return {message:viaMain?'Receiver niet herkend. Controleer je standwifi en probeer opnieuw. Er is niets toegevoegd.':'Receiver niet herkend. Controleer het juiste receiver-wifi en probeer opnieuw. Er is niets toegevoegd.'};
    if(['NATIVE_BUSY','MAIN_BUSY','OTA_BUSY','REMOVAL_BUSY'].includes(code))return {message:'Er loopt al een receiveractie. Wacht even en probeer opnieuw.'};
    if(['MAIN_STORAGE_UNCONFIRMED','V30_STORAGE_UNAVAILABLE','V30_STORAGE_UNCONFIRMED','V30_CHECKPOINT_CONFLICT'].includes(code))return {message:'Opslaan niet bevestigd. Je keuzes staan nog in beeld; probeer opnieuw. Reset de receiver niet.'};
    if(code==='MAIN_RECOVERY_UNAVAILABLE')return {message:'Toegang niet bewaard. Laat de receiver aan en probeer opnieuw.'};
    if(code==='MAIN_RECOVERY_CONFLICT')return {message:'Toegang komt niet overeen. Er is niets overschreven. Controleer je standcode.'};
    if(code==='MAIN_REGISTRATION_UNCONFIRMED')return {message:'Toegang wordt nog bewaard. Laat de receiver aan en controleer opnieuw.'};
    if(['NATIVE_UNAVAILABLE','NATIVE_DOCUMENT_UNAVAILABLE'].includes(code))return {message:'Receiververbinding niet beschikbaar. Herstart de app en probeer opnieuw.'};
    return {message:'Receiver niet gecontroleerd. Tik op Verbinding controleren. Reset de receiver niet.'};
  }
  function finalizationFailure(failure,{viaMain=false,phase='receiver'}={}){
    // Only fixed codes and our own phase choose copy. Never show native error
    // messages, receiver replies, credentials or an arbitrary exception code.
    const code=typeof failure?.code==='string'?failure.code:'';
    if(['MAIN_RECEIPT_INVALID','V30_RECEIPT_UNVERIFIED','RECEIPT_REFERENCE','RECEIPT_UNVERIFIED','RECEIPT_MISMATCH'].includes(code))return {
      refreshReceipt:true,message:'Ontvangst niet bevestigd. Tik op Opnieuw proberen.'
    };
    if(['MAIN_STORAGE_UNCONFIRMED','V30_STORAGE_UNAVAILABLE','V30_STORAGE_UNCONFIRMED','V30_STORAGE_FULL','V30_STORAGE_CORRUPT','V30_CHECKPOINT_CONFLICT','V30_CHECKPOINT_INVALID','V30_CHECKPOINT_ROLLBACK','V30_BINDING_INVALID'].includes(code)||['save','publish'].includes(phase))return {
      message:'Toevoegen is nog niet opgeslagen. Je keuzes staan hier; probeer opnieuw.'
    };
    if(phase==='receiver'&&['LOCAL_NETWORK_DENIED','MAIN_WRONG_RECEIVER_NETWORK','DISCOVERY_UNAVAILABLE','MAIN_MANUAL_WIFI_REQUIRED','MAIN_CONNECTION_UNAVAILABLE','NATIVE_TIMEOUT','TIMEOUT','NATIVE_BUSY','MAIN_BUSY','OTA_BUSY','REMOVAL_BUSY','MAIN_PROTOCOL_UNSUPPORTED','ACTION_UNSUPPORTED'].includes(code))return connectionFailure(failure,{viaMain});
    return {message:'Toevoegen niet afgerond. Probeer opnieuw.'};
  }
  function firstAccessFailure(failure){
    // Retain only closed, app-owned diagnostic codes. Never display replies,
    // passwords or an arbitrary exception message/code.
    const messages={
      FIRST_ACCESS_STORAGE:'Deze instelstap kon niet worden bewaard. Laat de receiver aan en probeer opnieuw.',
      FIRST_ACCESS_IDENTITY:'De receiver hoort niet bij deze instelstap. Er is niets overschreven.',
      LOCAL_NETWORK_DENIED:'Geef de app toegang tot het lokale netwerk in Instellingen. Je stand blijft behouden.',
      NATIVE_UNAVAILABLE:'De verbinding met de app is niet beschikbaar. Heropen de app; je stand blijft behouden.',
      NATIVE_DOCUMENT_UNAVAILABLE:'Deze apppagina is nog niet gereed. Heropen de app; je stand blijft behouden.',
      NATIVE_BUSY:'Er loopt nog een appactie. Wacht even en controleer je stand opnieuw.',
      NATIVE_TIMEOUT:'Het afronden duurt te lang en is niet bevestigd. Laat de receiver aan, controleer je standwifi en kies geen tweede PIN.',
      NATIVE_UNCONFIRMED:'De app heeft het afronden niet bevestigd. Controleer je standwifi en kies geen tweede PIN.',
      ACTION_UNSUPPORTED:'Deze instelstap is niet beschikbaar in deze appversie. Je stand blijft behouden.',
      CANCELLED:'Het afronden is onderbroken. Controleer je standwifi; stel geen tweede stand in.',
      TIMEOUT:'De verbindingscontrole is verlopen. Laat de receiver aan, controleer je standwifi en kies geen tweede PIN.',
      STAND_INVALID_REQUEST:'De instelaanvraag kon niet veilig worden gecontroleerd. Je stand blijft behouden.',
      STAND_NEW_CODE_INVALID:'Kies een wifi-PIN van 8–12 cijfers. Gebruik geen letters of spaties.',
      STAND_CODE_INVALID:'De gekozen wifi-PIN kon niet worden gecontroleerd. Kies 8–12 cijfers.',
      STAND_STORAGE_LIMIT:'Je stand is te groot voor deze overdracht. Er is geen PIN-aanvraag verstuurd.',
      STAND_RECEIVER_SAVED_ELSEWHERE:'Deze receiver staat nog bij een andere opgeslagen stand op deze telefoon. Je eerdere toegang is niet gewist.',
      STAND_CURRENT_ACCESS_CONFLICT:'De bewaarde toegang komt niet overeen met deze stand. Er is niets overschreven.',
      STAND_MIGRATION_NOT_READY:'De opgeslagen eerste installatie is nog niet bevestigd. Je receiver blijft behouden.',
      STAND_MIGRATION_INVALID:'De standoverdracht kon niet veilig worden gecontroleerd. Je stand blijft behouden.',
      STAND_MIGRATION_UNCONFIRMED:'De standoverdracht is niet bevestigd. Controleer je standwifi en kies geen tweede PIN.',
      STAND_MIGRATION_PAYLOAD_INVALID:'De standgegevens zijn niet bevestigd. Er is geen PIN-aanvraag verstuurd.',
      STAND_MIGRATION_STORE_UNAVAILABLE:'De standopslag op de receiver is niet beschikbaar. Er is geen PIN-aanvraag verstuurd.',
      STAND_MIGRATION_UPLOAD_BUSY:'De receiver verwerkt nog standgegevens. Er is geen PIN-aanvraag verstuurd.',
      STAND_MIGRATION_UPLOAD_EXPIRED:'De standoverdracht is verlopen. Er is geen PIN-aanvraag verstuurd.',
      STAND_MIGRATION_CAPACITY:'De stand past niet in de receiveropslag. Er is geen PIN-aanvraag verstuurd.',
      STAND_MIGRATION_MEMORY_PRESSURE:'De receiver heeft nu onvoldoende werkgeheugen. Er is geen PIN-aanvraag verstuurd.',
      STAND_WIFI_UNREACHABLE:'Verbind met je standwifi en kom terug. Je eerste receiver blijft behouden.',
      STAND_UNAVAILABLE:'De receiver antwoordt niet. Laat hem aan en controleer je standwifi.',
      STAND_CANCELLED:'Het afronden is gestopt. Controleer je standwifi opnieuw; stel geen tweede stand in.',
      STAND_CONNECTION_CANCELLED:'Het afronden is gestopt. Controleer je standwifi opnieuw; stel geen tweede stand in.',
      STAND_BUSY:'Er loopt nog een receiveractie. Wacht even en probeer opnieuw.',
      STAND_CONNECTION_BUSY:'Er loopt nog een verbindingscontrole. Wacht even en probeer opnieuw.',
      STAND_CONNECTION_CLOSED:'De verbindingscontrole is gesloten. Heropen je stand; je receiver blijft behouden.',
      STAND_CONNECTION_UNAVAILABLE:'De standverbinding is niet beschikbaar in de app. Heropen de app; je stand blijft behouden.',
      STAND_CONNECTION_INVALID:'De verbindingsaanvraag kon niet veilig worden gecontroleerd. Je stand blijft behouden.',
      STAND_CONNECTION_UNCONFIRMED:'De standverbinding is niet bevestigd. Controleer je standwifi en kies geen tweede PIN.',
      STAND_INSPECTION_REQUIRED:'Controleer eerst de verbinding met je standwifi. Je stand blijft behouden.',
      STAND_SESSION_EXPIRED:'De beveiligde verbindingscontrole is verlopen. Controleer je standwifi opnieuw.',
      STAND_REVISION_CONFLICT:'De standgegevens zijn ondertussen gewijzigd. Controleer je stand opnieuw voordat je verdergaat.',
      STAND_DATA_INVALID:'De standgegevens konden niet worden gecontroleerd. Er is niets gewijzigd.',
      STAND_DATA_UNCONFIRMED:'De receivergegevens zijn niet bevestigd. Er is niets gewijzigd.',
      STAND_ENTITY_ID_INVALID:'Een onderdeel van de standgegevens kon niet veilig worden gecontroleerd. Je stand blijft behouden.',
      STAND_IDENTITY_UNCONFIRMED:'De verwachte stand is niet bevestigd. Controleer je standwifi; je eerdere stand blijft behouden.',
      STAND_IDENTITY_MISMATCH:'Dit is niet de verwachte stand. Je eerdere stand blijft behouden.',
      STAND_NETWORK_MISMATCH:'Kies het wifi-netwerk van je stand. Er is niets overschreven.',
      STAND_WRONG_WIFI:'Kies het wifi-netwerk van je stand. Er is niets overschreven.',
      STAND_WIFI_UNSUPPORTED:'Deze receiver ondersteunt openen via verbonden wifi nog niet. Je stand blijft behouden.',
      STAND_AUTH_FAILED:'De beveiligde receivercontrole is niet bevestigd. Je eerdere toegang blijft behouden.',
      STAND_CREDENTIAL_UNCONFIRMED:'De toegang kon niet veilig worden bewaard. Je stand blijft behouden.',
      STAND_UNCONFIRMED:'De receiver heeft het afronden nog niet bevestigd. Controleer je standwifi opnieuw.',
      STAND_PREFLIGHT_INVALID:'De controle van de eerste installatie is niet bevestigd. Er is niets gewijzigd.',
      STAND_PREFLIGHT_UNCONFIRMED:'De receivercontrole is niet bevestigd. Er is niets gewijzigd.',
      STAND_PREFLIGHT_NOT_REQUIRED:'Deze controle is niet meer nodig. Controleer je verbinding om verder te gaan.',
      STAND_MIGRATION_CODE_UNCONFIRMED:'De PIN-wijziging is nog niet bevestigd. Verbind met de gekozen standwifi en controleer opnieuw. Kies geen tweede PIN.',
      STAND_CODE_CHANGE_UNCONFIRMED:'De PIN-wijziging is nog niet bevestigd. Verbind met de gekozen standwifi en controleer opnieuw. Kies geen tweede PIN.'
    };
    const code=typeof failure?.code==='string'&&Object.prototype.hasOwnProperty.call(messages,failure.code)?failure.code:'FIRST_ACCESS_UNCONFIRMED';
    return {code,message:messages[code]||'Afronden is niet bevestigd. Controleer je standwifi en probeer opnieuw. Stel geen tweede stand in.'};
  }

  function create({draftApi=window.LightningOnboardingDraft,visual=window.LightningReceiverVisual,pixelSetup=window.LightningPixelSetup,pixelsPerMeter,services={},getModel,onComplete=()=>{},onManage=null,onExit=()=>{},allowPinLogin=false,automaticFirstReceiver=()=>false,firstStandAccessRequired=()=>false,onFirstStandAccess=null,allowLocalConcept=()=>false,onPreserveLocalConcept=null}={}){
    if(!draftApi||!pixelSetup||typeof getModel!=='function')throw Error('Onboarding dependencies are required.');
    const pixelLimits=pixelSetup.pixelLimits({pixelsPerMeter});
    let draft=null,container=null,results=[],searchState='idle',receiverFilter='all',error='',notice='',busy=false,operation=0;
    let securityReceiptRef=null,finalReceiptRef=null,securityUncertain=false,finalizationStarted=false,completeModel=null,manualRejoinSSID=null;
    // Presentation hold only. No PIN, model archive or private receipt is in
    // this checkpoint. Native publication is not customer setup completion.
    let firstAccess=null,firstAccessErrorCode='',firstAccessReturnPending=false,firstAccessJob=null;
    const diagnosedFirstAccess=new Set();
    function firstAccessIdentity(value){
      if(!value||Object.keys(value).sort().join(',')!=='fingerprint,receiverId,rid,schema,stage,standId,transactionId'||value.schema!==1||value.stage!=='wifi-pin'||
         !['standId','receiverId','transactionId'].every(key=>typeof value[key]==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value[key]))||
         typeof value.rid!=='string'||typeof value.fingerprint!=='string')throw Error('FIRST_ACCESS_CHECKPOINT_INVALID');
      const current=getModel(),receiver=current.receivers.find(item=>item.id===value.receiverId);
      if(current.stands.length!==1||current.stands[0].id!==value.standId||!receiver||receiver.role!=='main'||receiver.lifecycle!=='added'||receiver.standId!==value.standId||
         receiver.rid!==value.rid||receiver.deviceFingerprint!==value.fingerprint||receiver.onboardingTransactionId!==value.transactionId)throw Error('FIRST_ACCESS_CHECKPOINT_INVALID');
      return clone(value);
    }
    function restoreFirstStandAccess(value,{phase='checking'}={}){
      if(container||busy||!['checking','pin','reconnect'].includes(phase))throw Error('FLOW_ACTIVE');
      firstAccess={identity:firstAccessIdentity(value),phase,ssid:''};
      draft=draftApi.create({model:getModel(),transactionId:value.transactionId,standId:value.standId});
      completeModel=null;error='';firstAccessErrorCode='';notice='';
    }
    function firstAccessPage(){
      const phase=firstAccess.phase,done=phase==='done',pin=phase==='pin',reconnect=phase==='reconnect';
      const fields=pin?`<div class="pin-protection-dialog"><label class="dialog-field">${escape(tx("Wifi-PIN · 8–12 cijfers"))}<input data-first-stand-code type="password" inputmode="numeric" minlength="8" maxlength="12" pattern="[0-9]{8,12}" autocomplete="off" ${busy?'disabled':''}></label><label class="dialog-field">${escape(tx("Herhaal je wifi-PIN"))}<input data-first-stand-code-confirm type="password" inputmode="numeric" minlength="8" maxlength="12" pattern="[0-9]{8,12}" autocomplete="off" ${busy?'disabled':''}></label><div class="pin-protection-dialog" data-first-access-actions>${button('first-access-code',busy?tx('PIN bewaren…'):tx('PIN bewaren en verder'),'class="button full" '+(busy?'disabled':''))}${button('first-access-suggest',tx('Stel een PIN voor'),'class="text-button" '+(busy?'disabled':''))}</div></div>`:
        done?button('first-access-done',tx('Naar mijn stand')):reconnect?`<ol class="first-access-rejoin-steps"><li>${escape(tx('Open Instellingen → Wifi.'))}</li><li>${escape(tx('Kies het netwerk hierboven met je nieuwe PIN.'))}</li><li>${escape(tx("Kom terug. Je stand wordt gecontroleerd en geladen."))}</li></ol><details class="first-access-rejoin-help"><summary>${escape(tx("Verbinding lukt niet?"))}</summary><p>${escape(tx("Je telefoon kan het oude wifiwachtwoord onthouden. Kies bij dit netwerk ‘Vergeet dit netwerk’ en verbind opnieuw met je nieuwe PIN. Je stand blijft bewaard."))}</p></details>${button('first-access-reconnect',busy?tx('Stand laden…'):tx('Verbinding controleren'),'class="button full" '+(busy?'disabled':''))}`:`<p>${escape(tx("Je stand blijft bewaard."))}</p>${button('first-access-reconnect',busy?tx('Stand controleren…'):tx('Wifi controleren'),busy?'disabled':'')}`;
      const network=firstAccess.ssid?`<div class="first-access-network"><small>${escape(tx("Kies dit wifi-netwerk"))}</small><div><strong data-first-access-ssid>${escape(firstAccess.ssid)}</strong>${button('first-access-copy-network',tx('Kopieer'),`class="button secondary" aria-label="${escape(tx('Netwerknaam kopiëren'))}"`)}</div><span role="status" data-first-access-copy-status></span></div>`:'';
      const steps=phase==='checking'?'':`<ol class="stand-simple-steps" aria-label="${escape(tx("Stand instellen in drie stappen"))}"><li><i>✓</i><b>${escape(tx("Receiver gevonden"))}</b></li><li ${!done&&!reconnect?'aria-current="step"':''}><i>${done||reconnect?'✓':'2'}</i><b>${done||reconnect?tx('PIN gekozen'):tx('PIN kiezen')}</b></li><li ${done||reconnect?'aria-current="step"':''}><i>${done?'✓':'3'}</i><b>${done?tx('Klaar'):tx('Stand openen')}</b></li></ol>`;
      return `<div class="page onboarding-page" data-onboarding-stage="${done?'done':'wifi-pin'}" data-first-stand-access="${phase}" aria-busy="${busy}">${steps}${pin?`<div class="onboarding-found-status" role="status"><b><i aria-hidden="true"></i>${escape(tx("Receiver gevonden"))}</b></div>`:''}<h1>${done?tx('Je stand is klaar'):pin?tx('Kies je eigen wifi-PIN'):reconnect?tx('Verbind met je nieuwe PIN'):tx('Stand controleren')}</h1><section class="card">${network}${pin?`<p>${escape(tx("Dit wordt je wifiwachtwoord."))}</p>`:''}${fields}<p role="alert" data-first-access-error>${escape(tx(error))}${error&&firstAccessErrorCode?` <small data-first-access-error-code>${escape(firstAccessErrorCode)}</small>`:''}</p></section></div>`;
    }
    async function runFirstAccess(kind,standCode){
      if(!firstAccess||busy||firstAccess.phase==='done'||typeof onFirstStandAccess!=='function')return;
      const retained=firstAccess,token=operation,job={kind};firstAccessJob=job;
      const ownsJob=()=>firstAccessJob===job&&firstAccess===retained&&token===operation;
      busy=true;error='';firstAccessErrorCode='';paintPage(false);
      try{
        const requestKind=kind==='reconnect'&&retained.phase==='reconnect'?'resume':kind;
        const result=await onFirstStandAccess({kind:requestKind,identity:clone(retained.identity),...(standCode===undefined?{}:{standCode})});
        if(!ownsJob())return;
        if(result?.status==='connected'){
          if(!container||document.hidden)return;
          const central=window.LightningStandConnection.projection(result,retained.identity.standId);
          const receiver=central.view.model.receivers.find(item=>item.id===retained.identity.receiverId);
          if(!receiver||receiver.role!=='main'||receiver.rid!==retained.identity.rid||receiver.deviceFingerprint!==retained.identity.fingerprint)throw Object.assign(Error(),{code:'FIRST_ACCESS_IDENTITY'});
          completeModel=central.view.model;await onComplete(completeModel,{receiverId:receiver.id,zoneId:receiver.zoneId,central});
          if(!ownsJob())return;
          retained.phase='done';
        }else if(result&&['pin','reconnect','checking'].includes(result.phase)){
          retained.phase=result.phase;retained.ssid=typeof result.ssid==='string'?result.ssid:'';
          if(retained.phase==='reconnect'&&document.hidden)firstAccessReturnPending=true;
        }else throw Error('FIRST_ACCESS_UNCONFIRMED');
      }catch(failure){
        if(!ownsJob())return;
        if(kind==='diagnose'&&services.firstStandAccessDiagnosticsAvailable===true&&typeof services.standFirstAccessDiagnosticFailure==='function'){
          // Non-blocking, opt-in diagnostics only. The facade/native recorder
          // accepts closed codes, never this exception's message or stack.
          void services.standFirstAccessDiagnosticFailure({code:failure?.code}).catch(()=>{});
        }
        if(['STAND_MIGRATION_CODE_UNCONFIRMED','STAND_CODE_CHANGE_UNCONFIRMED'].includes(failure?.code))retained.phase='reconnect';
        const problem=firstAccessFailure(failure);error=problem.message;firstAccessErrorCode=problem.code;
      }finally{standCode='';if(ownsJob()){firstAccessJob=null;busy=false;if(retained.phase!=='reconnect')firstAccessReturnPending=false;paintPage(false);resumeFirstAccessAfterWifiReturn();}}
    }
    function resumeFirstAccessAfterWifiReturn(){
      // Exactly one authentication/readback attempt per return from Settings.
      // Never re-send a PIN, start a new setup, or run a retry timer.
      if(!firstAccessReturnPending||!container||document.hidden||busy||firstAccess?.phase!=='reconnect')return;
      firstAccessReturnPending=false;void runFirstAccess('reconnect');
    }
    function diagnoseFirstAccessOnce(){
      if(!firstAccess||firstAccess.phase==='done'||!container||busy||document.hidden||services.firstStandAccessDiagnosticsAvailable!==true)return;
      const key=JSON.stringify(firstAccess.identity);if(diagnosedFirstAccess.has(key))return;
      diagnosedFirstAccess.add(key);queueMicrotask(()=>{
        if(container&&firstAccess&&JSON.stringify(firstAccess.identity)===key&&!busy&&!document.hidden)void runFirstAccess('diagnose');
      });
    }
    let returningFromWifi=false,rejoinTimer=null,registrationPending=false;
    let rejoinSession=0,rejoinAttempts=0,rejoinRunning=false,rejoinExhausted=false,rejoinBlocked=false,automaticFinalizing=false;
    let identifying=new Map(),identifyPending=new Map(),identifyFocusOwner=null,zoneNameOpen=false,searchAbort=null,resumeSelection=null;
    let standNameInput=null,zoneNameInput='',draftSaving=false,pendingChoices=null,saveFailed=false,origin='stand';
    let zoneExtraNames=[],zoneRemoval=null,zoneRename=null,receiverMove=null,managementBusy=false,zoneListReturn=null;
    const visualEntrances=new Map(),presentedStages=new Set(),plugMotion=visual.createPlugMotion();
    let selectedOutput=null,unbindPixelScrub=null,openZonePickerOnNextPaint=false,receiverZoneSelection;
    let parkedChoices=new Map(),parkedTransactions=new Set(),parking=null,parkPending=null,actionAbort=null,searchOnMount=false,exiting=false;
    let localConceptPending=false;
    function localConceptEligible(){
      const base=getModel();
      return allowLocalConcept()===true&&!firstAccess&&!busy&&!draftSaving&&!pendingChoices&&!saveFailed&&!parking&&!parkPending&&!resumeSelection&&!exiting&&
        !searchAbort&&!actionAbort&&searchState!=='searching'&&!securityReceiptRef&&!finalReceiptRef&&!securityUncertain&&!finalizationStarted&&!registrationPending&&
        !rejoinRunning&&!automaticFinalizing&&parkedChoices.size===0&&parkedTransactions.size===0&&
        base?.demo===false&&['stands','receivers','scenes','presets'].every(key=>Array.isArray(base[key])&&base[key].length===0)&&
        !!draft&&draft.role==='main'&&draft.mainReceiverId===null&&['stand','zones'].includes(draft.stage)&&draft.stand?.isNew===true&&
        draft.receiver===null&&draft.outputs.length===0&&draft.port===null&&draft.zoneId===null&&!draft.cancelled&&draft.membership==='pending'&&
        draft.security.status==='not-started'&&draft.security.phase==='idle'&&
        ['standIds','zoneIds','receivers'].every(key=>draft.context[key].length===0)&&
        draft.zones.every(zone=>zone.isNew===true&&zone.type===null&&zone.layout==='stacked'&&zone.pixels===0)&&
        typeof services.parkDraft==='function'&&typeof onPreserveLocalConcept==='function';
    }
    function canContinueLocalConcept(){return !localConceptPending&&localConceptEligible();}
    async function continueLocalConcept(){
      if(!canContinueLocalConcept())throw Object.assign(Error(),{code:'LOCAL_CONCEPT_BLOCKED'});
      const retained=draft,token=operation,base=canonical(getModel());
      let next=window.LightningModel.localStand(retained.stand.id,retained.stand.name);
      for(const zone of retained.zones)next=window.LightningModel.createZone(next,retained.stand.id,{id:zone.id,name:zone.name});
      localConceptPending=true;
      const current=()=>draft===retained&&operation===token&&canonical(getModel())===base&&localConceptEligible();
      try{
        // The non-secret concept is durably read back before the active local
        // draft is cleared. A crash on either side retains names and IDs.
        await onPreserveLocalConcept(clone(next));
        if(!current())throw Object.assign(Error(),{code:'LOCAL_CONCEPT_CANCELLED'});
        const view=await services.parkDraft({transactionId:retained.transactionId});
        if(!current()||!view||Object.keys(view).sort().join(',')!=='draft,model,revision'||view.draft!==null||!Number.isSafeInteger(view.revision)||view.revision<0||canonical(view.model)!==base)
          throw Object.assign(Error(),{code:'LOCAL_CONCEPT_UNCONFIRMED'});
        reset();return next;
      }finally{localConceptPending=false;}
    }
    const searchable=()=>draft?.stage==='receiver';
    function searchDraft(value){
      return draftApi.snapshot({...clone(value),transactionId:'onboarding-'+uniqueId(),stage:'receiver',
        receiver:null,outputs:[],port:null,zoneId:null,security:{status:'not-started',phase:'idle'},cancelled:false,membership:'pending'});
    }
    async function parkForSearch({persistSearch=true}={}){
      if(parking)return parking;
      const saved=parkPending||(draft?.receiver&&draft.stage!=='done'?draft:null);
      if(!saved)return true;
      parkPending=saved;searchOnMount=true;cancelSearch();actionAbort?.abort();actionAbort=null;stopAutomaticRejoin();
      if(draft?.receiver||draft?.transactionId===saved.transactionId)draft=searchDraft(saved);
      results=[];searchState='idle';error='';notice='';draftSaving=true;
      securityReceiptRef=null;finalReceiptRef=null;securityUncertain=false;finalizationStarted=false;resumeSelection=null;manualRejoinSSID=null;
      parking=(async()=>{
        try{
          await pixelPreview.stop();
          if(!parkedTransactions.has(saved.transactionId)){
            if(typeof services.parkDraft==='function')await services.parkDraft({transactionId:saved.transactionId});
            else parkedChoices.set(saved.receiver.id,clone(saved));
            parkedTransactions.add(saved.transactionId);
          }
          if(persistSearch&&typeof services.persistDraft==='function')await services.persistDraft({draft:clone(draft)});
          parkPending=null;saveFailed=false;return true;
        }catch(_){error='De zoeklijst kon nog niet worden geopend. Probeer opnieuw. Je receivers zijn niet gewijzigd.';return false;}
        finally{parking=null;draftSaving=false;busy=false;paintPage(false);}
      })();
      return parking;
    }
    async function parkForExit(){
      if(parking&&!(await parking))return false;
      // A selected receiver is kept privately with its exact transaction.
      // Unlike browsing another receiver, leaving needs no new active search.
      if(parkPending||draft?.receiver&&draft.stage!=='done')return parkForSearch({persistSearch:false});
      if(draft?.role==='node'&&draft.stage==='receiver'&&draft.receiver===null&&
          draft.security.status==='not-started'&&draft.security.phase==='idle'&&
          draft.outputs.length===0&&draft.port===null&&typeof services.parkDraft==='function'){
        try{await services.parkDraft({transactionId:draft.transactionId});}
        catch(_){error='De toevoeging kon nog niet worden afgesloten. Probeer opnieuw. Je receivers en keuzes blijven bewaard.';paintPage(false);return false;}
      }
      return true;
    }
    async function browseReceivers(){
      if(await parkForSearch()){paintPage(true);if(container)void search();}
    }
    let previewState={kind:'idle'},previewStopJob=null;
    const pixelPreview=pixelSetup.createLivePreview({send:services.previewPixels,onState:state=>{previewState=state;pixelSetup.showPreviewStatus(container,state);}});
    function syncPixelPreview({commit=false}={}){
      if(busy&&['outputs','pixels','connection'].includes(draft?.stage))return;
      if(!container||document.hidden||!['outputs','pixels','connection'].includes(draft?.stage)){void pixelPreview.stop();return;}
      const selected=draft.outputs.find(output=>output.port===draft.port);
      const request=pixelSetup.guideRequest({context:{standId:draft.stand.id,transactionId:draft.transactionId,
        receiver:{id:draft.receiver.id,rid:draft.receiver.rid,type:'SPI',deviceFingerprint:draft.receiver.deviceFingerprint},
        role:draft.role,mainReceiverId:draft.mainReceiverId},outputs:draft.outputs,output:selected,stage:draft.stage,capabilities:services.previewCapabilities||{}});
      if(!request){void pixelPreview.stop();return;}
      pixelPreview.update(request);
      if(commit)void pixelPreview.flush();
      pixelSetup.showPreviewStatus(container,previewState);
    }
    const saveNotice='Niet bewaard. Probeer opnieuw.';
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
      if(region){region.hidden=!notice&&!draftSaving;region.textContent=draftSaving?tx('Je keuzes bewaren…'):tx(notice);}
      updateGuidance();
    }
    function keepDraft(){persist().catch(()=>{saveFailed=true;notice=saveNotice;refreshNotice();});}
    function captureNames(){
      const stand=container?.querySelector('#onboarding-stand-name'),zone=container?.querySelector('#onboarding-zone-name');
      if(stand)standNameInput=stand.value;if(zone)zoneNameInput=zone.value;
      if(zone)zoneExtraNames=Array.from(container.querySelectorAll('[data-zone-extra]'),field=>field.value);
      const rename=container?.querySelector('#onboarding-zone-rename');if(rename&&zoneRename)zoneRename.name=rename.value;
    }
    function rememberZoneList(target){
      const index=draft.zones.findIndex(zone=>zone.id===target.dataset.id);
      zoneListReturn={stage:draft.stage,x:window.scrollX,y:window.scrollY,action:target.dataset.onboardingAction,
        ids:[target.dataset.id,draft.zones[index+1]?.id,draft.zones[index-1]?.id].filter(Boolean)};
    }
    function restoreZoneList(){
      if(!zoneListReturn)return;
      if(zoneListReturn.stage!==draft.stage){zoneListReturn=null;return;}
      if(zoneRename||zoneRemoval||draftSaving||managementBusy||pendingChoices)return;
      // Editing temporarily replaces a long list with a short panel. Its
      // clamped scroll position must not become the list's return position.
      const saved=zoneListReturn;zoneListReturn=null;
      window.scrollTo({top:saved.y,left:saved.x,behavior:'instant'});
      const control=saved.ids.map(id=>container.querySelector(`[data-onboarding-action="${saved.action}"][data-id="${CSS.escape(id)}"]`)).find(Boolean)
        ||container.querySelector('#onboarding-zone-name');
      control?.focus({preventScroll:true});
    }
    const canManageZones=()=>!!draft&&!draft.receiver&&!draft.cancelled&&draft.security.status==='not-started'&&['zones','receiver'].includes(draft.stage);
    const zoneMembers=id=>getModel().receivers.filter(receiver=>receiver.standId===draft.stand?.id&&receiver.zoneId===id&&receiver.lifecycle==='added');
    const currentZone=id=>getModel().stands.find(stand=>stand.id===draft.stand?.id)?.zones.find(zone=>zone.id===id);
    const zoneSignature=zone=>JSON.stringify([zone.id,zone.name,zone.type,zone.receiverIds]);
    function resetZoneNames(){zoneNameInput='';zoneExtraNames=[];container?.querySelectorAll('#onboarding-zone-name,[data-zone-extra]').forEach(field=>{if(field.hasAttribute('data-zone-extra'))field.remove();else field.value='';});}
    function zoneNames(){return [zoneNameInput,...zoneExtraNames];}
    function validZoneNames(){const names=zoneNames(),keys=names.map(name=>name.trim().normalize('NFKC').toLowerCase());return names.every(validName)&&new Set(keys).size===keys.length&&draft.zones.length+names.length<=256;}
    const hasZoneNames=()=>zoneExtraNames.length>0||zoneNameInput.trim().length>0;
    const canContinueZones=()=>hasZoneNames()?validZoneNames():draft.zones.length>0;
    const newZoneEvents=()=>zoneNames().map(name=>({type:'ADD_ZONE',id:'zone-'+uniqueId(),name}));
    // Commit the entire small setup step, including its destination screen, as
    // one native draft. Retrying uses the exact same IDs and candidate after an
    // uncertain storage response; it cannot create a second stand or zone.
    async function saveChoices(events=[],afterSave=()=>{},{top=true,focusDestination=false}={}){
      if(draftSaving)return false;
      captureNames();
      if(!pendingChoices){
        let candidate=draft;
        for(const event of events){const result=draftApi.transition(candidate,event);if(result.error){error=result.error.message;paintPage(false);return false;}candidate=result.draft;}
        pendingChoices={draft:candidate,afterSave,top,focusDestination,focusedZone:container?.contains(document.activeElement)&&document.activeElement.dataset.onboardingAction==='active-zone'?document.activeElement.dataset.id:null};
      }
      draftSaving=true;error='';paintPage(false);
      const pending=pendingChoices;
      try{
        if(typeof services.persistDraft==='function')await services.persistDraft({draft:draftApi.snapshot(pending.draft)});
        draft=pending.draft;pendingChoices=null;saveFailed=false;notice='';pending.afterSave();return true;
      }catch(_){saveFailed=true;notice=saveNotice;return false;}
      finally{
        draftSaving=false;
        if(pendingChoices&&saveFailed&&draft.stage==='receiver'){
          const picker=container?.querySelector('[data-receiver-destination]');if(picker)picker.open=false;
          const dialog=picker?.querySelector('[data-onboarding-zone-dialog]');if(dialog?.open)dialog.close();openZonePickerOnNextPaint=false;
        }
        paintPage(!pendingChoices&&pending.top);
        if(!pendingChoices&&!pending.top&&pending.focusDestination)container?.querySelector('.onboarding-destination>summary')?.focus({preventScroll:true});
        else if(!pendingChoices&&!pending.top&&pending.focusedZone){
          if(pending.draft.stage==='receiver'&&!container?.querySelector('.onboarding-destination')?.open)container?.querySelector('.onboarding-destination>summary')?.focus({preventScroll:true});
          else container?.querySelector(`[data-onboarding-action="active-zone"][data-id="${CSS.escape(pending.focusedZone)}"]`)?.focus({preventScroll:true});
        }
      }
    }
    function verifyAgain(value){
      const needsPin=pinRequired()&&value.role==='main';
      resumeSelection=clone(value);resumeSelection.security=needsPin||value.security.status==='not-started'?{status:'not-started',phase:'idle'}:{status:'pending',phase:'configuring'};
      if(['security','zone','review'].includes(resumeSelection.stage))resumeSelection.stage=needsPin?'pin':'security';
      draft=draftApi.snapshot({...clone(value),stage:'receiver',receiver:null,outputs:[],port:null,zoneId:null,security:{status:'not-started',phase:'idle'},cancelled:false});
      securityUncertain=false;securityReceiptRef=null;finalReceiptRef=null;manualRejoinSSID=null;searchState='idle';results=[];
    }
    function restore(value){
      if(container||busy)throw Error('FLOW_ACTIVE');
      const saved=draftApi.snapshot(value);if(saved.membership==='added')throw Error('ALREADY_ADDED');
      if(saved.receiver){parkPending=saved;draft=searchDraft(saved);}
      else draft=saved;
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
    function start({activeZoneId,retargetZone=false}={}){
      if(firstAccess)return;
      if(!draft||draft.stage==='done'){
        draft=draftApi.create({model:getModel(),activeZoneId,transactionId:'onboarding-'+uniqueId()});
        results=[];searchState='idle';securityReceiptRef=null;finalReceiptRef=null;completeModel=null;
        securityUncertain=false;finalizationStarted=false;manualRejoinSSID=null;resumeSelection=null;error='';notice='';zoneNameOpen=false;
        stopAutomaticRejoin();rejoinExhausted=false;rejoinBlocked=false;automaticFinalizing=false;registrationPending=false;returningFromWifi=false;
        standNameInput=null;zoneNameInput='';pendingChoices=null;saveFailed=false;
        zoneExtraNames=[];zoneRemoval=null;zoneRename=null;receiverMove=null;managementBusy=false;zoneListReturn=null;
        visualEntrances.clear();presentedStages.clear();plugMotion.clear();selectedOutput=null;openZonePickerOnNextPaint=false;receiverZoneSelection=undefined;
      }else {
        if(draft.cancelled)change({type:'RETRY'},{render:false});
        // Reopening discovery from another zone may change its destination,
        // but never silently move an already selected or pending receiver.
        if(retargetZone&&draft.stage==='receiver'&&!draft.receiver&&activeZoneId&&draft.zones.some(zone=>zone.id===activeZoneId)&&draft.activeZoneId!==activeZoneId)
          change({type:'SELECT_ACTIVE_ZONE',zoneId:activeZoneId},{render:false});
      }
    }
    const automaticMain=()=>pinRequired()&&!!draft&&draft.role==='main'&&manualWifi();
    const placementReady=()=>!draft?.zoneChoiceRequired&&(!!draft?.zoneId||draft?.activeZoneId===null);
    const pendingMain=()=>automaticMain()&&((draft.stage==='security'&&securityUncertain)||(['zone','review'].includes(draft.stage)&&draft.security.status==='confirmed'&&placementReady()));
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
      if(draft.security.status==='confirmed'&&placementReady()&&['zone','review'].includes(draft.stage)){
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
      if(document.hidden&&firstAccess){
        container?.querySelectorAll('[data-first-stand-code],[data-first-stand-code-confirm]').forEach(field=>{field.value='';});
        if(firstAccess.phase==='reconnect'||firstAccessJob?.kind==='set-code')firstAccessReturnPending=true;
        if(busy&&!['done','reconnect'].includes(firstAccess.phase))firstAccess.phase='checking';
      }
      syncPixelPreview();
      if(document.hidden){if(pendingMain())returningFromWifi=true;stopAutomaticRejoin();}
      else {resumeFirstAccessAfterWifiReturn();if(returningFromWifi)resumeAfterWifiReturn();}
    }
    function probeAfterWifiReturn(){
      const guide=window.LightningSetupWifiGuide;
      if(guide?.canProbe({mounted:!!container,hidden:document.hidden,manualWifi:manualWifi(),stage:draft?.stage,busy,
        saving:draftSaving,pending:!!pendingChoices,firstAccess:!!firstAccess,searching:searchState==='searching',identifying:!!(identifyPending.size||identifying.size)}))void search();
    }
    function nativeActive(){resumeFirstAccessAfterWifiReturn();resumeAfterWifiReturn();probeAfterWifiReturn();}
    function pageShown(event){if(event.persisted||returningFromWifi||firstAccessReturnPending){resumeFirstAccessAfterWifiReturn();resumeAfterWifiReturn();probeAfterWifiReturn();}}
    function mount(element,options){
      // A confirmed central publication may redraw this same page before
      // finish() returns. Keep its completion screen; only a genuine new
      // entry (after suspend) or the explicit Another action starts again.
      if(options?.preservePresentation===true&&draft?.stage==='receiver'&&container?.querySelector('[data-onboarding-zone-dialog]')?.open===true)openZonePickerOnNextPaint=true;
      if(!firstAccess&&(!container||draft?.stage!=='done'))start({...options,retargetZone:options?.origin==='layout'&&!container});
      unbindPixelScrub?.();unbindPixelScrub=null;
      if(container){container.removeEventListener('click',click);container.removeEventListener('input',input);container.removeEventListener('change',input);container.removeEventListener('keydown',keydown);container.removeEventListener('keyup',commitPixelKey);}
      origin=['receivers','layout'].includes(options?.origin)&&draft.mainReceiverId?options.origin:'stand';container=element;
      container.addEventListener('click',click);container.addEventListener('input',input);container.addEventListener('change',input);container.addEventListener('keydown',keydown);container.addEventListener('keyup',commitPixelKey);
      unbindPixelScrub=pixelSetup.bindPixelScrub(container,{isEnabled:()=>draft?.stage==='pixels'&&!busy&&!draftSaving,onChange:value=>updatePixelCount(value,null,{haptic:false}),onCommit:()=>void pixelPreview.flush()});
      document.addEventListener('visibilitychange',visibilityChanged);window.addEventListener('lightning:native-active',nativeActive);window.addEventListener('pageshow',pageShown);
      if(!firstAccess&&(parkPending||parking)){void parkForSearch().then(ok=>{if(ok&&container)void search();});}
      else if(!firstAccess&&(options?.autoSearch||searchOnMount)&&draft.stage==='receiver'&&searchState==='idle')queueMicrotask(()=>{if(container&&draft.stage==='receiver'&&!busy&&searchState==='idle')void search();});
      paintPage(false);
      diagnoseFirstAccessOnce();
    }
    function suspend({discard=false}={}){
      if(previewStopJob){const job=previewStopJob;previewStopJob=null;job.restore();busy=false;}
      void pixelPreview.stop();
      // Release only this presentation's job. Its late native result cannot
      // repaint, complete setup, or release a newer job after remount.
      if(firstAccessJob){firstAccessJob=null;busy=false;}
      // Leaving this screen must never discard an uncertain claim. PIN inputs
      // are destroyed; only non-secret choices and opaque receipts stay private.
      captureNames();container?.querySelectorAll('[data-onboarding-pin],[data-first-stand-code],[data-first-stand-code-confirm]').forEach(input=>{input.value='';});
      const zoneDialog=container?.querySelector('[data-onboarding-zone-dialog]');
      if(zoneDialog?.open){zoneDialog.close();const picker=zoneDialog.closest('[data-receiver-destination]');if(picker)picker.open=false;zoneNameOpen=false;}
      receiverZoneSelection=undefined;openZonePickerOnNextPaint=false;
      unbindPixelScrub?.();unbindPixelScrub=null;
      if(container){container.removeEventListener('click',click);container.removeEventListener('input',input);container.removeEventListener('change',input);container.removeEventListener('keydown',keydown);container.removeEventListener('keyup',commitPixelKey);}
      document.removeEventListener('visibilitychange',visibilityChanged);window.removeEventListener('lightning:native-active',nativeActive);window.removeEventListener('pageshow',pageShown);stopAutomaticRejoin();returningFromWifi=false;
      container=null;firstAccessReturnPending=false;cancelSearch();plugMotion.clear();selectedOutput=null;zoneListReturn=null;
      for(const pending of identifyPending.values())pending.abort();identifyPending.clear();identifyFocusOwner=null;
      for(const id of identifying.keys())stopIdentify(id);
      if(!discard&&!firstAccess&&draft?.receiver&&draft.stage!=='done')void parkForSearch();
    }
    function reset(){
      suspend({discard:true});draft=null;firstAccess=null;results=[];receiverFilter='all';securityReceiptRef=null;finalReceiptRef=null;
      parkPending=null;searchOnMount=false;parkedChoices.clear();parkedTransactions.clear();
      securityUncertain=false;finalizationStarted=false;completeModel=null;pendingChoices=null;
      resumeSelection=null;manualRejoinSSID=null;error='';notice='';busy=false;
    }
    function receiverSetupProgress(){
      if(origin==='stand'&&automaticFirstReceiver()&&pinRequired()){
        return `<ol class="stand-simple-steps" data-onboarding-first-steps aria-label="${escape(tx("Stand instellen in drie stappen"))}"><li aria-current="step"><i>1</i><b>${escape(tx("Wifi verbinden"))}</b></li><li><i>2</i><b>${escape(tx("PIN kiezen"))}</b><small>${escape(tx("8–12 cijfers"))}</small></li><li><i>3</i><b>${escape(tx("Klaar"))}</b></li></ol>`;
      }
      if(['stand','zones'].includes(draft.stage)||receiverMove)return '';
      const spi=draft.receiver?.type==='SPI',steps=spi?[tx('Zoeken'),tx('Instellen'),tx('Verbinden')]:[tx('Zoeken'),tx('Verbinden')];
      const current=draft.stage==='receiver'?0:spi&&['placement','outputs','pixels','connection','zone'].includes(draft.stage)?1:steps.length-1;
      const done=draft.stage==='done';
      return `<ol class="onboarding-setup-steps onboarding-receiver-steps" data-onboarding-receiver-steps data-step-count="${steps.length}" data-receiver-setup-type="${draft.receiver?.type||'any'}" aria-label="${escape(tx("Receiver toevoegen in stappen"))}">${steps.map((label,i)=>`<li class="${done||i<current?'completed':''}" ${!done&&i===current?'aria-current="step"':''}><span aria-hidden="true">${done||i<current?'✓':i+1}</span><b>${label}</b></li>`).join('')}</ol>`;
    }
    function heading(){
      const firstSetup=origin==='stand';
      const step=draft.stage==='stand'?1:draft.stage==='zones'?2:3;
      const connectionCardStage=draft.stage==='security'||draft.stage==='pin'&&!pinRequired()||draft.stage==='review'&&!pinRequired()&&automaticFinalizing&&busy;
      const title=draft.stage==='stand'?tx('Hoe heet je stand?'):draft.stage==='zones'?(zoneRemoval?tx('Zones beheren'):zoneRename?tx('Zone hernoemen'):receiverMove?tx('Ledline verplaatsen'):tx('Je zones')):draft.stage==='receiver'?(receiverMove?tx('Ledline verplaatsen'):busy?tx('Receiver controleren'):searchState==='searching'?tx('Receiver zoeken…'):results.length===1?tx('Receiver gevonden'):results.length>1?tx('Kies je receiver'):tx('Receiver zoeken')):automaticMain()&&draft.stage==='security'?(busy||rejoinRunning?tx('Je receiver toevoegen'):tx('Verbind opnieuw met wifi')):automaticMain()&&automaticFinalizing&&draft.stage==='review'?tx('Je receiver toevoegen'):labels[draft.stage]||tx('Receiver toevoegen');
      const receiverContext=draft.receiver&&!connectionCardStage&&!['receiver','done'].includes(draft.stage)?`<p class="onboarding-receiver-context"><b>${escape(draft.receiver.name||tx('Receiver'))}</b><span>${escape(draft.receiver.type)}</span></p>`:'';
      return `<header class="onboarding-setup-header"><div><span class="onboarding-setup-label">${firstSetup?(automaticFirstReceiver()?tx('Je stand instellen'):`${tx('Stap')} ${step} · ${tx(step===1?tx('Standnaam'):step===2?tx('Zones'):tx('Verlichting aansluiten'))}`):tx('Receiver toevoegen')}</span>${draft.stand?.name&&!['stand','zones'].includes(draft.stage)?`<small class="onboarding-stand-context">${escape(draft.stand.name)}</small>`:''}</div></header>${receiverSetupProgress()}<header class="onboarding-heading"><h1>${tx(title)}</h1>${receiverContext}</header>${!connectionCardStage&&!['stand','zones','receiver','placement','outputs','done'].includes(draft.stage)?zoneContext():''}`;
    }
    function zoneVisual(index){
      return `<span class="onboarding-zone-number" aria-hidden="true">${index+1}</span>`;
    }
    function setupZones({editable=false,withoutZone=false,compact=false}={}){
      return `<div class="onboarding-zone-list onboarding-zone-tiles" aria-label="${escape(tx("Jouw zones"))}">${withoutZone?withoutZoneChoice():''}${draft.zones.map((zone,index)=>{const count=zoneMembers(zone.id);const detail=compact?(zone.type||tx('Nog geen ledlines')):(count.length?`${count.length} ${count.length===1?tx('ledline'):tx('ledlines')} · ${zone.type}`:tx('Nog geen ledlines'));return `<div class="onboarding-zone-row" data-setup-zone-row="${escape(zone.id)}"><button type="button" class="onboarding-zone" data-setup-zone="${escape(zone.id)}" data-onboarding-action="active-zone" data-id="${escape(zone.id)}" aria-pressed="${draft.activeZoneId===zone.id}">${zoneVisual(index)}<span><b>${escape(zone.name)}</b><small>${detail}${!compact&&draft.activeZoneId===zone.id?' · '+tx('Gekozen'):''}</small></span><i aria-hidden="true">${draft.activeZoneId===zone.id?'✓':''}</i></button>${editable&&canManageZones()?`<div class="onboarding-zone-tools"><button type="button" class="onboarding-rename-zone" data-onboarding-action="zone-rename" data-id="${escape(zone.id)}" aria-label="${escape(tx('{name} hernoemen',{name:zone.name}))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z"/></svg></button><button type="button" class="onboarding-remove-zone" data-onboarding-action="zone-remove" data-id="${escape(zone.id)}" aria-label="${escape(tx('{name} verwijderen',{name:zone.name}))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg></button></div>`:''}</div>`;}).join('')}</div>`;
    }
    function zoneRenamePanel(){
      const zone=draft.zones.find(zone=>zone.id===zoneRename?.zoneId);if(!zone)return '';
      return `<section class="card onboarding-zone-confirm" data-setup-rename-zone="${escape(zone.id)}"><h2>${escape(zone.name)}</h2><p>${escape(tx(pinRequired()?'Alleen de naam verandert. Receivers, PIN en opgeslagen licht blijven bewaard.':'Alleen de naam verandert. Receivers en opgeslagen licht blijven bewaard.'))}</p>${nameField('onboarding-zone-rename',tx('Zonenaam'),tx('Bijvoorbeeld: Demohoek'),zoneRename.name)}<div class="onboarding-actions">${button('zone-rename-cancel',tx('Annuleren'),'class="button secondary"')}${button('zone-rename-confirm',tx('Naam opslaan'),'disabled')}</div></section>`;
    }
    function zoneNameFields(){
      return `<section class="card onboarding-name-card onboarding-batch-zones"><div class="onboarding-zone-inputs">${zoneNames().map((name,index)=>`<div class="onboarding-zone-input">${index===0?nameField('onboarding-zone-name',zoneNames().length===1?(draft.zones.length?tx('Nog een zone toevoegen'):tx('Zonenaam')):tx('Zone 1'),tx('Bijvoorbeeld: Demohoek'),name):`<label class="onboarding-field">${escape(tx('Zone {number}',{number:index+1}))}<input id="onboarding-zone-name-${index}" data-zone-extra="${index}" maxlength="64" autocomplete="off" value="${escape(name)}" placeholder="${escape(tx("Bijvoorbeeld: Balie"))}"></label>`}${zoneNames().length>1?`<button type="button" data-onboarding-action="zone-drop-row" data-index="${index}" aria-label="${escape(tx('Naamveld {number} verwijderen',{number:index+1}))}">×</button>`:''}</div>`).join('')}</div><div class="onboarding-zone-add-actions">${button('zone-add-row',tx('＋ Nog een zone'),'class="button secondary" '+(zoneNames().length>=12||draft.zones.length+zoneNames().length>=256?'disabled':''))}</div></section>`;
    }
    function zoneRemovalPanel(){
      const zone=draft.zones.find(zone=>zone.id===zoneRemoval?.zoneId);if(!zone)return '';
      const count=zoneMembers(zone.id).length;
      return `<section class="card onboarding-zone-confirm" data-setup-delete-zone="${escape(zone.id)}"><h2>${escape(tx('{name} verwijderen?',{name:zone.name}))}</h2><p>${count?escape(tx('{count} ledlines blijven gekoppeld en komen bij Niet in een zone. Je kunt ze meteen opnieuw indelen.',{count})):tx('Je verwijdert alleen deze zone.')}</p><small>${escape(tx(pinRequired()?'Je ledlines en PIN worden niet gereset.':'Je ledlines worden niet gereset.'))}</small><div class="onboarding-actions">${button('zone-remove-cancel',tx('Annuleren'),'class="button secondary"')}${button('zone-remove-confirm',tx('Zone verwijderen'))}</div></section>`;
    }
    function receiverPlacement(){
      if(!canManageZones())return '';
      const chosen=draft.zones.find(zone=>zone.id===draft.activeZoneId),members=zoneMembers(chosen?.id),unassigned=getModel().receivers.filter(receiver=>receiver.standId===draft.stand?.id&&receiver.lifecycle==='added'&&!receiver.zoneId);
      const rows=list=>list.map(receiver=>`<div class="onboarding-member" data-setup-receiver="${escape(receiver.id)}"><span class="onboarding-member-type">${receiver.type}</span><span><b>${escape(receiver.name)}</b><small>${receiver.zoneId?tx('Toegevoegd'):tx('Nog geen zone')}</small></span>${button('receiver-move',receiver.zoneId?tx('Zone wijzigen'):tx('Zone kiezen'),`data-id="${escape(receiver.id)}" class="button secondary"`)}</div>`).join('');
      return `${members.length?`<section class="onboarding-members"><h2>${escape(tx('Ledlines in {name}',{name:chosen.name}))} <span>${members.length}</span></h2>${rows(members)}</section>`:''}${unassigned.length?`<section class="onboarding-members"><h2>${escape(tx('Ledlines zonder zone'))} <span>${unassigned.length}</span></h2>${rows(unassigned)}</section>`:''}`;
    }
    function movePanel(){
      const receiver=getModel().receivers.find(receiver=>receiver.id===receiverMove?.receiverId);if(!receiver)return '';
      return `<section class="card onboarding-move-panel" data-setup-move-receiver="${escape(receiver.id)}"><h2>${escape(tx('Waar hoort {name}?',{name:receiver.name}))}</h2><p>${escape(tx("Kies een zone. Zijn lichtinstellingen blijven bewaard."))}</p><div class="onboarding-zone-list">${draft.zones.map((zone,index)=>{const compatible=!zone.type||zone.type===receiver.type;return `<button type="button" class="onboarding-zone" data-onboarding-action="move-zone" data-id="${escape(zone.id)}" aria-pressed="${receiverMove.zoneId===zone.id}" ${compatible?'':'disabled'}>${zoneVisual(index)}<span><b>${escape(zone.name)}</b><small>${!compatible?tx('Alleen {type}',{type:zone.type}):receiver.zoneId===zone.id?tx('Huidige zone'):`${zoneMembers(zone.id).length} ${tx('ledlines')}`}</small></span><i aria-hidden="true">${receiverMove.zoneId===zone.id?'✓':''}</i></button>`;}).join('')}</div><div class="onboarding-actions">${button('move-cancel',tx('Annuleren'),'class="button secondary"')}${button('move-confirm',receiver.zoneId?tx('Zone wijzigen'):tx('Toewijzen aan zone'),!receiverMove.zoneId||receiverMove.zoneId===receiver.zoneId?'disabled':'')}</div></section>`;
    }
    function setupIcon(name){
      const paths={phone:'<rect x="12" y="3" width="20" height="38" rx="5"/><path d="M18 8h8M19 36h6"/>',wifi:'<path d="M5 16a25 25 0 0 1 34 0M11 23a16 16 0 0 1 22 0M17 30a7 7 0 0 1 10 0"/><circle cx="22" cy="37" r="1.5"/>',return:'<rect x="12" y="3" width="20" height="38" rx="5"/><path d="M5 23h20m-6-6 6 6-6 6M19 36h6"/>'};
      return `<svg viewBox="0 0 44 44" aria-hidden="true">${paths[name]||paths.phone}</svg>`;
    }
    function searchContext(){
      if(!draft.mainReceiverId)return '';
      const main=getModel().receivers.find(receiver=>receiver.id===draft.mainReceiverId);
      return `<p class="onboarding-main-context" data-onboarding-search-via="${escape(main?.type||'main')}">${escape(tx("Zoeken via je hoofdreceiver"))}</p>`;
    }
    function receiverAction(receiver){
      const zone=draft.zones.find(item=>item.id===draft.activeZoneId);
      const compatible=zone&&(!zone.type||zone.type===receiver.type);
      const retryIdentity=!!error&&receiver.canConfigure===false&&receiver.canVerifyIdentity===true;
      const label=retryIdentity?tx('Opnieuw controleren'):!pinRequired()&&receiver.type==='RGBW'?(compatible?escape(tx('Toevoegen aan {name}',{name:zone.name})):!zone?tx('Zonder zone toevoegen'):tx('Kies een passende zone')):escape(tx('Verder met {type}-receiver',{type:receiver.type}));
      return `${zone&&!compatible?`<p class="onboarding-compatibility-note">${escape(tx('{type} past niet in deze zone. Kies een andere zone of voeg hem zonder zone toe.',{type:receiver.type}))}</p>`:''}${button('receiver',busy||identifyPending.size?tx('Even wachten…'):label,`data-id="${escape(receiver.id)}" ${busy||identifyPending.size||draft.zoneChoiceRequired||!(receiver.canConfigure||receiver.canVerifyIdentity)?'disabled':''}`)}`;
    }
    function receiverIdentity(receiver){
      const description=receiver.type==='SPI'?tx('Kleur en animaties per pixel'):tx('Eén kleur over de hele ledline');
      return `<header class="onboarding-receiver-identity"><span class="onboarding-receiver-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="4"/><path d="M7 10v4M11 10v4M15 10v4M19 10v4"/></svg></span><span class="onboarding-receiver-title"><h2>${escape(receiver.name||`${receiver.type}-receiver`)}</h2><small>${description}</small></span><span class="pill">${receiver.type}</span></header>`;
    }
    function foundReceiverCard(receiver){
      const isIdentifying=identifying.has(receiver.id),available=canIdentify(receiver);
      const entranceKey=`found:${draft.transactionId}:${receiver.id}`,entering=!presentedStages.has(entranceKey);presentedStages.add(entranceKey);
      const blinkIcon='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>';
      return `<article class="card onboarding-result${entering?' onboarding-result-enter':''}" data-onboarding-result="${escape(receiver.id)}" data-discovery-status="found"><div class="onboarding-found-status"><b><i aria-hidden="true"></i>${escape(tx("Receiver gevonden"))}</b><span>${draft.role==='main'?tx('Je eerste receiver'):tx('Nog niet toegevoegd')}</span></div>${receiverIdentity(receiver)}${product(receiver,{compact:true})}<div class="onboarding-actions">${receiverAction(receiver)}</div><div class="onboarding-recognition"><span>${isIdentifying?tx('Dit licht knippert nu.'):tx('Herken jouw verlichting')}</span>${button('identify',`${blinkIcon}<span>${isIdentifying?tx('Stop knipperen'):tx('Laat knipperen')}</span>`,`data-id="${escape(receiver.id)}" class="receiver-blink" aria-pressed="${isIdentifying}" ${busy||identifyPending.has(receiver.id)||!available?'disabled':''}`)}</div>${!available?`<small class="onboarding-identify-unavailable">${draft.role==='main'?tx('Deze receiver kan pas knipperen nadat hij is toegevoegd.'):tx('Deze receiver kan nu niet knipperen. Controleer je verbinding en probeer opnieuw.')}</small>`:''}</article>`;
    }
    function connectingReceiver(){
      return draft.receiver?`<div class="onboarding-connecting-receiver">${product(draft.receiver,{compact:true})}${receiverIdentity(draft.receiver)}</div>`:'';
    }
    function receiverSearchView(){
      const found=results.length>0;
      const searching=searchState==='searching';
      const zone=draft.zones.find(item=>item.id===draft.activeZoneId);
      const canFilter=results.length>4&&new Set(results.map(receiver=>receiver.type)).size>1;
      // This only orders the presentation. A receiver's verified identity and
      // the existing compatible-zone/security gates remain authoritative.
      const shown=results.filter(receiver=>!canFilter||receiverFilter==='all'||receiver.type===receiverFilter)
        .sort((a,b)=>Number(!!zone?.type&&b.type===zone.type)-Number(!!zone?.type&&a.type===zone.type));
      const filters=canFilter?`<div class="onboarding-result-filter" role="group" aria-label="${escape(tx("Receivertype tonen"))}">${['all','RGBW','SPI'].map(type=>button('receiver-filter',type==='all'?tx('Alle types'):type,`data-filter="${type}" class="button secondary" aria-pressed="${receiverFilter===type}" ${busy||identifyPending.size||identifying.size?'disabled':''}`)).join('')}</div>`:'';
      const resultHeading=results.length>1?`<div class="onboarding-results-heading"><h2>${shown.length} ${tx(shown.length===1?'receiver':'receivers')} ${tx('gevonden')}</h2>${filters}<p>${shown.some(canIdentify)?tx('Laat de verlichting knipperen om je receiver te herkennen.'):tx('Kies de receiver die je wilt toevoegen.')}</p></div>`:'';
      let content='';
      if(searching)content=`<div class="card onboarding-searching" role="status"><span></span>${manualWifi()?tx('Je receiver controleren…'):tx('Zoeken naar receivers…')}</div>`;
      else if(searchState==='unavailable')content=`<section class="card onboarding-search-empty"><h2>${escape(tx("Zoeken nog niet beschikbaar"))}</h2><p>${unavailable}</p></section>`;
      else if(searchState==='ready'&&!found)content=`<section class="card onboarding-search-empty"><h2>${escape(tx("Nog niets gevonden"))}</h2><p>${manualWifi()?tx('Controleer of je toestel met jouw ALUVISION-netwerk verbonden is.'):tx('Controleer of de receiver aan staat en dicht bij je installatie staat.')}</p></section>`;
      else if(!found&&searchState==='idle'&&!manualWifi())content=`<p class="onboarding-search-help">${escape(tx("Zet de ledline aan die je wilt toevoegen."))}</p>`;
      if(found)content+=`${resultHeading}<div class="onboarding-results" aria-label="${escape(tx("Gevonden receivers"))}">${shown.map(receiver=>foundReceiverCard(receiver)).join('')}</div><div class="onboarding-search-again">${button('search',manualWifi()?tx('Verbinding opnieuw controleren'):tx('Opnieuw zoeken'),'class="button secondary" '+(busy||identifyPending.size?'disabled':''))}</div>`;
      return `${searchContext()}${found?'':manualWifiGuide()}${content}<div class="onboarding-actions onboarding-footer">${button('back',tx('← Zones beheren'),`class="button secondary" ${busy?'disabled':''}`)}${found?'':button('search',searchLabel(),searching||busy||identifyPending.size?'disabled':'')}</div>`;
    }
    function lightExample(type){
      // Independent teaching motion. Physical identification stays exclusively
      // on the product canvas and requires the existing confirmed identify path.
      return `<figure class="onboarding-light-example" data-setup-visual="${type==='SPI'?'pixels':'whole-line'}" aria-label="${type==='SPI'?tx('Voorbeeld: licht beweegt per pixel. Geen live weergave.'):tx('Voorbeeld: de RGBW-ledline verandert als geheel van kleur. Geen live weergave.')}"><div aria-hidden="true">${type==='SPI'?Array.from({length:20},(_,i)=>`<i style="--pixel:${i}"></i>`).join(''):'<i></i>'}</div><figcaption>${tx('Voorbeeld')} · ${type==='SPI'?tx('licht per pixel'):tx('één RGBW-ledline')}</figcaption></figure>`;
    }
    function zoneContext(){
      const zone=draft.zones.find(zone=>zone.id===(draft.zoneId||draft.activeZoneId));
      return zone?`<div class="onboarding-zone-context">${zoneVisual(draft.zones.indexOf(zone))}<span><small>${draft.receiver&&zone.type&&zone.type!==draft.receiver.type?tx('Kies straks een passende zone'):tx('Toevoegen aan')}</small><b>${escape(zone.name)}</b></span></div>`:'';
    }
    function receiverDestinationMarkup(open=false){
      const destination=draft.zones.find(zone=>zone.id===draft.activeZoneId);
      const destinationName=destination?.name||t('setupZoneNoZone','Nog geen zone');
      const hint=t('setupZoneDestination','Zone voor deze receiver');
      const chosenZone=receiverZoneSelection===undefined?draft.activeZoneId:receiverZoneSelection;
      const found=draft.receiver||(results.length===1?results[0]:null);
      const explanation=found?`<b>${escape(found.name||`${found.type}-receiver`)}</b> · ${escape(found.type)} · ${tx('Kies een zone.')}`:results.length>1?tx('Kies een zone voor deze ledline.'):tx('Kies een zone. Je kunt dit later wijzigen.');
      const zones=draft.zones.map(zone=>{
        const selected=chosenZone===zone.id,members=zoneMembers(zone.id),compatible=!found||!zone.type||zone.type===found.type;
        const detail=!compatible?`${zone.type} · ${tx('ander type verlichting')}`:selected?tx('Gekozen'):`${zone.type||tx('Lege zone')}${members.length?` · ${members.length} ${members.length===1?tx('ledline'):tx('ledlines')}`:''}`;
        return `<button type="button" class="assignment-choice onboarding-zone onboarding-destination-choice" data-onboarding-action="active-zone" data-id="${escape(zone.id)}" aria-pressed="${selected}" ${compatible?'':'disabled'}><svg class="icon onboarding-destination-choice-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg><span><b>${escape(zone.name)}</b><small>${escape(detail)}</small></span><i aria-hidden="true">${selected?'✓':''}</i></button>`;
      }).join('');
      const noZoneSelected=chosenZone===null&&!draft.zoneChoiceRequired;
      const noZone=`<button type="button" class="assignment-choice onboarding-zone onboarding-destination-choice" data-onboarding-action="active-zone" data-without-zone aria-pressed="${noZoneSelected}"><svg class="icon icon-unassigned onboarding-destination-choice-icon" data-icon="unassigned" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-4.35 7-12a7 7 0 1 0-14 0c0 7.65 7 12 7 12ZM9 10h6"/></svg><span><b>${escape(tx("Nog geen zone"))}</b><small>${noZoneSelected?tx('Gekozen'):tx('Blijft bij je stand')}</small></span><i aria-hidden="true">${noZoneSelected?'✓':''}</i></button>`;
      const zoneEditor=zoneNameOpen?`<section class="onboarding-destination-create">${nameField('onboarding-zone-name',tx('Zonenaam'),tx('Bijvoorbeeld: Demohoek'),zoneNameInput)}${button('zone-create',tx('Zone maken'),'disabled')}</section>`:`<div class="assignment-choices onboarding-zone-list onboarding-destination-choices" aria-label="${escape(tx("Zone kiezen"))}">${zones}${noZone}</div>`;
      const zoneChanged=receiverZoneSelection!==undefined&&(receiverZoneSelection!==draft.activeZoneId||draft.zoneChoiceRequired===true);
      const confirm=zoneNameOpen?'':button('zone-picker-confirm',draft.activeZoneId?tx('Deze zone gebruiken'):tx('Deze zone kiezen'),`class="button full" ${zoneChanged?'':'disabled'}`);
      return `<details class="onboarding-destination" data-receiver-destination ${open?'open':''}><summary data-onboarding-action="zone-picker-open" aria-haspopup="dialog" aria-expanded="${open}" aria-controls="onboarding-zone-change"><span class="onboarding-destination-ledline" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 9h18v6H3zM6 11v2M10 11v2M14 11v2M18 11v2M1 12h2M21 12h2"/></svg></span><span class="onboarding-destination-name"><small>${escape(hint)}</small><b>${escape(destinationName)}</b></span><em>${escape(t(destination?'setupZoneChange':'setupZoneChoose',destination?tx('Zone wijzigen'):tx('Zone kiezen')))}<span aria-hidden="true">⌄</span></em></summary><dialog class="onboarding-zone-dialog" id="onboarding-zone-change" data-onboarding-zone-dialog aria-labelledby="onboarding-zone-change-title"><header class="onboarding-destination-title"><h2 id="onboarding-zone-change-title">${zoneNameOpen?tx('Nieuwe zone maken'):destination?tx('Zone wijzigen'):tx('Kies een zone')}</h2><button type="button" class="icon-button" data-onboarding-action="zone-picker-close" aria-label="${escape(tx("Venster sluiten"))}">×</button></header><p class="onboarding-destination-info">${explanation}</p>${zoneEditor}${zoneNameOpen?'':button('zone-add-from-receiver',tx('＋ Nieuwe zone maken'),'class="button secondary full"')}${confirm}</dialog></details>`;
    }
    function product(receiver,{compact=false,port=null}={}){
      return `<div class="onboarding-product ${compact?'compact':''}"><canvas data-onboarding-visual="${escape(receiver.id)}" data-type="${receiver.type}" data-port="${port||''}" data-compact="${compact}" role="img" aria-label="${receiver.type}-${tx('Receiver')}${port?` · ${tx('uitgang {port}',{port})}`:''}" width="400" height="210"></canvas></div>`;
    }
    function pinNetwork(){
      return `<figure class="onboarding-pin-network" data-setup-visual="pin-network" aria-label="${escape(tx("Schema: je telefoon, de receiver voor je installatie en andere receivers die je later kunt toevoegen. Geen live netwerkstatus."))}"><div class="onboarding-pin-network-route"><div class="onboarding-pin-phone">${setupIcon('phone')}<b>${escape(tx("Je telefoon"))}</b></div><span class="onboarding-pin-link" aria-hidden="true">→</span><div class="onboarding-pin-main">${product(draft.receiver,{compact:true})}<b>${escape(tx("Receiver"))}</b><span>${escape(draft.receiver.type)} · ${tx('verbonden met je installatie')}</span></div><span class="onboarding-pin-link future" aria-hidden="true">⇢</span><div class="onboarding-pin-future"><i aria-hidden="true">＋</i><b>${escape(tx("Andere receivers"))}</b><span>${escape(tx("Later toevoegen"))}</span></div></div><figcaption>${escape(tx("Zo bouw je je installatie op · schema"))}</figcaption></figure>`;
    }
    function pinForm(){
      return `${pinNetwork()}<p class="onboarding-task-hint">${escape(tx("Eén PIN voor je hele installatie."))}</p><section class="card onboarding-pin-card"><label class="onboarding-field">${escape(tx("PIN · 8–12 cijfers"))}<input id="onboarding-pin" data-onboarding-pin="first" type="password" inputmode="numeric" autocomplete="new-password" minlength="8" maxlength="12" aria-describedby="onboarding-pin-help" spellcheck="false"></label><label class="onboarding-field">${escape(tx("Herhaal dezelfde PIN"))}<input id="onboarding-pin-repeat" data-onboarding-pin="repeat" type="password" inputmode="numeric" autocomplete="new-password" minlength="8" maxlength="12" aria-describedby="onboarding-pin-error onboarding-pin-match" spellcheck="false"></label><p id="onboarding-pin-error" class="onboarding-error" role="alert" hidden></p><p id="onboarding-pin-match" class="onboarding-pin-match" role="status" hidden>${escape(tx("✓ Beide PINs komen overeen"))}</p><p id="onboarding-pin-help" class="onboarding-hint">${escape(tx("Bewaar je PIN: je wifi-wachtwoord en toegang op een ander toestel."))}</p><p class="onboarding-pin-rejoin-note">${escape(tx("Daarna kies je het receiver-wifi opnieuw in Instellingen, met deze PIN."))}</p></section><details class="onboarding-recovery"><summary>${escape(tx("App gewist of PIN vergeten?"))}</summary><p>${escape(tx("Bewaar je PIN ook buiten de app. Voor toegang na herinstallatie of op een ander toestel gebruik je dezelfde PIN zodra de hersteloptie beschikbaar is. PIN vergeten? Dan is een ondersteunde fabrieksreset op de receiver nodig."))}</p></details>${footerPin()}`;
    }
    function reviewCard(){
      return `<section class="card onboarding-review onboarding-review-product">${product(draft.receiver,{compact:true,port:null})}<dl><div><dt>${escape(tx("Receiver"))}</dt><dd>${escape(draft.receiver.name||draft.receiver.type)}</dd></div><div><dt>${escape(tx("Zone"))}</dt><dd>${escape(draft.zones.find(zone=>zone.id===draft.zoneId)?.name||tx('Later kiezen'))}</dd></div></dl>${draft.receiver.type==='SPI'?`<ul>${active().map(output=>`<li><b>P${output.port}</b><span>${output.pixels} pixels<small>${pixelSetup.endpointLabel(output)}</small></span></li>`).join('')}</ul>`:lightExample('RGBW')}</section><div class="onboarding-actions onboarding-footer">${pinRequired()?button('back',tx('← Zone kiezen'),busy||finalizationStarted?'disabled':''):''}${button('finish',busy?tx('Toevoegen…'):!pinRequired()&&finalizationStarted?tx('Opnieuw proberen'):tx('Receiver toevoegen'),busy?'disabled':'')}</div>`;
    }
    function addingPanel(){
      return connectionCard({title:'Receiver toevoegen…',hint:'Je instellingen worden bewaard.',progress:false});
    }
    function completeCard(){
      const zone=draft.zones.find(zone=>zone.id===draft.zoneId),count=getModel().receivers.filter(receiver=>receiver.standId===draft.stand.id&&receiver.zoneId===draft.zoneId&&receiver.lifecycle==='added').length;
      return `<section class="card onboarding-done">${product(draft.receiver,{compact:true})}<span class="onboarding-success-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="m8 16 5 5 11-11"/></svg></span><h2>${escape(tx("Receiver toegevoegd"))}</h2><p>${escape(zone?.name||tx('Niet in een zone'))} · ${count} ${tx(count===1?'receiver':'receivers')}</p></section><section class="onboarding-followup">${button('another',`＋ ${escape(t('setupAnotherReceiver','Nog een receiver toevoegen'))}`,'class="button full"')}${button('done',origin==='layout'?tx('Terug naar ledlines'):escape(t('setupMyStand','Naar mijn stand')),'class="button secondary full"')}${button('another-zone',zone?tx('Receiver in een andere zone'):tx('Receiver met een nieuwe zone'),'class="text-button"')}</section>`;
    }
    function errorBox(){return `<p class="onboarding-error" role="alert" ${error?'':'hidden'}>${escape(tx(error))}</p><p class="onboarding-notice" role="status" ${notice||draftSaving?'':'hidden'}>${draftSaving?tx('Je keuzes bewaren…'):escape(tx(notice))}</p>${pendingChoices&&saveFailed?button('save-retry',draftSaving?'Bewaren…':'Opnieuw bewaren',draftSaving?'disabled':''):''}`;}
    function footer(next='Volgende',disabled=false){return `<div class="onboarding-actions onboarding-footer">${button('back','← Terug',`class="button secondary" ${draft.stage==='zones'&&!draft.stand.isNew?'disabled':''}`)}${button('next',next,disabled?'disabled':'')}</div>`;}
    function nameField(id,label,placeholder,value=''){return `<label class="onboarding-field">${escape(tx(label))}<input id="${id}" ${id==='onboarding-zone-name'?'data-zone-name':''} maxlength="64" autocomplete="off" value="${escape(value)}" placeholder="${escape(tx(placeholder))}"></label>`;}
    function manualWifiGuide(){
      const preview=services.factoryGuidePreview===true&&!draft.mainReceiverId;
      if(results.length||!manualWifi()&&!preview)return '';
      const instructions=`${preview?`<p class="onboarding-demo-wifi-note">${escape(tx("Voorbeeld · blijf voor deze demo op je huidige wifi."))}</p>`:''}${window.LightningSetupWifiGuide.stepsMarkup()}${!results.length?window.LightningSetupWifiGuide.markup():''}`;
      return `<section class="card onboarding-manual-wifi" aria-label="${escape(tx("Wifi met de hand verbinden"))}">${instructions}</section>`;
    }
    function securityPanel(){
      if(!pinRequired())return `${connectionCard({title:busy?(phaseLabels[draft.security.phase]||tx('Receiver verbinden')):tx('Verbinding controleren'),hint:busy?tx('Laat de receiver aan.'):tx('Verbinding nog niet bevestigd.')})}${busy?'':button('security-retry',tx('Opnieuw controleren'))}`;
      if(automaticMain())return mainWifiReturn();
      if(manualRejoinSSID&&!registrationPending)return `<section class="card onboarding-manual-wifi" aria-label="${escape(tx("Met beveiligde wifi verbinden"))}"><h2>${busy?tx('Verbinding controleren…'):tx('Verbind met je wifi')}</h2><ol class="onboarding-wifi-tiles" data-setup-visual="wifi-rejoin"><li>${setupIcon('wifi')}<span><b>${escape(tx("Instellingen → Wifi"))}</b><small>${escape(tx('Kies {network}',{network:manualRejoinSSID}))}</small></span></li><li>${setupIcon('phone')}<span><b>${escape(tx("Standcode invoeren"))}</b><small>${escape(tx("Dit is je wifiwachtwoord."))}</small></span></li><li>${setupIcon('return')}<span><b>${escape(tx("Terug naar de app"))}</b><small>${escape(tx("We controleren automatisch."))}</small></span></li></ol></section>${button('security-retry',busy?tx('Verbinding controleren…'):tx('Ik ben verbonden · controleren'),busy?'disabled':'')}`;
      if(registrationPending)return `<section class="card onboarding-security onboarding-connecting" role="status">${connectingReceiver()}<h2>${escape(tx("Je receiver rondt af"))}</h2><p>${escape(tx("Toegang wordt bewaard."))}</p></section>${button('security-retry',busy?tx('Afronden…'):tx('Verder controleren'),busy?'disabled':'')}`;
      const phase=draft.security.phase;
      return `${connectionCard({title:phaseLabels[phase]||tx('Verbinding bevestigen'),hint:busy?tx('Laat de receiver aan.'):tx('Nog niet bevestigd.')})}${busy?'':button('security-retry',tx('Opnieuw controleren'))}<details class="onboarding-recovery"><summary>${escape(tx("Meer uitleg"))}</summary><p>${escape(tx("De receiver verschijnt na bevestiging in je stand."))}</p></details>`;
    }
    function connectionCard({title,hint,progress=true}){
      const receiver=draft.receiver,zone=draft.zones.find(item=>item.id===(draft.zoneId||draft.activeZoneId));
      const destination=zone?escape(zone.name):tx('Nog geen zone');
      // Presentation only: phase changes, trusted receipts and retry actions
      // still use the existing transaction. No timer invents a success state.
      return `<section class="card onboarding-security onboarding-connecting onboarding-connect-card" data-security-busy="${busy}" data-connect-type="${receiver?.type||''}" role="status" aria-live="polite" aria-atomic="true"><header class="onboarding-connect-destination"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg><span><small>${zone?tx('Toevoegen aan'):tx('Zone')}</small><b>${destination}</b></span></header>${receiver?`<div class="onboarding-connect-device">${product(receiver,{compact:true})}<div class="onboarding-connect-identity"><span class="pill">${escape(receiver.type)}</span><h3>${escape(receiver.name||`${receiver.type}-receiver`)}</h3><p>${receiver.type==='SPI'?tx('Licht en beweging per pixel.'):tx('Eén kleur over de hele ledline.')}</p></div></div>`:''}<span class="onboarding-security-icon onboarding-connect-signal" aria-hidden="true">${setupIcon('wifi')}</span><h2>${escape(tx(title))}</h2><p class="onboarding-connect-hint">${escape(tx(hint))}</p>${progress?connectionProgress():''}</section>`;
    }
    function connectionProgress(){
      const step={configuring:0,claiming:1,reconnecting:2,verifying:2,resuming:2}[draft.security.phase];
      return `<ol class="onboarding-security-stages" data-setup-visual="security" aria-label="${escape(tx("Verbindingsstappen"))}">${[tx('Instellingen'),tx('Koppelen'),tx('Controleren')].map((label,i)=>`<li data-state="${i<step?'completed':busy&&i===step?'current':'pending'}" ${busy&&i===step?'aria-current="step"':''}><i aria-hidden="true">${i<step?'✓':i+1}</i><b>${label}</b></li>`).join('')}</ol>`;
    }
    function mainWifiReturn(){
      const progressing=busy||rejoinRunning;
      const retry=(rejoinExhausted||rejoinBlocked||!!error)&&!progressing;
      const network=manualRejoinSSID||tx('jouw ALUVISION-{type}-netwerk',{type:draft.receiver.type});
      const instructions=`<ol class="onboarding-wifi-tiles onboarding-wifi-return-steps" data-setup-visual="wifi-rejoin"><li><i aria-hidden="true">1</i><span><b>${escape(tx("Instellingen → Wifi"))}</b><small>${escape(tx('Kies {network}',{network}))}</small></span></li><li><i aria-hidden="true">2</i><span><b>${escape(tx("Standcode invoeren"))}</b><small>${escape(tx("Dit is je wifiwachtwoord."))}</small></span></li><li><i aria-hidden="true">3</i><span><b>${escape(tx("Terug naar de app"))}</b><small>${escape(tx("De receiver wordt toegevoegd."))}</small></span></li></ol>`;
      return `<section class="card onboarding-manual-wifi onboarding-wifi-return" aria-label="${escape(tx("Met beveiligde wifi verbinden"))}">${connectingReceiver()}<div class="onboarding-wifi-return-symbol" aria-hidden="true">${setupIcon('wifi')}</div><h2>${automaticFinalizing?tx('Even afronden…'):registrationPending?tx('Je receiver rondt af'):progressing?tx('Verbinden…'):tx('Verbind opnieuw met wifi')}</h2>${progressing?`<p class="onboarding-auto-progress" role="status"><span aria-hidden="true"></span>${automaticFinalizing?tx('Receiver toevoegen…'):registrationPending?tx('Toegang opslaan…'):tx('Receiver zoeken…')}</p>`:instructions}<p class="onboarding-auto-note">${progressing?tx('Blijf in de app.'):tx('Daarna gaat het automatisch verder.')}</p></section>${retry?`<div class="onboarding-auto-retry">${button('security-retry',tx('Opnieuw proberen'),'class="button secondary"')}</div>`:''}`;
    }
    function searchLabel(){
      if(manualWifi())return searchState==='searching'?tx('Controleren…'):tx('Verbinding controleren');
      return searchState==='searching'?tx('Zoeken…'):searchState==='idle'?tx('Receivers zoeken'):tx('Opnieuw zoeken');
    }
    function withoutZoneChoice(action='active-zone'){
      const selected=!draft.zoneChoiceRequired&&(action==='active-zone'?draft.activeZoneId===null:draft.zoneId===null&&draft.activeZoneId===null);
      return `<button type="button" class="onboarding-zone" data-onboarding-action="${action}" data-without-zone aria-pressed="${selected}"><span class="onboarding-zone-number onboarding-zone-unassigned-icon" aria-hidden="true"><svg class="icon icon-unassigned" data-icon="unassigned" viewBox="0 0 24 24"><path d="M12 22s7-4.35 7-12a7 7 0 1 0-14 0c0 7.65 7 12 7 12ZM9 10h6"/></svg></span><span><b>${escape(tx("Zonder zone"))}</b><small>${escape(tx("Later aan een zone toewijzen"))}</small></span><i aria-hidden="true">${selected?'✓':'→'}</i></button>`;
    }
    function zoneChoices(){return withoutZoneChoice('zone')+draft.zones.map(zone=>{
      const compatible=!zone.type||zone.type===draft.receiver.type;
      return `<button type="button" class="onboarding-zone" data-onboarding-action="zone" data-id="${escape(zone.id)}" aria-pressed="${draft.zoneId===zone.id}" ${compatible?'':'disabled'}><span><b>${escape(zone.name)}</b><small>${compatible?(zone.type||tx('Lege zone')):`${zone.type} · ${tx('ander type verlichting')}`}</small></span><i>${draft.zoneId===zone.id?'✓':'→'}</i></button>`;
    }).join('');}
    function body(){
      switch(draft.stage){
        case 'stand':return `<p class="onboarding-task-hint">${escape(t('setupNameHint','Geef je stand een herkenbare naam. Daarna maak je zones en voeg je verlichting toe.'))}</p><section class="card onboarding-name-card">${nameField('onboarding-stand-name',t('setupStandName','Standnaam'),t('setupStandExample','Bijvoorbeeld: Aluvision beursstand'),standNameInput??draft.stand?.name??'')}</section><div class="onboarding-actions onboarding-footer">${button('exit','← '+escape(t('back','Terug')),'class="button secondary"')}${button('stand-save',escape(t('setupContinueZones','Verder · zones maken')),'disabled')}</div>${allowPinLogin&&!getModel().stands.length?`<button type="button" class="button secondary full" data-action="pin-login">${escape(tx("Al een stand? Open met PIN"))}</button>`:''}`;
        case 'zones':{
          if(zoneRemoval)return zoneRemovalPanel();
          if(zoneRename)return zoneRenamePanel();
          if(receiverMove)return movePanel();
          return `<p class="onboarding-task-hint">${escape(t('setupZonesHint','Maak zones voor de plekken in je stand. Daarna voeg je receivers toe.'))}</p>${setupZones({editable:true})}${zoneNameFields()}${receiverPlacement()}<div class="onboarding-actions onboarding-footer onboarding-zones-continue">${button('next',escape(t('addReceiver','Receiver toevoegen')),'disabled')}${!draft.zones.length?button('zones-later',escape(t('setupZonesLater','Zones later toevoegen')),'class="button secondary"'):''}<div class="onboarding-zones-footer-row">${button('back',tx('← Terug'),`class="button secondary" ${!draft.stand.isNew?'disabled':''}`)}</div></div>`;
        }
        case 'receiver':return receiverSearchView();
        case 'placement':return `<p class="onboarding-task-hint">${draft.zoneChoiceRequired?tx('Je gekozen zone is niet meer beschikbaar.'):escape(tx('{type} past niet in de gekozen zone.',{type:draft.receiver.type}))} ${tx('Kies een andere zone of voeg hem zonder zone toe.')}</p><div class="onboarding-zone-list">${zoneChoices()}</div>${zoneNameOpen?`<section class="card">${nameField('onboarding-zone-name',tx('Naam van de nieuwe zone'),tx('Bijvoorbeeld: Lichttunnel'),zoneNameInput)}${button('zone-create',tx('Verder'),'disabled')}</section>`:button('zone-new',tx('＋ Nieuwe zone'),'class="button secondary"')}${button('back',tx('← Terug'),'class="button secondary"')}`;
        case 'outputs':return `${pixelSetup.renderOutputs(draft.outputs,{onboarding:true,live:services.previewCapabilities?.identifyPorts===true&&typeof services.previewPixels==='function'})}${active().length?`<p class="onboarding-hint">${escape(t('setupExtraOutputsLater','Extra uitgangen inschakelen kan later.'))}</p>`:''}${footer(tx('Volgende'),active().length===0)}`;
        case 'pixels':{
          const output=draft.outputs.find(output=>output.port===draft.port);
          return `${pixelSetup.renderPortContext(draft.outputs,draft.port)}${pixelSetup.renderPixels(output,{inputId:'onboarding-pixels',onboarding:true,pixelsPerMeter:pixelLimits.pixelsPerMeter})}${footer(pixelSetup.nextPortLabel(draft.outputs,draft.port))}`;
        }
        case 'connection':{
          const output=draft.outputs.find(output=>output.port===draft.port);
          return `${pixelSetup.renderPortContext(draft.outputs,draft.port,{stage:'connection'})}${pixelSetup.renderSide(output,{onboarding:true,live:services.previewCapabilities?.direction===true&&typeof services.previewPixels==='function'})}${footer(pixelSetup.nextPortLabel(draft.outputs,draft.port,{stage:'connection'}))}`;
        }
        case 'pin':return pinRequired()?pinForm():securityPanel();
        case 'security':return securityPanel();
        case 'zone':return `${!draft.zones.length&&!draft.zoneChoiceRequired?`<p class="onboarding-task-hint">${escape(tx("Je voegt deze receiver zonder zone toe."))}</p>${button('next',tx('Verder naar overzicht'))}`:`${draft.zoneChoiceRequired?`<p class="onboarding-task-hint">${escape(tx("Je gekozen zone is niet meer beschikbaar. Kies een nieuwe zone of voeg deze receiver zonder zone toe."))}</p>`:!pinRequired()?`<p class="onboarding-task-hint">${escape(tx("Kies een zone of deel deze receiver later in."))}</p>`:''}<div class="onboarding-zone-list">${zoneChoices()}</div>${zoneNameOpen?`<section class="card">${nameField('onboarding-zone-name',tx('Naam van de nieuwe zone'),tx('Bijvoorbeeld: Lichttunnel'),zoneNameInput)}${button('zone-create',tx('Zone maken'),'disabled')}</section>`:button('zone-new',tx('＋ Nieuwe zone'),'class="button secondary"')}${pinRequired()?button('next',tx('Verder naar overzicht'),placementReady()?'':'disabled'):''}`}<small class="onboarding-hint">${draft.zones.length?tx('RGBW en SPI apart. Verplaatsen kan later.'):tx('Zones maken en receivers indelen kan later.')}</small>`;
        case 'review':return automaticMain()&&automaticFinalizing?mainWifiReturn():!pinRequired()&&automaticFinalizing&&busy?addingPanel():reviewCard();
        case 'done':return completeCard();
        default:return '';
      }
    }
    function footerPin(){return `<div class="onboarding-actions onboarding-footer">${button('back',tx('← Terug'))}${button('secure',tx('Beveiligen en verbinden'),'disabled')}</div>`;}
    function paintPage(top=true,capture=true){
      if(!container)return;
      if(firstAccess){container.innerHTML=firstAccessPage();document.title=`${container.querySelector('h1').textContent} · Aluvision Lighting`;return;}
      if(capture)captureNames();
      const stageKey=[draft.transactionId,draft.stage,draft.receiver?.id||''].join(':'),entering=!presentedStages.has(stageKey);
      const focusedPort=container.contains(document.activeElement)&&document.activeElement.dataset.onboardingAction==='output'?document.activeElement.dataset.port:null;
      const focusedZone=container.contains(document.activeElement)&&document.activeElement.dataset.onboardingAction==='active-zone'?document.activeElement.dataset.id:null;
      const focusedSide=container.contains(document.activeElement)&&document.activeElement.dataset.onboardingAction==='side'?document.activeElement.dataset.side:null;
      // A local choice repaints this step, not its open help panels. Closing a
      // disclosure during that repaint also shrinks the page under the user's
      // finger and makes Safari/Chrome clamp the scroll position upwards.
      const disclosureKey=element=>element.className+'|'+element.querySelector(':scope > summary')?.textContent;
      const disclosures=!top?new Map(Array.from(container.querySelectorAll('details'),element=>[disclosureKey(element),element.open])):null;
      const zoneScroll=container.querySelector('.onboarding-destination .onboarding-zone-list')?.scrollTop||0;
      const zonePickerOpen=container.querySelector('.onboarding-destination')?.open===true||openZonePickerOnNextPaint;openZonePickerOnNextPaint=false;
      presentedStages.add(stageKey);
      container.innerHTML=`<div class="page onboarding-page${entering?' onboarding-stage-enter':''}" data-setup-origin="${origin}" data-onboarding-stage="${draft.stage}" aria-busy="${draftSaving||busy}">${heading()}${body()}${errorBox()}</div>`;
      document.title=`${container.querySelector('h1').textContent} · Aluvision Lighting`;
      if(draft.stage==='receiver'){
        const heading=container.querySelector('.onboarding-heading');
        const prompt=container.querySelector('.onboarding-search-help');
        if(prompt)heading.insertAdjacentElement('afterend',prompt);
        // Choose the destination after discovery has returned an identity.
        // Finding a receiver still grants neither configuration nor membership.
        if(!receiverMove&&results.length)heading.insertAdjacentHTML('afterend',receiverDestinationMarkup(zonePickerOpen));
        const destinationCard=container.querySelector('[data-receiver-destination]');
        // Failed checks belong next to the active task, not below a fixed
        // footer where they look like an unresponsive button.
        const connectionError=container.querySelector('.onboarding-error:not([hidden])');
        if(connectionError&&destinationCard)destinationCard.insertAdjacentElement('afterend',connectionError);
        if(receiverMove){
          for(const element of Array.from(container.querySelector('.onboarding-page').children))if(!element.matches('.onboarding-setup-header,.onboarding-setup-steps,.onboarding-heading'))element.remove();
          heading.insertAdjacentHTML('afterend',movePanel()+errorBox());
        }
      }
      if(draft.stage==='outputs'){
        container.querySelector('.onboarding-heading').insertAdjacentHTML('afterend',receiverDestinationMarkup(zonePickerOpen));
        // Keep the shared all-off warning with the disabled next action. On a
        // small screen a sticky footer must not cover the reason it is disabled.
        const allOff=container.querySelector('[data-pixel-all-off]'),footer=container.querySelector('.onboarding-footer');
        if(allOff&&footer)footer.prepend(allOff);
      }
      if((draft.stage==='receiver'&&results.length&&!receiverMove||draft.stage==='outputs')&&zonePickerOpen){
          const dialog=container.querySelector('[data-onboarding-zone-dialog]');
          if(dialog&&!dialog.open){
            dialog.addEventListener('cancel',event=>{
              event.preventDefault();const picker=dialog.closest('[data-receiver-destination]');if(picker)picker.open=false;
              receiverZoneSelection=undefined;openZonePickerOnNextPaint=false;zoneNameOpen=false;
              paintPage(false);container?.querySelector('[data-receiver-destination]>summary')?.focus({preventScroll:true});
            });
            dialog.showModal();
          }
      }
      // Read-only native discovery can show the real product without pretending
      // that an unauthenticated observation is ready for a PIN or membership.
      for(const receiver of results.filter(receiver=>receiver.canConfigure===false)){
        const card=container.querySelector(`[data-onboarding-result="${CSS.escape(receiver.id)}"]`);
        if(!card)continue;
        // Identity selection remains guarded, but a supported temporary blink
        // is explicitly allowed before configuration/claim. Do not override
        // the identify button's own pending/capability checks here.
        container.querySelectorAll(`[data-onboarding-action="receiver"][data-id="${CSS.escape(receiver.id)}"]`).forEach(button=>{button.disabled=!(receiver.canVerifyIdentity&&!busy&&!identifyPending.size);});
        const hint=document.createElement('p');hint.className='onboarding-hint';
        hint.textContent=tx(receiver.unavailableReason);card.insertBefore(hint,card.querySelector('.onboarding-recognition'));
      }
      for(const [id,action] of [['onboarding-stand-name','stand-save'],['onboarding-zone-name','zone-create']]){
        const field=container.querySelector('#'+id),control=container.querySelector(`[data-onboarding-action="${action}"]`);if(field&&control)control.disabled=action==='zone-create'?!validZoneNames():!validName(field.value);
      }
      const rename=container.querySelector('#onboarding-zone-rename');if(rename)container.querySelector('[data-onboarding-action="zone-rename-confirm"]').disabled=!validName(rename.value)||rename.value.trim()===draft.zones.find(zone=>zone.id===zoneRename.zoneId)?.name;
      if(draft.stage==='zones'&&container.querySelector('[data-onboarding-action="next"]'))container.querySelector('[data-onboarding-action="next"]').disabled=!canContinueZones();
      if(draft.stage==='pixels'){const input=container.querySelector('#onboarding-pixels');input.inputMode='numeric';container.querySelector('[data-onboarding-action="next"]').disabled=!pixelSetup.validateInput(container,input.value,pixelLimits)||!pixelSetup.configuredPixels(Number(input.value),pixelLimits);}
      if(draftSaving||pendingChoices)container.querySelectorAll('button,input').forEach(control=>{
        if(control.dataset.onboardingAction==='zone-picker-close')return;
        if(draftSaving||!['save-retry','exit'].includes(control.dataset.onboardingAction))control.disabled=true;
      });
      if(draftSaving||pendingChoices)container.querySelector('[data-onboarding-action="zone-picker-open"]')?.setAttribute('aria-disabled','true');
      if(managementBusy)container.querySelectorAll('button,input,summary').forEach(control=>{if(control.tagName==='SUMMARY')control.setAttribute('aria-disabled','true');else control.disabled=true;});
      if(disclosures)container.querySelectorAll('details').forEach(element=>{if(disclosures.has(disclosureKey(element)))element.open=disclosures.get(disclosureKey(element));});
      updateGuidance();
      if(!top){const list=container.querySelector('.onboarding-destination .onboarding-zone-list');if(list)list.scrollTop=zoneScroll;}
      if(top){window.scrollTo({top:0,left:0,behavior:'instant'});container.querySelector('h1').setAttribute('tabindex','-1');container.querySelector('h1').focus({preventScroll:true});}
      else if(focusedPort)container.querySelector(`[data-onboarding-action="output"][data-port="${focusedPort}"]`)?.focus({preventScroll:true});
      else if(focusedZone&&['receiver','outputs'].includes(draft.stage)&&!zonePickerOpen)container.querySelector('.onboarding-destination>summary')?.focus({preventScroll:true});
      else if(focusedZone)container.querySelector(`[data-onboarding-action="active-zone"][data-id="${CSS.escape(focusedZone)}"]`)?.focus({preventScroll:true});
      else if(focusedSide)container.querySelector(`[data-onboarding-action="side"][data-side="${CSS.escape(focusedSide)}"]`)?.focus({preventScroll:true});
      restoreZoneList();
      if(!busy&&['security','review'].includes(draft.stage)){
        container.querySelector('.onboarding-page').insertAdjacentHTML('beforeend',button('receivers-list','← Terug naar zoeken','class="button secondary full"'));
      }
      paint(performance.now()/1000);
      syncPixelPreview();
    }
    function validName(value){const name=String(value).trim();return name.length>0&&name.length<=64&&!/[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(name);}
    function updateGuidance(){
      if(!container)return;
      container.querySelectorAll('[data-setup-next]').forEach(control=>{control.classList.remove('onboarding-next-action');delete control.dataset.setupNext;});
      if(busy||draftSaving||pendingChoices||saveFailed||error||zoneRemoval||zoneRename||receiverMove)return;
      let action=null;
      switch(draft.stage){
        case 'stand':action='stand-save';break;
        case 'zones':action='next';break;
        case 'receiver':{
          const choices=container.querySelectorAll('[data-onboarding-action="receiver"]:not(:disabled)');
          if(choices.length===1)action='receiver';else if(!choices.length&&searchState!=='searching')action='search';break;
        }
        case 'pin':action='secure';break;
        case 'security':action='security-retry';break;
        case 'outputs':case 'pixels':case 'connection':action='next';break;
        case 'placement':case 'zone':action=zoneNameOpen?'zone-create':draft.zoneId?'next':'zone-new';break;
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
        if(control){const copy=control.querySelector('span');if(copy)copy.textContent=tx('Laat knipperen');control.setAttribute('aria-pressed','false');const label=control.closest('.onboarding-recognition')?.querySelector('span');if(label)label.textContent=tx('Herken jouw verlichting');}
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
        feedback.hidden=!repeat||validation.valid;feedback.textContent=validation.valid?'':tx(validation.message);
        container.querySelector('#onboarding-pin-match').hidden=!validation.valid;
        container.querySelector('#onboarding-pin-repeat').setAttribute('aria-invalid',String(!!repeat&&!validation.valid));
        container.querySelector('[data-onboarding-action="secure"]').disabled=!validation.valid;updateGuidance();return;
      }
      const action=element.id==='onboarding-stand-name'?'stand-save':element.id==='onboarding-zone-name'||element.hasAttribute('data-zone-extra')?'zone-create':null;
      if(action){captureNames();const control=container.querySelector(`[data-onboarding-action="${action}"]`);if(control)control.disabled=action==='zone-create'?!validZoneNames():!validName(element.value);}
      if(action==='zone-create'&&draft.stage==='zones')container.querySelector('[data-onboarding-action="next"]').disabled=!canContinueZones();
      if(element.id==='onboarding-zone-rename'){captureNames();container.querySelector('[data-onboarding-action="zone-rename-confirm"]').disabled=!validName(element.value)||element.value.trim()===draft.zones.find(zone=>zone.id===zoneRename.zoneId)?.name;}
      if(element.matches('[data-pixel-count],[data-pixel-range]')){
        updatePixelCount(element.value,element,{commit:event.type==='change'});
      }
      updateGuidance();
    }
    function updatePixelCount(value,source,{commit=false,haptic=true}={}){
      if(draft.stage!=='pixels'||busy)return;
      const valid=pixelSetup.validateInput(container,value,pixelLimits);container.querySelector('[data-onboarding-action="next"]').disabled=!valid||!pixelSetup.configuredPixels(Number(value),pixelLimits);
      const previous=draft.outputs.find(output=>output.port===draft.port).pixels;
      if(valid&&change({type:'SET_PIXELS',port:draft.port,pixels:Number(value)},{render:false})){pixelSetup.updatePixels(container,draft.outputs.find(output=>output.port===draft.port),{source,pixelsPerMeter:pixelLimits.pixelsPerMeter});if(haptic&&Number(value)!==previous)pixelSetup.hapticStep();}
      if(valid)syncPixelPreview({commit});
      updateGuidance();
    }
    function commitPixelKey(event){if(['Enter','ArrowUp','ArrowDown'].includes(event.key)&&event.target.matches('[data-pixel-count]'))updatePixelCount(event.target.value,event.target,{commit:event.key==='Enter'});}
    function keydown(event){if(event.key==='Enter'&&event.target.matches('input:not([data-onboarding-pin])')){const button=container.querySelector('[data-onboarding-action="stand-save"], [data-onboarding-action="zone-create"], [data-onboarding-action="zone-rename-confirm"]')||(draft.stage==='zones'?container.querySelector('[data-onboarding-action="next"]'):null);if(button&&!button.disabled){event.preventDefault();button.click();}}}
    async function search(){
      if(parkPending||parking){if(!(await parkForSearch()))return;}
      if(searchState==='searching'||busy||identifyPending.size)return;
      if(identifying.size){
        const stopToken=operation;busy=true;paintPage(false);
        try{for(const id of Array.from(identifying.keys()))await stopIdentify(id);}
        finally{busy=false;if(container)paintPage(false);}
        if(stopToken!==operation||!container||!searchable())return;
      }
      // No discovery or claim is started while the stand/zone choices are not
      // durably retained. Retrying a failed save remains a local operation.
      const beforeSave=operation;
      if(!(await saveChoices()))return;
      if(beforeSave!==operation||!container||!searchable())return;
      if(typeof services.search!=='function'){searchState='unavailable';results=[];error='';paintPage(false);return;}
      if(identifyPending.size)return;
      const token=++operation;searchOnMount=false;searchAbort=new AbortController();searchState='searching';results=[];error='';paintPage(false);
      try{
        const result=await bounded(services.search({standId:draft.stand.id,mainReceiverId:draft.mainReceiverId,signal:searchAbort.signal}),draft.role==='node'?35000:15000);
        if(token!==operation||searchAbort?.signal.aborted)return;
        const identities=new Set(),localIds=new Set(),fingerprints=new Set(),existing=getModel().receivers;
        results=(Array.isArray(result?.receivers)?result.receivers:[]).filter(receiver=>{
          const observation=receiver?.reachabilityOnly===true&&receiver.canConfigure===false&&receiver.deviceFingerprint===null;
          if(!receiver||!['SPI','RGBW'].includes(receiver.type)||typeof receiver.id!=='string'||!/^[\w-]{1,96}$/.test(receiver.id)||!/^[\da-f]{16}$/i.test(receiver.rid)||(!observation&&!/^[\da-f]{64}$/i.test(receiver.deviceFingerprint)))return false;
          const rid=receiver.rid.toUpperCase(),fingerprint=receiver.deviceFingerprint?.toUpperCase();if(identities.has(rid)||localIds.has(receiver.id)||(fingerprint&&fingerprints.has(fingerprint))||existing.some(item=>item.id===receiver.id||item.rid?.toUpperCase()===rid||(fingerprint&&item.deviceFingerprint?.toUpperCase()===fingerprint)))return false;identities.add(rid);localIds.add(receiver.id);if(fingerprint)fingerprints.add(fingerprint);return true;
        }).map(receiver=>({id:receiver.id,rid:receiver.rid.toUpperCase(),type:receiver.type,name:String(receiver.name||`${receiver.type}-receiver`).slice(0,64),deviceFingerprint:receiver.deviceFingerprint?.toUpperCase()||null,canConfigure:receiver.canConfigure!==false,canVerifyIdentity:receiver.canVerifyIdentity===true&&typeof services.select==='function',unavailableReason:receiver.canConfigure===false?(receiver.canVerifyIdentity===true&&typeof services.select==='function'?'Kies deze receiver om zijn verbinding veilig te controleren.':'Receiver gevonden. Beveiligd toevoegen is in deze appversie nog niet beschikbaar.'):''}));
        searchState='ready';
      }catch(failure){if(token!==operation)return;searchState='failed';results=[];error=connectionFailure(failure,{viaMain:draft.role==='node'}).message;}
      finally{if(token===operation){searchAbort=null;paintPage(false);}}
      // Even a sole verified receiver remains on the found page until the
      // customer confirms its zone and explicitly chooses to add it.
    }
    function identifyService(receiver,enabled,signal){
      if(draft?.role==='node'&&receiver.canVerifyIdentity===true&&typeof services.identifyCandidate==='function')return services.identifyCandidate({standId:draft.stand.id,mainReceiverId:draft.mainReceiverId,receiverId:receiver.id,rid:receiver.rid,action:enabled?'START':'STOP',signal});
      if(draft?.role==='main'&&receiver.canVerifyIdentity===true&&typeof services.identifyFactoryMain==='function')return services.identifyFactoryMain({standId:draft.stand.id,transactionId:draft.transactionId,receiverId:receiver.id,rid:receiver.rid,type:receiver.type,action:enabled?'START':'STOP',signal});
      return services.identify({receiver:clone(receiver),enabled,ttlMs:10000,signal});
    }
    async function stopIdentify(id,knownReceiver=null){
      const receiver=knownReceiver||results.find(receiver=>receiver.id===id)||draft?.receiver;
      identifying.delete(id);
      if(receiver&&canIdentify(receiver))try{const answer=await bounded(identifyService(receiver,false));if(answer?.confirmed!==true)throw Error('UNCONFIRMED');}catch(_){notice='Stoppen is nog niet bevestigd. Controleer de receiver; verder instellen blijft mogelijk.';}
    }
    async function identify(id){
      const receiver=results.find(receiver=>receiver.id===id);if(!receiver||identifyPending.has(id))return;
      if(!canIdentify(receiver)){notice='Knipperen is voor deze receiver nog niet beschikbaar.';paintPage(false);return;}
      const focusButton=container?.querySelector(`[data-onboarding-action="identify"][data-id="${CSS.escape(id)}"]`);
      const returnFocus=!!focusButton&&document.activeElement===focusButton;
      const controller=new AbortController();if(returnFocus)identifyFocusOwner=controller;
      identifyPending.set(id,controller);const stopping=identifying.has(id),identifyOperation=operation;paintPage(false);
      let focusMoved=false;
      const cancelFocusReturn=()=>{focusMoved=true;};
      const stopWatchingFocus=()=>{
        for(const event of ['focusin','pointerdown','keydown'])document.removeEventListener(event,cancelFocusReturn,true);
      };
      if(returnFocus){
        for(const event of ['focusin','pointerdown','keydown'])document.addEventListener(event,cancelFocusReturn,true);
        controller.signal.addEventListener('abort',stopWatchingFocus,{once:true});
      }
      try{
        if(stopping)await stopIdentify(id);
        else {
          const answer=await bounded(identifyService(receiver,true,controller.signal));if(answer?.confirmed!==true)throw Error('UNCONFIRMED');
          if(identifyOperation!==operation||!container||draft.stage!=='receiver'){
            if(!identifyPending.has(id)||identifyPending.get(id)===controller)await stopIdentify(id,receiver);
          }
          else identifying.set(id,performance.now()/1000+(Number.isInteger(answer.ttlMs)&&answer.ttlMs>0?answer.ttlMs/1000:10));
        }
      }catch(_){if(identifyOperation===operation)notice='Knipperen is niet bevestigd. Je kunt de receiver wel verder instellen.';}
      finally{
        const restoreFocus=returnFocus&&!focusMoved&&identifyFocusOwner===controller&&identifyOperation===operation&&container&&draft.stage==='receiver'&&document.activeElement===document.body;
        stopWatchingFocus();controller.signal.removeEventListener('abort',stopWatchingFocus);
        if(identifyFocusOwner===controller)identifyFocusOwner=null;
        if(identifyPending.get(id)===controller)identifyPending.delete(id);paintPage(false);
        if(restoreFocus)container?.querySelector(`[data-onboarding-action="identify"][data-id="${CSS.escape(id)}"]`)?.focus({preventScroll:true});
      }
    }
    async function secure(pin,repeat,{reconcile=false,automatic=false,resumeFinalization=false}={}){
      if(busy)return 'stop';
      registrationPending=false;
      if(!canSecure()){pin='';repeat='';error=unavailable;paintPage(false);return;}
      if(draft.stage==='pin'){
        const result=draftApi.providePin(draft,pin,repeat);if(result.error){error=result.error.message;paintPage(false);return;}draft=result.draft;
      }
      // Erase both visible PIN inputs before the first await. Only this call's
      // short-lived closure passes the credential to the trusted service.
      container?.querySelectorAll('[data-onboarding-pin]').forEach(element=>{element.value='';});
      repeat='';busy=true;error='';const token=++operation;const controller=new AbortController();actionAbort=controller;let finishSelectedZone=false;paintPage();
      const method=reconcile||securityUncertain?'reconcileSecurity':'secure';
      let attempted=false;
      try{
        await persist();if(token!==operation)throw Error('SUSPENDED');
        change({type:'SECURITY_PROGRESS',phase:method==='reconcileSecurity'?'resuming':'claiming'},{top:false});
        securityUncertain=true;
        let response;
        if(method==='reconcileSecurity'&&securityReceiptRef)response={receiptRef:securityReceiptRef};
        else {
          if(typeof services[method]!=='function')throw Error('UNAVAILABLE');
          attempted=true;const request=services[method]({configuration:config(),signal:controller.signal,...(pinRequired()&&method==='secure'&&draft.role==='main'?{pin}:{}),onProgress:phase=>{
            if(token===operation&&busy&&draft.stage==='security'&&Object.hasOwn(phaseLabels,phase))change({type:'SECURITY_PROGRESS',phase},{top:false});
          }});
          pin='';repeat='';response=await bounded(request,draft.role==='node'?125000:50000);
        }
        pin='';repeat='';
        // The first demo claim may have committed while its reply was lost.
        // Reconcile that same transaction read-only; never send secure twice.
        if(!pinRequired()&&response?.status==='demo-reconcile-required')response=await bounded(services.reconcileSecurity({configuration:config(),signal:controller.signal}),50000);
        // A radio change is expected after the first claim, not a failed PIN.
        // This is NOT a proof: keep the transaction uncertain and reconcile it
        // after the user selects protected wifi. Never submit the claim twice.
        if(token!==operation)throw Error('SUSPENDED');
        if(response?.status==='verification-required'){
          verifyAgain(draft);notice='Controleer dezelfde receiver opnieuw. Je stand en zonekeuzes blijven bewaard.';return;
        }
        if(response?.status==='pin-required'){
          if(!pinRequired())throw Object.assign(Error('PIN_DISABLED'),{code:'PIN_DISABLED'});
          if(method!=='reconcileSecurity'||draft.role!=='main')throw Error('INVALID_RESUME');
          draft=draftApi.snapshot({...clone(draft),stage:'pin',security:{status:'not-started',phase:'idle'}});
          securityUncertain=false;manualRejoinSSID=null;notice='De receiver is nog niet beveiligd. Vul je gekozen PIN opnieuw in om verder te gaan.';return;
        }
        if(response?.status==='manual-rejoin'){
          if(!pinRequired())throw Object.assign(Error('UNEXPECTED_REJOIN'),{code:'UNEXPECTED_REJOIN'});
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
        change({type:'SECURITY_PROGRESS',phase:'verifying'},{top:false});
        const confirmed=await bounded(committer.confirmSecurity(draft,response.receiptRef));
        if(confirmed.error){securityReceiptRef=null;throw Error('UNCONFIRMED');}
        if(token!==operation)throw Error('SUSPENDED');
        draft=confirmed.draft;securityReceiptRef=response.receiptRef;securityUncertain=false;manualRejoinSSID=null;
        // The customer already picked a destination while naming zones. The
        // trusted security receipt may choose it only when it is compatible;
        // the final receiver receipt still gates actual app membership.
        if((!pinRequired()||resumeFinalization)&&placementReady()){
          const reviewed=draftApi.transition(draft,{type:'NEXT'});
          if(reviewed.error)throw Error('ZONE_UNCONFIRMED');
          draft=reviewed.draft;finishSelectedZone=true;
        }
        return 'confirmed';
      }catch(failure){
        if(token!==operation)return 'stop';
        if(pinRequired()&&!attempted&&!securityUncertain&&draft.role==='main')draft=draftApi.snapshot({...clone(draft),stage:'pin',security:{status:'not-started',phase:'idle'}});
        if(automaticMain()&&transientRejoin(failure))return 'retry';
        error=typeof failure?.code==='string'?connectionFailure(failure,{viaMain:draft.role==='node'}).message:tx(pinRequired()?'We konden deze receiver nog niet toevoegen. Je PIN en keuzes blijven bewaard; er is niets opnieuw ingesteld.':'We konden deze receiver nog niet toevoegen. Je keuzes blijven bewaard; er is niets opnieuw ingesteld.');
        if(automaticMain())rejoinBlocked=true;
        return 'stop';
      }
      finally{
        pin='';repeat='';if(actionAbort===controller)actionAbort=null;if(token===operation)busy=false;
        if(token===operation){
          if(finishSelectedZone&&container)void finish({automatic:true});
          else {keepDraft();paintPage(!automatic);if((returningFromWifi&&!rejoinRunning)||(!automatic&&draft.security.status==='confirmed'))resumeAfterWifiReturn();}
        }
      }
    }
    function finishChosenZone(){
      if(!container||draft.stage!=='zone'||!placementReady())return;
      const reviewed=draftApi.transition(draft,{type:'NEXT'});
      if(reviewed.error){error=reviewed.error.message;paintPage(false);return;}
      draft=reviewed.draft;void finish({automatic:true});
    }
    async function finish({automatic=false}={}){
      if(busy)return 'stop';
      // An explicit retry may follow a background pause longer than the RAM
      // receipt TTL (or native cancellation). Reconcile the same durable
      // transaction once; never replay secure or extend an old receipt.
      const refreshProof=!automatic&&finalizationStarted&&draft.stage==='review'&&draft.security.status==='confirmed';
      busy=true;finalizationStarted=true;automaticFinalizing=automatic;error='';notice='';const token=++operation;const controller=new AbortController();actionAbort=controller;paintPage(false);
      let finishPhase='save';
      try{
        await persist();if(token!==operation)throw Error('SUSPENDED');
        finishPhase='receiver';
        if(refreshProof){
          const retryModel=getModel(),retryConfiguration=canonical(config());
          const securityDraft=draftApi.snapshot({...clone(draft),stage:'security',security:{status:'pending',phase:'resuming'}});
          securityReceiptRef=null;finalReceiptRef=null;
          if(!container||document.hidden||typeof services.reconcileSecurity!=='function')throw Error('SUSPENDED');
          const refreshed=await bounded(services.reconcileSecurity({configuration:draftApi.configuration(securityDraft),signal:controller.signal}),draft.role==='node'?125000:50000);
          if(token!==operation||!container||document.hidden||getModel()!==retryModel||canonical(config())!==retryConfiguration)throw Error('SUSPENDED');
          if(!refreshed?.receiptRef)throw Object.assign(Error('UNCONFIRMED'),{code:'MAIN_RECEIPT_INVALID'});
          const verified=await bounded(committer.confirmSecurity(securityDraft,refreshed.receiptRef));
          if(verified.error)throw Object.assign(Error('UNCONFIRMED'),{code:verified.error.code});
          if(token!==operation||!container||document.hidden||getModel()!==retryModel||canonical(config())!==retryConfiguration)throw Error('SUSPENDED');
          securityReceiptRef=refreshed.receiptRef;
        }
        let response;
        if(finalReceiptRef)response={receiptRef:finalReceiptRef};
        else {if(typeof services.finalize!=='function')throw Error('UNAVAILABLE');response=await bounded(services.finalize({configuration:config(),securityReceiptRef,signal:controller.signal}),50000);}
        if(!response?.receiptRef)throw Error('NO_RECEIPT');finalReceiptRef=response.receiptRef;
        if(token!==operation)throw Error('SUSPENDED');
        if(automatic&&document.hidden){notice='Toevoegen is onderbroken. Kom terug en tik op Opnieuw proberen.';return 'stop';}
        const currentModel=getModel();
        finishPhase='verify';
        const completed=await bounded(committer.finish(currentModel,draft,finalReceiptRef));
        if(completed.error){finalReceiptRef=null;throw Object.assign(Error('UNCONFIRMED'),{code:completed.error.code});}
        // Verification may await native storage/radio. Never overwrite edits
        // made elsewhere in the meantime, nor publish after this flow closed.
        // The private receipt can be reverified against the new model on retry.
        if(token!==operation||getModel()!==currentModel)throw Error('MODEL_CHANGED');
        if(automatic&&document.hidden){notice='Toevoegen is onderbroken. Kom terug en tik op Opnieuw proberen.';return 'stop';}
        let central,committedModel=completed.model;
        if(typeof services.publishModel==='function'){
          finishPhase='publish';
          const saved=await bounded(services.publishModel({model:completed.model,configuration:config(),receiptRef:finalReceiptRef}),95000);
          const nativeMain=!saved?.central&&nativeMainPublication(saved?.model,completed.model,completed.draft);
          if(!saved?.model||(saved.central?membershipKey(saved.model)!==membershipKey(completed.model):canonical(saved.model)!==canonical(completed.model)&&!nativeMain))throw Error('MODEL_UNCONFIRMED');
          if(token!==operation||getModel()!==currentModel)throw Error('MODEL_CHANGED');
          central=saved.central;
          if(central||nativeMain)committedModel=saved.model;
        }
        if(!central&&completed.draft.role==='main'&&firstStandAccessRequired()){
          const receiver=committedModel.receivers.find(item=>item.id===completed.draft.receiver.id);
          firstAccess={identity:{schema:1,stage:'wifi-pin',standId:completed.draft.stand.id,receiverId:receiver.id,rid:receiver.rid,fingerprint:receiver.deviceFingerprint,transactionId:completed.draft.transactionId},phase:'checking',ssid:''};
          draft=completed.draft;completeModel=committedModel;
          const prepared=await onFirstStandAccess({kind:'prepare',identity:clone(firstAccess.identity),model:committedModel});
          if(!prepared||!['pin','reconnect','checking'].includes(prepared.phase))throw Error('FIRST_ACCESS_UNCONFIRMED');
          firstAccess.phase=prepared.phase;firstAccess.ssid=prepared.ssid||'';
          return 'stand-access';
        }
        draft=completed.draft;completeModel=committedModel;await onComplete(completeModel,{zoneId:draft.zoneId,receiverId:draft.receiver.id,central});
        return 'done';
      }catch(failure){
        if(token!==operation)return 'stop';
        if(firstAccess){
          const problem=firstAccessFailure(failure);error=problem.message;firstAccessErrorCode=problem.code;
          return 'stand-access';
        }
        if(automatic&&pinRequired()&&transientRejoin(failure))return 'retry';
        const problem=finalizationFailure(failure,{viaMain:draft.role==='node',phase:finishPhase});
        // A stale proof may be refreshed on the next explicit retry; neither
        // this failure nor that retry starts another security claim.
        if(problem.refreshReceipt)finalReceiptRef=null;
        error=problem.message;
        if(automatic)rejoinBlocked=true;
        return 'stop';
      }
      finally{if(actionAbort===controller)actionAbort=null;if(token===operation){busy=false;paintPage();}}
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
    async function exitDuringPreviewStop(){
      const job=previewStopJob;
      if(!job||job.exitPending||container!==job.container||draft!==job.draft||operation!==job.token)return;
      job.exitPending=true;
      try{
        // Preserve the exact pending step before leaving. This is local draft
        // storage, not STOP success or receiver membership. Existing suspend
        // keeps cleanup/parking pending until the real preview queue settles.
        await persist();
        if(previewStopJob!==job||container!==job.container||draft!==job.draft||operation!==job.token)return;
        suspend();onExit();
      }catch(_){
        if(previewStopJob===job&&container===job.container&&operation===job.token){notice='Je keuzes zijn nog niet bewaard. Probeer teruggaan opnieuw; de receiver wordt niet gereset.';refreshNotice();}
      }finally{
        job.exitPending=false;
        if(previewStopJob===job&&job.stopSettled){previewStopJob=null;job.restore();busy=false;}
      }
    }
    async function click(event){
      const target=event.target.closest('[data-onboarding-action]');if(!target||target.disabled)return;
      if(firstAccess){
        const action=target.dataset.onboardingAction;if(busy)return;
        if(action==='first-access-copy-network'){
          const owner=container,retained=firstAccess,ssid=firstAccess.ssid,status=container.querySelector('[data-first-access-copy-status]');
          if(!ssid)return;
          try{if(typeof window.navigator?.clipboard?.writeText!=='function')throw Error();await window.navigator.clipboard.writeText(ssid);if(container===owner&&firstAccess===retained&&status)status.textContent=tx('Netwerknaam gekopieerd');}
          catch(_){if(container===owner&&firstAccess===retained&&status)status.textContent=tx('Selecteer de netwerknaam om te kopiëren.');}return;
        }
        if(action==='first-access-suggest'){
          const field=container.querySelector('[data-first-stand-code]'),repeat=container.querySelector('[data-first-stand-code-confirm]');
          if(field&&repeat){try{field.value=window.LightningStandConnection.suggestCode();repeat.value='';field.type='text';repeat.focus();}catch(_){error='Vul zelf een PIN van 8–12 cijfers in.';paintPage(false);}}return;
        }
        if(action==='first-access-code'){
          const field=container.querySelector('[data-first-stand-code]'),repeat=container.querySelector('[data-first-stand-code-confirm]');
          if(!field||!repeat)return;const code=field.value;
          try{window.LightningStandConnection.newCode(code);if(code!==repeat.value)throw Error('MISMATCH');}
          catch(_){error='Vul twee keer dezelfde PIN van 8–12 cijfers in.';const alert=container.querySelector('[data-first-access-error]');if(alert)alert.textContent=tx(error);return;}
          field.value='';repeat.value='';return runFirstAccess('set-code',code);
        }
        if(action==='first-access-reconnect')return runFirstAccess('reconnect');
        if(action==='first-access-done'&&firstAccess.phase==='done'){firstAccess=null;suspend();onExit({stand:true});}return;
      }
      // This guard precedes the awaited preview cleanup. A second navigation
      // must not wait for the same STOP then advance the next port as well.
      // Security/select cancellation retains its existing separate handling.
      const action=target.dataset.onboardingAction;
      if(busy&&['outputs','pixels','connection'].includes(draft?.stage)){
        if(action==='exit'&&previewStopJob)return exitDuringPreviewStop();
        return;
      }
      if((draftSaving||managementBusy)&&action!=='zone-picker-close')return;
      if(action==='copy-factory-wifi'){
        const preview=services.factoryGuidePreview===true&&!draft.mainReceiverId;
        if((!manualWifi()&&!preview)||draft.stage!=='receiver'||results.length||busy)return;
        const owner=container,token=operation,field=container.querySelector('[data-factory-password]'),status=container.querySelector('[data-factory-copy-status]');
        return window.LightningSetupWifiGuide?.copy({clipboard:window.navigator?.clipboard,field,status,current:()=>container===owner&&operation===token&&field?.isConnected});
      }
      if(action==='receiver-filter'){
        if(draft.stage!=='receiver'||busy||identifyPending.size||identifying.size||!['all','RGBW','SPI'].includes(target.dataset.filter))return;
        receiverFilter=target.dataset.filter;paintPage(false);
        container?.querySelector(`[data-onboarding-action="receiver-filter"][data-filter="${receiverFilter}"]`)?.focus({preventScroll:true});return;
      }
      if(action==='zone-picker-open'){
        if(pendingChoices||draftSaving){event.preventDefault();return;}
        event.preventDefault();const picker=target.closest('[data-receiver-destination]');if(!picker)return;
        const dialog=picker.querySelector('[data-onboarding-zone-dialog]'),wasOpen=picker.open&&dialog?.open;
        picker.open=!wasOpen;if(wasOpen&&dialog?.open){dialog.close();receiverZoneSelection=undefined;zoneNameOpen=false;}else if(receiverZoneSelection===undefined)receiverZoneSelection=draft.activeZoneId;
        openZonePickerOnNextPaint=picker.open;paintPage(false);
        if(!picker.open)container?.querySelector('[data-receiver-destination]>summary')?.focus({preventScroll:true});return;
      }
      if(action==='zone-picker-close'){
        event.preventDefault();const picker=target.closest('[data-receiver-destination]');if(picker)picker.open=false;
        const dialog=target.closest('[data-onboarding-zone-dialog]');if(dialog?.open)dialog.close();
        receiverZoneSelection=undefined;openZonePickerOnNextPaint=false;zoneNameOpen=false;
        paintPage(false);container?.querySelector('[data-receiver-destination]>summary')?.focus({preventScroll:true});return;
      }
      if(action==='zone-picker-confirm'){
        if(receiverZoneSelection===undefined)return;
        return saveChoices([{type:'SELECT_ACTIVE_ZONE',zoneId:receiverZoneSelection}],()=>{
          receiverZoneSelection=undefined;const picker=container?.querySelector('[data-receiver-destination]');if(picker)picker.open=false;
          const dialog=picker?.querySelector('[data-onboarding-zone-dialog]');if(dialog?.open)dialog.close();openZonePickerOnNextPaint=false;
        },{top:false,focusDestination:true});
      }
      if(action==='save-retry')return saveChoices();
      if(action==='receivers-list')return browseReceivers();
      if(['next','back','exit'].includes(action)&&['outputs','pixels','connection'].includes(draft.stage)){
        const stoppingContainer=container,stoppingDraft=draft,token=operation;
        const job={container:stoppingContainer,draft:stoppingDraft,token,restore:pixelSetup.showPreviewStopping(stoppingContainer),exitPending:false,stopSettled:false,failed:false};
        previewStopJob=job;busy=true;
        stoppingContainer.querySelector('[data-onboarding-action="exit"]')?.removeAttribute('disabled');
        try{await pixelPreview.stop();}catch(_){job.failed=true;}
        finally{job.stopSettled=true;if(previewStopJob===job&&!job.exitPending){job.restore();if(token===operation&&container===stoppingContainer)busy=false;}}
        if(previewStopJob!==job||token!==operation||container!==stoppingContainer||draft!==stoppingDraft)return;
        if(job.exitPending)return;
        previewStopJob=null;
        if(job.failed||['failed','unsupported'].includes(previewState.kind)){notice='Stoppen van het testlicht is nog niet bevestigd. Je keuzes blijven staan; probeer opnieuw.';refreshNotice();return;}
      }
      if(action==='exit'){
        if(exiting)return;
        const beforeSave=operation;
        const name=container.querySelector('#onboarding-stand-name')?.value;
        const events=draft.stage==='stand'&&validName(name||'')?[{type:'SET_STAND',id:draft.stand?.id||'stand-'+uniqueId(),name}]:[];
        if((pendingChoices||['stand','zones'].includes(draft.stage))&&!(await saveChoices(events)))return;
        if(beforeSave!==operation||!container)return;
        const exitContainer=container;exiting=true;let left=false;
        try{
          if(!(await parkForExit())||container!==exitContainer)return;
          const closedSearch=draft?.role==='node'&&draft.stage==='receiver'&&draft.receiver===null;
          suspend({discard:true});
          // A closed search has no remaining active native checkpoint. Reopen
          // against the current installation, not a MAIN removed meanwhile.
          // Privately parked receiver transactions remain available by identity.
          if(closedSearch)draft=null;
          left=true;
        }finally{exiting=false;}
        if(left)onExit();
        return;
      }
      if(pendingChoices)return;
      if(action==='search')return search();
      if(action==='identify')return identify(target.dataset.id);
      if(busy)return;
      if(action==='stand-save'){
        return saveChoices([{type:'SET_STAND',id:draft.stand?.id||'stand-'+uniqueId(),name:container.querySelector('#onboarding-stand-name').value},{type:'NEXT'}]);
      }
      if(action==='zone-create'){
        captureNames();if(!validZoneNames())return;
        // Creating zones and leaving this step are separate choices. Keep
        // every saved batch here so the customer can add another zone first.
        const newReceiverZone=draft.stage==='zone'&&!pinRequired();
        const earlyPlacement=draft.stage==='placement';
        const events=newZoneEvents();
        // From the destination picker, the new zone is immediately the
        // destination. This avoids asking the customer to choose it again.
        if(['receiver','outputs'].includes(draft.stage)&&events.length)events.push({type:'SELECT_ACTIVE_ZONE',zoneId:events.at(-1).id});
        if(earlyPlacement)events.push({type:'NEXT'});
        return saveChoices(events,()=>{
          zoneNameOpen=false;resetZoneNames();
          if(['receiver','outputs'].includes(draft.stage)){const picker=container?.querySelector('[data-receiver-destination]');if(picker)picker.open=false;const dialog=picker?.querySelector('[data-onboarding-zone-dialog]');if(dialog?.open)dialog.close();openZonePickerOnNextPaint=false;}
          if(newReceiverZone)queueMicrotask(()=>finishChosenZone());
          if(earlyPlacement&&draft.stage==='security')queueMicrotask(()=>secure());
        },{top:!['zones','receiver','outputs'].includes(draft.stage)});
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
        captureNames();rememberZoneList(target);zoneRename={zoneId:zone.id,name:zone.name,signature:zone.isNew?null:zoneSignature(stored)};zoneRemoval=null;receiverMove=null;error='';paintPage(false);
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
        rememberZoneList(target);zoneRemoval={zoneId:zone.id,signature:zone.isNew?null:zoneSignature(stored)};error='';paintPage(false);container.querySelector('[data-setup-delete-zone] h2')?.scrollIntoView({block:'nearest'});return;
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
      if(action==='zone-add-from-receiver'){
        cancelSearch();for(const id of identifying.keys())stopIdentify(id);
        zoneNameOpen=true;zoneNameInput='';zoneExtraNames=[];paintPage(false);container.querySelector('#onboarding-zone-name')?.focus({preventScroll:true});return;
      }
      if(action==='zone-cancel'){zoneNameOpen=false;resetZoneNames();paintPage(false);return;}
      if(action==='active-zone'){
        if(['receiver','outputs'].includes(draft.stage)&&target.closest('[data-onboarding-zone-dialog]')){
          receiverZoneSelection=target.hasAttribute('data-without-zone')?null:target.dataset.id;error='';paintPage(false);return;
        }
        if(draft.stage==='receiver'){const picker=target.closest('.onboarding-destination');if(picker){picker.open=false;const dialog=picker.querySelector('[data-onboarding-zone-dialog]');if(dialog?.open)dialog.close();const existing=picker.querySelector('.onboarding-existing-members');if(existing)existing.open=false;}}
        return saveChoices([{type:'SELECT_ACTIVE_ZONE',zoneId:target.hasAttribute('data-without-zone')?null:target.dataset.id}],()=>{},{top:false});
      }
      if(action==='receiver'){
        if(identifyPending.size)return;
        let receiver=results.find(receiver=>receiver.id===target.dataset.id);if(!receiver)return;
        if(identifying.size){
          // STOP uses the same native radio lock as identity verification and
          // commissioning. Settle it before either operation starts.
          const token=++operation;busy=true;paintPage(false);
          try{
            for(const id of Array.from(identifying.keys())){
              if(token!==operation||!container||draft.stage!=='receiver')return;
              await stopIdentify(id);
            }
          }
          finally{busy=false;if(token===operation)paintPage(false);}
          if(token!==operation||!container||draft.stage!=='receiver')return;
        }
        // Looking at a receiver list grants no membership. Only selecting the
        // exact found identity may reopen its private, immutable native intent.
        // Other receivers remain ordinary selectable results in the meantime.
        if(typeof services.resumeDraft==='function'||parkedChoices.has(receiver.id)){
          const token=++operation;busy=true;error='';paintPage(false);
          let restored=null;
          try{
            const view=typeof services.resumeDraft==='function'?await services.resumeDraft({standId:draft.stand.id,receiverId:receiver.id,rid:receiver.rid,fingerprint:receiver.deviceFingerprint}):{draft:parkedChoices.get(receiver.id)};
            if(token!==operation||!container)return;
            if(view?.draft?.receiver){
              const saved=draftApi.snapshot(view.draft),identity=saved.receiver;
              if(saved.stand.id!==draft.stand.id||identity.id!==receiver.id||identity.rid!==receiver.rid||identity.type!==receiver.type||receiver.deviceFingerprint&&identity.deviceFingerprint!==receiver.deviceFingerprint)throw Error('IDENTITY_MISMATCH');
              parkedChoices.delete(receiver.id);parkedTransactions.delete(saved.transactionId);restored=saved;
            }
          }catch(failure){if(token===operation){error=connectionFailure(failure,{viaMain:draft.role==='node'}).message;return;}}
          finally{busy=false;paintPage(false);}
          if(token!==operation||!container)return;
          if(restored){
            draft=restored;securityReceiptRef=null;finalReceiptRef=null;
            securityUncertain=draft.security.status!=='not-started';
            if(securityUncertain)draft=draftApi.snapshot({...clone(draft),stage:'security',security:{status:'pending',phase:'resuming'},cancelled:false});
            paintPage(true);
            if(securityUncertain)return secure(undefined,undefined,{reconcile:true,resumeFinalization:['zone','review'].includes(restored.stage)});
            // Unclaimed choices are not fresh identity proof. A native
            // reachability-only result must reattest the original pin before
            // continuing its saved output/PIN screen or starting a claim.
            busy=true;
            try{
              let selectionVerified=receiver.canConfigure!==false;
              if(receiver.canConfigure===false&&receiver.canVerifyIdentity){
                const verified=await bounded(services.select({standId:draft.stand.id,transactionId:draft.transactionId,receiver:clone(receiver)}),50000);
                if(token!==operation||!container)return;
                if(!['id','rid','type','deviceFingerprint'].every(key=>verified?.[key]===draft.receiver[key]))throw Object.assign(Error('IDENTITY_MISMATCH'),{code:'IDENTITY_MISMATCH'});
                selectionVerified=true;
              }
              if(draft.stage==='receiver'){
                if(!selectionVerified)throw Object.assign(Error('IDENTITY_MISMATCH'),{code:'IDENTITY_MISMATCH'});
                // BACK keeps exact unclaimed choices, not a completed step.
                // Reuse normal placement/output/PIN rules without selecting a
                // different identity or replacing the saved SPI configuration.
                const continued=draftApi.transition(draft,{type:'NEXT'});
                if(continued.error)throw Object.assign(Error('MAIN_CONFIGURATION_INVALID'),{code:'MAIN_CONFIGURATION_INVALID'});
                if(typeof services.persistDraft==='function')await services.persistDraft({draft:draftApi.snapshot(continued.draft)});
                if(token!==operation||!container)return;
                draft=continued.draft;
              }else await persist();
            }catch(failure){if(token===operation)error=connectionFailure(failure,{viaMain:draft.role==='node'}).message;return;}
            finally{if(token===operation){busy=false;paintPage(false);}}
            if(token!==operation||!container)return;
            if(draft.stage==='pin'&&!pinRequired())draft=draftApi.snapshot({...clone(draft),stage:'security',security:{status:'pending',phase:'configuring'}});
            if(draft.stage==='security')return secure();
            return;
          }
        }
        if(receiver.canConfigure===false&&receiver.canVerifyIdentity){
          const token=++operation,expected=receiver;busy=true;error='';notice='Receiver veilig controleren…';paintPage(false);
          try{
            const verified=await bounded(services.select({standId:draft.stand.id,transactionId:draft.transactionId,receiver:clone(expected)}),50000);
            if(token!==operation||!container||draft.stage!=='receiver')return;
            if(!verified||verified.id!==expected.id||verified.rid!==expected.rid||verified.type!==expected.type||!/^[A-F0-9]{64}$/.test(verified.deviceFingerprint)||expected.deviceFingerprint&&verified.deviceFingerprint!==expected.deviceFingerprint)throw Object.assign(Error('IDENTITY_MISMATCH'),{code:'IDENTITY_MISMATCH'});
            receiver={id:verified.id,rid:verified.rid,type:verified.type,name:expected.name,deviceFingerprint:verified.deviceFingerprint,canConfigure:true,canVerifyIdentity:true};
            results=results.map(item=>item.id===receiver.id?receiver:item);
          }catch(failure){if(token===operation){const problem=connectionFailure(failure,{viaMain:draft.role==='node'});error=problem.message;if(problem.expired){results=[];searchState='idle';}}return;}
          finally{busy=false;notice='';paintPage(false);}
        }
        if(receiver.canConfigure===false){error=receiver.unavailableReason;paintPage(false);return;}
        if(receiver.type==='RGBW'&&draft.role==='node'&&!canSecure()){error=unavailable;paintPage(false);return;}
        const candidate={id:receiver.id,rid:receiver.rid,type:receiver.type,name:receiver.name,deviceFingerprint:receiver.deviceFingerprint};
        if(resumeSelection&&['id','rid','type','deviceFingerprint'].every(key=>resumeSelection.receiver?.[key]===candidate[key])){
          draft=draftApi.snapshot(resumeSelection);resumeSelection=null;notice='Je vorige instellingen staan klaar.';keepDraft();paintPage();
          // Native reconciliation has confirmed that no durable claim exists.
          // After rechecking this exact device, continue the preserved setup;
          // reconciling the absent claim again would strand the user in a loop.
          // A MAIN that needs a PIN still waits for its explicit PIN submission.
          if(draft.stage==='security')return secure();
          return;
        }
        resumeSelection=null;
        if(change({type:'SELECT_RECEIVER',receiver:candidate},{render:false})){plugMotion.clear();selectedOutput=null;change({type:'NEXT'});if(draft.stage==='security')return secure();}return;
      }
      if(action==='count')return change({type:'SET_OUTPUT_COUNT',count:Number(target.dataset.count)});
      if(action==='output'){
        const output=draft.outputs.find(o=>o.port===Number(target.dataset.port));if(!output)return;
        const enabled=!output.enabled;
        if(change({type:'SET_OUTPUT_ENABLED',port:output.port,enabled},{render:false})){selectedOutput=output.port;plugMotion.trigger(output.port,performance.now()/1000,enabled);}
        return paintPage(false);
      }
      if(action==='pixel-step'){
        const delta=Number(target.dataset.pixelDelta);if(![-30,-15,15,30].includes(delta)||draft.stage!=='pixels')return;
        const selected=draft.outputs.find(output=>output.port===draft.port).pixels;
        return updatePixelCount(pixelSetup.stepPixels(selected,delta,pixelLimits),null,{commit:false});
      }
      if(['pixel-less','pixel-more'].includes(action)){
        const direction=action.endsWith('less')?-1:1,selected=draft.outputs.find(output=>output.port===draft.port).pixels;
        const value=pixelSetup.stepPixels(selected,direction,pixelLimits);
        return updatePixelCount(value,null,{commit:false});
      }
      if(action==='side'){if(change({type:'SET_SIDE',port:draft.port,side:target.dataset.side},{top:false}))void pixelPreview.flush();return;}
      if(action==='zone'){
        const zoneId=target.hasAttribute('data-without-zone')?null:target.dataset.id;
        if(draft.stage==='placement')return saveChoices([{type:'SELECT_ZONE',zoneId},{type:'NEXT'}],()=>{if(draft.stage==='security')queueMicrotask(()=>secure());});
        if(pinRequired())return change({type:'SELECT_ZONE',zoneId});
        const selected=draftApi.transition(draft,{type:'SELECT_ZONE',zoneId});
        if(selected.error){error=selected.error.message;paintPage(false);return;}
        draft=selected.draft;return finishChosenZone();
      }
      if(action==='back'){
        if(finalizationStarted)return;
        if(draft.stage==='receiver'){cancelSearch();for(const id of identifying.keys())stopIdentify(id);}
        return change({type:'BACK'});
      }
      if(action==='next'||action==='zones-later'&&draft.stage==='zones'){
        if(draft.stage==='zones'){
          captureNames();if(hasZoneNames()?!validZoneNames():!draft.zones.length&&action!=='zones-later'){
            if(action==='zones-later'){error='Maak de ingevulde namen af of verwijder een leeg extra naamveld. Je namen blijven staan.';paintPage(false);}
            return;
          }
          // One zones page: Continue can save the entered name(s) and leave
          // atomically, without an intermediate overview or a second tap.
          return saveChoices([...(hasZoneNames()?newZoneEvents():[]),{type:action==='zones-later'?'SKIP_ZONES':'NEXT'}],()=>{
          resetZoneNames();zoneNameOpen=false;
          // Search only after an explicit Continue and a successful save.
          // Manual Wi-Fi still needs the customer's Settings trip first.
          if(!draft.mainReceiverId&&!pinRequired()&&(!manualWifi()||automaticFirstReceiver()))queueMicrotask(()=>{if(container&&draft.stage==='receiver')void search();});
          });
        }
        if(draft.stage==='pixels'&&draft.port===active().at(-1).port&&draft.role==='node'&&!canSecure()){error=unavailable;paintPage(false);return;}
        if(change({type:'NEXT'})&&draft.stage==='security')return secure();return;
      }
      if(action==='secure')return secure(container.querySelector('#onboarding-pin').value,container.querySelector('#onboarding-pin-repeat').value);
      if(action==='security-retry')return automaticMain()?resumeAfterWifiReturn({force:true}):secure(undefined,undefined,{reconcile:true});
      if(action==='finish')return finish();
      if(action==='done'){suspend();onExit({stand:true});return;}
      if(action==='another'){const activeZoneId=draft.zoneId;draft=null;start({activeZoneId});paintPage();if(draft.stage==='receiver')queueMicrotask(()=>{if(container&&draft.stage==='receiver'&&searchState==='idle'&&!busy)void search();});return;}
      if(action==='another-zone'){
        draft=null;start({activeZoneId:null});draft=draftApi.snapshot({...clone(draft),zoneChoiceRequired:true});
        return saveChoices([],()=>{openZonePickerOnNextPaint=true;},{top:true});
      }
    }
    // Only names, counts and the pending step for the Stand resume card; never
    // expose credentials, security receipts or unconfirmed receiver membership.
    function summary(){if(firstAccess&&firstAccess.phase!=='done'){const stand=getModel().stands.find(item=>item.id===firstAccess.identity.standId);return {stand:clone(stand),zones:clone(stand?.zones||[]),stage:'wifi-pin',activeZoneId:null,canManageZones:false};}return draft&&draft.stage!=='done'?{stand:clone(draft.stand),zones:clone(draft.zones),stage:draft.stage,activeZoneId:draft.activeZoneId,canManageZones:canManageZones()}:null;}
    return Object.freeze({mount,suspend,reset,paint,restore,restoreFirstStandAccess,summary,canContinueLocalConcept,continueLocalConcept});
  }
  return Object.freeze({create,firstAccessFailure});
}));
