/* Web-gastheer: de opbouw van de telefoon in de browser (tools/test/flutter-web/demo-bouw.sh → build/flutter-web/demo-site).
 * Onderaan de echte WebApp (demo-modus) in een iframe, erboven de Flutter-app (#flutter-laag), erover het startbeeld.
 * Dit bestand speelt de rol van apps/iPhone_App/AluvisionLighting/V30FlutterHost.swift: waar iPhone en Android verschillen,
 * volgt het de iPhone (open/command/zone wachten op de WebApp, Flutter gaat alleen opzij als open() true gaf).
 *  - Flutter → gastheer: web_gastheer.dart roept alvWebGastheer.roep(kanaal, methode, argsJSON) en krijgt {"w":…} of
 *    {"nietGekend":true} terug (= MissingPluginException).
 *  - WebApp → gastheer: web-gastheer-app.js (in het iframe) post {alvGastheer:1, tekst:JSON} zoals AluvisionFlutterHost.
 *  - gastheer → Flutter: 'show', 'viewChanged', 'melding' via de functie die Flutter meegeeft in flutterKlaar().
 *  - de nagemaakte native schermen van de WebApp-demo (camera, PIN): zolang er één open staat, komt het iframe boven Flutter
 *    (pasNatiefToe), zoals native die schermen op een toestel bovenop alles zet.
 * De demo bewaart niets: geen localStorage, geen sessionStorage, geen service worker (sdlvisuals.github.io is één oorsprong
 * voor alle repo's). aluvision/opslag leeft in het geheugen, zoals de opslag van de WebApp-demo zelf.
 * alvWebGastheer.log: elke oproep en elk bericht (voor demo-controle.mjs). */
