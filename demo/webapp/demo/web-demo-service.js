/* Browser-only walkthrough for the separately published /demo/ page.
 * These receipts are IN-MEMORY UI fixtures, never receiver or ownership proof.
 * The native iPhone app and the public root page do not use this service. */
(function(root){
  'use strict';
  const path=root.location?.pathname||'';
  const native=root.__lightningV30NativeHost===true||root.location?.protocol==='file:'||root.LightningNativeRuntime?.native===true;
  const available=!native&&root.AluvisionSecurityMode?.pinRequired===false&&/(?:^|\/)demo\/(?:index\.html)?$/.test(path);
  // A person gets the real walkthrough; the test bench (headless Chrome) keeps the short route it always had.
  // ?echt=1 or ?snel=1 in the URL forces one of the two.
  const query=new URLSearchParams(root.location?.search||'');
  const walkthrough=available&&(query.get('echt')==='1'||query.get('snel')!=='1'&&!/HeadlessChrome/.test(root.navigator?.userAgent||''));
  const copy=value=>JSON.parse(JSON.stringify(value));
  function create(){
    if(!available)throw Error('WEB_DEMO_UNAVAILABLE');
    // /demo/ shares an origin with the public root. Never touch that origin's
    // localStorage or sessionStorage: the walkthrough resets on page reload.
    const memory=new Map();
    // opslag-spiegel.js (stap 1, alleen met ?opslag=1): de bewaarde waarden van de gastheer vooraf, elke schrijfactie gemeld,
    // en wat Dart schreef in dit geheugen (__alvOpslagDoel). Zonder spiegel verandert er niets.
    const spiegel=window.__alvOpslagNatief===true;
    if(spiegel)for(const [k,v] of Object.entries(window.__alvOpslagBegin||{}))if(typeof v==='string')memory.set(k,v);
    const meld=(k,v)=>{if(spiegel)try{window.__alvOpslagMeld?.(k,v);}catch(_){}};
    const storage=Object.freeze({
      getItem:key=>memory.has(String(key))?memory.get(String(key)):null,
      setItem:(key,value)=>{memory.set(String(key),String(value));meld(String(key),String(value));},
      removeItem:key=>{memory.delete(String(key));meld(String(key),null);},
      clear:()=>{const ks=[...memory.keys()];memory.clear();ks.forEach(k=>meld(k,null));}
    });
    if(spiegel)window.__alvOpslagDoel=(k,v)=>{if(v==null)memory.delete(k);else memory.set(k,v);};
    // Ten of each family can be added during a walkthrough. Keep the original
    // four identities stable; the additional identities are deterministic UI
    // fixtures too, never physical device fingerprints or security evidence.
    const legacyFingerprints=['A','B','C','D'];
    const units=Array.from({length:20},(_,index)=>{
      const type=index%2?'SPI':'RGBW',number=Math.floor(index/2)+1;
      const serial=(index+1).toString(16).toUpperCase();
      return {
        id:`demo-${type.toLowerCase()}-${number}`,
        rid:`D${serial.padStart(15,'0')}`,
        deviceFingerprint:index<4?legacyFingerprints[index].repeat(64):serial.padStart(64,'0'),
        type,name:`Demo ${type} ${number}`,
        // C214: the address on the receiver's QR label (12 hex), as the stand search reports it.
        physicalId:'D0'+serial.padStart(10,'0')
      };
    });
    // C214: fake camera for the scan step. Tests steer it through window.__alvDemoScan:
    //   {mode:'ok'|'cancel'|'denied'|'busy'|'unavailable'|'missing'|'family', family:'SPI'|'RGBW', unit:'demo-rgbw-7', delay:ms,
    //    secureDelay:<ms> (the connecting screen stays in view that long),
    //    requireLabel:true (a receiver chosen from the list answers RECEIVER_LABEL_REQUIRED until it is scanned),
    //    invalidOnce:true (the next select answers RECEIVER_LABEL_INVALID once), hidePhysicalId:true,
    //    prepareFailOnce:true (the next first-PIN preparation fails once with MAIN_CONNECTION_UNAVAILABLE; nazicht 1061 K3)}
    const chosen=new Set(),scanned=new Set();
    const demoScan=()=>root.__alvDemoScan&&typeof root.__alvDemoScan==='object'?root.__alvDemoScan:{};
    const fail=code=>Object.assign(Error(code),{code});
    // ---- Real walkthrough (12 Nov, user: "everything must look like the real thing") --------------------------------
    // A person who opens the demo gets the same screens, in the same order, as a customer with a real phone. Those
    // screens are the app's own (onboarding-ui.js, first-pin-v2.js): nothing is redrawn here. This service only plays
    // what happens OUTSIDE the page on a real device: the phone app's own PIN page, the phone's Wi-Fi settings and the
    // receiver itself.
    //  - phone: which Wi-Fi it is on. "Instellingen › Wifi" is a stand-in screen, opened from the demo banner. While it
    //    is open the page is hidden, exactly as when a customer leaves the app; coming back fires the same events.
    //  - first receiver: its own network ALUVISION-<TYPE>-<address>; after the PIN the stand network "<TYPE> <stand>";
    //  - the PIN lives only in this page's memory: never stored, never sent, never logged, and it protects nothing;
    //  - every stand-in screen says DEMO and never asks the browser for a camera, a network or a saved password.
    // The test bench (headless Chrome) keeps the short route it always had; ?echt=1 or ?snel=1 in the URL forces one.
    const doc=root.document,esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const wait=(ms,signal)=>new Promise((resolve,reject)=>{
      if(signal?.aborted){reject(fail('MAIN_CANCELLED'));return;}
      const timer=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(fail('MAIN_CANCELLED'));},{once:true});
    });
    const HOME='Mijn eigen wifi';
    const phone={wifi:HOME,known:new Set(),look:/Android/i.test(root.navigator?.userAgent||'')?'android':'iphone',receiversOn:true,auto:true};
    // added: receivers that are part of a stand. plans: unit id -> {ssid,standName} (PIN step prepared).
    // claims: unit id -> {standId,transactionId,ssid,pin,confirmed} (the first receiver took the PIN and renamed its Wi-Fi).
    const added=new Set(),plans=new Map(),claims=new Map();
    const factorySsid=unit=>`ALUVISION-${unit.type}-${unit.physicalId}`;
    const blank=unit=>!added.has(unit.id)&&!claims.has(unit.id);
    // The new receivers that are switched on near the phone: two of each family.
    const nearby=()=>phone.receiversOn?['RGBW','SPI'].flatMap(type=>units.filter(unit=>unit.type===type&&blank(unit)).slice(0,2)):[];
    const claimOfStand=standId=>[...claims.values()].find(claim=>claim.standId===standId)||null;
    // Default (phone.auto): everything works. The stand-in phone is put on the right Wi-Fi by itself, as if the customer
    // had done the steps (user, 12 Nov: "hij moet denken dat hij receiver ziet"). Doing it by hand, and failing, is a
    // choice in the stand-in settings; nothing in the walkthrough waits for a hidden demo button.
    const autoFactory=unit=>{if(phone.auto&&unit&&nearby().includes(unit)&&phone.wifi!==factorySsid(unit)){phone.wifi=factorySsid(unit);syncChip();}};
    const autoStand=claim=>{if(phone.auto&&claim&&phone.wifi!==claim.ssid&&(claim.confirmed||phone.receiversOn)){phone.wifi=claim.ssid;phone.known.add(claim.ssid);syncChip();}};
    const observation=(unit,extra={})=>({id:unit.id,rid:unit.rid,type:unit.type,name:`${unit.type}-receiver`,deviceFingerprint:null,canConfigure:false,canVerifyIdentity:true,reachabilityOnly:true,...extra});
    // Same rule as the phone app (V63WifiPinV2Intent.networkName): letters, digits, space . _ - and at most 32 characters.
    function networkName(name,type){
      const prefix=type+' ',ascii=Array.from(String(name??'').normalize('NFKD')).filter(char=>!/\p{M}/u.test(char)).map(char=>/[0-9A-Za-z ._-]/.test(char)?char:' ').join('').split(' ').filter(Boolean).join(' ');
      const suffix=ascii.slice(0,32-prefix.length).trim();return suffix?prefix+suffix:null;
    }
    const ICON={
      wifi:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.3a9.5 9.5 0 0 1 13 0M8.6 15.6a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19" r="1.2"/></svg>',
      lock:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10"/><rect x="5" y="10" width="14" height="10.5" rx="3"/></svg>',
      check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>',
      back:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg>',
      close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
      eye:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
      share:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3.5m-4.5 4.5L12 3.5 16.5 8M6 11.5H5v9h14v-9h-1"/></svg>'
    };
    // Styles of the stand-in screens. Colours and sizes of the PIN pages follow the phone apps
    // (iPhone: V63WifiPinV2Presentation.swift, Android: AlvNativePinPresentation.java).
    const CSS=`
.dp{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;overflow:hidden;font:16px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;text-align:left;color:var(--dp-ink);background:var(--dp-base);--dp-base:#eef2f6;--dp-panel:#fff;--dp-ink:#242b36;--dp-muted:#5b6472;--dp-accent:#b03b36;--dp-primary:#2b3340;--dp-line:rgba(36,43,54,.14)}
.dp[data-dark=true]{--dp-base:#171717;--dp-panel:#242424;--dp-ink:#f2f2f2;--dp-muted:#a8adb5;--dp-accent:#f07d70;--dp-line:rgba(255,255,255,.16)}
.dp *{box-sizing:border-box}
.dp button{margin:0;font:inherit;color:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.dp svg{width:1.25em;height:1.25em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
.dp h1{margin:0;font-size:32px;line-height:1.12;font-weight:700;letter-spacing:-.01em;outline:0;color:var(--dp-ink)}
.dp p{margin:0}
.dp-tag{flex:none;align-self:center;max-width:calc(100% - 32px);margin:6px 16px 8px;padding:5px 10px;border-radius:8px;background:#ffd76a;color:#3b2a00;font-size:11px;font-weight:800;letter-spacing:.05em;line-height:1.3;text-align:center;text-transform:uppercase}
.dp-scroll{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch}
.dp-col{width:min(100%,664px);margin:0 auto;padding:6px 22px 20px;display:grid;gap:18px}
.dp-nav{flex:none;display:flex;align-items:center;gap:12px;width:min(100%,664px);min-height:44px;margin:0 auto;padding:calc(8px + env(safe-area-inset-top,0px)) 22px 0}
.dp-brand{flex:1;font-size:12px;font-weight:700;letter-spacing:.02em}
.dp-x{display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:14px;background:var(--dp-panel)}
.dp-steps{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.dp-steps span{padding:10px 11px;border-radius:13px;background:var(--dp-panel);font-size:12px;color:var(--dp-muted)}
.dp-steps span[aria-current]{font-weight:700;color:var(--dp-ink)}
.dp-hint{font-size:15px}
.dp-panel{display:grid;gap:10px;padding:18px;border-radius:20px;background:var(--dp-panel)}
.dp-panel small{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600}
.dp-panel small svg{width:19px;height:17px;color:var(--dp-accent)}
.dp-panel strong{font-size:21px;line-height:1.2;font-weight:700;overflow-wrap:anywhere}
.dp-panel b{font-size:15px;font-weight:600}
.dp-panel p{font-size:14px}
.dp-inst{display:grid;grid-template-columns:28px minmax(0,1fr);gap:11px}
.dp-inst i{font-style:normal;font-size:13px;font-weight:700;text-align:center;color:var(--dp-accent)}
.dp-field{display:grid;gap:10px;padding:16px 18px;border-radius:18px;background:var(--dp-panel)}
.dp-field label{font-size:13px;font-weight:600}
.dp input{width:100%;margin:0;border:0;outline:0;background:transparent;color:var(--dp-ink);-webkit-text-security:disc}
.dp-field input{min-height:52px;font:500 24px/1.2 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.1em}
.dp-feedback{min-height:19px;margin:-8px 4px 0;font-size:13px;color:var(--dp-accent)}
.dp-feedback[data-ok=true]{color:#1f9d55}
.dp-foot{flex:none;display:grid;gap:10px;width:min(100%,664px);margin:0 auto;padding:10px 22px calc(14px + env(safe-area-inset-bottom,0px))}
.dp-primary{min-height:54px;padding:14px 16px;border:0;border-radius:17px;background:var(--dp-primary);color:#fff!important;font-size:17px;font-weight:600}
.dp-primary:disabled{opacity:.45}
.dp-secondary{display:flex;align-items:center;justify-content:center;gap:8px;min-height:54px;padding:14px 16px;border:0;border-radius:17px;background:var(--dp-panel);font-size:17px;font-weight:600}
.dp-secondary svg{color:var(--dp-accent)}
.dp-eye{display:inline-flex;align-items:center;gap:8px;justify-self:start;min-height:44px;padding:10px 8px;border:0;background:transparent;color:var(--dp-accent)!important;font-size:16px}
.dp-secret{font:600 24px/1.2 ui-monospace,"SF Mono",Menlo,monospace!important;letter-spacing:.06em}
.dp-warning{font-size:13px}
.dp-note{padding:10px 12px;border-radius:12px;background:var(--dp-panel);font-size:14px;font-weight:600}
.dp-demo{display:grid;gap:8px;padding:10px 12px;border:1.5px dashed #c79a1e;border-radius:14px;background:rgba(255,215,106,.2)}
.dp-demo>b{font-size:11px;letter-spacing:.05em;line-height:1.3;text-transform:uppercase;color:#7a5600}
.dp[data-dark=true] .dp-demo>b{color:#ffd76a}
.dp-demo button{min-height:44px;padding:8px 12px;border:0;border-radius:12px;background:#ffd76a;color:#3b2a00!important;font-size:15px;font-weight:700}
.dp[data-look=android]{justify-content:flex-end;background:rgba(0,0,0,.45);font-family:Roboto,"Segoe UI",system-ui,sans-serif;--dp-panel:#f5f5f4;--dp-ink:#1c1c1e;--dp-muted:#6b6b70}
.dp[data-look=android][data-dark=true]{--dp-panel:#161618;--dp-ink:#ececec;--dp-muted:#a0a0a6}
.dp-sheet{flex:none;display:grid;gap:10px;width:100%;max-height:94dvh;overflow:auto;padding:24px 20px calc(16px + env(safe-area-inset-bottom,0px));border-radius:26px 26px 0 0;background:var(--dp-panel)}
.dp-sheet .dp-tag{margin:0 0 4px;justify-self:center}
.dp-sheet h1{font-size:24px}
.dp-sheet .dp-ssid{margin-top:-6px;font-size:15px;color:var(--dp-muted);overflow-wrap:anywhere}
.dp-sheet p{font-size:15px;line-height:1.4}
.dp-sheet input{height:56px;padding:0 14px;border:1px solid var(--dp-line);border-radius:14px;font:500 20px/1 Roboto,system-ui,sans-serif;letter-spacing:.06em}
.dp-sheet .dp-error{min-height:18px;font-size:14px;color:#c9554c}
.dp-sheet .dp-accept{height:52px;border:0;border-radius:999px;background:#1c1c1e;color:#fff!important;font-size:16px;font-weight:500}
.dp[data-dark=true] .dp-sheet .dp-accept{background:#ece9e4;color:#000!important}
.dp-sheet .dp-cancel{height:48px;border:0;border-radius:999px;background:transparent;color:var(--dp-muted)!important;font-size:16px}
.dp-sheet .dp-secret{font-size:28px!important;font-weight:700!important}
@media (min-width:600px){.dp[data-look=android]{justify-content:center;align-items:center}.dp-sheet{width:min(100% - 48px,560px);border-radius:26px}}
.dp[data-kind=settings]{--dp-base:#f2f2f7;--dp-panel:#fff;--dp-ink:#111114;--dp-muted:#6d6d72;--dp-accent:#0a7aff;--dp-primary:#0a7aff}
.dp[data-kind=settings][data-dark=true]{--dp-base:#000;--dp-panel:#1c1c1e;--dp-ink:#fff;--dp-muted:#98989f;--dp-accent:#0a84ff;--dp-primary:#0a84ff}
.dp-bar{flex:none;display:flex;align-items:center;min-height:44px;padding:calc(8px + env(safe-area-inset-top,0px)) 12px 0}
.dp-backapp{display:inline-flex;align-items:center;gap:2px;min-height:40px;padding:0 14px 0 6px;border:0;border-radius:999px;background:var(--dp-panel);color:var(--dp-accent)!important;font-size:15px;font-weight:600}
.dp-cap{margin:4px 14px -10px;font-size:13px;line-height:1.3;color:var(--dp-muted);text-transform:uppercase;letter-spacing:.02em}
.dp-list{display:grid;border-radius:14px;background:var(--dp-panel);overflow:hidden}
.dp-row{display:flex;align-items:center;gap:10px;width:100%;min-height:54px;padding:9px 14px;border:0;border-top:1px solid var(--dp-line);background:transparent;text-align:left;font-size:17px}
.dp-row:first-child{border-top:0}
.dp-row:disabled{cursor:default}
.dp-mark{flex:none;width:20px;height:20px;color:var(--dp-accent)}
.dp-name{flex:1;min-width:0;overflow-wrap:anywhere}
.dp-name small{display:block;font-size:13px;line-height:1.35;color:var(--dp-muted)}
.dp-icons{flex:none;display:flex;align-items:center;gap:8px;color:var(--dp-muted)}
.dp-switch{flex:none;position:relative;width:50px;height:30px;border-radius:999px;background:var(--dp-line);transition:background-color .2s ease}
.dp-switch::after{content:"";position:absolute;left:2px;top:2px;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s ease}
[aria-checked=true]>.dp-switch{background:#34c759}
[aria-checked=true]>.dp-switch::after{transform:translateX(20px)}
.dp-ask{position:absolute;inset:0;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.4)}
.dp-ask form{display:grid;gap:12px;width:min(100%,340px);margin:0;padding:18px;border-radius:18px;background:var(--dp-panel)}
.dp-ask h2{margin:0;font-size:17px;line-height:1.3;font-weight:600;text-align:center;color:var(--dp-ink);overflow-wrap:anywhere}
.dp-ask input{height:46px;padding:0 12px;border:1px solid var(--dp-line);border-radius:10px;font:500 18px/1 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.08em}
.dp-ask .dp-wrong{min-height:18px;font-size:13px;font-weight:600;text-align:center}
.dp-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.dp-two button{min-height:46px;border:0;border-radius:10px;background:var(--dp-base);font-size:17px}
.dp-two button[type=submit]{font-weight:700;color:var(--dp-accent)!important}
.dp-two button:disabled{opacity:.4}
#web-demo-banner[data-demo-walk]{flex-wrap:wrap;row-gap:6px}
.demo-phone-chip{flex:0 1 auto;display:inline-flex;align-items:center;gap:7px;min-height:38px;max-width:100%;margin:0;padding:5px 13px;border:1px solid rgba(87,59,16,.4);border-radius:999px;background:#fff;color:#573b10;font:inherit;font-size:12px;font-weight:700;line-height:1.25;text-align:left;cursor:pointer;touch-action:manipulation}
.demo-phone-chip svg{flex:none;width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.demo-phone-chip span{min-width:0;overflow-wrap:anywhere}
.demo-phone-chip i{flex:none;font-style:normal;font-weight:800;text-decoration:underline}
.demo-phone-chip.is-needed{border-color:#573b10;background:#573b10;color:#fff;animation:demo-phone-chip 1.5s ease-in-out infinite}
@keyframes demo-phone-chip{50%{transform:scale(1.035)}}
@media (prefers-reduced-motion:reduce){.demo-phone-chip.is-needed{animation:none}.dp-switch,.dp-switch::after{transition:none}}
`;
    let styled=false;
    function overlay(kind,html,look=''){
      if(!styled){styled=true;const sheet=doc.createElement('style');sheet.dataset.demoPhoneStyle='';sheet.textContent=CSS;doc.head.append(sheet);}
      const el=doc.createElement('div');el.className='dp';el.dataset.demoPhone=kind;el.dataset.kind=kind;el.dataset.dark=String(doc.body?.dataset.theme==='dark');if(look)el.dataset.look=look;
      el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.innerHTML=html;doc.body.append(el);return el;
    }
    // Stand-in for the phone app's own PIN page. Resolves with the digits (RAM only) or null when the customer cancels.
    const pinInput=(name,label,placeholder)=>`<input data-dp="${name}" type="text" inputmode="numeric" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="12" placeholder="${placeholder}" aria-label="${label}">`;
    function pinPage({ssid,signal}){
      return new Promise(resolve=>{
        const android=phone.look==='android';
        const demo=`<div class="dp-demo"><b>Demo · typ geen echte PIN. Er wordt niets bewaard.</b><button type="button" data-dp="example">Vul een voorbeeld in: 1234 5678</button></div>`;
        const el=overlay('pin',android?
          `<div class="dp-sheet"><span class="dp-tag">Demo · nagemaakt scherm van de Android-app</span><h1 tabindex="-1">Kies je wifi-PIN</h1><p class="dp-ssid">${esc(ssid)}</p><p>Kies 8–12 cijfers. Je verbindt straks één keer opnieuw met deze PIN.</p>`+
            `${pinInput('first','Nieuwe PIN · 8–12 cijfers','Nieuwe PIN · 8–12 cijfers')}${pinInput('again','Herhaal PIN','Herhaal PIN')}<p class="dp-error" data-dp="feedback" role="status"></p>`+
            `<button type="button" class="dp-accept" data-dp="confirm">PIN instellen</button><button type="button" class="dp-cancel" data-dp="cancel">Annuleren</button>${demo}</div>`:
          `<div class="dp-nav"><span class="dp-brand">ALUVISION&nbsp;&nbsp;LIGHTING</span><button type="button" class="dp-x" data-dp="cancel" aria-label="Annuleren">${ICON.close}</button></div>`+
            `<span class="dp-tag">Demo · nagemaakt scherm van de iPhone-app</span><div class="dp-scroll"><div class="dp-col">`+
            `<div class="dp-steps"><span aria-current="step">1&nbsp;&nbsp;PIN kiezen</span><span>2&nbsp;&nbsp;Wifi verbinden</span></div>`+
            `<h1 tabindex="-1">Maak je wifi-PIN</h1><p class="dp-hint">Met deze PIN verbind je straks met je standwifi. Kies 8–12 cijfers; 12 aanbevolen.</p>`+
            `<div class="dp-panel"><small>${ICON.wifi}Je standwifi</small><strong>${esc(ssid)}</strong></div>`+
            `<div class="dp-panel"><b>Eenmalig opnieuw verbinden</b><p>Na het instellen schakelt de receiver naar je standwifi. Dat kan enkele seconden duren.</p><p>Verbind dit toestel daarna één keer opnieuw met je gekozen PIN.</p></div>`+
            `<div class="dp-field"><label>Wificode · 8–12 cijfers</label>${pinInput('first','Wificode · 8–12 cijfers','••••  ••••')}</div>`+
            `<div class="dp-field"><label>Herhaal wificode</label>${pinInput('again','Herhaal wificode','••••  ••••')}</div>`+
            `<p class="dp-feedback" data-dp="feedback" role="status"></p></div></div>`+
            `<div class="dp-foot">${demo}<button type="button" class="dp-primary" data-dp="confirm" disabled>PIN instellen</button></div>`,phone.look);
        el.setAttribute('aria-label','PIN kiezen (demo)');
        const first=el.querySelector('[data-dp=first]'),again=el.querySelector('[data-dp=again]'),feedback=el.querySelector('[data-dp=feedback]'),confirm=el.querySelector('[data-dp=confirm]');
        let settled=false;
        const finish=value=>{if(settled)return;settled=true;first.value='';again.value='';el.remove();signal?.removeEventListener('abort',abort);resolve(value);};
        const abort=()=>finish(null);
        const check=()=>{
          for(const field of [first,again])field.value=field.value.replace(/[^0-9]/g,'').slice(0,12);
          const ok=/^[0-9]{8,12}$/.test(first.value)&&first.value===again.value;
          if(android)feedback.textContent='';
          else {confirm.disabled=!ok;feedback.dataset.ok=String(ok);feedback.textContent=!again.value?'':ok?'Je codes komen overeen':'Beide codes moeten gelijk zijn.';}
          return ok;
        };
        el.addEventListener('input',check);
        el.addEventListener('click',event=>{
          const action=event.target.closest('[data-dp]')?.dataset.dp;
          if(action==='cancel')finish(null);
          else if(action==='example'){first.value=again.value='12345678';check();}
          else if(action==='confirm'){if(check())finish(first.value);else if(android)feedback.textContent='Vul twee keer dezelfde PIN van 8–12 cijfers in.';}
        });
        el.addEventListener('keydown',event=>{
          if(event.key==='Escape')finish(null);
          else if(event.key==='Enter'){event.preventDefault();if(event.target===first)again.focus();else if(check())finish(first.value);}
        });
        if(signal?.aborted){finish(null);return;}
        signal?.addEventListener('abort',abort,{once:true});check();first.focus({preventScroll:true});
      });
    }
    // Stand-in for the phone app's "Je wifi-gegevens" page (PIN bekijken of delen).
    function pinCard({ssid,pin}){
      const android=phone.look==='android';
      const el=overlay('pin-card',android?
        `<div class="dp-sheet"><span class="dp-tag">Demo · nagemaakt scherm van de Android-app</span><h1 tabindex="-1">Je wifi-gegevens</h1><p class="dp-ssid">${esc(ssid)}</p><p>Gebruik deze PIN om met je standwifi te verbinden.</p><p class="dp-secret">${esc(pin)}</p><p class="dp-error"></p><button type="button" class="dp-accept" data-dp="close">Sluiten</button></div>`:
        `<div class="dp-nav"><span class="dp-brand">ALUVISION&nbsp;&nbsp;LIGHTING</span><button type="button" class="dp-x" data-dp="close" aria-label="Sluiten">${ICON.close}</button></div>`+
          `<span class="dp-tag">Demo · nagemaakt scherm van de iPhone-app</span><div class="dp-scroll"><div class="dp-col">`+
          `<h1 tabindex="-1">Je wifi-gegevens</h1><p class="dp-hint">Alles om met je standwifi te verbinden, op één plek.</p>`+
          `<div class="dp-panel"><small>${ICON.wifi}Je standwifi</small><strong>${esc(ssid)}</strong></div>`+
          `<div class="dp-panel"><b>Eenmalig opnieuw verbinden</b><p>Na het instellen schakelt de receiver naar je standwifi. Dat kan enkele seconden duren.</p><p>Verbind dit toestel daarna één keer opnieuw met je gekozen PIN.</p>`+
          `<p class="dp-inst"><i>1</i><span>Kies dit netwerk bij Instellingen → Wifi en vul je PIN in.</span></p><p class="dp-inst"><i>2</i><span>Kom terug naar de app om verder te gaan.</span></p></div>`+
          `<div class="dp-panel"><small>Wificode</small><strong class="dp-secret" data-dp-secret>••••&nbsp;&nbsp;••••</strong><button type="button" class="dp-eye" data-dp="reveal" aria-pressed="false">${ICON.eye}<span>Toon PIN</span></button></div>`+
          `<button type="button" class="dp-secondary" data-dp="share">${ICON.share}<span>Deel of sla op</span></button>`+
          `<p class="dp-warning">Deel je PIN alleen met mensen die je vertrouwt. Hiermee geef je toegang tot je standwifi; appbediening wordt apart beveiligd.</p>`+
          `<p class="dp-note" data-dp-note role="status" hidden>Demo: hier opent de telefoon zijn deelmenu. In de demo wordt niets gedeeld of bewaard.</p></div></div>`+
          `<div class="dp-foot"><button type="button" class="dp-primary" data-dp="close">Sluiten</button></div>`,phone.look);
      el.setAttribute('aria-label','Je wifi-gegevens (demo)');
      el.addEventListener('click',event=>{
        const button=event.target.closest('[data-dp]'),action=button?.dataset.dp;
        if(action==='close')el.remove();
        else if(action==='reveal'){const shown=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(shown));button.querySelector('span').textContent=shown?'Verberg':'Toon PIN';el.querySelector('[data-dp-secret]').textContent=shown?pin:'••••  ••••';}
        else if(action==='share')el.querySelector('[data-dp-note]').hidden=false;
      });
      el.addEventListener('keydown',event=>{if(event.key==='Escape')el.remove();});
      el.querySelector('h1').focus({preventScroll:true});
    }
    // "Leaving the app": the page reports hidden and the same events fire as on a phone (visibilitychange, and on
    // return the app's own lightning:native-active). Nothing else in the page is touched.
    let away=false;
    function setAway(value){
      if(away===value)return;away=value;
      try{
        if(value){Object.defineProperty(doc,'hidden',{configurable:true,get:()=>true});Object.defineProperty(doc,'visibilityState',{configurable:true,get:()=>'hidden'});}
        else {delete doc.hidden;delete doc.visibilityState;}
      }catch(_){/* a browser that refuses: the customer then taps "Ik ben verbonden · controleren" */}
      doc.dispatchEvent(new Event('visibilitychange',{bubbles:true}));
      if(!value)root.setTimeout(()=>{if(!away)root.dispatchEvent(new Event('lightning:native-active'));},150);
    }
    function wifiRows(){
      const rows=[{ssid:HOME}];
      for(const [id,claim] of claims)if(added.has(id)||phone.receiversOn)rows.push({ssid:claim.ssid,claim});
      for(const type of ['RGBW','SPI']){const unit=nearby().find(item=>item.type===type);if(unit)rows.push({ssid:factorySsid(unit)});}
      return rows;
    }
    function dropLostWifi(){if(!wifiRows().some(row=>row.ssid===phone.wifi))phone.wifi=HOME;}
    // Stand-in for the phone's own "Instellingen › Wifi".
    function openSettings(){
      if(away||doc.querySelector('[data-demo-phone]'))return;
      setAway(true);
      const el=overlay('settings','');let joining=null,asking=null;
      el.setAttribute('aria-label','Wifi-instellingen van je telefoon (demo)');
      const render=()=>{
        const rows=wifiRows();
        el.innerHTML=`<div class="dp-bar"><button type="button" class="dp-backapp" data-dp="back">${ICON.back}<span>Aluvision</span></button></div>`+
          `<span class="dp-tag">Demo · nagemaakt: de wifi-instellingen van je telefoon</span><div class="dp-scroll"><div class="dp-col"><h1 tabindex="-1">Wifi</h1>`+
          `<p class="dp-cap">Netwerken</p><div class="dp-list">${rows.map((row,index)=>`<button type="button" class="dp-row" data-dp="join" data-index="${index}" aria-pressed="${phone.wifi===row.ssid}" ${joining?'disabled':''}><span class="dp-mark">${phone.wifi===row.ssid&&!joining?ICON.check:''}</span><span class="dp-name">${esc(row.ssid)}${joining===row.ssid?'<small>Verbinden…</small>':phone.wifi===row.ssid&&!joining?'<small>Verbonden</small>':''}</span><span class="dp-icons">${row.claim?ICON.lock:''}${ICON.wifi}</span></button>`).join('')}</div>`+
          `<p class="dp-cap">Demo · wat je in het echt zelf doet</p><div class="dp-list">`+
          `<button type="button" class="dp-row" data-dp="auto" role="switch" aria-checked="${phone.auto}"><span class="dp-name">Wifi gaat vanzelf goed<small>${phone.auto?'De demo kiest telkens het juiste netwerk voor je: alles lukt. Kies hierboven zelf een netwerk om het met de hand te doen.':'Je regelt de wifi nu zelf, zoals op een echt toestel. Loop je vast? Zet dit weer aan.'}</small></span><span class="dp-switch" aria-hidden="true"></span></button>`+
          `<button type="button" class="dp-row" data-dp="power" role="switch" aria-checked="${phone.receiversOn}"><span class="dp-name">Nieuwe receivers staan aan<small>${phone.receiversOn?'Zet uit om te zien wat de app dan zegt.':'Ze staan uit: de app kan ze niet bereiken.'}</small></span><span class="dp-switch" aria-hidden="true"></span></button>`+
          `<button type="button" class="dp-row" data-dp="look"><span class="dp-name">PIN-scherm van de telefoon-app<small>Nagemaakt naar ${phone.look==='android'?'Android':'iPhone'} · tik om te wisselen</small></span></button></div></div></div>`+
          `<div class="dp-foot"><button type="button" class="dp-primary" data-dp="back">Terug naar de Aluvision-app</button></div>`+
          (asking?`<div class="dp-ask"><form data-dp-form novalidate><h2>Voer het wachtwoord in voor “${esc(asking.ssid)}”</h2><input data-dp="password" type="text" inputmode="numeric" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="63" aria-label="Wachtwoord"><p class="dp-wrong" role="status">${asking.wrong?`Onjuist wachtwoord voor “${esc(asking.ssid)}”.`:''}</p><div class="dp-two"><button type="button" data-dp="ask-cancel">Annuleer</button><button type="submit" disabled>Verbind</button></div><div class="dp-demo"><b>Demo</b><button type="button" data-dp="ask-fill">Vul je gekozen PIN in</button></div></form></div>`:'');
        (asking?el.querySelector('[data-dp=password]'):el.querySelector('h1'))?.focus({preventScroll:true});
      };
      const join=async row=>{
        asking=null;joining=row.ssid;render();
        await new Promise(resolve=>setTimeout(resolve,800));
        if(!el.isConnected)return;
        if(wifiRows().some(item=>item.ssid===row.ssid))phone.wifi=row.ssid;
        joining=null;render();syncChip();
      };
      const close=()=>{el.remove();syncChip();setAway(false);};
      el.addEventListener('input',event=>{if(event.target.matches('[data-dp=password]'))el.querySelector('[data-dp-form] [type=submit]').disabled=event.target.value.length<8;});
      el.addEventListener('submit',event=>{
        event.preventDefault();if(!asking)return;
        const value=el.querySelector('[data-dp=password]').value;
        if(value===asking.claim.pin){phone.known.add(asking.ssid);void join(asking);}
        else {asking={...asking,wrong:true};render();}
      });
      el.addEventListener('click',event=>{
        const button=event.target.closest('[data-dp]'),action=button?.dataset.dp;if(!action||action==='password')return;
        if(action==='back')return close();
        if(action==='ask-cancel'){asking=null;return render();}
        if(action==='ask-fill'){const field=el.querySelector('[data-dp=password]');field.value=asking.claim.pin;field.dispatchEvent(new Event('input',{bubbles:true}));return;}
        if(joining)return;
        if(action==='auto'){phone.auto=!phone.auto;render();return syncChip();}
        if(action==='power'){phone.receiversOn=!phone.receiversOn;dropLostWifi();render();return syncChip();}
        if(action==='look'){phone.look=phone.look==='android'?'iphone':'android';return render();}
        if(action==='join'){
          const row=wifiRows()[Number(button.dataset.index)];if(!row||row.ssid===phone.wifi)return;
          phone.auto=false;   // a network chosen by hand: from here the customer does the Wi-Fi, as on a real phone
          if(row.claim&&!phone.known.has(row.ssid)){asking={ssid:row.ssid,claim:row.claim,wrong:false};return render();}
          void join(row);
        }
      });
      el.addEventListener('keydown',event=>{if(event.key==='Escape'){if(asking){asking=null;render();}else close();}});
      render();
    }
    // The demo banner shows which Wi-Fi the stand-in phone is on and opens its settings. It lights up while the app
    // is waiting for the customer to switch Wi-Fi.
    let chip=null;
    function wifiNeeded(){
      if(phone.auto||away||!doc.querySelector('.onboarding-page'))return false;
      if(doc.querySelector('.onboarding-manual-wifi [data-setup-visual="wifi-instructions"],[data-first-scan]'))return !nearby().some(unit=>factorySsid(unit)===phone.wifi);
      if(doc.querySelector('[data-first-pin-v2="rejoin"]'))return [...claims.values()].some(claim=>!claim.confirmed&&claim.ssid!==phone.wifi);
      return false;
    }
    function syncChip(){
      if(!chip)return;
      const needed=wifiNeeded();chip.classList.toggle('is-needed',needed);
      const text=phone.auto?'Wifi gaat vanzelf goed':needed?'Open de wifi-instellingen van je telefoon':`Wifi van je telefoon: ${phone.wifi}`;
      if(chip.dataset.text!==text){chip.dataset.text=text;chip.innerHTML=`${ICON.wifi}<span>${esc(text)}</span>${needed?'':`<i>${phone.auto?'zelf proberen':'wijzig'}</i>`}`;}
    }
    function mountChip(){
      const banner=doc?.getElementById('web-demo-banner');if(!banner||chip)return;
      if(!styled){styled=true;const sheet=doc.createElement('style');sheet.dataset.demoPhoneStyle='';sheet.textContent=CSS;doc.head.append(sheet);}
      banner.dataset.demoWalk='';chip=doc.createElement('button');chip.type='button';chip.className='demo-phone-chip';chip.dataset.demoPhoneOpen='';
      chip.setAttribute('aria-label','Demo: wifi-instellingen van je telefoon openen');chip.addEventListener('click',openSettings);banner.append(chip);
      syncChip();root.setInterval(syncChip,700);
    }
    // The phone app's dedicated first-PIN service, played for the walkthrough. Same replies as native-runtime.js
    // accepts (firstPinReply686): pin-required, cancelled, manual-rejoin, or a receipt once the phone is back.
    const firstPinUnit=configuration=>units.find(unit=>unit.id===configuration?.receiverId)||null;
    const demoFirstPin=Object.freeze({
      demoWalkthrough:true,
      // C231: "wifi gaat vanzelf goed": de nagemaakte telefoon staat na de PIN vanzelf op het standnetwerk. De pagina mag
      // dan zelf verder controleren (het koppelbeeld loopt door), zonder de tik op "Ik ben verbonden · controleren".
      get autoRejoin(){return phone.auto===true;},
      async prepare({configuration,standName,signal}={}){
        const unit=firstPinUnit(configuration);await wait(900,signal);
        if(!unit)throw fail('FIRST_PIN_V2_INVALID');
        {const o=demoScan();if(o.prepareFailOnce===true){o.prepareFailOnce=false;throw fail('MAIN_CONNECTION_UNAVAILABLE');}}
        if(!claims.has(unit.id))autoFactory(unit);
        if(!phone.receiversOn||phone.wifi!==factorySsid(unit)||claims.has(unit.id))throw fail('MAIN_CONNECTION_UNAVAILABLE');
        const ssid=networkName(standName,unit.type);if(!ssid)throw fail('MAIN_CONFIGURATION_INVALID');
        plans.set(unit.id,{ssid,standName});
        return {status:'pin-required',ssid,standName};
      },
      async claim({configuration,signal}={}){
        const unit=firstPinUnit(configuration),plan=unit&&plans.get(unit.id);
        if(!plan||claims.has(unit.id))throw fail('FIRST_PIN_V2_INVALID');
        const pin=await pinPage({ssid:plan.ssid,signal});
        if(pin===null)return {status:'cancelled'};
        // The receiver stores the PIN and restarts its Wi-Fi under the stand name. That takes a moment.
        await wait(1800,signal);autoFactory(unit);
        if(!phone.receiversOn||phone.wifi!==factorySsid(unit))throw fail('MAIN_CLAIM_UNCONFIRMED');
        claims.set(unit.id,{standId:configuration.standId,transactionId:configuration.transactionId,ssid:plan.ssid,pin,confirmed:false});
        // The receiver's own network is gone. By hand the phone falls back to its usual Wi-Fi; by default the demo joins
        // the stand network for the customer, who then only taps "Ik ben verbonden · controleren".
        phone.wifi=HOME;autoStand(claims.get(unit.id));syncChip();
        return {status:'manual-rejoin',ssid:plan.ssid};
      },
      async reconcile({configuration,signal}={}){
        const unit=firstPinUnit(configuration);await wait(1100,signal);
        if(!unit)throw fail('FIRST_PIN_V2_INVALID');
        const claim=claims.get(unit.id),plan=plans.get(unit.id);
        if(claim)autoStand(claim);else autoFactory(unit);
        if(!claim){
          // The receiver never took the PIN: back to choosing it, as long as the phone still reaches the receiver.
          if(!plan||!phone.receiversOn||phone.wifi!==factorySsid(unit))throw fail('MAIN_CONNECTION_UNAVAILABLE');
          return {status:'pin-required',ssid:plan.ssid,standName:plan.standName};
        }
        if(!phone.receiversOn&&!added.has(unit.id))throw fail('MAIN_CONNECTION_UNAVAILABLE');
        if(phone.wifi!==claim.ssid)return {status:'manual-rejoin',ssid:claim.ssid};
        claim.confirmed=true;
        return {...receipt('security-confirmed',configuration),ssid:claim.ssid};
      },
      async show({configuration}={}){
        const claim=claims.get(firstPinUnit(configuration)?.id);if(!claim)throw fail('FIRST_PIN_V2_UNCONFIRMED');
        pinCard({ssid:claim.ssid,pin:claim.pin});return {status:'shown'};
      },
      async ready({standId}={}){
        const entry=[...claims].find(([,claim])=>claim.standId===standId&&claim.confirmed),unit=entry&&units.find(item=>item.id===entry[0]);
        return unit?{ready:true,standId,receiverId:unit.id,rid:unit.rid,deviceFingerprint:unit.deviceFingerprint,transactionId:entry[1].transactionId,ssid:entry[1].ssid}:{ready:false};
      }
    });
    // Stand-in for scanning the QR code on the FIRST receiver of a stand (user, 12 Nov: "scan je eerste receiver").
    // On a real phone that scan would put the phone on the receiver's own Wi-Fi. The phone app cannot do that yet, so
    // only the demo offers this service; the page shows its scan button only where the service exists.
    async function scanFirstReceiver(input={},signal){
      const o=demoScan();let answer=o.mode==='ok'?(['SPI','RGBW'].includes(o.family)?o.family:'RGBW'):o.mode||null;
      if(answer)await wait(Number.isFinite(o.delay)?o.delay:900,signal).catch(()=>{throw fail('CANCELLED');});
      else answer=await demoCamera(signal);
      if(answer==='cancel')return {status:'cancelled'};
      if(answer==='denied')throw fail('RECEIVER_LABEL_CAMERA_DENIED');
      const unit=['SPI','RGBW'].includes(answer)?nearby().find(item=>item.type===answer):null;
      if(!unit)throw fail('RECEIVER_LABEL_SCAN_UNAVAILABLE');   // the receiver is off: its Wi-Fi is not there to join
      phone.wifi=factorySsid(unit);syncChip();
      return {status:'scanned',family:unit.type};
    }
    if(walkthrough)mountChip();
    // Demo walkthrough (12 Nov, user): without a test steering the answer (no `mode`), the demo shows a stand-in for the
    // phone's camera screen. No real camera and no permission prompt; the demo buttons say what the camera "saw".
    // Only this demo service draws it: the real app opens the native scanner and never reaches this code.
    function demoCamera(signal){
      return new Promise((resolve,reject)=>{
        // Laid out like the phone apps' own camera screen (iPhone: V41StandShareScanner.swift, Android:
        // AlvLabelCameraView.java): the hint on top, "Lamp aan/uit" and "Annuleren" below, no frame. iPhone: plain
        // white text, the lamp above Annuleren. Android: dark pills, the lamp left and Annuleren right.
        const android=phone.look==='android';
        let art='';try{art=root.AluvisionReceiverArt?.svg({type:'rgbw',view:'top',theme:'light',outputs:[true,true,true,true],cable:24,scale:5.2,shadow:false,led:null})||'';}catch(_){}
        const el=doc.createElement('div');el.setAttribute('data-demo-camera','');el.setAttribute('role','dialog');el.setAttribute('aria-label','Camera (demo)');
        el.style.cssText='position:fixed;inset:0;z-index:2147483000;display:grid;grid-template-rows:auto 1fr auto auto;background:#050608;color:#fff;font:17px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;overflow:hidden';
        const pill='min-height:48px;min-width:48px;margin:0;padding:10px 18px;border:0;border-radius:24px;background:rgba(0,0,0,.67);color:#fff;font:inherit;cursor:pointer';
        const plain='min-height:44px;margin:0;padding:8px 14px;border:0;background:none;color:#fff;font:inherit;cursor:pointer';
        const btn='min-height:52px;margin:0;padding:0 16px;border:0;border-radius:16px;font:inherit;font-size:16px;font-weight:800;cursor:pointer';
        el.innerHTML=`<div data-demo-camera-art style="position:absolute;left:0;top:0;transform-origin:0 0;opacity:.8;filter:blur(.6px);pointer-events:none;transition:opacity .25s ease" aria-hidden="true">${art}</div>`+
          `<div data-demo-camera-lamp style="position:absolute;inset:0;background:radial-gradient(closest-side,rgba(255,255,255,.34),rgba(255,255,255,0));opacity:0;pointer-events:none;transition:opacity .25s ease" aria-hidden="true"></div>`+
          `<div data-demo-camera-dark style="position:absolute;inset:0;background:radial-gradient(closest-side,rgba(5,6,8,0),rgba(5,6,8,.82));pointer-events:none;transition:opacity .25s ease" aria-hidden="true"></div>`+
          `<header style="position:relative;display:grid;justify-items:center;gap:10px;padding:calc(${android?20:24}px + env(safe-area-inset-top,0px)) 20px 0;text-align:center"><p style="margin:0;${android?'padding:10px 18px;border-radius:24px;background:rgba(0,0,0,.67)':'text-shadow:0 1px 8px #000'}">Richt je camera op de QR-code op je receiver</p>`+
          `<span style="padding:5px 9px;border-radius:8px;background:#ffd76a;color:#3b2a00;font-size:11px;font-weight:850;letter-spacing:.06em;line-height:1.3">DEMO · NAGEMAAKT CAMERASCHERM VAN DE ${android?'ANDROID':'IPHONE'}-APP · GEEN ECHTE CAMERA</span></header>`+
          // Where the customer aims. The phone apps draw no frame here, so the demo does not either.
          `<div data-demo-camera-frame aria-hidden="true" style="position:relative;justify-self:center;align-self:center;width:min(58vw,250px);aspect-ratio:1"></div>`+
          `<div style="position:relative;${android?'display:flex;justify-content:space-between;align-items:center;gap:12px':'display:grid;justify-items:center;gap:20px'};padding:0 20px 24px"><button type="button" data-demo-camera-torch aria-pressed="false" style="${android?pill:plain}">Lamp aan</button><button type="button" data-demo-camera-answer="cancel" style="${android?pill:plain}">Annuleren</button></div>`+
          `<footer style="position:relative;display:grid;gap:10px;width:min(100%,560px);justify-self:center;box-sizing:border-box;padding:14px 16px calc(18px + env(safe-area-inset-bottom,0px));border-radius:24px 24px 0 0;background:rgba(24,26,30,.94)"><p style="margin:0;font-size:13.5px;font-weight:650;color:#c9cdd3;text-align:center">In de demo kies je zelf wat de camera ziet.</p>`+
          `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${[['RGBW','RGBW-receiver gescand'],['SPI','SPI-receiver gescand']].map(([k,t])=>`<button type="button" data-demo-camera-answer="${k}" style="${btn};background:#fff;color:#111">${esc(t)}</button>`).join('')}</div>`+
          `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${[['missing','Receiver staat niet aan'],['denied','Camera geweigerd']].map(([k,t])=>`<button type="button" data-demo-camera-answer="${k}" style="${btn};min-height:44px;font-size:14px;font-weight:700;background:rgba(255,255,255,.12);color:#fff">${esc(t)}</button>`).join('')}</div></footer>`;
        // The drawing sits behind the camera view with the receiver's QR code in the middle, as when the customer aims.
        const aim=()=>{
          const box=el.querySelector('[data-demo-camera-art]'),code=box?.querySelector('svg rect[width="22"][height="22"]'),frame=el.querySelector('[data-demo-camera-frame]');
          if(!code||!frame)return;
          box.style.transform='none';const at=code.getBoundingClientRect(),target=frame.getBoundingClientRect(),origin=box.getBoundingClientRect();
          if(!at.width||!target.width)return;
          const scale=target.width/1.9/at.width,x=(at.left+at.width/2-origin.left)*scale,y=(at.top+at.height/2-origin.top)*scale;
          box.style.transform=`translate(${(target.left+target.width/2-origin.left-x).toFixed(1)}px,${(target.top+target.height/2-origin.top-y).toFixed(1)}px) scale(${scale.toFixed(3)})`;
        };
        const close=()=>{root.removeEventListener('resize',aim);el.remove();};
        const done=answer=>{close();signal?.removeEventListener('abort',abort);resolve(answer);};
        const abort=()=>{close();reject(fail('CANCELLED'));};
        if(signal?.aborted){reject(fail('CANCELLED'));return;}
        signal?.addEventListener('abort',abort,{once:true});
        el.addEventListener('click',event=>{
          const lamp=event.target.closest('[data-demo-camera-torch]');
          if(lamp){
            // No real lamp: the picture gets lighter, as the label would under the phone's lamp.
            const on=lamp.getAttribute('aria-pressed')!=='true';lamp.setAttribute('aria-pressed',String(on));lamp.textContent=on?'Lamp uit':'Lamp aan';
            el.querySelector('[data-demo-camera-art]').style.opacity=on?'1':'.8';el.querySelector('[data-demo-camera-lamp]').style.opacity=on?'1':'0';el.querySelector('[data-demo-camera-dark]').style.opacity=on?'.55':'1';
            return;
          }
          const b=event.target.closest('[data-demo-camera-answer]');if(b)done(b.dataset.demoCameraAnswer);
        });
        doc.body.append(el);aim();root.requestAnimationFrame?.(aim);root.addEventListener('resize',aim);
        el.querySelector('[data-demo-camera-answer="RGBW"]')?.focus({preventScroll:true});
      });
    }
    async function scanReceiverLabel(input={},signal){
      let o=demoScan(),mode=o.mode||'ok';
      if(!o.mode&&root.document?.body){
        const answer=await demoCamera(signal);
        if(answer==='cancel')return {status:'cancelled'};
        if(answer==='denied')throw fail('RECEIVER_LABEL_CAMERA_DENIED');
        o={...o,family:answer==='missing'?null:answer};mode=answer==='missing'?'missing':'ok';
      }else
      await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,Number.isFinite(o.delay)?o.delay:900);
        signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(fail('CANCELLED'));},{once:true});});
      if(mode==='cancel')return {status:'cancelled'};
      if(mode==='denied')throw fail('RECEIVER_LABEL_CAMERA_DENIED');
      if(mode==='busy')throw fail('RECEIVER_LABEL_SCAN_BUSY');
      if(mode==='unavailable')throw fail('RECEIVER_LABEL_SCAN_UNAVAILABLE');
      const family=['SPI','RGBW'].includes(o.family)?o.family:null;
      if(mode==='missing')return {status:'scanned',family:family||'SPI',physicalId:'D0FFFFFFFF99',proof:true};
      const free=item=>walkthrough?nearby().includes(item):!chosen.has(item.id);
      const unit=units.find(item=>item.id===o.unit)||units.find(item=>free(item)&&(!family||item.type===family))||units.find(free);
      if(!unit)return {status:'scanned',family:family||'SPI',physicalId:'D0FFFFFFFF99',proof:true};
      scanned.add(unit.id);
      return {status:'scanned',family:mode==='family'?(unit.type==='SPI'?'RGBW':'SPI'):unit.type,physicalId:unit.physicalId,proof:true};
    }
    const receipts=new Map();let serial=0;
    const receipt=(kind,configuration)=>{
      const receiptRef=`receipt:demo-walkthrough-${++serial}`;
      receipts.set(receiptRef,{kind,configuration:copy(configuration)});
      return {receiptRef};
    };
    function eraseServices(getModel){
      // In-memory walkthrough only. It never verifies a PIN, opens a socket,
      // touches native storage or represents a physical factory-reset ACK.
      let plan=null,job=null;const plans=new Map();
      const progress=()=>({completed:job.completed,total:job.targets.length});
      const status=()=>({status:job.completed===job.targets.length?'completed-local-erased':'in-progress',jobId:job.id,progress:progress()});
      return Object.freeze({
        async planAppErase(request){
          if(!request||Object.keys(request).length)throw Error('DEMO_ERASE_INVALID');
          const model=getModel(),scopes=model.stands.map(stand=>({standId:stand.id,name:stand.name,receiverCount:model.receivers.filter(receiver=>receiver.standId===stand.id&&receiver.lifecycle==='added').length,requiresPin:false}));
          plan={status:'ready',planId:'demo-erase-'+(++serial),scopes,receiverCount:scopes.reduce((sum,scope)=>sum+scope.receiverCount,0),recoveryWillBeLost:false,choices:['local-only','receivers-and-local'],...(job?{pendingReset:{...status(),scope:'receivers-and-local'}}:{})};
          plans.set(plan.planId,copy(plan));return copy(plan);
        },
        async eraseAppData(request){
          if(Object.keys(request||{}).sort().join(',')!=='confirmation,planId,scope'||request.confirmation!=='Alles verwijderen'||request.scope!=='local-only'||!plans.has(request.planId)||job)throw Error('DEMO_ERASE_INVALID');
          plans.clear();return {status:'erased-local-only'};
        },
        async beginAppReset(request){
          if(Object.keys(request||{}).sort().join(',')!=='confirmation,planId'||request.confirmation!=='Reset receivers en verwijder alles'||!plans.has(request.planId)||job)throw Error('DEMO_ERASE_INVALID');
          const model=getModel(),targets=model.receivers.filter(receiver=>receiver.lifecycle==='added');
          // Each scope's MAIN is last; an unfinished pixel editor is irrelevant
          // to actual model membership, exactly as in the native contract.
          const ordered=model.stands.flatMap(stand=>targets.filter(receiver=>receiver.standId===stand.id&&receiver.role!=='main').concat(targets.filter(receiver=>receiver.standId===stand.id&&receiver.role==='main')));
          if(ordered.length!==plan.receiverCount)throw Error('DEMO_ERASE_STALE');
          job={id:'demo-reset-'+(++serial),targets:ordered,completed:0};
          return {status:'in-progress',jobId:job.id,progress:progress()};
        },
        async continueAppReset(request){
          if(Object.keys(request||{}).join(',')!=='jobId'||!job||request.jobId!==job.id)throw Error('DEMO_ERASE_INVALID');
          if(job.completed<job.targets.length)job.completed++;
          const answer=status();if(answer.status==='completed-local-erased'){job=null;plans.clear();}return answer;
        }
      });
    }
    function updateServices(getModel){
      // In-memory walkthrough only: invented versions and an invented progress, in the shape of the native OTA
      // services (receiver-update-ui.js checks every field). It reaches no receiver and sends no file; a reload
      // of the page starts over. Used by "Software-update" in the Receivers tab of the tester.
      const FROM='41.0.40',TO='41.0.42',done=new Set();let job=null,jobs=0;
      const receiver=id=>getModel().receivers.find(item=>item.id===id&&item.lifecycle==='added');
      // one status poll = one step: [phase, progress, committed, cancel allowed]
      const STEPS=[['arming',1,false,true],['uploading',16,false,true],['uploading',39,false,true],['uploading',63,false,true],['uploading',88,false,true],['verifying',96,false,false],['reconnecting',98,true,false],['verified',100,true,false]];
      const running=()=>!!job&&!job.cancelled&&job.step<STEPS.length-1;
      const view=()=>{const [phase,progress,committed,cancelAllowed]=STEPS[job.step];
        return {id:job.id,rid:job.rid,receiverType:job.type,toVersion:TO,state:job.cancelled?'cancelled':job.step===STEPS.length-1?'completed':'running',phase:job.cancelled?'cancelled':phase,progress,committed,cancelAllowed:!job.cancelled&&cancelAllowed};};
      const own=request=>{if(!job||request?.jobId!==job.id||request?.receiverId!==job.receiverId)throw fail('OTA_INVALID_REPLY');};
      return Object.freeze({
        async otaPlan(request){
          const item=receiver(request?.receiverId);if(!item)throw fail('OTA_TOPOLOGY_UNCONFIRMED');
          await wait(walkthrough?450:60);
          if(running()&&job.receiverId===item.id)return {rid:item.rid,type:item.type,status:'pending',job:view()};
          if(done.has(item.id))return {rid:item.rid,type:item.type,status:'up-to-date',currentVersion:TO};
          return {rid:item.rid,type:item.type,status:'ready',currentVersion:FROM,toVersion:TO,artifactId:`${item.type.toLowerCase()}-${TO}-local-setup`,size:1048576};
        },
        async otaStart(request){
          const item=receiver(request?.receiverId);
          if(!item||running()||request.artifactId!==`${item.type.toLowerCase()}-${TO}-local-setup`)throw fail('OTA_RECEIVER_REJECTED');
          job={id:'demo-update-'+(++jobs),receiverId:item.id,rid:item.rid,type:item.type,step:0,cancelled:false};return view();
        },
        async otaStatus(request){
          own(request);if(running())job.step++;
          if(job.step===STEPS.length-1)done.add(job.receiverId);
          return view();
        },
        async otaCancel(request){own(request);if(running()&&STEPS[job.step][3])job.cancelled=true;return view();},
        async otaResume(request){own(request);return view();}
      });
    }
    return Object.freeze({
      storage,
      eraseServices,
      updateServices,
      // Walkthrough: the first receiver is reached over its own Wi-Fi and gets its PIN through the phone app's own
      // service, exactly like the real app (native-runtime.js: connectionMode and FirstPinV2).
      ...(walkthrough?{connectionMode:'manual-wifi',FirstPinV2:demoFirstPin,scanFirstReceiver}:{}),
      search:async({standId,mainReceiverId,signal}={})=>{
        const o=demoScan();if(Number.isFinite(o.searchDelay))await new Promise(resolve=>setTimeout(resolve,o.searchDelay));
        if(walkthrough){
          if(!Number.isFinite(o.searchDelay))await wait(900,signal);
          if(mainReceiverId===undefined||mainReceiverId===null){
            // First receiver of a stand: the phone only hears the receiver whose own Wi-Fi it is on.
            if(phone.auto){const pending=[...claims.values()].find(claim=>!claim.confirmed);if(pending)autoStand(pending);else if(!nearby().some(item=>factorySsid(item)===phone.wifi))autoFactory(nearby()[0]);}
            const unit=nearby().find(item=>factorySsid(item)===phone.wifi)||units.find(item=>phone.receiversOn&&claims.get(item.id)?.confirmed===false&&claims.get(item.id).ssid===phone.wifi);
            if(!unit)throw fail('DISCOVERY_UNAVAILABLE');
            return {receivers:[observation(unit,{apSsid:phone.wifi})]};
          }
          // An extra receiver is found through the stand: the phone has to be on the stand's Wi-Fi.
          const claim=claimOfStand(standId);autoStand(claim);
          if(claim&&phone.wifi!==claim.ssid)throw fail(/^ALUVISION-/.test(phone.wifi)?'MAIN_WRONG_RECEIVER_NETWORK':'MAIN_CONNECTION_UNAVAILABLE');
          return {receivers:nearby().map(unit=>observation(unit,o.hidePhysicalId===true?{}:{physicalId:unit.physicalId}))};
        }
        return {receivers:copy(units.map(({physicalId,...unit})=>({...unit,...(o.hidePhysicalId===true?{}:{physicalId}),canConfigure:o.requireLabel!==true&&o.invalidOnce!==true,canVerifyIdentity:true})))};
      },
      select:async({receiver,standId})=>{
        const o=demoScan(),unit=units.find(item=>item.id===receiver?.id);
        if(o.invalidOnce===true){o.invalidOnce=false;throw fail('RECEIVER_LABEL_INVALID');}
        if(o.requireLabel===true&&unit&&!scanned.has(unit.id))throw fail('RECEIVER_LABEL_REQUIRED');
        if(walkthrough&&unit){
          await wait(1100);
          // Reached directly (its own Wi-Fi, or the stand name it just took) or, for an extra receiver, through the stand.
          const stand=claimOfStand(standId);
          if(claims.has(unit.id))autoStand(claims.get(unit.id));else if(stand)autoStand(stand);else autoFactory(unit);
          const direct=claims.has(unit.id)?claims.get(unit.id).ssid===phone.wifi:phone.wifi===factorySsid(unit);
          const viaStand=blank(unit)&&!!stand&&stand.confirmed&&phone.wifi===stand.ssid;
          if(!(direct||viaStand)||!phone.receiversOn&&!added.has(unit.id))throw fail('MAIN_CONNECTION_UNAVAILABLE');
          return {id:unit.id,rid:unit.rid,type:unit.type,name:`${unit.type}-receiver`,deviceFingerprint:unit.deviceFingerprint};
        }
        if(unit)chosen.add(unit.id);
        return copy(unit?{id:unit.id,rid:unit.rid,type:unit.type,name:unit.name,deviceFingerprint:unit.deviceFingerprint}:receiver);
      },
      scanReceiverLabel,
      identifyFactoryMain:async()=>({confirmed:true,ttlMs:5000}),
      identifyCandidate:async()=>({confirmed:true,ttlMs:5000}),
      secure:async({configuration,signal})=>{
        const o=demoScan();
        if(Number.isFinite(o.secureDelay))await new Promise(resolve=>setTimeout(resolve,o.secureDelay));
        else if(walkthrough)await wait(2200,signal);   // pairing through the stand takes a few seconds on a real stand too
        if(walkthrough){
          const stand=claimOfStand(configuration?.standId),unit=units.find(item=>item.id===configuration?.receiverId);autoStand(stand);
          if(stand&&phone.wifi!==stand.ssid||unit&&blank(unit)&&!phone.receiversOn)throw fail('MAIN_CONNECTION_UNAVAILABLE');
        }
        return receipt('security-confirmed',configuration);
      },
      reconcileSecurity:async({configuration})=>receipt('security-confirmed',configuration),
      finalize:async({configuration,signal})=>{
        const id=configuration?.receiver?.id||configuration?.receiverId;
        if(walkthrough)await wait(900,signal);
        if(typeof id==='string'){chosen.add(id);added.add(id);}
        return receipt('receiver-added',configuration);
      },
      verifyFinalReceipt:async({receiptRef})=>{
        const proof=receipts.get(receiptRef);
        if(!proof)throw Error('DEMO_RECEIPT_UNKNOWN');
        return copy(proof);
      }
    });
  }
  root.LightningWebDemo=Object.freeze({available,walkthrough,create});
}(window));
