/* Web-gastheer: de opbouw van de telefoon in de browser (tools/test/flutter-web/demo-bouw.sh → build/flutter-web/demo-site).
 * Onderaan de echte WebApp (demo-modus) in een iframe, erboven de Flutter-app (#flutter-laag), erover het startbeeld.
 * Dit bestand speelt de rol van apps/iPhone_App/AluvisionLighting/V30FlutterHost.swift: waar iPhone en Android verschillen,
 * volgt het de iPhone (open/command/zone wachten op de WebApp, Flutter gaat alleen opzij als open() true gaf).
 *  - Flutter → gastheer: web_gastheer.dart roept alvWebGastheer.roep(kanaal, methode, argsJSON) en krijgt {"w":…} of
 *    {"nietGekend":true} terug (= MissingPluginException).
 *  - WebApp → gastheer: web-gastheer-app.js (in het iframe) post {alvGastheer:1, tekst:JSON} zoals AluvisionFlutterHost.
 *  - gastheer → Flutter: 'show', 'viewChanged', 'melding' via de functie die Flutter meegeeft in flutterKlaar().
 * De demo bewaart niets: geen localStorage, geen sessionStorage, geen service worker (sdlvisuals.github.io is één oorsprong
 * voor alle repo's). aluvision/opslag leeft in het geheugen, zoals de opslag van de WebApp-demo zelf.
 * alvWebGastheer.log: elke oproep en elk bericht (voor demo-controle.mjs). */
(function(){
  'use strict';
  // Exacte kopieën uit V30FlutterHost.swift (screens, webAppCalls, zoneOps). Verandert daar iets, dan hier ook:
  // demo-bouw.sh vergelijkt ze bij elke bouw en stopt als ze verschillen.
  const SCHERMEN=new Set(['stand','bereik','zone','instellingen','welkom','scenes','receivers','rondgang','terug','nieuwe-stand','opnieuw','koppelen']);
  const WEBAPP_CALLS=new Set(['newStand','receiverArtLed','receiverLinesArt','roundNewZone','setupScreen','setupOp','restoreBackup','currentStand','receiverArt','dialogData','dialogOp','sceneScreen','sceneOp','scenesData','sceneAction','openErase','standData','standOp','preferences','setPreferences','receiversData','receiverOp','roundData','roundQueue','roundScan','roundAdd','roundSteps','roundStep','settingsData','settingsOp','usersData','usersSave','backupRestore','backupImport','autoData','autoSave','autoStatus','shareOpen','accessData','accessOp','inviteShare','inviteTake','invitePassword','orderData','orderLight','orderSave','orderClose','pixelData','pixelLight','pixelSave','pixelClose','whiteTint','erasePlan','eraseDo','roundCue','roundRun','lightModel','adoptLight','beheer','pairScreen','pairOp']);
  const ZONE_OPS=new Set(['colour','brightness','effect','setting','direction','toggle','reset','power','palette','paletteAdd','paletteRemove','backgroundToggle','savedColourUse','colourSave','savedColourRemove','presetUse','presetSave','presetRemove','gradientStart','gradientColour','gradientAdd','gradientRemove','gradientMove','gradientSelect','gradientEven','gearLayout','gearRename','gearOrder','gearMoveReceiver','gearAddReceiver','gearDelete','gearJoin','gearTiming']);
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
    if(zichtbaar){
      try{W()?.document.activeElement?.blur?.();}catch(_){}
      naarFlutter('viewChanged',null);
    }else{
      // toetsen moeten weer in de WebApp terechtkomen (een invulveld in het iframe)
      try{document.activeElement?.blur?.();}catch(_){}
      try{W()?.focus();}catch(_){}
    }
  }

  // ---------- WebApp → gastheer (userContentController in V30FlutterHost) ----------
  function verwerk(body){
    if(body.close==='flutter'){zetFlutter(false);eindeStart(0);return;}
    if(body.first==='webapp'){
      // Vangnet zolang de demo van de WebApp op 'receiver-add' begint (app.js, regel met setupFrom:'stand'): zonder stand toont de
      // telefoon het Flutter-welkom, nooit de oude setup-pagina. Met een stand: de WebApp toont zelf haar eerste scherm.
      if(!geenStand()){eindeStart(0);return;}
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
    if(!d||d.alvGastheer!==1||typeof d.tekst!=='string'||d.tekst.length>1200)return;
    let body;try{body=JSON.parse(d.tekst);}catch(_){return;}
    if(!body||typeof body!=='object'||Array.isArray(body))return;
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
    // het ontwerp van een stand in opbouw, zodra de WebApp het geeft (een onbekende naam geeft null)
    try{const d=await w.LightningHost.call('setupDraft',w.JSON.parse('{}'));if(d&&typeof d==='object'&&!Array.isArray(d))draft=JSON.parse(JSON.stringify(d));}catch(_){draft=null;}
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
  function opslagRoep(methode,args,ongeldig){
    const a=!ongeldig&&args&&typeof args==='object'&&!Array.isArray(args)?args:{};
    const s=typeof a.sleutel==='string'&&RE_SLEUTEL.test(a.sleutel)?a.sleutel:null;
    switch(methode){
      case 'lees':return s!==null&&opslag.has(s)?opslag.get(s):null;
      case 'schrijf':
        if(s===null||typeof a.waarde!=='string'||new TextEncoder().encode(a.waarde).length>MAX_WAARDE)return false;
        opslag.set(s,a.waarde);return opslag.get(s)===a.waarde;
      case 'wis':if(s===null)return false;opslag.delete(s);return !opslag.has(s);
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
    f.addEventListener('load',()=>noteer('gastheer','webapp','geladen',f.contentWindow?.location?.pathname||''));
    f.src='webapp/demo/index.html'+window.location.search;
  }
})();
