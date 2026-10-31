// C98 field diagnosis (debug builds only answer it): forwards WebView errors,
// rejected promises, console.error and every tap target to the native log.
(function(){
  'use strict';
  const handler=window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.lightningV30;
  if(!handler)return;
  const tag=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
  let n=0;
  const send=text=>{try{handler.postMessage({version:1,id:'v30-'+tag+'-'+(++n),action:'debugLogC98',payload:{text:String(text).slice(0,600)}});}catch(_){}};
  window.__c98log=send;
  addEventListener('error',e=>send('ERROR '+e.message+' @'+String(e.filename||'').split('/').pop()+':'+e.lineno+':'+e.colno+' '+String(e.error&&e.error.stack||'').slice(0,300)),true);
  addEventListener('unhandledrejection',e=>{const r=e.reason||{};send('REJECT '+(r.code||'')+' '+(r.message||r)+' '+String(r.stack||'').slice(0,300));});
  const original=console.error;console.error=function(...args){send('CONSOLE '+args.map(a=>a&&a.stack?a.stack:String(a)).join(' ').slice(0,500));return original.apply(console,args);};
  const describe=e=>{const t=e.target,a=t&&t.closest&&t.closest('[data-action]');const top=document.elementFromPoint(e.clientX,e.clientY);
    const cls=el=>el?(el.tagName+'.'+String(el.className&&el.className.baseVal!==undefined?el.className.baseVal:el.className||'').split(' ').slice(0,2).join('.')):'-';
    return 'target='+cls(t)+' action='+(a?a.dataset.action:'-')+' at='+Math.round(e.clientX)+','+Math.round(e.clientY)+' top='+cls(top)+' screen='+(document.querySelector('.page')?document.querySelector('.page').className.split(' ').slice(0,2).join('.'):'-');};
  addEventListener('pointerdown',e=>send('DOWN '+describe(e)),true);
  addEventListener('click',e=>send('CLICK '+describe(e)),true);
  send('LOADED '+location.pathname.split('/').pop()+' '+innerWidth+'x'+innerHeight);
})();
