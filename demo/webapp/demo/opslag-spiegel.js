// Opslag zonder WebView, stap 1 (docs/opslag-zonder-webview.md): native is de bron, de opslag van de WebApp is een spiegel.
// Alleen aan als de gastheer het zegt: window.__alvOpslagNatief === true (native zet dat bij de start van de pagina, samen met
// window.__alvOpslagBegin = de bewaarde waarden), of ?opslag=1 in de webdemo. Uit = er verandert niets.
//  - elke schrijfactie op een sleutel van de app (aluvision.*, c109.*, zf-c147p-uitleg-*) gaat als {opslag:{sleutel, waarde|null}}
//    naar de gastheer, die ze native bewaart (localStorage hier; de webdemo meldt haar geheugenopslag via __alvOpslagMeld);
//  - de gastheer zet wat native (Dart) schreef in de spiegel met __alvOpslagZet, zonder het terug te melden;
//  - __alvOpslagBegin: de bewaarde waarden, vóór het eerste script van de app in de spiegel gezet.
// Nooit een PIN of wachtwoord: die staan niet in localStorage (Keychain/Keystore); native kijkt de waarden nog eens na (Opslag.veilig).
(function(){
  'use strict';
  let webdemo=false;try{webdemo=/[?&]opslag=1(?:&|$)/.test(location.search)&&window.parent!==window&&!!window.parent.alvWebGastheer;}catch(_){webdemo=false;}
  if(window.__alvOpslagNatief!==true&&!webdemo)return;
  window.__alvOpslagNatief=true;
  const VOORVOEGSELS=['aluvision.','c109.','zf-c147p-uitleg-'];
  const vanApp=k=>typeof k==='string'&&k.length<=200&&VOORVOEGSELS.some(v=>k.startsWith(v));
  // de webdemo: de bewaarde waarden van de gastheer (in het geheugen van de gastheerpagina, overleeft een herlaad van de app)
  if(webdemo&&!window.__alvOpslagBegin){try{window.__alvOpslagBegin=window.parent.alvWebGastheer.opslagAlles?.()||{};}catch(_){window.__alvOpslagBegin={};}}
  const begin=window.__alvOpslagBegin&&typeof window.__alvOpslagBegin==='object'?window.__alvOpslagBegin:{};
  const meld=(sleutel,waarde)=>{
    if(!vanApp(sleutel))return;
    const m={opslag:{sleutel,waarde:waarde==null?null:String(waarde)}};
    try{
      if(window.webkit?.messageHandlers?.lightningHost)window.webkit.messageHandlers.lightningHost.postMessage(m);
      else if(typeof window.AluvisionFlutterHost?.postMessage==='function')window.AluvisionFlutterHost.postMessage(JSON.stringify(m));
      else if(webdemo)window.parent.postMessage({alvGastheer:1,tekst:JSON.stringify(m)},location.origin);
    }catch(_){}
  };
  window.__alvOpslagMeld=meld;
  let ls=null;try{ls=window.localStorage;}catch(_){ls=null;}
  let stil=false;
  if(ls&&!webdemo){
    // de bewaarde waarden vóór de app leest (native zet ze meestal zelf al; dit is de terugval)
    for(const [k,v] of Object.entries(begin))if(vanApp(k)&&typeof v==='string'){try{ls.setItem(k,v);}catch(_){}}
    const zet=Storage.prototype.setItem,weg=Storage.prototype.removeItem,leeg=Storage.prototype.clear;
    Storage.prototype.setItem=function(k,v){zet.call(this,k,v);if(this===ls&&!stil)meld(String(k),v);};
    Storage.prototype.removeItem=function(k){weg.call(this,k);if(this===ls&&!stil)meld(String(k),null);};
    Storage.prototype.clear=function(){const ks=this===ls?Object.keys(ls).filter(vanApp):[];leeg.call(this);if(!stil)ks.forEach(k=>meld(k,null));};
  }
  // wat native (Dart) schreef, in de spiegel; de webdemo zet haar geheugenopslag via __alvOpslagDoel (web-demo-service.js)
  window.__alvOpslagZet=(sleutel,waarde)=>{
    if(!vanApp(sleutel))return false;
    stil=true;
    try{
      if(typeof window.__alvOpslagDoel==='function')window.__alvOpslagDoel(sleutel,waarde==null?null:String(waarde));
      else if(ls){if(waarde==null)Storage.prototype.removeItem.call(ls,sleutel);else Storage.prototype.setItem.call(ls,sleutel,String(waarde));}
    }catch(_){}finally{stil=false;}
    try{window.dispatchEvent(new CustomEvent('lightning:opslag',{detail:{sleutel}}));}catch(_){}
    return true;
  };
}());
