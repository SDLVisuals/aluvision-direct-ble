/* PREVIEWSYNC: one wall-clock preview time base (epoch seconds) for every
 * animation preview, so a saved previewStartedAt keeps its meaning after an app
 * reopen and on another phone; plus the dispatch lead used when sampling PHASEMS
 * (fast lane: receivers start the app's phase at the MAIN deadline, ~120 ms after
 * the request is built). Bench override: localStorage 'aluvision.previewLeadMs'. */
(function(root){'use strict';
  if(typeof root.AluvisionPreviewNowPS!=='function'){
    const p=root.performance,mono=p&&typeof p.now==='function';
    let origin=mono?Date.now()-p.now():0;
    root.AluvisionPreviewNowPS=()=>{
      const wall=Date.now();if(!mono)return wall/1000;
      const t=origin+p.now();
      // Sleep or a wall-clock correction: follow the wall clock again.
      if(Math.abs(wall-t)>250){origin=wall-p.now();return wall/1000;}
      return t/1000;
    };
  }
  if(typeof root.AluvisionPreviewLeadPS!=='function'){
    let lead=120;
    try{const raw=root.localStorage&&root.localStorage.getItem('aluvision.previewLeadMs');
      if(raw!==null&&raw!==undefined&&raw!==''){const v=Number(raw);if(Number.isFinite(v)&&v>=0&&v<=1000)lead=v;}}catch(_){}
    root.AluvisionPreviewLeadPS=()=>lead/1000;
  }
})(typeof globalThis==='object'?globalThis:this);
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
  // C137cc (9 Nov 19:39: two selects of a node failed MESH_PROXY_UNCONFIRMED after 5.5 s, the third tap worked): a relay
  // hop of the MAIN that was not confirmed is retried quietly up to twice before the user sees "even bezig".
  async function selectWithRetryC137cc(services,request){ // C137ce: module scope has no `services`; the caller passes it
    for(let attempt=0;;attempt++){
      try{return await services.select(request);}
      catch(error){if(attempt<2&&['MESH_PROXY_UNCONFIRMED','PROXY_BUSY','MESH_BUSY'].includes(error?.code)){await new Promise(resolve=>setTimeout(resolve,1500));continue;}throw error;}
    }
  }
  // 20 nov (koppel-rooktest Android-emulator): de eigen bluetooth-codes van de native weg (BluetoothStandLink / AlvBluetoothLink) stonden
  // niet in de lijst: de klant kreeg "Receiver niet gecontroleerd. Tik op Verbinding controleren." in plaats van de bluetooth-zin.
  const BLE_NIET_GEVONDEN_C272=['BLUETOOTH_DEADLINE','BLUETOOTH_UNAVAILABLE','BLUETOOTH_OFF','BLUETOOTH_REPLY_INVALID'];
  // eerste-receiver (22 nov): de native code van de laatst getoonde koppelfout; summary().failCode geeft hem door zolang die fout
  // in beeld staat (Flutter setupScreen.koppelFout → één rustige zin). Alleen een vaste code [A-Z0-9_], nooit een tekst.
  let koppelFoutC278='';
  const onthoudKoppelFout=code=>{koppelFoutC278=typeof code==='string'&&/^[A-Z0-9_]{1,64}$/.test(code)?code:'';};
  function connectionFailure(failure,{viaMain=false,network='',bluetooth=false}={}){
    // C137br: Android reports the plain/transport wrong-network codes; they showed the generic "Receiver niet gecontroleerd".
    const rawC137br=typeof failure?.code==='string'?failure.code:'';onthoudKoppelFout(rawC137br);
    const code=['WRONG_RECEIVER_NETWORK','TRUST_TRANSPORT_WRONG_RECEIVER_NETWORK'].includes(rawC137br)?'MAIN_WRONG_RECEIVER_NETWORK':rawC137br;
    // C137br: the MAIN's relay was briefly busy (heap gate) or did not confirm one hop: a calm retry hint, never "niet gecontroleerd".
    if(['MESH_PROXY_UNCONFIRMED','PROXY_BUSY','MESH_BUSY'].includes(code))return {message:'Je stand is even bezig. Laat de receiver aan en tik over een paar seconden op Verbinding controleren. Er is niets gereset.'};
    if(code==='MAIN_EXISTING_STAND_ACCESS_REQUIRED')return {message:'Deze app heeft nog geen toegang tot deze receiver. Open je bestaande stand met de app die al toegang heeft. Er is niets toegevoegd of gereset.'};
    if(code==='MAIN_TRUST_MIGRATION_REQUIRED')return {message:'Deze receiver heeft bestaande standinstellingen. Gebruik je bestaande standtoegang om verder te gaan. Er is niets toegevoegd of gereset.'};
    if(code==='LOCAL_NETWORK_DENIED')return {message:'Geef de Aluvision-app toegang tot het lokale netwerk via Instellingen. Heropen de app. Reset je receiver niet.'};
    // 15 nov: eerste receiver via bluetooth: niet gevonden = bluetooth, afstand of stroom, nooit een wifi-stap.
    if(bluetooth&&!viaMain&&['DISCOVERY_UNAVAILABLE','MAIN_MANUAL_WIFI_REQUIRED','MAIN_CONNECTION_UNAVAILABLE','NATIVE_TIMEOUT','TIMEOUT','MAIN_WRONG_RECEIVER_NETWORK',...BLE_NIET_GEVONDEN_C272].includes(code))return {message:'Receiver niet gevonden. Zet bluetooth aan, laat de receiver aan en houd je telefoon dichtbij. Probeer dan opnieuw.'};
    if(code==='MAIN_WRONG_RECEIVER_NETWORK'&&!viaMain&&network)return {message:'Verkeerde wifi. Kies in Instellingen → Wifi het netwerk {network} van deze receiver en tik op Verbinding controleren.',vars:{network}};
    if(code==='MAIN_WRONG_RECEIVER_NETWORK')return {message:viaMain?'Verkeerde wifi. Kies in Instellingen → Wifi je bestaande ALUVISION-standnetwerk (niet de nieuwe receiver) en tik op Verbinding controleren.':'Verkeerde wifi. Kies het ALUVISION-netwerk van deze receiver en tik op Verbinding controleren.'};
    if(!pinRequired()&&['MAIN_RECOVERY_UNAVAILABLE','MAIN_RECOVERY_CONFLICT','MAIN_REGISTRATION_UNCONFIRMED','REMOVAL_PIN_REQUIRED'].includes(code))return {message:'Receiver niet bereikbaar. Laat hem aan en controleer de verbinding opnieuw.'};
    if(code==='DISCOVERY_EXPIRED')return {expired:true,message:'Controle verlopen. Tik op Verbinding controleren.'};
    if(['DISCOVERY_UNAVAILABLE','MAIN_MANUAL_WIFI_REQUIRED','MAIN_CONNECTION_UNAVAILABLE','NATIVE_TIMEOUT','TIMEOUT'].includes(code))return {message:viaMain?'Verbind met je bestaande standwifi. Laat de nieuwe receiver aan en probeer opnieuw.':'Verbind met het ALUVISION-wifi van deze receiver en tik op Verbinding controleren.'};
    if(code==='OWNED_DISCOVERY_UNSUPPORTED')return {message:'Een receiver zoeken via je bestaande stand is nog niet beschikbaar in deze versie.'};
    if(['MAIN_PROTOCOL_UNSUPPORTED','ACTION_UNSUPPORTED'].includes(code))return {message:'App en receiver zijn niet compatibel. Werk beide bij; reset de receiver niet.'};
    if(code==='MAIN_MANAGEMENT_REFUSED')return {message:'Je stand heeft de koppelcontrole geweigerd. Je gegevens blijven bewaard. Laat de receiver aan en controleer opnieuw.'};
    if(['MAIN_IDENTITY_UNCONFIRMED','IDENTITY_MISMATCH','DISCOVERY_INVALID'].includes(code))return {message:viaMain?'Receiver niet herkend. Controleer je standwifi en probeer opnieuw. Er is niets toegevoegd.':'Receiver niet herkend. Controleer het juiste receiver-wifi en probeer opnieuw. Er is niets toegevoegd.'};
    if(['NATIVE_BUSY','MAIN_BUSY','OTA_BUSY','STAND_SYNC_BUSY','REMOVAL_BUSY'].includes(code))return {message:'Er loopt al een receiveractie. Wacht even en probeer opnieuw.'};
    if(['MAIN_STORAGE_UNCONFIRMED','V30_STORAGE_UNAVAILABLE','V30_STORAGE_UNCONFIRMED','V30_CHECKPOINT_CONFLICT'].includes(code))return {message:'Opslaan niet bevestigd. Je keuzes staan nog in beeld; probeer opnieuw. Reset de receiver niet.'};
    if(code==='MAIN_RECOVERY_UNAVAILABLE')return {message:'Toegang niet bewaard. Laat de receiver aan en probeer opnieuw.'};
    if(code==='MAIN_RECOVERY_CONFLICT')return {message:'Toegang komt niet overeen. Er is niets overschreven. Controleer je standcode.'};
    if(code==='MAIN_REGISTRATION_UNCONFIRMED')return {message:'Toegang wordt nog bewaard. Laat de receiver aan en controleer opnieuw.'};
    if(['NATIVE_UNAVAILABLE','NATIVE_DOCUMENT_UNAVAILABLE'].includes(code))return {message:'Receiververbinding niet beschikbaar. Herstart de app en probeer opnieuw.'};
    // C118: a bounded NODE step code (iPhone: diagnosticCode; Android: the code
    // itself) chooses fixed copy. Only truly unknown codes keep the fallback.
    const nodeDiagnostic=/^NODE_DIAG_(BEGIN|SETUP_BEGIN|CONFIG|SETUP_END|COMMIT|MESH_STAGE|MESH_COMMIT)_(MAIN|NODE)_(SCOPE|BUSY|EXPIRED|PREPARE|GEOMETRY|INVALID|SAVE|SECURITY|INCOMPLETE|SHAPE|OTHER)$/;
    const nodeStep=code==='MAIN_CONFIGURATION_UNCONFIRMED'&&typeof failure?.diagnosticCode==='string'&&nodeDiagnostic.test(failure.diagnosticCode)?failure.diagnosticCode:nodeDiagnostic.test(code)?code:null;
    const step=nodeStep&&nodeDiagnostic.exec(nodeStep),reason=step?.[3];
    if(step&&reason==='SECURITY'&&/^MESH_/.test(step[1]))return {message:'De receiver heeft de beveiligde koppeling geweigerd. Zet hem uit en weer aan, wacht een minuut en tik op Verbinding controleren. Je keuzes blijven bewaard.'};
    if(step&&['INCOMPLETE','EXPIRED'].includes(reason))return {message:'De koppelstap is verlopen. Laat de receiver aan en tik op Verbinding controleren. Je keuzes blijven bewaard.'};
    if(step&&reason==='BUSY')return {message:'Er loopt al een receiveractie. Wacht even en probeer opnieuw.'};
    if(step&&reason==='SAVE')return {message:'De receiver kon de instellingen niet opslaan. Laat hem aan en tik op Verbinding controleren. Je keuzes blijven bewaard.'};
    if((step&&['SCOPE','PREPARE','GEOMETRY','INVALID','SHAPE'].includes(reason))||(code==='MAIN_CONFIGURATION_UNCONFIRMED'&&!nodeStep))return {message:'De receiver heeft de instellingen niet bevestigd. Laat hem aan en tik op Verbinding controleren. Je keuzes blijven bewaard.'};
    if(code==='MAIN_EXPLICIT_RETRY_REQUIRED')return {message:'De koppeling is nog niet bevestigd. Laat de receiver aan en tik op Verbinding controleren. Je keuzes blijven bewaard.'};
    if(code==='MAIN_CLAIM_UNCONFIRMED')return {message:'De receiver heeft het koppelen niet bevestigd. Laat hem aan en tik op Verbinding controleren. Je keuzes blijven bewaard.'};
    // C127: this phone still holds an older copy of a receiver that changed on another phone (removed, added again).
    // No red error: a calm notice, and the stand is brought up to date (calmProblemC127).
    if(code==='MESH_BINDING_INVALID')return {calm:true,message:'Deze receiver is net op een ander toestel gewijzigd. Je stand wordt nu bijgewerkt; tik daarna op Verbinding controleren.'};
    const diagnostic=viaMain&&nodeStep?nodeStep:null;
    return {message:'Receiver niet gecontroleerd. Tik op Verbinding controleren. Reset de receiver niet.'+(diagnostic?' ['+diagnostic+']':'')};
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
    if(phase==='receiver'&&['MAIN_EXISTING_STAND_ACCESS_REQUIRED','MAIN_TRUST_MIGRATION_REQUIRED','LOCAL_NETWORK_DENIED','MAIN_WRONG_RECEIVER_NETWORK','DISCOVERY_UNAVAILABLE','MAIN_MANUAL_WIFI_REQUIRED','MAIN_CONNECTION_UNAVAILABLE','NATIVE_TIMEOUT','TIMEOUT','NATIVE_BUSY','MAIN_BUSY','OTA_BUSY','REMOVAL_BUSY','MAIN_PROTOCOL_UNSUPPORTED','ACTION_UNSUPPORTED'].includes(code))return connectionFailure(failure,{viaMain});
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

  function create({draftApi=window.LightningOnboardingDraft,visual=window.LightningReceiverVisual,pixelSetup=window.LightningPixelSetup,pixelsPerMeter,services={},getModel,onComplete=()=>{},onManage=null,onExit=()=>{},onFlutterBack=null,onFlutterRestart=null,jointSPIDirections=false,pairSPIFirst=false,onPairFirstBegin=null,firstPinV2=false,allowPinLogin=false,automaticFirstReceiver=()=>false,firstStandAccessRequired=()=>false,onFirstStandAccess=null,allowLocalConcept=()=>false,onPreserveLocalConcept=null,onContinueLocalConcept=null,onForgotten=null,labelScanAvailable=()=>false}={}){
    if(!draftApi||!pixelSetup||typeof getModel!=='function')throw Error('Onboarding dependencies are required.');
    const pixelLimits=pixelSetup.pixelLimits({pixelsPerMeter});
    let draft=null,container=null,results=[],searchState='idle',receiverFilter='all',error='',notice='',busy=false,operation=0;
    let securityReceiptRef=null,finalReceiptRef=null,securityUncertain=false,finalizationStarted=false,completeModel=null,manualRejoinSSID=null;
    // C231: het koppelbeeld loopt door na de PIN (rejoinHelp = de klant vroeg de wifi-uitleg) en bij het afronden
    // (autoFinish = het toevoegen begon vanzelf; finishSuspended = het stopte omdat de pagina uit beeld was).
    let rejoinHelpC231=false,autoFinishC231=false,finishSuspendedC231=false;
    const firstPinAPI=window.LightningFirstPinV2;
    let firstPinState686=null,firstPinReturn686=false;
    // 16 nov (iPhone 1046, koppeltest): terug uit Instellingen → Wifi begint de controle soms enkele ms voor iOS de app actief
    // meldt; native weigert dan meteen met MAIN_CONFIGURATION_INVALID (V30Bridge: applicationIsForeground). Dat is geen fout van
    // de klant: één stille herhaling zodra de app actief is (lightning:native-active), anders na 1,5 s. Eén keer per terugkomst.
    let firstPinEarly686={wait:false,used:false,timer:0};
    // de eigenaar 17 nov (c98-1805.log, koppeling 10 en 16): de MAIN herstart ± 1,5 s na de claim (voor het benoemde wifi). De eerste
    // controle valt in die herstart (…UNKNOWN_OWNER_REPLY_UNCONFIRMED, daarna MAIN_CONFIGURATION_INVALID) en de PIN-kaart kwam terug
    // (22 s). Binnen 45 s na het antwoord op de claim (in het log viel de tweede fout 29,8 s erna): stil opnieuw (om de 2 s), het koppelbeeld blijft staan; pas daarna de bestaande rustige weg.
    let firstPinClaimAt=0,firstPinStil=false;
    // Tijdprofiel 20 nov (de eigenaar 18 nov, 4 van 4 eerste receivers): de eerste controle valt 1,8 s na de claim in de herstart met
    // TRUST_REPLY -> MAIN_IDENTITY_UNCONFIRMED. Die code stond niet in de lijst: de PIN-kaart kwam terug en pas 14–27 s later liep
    // de volgende controle. Binnen dezelfde 45 s na de claim is dat ook de herstart (de controle leest alleen; de claim gaat nooit
    // opnieuw). En: firstPinClaimAt werd nooit gezet (de fase stond vóór de claim al op 'rejoin', rememberFirstPin686 zag dus geen
    // overgang pin -> rejoin), dus deze stille weg liep op een toestel nooit (0 keer "pin-herstart" in de logs van 18 nov). Nu bij het
    // antwoord op de claim. Schakelaar uit = zoals vroeger.
    const HERSTART_NA_CLAIM_C272=true;
    // 20 nov (koppelen sneller/stabieler): de eerste receiver gaat via bluetooth (bluetoothFirst). Na de claim herstart de MAIN
    // (± 10 s), de bluetooth-link moet opnieuw verbinden en één controle over bluetooth duurt ± 13 s. In 1073 kwam "gelukt" pas
    // 42,6 s na de claim: 45 s laat geen ruimte. De klant kan via bluetooth niets anders doen (er is geen wifi te kiezen) en de zin
    // "controleer je standwifi" klopt daar niet. Met bluetooth dus 90 s stil; via wifi blijft het 45 s. Schakelaar uit = altijd 45 s.
    const REJOIN_PLAFOND_C276=false;
    const STIL_BLUETOOTH_C272=true;
    const stilNaClaimMs=()=>STIL_BLUETOOTH_C272&&bluetoothFirst?90000:45000;
    const herstartNaClaim=failure=>Date.now()-firstPinClaimAt<stilNaClaimMs()&&(/UNKNOWN_OWNER_REPLY_UNCONFIRMED$/.test(String(failure?.code||''))||
      ['MAIN_CONFIGURATION_INVALID','MAIN_CONNECTION_UNAVAILABLE','NATIVE_TIMEOUT','MAIN_BUSY'].includes(failure?.code)||
      HERSTART_NA_CLAIM_C272&&(failure?.code==='MAIN_IDENTITY_UNCONFIRMED'||/^TRUST_(REPLY|TRANSPORT|DEADLINE)$/.test(String(failure?.code||''))));
    function retryEarlyFirstPin686(){
      clearTimeout(firstPinEarly686.timer);if(!firstPinEarly686.wait)return;
      firstPinEarly686.wait=false;firstPinReturn686=true;resumeFirstPin686();
    }
    // The demo walkthrough plays this service (services.FirstPinV2.demoWalkthrough, web-demo-service.js only): there the
    // demo model counts as a real one for this one question. The phone app's own service never carries that mark.
    const firstPinCandidate686=()=>firstPinV2===true&&!!services.FirstPinV2&&firstPinAPI?.candidate(draft,services.FirstPinV2.demoWalkthrough===true?{...getModel(),demo:false}:getModel())===true;
    const firstPinCurrent686=()=>!!firstPinState686&&!!draft?.receiver&&firstPinState686.transactionId===draft.transactionId&&firstPinState686.receiverId===draft.receiver.id&&firstPinState686.rid===draft.receiver.rid&&firstPinState686.fingerprint===draft.receiver.deviceFingerprint;
    function rememberFirstPin686(answer,phase,handoff='manual'){
      if(!firstPinAPI?.validSSID(answer?.ssid,draft.receiver.type)||firstPinCurrent686()&&answer.ssid!==firstPinState686.ssid)throw Object.assign(Error(),{code:'FIRST_PIN_V2_UNCONFIRMED'});
      if(phase==='rejoin'&&firstPinState686?.phase==='pin')firstPinClaimAt=Date.now(); // net geclaimd: de MAIN herstart zo
      firstPinState686={transactionId:draft.transactionId,receiverId:draft.receiver.id,rid:draft.receiver.rid,fingerprint:draft.receiver.deviceFingerprint,ssid:answer.ssid,phase,handoff:phase==='rejoin'&&handoff==='switching'?'switching':'manual'};
      manualRejoinSSID=phase==='rejoin'?answer.ssid:null;
    }
    // 15 nov: de eigen wifi van deze receiver = ALUVISION-<soort>-<nummer op de QR> (firmware factoryAccessPointName).
    function receiverNetwork(){
      const r=draft?.receiver,ap=r?.apSsid;
      if(typeof ap==='string'&&/^ALUVISION-(SPI|RGBW)-[A-F0-9]{4,12}$/.test(ap))return ap;
      return r&&['SPI','RGBW'].includes(r.type)&&/^[0-9A-F]{12}$/.test(String(r.physicalId||''))?'ALUVISION-'+r.type+'-'+r.physicalId:'';
    }
    function firstPinError686(failure){onthoudKoppelFout(failure?.code);const rejoin=firstPinCurrent686()&&firstPinState686.phase==='rejoin';return firstPinAPI.failure(failure?.code,{rejoin,network:receiverNetwork(),standNetwork:rejoin?firstPinState686.ssid:''});}
    function resumeFirstPin686(){
      if(!firstPinReturn686||!firstPinCurrent686()||firstPinState686.phase!=='rejoin'||!container||document.hidden||busy)return;
      firstPinReturn686=false;void secure(undefined,undefined,{reconcile:true});
    }
    async function claimFirstPin686(){
      if(busy||!container||document.hidden||!firstPinCandidate686()||!firstPinCurrent686()||firstPinState686.phase!=='pin')return;
      const token=++operation,owner=container,controller=new AbortController();actionAbort=controller;busy=true;error='';
      try{
        await persist();if(token!==operation||container!==owner||document.hidden)return;
        await checkpointPairFirst(token);
        // An uncertain native prompt/claim is reconciled, never re-submitted.
        firstPinState686.phase='rejoin';firstPinState686.handoff='preparing';securityUncertain=true;manualRejoinSSID=firstPinState686.ssid;rejoinHelpC231=false;paintPage(false);
        const answer=await services.FirstPinV2.claim({configuration:config(),signal:controller.signal});
        if(token!==operation||container!==owner)return;
        if(answer?.status==='cancelled'){firstPinState686.phase='pin';securityUncertain=false;manualRejoinSSID=null;return;}
        if(answer?.status!=='manual-rejoin')throw Object.assign(Error(),{code:'FIRST_PIN_V2_UNCONFIRMED'});
        // This native result requests an OS wifi handoff, not proof that the
        // new AP is visible. Keep checking explicit and never infer readiness
        // from elapsed time, the SSID label or the handoff illustration.
        if(HERSTART_NA_CLAIM_C272)firstPinClaimAt=Date.now(); // net geclaimd: de MAIN herstart zo (zie herstartNaClaim)
        rememberFirstPin686(answer,'rejoin','switching');
        // C231, alleen de demo: de telefoon staat daar vanzelf op het standnetwerk, dus de controle volgt vanzelf (even later,
        // zodat het beeld "verbinden met je telefoon" te zien is). Een echt toestel controleert zoals voorheen: als de klant
        // terugkomt uit de wifi-instellingen, of op de knop tikt.
        if(rejoinAutoC231())setTimeout(()=>{if(token===operation&&container===owner&&firstPinCurrent686()&&firstPinState686.phase==='rejoin'&&firstPinState686.handoff==='switching'){firstPinReturn686=true;resumeFirstPin686();}},1700);
      }catch(failure){if(token===operation&&container===owner){if(firstPinCurrent686())firstPinState686.handoff='manual';error=firstPinError686(failure);}}
      finally{if(actionAbort===controller)actionAbort=null;if(token===operation){busy=false;keepDraft();paintPage(false);resumeFirstPin686();}}
    }
    async function showFirstPin686(){
      if(busy||!container||document.hidden||!firstPinCurrent686()||firstPinState686.phase!=='rejoin')return;
      const token=++operation,owner=container,controller=new AbortController();actionAbort=controller;busy=true;error='';paintPage(false);
      try{await services.FirstPinV2.show({configuration:config(),signal:controller.signal});}
      catch(failure){if(token===operation&&container===owner)error=firstPinError686(failure);}
      finally{if(actionAbort===controller)actionAbort=null;if(token===operation){busy=false;paintPage(false);resumeFirstPin686();}}
    }
    const freshPairFirst=new Set(),pairFirstCheckpoints=new Set();
    const pairFirstEnabled=()=>pairSPIFirst===true&&typeof onPairFirstBegin==='function';
    const pairFirstCurrent=()=>pairFirstEnabled()&&draft?.receiver?.type==='SPI'&&(freshPairFirst.has(draft.transactionId)||pairFirstCheckpoints.has(draft.transactionId));
    function advancePairFirst(){
      if(!pairFirstEnabled()||!freshPairFirst.has(draft?.transactionId)||draft.receiver?.type!=='SPI'||!['receiver','placement','outputs'].includes(draft.stage))return;
      const result=draftApi.transition(draft,{type:'PAIR_FIRST'});
      // Existing choices and incompatible destinations retain the old route.
      // No receipt, configuration or guard is bypassed by this shortcut.
      if(!result.error){draft=result.draft;keepDraft();}
    }
    async function checkpointPairFirst(token){
      if(!pairFirstEnabled()||draft.receiver?.type!=='SPI'||pairFirstCheckpoints.has(draft.transactionId))return;
      await onPairFirstBegin(draftApi.snapshot(draft));
      if(token!==operation)throw Error('SUSPENDED');
      pairFirstCheckpoints.add(draft.transactionId);
    }
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
      const steps='';   // C219: no step row on the first receiver either
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
    // C214: the scan step of an extra receiver (QR label). state: intro | scanning | finding | connecting | missing | list.
    let labelScan=null,labelAbort=null;
    let firstScan={state:'intro',note:'',wifiHelp:false},firstScanAbort=null;
    // de eigenaar 17 nov: een lege receiver mag alleen gekoppeld worden door de app die zijn QR-code scande. Met de firmware achter
    // ALUVISION_LABEL_ALTIJD weigert ook de eerste receiver (bluetooth/eigen AP) zonder labelbewijs: dan rustig terug naar de
    // scanstap met "Scan de QR-code op deze receiver" (nooit rood). Schakelaar uit tot de firmware het doet.
    const LABEL_ALTIJD=true; // aan in 1067 (firmware C270: ALUVISION_LABEL_ALTIJD)
    const labelCode=failure=>failure?.code==='RECEIVER_LABEL_REQUIRED'||failure?.code==='RECEIVER_LABEL_INVALID';
    // De receivers die in deze koppeling gescand zijn: annuleren (exit) wist hun labelgeheim in de app (labelForget). Gelukt wist native
    // het zelf (finalize, claim); de rondgang gebruikt deze weg niet, dus haar wachtrij met scans blijft.
    const scannedLabels=new Set();
    function noteScanned(answer){if(answer?.status==='scanned'&&typeof answer.physicalId==='string')scannedLabels.add(answer.physicalId);}
    function forgetScannedLabels(){
      if(!LABEL_ALTIJD||typeof services.labelForget!=='function')return;
      for(const physicalId of scannedLabels)void Promise.resolve(services.labelForget({physicalId})).catch(()=>{});
      scannedLabels.clear();
    }
    function firstLabelScan(){
      firstScanAbort?.abort();firstScanAbort=null;firstScan={state:'intro',note:'label',wifiHelp:false};results=[];searchState='idle';error='';
    }
    // 15 nov: de eerste receiver werd via bluetooth gevonden (scanFirstReceiver gaf via:'bluetooth'). Dan loopt alles tot het einde van
    // de setup over bluetooth naar die receiver (native): na de PIN geen wifi-wissel, de controle volgt vanzelf.
    let bluetoothFirst=false;
    // 16 nov (de eigenaar): begon de nieuwe stand in Flutter (4 bolletjes), dan komt het oude menu "Je stand instellen" 1-2-3 nooit terug
    let flutterStart=false;
    // Nakijkronde 17 nov § 1.3: een geparkeerde claim van een vorige poging (een andere stand) blokkeert deze receiver
    // (V30_BINDING_INVALID / V30_CREDENTIAL_IMMUTABLE): dan staat "Opnieuw beginnen" ook op de zoek- en scanstap.
    let bindingBlockedA7=false;
    const visualEntrances=new Map(),presentedStages=new Set(),plugMotion=visual.createPlugMotion();
    let selectedOutput=null,unbindPixelScrub=null,unbindDirectionTutorial=null,openZonePickerOnNextPaint=false,receiverZoneSelection;
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
    function firstStandSetup587(){return origin==='stand'&&!receiverMove&&!draft.mainReceiverId&&(draft.stage==='stand'||draft.stand?.isNew===true);}
    function canOfferReceiversLater590(){
      // Only a names-only first stand. A read-only search may be cancelled;
      // selected/uncertain receivers, identification and private intents cannot.
      const base=getModel();
      return !document.hidden&&firstStandSetup587()&&draft.stage==='receiver'&&allowLocalConcept()===true&&typeof onContinueLocalConcept==='function'&&
        !firstAccess&&!busy&&!draftSaving&&!pendingChoices&&!localConceptPending&&!managementBusy&&!saveFailed&&!parking&&!parkPending&&!resumeSelection&&!exiting&&
        !zoneNameOpen&&!zoneRemoval&&!zoneRename&&!receiverMove&&!actionAbort&&!securityReceiptRef&&!finalReceiptRef&&!securityUncertain&&!finalizationStarted&&!registrationPending&&!rejoinRunning&&!automaticFinalizing&&
        identifyPending.size===0&&identifying.size===0&&parkedChoices.size===0&&parkedTransactions.size===0&&
        base?.demo===false&&['stands','receivers','scenes','presets'].every(key=>Array.isArray(base[key])&&base[key].length===0)&&
        draft.role==='main'&&draft.mainReceiverId===null&&draft.stand?.isNew===true&&draft.receiver===null&&draft.outputs.length===0&&draft.port===null&&draft.zoneId===null&&
        !draft.cancelled&&draft.membership==='pending'&&draft.security.status==='not-started'&&draft.security.phase==='idle'&&
        ['standIds','zoneIds','receivers'].every(key=>draft.context[key].length===0)&&typeof services.persistDraft==='function'&&typeof services.parkDraft==='function';
    }
    function receiversLaterMarkup590(){return canOfferReceiversLater590()?`<div class="onboarding-later-action">${button('receivers-later',tx('Receivers later toevoegen'),'class="button secondary full"')}</div>`:'';}
    async function continueReceiversLater590(){
      if(!canOfferReceiversLater590())return;
      // Keep the existing local-concept admission restricted to stand/zones.
      // Normal BACK is saved through the same immutable draft/CAS path first.
      cancelSearch();const owner=container,token=operation;
      if(!(await saveChoices([{type:'BACK'}],()=>{},{top:false})))return;
      if(document.hidden||container!==owner||operation!==token||draft.stage!=='zones'||!canContinueLocalConcept())return;
      try{await onContinueLocalConcept();}
      catch(_){if(container===owner&&operation===token){notice=tx('Bewaren is nog niet bevestigd. Je namen blijven staan. Probeer opnieuw.');refreshNotice();}}
    }
    function standSetupProgress587(){
      if(!firstStandSetup587()||flutterStart)return '';
      const current=draft.stage==='stand'?0:draft.stage==='zones'?1:2,done=draft.stage==='done';
      return `<ol class="v50-welcome-steps onboarding-stand-steps" data-stand-progress="587" aria-label="${escape(tx('Je stand instellen'))}">${[tx('Standnaam'),tx('Zones'),tx('Receivers')].map((label,i)=>`<li class="${done||i<current?'completed':''}" aria-label="${escape(label)}${done||i<current?' · '+escape(tx('Klaar')):''}" ${!done&&i===current?'aria-current="step"':''}><b aria-hidden="true">${i+1}</b><span>${escape(label)}</span></li>`).join('')}</ol>`;
    }
    async function continueLocalConcept(){
      if(!canContinueLocalConcept())throw Object.assign(Error(),{code:'LOCAL_CONCEPT_BLOCKED'});
      const retained=draft,owner=container,token=operation,base=canonical(getModel()),choices=canonical(draft);
      let next=window.LightningModel.localStand(retained.stand.id,retained.stand.name);
      for(const zone of retained.zones)next=window.LightningModel.createZone(next,retained.stand.id,{id:zone.id,name:zone.name});
      localConceptPending=true;
      const current=()=>!document.hidden&&container===owner&&draft===retained&&canonical(draft)===choices&&operation===token&&canonical(getModel())===base&&localConceptEligible();
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
    async function parkForSearch({persistSearch=true,expiredEditorExit=false}={}){
      if(parking)return parking;
      const saved=parkPending||(draft?.receiver&&draft.stage!=='done'?draft:null);
      if(!saved)return true;
      parkPending=saved;searchOnMount=true;cancelSearch();actionAbort?.abort();actionAbort=null;stopAutomaticRejoin();
      if(draft?.receiver||draft?.transactionId===saved.transactionId)draft=searchDraft(saved);
      results=[];searchState='idle';error='';notice='';draftSaving=true;
      securityReceiptRef=null;finalReceiptRef=null;securityUncertain=false;finalizationStarted=false;resumeSelection=null;manualRejoinSSID=null;
      parking=(async()=>{
        try{
          if(!expiredEditorExit&&(await pixelPreview.stop())?.stopped!==true)throw Error('PIXEL_STOP_UNCONFIRMED');
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
    let suspendedReadOnlySearchC101=null;
    function readOnlySearchScopeC101(){
      return !firstAccess&&!busy&&!draftSaving&&!pendingChoices&&!managementBusy&&!exiting&&
        !parking&&!parkPending&&!resumeSelection&&!actionAbort&&!securityReceiptRef&&!finalReceiptRef&&
        !securityUncertain&&!finalizationStarted&&!registrationPending&&!rejoinRunning&&!automaticFinalizing&&
        !previewStopJob&&!previewReconcile579&&!localExitPreviewCleanup&&previewState.kind==='idle'&&
        identifyPending.size===0&&identifying.size===0&&parkedChoices.size===0&&parkedTransactions.size===0&&
        !!draft&&savedStand()&&draft.zones.every(zone=>zone.isNew===false)&&draft.stage==='receiver'&&draft.receiver===null&&draft.outputs.length===0&&draft.port===null&&
        draft.zoneId===null&&!draft.cancelled&&draft.membership==='pending'&&
        draft.security.status==='not-started'&&draft.security.phase==='idle';
    }
    function canLeaveReadOnlySearchC101(){return !!container&&readOnlySearchScopeC101();}
    function readOnlySearchSuspended(){return !container&&draft===suspendedReadOnlySearchC101&&readOnlySearchScopeC101();}
    function resumeReadOnlySearchC101(){
      if(!suspendedReadOnlySearchC101)return true;
      if(draft!==suspendedReadOnlySearchC101||!readOnlySearchScopeC101()){suspendedReadOnlySearchC101=null;return true;}
      results=[];searchState='idle';
      try{
        const model=getModel(),stand=model.stands.find(item=>item.id===draft.stand.id);
        if(!stand){error='Deze stand bestaat niet meer. Ga terug en open de actuele stand.';return false;}
        // Keep the stored transaction, never replace a private/native intent.
        // Only a still-existing destination is carried into the current graph.
        const active=draft.activeZoneId,valid=active===null||stand.zones.some(zone=>zone.id===active);
        let next=draftApi.create({model,standId:stand.id,activeZoneId:valid?active:null,transactionId:draft.transactionId});
        if(!valid||draft.zoneChoiceRequired===true)next=draftApi.snapshot({...next,zoneChoiceRequired:true});
        draft=next;suspendedReadOnlySearchC101=null;results=[];searchState='idle';error='';return true;
      }catch(_){error='De actuele stand kon nog niet worden geladen. Je kunt teruggaan en opnieuw openen.';return false;}
    }
    function leaveReadOnlySearchC101(returnToStand){
      if(!canLeaveReadOnlySearchC101())return false;
      // Browsing has no receiver write to finish. Invalidate its read before
      // detaching the screen; preserve the exact local/native draft for later.
      // Neither a failed park nor an unavailable store may trap this page.
      const retained=draft;cancelSearch();localExitPreviewCleanup=true;
      try{suspend({discard:true});}finally{localExitPreviewCleanup=false;}
      draft=retained;suspendedReadOnlySearchC101=retained;onExit(returnToStand?{stand:true}:undefined);
      // C105: an empty search draft (no receiver, no security, no outputs) is
      // parked in the background. A lingering native draft blocked every
      // ledline identification (order step, pixels) and reopened this search
      // at each start. The page itself never waits for this cleanup.
      if(retained&&retained.stage==='receiver'&&retained.receiver===null&&retained.security?.status==='not-started'&&
         retained.security.phase==='idle'&&Array.isArray(retained.outputs)&&retained.outputs.length===0&&retained.port===null&&
         typeof services.parkDraft==='function')
        void Promise.resolve().then(()=>services.parkDraft({transactionId:retained.transactionId})).then(()=>{
          // Same as the ordinary closed-search exit: the next start begins fresh.
          if(suspendedReadOnlySearchC101===retained)suspendedReadOnlySearchC101=null;
          if(draft===retained&&!container)draft=null;
        }).catch(()=>{});
      return true;
    }
    async function parkForExit({expiredEditorExit=false}={}){
      if(parking&&!(await parking))return false;
      // A selected receiver is kept privately with its exact transaction.
      // Unlike browsing another receiver, leaving needs no new active search.
      if(parkPending||draft?.receiver&&draft.stage!=='done')return parkForSearch({persistSearch:false,expiredEditorExit});
      if(savedStand()&&draft.stage==='receiver'&&draft.receiver===null&&
          draft.security.status==='not-started'&&draft.security.phase==='idle'&&
          draft.outputs.length===0&&draft.port===null&&typeof services.parkDraft==='function'){
        try{await services.parkDraft({transactionId:draft.transactionId});}
        catch(_){error='De toevoeging kon nog niet worden afgesloten. Probeer opnieuw. Je receivers en keuzes blijven bewaard.';paintPage(false);return false;}
      }
      return true;
    }
    async function browseReceivers(){
      // Flutter (KoppelStap, "← Terug naar zoeken" op de PIN-kaart): niet de oude zoeklijst maar de scanstap, die Flutter zelf toont
      // (app.js setupOp list zet de vlag; doorlichting 17 nov: nooit de oude interface)
      const scanInFlutter=window.__koppelZoekFlutterA1===true;window.__koppelZoekFlutterA1=false;
      if(await parkForSearch()){if(scanInFlutter){results=[];searchState='idle';paintPage(true);return;}paintPage(true);if(container)void search();}
    }
    let previewState={kind:'idle'},previewStopJob=null,localExitPreviewCleanup=false,localCleanup579=null,previewReconcile579=null;
    function previewReconcileCurrent579(){const r=previewReconcile579;return !!r&&!document.hidden&&container===r.container&&container?.ownerDocument===document&&draft===r.draft&&operation===r.operation&&canonical(draft)===r.choices&&canonical(getModel())===r.model;}
    function previewReconcileCopy579(){const copies={nl:['Je keuzes zijn bewaard. Stoppen van het testlicht is nog niet bevestigd. Open de pagina opnieuw.','Opnieuw openen'],en:['Your choices are saved. Stopping the test light is not confirmed. Reopen the page.','Reopen'],fr:['Vos choix sont enregistrés. L’arrêt de la lumière de test n’est pas confirmé. Rouvrez la page.','Rouvrir'],de:['Deine Auswahl ist gespeichert. Das Stoppen des Testlichts ist nicht bestätigt. Öffne die Seite erneut.','Erneut öffnen']};return copies[document.documentElement.lang.split('-')[0]]||copies.nl;}
    function atomicExitEligible579(){return services.atomicPreviewExit579===true&&typeof services.checkpointPreviewExit==='function'&&
      !!draft&&draft.receiver?.type==='SPI'&&draft.role==='node'&&draft.stand?.isNew===false&&
      ['outputs','pixels','connection'].includes(draft.stage)&&draft.membership==='pending'&&!draft.cancelled&&
      draft.security?.status==='not-started'&&draft.security.phase==='idle';}
    function mainFingerprint579(value){return getModel()?.receivers?.find(receiver=>receiver.id===value.mainReceiverId&&receiver.role==='main')?.deviceFingerprint;}
    function previewScope579(request,job){return job.container?.ownerDocument===document&&job.mainFingerprint===mainFingerprint579(job.draft)&&request.action==='stop'&&request.standId===job.draft.stand.id&&request.transactionId===job.draft.transactionId&&
      request.receiver.id===job.draft.receiver.id&&request.receiver.rid===job.draft.receiver.rid&&request.receiver.deviceFingerprint===job.draft.receiver.deviceFingerprint&&request.role===job.draft.role&&request.mainReceiverId===job.draft.mainReceiverId;}
    function renderCleanup579(status){
      if(localCleanup579!==status||!status.node?.isConnected)return;
      const copies={nl:['Testlicht stoppen wordt nog gecontroleerd…','Testlicht gestopt.','Stop niet bevestigd. Je keuzes zijn bewaard.'],en:['Stopping the test light is still being checked…','Test light stopped.','Stop not confirmed. Your choices are saved.'],fr:['L’arrêt de la lumière de test est encore vérifié…','Lumière de test arrêtée.','Arrêt non confirmé. Vos choix sont enregistrés.'],de:['Das Stoppen des Testlichts wird noch geprüft…','Testlicht gestoppt.','Stopp nicht bestätigt. Deine Auswahl ist gespeichert.']};
      const copy=copies[document.documentElement.lang.split('-')[0]]||copies.nl;status.node.textContent=copy[status.kind==='pending'?0:status.kind==='confirmed'?1:2];status.node.dataset.previewCleanupState=status.kind;
    }
    function settleCleanup579(job){const status=localCleanup579;if(!status||status.job!==job)return;clearTimeout(status.timer);status.kind=job.stopConfirmed===true&&!job.failed?'confirmed':'unconfirmed';renderCleanup579(status);}
    function cleanupPending579(job){
      localCleanup579?.node?.remove();clearTimeout(localCleanup579?.timer);
      const status={job,kind:'pending',node:null,timer:null};localCleanup579=status;
      status.timer=setTimeout(()=>{if(localCleanup579===status&&status.kind==='pending'){status.kind='unconfirmed';renderCleanup579(status);}},45000);return status;
    }
    function mountCleanup579(status){if(localCleanup579!==status)return;const node=document.createElement('p');node.setAttribute('role','status');node.dataset.previewCleanup579='';node.style.cssText='margin:8px 12px;padding:10px 12px;border-radius:12px;background:#eef1f5;color:#39424e;font-size:14px';if(status.job.container?.isConnected){status.job.container.appendChild(node);status.node=node;renderCleanup579(status);}}
    function publishedPixelDraft686(){return !!draft?.receiver&&getModel().receivers.some(receiver=>receiver.lifecycle==='added'&&receiver.type==='SPI'&&receiver.standId===draft.stand.id&&receiver.role===draft.role&&receiver.onboardingTransactionId===draft.transactionId&&['id','rid','deviceFingerprint'].every(key=>receiver[key]===draft.receiver[key]));}
    const pixelPreview=pixelSetup.createLivePreview({send:typeof services.previewPixels==='function'?async request=>{const job=previewStopJob||localCleanup579?.job,owned=job&&previewScope579(request,job);try{const answer=await services.previewPixels(request);if(owned&&previewScope579(request,job))job.stopConfirmed=answer?.applied===true&&answer.previewTTLMS===0;return answer;}catch(error){if(owned)job.failed=true;throw error;}}:undefined,editorIsolation:()=>services.previewCapabilities?.editorIsolation===true&&publishedPixelDraft686(),onState:state=>{previewState=state;pixelSetup.showPreviewStatus(container,state);}});
    function syncPixelPreview({commit=false}={}){
      if(busy&&['outputs','pixels','connection'].includes(draft?.stage))return;
      if(!container||document.hidden||!['outputs','pixels','connection'].includes(draft?.stage)){if(!localExitPreviewCleanup)void pixelPreview.stop();return;}
      const selected=draft.outputs.find(output=>output.port===draft.port);
      const request=pixelSetup.guideRequest({context:{standId:draft.stand.id,transactionId:draft.transactionId,
        receiver:{id:draft.receiver.id,rid:draft.receiver.rid,type:'SPI',deviceFingerprint:draft.receiver.deviceFingerprint},
        role:draft.role,mainReceiverId:draft.mainReceiverId},outputs:draft.outputs,output:selected,stage:draft.stage,capabilities:services.previewCapabilities||{}});
      if(!request){if(!localExitPreviewCleanup)void pixelPreview.stop();return;}
      localExitPreviewCleanup=false;localCleanup579?.node?.remove();clearTimeout(localCleanup579?.timer);localCleanup579=null;
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
    const savedStand=()=>!!draft?.stand&&!draft.stand.isNew;
    const destinationAvailable=()=>results.length>0||savedStand()||!!draft?.mainReceiverId||firstScanFront();
    const config=()=>draftApi.configuration(draft);
    const persist=()=>typeof services.persistDraft==='function'&&draft&&draft.stage!=='done'?services.persistDraft({draft:draftApi.snapshot(draft)}):Promise.resolve();
    function refreshNotice(){
      const region=container?.querySelector('.onboarding-notice');
      if(region){region.hidden=!notice&&!draftSaving;region.textContent=draftSaving?tx('Je keuzes bewaren…'):tx(notice);}
      if(previewReconcile579&&!previewReconcileCurrent579())previewReconcile579=null;
      if(region&&previewReconcileCurrent579()){
        const copy=previewReconcileCopy579();region.hidden=false;region.textContent=copy[0]+' ';
        const button=document.createElement('button');button.type='button';button.className='button secondary';button.dataset.onboardingAction='preview-reopen';button.textContent=copy[1];region.appendChild(button);
        container.querySelector('[data-onboarding-action="exit"]')?.setAttribute('disabled','');
      }
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
        if(pendingChoices&&saveFailed&&['receiver','outputs'].includes(draft.stage)){
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
      // § 2.5: een nieuwe stand die onder Flutter begon, gaat na een herstart verder zonder de oude kop en stappenbalk 1-2-3
      if(typeof onFlutterRestart==='function'&&saved.stand?.isNew===true&&!saved.mainReceiverId)flutterStart=true;
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
      let result=draftApi.transition(draft,event);
      // Keep the existing strict draft/security transitions. Only suppress the
      // old one-port direction page; directions follow normal add publication
      // in a separate, zone-wide editor. No extra claim or final receipt.
      if(jointSPIDirections&&!result.error&&result.draft.stage==='connection'&&
         (event.type==='NEXT'&&draft.stage==='pixels'||event.type==='BACK'&&['pixels','pin'].includes(draft.stage)))result=draftApi.transition(result.draft,event);
      if(result.error){error=result.error.message||'Controleer je keuze.';if(render)paintPage(false);return false;}
      draft=result.draft;error='';if(event.type!=='SECURITY_PROGRESS')keepDraft();if(render)paintPage(top);return true;
    }
    function start({activeZoneId,retargetZone=false}={}){
      doneSheetSeenC216=null;
      // C214: a new visit starts with the scan step again; a scan or pick that is still running keeps its state.
      if(labelScan&&!['scanning','finding'].includes(labelScan.state)&&!labelScan.picking)labelScan=null;
      if(firstAccess||!resumeReadOnlySearchC101())return;
      if(!draft||draft.stage==='done'){
        draft=draftApi.create({model:getModel(),activeZoneId,transactionId:'onboarding-'+uniqueId()});
        // A named, saved stand can add its first receiver without restarting
        // the stand wizard. The shared destination picker also creates zones.
        if(savedStand()&&draft.stage==='zones')draft=draftApi.transition(draft,{type:'SKIP_ZONES'}).draft;
        results=[];searchState='idle';securityReceiptRef=null;finalReceiptRef=null;completeModel=null;
        securityUncertain=false;finalizationStarted=false;manualRejoinSSID=null;resumeSelection=null;error='';notice='';zoneNameOpen=false;autoFinishC231=false;finishSuspendedC231=false;rejoinHelpC231=false;
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
    const transientRejoin=failure=>['DISCOVERY_UNAVAILABLE','MAIN_MANUAL_WIFI_REQUIRED','MAIN_CONNECTION_UNAVAILABLE','NATIVE_TIMEOUT','TIMEOUT','NATIVE_BUSY','MAIN_BUSY','MAIN_REGISTRATION_UNCONFIRMED','MAIN_RECOVERY_UNAVAILABLE','WIFI_OS_PERMISSION_REQUIRED'].includes(failure?.code); // C137aw: after the OS Wi-Fi permission the join continues by itself
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
      if(outcome==='retry'&&pendingMain()&&(rejoinAttempts<3||Date.now()-firstPinClaimAt<stilNaClaimMs())){
        // Wachttijden na een herstart (REJOIN_PLAFOND_C276, uit): de pauze groeide zonder plafond (1,5 s × poging); met de
        // schakelaar hoogstens 2 s, de receivers zijn nu na 2–4 s terug. Uit = zoals nu.
        rejoinTimer=setTimeout(()=>void automaticRejoin(session),REJOIN_PLAFOND_C276?Math.min(rejoinAttempts*1500,2000):rejoinAttempts*1500);paintPage(false);return;
      }
      rejoinRunning=false;
      if(outcome==='retry'){
        rejoinExhausted=true;
        error=registrationPending?'Je receiver is nog bezig. Laat hem aan; je PIN en keuzes blijven bewaard.':firstPinState686?.ssid?tx('Je receiver is nog niet bereikbaar. Kies het wifi-netwerk “{name}” in Instellingen → Wifi, met je gekozen PIN. Terug in de app gaan we automatisch verder.',{name:firstPinState686.ssid}):'Je receiver is nog niet bereikbaar. Kies zijn ALUVISION-netwerk in Instellingen → Wifi, met je gekozen PIN. Terug in de app gaan we automatisch verder.'; // C137aw
      }else if(outcome==='stop'&&draft.stage==='security')rejoinBlocked=true;
      paintPage(false);
    }
    function visibilityChanged(){
      if(document.hidden&&firstPinCurrent686()&&firstPinState686.phase==='rejoin')firstPinReturn686=true;
      if(document.hidden){firstPinEarly686.used=false;firstPinEarly686.wait=false;clearTimeout(firstPinEarly686.timer);}
      if(document.hidden&&firstAccess){
        container?.querySelectorAll('[data-first-stand-code],[data-first-stand-code-confirm]').forEach(field=>{field.value='';});
        if(firstAccess.phase==='reconnect'||firstAccessJob?.kind==='set-code')firstAccessReturnPending=true;
        if(busy&&!['done','reconnect'].includes(firstAccess.phase))firstAccess.phase='checking';
      }
      syncPixelPreview();
      if(document.hidden){if(pendingMain())returningFromWifi=true;stopAutomaticRejoin();}
      else {resumeFinishC231(); /* C231: eerst het gepauzeerde afronden; de controles hieronder wachten dan (busy) */resumeFirstPin686();resumeFirstAccessAfterWifiReturn();if(returningFromWifi)resumeAfterWifiReturn();queueJointDirections();}
    }
    // 20 nov (./alu android-rook, c98.log): na een vraag van Android (bluetooth-, cameratoestemming) wordt de app weer actief (nativeActive) en
    // zocht deze controle via wifi, terwijl de klant op de QR-scanstap van de eerste receiver stond: even "zoeken" in beeld, dan
    // NATIVE_FAIL discover NATIVE_UNCONFIRMED en terug. Die controle hoort bij de wifi-weg (terug uit Instellingen → Wifi). Op de
    // QR-scanstap (bluetooth) dus niet, tenzij de klant zelf de wifi-reserve opende ("Scannen lukt niet?", firstScan.wifiHelp).
    const GEEN_WIFIPROBE_BIJ_QR_C272=true;
    const qrScanstap=()=>firstScanReady()&&draft?.role==='main'&&!draft.mainReceiverId&&firstScan.wifiHelp!==true;
    function probeAfterWifiReturn(){
      if(GEEN_WIFIPROBE_BIJ_QR_C272&&qrScanstap()){try{window.__c98log?.('KOPPEL wifi-controle overgeslagen (QR-scanstap)');}catch(_){}return;}
      const guide=window.LightningSetupWifiGuide;
      if(guide?.canProbe({mounted:!!container,hidden:document.hidden,manualWifi:manualWifi(),stage:draft?.stage,busy,
        saving:draftSaving,pending:!!pendingChoices,firstAccess:!!firstAccess,searching:searchState==='searching',identifying:!!(identifyPending.size||identifying.size)}))void search();
    }
    function nativeActive(){retryEarlyFirstPin686();resumeFirstPin686();resumeFirstAccessAfterWifiReturn();resumeAfterWifiReturn();probeAfterWifiReturn();queueJointDirections();}
    function pageShown(event){resumeFinishC231();resumeFirstPin686();if(event.persisted||returningFromWifi||firstAccessReturnPending){resumeFirstAccessAfterWifiReturn();resumeAfterWifiReturn();probeAfterWifiReturn();}queueJointDirections();}
    function mount(element,options){
      if(!container)pixelPreview.retireExpiredEditor();
      // A confirmed central publication may redraw this same page before
      // finish() returns. Keep its completion screen; only a genuine new
      // entry (after suspend) or the explicit Another action starts again.
      if(options?.preservePresentation===true&&draft?.stage==='receiver'&&container?.querySelector('[data-onboarding-zone-dialog]')?.open===true)openZonePickerOnNextPaint=true;
      if(!firstAccess&&(!container||draft?.stage!=='done'))start({...options,retargetZone:options?.origin==='layout'&&!container});
      unbindPixelScrub?.();unbindPixelScrub=null;
      unbindDirectionTutorial?.();unbindDirectionTutorial=null;
      if(container){container.removeEventListener('click',click);container.removeEventListener('input',input);container.removeEventListener('change',input);container.removeEventListener('keydown',keydown);container.removeEventListener('keyup',commitPixelKey);}
      // The saved stand, not the presence of a MAIN receiver, determines
      // whether this is a new setup. Single-user/legacy stands may not have a
      // mainReceiverId but must still stay in the receiver-management route.
      origin=['receivers','layout'].includes(options?.origin)&&draft.stand&&!draft.stand.isNew?options.origin:'stand';container=element;
      container.addEventListener('click',click);container.addEventListener('input',input);container.addEventListener('change',input);container.addEventListener('keydown',keydown);container.addEventListener('keyup',commitPixelKey);
      unbindPixelScrub=pixelSetup.bindPixelScrub(container,{isEnabled:()=>draft?.stage==='pixels'&&!busy&&!draftSaving,onChange:value=>updatePixelCount(value,null,{haptic:false}),onCommit:()=>void pixelPreview.flush()});
      document.addEventListener('visibilitychange',visibilityChanged);window.addEventListener('lightning:native-active',nativeActive);window.addEventListener('pageshow',pageShown);window.addEventListener('resize',pairResized);
      if(!firstAccess&&(parkPending||parking)){void parkForSearch().then(ok=>{if(ok&&container)void search();});}
      else if(!firstAccess&&(options?.autoSearch||searchOnMount)&&draft.stage==='receiver'&&searchState==='idle')queueMicrotask(()=>{if(container&&draft.stage==='receiver'&&!busy&&searchState==='idle')void search();});
      paintPage(false);
      diagnoseFirstAccessOnce();
    }
    function suspend({discard=false}={}){
      labelAbort?.abort();labelAbort=null;labelScan=null;pairShown={on:false,step:'',type:''};
      firstScanAbort?.abort();firstScanAbort=null;firstScan={state:'intro',note:'',wifiHelp:false};window.LightningReceiverScanTutorial?.close();
      if(previewStopJob){const job=previewStopJob;previewStopJob=null;job.restore();busy=false;}
      if(!localExitPreviewCleanup)void pixelPreview.stop();
      pixelPreview.retireExpiredEditor();
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
      unbindDirectionTutorial?.();unbindDirectionTutorial=null;
      if(container){container.removeEventListener('click',click);container.removeEventListener('input',input);container.removeEventListener('change',input);container.removeEventListener('keydown',keydown);container.removeEventListener('keyup',commitPixelKey);}
      document.removeEventListener('visibilitychange',visibilityChanged);window.removeEventListener('lightning:native-active',nativeActive);window.removeEventListener('pageshow',pageShown);window.removeEventListener('resize',pairResized);stopAutomaticRejoin();returningFromWifi=false;
      container=null;firstAccessReturnPending=false;cancelSearch();plugMotion.clear();selectedOutput=null;zoneListReturn=null;
      for(const pending of identifyPending.values())pending.abort();identifyPending.clear();identifyFocusOwner=null;
      for(const id of identifying.keys())stopIdentify(id);
      if(!discard&&!firstAccess&&draft?.receiver&&draft.stage!=='done')void parkForSearch();
    }
    function reset(){
      suspend({discard:true});draft=null;firstAccess=null;flutterStart=false;results=[];receiverFilter='all';securityReceiptRef=null;finalReceiptRef=null;
      parkPending=null;searchOnMount=false;parkedChoices.clear();parkedTransactions.clear();
      securityUncertain=false;finalizationStarted=false;completeModel=null;pendingChoices=null;
      resumeSelection=null;manualRejoinSSID=null;firstPinState686=null;firstPinReturn686=false;error='';notice='';busy=false;
    }
    function receiverSetupProgress(){
      // C218/C219 (12 Nov, user: "Ja, weg ermee" / "Ja, ook weg"): no step bar when adding a receiver, neither for
      // an extra receiver nor for the first receiver of a stand; the title says where you are.
      return '';
    }
    function heading(){
      // C214: the scan step is over once the flow moved on; a later visit starts with the scan again.
      if(labelScan&&!labelScan.picking&&draft.stage!=='receiver')labelScan=null;
      const firstSetup=firstStandSetup587();
      const connectionCardStage=draft.stage==='security'||draft.stage==='pin'&&!pinRequired()||draft.stage==='review'&&!pinRequired()&&automaticFinalizing&&busy;
      const title=draft.stage==='done'&&jointSPIDirections&&draft.receiver?.type==='SPI'&&draft.zoneId?window.LightningPixelTranslations.t('pixelDirectionsSettings',document.documentElement.lang):draft.stage==='stand'?tx('Hoe heet je stand?'):draft.stage==='zones'?(zoneRemoval?tx('Zones beheren'):zoneRename?tx('Zone hernoemen'):receiverMove?tx('Ledline verplaatsen'):tx('Je zones')):draft.stage==='receiver'?(receiverMove?tx('Ledline verplaatsen'):labelTitle()?tx(labelTitle()):busy?tx('Receiver controleren'):searchState==='searching'?tx('Receiver zoeken…'):results.length===1?tx('Receiver gevonden'):results.length>1?tx('Kies je receiver'):firstScanFront()?tx('Scan je eerste receiver'):tx('Receiver zoeken')):automaticMain()&&draft.stage==='security'?(busy||rejoinRunning?tx('Je receiver toevoegen'):tx('Verbind opnieuw met wifi')):automaticMain()&&automaticFinalizing&&draft.stage==='review'?tx('Je receiver toevoegen'):draft.stage==='review'&&!pinRequired()&&automaticFinalizing&&busy?tx('Je receiver toevoegen'):labels[draft.stage]||tx('Receiver toevoegen');
      const receiverContext=draft.receiver&&!connectionCardStage&&!['receiver','done'].includes(draft.stage)?`<p class="onboarding-receiver-context"><b>${escape(draft.receiver.name||tx('Receiver'))}</b><span>${escape(draft.receiver.type)}</span></p>`:'';
      const returnToStand=savedStand()&&draft.stage!=='done';
      const closeLabel=origin==='layout'?tx('Terug naar ledlines'):draft.stage==='receiver'&&draft.receiver===null?tx('Receivers later toevoegen'):tx('Naar mijn stand');
      const gateC215=draft.stage==='receiver'?labelGate():null,tidyC215=flutterStart||!firstSetup&&(draft.stage==='done'||!!gateC215&&gateC215.state!=='list');
      return `${tidyC215&&!returnToStand?'':`<header class="onboarding-setup-header${tidyC215?' is-tidy':''}"><div>${tidyC215?'':`<span class="onboarding-setup-label">${firstSetup?tx('Je stand instellen'):tx('Receiver toevoegen')}</span>${draft.stand?.name&&!['stand','zones'].includes(draft.stage)?`<small class="onboarding-stand-context">${escape(draft.stand.name)}</small>`:''}`}</div>${returnToStand?button('exit',closeLabel,`class="button secondary back" ${origin==='layout'?'':'data-return-stand="true"'} ${draftSaving||busy&&!atomicExitEligible579()?'disabled':''}`):''}</header>`}${standSetupProgress587()}${receiverSetupProgress()}<header class="onboarding-heading${draft.stage==='done'&&!(jointSPIDirections&&draft.receiver?.type==='SPI'&&draft.zoneId)?' is-behind-sheet':''}"><h1>${tx(title)}</h1>${receiverContext}</header>${!connectionCardStage&&!['stand','zones','receiver','placement','outputs','done'].includes(draft.stage)?zoneContext():''}`;
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
      return `<p class="onboarding-main-context" data-onboarding-search-via="${escape(main?.type||'main')}">${escape(tx("Zoeken via je stand"))}</p>`;
    }
    // C137aw: a receiver whose own Wi-Fi is already a stand network (not ALUVISION-…) is the MAIN of a stand. In the
    // first-receiver search it is only offered when that network belongs to THIS concept; otherwise it is shown as
    // part of that stand, without an add button (it would take over the other stand).
    function foreignStandC137(receiver){
      const ap=receiver?.apSsid;if(draft.mainReceiverId||typeof ap!=='string'||/^ALUVISION-(SPI|RGBW)-/i.test(ap))return null;
      if(firstPinState686?.ssid===ap)return null;
      const name=String(draft.stand?.name||'').trim().toLowerCase().replace(/\s+/g,' ');
      const own=[receiver.type+' '+name,receiver.type+' hq '+name].map(v=>v.toLowerCase());
      return name&&own.includes(ap.toLowerCase().replace(/\s+/g,' '))?null:ap;
    }
    function standNetworkC137(){
      if(draft.mainReceiverId)return null;
      if(firstPinState686?.ssid)return firstPinState686.ssid;
      const type=resumeSelection?.receiver?.type,name=String(draft.stand?.name||'').trim();
      return type&&name&&!draft.stand?.isNew?type+' '+name:null;
    }
    function receiverAction(receiver){
      const foreign=foreignStandC137(receiver);
      if(foreign)return `<p class="onboarding-compatibility-note" data-foreign-stand-c137>${escape(tx('Deze receiver hoort al bij stand “{name}”. Verbind je telefoon met het wifi van je nieuwe receiver of van je eigen stand.',{name:foreign}))}</p>`;
      const zone=draft.zones.find(item=>item.id===draft.activeZoneId);
      const compatible=zone&&(!zone.type||zone.type===receiver.type);
      const retryIdentity=!!error&&receiver.canConfigure===false&&receiver.canVerifyIdentity===true;
      const label=retryIdentity?tx('Opnieuw controleren'):!pinRequired()&&(receiver.type==='RGBW'||pairFirstEnabled()&&receiver.type==='SPI')?(compatible?escape(tx('Toevoegen aan {name}',{name:zone.name})):!zone?tx('Zonder zone toevoegen'):tx('Kies een passende zone')):escape(tx('Verder met {type}-receiver',{type:receiver.type}));
      return `${zone&&!compatible?`<p class="onboarding-compatibility-note">${escape(tx('{type} past niet in deze zone. Kies een andere zone of voeg hem zonder zone toe.',{type:receiver.type}))}</p>`:''}${button('receiver',busy||identifyPending.size?tx('Even wachten…'):label,`data-id="${escape(receiver.id)}" ${busy||identifyPending.size||draft.zoneChoiceRequired||!(receiver.canConfigure||receiver.canVerifyIdentity)?'disabled':''}`)}`;
    }
    function foundReceiverID(receiver){
      // An observed RID is a recognition aid, not a verified device, saved
      // membership or physical-MAC proof. Never derive it from a local row ID.
      const rid=typeof receiver.rid==='string'?receiver.rid.toUpperCase():'';
      if(!/^[0-9A-F]{16}$/.test(rid))return '';
      const label=escape(tx('Gevonden receiver-ID')+': '+rid);
      return `<small class="onboarding-receiver-id" data-discovered-receiver-id="${rid}" aria-label="${label}" title="${label}"><span aria-hidden="true">ID</span><b aria-hidden="true">${rid.slice(-6)}</b></small>`;
    }
    function receiverIdentity(receiver,{found=false}={}){
      const description=receiver.type==='SPI'?tx('Kleur en animaties per pixel'):tx('Eén kleur over de hele ledline');
      return `<header class="onboarding-receiver-identity"><span class="onboarding-receiver-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="4"/><path d="M7 10v4M11 10v4M15 10v4M19 10v4"/></svg></span><span class="onboarding-receiver-title"><h2>${escape(receiver.name||`${receiver.type}-receiver`)}</h2><small>${description}</small>${found?foundReceiverID(receiver):''}</span><span class="pill">${receiver.type}</span></header>`;
    }
    function foundReceiverCard(receiver){
      const isIdentifying=identifying.has(receiver.id),available=canIdentify(receiver);
      const entranceKey=`found:${draft.transactionId}:${receiver.id}`,entering=!presentedStages.has(entranceKey);presentedStages.add(entranceKey);
      const blinkIcon='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>';
      return `<article class="card onboarding-result is-row${entering?' onboarding-result-enter':''}" data-onboarding-result="${escape(receiver.id)}" data-discovery-status="found" data-result-row><span class="result-row-art" aria-hidden="true">${labelArt(receiver.type,{view:'top',theme:document.body.dataset.theme==='dark'?'dark':'light',scale:.5,shadow:false,led:null,cable:6,power:false})}</span>${receiverIdentity(receiver,{found:true})}<div class="onboarding-actions">${receiverAction(receiver)}</div><div class="onboarding-recognition"><span>${isIdentifying?tx('Dit licht knippert nu.'):tx('Herken jouw verlichting')}</span>${button('identify',`${blinkIcon}<span>${isIdentifying?tx('Stop knipperen'):tx('Laat knipperen')}</span>`,`data-id="${escape(receiver.id)}" class="receiver-blink" aria-pressed="${isIdentifying}" ${busy||identifyPending.has(receiver.id)||!available?'disabled':''}`)}</div>${!available?`<small class="onboarding-identify-unavailable">${draft.role==='main'?tx('Deze receiver kan pas knipperen nadat hij is toegevoegd.'):tx('Deze receiver kan nu niet knipperen. Controleer je verbinding en probeer opnieuw.')}</small>`:''}</article>`;
    }
    function connectingReceiver(){
      return draft.receiver?`<div class="onboarding-connecting-receiver">${product(draft.receiver,{compact:true})}${receiverIdentity(draft.receiver)}</div>`:'';
    }
    // ---------- C214: scan the QR label on an extra receiver ----------
    // An extra receiver is added through the stand. A receiver with a factory label only accepts that after the app
    // has scanned its QR code (the secret part stays in the native app; this page only learns family and address).
    // The first receiver of a stand keeps its own flow (its own Wi-Fi); it never comes here.
    const labelScanReady=()=>{try{return labelScanAvailable()===true&&typeof services.scanReceiverLabel==='function';}catch(_){return false;}};
    function labelGate(){
      if(!draft||draft.stage!=='receiver'||draft.role!=='node'||draft.receiver||receiverMove||firstAccess)return null;
      if(!labelScan)labelScan={state:'intro',scan:null,note:labelScanReady()?'':'unavailable',hint:'',detail:''}; // 15 nov: nooit meer de oude lijst
      // Back on this step after a pick that is no longer running: never stay on "connecting".
      if(labelScan.state==='connecting'&&!labelScan.picking&&!busy)labelScan.state='missing';
      return labelScan;
    }
    // While the scan step is in front no search runs: the camera and a stand search share the phone's radio lock.
    const labelBlocksSearch=()=>{const gate=labelGate();return !!gate&&['intro','scanning','connecting'].includes(gate.state);};
    function labelTitle(){
      const gate=labelGate();if(!gate||gate.state==='list')return '';
      if(gate.state==='finding')return 'Je receiver zoeken';
      if(gate.state==='connecting')return 'Receiver gevonden';
      if(gate.state==='missing')return gate.reason==='family'?'Verkeerde QR-code':gate.problem?'Niet verbonden met je stand':'Je stand hoort hem niet';
      return gate.note==='denied'?'Camera staat uit':gate.note==='required'?'Scan deze receiver':gate.note==='invalid'?'Verkeerde QR-code':'Scan je receiver';
    }
    const labelShortId=scan=>scan?scan.physicalId.slice(-8).replace(/^(.{4})(.{4})$/,'$1-$2'):'';
    // ---------- C226: one full-screen picture from connecting to "toegevoegd" ----------
    // User, 12 Nov: "als een receiver verbonden wordt, deze pagina moet meer visueel zijn, het moet met een animatie
    // duidelijk maken wat er aan het gebeuren is, verbinding" and, for the success moment, "full screen ... iets
    // premiumer ... soort van animatie dat hij zo inzoomt erop ... de splitter moet echt veel beter".
    // receiver-pair-scene.js draws the picture (the receiver from above with its real cables, the phone, the link);
    // this page only says which state it is in. Presentation only: phases, receipts, retries and the pairing itself
    // are unchanged, and no timer invents a success. The page is repainted at every phase: pairShown remembers what
    // the previous paint showed, so the picture enters once and its loops run on.
    let pairShown={on:false,step:'',type:''};
    // A turned or resized screen: the drawing is fitted again, and with it the scan frame on its QR code.
    function pairResized(){if(!container)return;window.LightningReceiverPairScene?.fit(container);labelPlaceFrame();}
    const pairLag=()=>window.LightningReceiverPairScene?.lag()||0,pairStage=type=>window.LightningReceiverPairScene?.stage(type)||'';
    // step: search (zoeken) · pin (de receiver slaat de PIN op) · link (verbinden) · wait (het beeld staat stil: de klant is aan zet).
    // actions: knoppen onder het bijschrift, in hetzelfde beeld (C231).
    function pairBusy({type,known=true,step='link',caption,sub='',actions='',light='blue'}){
      type=type==='RGBW'?'RGBW':'SPI';
      const state=`${!pairShown.on?' is-enter':pairShown.type!==type?' is-swap':''}${pairShown.on&&pairShown.step==='search'&&step!=='search'?' is-found':''}`;
      return `<div class="pair-scene${state}" data-pair-scene data-pair-state="busy" data-pair-step="${step}" data-pair-type="${type}"${known?'':' data-pair-unknown'} style="--pair-lag:${pairLag()}ms">${pairStage(type)}`+
        `<div class="pair-copy" data-pair-copy><div class="pair-say" role="status" aria-live="polite" aria-atomic="true"><b class="pair-cap">${escape(tx(caption))}</b>${sub?`<span class="pair-sub">${escape(sub)}</span>`:''}</div>${light?standLight(light,type):''}${actions?`<div class="pair-actions">${actions}</div>`:''}</div></div>`;
    }
    // C217: the pairing light language as a small ledline icon (from the approved add-receiver prototype).
    // Presentation only: it shows what the receiver's own firmware does in this state; it reads nothing from the receiver.
    // 15 nov (de eigenaar, lichttaal korter; firmware C253): paars is weg (bij de PIN wacht de receiver in blauw), mislukt is
    // rood, en nooit een harde overgang: het lichtje fadet naar een nieuwe toestand (niet bij elke hertekening).
    let lastStandLight='';
    function standLight(state,type){
      const rgbw=type==='RGBW';
      if(state==='purple')state='blue';else if(state==='orange')state='red';
      const say=(rgbw?{white:'Wit, ademend · nog niet gekoppeld',blue:'Blauw, ademend · even geduld',green:'Groene flits · gelukt',red:'Drie rode pulsen · mislukt'}
        :{white:'Wit, golvend · nog niet gekoppeld',blue:'Blauw, stippen lopen weg · even geduld',green:'Groen · gelukt',red:'Rood schudt · mislukt'})[state];
      const key=state+'|'+type,fade=!!lastStandLight&&lastStandLight!==key;lastStandLight=key;
      return `<div class="stl-light${fade?' stl-fade':''}" data-light="${state}" data-kind="${rgbw?'rgbw':'spi'}"><span class="stl-ll" aria-hidden="true"><i class="stl-ll-plug"></i><span class="stl-ll-strip"><i class="stl-ll-bg"></i><i class="stl-ll-fx"></i><i class="stl-ll-burst"><i></i><i></i><i></i></i><i class="stl-ll-shake"></i><i class="stl-ll-rim"></i></span></span><span class="stl-light-txt"><b>${escape(tx('Op je stand'))}</b><small>${escape(tx(say))}</small></span></div>`;
    }
    function labelArt(type,options){
      // title: the drawing names itself "SPI-receiver" unless told otherwise (it showed on an RGBW drawing).
      try{return window.AluvisionReceiverArt?window.AluvisionReceiverArt.svg({type:type==='RGBW'?'rgbw':'spi',theme:'light',outputs:[true,true,true,true],title:`Aluvision ${type==='RGBW'?'RGBW':'SPI'}-receiver`,...options}):'';}catch(_){return '';}
    }
    // C226: the scan picture uses the drawing of the pairing picture (the receiver with its real cables and splitter).
    const scanArt=type=>window.LightningReceiverPairScene?.still(type)||labelArt(type,{view:'top',cable:24,shadow:false,led:null,width:520});
    function labelScanView(gate){
      const zone=draft.zones.find(item=>item.id===draft.activeZoneId),type=gate.scan?.family||zone?.type||'SPI';
      const icon={camera:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.2-1.8h5.4L15.9 6h1.6A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.500 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.4"/></svg>',
        list:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"/></svg>'};
      // 15 nov (de eigenaar: "alle oude elementen weg"): geen "Geen QR-code? Kies uit de lijst" meer; een receiver komt erbij met zijn QR-code
      if(gate.state==='finding'||gate.state==='connecting'){
        return `<div class="label-scan" data-label-scan="${gate.state}">${pairBusy({type,step:gate.state==='finding'?'search':'link',caption:gate.state==='finding'?'Zoeken via je stand…':'Verbinden met je stand…',sub:`${type}-receiver · ${labelShortId(gate.scan)}`})}</div>`;
      }
      if(gate.state==='missing'){
        const wrong=gate.reason==='family';
        return `<div class="label-scan" data-label-scan="missing"><section class="card label-scan-calm"><div class="label-scan-id"><b>${escape(type)}-receiver · ${escape(labelShortId(gate.scan))}</b></div>`+
          // 15 nov: lukte het zoeken niet (bv. niet op de standwifi), dan zegt de stap waarom, zoals de oude lijst deed
          (!wrong&&gate.problem?`<p class="onboarding-error" role="alert">${escape(tx(gate.problem))}</p>`:`<p>${escape(tx(wrong?'De QR-code en de receiver passen niet bij elkaar. Scan de code opnieuw.':'Breng de receiver dichterbij of zet hem aan, en probeer opnieuw.'))}</p>`)+
          `${gate.detail?`<small>${escape(tx(gate.detail))}</small>`:''}</section>`+
          `<div class="onboarding-actions onboarding-footer label-scan-actions">${wrong?'':button('label-retry',escape(tx('Opnieuw zoeken')),busy?'disabled':'')}${button('label-scan',`${icon.camera}<span>${escape(tx('Opnieuw scannen'))}</span>`,`class="button${wrong?'':' secondary'}" ${busy?'disabled':''}`)}</div>${standLight('orange',type)}</div>`;
      }
      const scanning=gate.state==='scanning';
      const say={denied:'Geef Aluvision toegang tot je camera in de instellingen van je toestel.',
        required:'Deze receiver voeg je toe door zijn QR-code te scannen.',
        invalid:'Deze QR-code hoort niet bij deze receiver. Scan de code op de receiver zelf.',
        busy:'Je stand is even bezig. Wacht even en scan opnieuw.',
        unavailable:'Scannen lukt nu niet. Probeer opnieuw.'}[gate.note];
      return `<div class="label-scan" data-label-scan="intro"><p class="label-scan-say">${say?escape(tx(say)):tx('Richt je camera op de <b>QR-code op je receiver</b>.')}</p>`+
        `<div class="label-scan-stage" data-label-stage><div class="label-scan-art" data-label-art>${scanArt(type)}</div><i class="label-scan-frame" data-label-frame aria-hidden="true" hidden><i></i><i></i><i></i><i></i><b class="label-scan-phone"></b></i></div>`+
        `<div class="onboarding-actions onboarding-footer label-scan-actions">${button('label-scan',`${icon.camera}<span>${escape(tx(scanning?'Camera is open…':gate.note==='denied'?'Opnieuw proberen':'Scan de QR-code'))}</span>`,scanning||busy?'disabled':'')}</div>${scanTutorialButton(scanning||busy)}${standLight('white',type)}</div>`;
    }
    // The scan frame sits on the QR code of the drawing; its place is read from the drawing itself.
    function labelPlaceFrame(){
      const stage=container?.querySelector('[data-label-stage]'),frame=stage?.querySelector('[data-label-frame]'),code=stage?.querySelector('svg rect[width="22"][height="22"]');
      if(!stage||!frame||!code)return;
      const box=stage.getBoundingClientRect(),at=code.getBoundingClientRect();if(!box.width||!box.height||!at.width)return;
      const size=at.width*1.9;
      frame.style.left=((at.left+at.width/2-size/2-box.left)/box.width*100).toFixed(2)+'%';frame.style.top=((at.top+at.height/2-size/2-box.top)/box.height*100).toFixed(2)+'%';
      frame.style.width=(size/box.width*100).toFixed(2)+'%';frame.hidden=false;
    }
    async function labelScanRun(){
      const gate=labelGate();if(!gate||!labelScanReady()||gate.state==='scanning'||busy)return;
      const owner=container;cancelSearch();results=[];searchState='idle';
      labelAbort=new AbortController();const signal=labelAbort.signal;gate.state='scanning';gate.note='';gate.hint='';gate.detail='';gate.reason='';error='';notice='';paintPage(false);
      let answer=null,failure=null;
      try{answer=await services.scanReceiverLabel({},signal);noteScanned(answer);}catch(caught){failure=caught;}
      if(labelAbort?.signal===signal)labelAbort=null;
      if(container!==owner||labelScan!==gate||gate.state!=='scanning')return;
      if(failure){
        // CANCELLED: the customer left the app while the camera was open. That is a cancel, without a message.
        gate.state='intro';gate.note=failure?.code==='CANCELLED'?'':failure?.code==='RECEIVER_LABEL_CAMERA_DENIED'?'denied':failure?.code==='RECEIVER_LABEL_SCAN_BUSY'?'busy':'unavailable';
        paintPage(false);return;
      }
      if(answer?.status!=='scanned'||!/^[0-9A-F]{12}$/.test(answer.physicalId||'')||!['SPI','RGBW'].includes(answer.family)){gate.state='intro';paintPage(false);return;}
      gate.scan={family:answer.family,physicalId:answer.physicalId,proof:answer.proof===true};
      return labelFind(gate);
    }
    async function labelFind(gate){
      const owner=container;gate.problem='';gate.state='finding';gate.detail='';gate.reason='';error='';notice='';paintPage(false);
      await search();
      // The search could not start (choices not saved, an action still running): say so calmly, with a way on.
      if(container===owner&&labelScan===gate&&gate.state==='finding'){gate.state='missing';paintPage(false);}
    }
    // Called by search() with fresh results: pick the scanned receiver without showing the list.
    function labelMatch(){
      const gate=labelScan;if(!gate||gate.state!=='finding'||!gate.scan)return;
      const hit=results.find(receiver=>receiver.physicalId===gate.scan.physicalId);
      if(hit){
        if(hit.type!==gate.scan.family){gate.state='missing';gate.reason='family';return;}
        // This receiver cannot be added here: show the found card, which says why.
        if(foreignStandC137(hit)||!(hit.canConfigure||hit.canVerifyIdentity)){gate.state='missing';gate.reason='';gate.detail=foreignStandC137(hit)?'Deze receiver hoort bij een andere stand.':'Deze receiver kan hier nu niet worden toegevoegd.';return;}
        // User, 14 Nov: "als hij het scant wordt automatisch verbonden met de animatie, na scannen moet ik niet nog eens
        // bevestigen". The scan is the choice. A zone of another type (the page opens on the first zone, often the SPI
        // zone of the first receiver) or a zone that is gone no longer sends the customer to the list: the receiver goes
        // to the first zone of its own type, or without a zone (the Receivers tab moves it later).
        const zone=draft.zones.find(item=>item.id===draft.activeZoneId);
        const move=draft.zoneChoiceRequired||(zone?.type&&zone.type!==hit.type);
        const target=move?(draft.zones.find(item=>item.type===hit.type)?.id??null):undefined;
        gate.state='connecting';gate.picking=true;
        queueMicrotask(()=>{void labelPick(gate,hit.id,target);});return;
      }
      // An older app or stand does not report the address of a found receiver: the customer picks it from the list.
      if(results.some(receiver=>receiver.type===gate.scan.family&&!receiver.physicalId)){gate.state='missing';gate.reason='';gate.detail='Werk je receivers bij om ze met de QR-code toe te voegen.';return;}
      gate.state='missing';
    }
    async function labelPick(gate,id,zoneId){
      const owner=container;if(!container||labelScan!==gate||gate.state!=='connecting'){gate.picking=false;return;}
      if(zoneId!==undefined){
        let saved=false;try{saved=await saveChoices([{type:'SELECT_ACTIVE_ZONE',zoneId}],()=>{},{top:false});}catch(_){}
        if(container!==owner||labelScan!==gate||gate.state!=='connecting'){gate.picking=false;return;}
        if(!saved){gate.picking=false;gate.state='missing';paintPage(false);return;}
      }
      const proxy=document.createElement('button');proxy.dataset.onboardingAction='receiver';proxy.dataset.id=id;
      gate.picking=true;
      try{await click({target:proxy});}catch(_){}finally{gate.picking=false;}
      // Still on this step: the add did not go through. The found card shows why, with the usual retry.
      if(container===owner&&labelScan===gate&&gate.state==='connecting'&&draft?.stage==='receiver'&&!busy){gate.state='missing';paintPage(false);}
    }
    // A receiver with a label refused the add: lead to the scan step (or say calmly that this device cannot scan).
    function labelFailure(failure){
      const code=failure?.code;if(code!=='RECEIVER_LABEL_REQUIRED'&&code!=='RECEIVER_LABEL_INVALID')return false;
      const gate=labelGate();
      if(!gate){
        // de eerste receiver (role main): terug naar de scanstap van de eerste receiver
        if(LABEL_ALTIJD&&draft?.role==='main'&&draft.stage==='receiver'&&firstScanReady()){firstLabelScan();return true;}
        return false;
      }
      error='';gate.scan=null;gate.detail='';gate.reason='';
      if(labelScanReady()){gate.state='intro';gate.note=code==='RECEIVER_LABEL_INVALID'?'invalid':'required';gate.hint='';}
      else{gate.state='intro';gate.note='unavailable';gate.hint='';}
      return true;
    }
    // ---------- C222: the first receiver of a stand starts with scanning too ----------
    // User, 12 Nov: "hier moet dan staan scan je eerste receiver - met een knop eronder bekijk tutorial ... verbinding
    // controleren kan er gewoon onder staan". Shown only where the app offers the service (services.scanFirstReceiver):
    // a phone without it keeps the screen it has, so no button ever does nothing. The scan itself (the phone joins the
    // receiver's own Wi-Fi from its QR code) lives in the phone app; this page only hears whether it worked and then
    // checks the connection exactly as "Verbinding controleren" does. Pairing and the PIN are untouched.
    const firstScanReady=()=>typeof services.scanFirstReceiver==='function';
    // C225 (12 Nov, user: "graag ergens bekijk hoe het moet met dan een animatie die de qr code scant"): one name and
    // one place for it on both scan screens, directly under the scan button.
    const scanTutorialButton=disabled=>window.LightningReceiverScanTutorial?button('scan-tutorial',`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5z"/></svg><span>${escape(tx('Bekijk tutorial'))}</span>`,`class="button secondary full label-scan-tutorial" ${disabled?'disabled':''}`):'';
    function scanTutorialOpen(){
      const first=firstScanFront(),zone=draft.zones.find(item=>item.id===draft.activeZoneId);
      window.LightningReceiverScanTutorial?.open({type:labelScan?.scan?.family||zone?.type||'RGBW',onWifiHelp:first?()=>{
        if(!container||!firstScanFront())return;firstScan.wifiHelp=true;paintPage(false);
        container.querySelector('[data-first-scan-wifi]')?.scrollIntoView({block:'nearest',behavior:'smooth'});
      }:null});
    }
    const firstScanFront=()=>firstScanReady()&&!!draft&&draft.stage==='receiver'&&draft.role==='main'&&manualWifi()&&!draft.receiver&&!receiverMove&&!firstAccess&&!results.length&&searchState!=='searching'&&!busy;
    function firstScanView(){
      const scanning=firstScan.state==='scanning',type=draft.zones.find(item=>item.id===draft.activeZoneId)?.type||'RGBW';
      const camera='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.2-1.8h5.4L15.9 6h1.6A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.500 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.4"/></svg>';
      const say={denied:'Geef Aluvision toegang tot je camera in de instellingen van je toestel. Of controleer de verbinding hieronder.',unavailable:'Scannen lukt nu niet. Zet de receiver aan en probeer opnieuw, of controleer de verbinding hieronder.',label:'Scan de QR-code op deze receiver.'}[firstScan.note];
      return `<div class="label-scan first-scan" data-first-scan="${firstScan.state}" data-first-scan-note="${escape(firstScan.note||'')}" data-label-scan="intro"><p class="label-scan-say">${say?escape(tx(say)):tx('Richt je camera op de <b>QR-code op je receiver</b>.')}</p>`+
        `<div class="label-scan-stage" data-label-stage><div class="label-scan-art" data-label-art>${scanArt(type)}</div><i class="label-scan-frame" data-label-frame aria-hidden="true" hidden><i></i><i></i><i></i><i></i><b class="label-scan-phone"></b></i></div>`+
        `<div class="onboarding-actions onboarding-footer label-scan-actions">${button('first-scan',`${camera}<span>${escape(tx(scanning?'Camera is open…':firstScan.note==='denied'?'Opnieuw proberen':'Scan de QR-code'))}</span>`,scanning?'disabled':'')}</div>`+
        `${scanTutorialButton(scanning)}`+
        // Until pairing the first receiver from its QR code is official. Then this reserve goes: the Wi-Fi steps and
        // the button "Verbinding controleren" that belongs to them.
        // C231 (tweede tester-ronde 12 nov, punt 12; de eigenaar bij de drie kaarten: "wat is dat?"): de oude weg (zelf naar
        // de wifi-instellingen) staat niet meer in het gewone pad. Ze verschijnt alleen als reserve: als scannen niet
        // lukte, als een controle mislukte, of als de klant er zelf om vraagt ("Scannen lukt niet?").
        `${firstScan.wifiHelp||say?`<section class="card onboarding-manual-wifi" data-first-scan-wifi aria-label="${escape(tx('Zo verbind je je eerste receiver'))}">${window.LightningSetupWifiGuide.stepsMarkup({standNetwork:standNetworkC137()})}</section>`+
          `${button('search',searchLabel(),`class="button secondary full first-scan-check" ${scanning?'disabled':''}`)}`
          :button('first-scan-help',tx('Scannen lukt niet?'),`class="text-button first-scan-help" ${scanning?'disabled':''}`)}`+
        `${draft.stand?.isNew===true?button('back',tx('← Zones beheren'),`class="text-button first-scan-back" ${scanning?'disabled':''}`):''}</div>`;
    }
    // C223 (12 Nov, user: "dit menu kan er zelfs niet zijn"): with the scan step in front there is no found page in
    // between. The one receiver the phone reaches is the chosen receiver; its zone stood on the scan screen. Only where
    // the customer still has to decide something, or the receiver cannot be added here, the found card shows why.
    // Without the scan service (a real phone today) nothing changes: there the found page still asks for the explicit
    // tap that starts the secure check of this receiver.
    function firstMatch(){
      if(!firstScanReady()||!draft||draft.stage!=='receiver'||draft.role!=='main'||!manualWifi()||draft.receiver||receiverMove||firstAccess||results.length!==1)return;
      const hit=results[0],zone=draft.zones.find(item=>item.id===draft.activeZoneId);
      if(draft.zoneChoiceRequired||(zone?.type&&zone.type!==hit.type)||foreignStandC137(hit)||!(hit.canConfigure||hit.canVerifyIdentity))return;
      const state=firstScan;state.state='connecting';
      queueMicrotask(()=>{void firstPick(state,hit.id);});
    }
    async function firstPick(state,id){
      const owner=container;if(!container||firstScan!==state||state.state!=='connecting')return;
      const proxy=document.createElement('button');proxy.dataset.onboardingAction='receiver';proxy.dataset.id=id;
      try{await click({target:proxy});}catch(_){}
      if(firstScan!==state||state.state!=='connecting')return;
      state.state='intro';
      // Still on this step: the check of this receiver did not go through. Back to the scan screen, with the reason.
      if(container===owner&&draft?.stage==='receiver'&&!draft.receiver&&!busy){results=[];searchState='idle';paintPage(false);}
    }
    function firstConnectingView(){
      const hit=results[0];
      return `<div class="label-scan first-scan" data-first-scan="connecting" data-label-scan="connecting">${pairBusy({type:hit.type,caption:'Verbinden…',sub:hit.name||`${hit.type}-receiver`})}</div>`;
    }
    // C226: while the phone checks for the first receiver the same picture shows it: the phone looks, the receiver is
    // not there yet. A scan told the type; "Verbinding controleren" did not, then only the phone is shown.
    const firstSearchFront=()=>firstScanReady()&&!!draft&&draft.stage==='receiver'&&draft.role==='main'&&manualWifi()&&!draft.receiver&&!receiverMove&&!firstAccess&&!results.length&&searchState==='searching';
    function firstSearchingView(){
      const type=firstScan.family||draft.zones.find(item=>item.id===draft.activeZoneId)?.type||null;
      return `<div class="label-scan first-scan" data-first-scan="searching" data-label-scan="finding">${pairBusy({type:type||'RGBW',known:!!type,step:'search',caption:'Je receiver controleren…'})}</div>`;
    }
    async function firstScanRun(){
      if(!firstScanFront()||firstScan.state==='scanning')return;
      const owner=container,state=firstScan;cancelSearch();searchState='idle';
      firstScanAbort=new AbortController();const signal=firstScanAbort.signal;state.state='scanning';state.note='';error='';notice='';paintPage(false);
      let answer=null,failure=null;
      try{answer=await services.scanFirstReceiver({standId:draft.stand.id},signal);noteScanned(answer);}catch(caught){failure=caught;}
      if(firstScanAbort?.signal===signal)firstScanAbort=null;
      if(container!==owner||firstScan!==state||state.state!=='scanning')return;
      state.state='intro';
      // CANCELLED: the customer left the app while the camera was open. That is a cancel, without a message.
      if(failure){state.note=failure?.code==='CANCELLED'?'':failure?.code==='RECEIVER_LABEL_CAMERA_DENIED'?'denied':'unavailable';paintPage(false);return;}
      paintPage(false);
      if(answer?.status==='scanned'){state.family=['SPI','RGBW'].includes(answer.family)?answer.family:null;if(answer.via==='bluetooth')bluetoothFirst=true;void search();}
    }
    function receiverSearchView(){
      const gate=labelGate();
      if(gate&&gate.state!=='list')return labelScanView(gate);
      if(firstScan.state==='connecting'&&results.length===1&&draft.role==='main'&&!draft.receiver)return firstConnectingView();
      if(firstSearchFront())return firstSearchingView();
      if(firstScanFront())return firstScanView();
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
      const controls=`${draft.stand?.isNew===true?button('back',tx('← Zones beheren'),`class="button secondary" ${busy?'disabled':''}`):''}${found?'':button('search',searchLabel(),searching||busy||identifyPending.size?'disabled':'')}`;
      const labelHint=gate?.hint==='camera'?`<section class="card label-scan-calm" role="status"><b>${escape(tx('Deze receiver moet je scannen'))}</b><p>${escape(tx('Deze receiver voeg je toe door zijn QR-code te scannen. Dat kan niet op dit toestel.'))}</p></section>`:gate?.hint==='scanned'?`<section class="card label-scan-calm" role="status"><p>${escape(tx('QR-code gescand. Kies nu je receiver in de lijst.'))}</p></section>`:'';
      const labelBack=gate&&labelScanReady()?button('label-intro',`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M8 9h3v3H8zM13 13h3v3h-3z"/></svg><span>${escape(tx('Scan de QR-code'))}</span>`,`class="label-scan-link" ${busy||searching||identifyPending.size?'disabled':''}`):'';
      return `${searchContext()}${labelHint}${found?'':manualWifiGuide()}${content}${controls.trim()?`<div class="onboarding-actions onboarding-footer onboarding-search-actions">${controls}</div>`:''}${labelBack}`;
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
    // C224 (12 Nov, user: "de zone voor deze receiver ... nog strakker en nog duidelijker voor een klant"): one tidy row
    // and a window in which a tap chooses the zone and closes. No second button, no explanation block: the rows say it.
    function receiverDestinationMarkup(open=false){
      const destination=draft.zones.find(zone=>zone.id===draft.activeZoneId);
      const chosenZone=receiverZoneSelection===undefined?draft.activeZoneId:receiverZoneSelection;
      const found=draft.receiver||(results.length===1?results[0]:null);
      const glyph='<svg class="zone-pick-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z"/></svg>';
      const mark='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5.5 12.5 4.2 4.2L18.5 7.8"/></svg>';
      const option=({id=null,name,detail,selected,disabled=false})=>`<button type="button" class="zone-pick-option" data-onboarding-action="active-zone" ${id===null?'data-without-zone':`data-id="${escape(id)}"`} aria-pressed="${selected}" ${disabled?'disabled':''}><span><b>${escape(name)}</b><small>${escape(detail)}</small></span><i aria-hidden="true">${selected?mark:''}</i></button>`;
      const zones=draft.zones.map(zone=>{
        const count=zoneMembers(zone.id).length,compatible=!found||!zone.type||zone.type===found.type;
        const detail=!compatible?tx('Alleen voor {type}',{type:zone.type}):count?`${zone.type?zone.type+' · ':''}${count} ${tx(count===1?'receiver':'receivers')}`:zone.type||tx('Nog leeg');
        return option({id:zone.id,name:zone.name,detail,selected:chosenZone===zone.id&&!draft.zoneChoiceRequired,disabled:!compatible});
      }).join('');
      const later=option({name:tx('Later kiezen'),detail:tx('Je deelt hem later in een zone in.'),selected:chosenZone===null&&!draft.zoneChoiceRequired});
      const body=zoneNameOpen?`<section class="onboarding-destination-create zone-pick-create">${nameField('onboarding-zone-name',tx('Zonenaam'),tx('Bijvoorbeeld: Demohoek'),zoneNameInput)}<div class="zone-pick-two">${button('zone-cancel',tx('Annuleren'),'class="button secondary"')}${button('zone-create',tx('Zone maken'),'disabled')}</div></section>`:
        `<div class="onboarding-zone-list zone-pick-list" role="group" aria-label="${escape(tx("Zone kiezen"))}">${zones}${later}</div>${button('zone-add-from-receiver',`＋ ${escape(tx('Nieuwe zone'))}`,'class="button secondary full"')}`;
      return `<details class="onboarding-destination zone-pick" data-receiver-destination ${open?'open':''}><summary data-onboarding-action="zone-picker-open" aria-haspopup="dialog" aria-expanded="${open}" aria-controls="onboarding-zone-change">${glyph}<span class="onboarding-destination-name"><small>${escape(tx('Zone'))}</small><b>${escape(destination?.name||tx('Nog niet gekozen'))}</b></span><em>${escape(tx(destination?'Wijzig':'Kies'))}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg></em></summary>`+
        `<dialog class="onboarding-zone-dialog zone-pick-dialog" id="onboarding-zone-change" data-onboarding-zone-dialog aria-labelledby="onboarding-zone-change-title"><header class="onboarding-destination-title"><h2 id="onboarding-zone-change-title">${zoneNameOpen?tx('Nieuwe zone'):tx('Kies een zone')}</h2><button type="button" class="icon-button" data-onboarding-action="zone-picker-close" aria-label="${escape(tx("Venster sluiten"))}">×</button></header>${body}</dialog></details>`;
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
      return connectionCard({title:'Receiver toevoegen…',hint:'',progress:false});
    }
    // C231 (tweede tester-ronde 12 nov, punt 14): verlaat de klant de app (of het tabblad) terwijl de receiver vanzelf
    // wordt toegevoegd, dan stopt het afronden. Vroeger kwam dan het oude scherm "Klaar om toe te voegen" met de rode
    // regel "Toevoegen niet afgerond. Probeer opnieuw.". Nu blijft het koppelbeeld staan: komt de klant terug, dan gaat
    // het vanzelf verder; lukt het echt niet, dan staat er rustig één knop "Opnieuw proberen" (dezelfde actie finish).
    // Alleen in het pad zonder PIN in de pagina (de demo); het pad van een echt toestel is niet aangeraakt.
    const calmFinishC231=()=>!pinRequired()&&autoFinishC231&&draft?.stage==='review'&&finalizationStarted&&draft.security.status==='confirmed'&&window.LightningReceiverPairScene?.ready?.()===true;
    function pausedPanelC231(){
      const type=draft.receiver.type,zone=draft.zones.find(item=>item.id===(draft.zoneId||draft.activeZoneId));
      return `<section class="onboarding-connect-live" data-finish-paused data-connect-type="${type}">${pairBusy({type,step:'wait',light:'',caption:'Nog niet toegevoegd',
        sub:`${draft.receiver.name||`${type}-receiver`}${zone?` · ${zone.name}`:''}`,actions:button('finish',`<span>${escape(tx('Opnieuw proberen'))}</span>`,'class="pair-btn pair-go"')})}</section>`;
    }
    function resumeFinishC231(){
      if(!finishSuspendedC231||pinRequired()||!container||document.hidden||busy||draft?.stage!=='review'||!finalizationStarted)return;
      finishSuspendedC231=false;error='';notice='';try{window.__c98log?.('C231 FINISH_RESUME');}catch(_){}void finish();
    }
    let doneSheetSeenC216=null;
    function completeCard(){
      // Ownership publication is needed for the authenticated whole-zone test,
      // but it is not the customer's final setup step. Never show Added here.
      // C113: with pair-first the outputs and pixels follow (then the order step).
      if(jointSPIDirections&&draft.receiver?.type==='SPI'&&draft.zoneId)return connectionCard({title:window.LightningPixelTranslations.t(pairFirstEnabled()?'pixelSettings':'pixelDirectionsSettings',document.documentElement.lang),hint:'',progress:false})+button('joint-directions',window.LightningPixelTranslations.t(pairFirstEnabled()?'pixelNextSetup':'pixelNextDirections',document.documentElement.lang));
      const zone=draft.zones.find(zone=>zone.id===draft.zoneId),count=getModel().receivers.filter(receiver=>receiver.standId===draft.stand.id&&receiver.zoneId===draft.zoneId&&receiver.lifecycle==='added').length;
      // C216 (12 Nov, user: "ik zie een oud scherm van receiver toegevoegd"): the success moment of the approved
      // add-receiver prototype (C143p). C226 (12 Nov, user: "mag grondig verbeterd worden ... full screen ... dat hij
      // zo inzoomt erop"): the same full-screen picture as while connecting; the phone leaves, the picture moves in on
      // the receiver and blue turns green. It stays until the customer taps (user: "Nee, laat staan").
      const type=draft.receiver?.type==='RGBW'?'RGBW':'SPI',order=type==='RGBW'&&!!zone&&count>=2;
      const pid=/^[0-9A-F]{12}$/i.test(String(draft.receiver?.physicalId||''))?String(draft.receiver.physicalId).toUpperCase().slice(-8).replace(/^(.{4})(.{4})$/,'$1-$2'):'';
      const seen=doneSheetSeenC216===draft.receiver?.id;doneSheetSeenC216=draft.receiver?.id;
      const next='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
      const home=origin==='layout'?tx('Terug naar ledlines'):escape(t('setupMyStand','Naar mijn stand'));
      return `<div class="pair-scene${seen?'':' is-arrive'}${pairShown.on?'':' is-enter'}" data-pair-scene data-done-sheet data-pair-state="done" data-pair-type="${type}" role="group" aria-label="${escape(tx('Receiver toegevoegd'))}" style="--pair-lag:${pairLag()}ms">${pairStage(type)}<div class="pair-copy is-done" data-pair-copy>`+
        `<svg class="pair-tick" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="23"/><path d="m15 27 7.5 7.5L37.5 19"/></svg>`+
        `<small class="pair-kicker">${escape(tx(type==='RGBW'?'Je RGBW is toegevoegd':'Je SPI is toegevoegd'))}</small><b class="pair-name">${escape(draft.receiver?.name||`${type}-receiver`)}</b>${pid?`<code class="pair-code">${escape(pid)}</code>`:''}`+
        `<span class="pair-zone">${escape(zone?.name||tx('Niet in een zone'))} · ${count} ${tx(count===1?'receiver':'receivers')}</span>${standLight('green',type)}`+
        `<div class="pair-actions">${order?button('order-now',`<span>${escape(tx('Verder'))}</span>${next}`,'class="pair-btn pair-go"'):button('done',`<span>${home}</span>${next}`,'class="pair-btn pair-go"')}`+
        `${order?`<p class="pair-next">${escape(tx('Daarna: de volgorde van je ledlines.'))}</p>`:''}`+
        `${button('another',`＋ ${escape(t('setupAnotherReceiver','Nog een receiver toevoegen'))}`,'class="pair-btn pair-more"')}`+
        `${order?button('done',origin==='layout'?home:escape(tx('Later, naar mijn stand')),'class="pair-btn pair-later"'):''}</div></div></div>`;
    }
    function calmProblemC127(problem){
      if(!problem?.calm)return problem?.vars?tx(problem.message,problem.vars):problem?.message||'';
      notice=tx(problem.message);
      try{window.dispatchEvent(new CustomEvent('lightning:app-readmit',{detail:{action:'syncInstallationContext'}}));}catch(_){}
      return '';
    }
    function errorBox(){return `<p class="onboarding-error" role="alert" ${error&&!(draft?.stage==='review'&&calmFinishC231())?'':'hidden'}>${escape(tx(error))}</p><p class="onboarding-notice" role="status" ${notice||draftSaving?'':'hidden'}>${draftSaving?tx('Je keuzes bewaren…'):escape(tx(notice))}</p>${pendingChoices&&saveFailed?button('save-retry',draftSaving?'Bewaren…':'Opnieuw bewaren',draftSaving?'disabled':''):''}`;}
    function footer(next='Volgende',disabled=false){return `<div class="onboarding-actions onboarding-footer">${button('back','← Terug',`class="button secondary" ${draft.stage==='zones'&&!draft.stand.isNew?'disabled':''}`)}${button('next',next,disabled?'disabled':'')}</div>`;}
    function nameField(id,label,placeholder,value=''){return `<label class="onboarding-field">${escape(tx(label))}<input id="${id}" ${id==='onboarding-zone-name'?'data-zone-name':''} maxlength="64" autocomplete="off" value="${escape(value)}" placeholder="${escape(tx(placeholder))}"></label>`;}
    function manualWifiGuide(){
      const preview=services.factoryGuidePreview===true&&!draft.mainReceiverId;
      if(results.length||!manualWifi()&&!preview)return '';
      const instructions=`${preview?`<p class="onboarding-demo-wifi-note">${escape(tx("Voorbeeld · blijf voor deze demo op je huidige wifi."))}</p>`:''}${window.LightningSetupWifiGuide.stepsMarkup({standNetwork:standNetworkC137()})}${!results.length?window.LightningSetupWifiGuide.markup():''}`;
      return `<section class="card onboarding-manual-wifi" aria-label="${escape(tx("Wifi met de hand verbinden"))}">${instructions}</section>`;
    }
    // C231 (tweede tester-ronde 12 nov, punt 13; de eigenaar: "als een klant de pin heeft gekozen moet er een animatie tonen die
    // toont dat de receiver zijn pin aan het opslaan is en als alles is opgeslagen de receiver verbinding zal maken met
    // zijn telefoon" / "er zit nu al een oude menu tussen"). Na het kiezen van de PIN loopt het schermvullende
    // koppelbeeld door: de receiver slaat de PIN op → hij verbindt met de telefoon → (controleren, toevoegen) → gelukt.
    // De kaart met de wifi-uitleg is alleen nog de reserve: als de telefoon niet vanzelf op het standnetwerk komt
    // (handoff 'manual'), of als de klant zelf om hulp vraagt. Alleen weergave: dezelfde fasen, dezelfde acties
    // (first-pin-check, first-pin-show); er wordt niets vroeger of later gecontroleerd dan voorheen.
    // De uitweg (16 nov, mesh): een koppeling van de eerste receiver die vastloopt (bv. de receiver is intussen gewist) hield
    // de klant gevangen: een begonnen claim blijft bewaard en de tabbalk is weg. Eén rustige keuze "Opnieuw beginnen" opent het
    // bestaande wissen van de app (Flutter, alleen de app); native vraagt daar zelf de PIN als die al gekozen was.
    function flutterRestartMarkup(){
      if(typeof onFlutterRestart!=='function'||draft.stand?.isNew!==true||draft.mainReceiverId||busy)return '';
      return `<div class="onboarding-restart">${button('flutter-restart',tx('Opnieuw beginnen'),'class="text-button"')}</div>`;
    }
    function rejoinSceneC231(){
      const state=firstPinState686,handoff=state.handoff;
      // de klant vroeg de wifi-uitleg: die kaart blijft staan, behalve terwijl de app controleert
      if(state.phase!=='rejoin'||(rejoinHelpC231&&handoff!=='checking')||!['preparing','switching','checking'].includes(handoff)||window.LightningReceiverPairScene?.ready?.()!==true)return '';
      const saving=handoff==='preparing',waiting=handoff==='switching'&&!busy&&!rejoinAutoC231();
      // de klant kan altijd zelf verder: dezelfde knop als op de reservekaart, en de weg naar die kaart
      const actions=waiting?button('first-pin-check',`<span>${escape(firstPinAPI.text('check'))}</span>`,'class="pair-btn pair-go"')+button('first-pin-help',`<span>${escape(tx('Lukt het niet?'))}</span>`,'class="pair-btn pair-later"'):'';
      return `<section class="onboarding-connect-live" data-first-pin-v2="rejoin" data-first-pin-scene data-security-busy="true" data-connect-type="${draft.receiver.type}"><span data-first-pin-handoff="${handoff}" hidden></span>`+
        `${pairBusy({type:draft.receiver.type,step:saving?'pin':'link',caption:saving?'PIN opslaan':'Verbinden met je telefoon',sub:state.ssid,actions})}</section>`;
    }
    // In de demo ("wifi gaat vanzelf goed") komt de telefoon vanzelf op het standnetwerk: daar gaat het beeld vanzelf verder.
    const rejoinAutoC231=()=>bluetoothFirst||services.FirstPinV2?.demoWalkthrough===true&&services.FirstPinV2.autoRejoin===true;
    function securityPanel(){
      if(firstPinCurrent686()){const scene=rejoinSceneC231();if(scene)return scene;
        const card=firstPinAPI.markup({phase:firstPinState686.phase,handoff:firstPinState686.handoff,ssid:firstPinState686.ssid,type:draft.receiver.type,busy});
        // C217: while the PIN is being chosen the receiver waits; since 15 nov in blue (purple is gone, C253).
        return card&&firstPinState686.phase!=='rejoin'?card+standLight('blue',draft.receiver.type):card;}
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
      const type=receiver?.type==='RGBW'?'RGBW':'SPI';
      // C226: while the app works with the receiver the full-screen picture shows it. The card below is the calm state
      // in between (a check that has to start again), with the same drawing standing still.
      if(receiver&&busy)return `<section class="onboarding-connect-live" data-security-busy="true" data-connect-type="${receiver.type}">${pairBusy({type,caption:title,sub:hint?tx(hint):`${receiver.name||`${type}-receiver`}${zone?` · ${zone.name}`:''}`})}</section>`;
      return `<section class="card onboarding-security onboarding-connecting onboarding-connect-card is-proto" data-security-busy="${busy}" data-connect-type="${receiver?.type||''}" role="status" aria-live="polite" aria-atomic="true">${receiver?`${window.LightningReceiverPairScene?.still(type)||''}<div class="label-scan-id"><b>${escape(receiver.name||`${type}-receiver`)}</b><span>${zone?`${escape(tx('Toevoegen aan'))} ${destination}`:escape(tx('Nog geen zone'))}</span></div>`:''}<h2>${escape(tx(title))}</h2>${hint?`<p class="onboarding-connect-hint">${escape(tx(hint))}</p>`:''}</section>`;
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
        case 'stand':return `<p class="onboarding-task-hint">${escape(t('setupNameHint','Geef je stand een herkenbare naam. Daarna maak je zones en voeg je verlichting toe.'))}</p><section class="card onboarding-name-card">${nameField('onboarding-stand-name',t('setupStandName','Standnaam'),t('setupStandExample','Bijvoorbeeld: Aluvision beursstand'),standNameInput??draft.stand?.name??'')}${firstPinV2===true?`<p class="first-pin-v2-name-hint"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0M9 16a4 4 0 0 1 6 0"/><circle cx="12" cy="20" r="1"/></svg><span>${escape(firstPinAPI.text('nameHint'))}</span></p>`:''}</section><div class="onboarding-actions onboarding-footer">${button('exit','← '+escape(t('back','Terug')),'class="button secondary"')}${button('stand-save',escape(t('setupContinueZones','Verder · zones maken')),'disabled')}</div>${allowPinLogin&&!getModel().stands.length?`<button type="button" class="button secondary full" data-action="pin-login">${escape(tx("Al een stand? Open met PIN"))}</button>`:''}`;
        case 'zones':{
          if(zoneRemoval)return zoneRemovalPanel();
          if(zoneRename)return zoneRenamePanel();
          if(receiverMove)return movePanel();
          const backLabel=!draft.stand.isNew?tx('← Receiver toevoegen'):tx('← Terug');
          return `<p class="onboarding-task-hint">${escape(t('setupZonesHint','Maak zones voor de plekken in je stand. Daarna voeg je receivers toe.'))}</p>${setupZones({editable:true})}${zoneNameFields()}${receiverPlacement()}<div class="onboarding-actions onboarding-footer onboarding-zones-continue">${button('next',escape(t('addReceiver','Receiver toevoegen')),'disabled')}${!draft.zones.length?button('zones-later',escape(t('setupZonesLater','Zones later toevoegen')),'class="button secondary"'):''}<div class="onboarding-zones-footer-row">${button('back',backLabel,`class="button secondary" ${busy||draftSaving?'disabled':''}`)}</div></div>`;
        }
        case 'receiver':return `${receiverSearchView()}${receiversLaterMarkup590()}${draft.stand?.isNew===true&&(parkPending||parkedTransactions.size>0||bindingBlockedA7)?flutterRestartMarkup():''}`;
        case 'placement':return `<p class="onboarding-task-hint">${draft.zoneChoiceRequired?tx('Je gekozen zone is niet meer beschikbaar.'):escape(tx('{type} past niet in de gekozen zone.',{type:draft.receiver.type}))} ${tx('Kies een andere zone of voeg hem zonder zone toe.')}</p><div class="onboarding-zone-list">${zoneChoices()}</div>${zoneNameOpen?`<section class="card">${nameField('onboarding-zone-name',tx('Naam van de nieuwe zone'),tx('Bijvoorbeeld: Lichttunnel'),zoneNameInput)}${button('zone-create',tx('Verder'),'disabled')}</section>`:button('zone-new',tx('＋ Nieuwe zone'),'class="button secondary"')}${button('back',tx('← Terug'),'class="button secondary"')}`;
        case 'outputs':return `${pixelSetup.renderOutputs(draft.outputs,{onboarding:true,live:services.previewCapabilities?.identifyPorts===true&&typeof services.previewPixels==='function'})}${active().length?`<p class="onboarding-hint">${escape(t('setupExtraOutputsLater','Extra uitgangen inschakelen kan later.'))}</p>`:''}${footer(tx('Volgende'),active().length===0)}`;
        case 'pixels':{
          const output=draft.outputs.find(output=>output.port===draft.port);
          return `${pixelSetup.renderPortContext(draft.outputs,draft.port)}${pixelSetup.renderPixels(output,{inputId:'onboarding-pixels',onboarding:true,pixelsPerMeter:pixelLimits.pixelsPerMeter})}${footer(pixelSetup.nextPortLabel(draft.outputs,draft.port,jointSPIDirections?{stage:'connection'}:{}))}`;
        }
        case 'connection':{
          const output=draft.outputs.find(output=>output.port===draft.port);
          return `${pixelSetup.renderPortContext(draft.outputs,draft.port,{stage:'connection'})}${pixelSetup.renderSide(output,{onboarding:true,live:services.previewCapabilities?.power===true&&typeof services.previewPixels==='function'})}${footer(pixelSetup.nextPortLabel(draft.outputs,draft.port,{stage:'connection'}))}`;
        }
        case 'pin':return pinRequired()?pinForm():securityPanel();
        case 'security':return securityPanel()+flutterRestartMarkup();
        case 'zone':return `${!draft.zones.length&&!draft.zoneChoiceRequired?`<p class="onboarding-task-hint">${escape(tx("Je voegt deze receiver zonder zone toe."))}</p>${button('next',tx('Verder naar overzicht'))}`:`${draft.zoneChoiceRequired?`<p class="onboarding-task-hint">${escape(tx("Je gekozen zone is niet meer beschikbaar. Kies een nieuwe zone of voeg deze receiver zonder zone toe."))}</p>`:!pinRequired()?`<p class="onboarding-task-hint">${escape(tx("Kies een zone of deel deze receiver later in."))}</p>`:''}<div class="onboarding-zone-list">${zoneChoices()}</div>${zoneNameOpen?`<section class="card">${nameField('onboarding-zone-name',tx('Naam van de nieuwe zone'),tx('Bijvoorbeeld: Lichttunnel'),zoneNameInput)}${button('zone-create',tx('Zone maken'),'disabled')}</section>`:button('zone-new',tx('＋ Nieuwe zone'),'class="button secondary"')}${pinRequired()?button('next',tx('Verder naar overzicht'),placementReady()?'':'disabled'):''}`}<small class="onboarding-hint">${draft.zones.length?tx('RGBW en SPI apart. Verplaatsen kan later.'):tx('Zones maken en receivers indelen kan later.')}</small>`;
        case 'review':return automaticMain()&&automaticFinalizing?mainWifiReturn():!pinRequired()&&(automaticFinalizing||autoFinishC231)&&busy?addingPanel():calmFinishC231()?pausedPanelC231():reviewCard();
        case 'done':return completeCard();
        default:return '';
      }
    }
    function footerPin(){return `<div class="onboarding-actions onboarding-footer">${button('back',tx('← Terug'))}${button('secure',tx('Beveiligen en verbinden'),'disabled')}</div>`;}
    function paintPage(top=true,capture=true){
      if(!container)return;
      unbindDirectionTutorial?.();unbindDirectionTutorial=null;
      if(firstAccess){container.innerHTML=firstAccessPage();document.title=`${container.querySelector('h1').textContent} · Aluvision Lighting`;queueJointDirections();return;}
      if(capture)captureNames();
      const stageKey=[draft.transactionId,draft.stage,draft.receiver?.id||''].join(':'),entering=!presentedStages.has(stageKey);
      const focusedPort=container.contains(document.activeElement)&&document.activeElement.dataset.onboardingAction==='output'?document.activeElement.dataset.port:null;
      const focusedZone=container.contains(document.activeElement)&&document.activeElement.dataset.onboardingAction==='active-zone'?document.activeElement.dataset.id:null;
      const focusedMoveZone=container.contains(document.activeElement)&&document.activeElement.dataset.onboardingAction==='move-zone'?document.activeElement.dataset.id:null;
      const focusedSide=container.contains(document.activeElement)&&document.activeElement.dataset.onboardingAction==='side'?document.activeElement.dataset.side:null;
      // A local choice repaints this step, not its open help panels. Closing a
      // disclosure during that repaint also shrinks the page under the user's
      // finger and makes Safari/Chrome clamp the scroll position upwards.
      const disclosureKey=element=>element.className+'|'+element.querySelector(':scope > summary')?.textContent;
      const disclosures=!top?new Map(Array.from(container.querySelectorAll('details'),element=>[disclosureKey(element),element.open])):null;
      const zoneScroll=container.querySelector('.onboarding-destination .onboarding-zone-list')?.scrollTop||0;
      const zoneDialogWasOpen=container.querySelector('[data-onboarding-zone-dialog]')?.open===true;
      const zonePickerOpen=container.querySelector('.onboarding-destination')?.open===true||openZonePickerOnNextPaint;openZonePickerOnNextPaint=false;
      presentedStages.add(stageKey);
      container.innerHTML=`<div class="page onboarding-page onboarding-layout587${entering?' onboarding-stage-enter':''}" data-setup-origin="${origin}" data-onboarding-stage="${draft.stage}" aria-busy="${draftSaving||busy}">${heading()}${body()}${errorBox()}</div>`;
      unbindDirectionTutorial=globalThis.LightningSPIDirectionTutorial?.bind(container)||null;
      document.title=`${container.querySelector('h1').textContent} · Aluvision Lighting`;
      {
        // C226: set the camera of the full-screen picture; the page that follows it comes out of its dark.
        const scene=container.querySelector('[data-pair-scene]');
        if(scene||container.querySelector('[data-pair-still]'))window.LightningReceiverPairScene?.fit(container);
        if(!scene&&pairShown.on)container.querySelector('.onboarding-page')?.classList.add('pair-leave');
        pairShown=scene?{on:true,step:scene.dataset.pairStep||'',type:scene.dataset.pairType}:{on:false,step:'',type:''};
        // The success moment: the next action has the focus (the title sits behind the picture).
        if(scene?.dataset.pairState==='done'&&scene.classList.contains('is-arrive'))scene.querySelector('.pair-go')?.focus({preventScroll:true});
      }
      if(draft.stage==='receiver'){
        labelPlaceFrame();
        const heading=container.querySelector('.onboarding-heading');
        const prompt=container.querySelector('.onboarding-search-help');
        if(prompt)heading.insertAdjacentElement('afterend',prompt);
        // Existing installs can pick a zone before or after discovery through
        // the same destination control. A choice grants no receiver membership.
        if(!receiverMove&&destinationAvailable())heading.insertAdjacentHTML('afterend',receiverDestinationMarkup(zonePickerOpen));
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
      if((draft.stage==='receiver'&&destinationAvailable()&&!receiverMove||draft.stage==='outputs')&&zonePickerOpen){
          const dialog=container.querySelector('[data-onboarding-zone-dialog]');
          if(dialog&&!dialog.open){
            dialog.addEventListener('cancel',event=>{
              event.preventDefault();const picker=dialog.closest('[data-receiver-destination]');if(picker)picker.open=false;
              receiverZoneSelection=undefined;openZonePickerOnNextPaint=false;zoneNameOpen=false;
              paintPage(false);container?.querySelector('[data-receiver-destination]>summary')?.focus({preventScroll:true});
            });
            dialog.showModal();
            window.InterfaceMotion?.openDialog?.(dialog,zoneDialogWasOpen);
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
      if(top){
        window.scrollTo({top:0,left:0,behavior:'instant'});
        const heading=container.querySelector(draft.stage==='pixels'?'[data-pixel-panel="pixels"] > h2':'h1');
        heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});
      }
      else if(focusedPort)container.querySelector(`[data-onboarding-action="output"][data-port="${focusedPort}"]`)?.focus({preventScroll:true});
      else if(focusedZone&&['receiver','outputs'].includes(draft.stage)&&!zonePickerOpen)container.querySelector('.onboarding-destination>summary')?.focus({preventScroll:true});
      else if(focusedZone)container.querySelector(`[data-onboarding-action="active-zone"][data-id="${CSS.escape(focusedZone)}"]`)?.focus({preventScroll:true});
      else if(focusedMoveZone&&!document.hidden&&document.activeElement===document.body){
        const targets=Array.from(container.querySelectorAll('button[data-onboarding-action="move-zone"]')).filter(button=>button.dataset.id===focusedMoveZone&&button.isConnected&&!button.disabled);
        if(targets.length===1)targets[0].focus({preventScroll:true});
      }
      else if(focusedSide)container.querySelector(`[data-onboarding-action="side"][data-side="${CSS.escape(focusedSide)}"]`)?.focus({preventScroll:true});
      restoreZoneList();
      if(!busy&&['security','review'].includes(draft.stage)){
        container.querySelector('.onboarding-page').insertAdjacentHTML('beforeend',button('receivers-list','← Terug naar zoeken','class="button secondary full"'));
      }
      paint(globalThis.AluvisionPreviewNowPS());
      syncPixelPreview();
      queueJointDirections();
    }
    function queueJointDirections(){
      if(!(jointSPIDirections||pairFirstEnabled())||busy||!container)return;
      const receiverId=firstAccess?.phase==='done'?firstAccess.identity.receiverId:draft?.stage==='done'?draft.receiver?.id:null;
      const receiver=receiverId&&getModel().receivers.find(item=>item.id===receiverId&&item.type==='SPI'&&item.lifecycle==='added');
      if(!receiver||!receiver.zoneId&&!pairFirstEnabled())return;
      const token=operation,currentContainer=container;
      queueMicrotask(()=>{
        if(token!==operation||container!==currentContainer||busy||document.hidden)return;
        const current=getModel().receivers.find(item=>item.id===receiverId&&item.type==='SPI'&&item.lifecycle==='added'&&item.zoneId===receiver.zoneId);
        if(!current)return;
        suspend();onExit(pairFirstEnabled()?{stand:true,spiPairFirstReceiverId:current.id,spiPairFirstZoneId:current.zoneId||null}:{stand:true,spiDirectionZoneId:current.zoneId,newReceiverId:current.id});
      });
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
          if(choices.length===1)action='receiver';else if(!choices.length&&searchState!=='searching')action=firstScanFront()?'first-scan':'search';break;
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
    function keydown(event){if(event.defaultPrevented||event.isComposing||event.keyCode===229)return;if(event.key==='Enter'&&event.target.matches('input:not([data-onboarding-pin])')){const button=container.querySelector('[data-onboarding-action="stand-save"], [data-onboarding-action="zone-create"], [data-onboarding-action="zone-rename-confirm"]')||(draft.stage==='zones'?container.querySelector('[data-onboarding-action="next"]'):null);if(button&&!button.disabled){event.preventDefault();button.click();}}}
    async function search(){
      if(!resumeReadOnlySearchC101()){paintPage(false);return;}
      if(parkPending||parking){if(!(await parkForSearch()))return;}
      if(searchState==='searching'||busy||identifyPending.size)return;
      if(labelBlocksSearch()||firstScan.state==='scanning')return;
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
        // 20 nov: eerste receiver via bluetooth: niet gevonden binnen de termijn (BLUETOOTH_DEADLINE/UNAVAILABLE) = binnen dezelfde 10 s stil
        // nog eens zoeken (de receiver kan net opstarten of zijn melding nog niet gehoord zijn), pas dan de bluetooth-zin. Schakelaar uit = meteen de zin.
        const ZOEK_BLE_STIL_C272=true;
        // C135: the stand Wi-Fi drops for a few seconds when the MAIN restarts its AP; the phone rejoins by itself. Retry the
        // search quietly for up to 10 s instead of showing "nothing found" for a search that never reached a receiver.
        let result;
        for(const startedC135=Date.now();;){
          try{result=await bounded(services.search({standId:draft.stand.id,mainReceiverId:draft.mainReceiverId,signal:searchAbort.signal}),draft.role==='node'?95000:15000);break;}
          catch(failure){
            if(!(failure?.code==='RECEIVER_NETWORK_UNAVAILABLE'||ZOEK_BLE_STIL_C272&&bluetoothFirst&&!draft.mainReceiverId&&/^BLUETOOTH_(DEADLINE|UNAVAILABLE)$/.test(String(failure?.code||'')))||Date.now()-startedC135>10000||token!==operation||searchAbort?.signal.aborted)throw failure;
            try{if(failure?.code!=='RECEIVER_NETWORK_UNAVAILABLE')window.__c98log?.('KOPPEL zoeken stil opnieuw code='+failure.code);}catch(_){}
            await new Promise(resolve=>setTimeout(resolve,2000));if(token!==operation||searchAbort?.signal.aborted)return;
          }
        }
        if(token!==operation||searchAbort?.signal.aborted)return;
        const identities=new Set(),localIds=new Set(),fingerprints=new Set(),existing=getModel().receivers;
        results=(Array.isArray(result?.receivers)?result.receivers:[]).filter(receiver=>{
          const observation=receiver?.reachabilityOnly===true&&receiver.canConfigure===false&&receiver.deviceFingerprint===null;
          if(!receiver||!['SPI','RGBW'].includes(receiver.type)||typeof receiver.id!=='string'||!/^[\w-]{1,96}$/.test(receiver.id)||!/^[\da-f]{16}$/i.test(receiver.rid)||(!observation&&!/^[\da-f]{64}$/i.test(receiver.deviceFingerprint)))return false;
          const rid=receiver.rid.toUpperCase(),fingerprint=receiver.deviceFingerprint?.toUpperCase();
          // C118: native offers a factory-reset member (MAIN-proven unpaired) as
          // a NEW receiver; its selection first removes the old stand item.
          const reAdd=receiver.reAdd===true&&draft.role==='node'&&typeof onForgotten==='function'&&!fingerprint&&receiver.id==='receiver-'+rid;
          if(identities.has(rid)||localIds.has(receiver.id)||(fingerprint&&fingerprints.has(fingerprint))||!reAdd&&existing.some(item=>item.id===receiver.id||item.rid?.toUpperCase()===rid||(fingerprint&&item.deviceFingerprint?.toUpperCase()===fingerprint)))return false;identities.add(rid);localIds.add(receiver.id);if(fingerprint)fingerprints.add(fingerprint);return true;
        }).map(receiver=>({id:receiver.id,rid:receiver.rid.toUpperCase(),type:receiver.type,...(receiver.reAdd===true?{reAdd:true}:{}),...(typeof receiver.physicalId==='string'&&/^[0-9A-F]{12}$/.test(receiver.physicalId)&&!/^0+$/.test(receiver.physicalId)?{physicalId:receiver.physicalId}:{}),name:String(receiver.name||`${receiver.type}-receiver`).slice(0,64),deviceFingerprint:receiver.deviceFingerprint?.toUpperCase()||null,canConfigure:receiver.canConfigure!==false,canVerifyIdentity:receiver.canVerifyIdentity===true&&typeof services.select==='function',unavailableReason:receiver.canConfigure===false?(receiver.canVerifyIdentity===true&&typeof services.select==='function'?'Kies deze receiver om zijn verbinding veilig te controleren.':'Receiver gevonden. Beveiligd toevoegen is in deze appversie nog niet beschikbaar.'):''}));
        searchState='ready';labelMatch();firstMatch();
      }catch(failure){if(token!==operation)return;searchState='failed';results=[];error=calmProblemC127(connectionFailure(failure,{viaMain:draft.role==='node',network:receiverNetwork(),bluetooth:bluetoothFirst&&!draft.mainReceiverId}));
        if(firstScanReady()&&draft.role==='main'&&manualWifi())firstScan.wifiHelp=true;
        if(labelScan?.state==='finding'){labelScan.state='missing';labelScan.detail='';labelScan.problem=error;error='';}}
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
          else identifying.set(id,globalThis.AluvisionPreviewNowPS()+(Number.isInteger(answer.ttlMs)&&answer.ttlMs>0?answer.ttlMs/1000:10));
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
      const usingFirstPin=firstPinCandidate686();
      registrationPending=false;
      if(!canSecure()){pin='';repeat='';error=unavailable;paintPage(false);return;}
      if(draft.stage==='pin'&&usingFirstPin){
        draft=draftApi.snapshot({...clone(draft),stage:'security',security:{status:'pending',phase:'configuring'}});
      }else if(draft.stage==='pin'){
        const result=draftApi.providePin(draft,pin,repeat);if(result.error){error=result.error.message;paintPage(false);return;}draft=result.draft;
      }
      // Erase both visible PIN inputs before the first await. Only this call's
      // short-lived closure passes the credential to the trusted service.
      container?.querySelectorAll('[data-onboarding-pin]').forEach(element=>{element.value='';});
      repeat='';busy=true;error='';const token=++operation;const controller=new AbortController();actionAbort=controller;let finishSelectedZone=false;
      if(usingFirstPin&&firstPinCurrent686()&&firstPinState686.phase==='rejoin')firstPinState686.handoff='checking';
      paintPage();
      const method=reconcile||securityUncertain?'reconcileSecurity':'secure';
      let attempted=false;
      try{
        await persist();if(token!==operation)throw Error('SUSPENDED');
        await checkpointPairFirst(token);
        change({type:'SECURITY_PROGRESS',phase:method==='reconcileSecurity'?'resuming':'claiming'},{top:false});
        securityUncertain=true;
        let response;
        if(method==='reconcileSecurity'&&securityReceiptRef)response={receiptRef:securityReceiptRef};
        else {
          if(typeof services[method]!=='function')throw Error('UNAVAILABLE');
          attempted=true;const request=usingFirstPin?(method==='reconcileSecurity'?services.FirstPinV2.reconcile({configuration:config(),signal:controller.signal}):services.FirstPinV2.prepare({configuration:config(),standName:draft.stand.name,signal:controller.signal})):services[method]({configuration:config(),signal:controller.signal,...(pinRequired()&&method==='secure'&&draft.role==='main'?{pin}:{}),onProgress:phase=>{
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
          if(usingFirstPin){rememberFirstPin686(response,'pin');securityUncertain=false;return 'stop';}
          if(!pinRequired())throw Object.assign(Error('PIN_DISABLED'),{code:'PIN_DISABLED'});
          if(method!=='reconcileSecurity'||draft.role!=='main')throw Error('INVALID_RESUME');
          draft=draftApi.snapshot({...clone(draft),stage:'pin',security:{status:'not-started',phase:'idle'}});
          securityUncertain=false;manualRejoinSSID=null;notice='De receiver is nog niet beveiligd. Vul je gekozen PIN opnieuw in om verder te gaan.';return;
        }
        if(response?.status==='manual-rejoin'){
          if(usingFirstPin){rememberFirstPin686(response,'rejoin');return 'retry';}
          if(!pinRequired())throw Object.assign(Error('UNEXPECTED_REJOIN'),{code:'UNEXPECTED_REJOIN'});
          if(!manualWifi()||draft.role!=='main'||typeof response.ssid!=='string'||!/^ALUVISION-(RGBW|SPI)-[A-F0-9]{12}$/.test(response.ssid)||!response.ssid.startsWith('ALUVISION-'+draft.receiver.type+'-'))throw Error('INVALID_REJOIN');
          manualRejoinSSID=response.ssid;return 'retry';
        }
        if(response?.status==='registration-pending'){
          if(draft.role!=='main'||method!=='reconcileSecurity')throw Error('INVALID_RESUME');
          if(usingFirstPin)rememberFirstPin686(response,'rejoin');
          registrationPending=true;return 'retry';
        }
        if(!response?.receiptRef)throw Error('NO_RECEIPT');
        if(usingFirstPin&&response.ssid)rememberFirstPin686(response,'rejoin');
        securityReceiptRef=response.receiptRef;
        if(token!==operation)throw Error('SUSPENDED');
        change({type:'SECURITY_PROGRESS',phase:'verifying'},{top:false});
        const confirmed=await bounded(committer.confirmSecurity(draft,response.receiptRef));
        if(confirmed.error){securityReceiptRef=null;throw Error('UNCONFIRMED');}
        if(token!==operation)throw Error('SUSPENDED');
        draft=confirmed.draft;securityReceiptRef=response.receiptRef;securityUncertain=false;manualRejoinSSID=null;
        if(usingFirstPin){if(!firstPinCurrent686())throw Object.assign(Error(),{code:'FIRST_PIN_V2_UNCONFIRMED'});firstPinState686.confirmed=true;firstPinReturn686=false;}
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
        if(usingFirstPin&&method==='secure')securityUncertain=false; // prepare is read-only, never a claim attempt.
        if(pinRequired()&&!attempted&&!securityUncertain&&draft.role==='main')draft=draftApi.snapshot({...clone(draft),stage:'pin',security:{status:'not-started',phase:'idle'}});
        // LABEL_ALTIJD: de voorbereiding van de eerste receiver weigerde zonder (geldig) labelbewijs. Nooit een claim gestart, dus terug
        // naar de scanstap (zoals "Terug naar zoeken"), met de rustige zin; geen foutkaart
        if(LABEL_ALTIJD&&labelCode(failure)&&draft.role==='main'&&!securityUncertain){
          error='';queueMicrotask(()=>{void (async()=>{if(await parkForSearch()){firstLabelScan();paintPage(true);}})();});return 'stop';
        }
        if(automaticMain()&&transientRejoin(failure))return 'retry';
        if(usingFirstPin&&method==='reconcileSecurity'&&firstPinCurrent686()&&firstPinState686.phase==='rejoin'&&herstartNaClaim(failure)){
          try{window.__c98log?.('KOPPEL pin-herstart stil code='+String(failure?.code||'').slice(0,60)+' ms='+(Date.now()-firstPinClaimAt)+' venster='+stilNaClaimMs()+(bluetoothFirst?' bluetooth':''));}catch(_){}
          firstPinStil=true;firstPinState686.handoff='checking';error='';
          if(!automatic){firstPinEarly686.wait=true;clearTimeout(firstPinEarly686.timer);firstPinEarly686.timer=setTimeout(retryEarlyFirstPin686,2000);}
          return 'retry'; // automatic: automaticRejoin probeert zelf opnieuw (binnen de 45 s zonder grens op het aantal)
        }
        if(usingFirstPin&&method==='reconcileSecurity'&&failure?.code==='MAIN_CONFIGURATION_INVALID'&&!firstPinEarly686.used&&firstPinCurrent686()&&firstPinState686.phase==='rejoin'){
          firstPinEarly686.used=true;firstPinEarly686.wait=true;clearTimeout(firstPinEarly686.timer);firstPinEarly686.timer=setTimeout(retryEarlyFirstPin686,1500);
          return 'retry';
        }
        error=usingFirstPin?firstPinError686(failure):typeof failure?.code==='string'?calmProblemC127(connectionFailure(failure,{viaMain:draft.role==='node',network:receiverNetwork(),bluetooth:bluetoothFirst&&!draft.mainReceiverId})):tx(pinRequired()?'We konden deze receiver nog niet toevoegen. Je PIN en keuzes blijven bewaard; er is niets opnieuw ingesteld.':'We konden deze receiver nog niet toevoegen. Je keuzes blijven bewaard; er is niets opnieuw ingesteld.');
        if(automaticMain())rejoinBlocked=true;
        return 'stop';
      }
      finally{
        pin='';repeat='';if(actionAbort===controller)actionAbort=null;if(token===operation){busy=false;if(firstPinStil)firstPinStil=false;else if(usingFirstPin&&firstPinCurrent686()&&firstPinState686.handoff==='checking')firstPinState686.handoff='manual';}
        if(token===operation){
          if(finishSelectedZone&&container)void finish({automatic:true});
          else {keepDraft();paintPage(!automatic);resumeFirstPin686();if((returningFromWifi&&!rejoinRunning)||(!automatic&&draft.security.status==='confirmed'))resumeAfterWifiReturn();}
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
      busy=true;finalizationStarted=true;automaticFinalizing=automatic;error='';notice='';const token=++operation;const controller=new AbortController();actionAbort=controller;
      if(automatic&&!pinRequired())autoFinishC231=true;finishSuspendedC231=false;   // C231
      paintPage(false);
      let finishPhase='save';
      try{
        await persist();if(token!==operation)throw Error('SUSPENDED');
        await checkpointPairFirst(token);
        finishPhase='receiver';
        if(refreshProof){
          const retryModel=getModel(),retryConfiguration=canonical(config());
          const securityDraft=draftApi.snapshot({...clone(draft),stage:'security',security:{status:'pending',phase:'resuming'}});
          securityReceiptRef=null;finalReceiptRef=null;
          if(!container||document.hidden||typeof services.reconcileSecurity!=='function')throw Error('SUSPENDED');
          const refreshService=firstPinCurrent686()&&firstPinState686.confirmed?services.FirstPinV2.reconcile:services.reconcileSecurity;
          const refreshed=await bounded(refreshService({configuration:draftApi.configuration(securityDraft),signal:controller.signal}),draft.role==='node'?125000:50000);
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
        if(automatic&&document.hidden){if(!pinRequired()){finishSuspendedC231=true;return 'stop';} /* C231: terug in beeld gaat het vanzelf verder */notice='Toevoegen is onderbroken. Kom terug en tik op Opnieuw proberen.';return 'stop';}
        const currentModel=getModel();
        finishPhase='verify';
        const completed=await bounded(committer.finish(currentModel,draft,finalReceiptRef));
        if(completed.error){finalReceiptRef=null;throw Object.assign(Error('UNCONFIRMED'),{code:completed.error.code});}
        // Verification may await native storage/radio. Never overwrite edits
        // made elsewhere in the meantime, nor publish after this flow closed.
        // The private receipt can be reverified against the new model on retry.
        if(token!==operation||getModel()!==currentModel)throw Error('MODEL_CHANGED');
        if(automatic&&document.hidden){if(!pinRequired()){finishSuspendedC231=true;return 'stop';} /* C231: terug in beeld gaat het vanzelf verder */notice='Toevoegen is onderbroken. Kom terug en tik op Opnieuw proberen.';return 'stop';}
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
        let firstPinReady=null;
        if(firstPinCurrent686()&&firstPinState686.confirmed){
          const ready=await services.FirstPinV2.ready({standId:completed.draft.stand.id}),receiver=committedModel.receivers.find(item=>item.id===completed.draft.receiver.id);
          if(token!==operation||getModel()!==currentModel||!receiver||ready?.ready!==true||ready.standId!==receiver.standId||ready.receiverId!==receiver.id||ready.rid!==receiver.rid||ready.deviceFingerprint!==receiver.deviceFingerprint||ready.transactionId!==completed.draft.transactionId||ready.ssid!==firstPinState686.ssid)throw Object.assign(Error(),{code:'FIRST_PIN_V2_UNCONFIRMED'});
          firstPinReady=ready;
        }
        if(!central&&!firstPinReady&&completed.draft.role==='main'&&firstStandAccessRequired()){
          const receiver=committedModel.receivers.find(item=>item.id===completed.draft.receiver.id);
          firstAccess={identity:{schema:1,stage:'wifi-pin',standId:completed.draft.stand.id,receiverId:receiver.id,rid:receiver.rid,fingerprint:receiver.deviceFingerprint,transactionId:completed.draft.transactionId},phase:'checking',ssid:''};
          draft=completed.draft;completeModel=committedModel;
          const prepared=await onFirstStandAccess({kind:'prepare',identity:clone(firstAccess.identity),model:committedModel});
          if(!prepared||!['pin','reconnect','checking'].includes(prepared.phase))throw Error('FIRST_ACCESS_UNCONFIRMED');
          firstAccess.phase=prepared.phase;firstAccess.ssid=prepared.ssid||'';
          return 'stand-access';
        }
        // 15 nov: de eerste receiver staat; de bluetooth-weg van de koppeling is niet meer nodig (native volgt de keuze wifi/bluetooth).
        if(bluetoothFirst){bluetoothFirst=false;try{void Promise.resolve(services.endBluetoothFirstPair?.()).catch(()=>{});}catch(_){}}
        draft=completed.draft;completeModel=committedModel;await onComplete(completeModel,{zoneId:draft.zoneId,receiverId:draft.receiver.id,central,firstPinV2Ready:firstPinReady});
        return 'done';
      }catch(failure){
        try{window.__c98log?.('C231 FINISH_STOP phase='+finishPhase+' hidden='+document.hidden+' current='+(token===operation)+' kind='+(typeof failure?.code==='string'?failure.code:failure?.message==='SUSPENDED'?'SUSPENDED':'OTHER'));}catch(_){}
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
        // C231: gestopt omdat de pagina weg was (SUSPENDED): geen fout van de receiver; terug in beeld gaat het vanzelf verder
        if(!pinRequired()&&(document.hidden||failure?.message==='SUSPENDED')){finishSuspendedC231=true;if(!document.hidden)setTimeout(resumeFinishC231,400);}
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
    async function exitAtomicPreview579(){
      if(!atomicExitEligible579()||draftSaving||pendingChoices||managementBusy||exiting)return;
      let job=previewStopJob;
      if(!job){job={container,draft,mainFingerprint:mainFingerprint579(draft),token:operation,restore:pixelSetup.showPreviewStopping(container),exitPending:false,stopSettled:false,failed:false,stopConfirmed:false};previewStopJob=job;busy=true;
        container.querySelector('[data-onboarding-action="exit"]')?.removeAttribute('disabled');
        void pixelPreview.stop().then(answer=>{job.stopConfirmed=answer?.stopped===true;if(!job.stopConfirmed)job.failed=true;},()=>{job.failed=true;}).finally(()=>{job.stopSettled=true;if(job.atomic)settleCleanup579(job);if(previewStopJob===job&&!job.exitPending){previewStopJob=null;job.restore();if(container===job.container&&operation===job.token)busy=false;}});}
      if(job.exitPending||container!==job.container||draft!==job.draft||operation!==job.token)return;
      job.atomic=true;job.exitPending=true;const retained=clone(job.draft),model=canonical(getModel());
      const current=()=>previewStopJob===job&&container===job.container&&draft===job.draft&&operation===job.token&&canonical(draft)===canonical(retained)&&canonical(getModel())===model;
      try{
        const result=await services.checkpointPreviewExit({draft:retained});
        if(!current())return;
        if(!result||Object.keys(result).sort().join(',')!=='checkpoint,view'||result.checkpoint?.kind!=='pixel-preview-exit-local'||canonical(result.checkpoint.draft)!==canonical(retained)||result.view?.draft!==null||canonical(result.view.model)!==model)throw Error('LOCAL_CHECKPOINT_UNCONFIRMED');
        parkedTransactions.add(retained.transactionId);localExitPreviewCleanup=true;const cleanup=cleanupPending579(job);if(job.stopSettled)settleCleanup579(job);
        const returnToStand=savedStand()&&origin!=='layout';suspend({discard:true});draft=searchDraft(retained);parkPending=null;searchOnMount=true;results=[];searchState='idle';
        securityReceiptRef=null;finalReceiptRef=null;securityUncertain=false;finalizationStarted=false;resumeSelection=null;manualRejoinSSID=null;
        onExit(returnToStand?{stand:true}:undefined);mountCleanup579(cleanup);
      }catch(failure){if(current()){
        if(failure?.code==='NATIVE_STORAGE_RECONCILE_REQUIRED')previewReconcile579={container,draft,operation,choices:canonical(retained),model};
        notice='Teruggaan is nog niet bevestigd. Je keuzes blijven staan; probeer opnieuw.';refreshNotice();
      }}
      finally{job.exitPending=false;if(previewStopJob===job&&job.stopSettled){previewStopJob=null;job.restore();if(container===job.container&&operation===job.token)busy=false;}if(previewReconcileCurrent579())refreshNotice();}
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
        suspend();onExit(savedStand()&&origin!=='layout'?{stand:true}:undefined);
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
      const returnToStand=target.dataset.returnStand==='true';
      const expiredPixelExit686=action==='exit'&&previewState.kind==='expired';
      if(action==='preview-reopen'){
        if(!previewReconcileCurrent579())return;
        // Explicit normal document reload, not another save, STOP, resume or
        // success receipt. Native lifecycle invalidates the old presentation.
        localExitPreviewCleanup=true;window.location.reload();return;
      }
      if(action==='exit'&&previewReconcileCurrent579()){refreshNotice();return;}
      if(action==='exit'&&!expiredPixelExit686&&atomicExitEligible579())return exitAtomicPreview579();
      if(busy&&['outputs','pixels','connection'].includes(draft?.stage)){
        if(action==='exit'&&previewStopJob)return exitDuringPreviewStop();
        return;
      }
      if((draftSaving||managementBusy)&&action!=='zone-picker-close')return;
      window.LightningInterfaceHaptics?.activate?.(event,'onboarding:'+action);
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
      if(action==='receivers-later')return continueReceiversLater590();
      if(action==='receivers-list')return browseReceivers();
      const leavesPixelGuide=!expiredPixelExit686&&(action==='exit'||action==='back'&&draft.stage==='outputs'||action==='next'&&
        (draft.stage==='connection'||jointSPIDirections&&draft.stage==='pixels')&&!active().some(output=>output.port>draft.port));
      if(leavesPixelGuide&&['outputs','pixels','connection'].includes(draft.stage)){
        const stoppingContainer=container,stoppingDraft=draft,token=operation;
        const job={container:stoppingContainer,draft:stoppingDraft,mainFingerprint:mainFingerprint579(stoppingDraft),token,restore:pixelSetup.showPreviewStopping(stoppingContainer),exitPending:false,stopSettled:false,failed:false};
        previewStopJob=job;busy=true;
        stoppingContainer.querySelector('[data-onboarding-action="exit"]')?.removeAttribute('disabled');
        try{job.failed=(await pixelPreview.stop())?.stopped!==true;}catch(_){job.failed=true;}
        finally{job.stopSettled=true;if(job.atomic)settleCleanup579(job);if(previewStopJob===job&&!job.exitPending){job.restore();if(token===operation&&container===stoppingContainer)busy=false;}}
        if(previewStopJob!==job||token!==operation||container!==stoppingContainer||draft!==stoppingDraft)return;
        if(job.exitPending)return;
        previewStopJob=null;
        if(job.failed||['failed','unsupported'].includes(previewState.kind)){notice='Stoppen van het testlicht is nog niet bevestigd. Je keuzes blijven staan; probeer opnieuw.';refreshNotice();return;}
      }
      if(action==='exit'){
        if(leaveReadOnlySearchC101(returnToStand))return;
        if(exiting)return;
        if(!draft?.receiver||draft.security?.status==='not-started')forgetScannedLabels(); // nog geen claim: de klant stopt deze koppeling
        const beforeSave=operation;
        const name=container.querySelector('#onboarding-stand-name')?.value;
        const events=draft.stage==='stand'&&validName(name||'')?[{type:'SET_STAND',id:draft.stand?.id||'stand-'+uniqueId(),name}]:[];
        if((pendingChoices||['stand','zones'].includes(draft.stage))&&!(await saveChoices(events)))return;
        if(beforeSave!==operation||!container)return;
        const exitContainer=container;exiting=true;let left=false;
        try{
          if(!(await parkForExit({expiredEditorExit:expiredPixelExit686}))||container!==exitContainer)return;
          const closedSearch=savedStand()&&draft.stage==='receiver'&&draft.receiver===null;
          suspend({discard:true});
          // A closed search has no remaining active native checkpoint. Reopen
          // against the current installation, not a MAIN removed meanwhile.
          // Privately parked receiver transactions remain available by identity.
          if(closedSearch)draft=null;
          left=true;
        }finally{exiting=false;}
        if(left)onExit(returnToStand?{stand:true}:undefined);
        return;
      }
      if(pendingChoices)return;
      if(action==='first-pin-claim')return claimFirstPin686();
      if(action==='flutter-restart'){if(typeof onFlutterRestart==='function')onFlutterRestart();return;}
      if(action==='first-pin-help'){rejoinHelpC231=true;paintPage(false);return;}   // C231: de kaart met de wifi-uitleg (de reserve)
      if(action==='first-pin-show')return showFirstPin686();
      if(action==='first-pin-check')return secure(undefined,undefined,{reconcile:true});
      if(action==='search'){firstScan.family=null;return search();}
      if(action==='identify')return identify(target.dataset.id);
      if(busy)return;
      if(action==='label-scan')return labelScanRun();
      if(action==='first-scan')return firstScanRun();
      if(action==='first-scan-help'){firstScan.wifiHelp=true;paintPage(false);container.querySelector('[data-first-scan-wifi]')?.scrollIntoView({block:'nearest',behavior:'smooth'});return;}   // C231: de reserve
      if(action==='scan-tutorial')return scanTutorialOpen();
      if(action==='label-retry'){const gate=labelGate();if(gate?.state==='missing'&&gate.scan)return labelFind(gate);return;}
      if(action==='label-list'){const gate=labelGate();if(!gate||gate.state==='scanning')return;gate.state='list';gate.note='';gate.hint='';error='';paintPage(false);return search();}
      if(action==='label-intro'){const gate=labelGate();if(!gate||!labelScanReady())return;cancelSearch();for(const id of Array.from(identifying.keys()))await stopIdentify(id);results=[];searchState='idle';gate.state='intro';gate.note='';gate.hint='';gate.scan=null;error='';notice='';paintPage(false);return;}
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
          // C224: a tap chooses the zone and closes the window (the old window wanted a second, often grey, button).
          const zoneId=target.hasAttribute('data-without-zone')?null:target.dataset.id;
          const shut=()=>{receiverZoneSelection=undefined;const picker=container?.querySelector('[data-receiver-destination]');if(picker)picker.open=false;const dialog=picker?.querySelector('[data-onboarding-zone-dialog]');if(dialog?.open)dialog.close();openZonePickerOnNextPaint=false;};
          error='';
          if(zoneId===draft.activeZoneId&&draft.zoneChoiceRequired!==true){shut();paintPage(false);container?.querySelector('[data-receiver-destination]>summary')?.focus({preventScroll:true});return;}
          receiverZoneSelection=zoneId;
          return saveChoices([{type:'SELECT_ACTIVE_ZONE',zoneId}],shut,{top:false,focusDestination:true});
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
        // C137h: a reAdd candidate (factory reset, or an unfinished pairing that can never finish) is a fresh add; its old
        // parked intent belongs to the failed attempt and is never resumed (select forgets it natively).
        if(receiver.reAdd!==true&&(typeof services.resumeDraft==='function'||parkedChoices.has(receiver.id))){
          const token=++operation;busy=true;error='';paintPage(false);
          let restored=null,restoredSelectionVerified=false;
          try{
            const view=typeof services.resumeDraft==='function'?await services.resumeDraft({standId:draft.stand.id,receiverId:receiver.id,rid:receiver.rid,fingerprint:receiver.deviceFingerprint}):{draft:parkedChoices.get(receiver.id)};
            if(token!==operation||!container)return;
            if(view?.draft?.receiver){
              const saved=draftApi.snapshot(view.draft),identity=saved.receiver;
              if(saved.stand.id!==draft.stand.id||identity.id!==receiver.id||identity.rid!==receiver.rid||identity.type!==receiver.type||receiver.deviceFingerprint&&identity.deviceFingerprint!==receiver.deviceFingerprint)throw Error('IDENTITY_MISMATCH');
              restored=saved;
            }
          }catch(failure){if(token===operation){if(['V30_BINDING_INVALID','V30_CREDENTIAL_IMMUTABLE'].includes(failure?.code))bindingBlockedA7=true;error=calmProblemC127(connectionFailure(failure,{viaMain:draft.role==='node',network:receiverNetwork(),bluetooth:bluetoothFirst&&!draft.mainReceiverId}));return;}}
          finally{busy=false;paintPage(false);}
          if(token!==operation||!container)return;
          if(restored?.security.status==='not-started'&&typeof services.select==='function'){
            // Restoring choices never restores the native selected-candidate
            // lease. Reattest before painting a page that starts test light.
            busy=true;notice='Receiver veilig controleren…';paintPage(false);
            try{
              const verified=await bounded(selectWithRetryC137cc(services,{standId:restored.stand.id,transactionId:restored.transactionId,receiver:clone(receiver)}),services.selectionDeadlineMS?.(restored.stand.id)??50000);
              if(token!==operation||!container)return;
              if(!/^[A-F0-9]{64}$/.test(verified?.deviceFingerprint||'')||!['id','rid','type','deviceFingerprint'].every(key=>verified?.[key]===restored.receiver[key]))throw Object.assign(Error('IDENTITY_MISMATCH'),{code:'IDENTITY_MISMATCH'});
              restoredSelectionVerified=true;
            }catch(failure){if(token===operation&&!labelFailure(failure))error=calmProblemC127(connectionFailure(failure,{viaMain:draft.role==='node',network:receiverNetwork(),bluetooth:bluetoothFirst&&!draft.mainReceiverId}));return;}
            finally{if(token===operation){busy=false;notice='';paintPage(false);}}
            if(token!==operation||!container)return;
          }
          if(restored){
            parkedChoices.delete(receiver.id);parkedTransactions.delete(restored.transactionId);
            draft=restored;securityReceiptRef=null;finalReceiptRef=null;
            securityUncertain=draft.security.status!=='not-started';
            if(securityUncertain)draft=draftApi.snapshot({...clone(draft),stage:'security',security:{status:'pending',phase:'resuming'},cancelled:false});
            paintPage(true);
            if(securityUncertain)return secure(undefined,undefined,{reconcile:true,resumeFinalization:['zone','review'].includes(restored.stage)});
            // The native lease above is for this exact saved transaction;
            // service-less local demos retain their existing data-only flow.
            busy=true;
            try{
              const selectionVerified=restoredSelectionVerified||receiver.canConfigure!==false;
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
            }catch(failure){if(token===operation)error=calmProblemC127(connectionFailure(failure,{viaMain:draft.role==='node',network:receiverNetwork(),bluetooth:bluetoothFirst&&!draft.mainReceiverId}));return;}
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
            const verified=await bounded(selectWithRetryC137cc(services,{standId:draft.stand.id,transactionId:draft.transactionId,receiver:clone(expected)}),services.selectionDeadlineMS?.(draft.stand.id)??50000);
            if(token!==operation||!container||draft.stage!=='receiver')return;
            if(!verified||verified.id!==expected.id||verified.rid!==expected.rid||verified.type!==expected.type||!/^[A-F0-9]{64}$/.test(verified.deviceFingerprint)||expected.deviceFingerprint&&verified.deviceFingerprint!==expected.deviceFingerprint)throw Object.assign(Error('IDENTITY_MISMATCH'),{code:'IDENTITY_MISMATCH'});
            receiver={id:verified.id,rid:verified.rid,type:verified.type,name:expected.name,deviceFingerprint:verified.deviceFingerprint,canConfigure:true,canVerifyIdentity:true};
            // C118: the old member is gone natively; take the confirmed model
            // and continue exactly like a first-time add (nothing remembered).
            if(expected.reAdd===true){
              if(verified.forgotten!==true||!verified.view?.model||typeof onForgotten!=='function')throw Object.assign(Error('IDENTITY_MISMATCH'),{code:'IDENTITY_MISMATCH'});
              await onForgotten(verified.view.model,{receiverId:receiver.id});
              if(token!==operation||!container||draft.stage!=='receiver')return;
              const refreshed=draftApi.refreshZones(draft,getModel());
              if(refreshed.error)throw Object.assign(Error('DRAFT_REFRESH'),{code:'DRAFT_REFRESH'});
              draft=refreshed.draft;
            }
            results=results.map(item=>item.id===receiver.id?receiver:item);
          }catch(failure){if(token===operation&&!labelFailure(failure)){const problem=connectionFailure(failure,{viaMain:draft.role==='node',network:receiverNetwork(),bluetooth:bluetoothFirst&&!draft.mainReceiverId});error=calmProblemC127(problem);if(problem.expired){results=[];searchState='idle';}}return;}
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
        if(change({type:'SELECT_RECEIVER',receiver:candidate},{render:false})){plugMotion.clear();selectedOutput=null;if(pairFirstEnabled()&&candidate.type==='SPI')freshPairFirst.add(draft.transactionId);change({type:'NEXT'},{render:false});advancePairFirst();paintPage();if(draft.stage==='security')return secure();}return;
      }
      if(action==='count')return change({type:'SET_OUTPUT_COUNT',count:Number(target.dataset.count)});
      if(action==='output'){
        const output=draft.outputs.find(o=>o.port===Number(target.dataset.port));if(!output)return;
        const enabled=!output.enabled;
        if(change({type:'SET_OUTPUT_ENABLED',port:output.port,enabled},{render:false})){selectedOutput=output.port;plugMotion.trigger(output.port,globalThis.AluvisionPreviewNowPS(),enabled);}
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
        if(draft.stage==='placement')return saveChoices([{type:'SELECT_ZONE',zoneId},{type:'NEXT'}],()=>{advancePairFirst();if(draft.stage==='security')queueMicrotask(()=>secure());});
        if(pinRequired())return change({type:'SELECT_ZONE',zoneId});
        const selected=draftApi.transition(draft,{type:'SELECT_ZONE',zoneId});
        if(selected.error){error=selected.error.message;paintPage(false);return;}
        draft=selected.draft;return finishChosenZone();
      }
      if(action==='back'){
        if(finalizationStarted)return;
        // Flutter-welkom (16 nov): "← Zones beheren" in de scanstap van een nieuwe stand gaat terug naar de stap Zones van
        // Flutter (met de naam en zones van dit ontwerp), nooit naar het oude zonescherm van de WebApp.
        if(flutterStart&&draft.stage==='receiver'&&draft.stand?.isNew===true&&typeof onFlutterBack==='function'){
          cancelSearch();for(const id of identifying.keys())stopIdentify(id);labelAbort?.abort();firstScanAbort?.abort();
          if(onFlutterBack()===true)return;
        }
        if(draft.stage==='zones'&&!draft.stand.isNew){
          captureNames();
          if(hasZoneNames()&&!validZoneNames()){error='Maak de ingevulde zonenaam af of verwijder het lege veld. Je naam blijft staan.';paintPage(false);return;}
          const events=[...(hasZoneNames()?newZoneEvents():[]),{type:draft.zones.length||hasZoneNames()?'NEXT':'SKIP_ZONES'}];
          return saveChoices(events,()=>{resetZoneNames();zoneNameOpen=false;});
        }
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
      if(action==='security-retry')return firstPinCandidate686()&&!firstPinCurrent686()&&!securityUncertain?secure():automaticMain()?resumeAfterWifiReturn({force:true}):secure(undefined,undefined,{reconcile:true});
      if(action==='finish')return finish();
      if(action==='joint-directions'){queueJointDirections();return;}
      if(action==='done'){suspend();onExit({stand:true});return;}
      // C137bz (9 Nov, user): an RGBW joining a zone with other ledlines may set its place in the order right away.
      if(action==='order-now'){const zoneId=draft.zoneId;suspend();onExit({stand:true,orderZoneIdC137bz:zoneId});return;}
      if(action==='another'){labelScan=null;const activeZoneId=draft.zoneId;draft=null;start({activeZoneId});paintPage();if(draft.stage==='receiver')queueMicrotask(()=>{if(container&&draft.stage==='receiver'&&searchState==='idle'&&!busy)void search();});return;}
      if(action==='another-zone'){
        draft=null;start({activeZoneId:null});draft=draftApi.snapshot({...clone(draft),zoneChoiceRequired:true});
        return saveChoices([],()=>{openZonePickerOnNextPaint=true;},{top:true});
      }
    }
    // Only names, counts and the pending step for the Stand resume card; never
    // expose credentials, security receipts or unconfirmed receiver membership.
    function summary(){if(firstAccess&&firstAccess.phase!=='done'){const stand=getModel().stands.find(item=>item.id===firstAccess.identity.standId);return {stand:clone(stand),zones:clone(stand?.zones||[]),stage:'wifi-pin',activeZoneId:null,canManageZones:false};}return draft&&draft.stage!=='done'?{stand:clone(draft.stand),zones:clone(draft.zones),stage:draft.stage,claim:draft.security?.status!=='not-started',failCode:error&&koppelFoutC278?koppelFoutC278:null,receiverType:draft.receiver?.type||null,activeZoneId:draft.activeZoneId,canManageZones:canManageZones()}:null;}
    // Flutter-welkom (welkom.dart): standnaam en zones uit Flutter, dan meteen de stap "Eerste receiver" (scannen).
    // Zelfde gebeurtenissen als de knoppen "Verder · zones maken" en "Receiver toevoegen"; true als de scanstap klaarstaat.
    async function prepareStand({name,zones,startZone}={}){
      if(!draft||typeof name!=='string'||!validName(name.trim())||!Array.isArray(zones))return false;
      flutterStart=true; // al vóór het eerste beeld: nooit even het oude menu
      const names=zones.filter(z=>typeof z==='string'&&z.trim()).map(z=>z.trim()).slice(0,32);
      // 16 nov (iPhone 1041, "dat lukt nog niet"): native weigert saveDraft met busy zolang een radiohandeling loopt (de
      // zoektocht van een vorig ontwerp loopt nog even na). Dezelfde keuzes blijven klaarliggen (pendingChoices): opnieuw tot 8 s.
      const save=async(events,after)=>{
        for(let i=0;i<16;i++){
          if(!draftSaving){if(await saveChoices(events,after))return true;if(!pendingChoices)return false;}
          await new Promise(r=>setTimeout(r,500));
        }
        return false;
      };
      if(draft.stage==='stand'&&!(await save([{type:'SET_STAND',id:draft.stand?.id||'stand-'+uniqueId(),name:name.trim()},{type:'NEXT'}])))return false;
      if(draft.stage==='zones'){
        const known=new Set(draft.zones.map(z=>z.name.toLowerCase()));
        const events=names.filter(n=>!known.has(n.toLowerCase())).map(n=>({type:'ADD_ZONE',id:'zone-'+uniqueId(),name:n}));
        if(!events.length&&!draft.zones.length)return false;
        // precies zoals de knop "Receiver toevoegen" (ook het zoeken na het bewaren, alleen waar die knop het ook doet)
        if(!(await save([...events,{type:'NEXT'}],()=>{resetZoneNames();zoneNameOpen=false;
          if(!draft.mainReceiverId&&!pinRequired()&&(!manualWifi()||automaticFirstReceiver()))queueMicrotask(()=>{if(container&&draft.stage==='receiver')void search();});})))return false;
      }
      // startZone (Flutter): de eerste receiver gaat naar de zone die de klant bij Zones koos (zoals de zonekeuze van de scanstap)
      if(draft.stage==='receiver'&&typeof startZone==='string'&&!draft.receiver){
        const z=draft.zones.find(x=>x.name.toLowerCase()===startZone.trim().toLowerCase());
        if(z&&draft.activeZoneId!==z.id)await save([{type:'SELECT_ACTIVE_ZONE',zoneId:z.id}]);
      }
      if(draft.stage!=='receiver')flutterStart=false;
      return draft.stage==='receiver';
    }
    // De rondgang (Flutter, 16 nov): een receiver die al gescand is (QR in de rondgang) meteen toevoegen, zonder de scanstap opnieuw.
    // Een extra receiver gaat via het label (zoals labelScanRun na de camera); de eerste receiver van een stand via bluetooth op
    // precies die receiver (services.aimFirstReceiver), daarna dezelfde controle als na een scan.
    async function addScanned(scan){
      if(!draft||draft.stage!=='receiver'||busy||!scan||!['SPI','RGBW'].includes(scan.family)||!/^[0-9A-F]{12}$/.test(scan.physicalId||''))return false;
      if(draft.role==='node'){
        const gate=labelGate();if(!gate||['scanning','finding','connecting'].includes(gate.state))return false;
        gate.scan={family:scan.family,physicalId:scan.physicalId,proof:scan.proof===true};void labelFind(gate);return true;
      }
      if(typeof services.aimFirstReceiver!=='function')return false;
      try{const r=await services.aimFirstReceiver({family:scan.family,physicalId:scan.physicalId});if(r?.via==='bluetooth')bluetoothFirst=true;}catch(_){return false;}
      firstScan.family=scan.family;void search();return true;
    }
    // §3 (rondgang op de achtergrond): hoe staat de toevoeging na addScanned? state = de scanstap (finding, connecting, missing…),
    // busy = er loopt een stap, error = de pagina toont een fout. Alleen lezen.
    // claimed (C275, rondgang loslaten): de claim van deze receiver is begonnen (secure liep of loopt, of de draft is voorbij de
    // receiver-/PIN-stap). Dan mag de rondgang ze nooit meer loslaten: een begonnen claim verdwijnt niet stil.
    function roundState(){return {state:labelScan?.state||null,busy:!!busy,error:!!error,stage:draft?.stage||null,
      claimed:!!draft&&(securityUncertain||finalizationStarted||!['receiver','pin'].includes(draft.stage))};}
    return Object.freeze({mount,suspend,reset,paint,restore,restoreFirstStandAccess,summary,readOnlySearchSuspended,canContinueLocalConcept,continueLocalConcept,prepareStand,addScanned,roundState});
  }
  return Object.freeze({create,firstAccessFailure});
}));