(function(){
  'use strict';
  // Exacte kopieën uit V30FlutterHost.swift (screens, webAppCalls, zoneOps). Verandert daar iets, dan hier ook:
  // demo-bouw.sh vergelijkt ze bij elke bouw en stopt als ze verschillen.
  const SCHERMEN=new Set(['stand','bereik','zone','instellingen','welkom','scenes','receivers','rondgang','terug','nieuwe-stand','opnieuw','koppelen','inladen','deellink']);
  const WEBAPP_CALLS=new Set(['newStand','standLoad','backupConfirm','standLinkOpen','receiverArtLed','receiverLinesArt','roundNewZone','setupScreen','setupOp','restoreBackup','currentStand','receiverArt','dialogData','dialogOp','sceneScreen','sceneOp','scenesData','sceneAction','openErase','standData','standOp','preferences','setPreferences','receiversData','receiverOp','roundData','roundQueue','roundScan','roundAdd','roundSteps','roundStep','settingsData','settingsOp','usersData','usersSave','backupRestore','backupImport','autoData','autoSave','autoStatus','shareOpen','accessData','accessOp','inviteShare','inviteTake','invitePassword','orderData','orderLight','orderSave','orderClose','pixelData','pixelLight','pixelSave','pixelClose','whiteTint','erasePlan','eraseDo','roundCue','roundRun','lightModel','adoptLight','beheer','pairScreen','pairOp','pixelTutorial','orderTutorial','receiversTutorial','scanTutorial','zoneTutorial','tutorialAsk']);
  const ZONE_OPS=new Set(['colour','select','brightness','effect','setting','direction','toggle','reset','power','palette','paletteAdd','paletteRemove','backgroundToggle','savedColourUse','colourSave','savedColourRemove','presetUse','presetSave','presetRemove','gradientStart','gradientColour','gradientAdd','gradientRemove','gradientMove','gradientSelect','gradientEven','gearLayout','gearRename','gearOrder','gearMoveReceiver','gearAddReceiver','gearDelete','gearJoin','gearTiming']);
  const RE_SCHERM=/^[a-z][a-z-]{1,40}$/,RE_ID=/^[A-Za-z0-9._:-]{1,96}$/,RE_V30_ID=/^v30-[A-F0-9]{32}-[1-9][0-9]{0,12}$/,RE_SLEUTEL=/^[A-Za-z0-9._:/@+-]{1,160}$/,RE_ACTIE=/^[A-Za-z][A-Za-z0-9]{0,63}$/;
  const MAX_WAARDE=2000000,NIET_GEKEND=Symbol('nietGekend');
  const START_VANGNET_MS=3000,START_MAX_MS=20000,WEBAPP_MAX_MS=20000,LOADVIEW_WACHT_MS=5000;

  // ---------- logboek (alleen in het geheugen; geen PIN of wachtwoord) ----------
  const log=[];
  const GEHEIM=/pin|password|wachtwoord|secret|geheim/i;
  const kort=v=>{try{const s=typeof v==='string'?v:JSON.stringify(v,(k,x)=>k&&GEHEIM.test(k)?'…':x);if(s===undefined)return String(v);return s.length>300?s.slice(0,300)+'…':s;}catch(_){return String(v);}};
  function noteer(richting,kanaal,methode,args,antwoord){
    const e={t:Math.round(performance.now()),richting,kanaal,methode};
    if(args!==undefined)e.args=kort(args);
    if(antwoord!==undefined)e.antwoord=kort(antwoord);
    log.push(e);if(log.length>4000)log.splice(0,log.length-4000);
  }

  // ---------- de WebApp in het iframe ----------
  const $=id=>document.getElementById(id);
  const frame=()=>$('webapp');
  const W=()=>{try{return frame()?.contentWindow||null;}catch(_){return null;}};
  // altijd vers: na een herlaad van het iframe (bv. de onboarding die opnieuw opent) is het een nieuw venster
  const klaarW=()=>{const w=W();try{return w&&typeof w.LightningHost?.call==='function'?w:null;}catch(_){return null;}};
  function wachtOpWebApp(ms){
    return new Promise(klaar=>{const tot=performance.now()+ms;(function kijk(){const w=klaarW();if(w)return klaar(w);if(performance.now()>=tot)return klaar(null);setTimeout(kijk,100);})();});
  }
  // wat de WebApp krijgt, maken we in haar eigen venster (app.js gebruikt Array.isArray, M.assertValid, …)
  const inWebApp=(w,v)=>v===undefined?undefined:w.JSON.parse(JSON.stringify(v));
  const geenStand=()=>{const w=klaarW();try{return !!w&&w.__lightningHasStand?.()===false;}catch(_){return false;}};

  // ---------- startbeeld (V30FlutterHost.showStart / endStart) ----------
  let startWeg=false;
  function eindeStart(ms){
    if(startWeg)return;
    if(ms>0){setTimeout(()=>eindeStart(0),ms);return;}
    startWeg=true;noteer('gastheer','start','einde');
    const s=$('startbeeld');if(!s)return;
    s.classList.add('weg');setTimeout(()=>s.remove(),220);
  }
  setTimeout(()=>eindeStart(0),START_MAX_MS); // nooit vast op het startbeeld, wat er ook gebeurt

  // ---------- de Flutter-laag (setFlutterVisible) ----------
  let flutterZichtbaar=false,naarFlutterFn=null,flutterIsKlaar=false;
  const wachtrij=[];
  function naarFlutter(methode,args){
    noteer('gastheer→flutter','aluvision/host',methode,args===null?'null':args);
    if(!naarFlutterFn)return;
    try{naarFlutterFn(methode,args==null?null:JSON.stringify(args));}catch(e){noteer('gastheer','fout',methode,String(e));}
  }
  function zetFlutter(zichtbaar){
    if(flutterZichtbaar===zichtbaar)return;
    flutterZichtbaar=zichtbaar;
    $('flutter-laag')?.classList.toggle('zichtbaar',zichtbaar);
    noteer('gastheer','laag',zichtbaar?'flutter-voor':'flutter-opzij');
    pasNatiefToe(); // een nagemaakt native scherm dat open staat, blijft bovenaan (ook als Flutter nu naar voren komt)
    if(zichtbaar){
      if(!natiefBoven)try{W()?.document.activeElement?.blur?.();}catch(_){}
      naarFlutter('viewChanged',null);
    }else{
      // toetsen moeten weer in de WebApp terechtkomen (een invulveld in het iframe)
      try{document.activeElement?.blur?.();}catch(_){}
      try{W()?.focus();}catch(_){}
    }
  }

  // ---------- de nagemaakte native schermen van de demo (camera, PIN) boven Flutter ----------
  // Op een toestel opent native de camera (QR-code scannen) en het PIN-scherm (eerste PIN, wifi-gegevens) bovenop alles, ook
  // bovenop Flutter. De WebApp-demo maakt die schermen na als DOM in het iframe (web-demo-service.js: [data-demo-camera] en
  // .dp[data-demo-phone], allebei rechtstreeks in body). Zolang er één open staat terwijl Flutter vooraan staat, komt het iframe
  // boven de Flutter-laag en is van de WebApp alleen dat scherm te zien: de rest onzichtbaar, de achtergrond doorzichtig, zodat
  // Flutter te zien blijft onder een half doorzichtig blad (het Android-blad), zoals onder het native blad op een toestel.
  // Flutter zelf merkt niets (geen show, geen viewChanged, flutterZichtbaar blijft true): de koppelstap blijft de app lezen en
  // staat na het sluiten meteen op de volgende stap. De MutationObserver loopt vóór het volgende beeld: bij openen en sluiten
  // flitst de WebApp-pagina er nooit tussen.
  const NATIEF=':scope>[data-demo-camera],:scope>[data-demo-phone]';
  const NATIEF_CSS='html,body{background:transparent!important}'+
    'body>:not([data-demo-camera]):not([data-demo-phone]),body::before,body::after{visibility:hidden!important}';
  let natiefBoven=false,natiefWelk=null,natiefKijker=null;
  // welk nagemaakt scherm staat open: 'camera', 'pin', 'pin-card', 'settings' of null
  function welkNatief(){
    try{const e=W()?.document?.body?.querySelector(NATIEF);return e?(e.hasAttribute('data-demo-camera')?'camera':e.getAttribute('data-demo-phone')||'telefoon'):null;}catch(_){return null;}
  }
  function pasNatiefToe(){
    const scherm=welkNatief(),boven=!!scherm&&flutterZichtbaar;
    if(boven===natiefBoven)return;
    natiefBoven=boven;
    const was=natiefWelk;natiefWelk=boven?scherm:null;
    const f=frame(),laag=$('flutter-laag');
    let d=null;try{d=W()?.document||null;}catch(_){d=null;}
    $('toestel')?.classList.toggle('natief-boven',boven);
    if(laag)laag.inert=boven; // tikken en toetsen gaan naar het nagemaakte scherm, niet naar Flutter eronder
    try{
      d?.querySelector('style[data-alv-gastheer-natief]')?.remove();
      if(boven&&d){const s=d.createElement('style');s.dataset.alvGastheerNatief='';s.textContent=NATIEF_CSS;d.head.append(s);}
    }catch(_){}
    // een doorzichtig iframe blijft alleen doorzichtig als het dezelfde color-scheme heeft als zijn element (anders tekent Chrome
    // er een effen vlak achter)
    if(f){try{f.style.colorScheme=boven&&d?W().getComputedStyle(d.documentElement).colorScheme:'';}catch(_){f.style.colorScheme='';}}
    if(boven){
      // de toetsen naar het nagemaakte scherm, met de focus die het zelf zette (het PIN-veld, de knop van de camera)
      try{const binnen=d?.activeElement;f?.focus();if(binnen&&binnen!==d.body&&d.activeElement!==binnen)binnen.focus({preventScroll:true});}catch(_){}
    }
    else if(flutterZichtbaar){try{d?.activeElement?.blur?.();}catch(_){}try{f?.blur();}catch(_){}}
    noteer('gastheer','laag',boven?'natief-boven':'natief-weg',(boven?scherm:was)||'');
  }
  // per document van het iframe (het kan herladen): kijken wat er rechtstreeks in body komt en gaat
  function kijkNatief(){
    try{natiefKijker?.disconnect();}catch(_){}
    natiefKijker=null;
    try{const d=W()?.document;if(d?.body){natiefKijker=new MutationObserver(pasNatiefToe);natiefKijker.observe(d.body,{childList:true});}}catch(_){}
    pasNatiefToe();
  }

  // ---------- WebApp → gastheer (userContentController in V30FlutterHost) ----------
  function verwerk(body){
    if(body.close==='flutter'){zetFlutter(false);eindeStart(0);return;}
    if(body.first==='webapp'){
      // Vangnet zolang de demo van de WebApp op 'receiver-add' begint (app.js, regel met setupFrom:'stand'): zonder stand toont de
      // telefoon het Flutter-welkom, nooit de oude setup-pagina. Met een stand: de WebApp toont zelf haar eerste scherm.
      // Generale repetitie 17 nov: ook niet tijdens de setup van een nieuwe stand (na newStand is de scanstap het eerste scherm van
      // de WebApp); de iPhone doet bij 'first' alleen het startbeeld weg, de koppelstap staat dan al in Flutter.
      let nieuw=false;try{nieuw=W()?.__lightningNewStandSetup?.()===true;}catch(_){}
      if(!geenStand()||nieuw){eindeStart(0);return;}
      noteer('gastheer','vangnet','welkom','first:webapp zonder stand');
      body={open:'flutter',screen:'welkom'};
    }
    if(typeof body.melding==='string'){
      const t=body.melding;
      if(flutterZichtbaar&&t.length>0&&t.length<=400)naarFlutter('melding',{tekst:t});
      return;
    }
    if(body.open!=='flutter')return;
    const scherm=typeof body.screen==='string'?body.screen:'stand';
    if(!SCHERMEN.has(scherm))return;
    naarFlutter('show',{screen:scherm});
    zetFlutter(true);
    eindeStart(250); // Flutter even de tijd voor het eerste beeld van dat scherm
  }
  window.addEventListener('message',e=>{
    const w=W();
    if(!w||e.source!==w||e.origin!==window.location.origin)return;
    const d=e.data;
    // een opslag-bericht mag groter (bibliotheken, scènes: tot MAX_WAARDE); al de rest blijft kort
    if(!d||d.alvGastheer!==1||typeof d.tekst!=='string'||d.tekst.length>(SPIEGEL&&d.tekst.startsWith('{"opslag"')?MAX_WAARDE+400:1200))return;
    let body;try{body=JSON.parse(d.tekst);}catch(_){return;}
    if(!body||typeof body!=='object'||Array.isArray(body))return;
    // een schrijfactie van de WebApp (opslag-spiegel.js): native bewaren, niets voor Flutter
    if(body.opslag&&Object.keys(body).length===1){noteer('webapp→gastheer','opslag',body.opslag.waarde===null?'wis':'schrijf',body.opslag.sleutel);spiegelBericht(body.opslag);return;}
    noteer('webapp→gastheer','lightningHost','bericht',body);
    // vóór het eerste beeld van Flutter luistert Brug nog niet (ui.channelBuffers houdt maar 1 bericht per kanaal)
    if(!flutterIsKlaar){wachtrij.push(body);return;}
    verwerk(body);
  });

  // ---------- aluvision/v30 ----------
  let revisie=0,laatsteModel=null;
  const leegModel=()=>({schemaVersion:30,demo:true,stands:[],receivers:[],scenes:[],presets:[]});
  async function laadView(id){
    const w=await wachtOpWebApp(LOADVIEW_WACHT_MS);
    if(!w)return {version:1,id,ok:false,code:'NATIVE_UNAVAILABLE'};
    let model=null,draft=null;
    // native kent alleen een echte stand: een lokaal concept van de WebApp (__lightningHasStand false) komt er nooit in
    try{if(w.__lightningHasStand?.()===true){const lm=await w.LightningHost.call('lightModel',w.JSON.parse('{}'));if(lm&&lm.model&&typeof lm.model==='object')model=JSON.parse(JSON.stringify(lm.model));}}catch(_){model=null;}
    // het ontwerp van een stand in opbouw, zoals native het geeft ({stand:{id,name}, zones:[{id,name}]}): in de demo uit het
    // ontwerp van de WebApp (window.__lightningSetupDraft, onboarding.summary), alleen zolang er nog geen echte stand is. Zo komt
    // "← Zones beheren" in de scanstap terug met de naam en de zones (welkom.dart _leesOntwerp).
    try{
      if(!model){const t=w.__lightningSetupDraft?.();if(typeof t==='string'){const d=JSON.parse(t);if(d&&d.stand&&typeof d.stand.name==='string')draft=d;}}
    }catch(_){draft=null;}
    if(!model)model=leegModel();
    const tekst=JSON.stringify(model);
    if(tekst!==laatsteModel){laatsteModel=tekst;revisie++;}
    return {version:1,id,ok:true,result:{revision:revisie,model,draft}};
  }
  async function v30(methode,args,ongeldig){
    const id=args&&typeof args==='object'&&typeof args.id==='string'?args.id:null;
    const nee=code=>({version:1,id,ok:false,code});
    if(methode!=='call'||ongeldig||!args||typeof args!=='object'||Array.isArray(args))return nee('NATIVE_INVALID_REQUEST');
    if(args.version!==1||!RE_V30_ID.test(id||'')||typeof args.action!=='string'||!RE_ACTIE.test(args.action))return nee('NATIVE_INVALID_REQUEST');
    if(args.payload!=null&&(typeof args.payload!=='object'||Array.isArray(args.payload)))return nee('NATIVE_INVALID_REQUEST');
    if(args.action==='loadView')return laadView(id);
    // backupStatus, mainLink, setConnectionChoice, applyLive, identify, …: de demo heeft geen telefoon en geen receiver.
    // Zelfde fout als zonder gastheer: elk Flutter-scherm neemt zijn rustige weg "niet beschikbaar".
    return nee('NATIVE_UNAVAILABLE');
  }

  // ---------- aluvision/host ----------
  async function host(methode,args,ongeldig){
    const a=!ongeldig&&args&&typeof args==='object'&&!Array.isArray(args)?args:{};
    switch(methode){
      case 'openWebApp':{
        const scherm=typeof a.screen==='string'?a.screen:null,id=typeof a.id==='string'?a.id:undefined;
        const w=klaarW();
        if(!w||!scherm||!RE_SCHERM.test(scherm)||(id!==undefined&&!RE_ID.test(id)))return false;
        let ok=false;try{ok=(await w.LightningHost?.open(scherm,id))===true;}catch(_){ok=false;}
        if(ok)zetFlutter(false); // anders blijft Flutter staan: nooit een leeg scherm
        return ok;
      }
      case 'webAppCommand':{
        const actie=typeof a.action==='string'?a.action:null,id=typeof a.id==='string'?a.id:undefined;
        const w=klaarW();
        if(w&&actie&&RE_SCHERM.test(actie)&&(id===undefined||RE_ID.test(id))){try{await w.LightningHost?.command(actie,id);}catch(_){}}
        // de WebApp stuurt het licht; geef haar even tijd en laat Flutter dan het nieuwe model lezen
        setTimeout(()=>naarFlutter('viewChanged',null),400);
        return null;
      }
      case 'hide':
        zetFlutter(false);return null;
      case 'webAppCall':{
        if(ongeldig||typeof a.name!=='string'||!WEBAPP_CALLS.has(a.name))return null;
        const w=klaarW();if(!w)return null;
        try{const r=await w.LightningHost?.call(a.name,inWebApp(w,a.args??{}));return r==null?null:JSON.stringify(r);}catch(_){return null;}
      }
      case 'zoneData':{
        if(typeof a.id!=='string'||!RE_ID.test(a.id))return null;
        const w=klaarW();if(!w)return null;
        try{const v=await w.LightningHost?.zoneData(a.id);return typeof v==='string'?v:null;}catch(_){return null;}
      }
      case 'zone':{
        if(ongeldig||typeof a.id!=='string'||!RE_ID.test(a.id)||typeof a.op!=='string'||!ZONE_OPS.has(a.op))return false;
        const w=klaarW();if(!w)return false;
        try{return (await w.LightningHost?.zone(a.id,a.op,inWebApp(w,a.value??null)))===true;}catch(_){return false;}
      }
      default:return NIET_GEKEND;
    }
  }

  // ---------- aluvision/opslag (V30Opslag.swift, in het geheugen) ----------
  const opslag=new Map();
  // Stap 1 opslag zonder WebView (docs/opslag-zonder-webview.md), alleen met ?opslag=1: dit geheugen is de bron (zoals native),
  // de opslag van de WebApp de spiegel (apps/WebApp/opslag-spiegel.js). Wat de WebApp schrijft komt hier binnen als {opslag};
  // wat Dart schrijft gaat met __alvOpslagZet naar de spiegel. Een herlaad van de app begint met deze waarden (opslagAlles).
  const SPIEGEL=/[?&]opslag=1(?:&|$)/.test(window.location.search);
  function spiegelZet(sleutel,waarde){if(!SPIEGEL)return;try{W()?.__alvOpslagZet?.(sleutel,waarde);}catch(_){}}
  function spiegelBericht(o){
    if(!SPIEGEL||!o||typeof o!=='object'||typeof o.sleutel!=='string'||!RE_SLEUTEL.test(o.sleutel))return;
    if(o.waarde===null)opslag.delete(o.sleutel);
    else if(typeof o.waarde==='string'&&new TextEncoder().encode(o.waarde).length<=MAX_WAARDE)opslag.set(o.sleutel,o.waarde);
  }
  function opslagRoep(methode,args,ongeldig){
    const a=!ongeldig&&args&&typeof args==='object'&&!Array.isArray(args)?args:{};
    const s=typeof a.sleutel==='string'&&RE_SLEUTEL.test(a.sleutel)?a.sleutel:null;
    switch(methode){
      case 'lees':return s!==null&&opslag.has(s)?opslag.get(s):null;
      case 'schrijf':
        if(s===null||typeof a.waarde!=='string'||new TextEncoder().encode(a.waarde).length>MAX_WAARDE)return false;
        opslag.set(s,a.waarde);spiegelZet(s,a.waarde);return opslag.get(s)===a.waarde;
      case 'wis':if(s===null)return false;opslag.delete(s);spiegelZet(s,null);return !opslag.has(s);
      case 'alles':return Object.fromEntries(opslag);
      // het iframe is niet de eigen oorsprong van een app: niets over te nemen, niets te wissen
      case 'webviewLees':return null;
      case 'webviewWis':return [];
      default:return NIET_GEKEND;
    }
  }

  // ---------- wat Flutter (web_gastheer.dart) en de controle gebruiken ----------
  Object.defineProperty(window,'__alvWebGastheer',{value:true,writable:false,configurable:false});
  window.alvWebGastheer=Object.freeze({
    log,
    get flutterZichtbaar(){return flutterZichtbaar;},
    get startbeeld(){return !startWeg;},
    // het nagemaakte native scherm dat open staat ('camera', 'pin', …, of null) en of het iframe daarvoor boven Flutter staat
    get natiefScherm(){return welkNatief();},
    get natiefBoven(){return natiefBoven;},
    // stap 1 opslag (?opslag=1): de bewaarde waarden voor de spiegel bij de start van de app (opslag-spiegel.js)
    opslagAlles(){return SPIEGEL?Object.fromEntries(opslag):{};},
    async roep(kanaal,methode,argsJson){
      let ongeldig=typeof argsJson!=='string',args=null;
      if(!ongeldig){try{args=JSON.parse(argsJson);}catch(_){ongeldig=true;}}
      let w;
      try{
        w=kanaal==='aluvision/v30'?await v30(methode,args,ongeldig)
          :kanaal==='aluvision/host'?await host(methode,args,ongeldig)
          :kanaal==='aluvision/opslag'?opslagRoep(methode,args,ongeldig)
          :NIET_GEKEND;
      }catch(e){
        noteer('gastheer','fout',methode,String(e));
        w=kanaal==='aluvision/v30'?{version:1,id:args?.id??null,ok:false,code:'NATIVE_FAILED'}:null;
      }
      noteer('flutter→gastheer',kanaal,methode,kanaal==='aluvision/opslag'?args?.sleutel:args,w===NIET_GEKEND?'nietGekend':w===undefined?null:w);
      return JSON.stringify(w===NIET_GEKEND?{nietGekend:true}:{w:w===undefined?null:w});
    },
    webAppKlaar(){return wachtOpWebApp(WEBAPP_MAX_MS).then(w=>{noteer('gastheer','webapp',w?'klaar':'niet-klaar');return null;});},
    flutterKlaar(fn){
      if(flutterIsKlaar||typeof fn!=='function')return;
      naarFlutterFn=fn;flutterIsKlaar=true;
      noteer('gastheer','flutter','klaar',wachtrij.length+' in de wachtrij');
      setTimeout(()=>eindeStart(0),START_VANGNET_MS); // het vangnet van de telefoon, gerekend vanaf Flutter klaar
      for(const b of wachtrij.splice(0))verwerk(b);
    },
  });

  // ---------- het iframe pas nu laden: het script hierboven staat klaar voor de eerste berichten ----------
  const f=frame();
  if(f){
    f.addEventListener('load',()=>{noteer('gastheer','webapp','geladen',f.contentWindow?.location?.pathname||'');kijkNatief();});
    f.src='webapp/demo/index.html'+window.location.search;
  }
})();
