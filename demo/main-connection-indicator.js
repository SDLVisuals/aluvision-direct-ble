/* Presentation only. A Wi-Fi association or cached native session is not a
 * heartbeat. Only the caller's validated fresh MAIN exchange can confirm it. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningMainConnectionIndicator=api;}(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const FRESH_MS=40000,PROOFS=new Set(['projection','unchanged','firmware-ack']);
  const words={
    nl:{connected:'Hoofdreceiver verbonden',checking:'Verbinding controleren',unknown:'Verbinding niet bevestigd'},
    en:{connected:'Main receiver connected',checking:'Checking connection',unknown:'Connection not confirmed'},
    fr:{connected:'Récepteur principal connecté',checking:'Vérification de la connexion',unknown:'Connexion non confirmée'},
    de:{connected:'Hauptreceiver verbunden',checking:'Verbindung prüfen',unknown:'Verbindung nicht bestätigt'}
  };
  const wifi='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 8a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0M9 16a4.5 4.5 0 0 1 6 0"/><circle cx="12" cy="20" r=".8" fill="currentColor" stroke="none"/></svg>';
  const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
  const validId=x=>typeof x==='string'&&x.length>=1&&x.length<=160&&!/[\u0000-\u001f\u007f]/.test(x);
  function context(value){return plain(value)&&Object.keys(value).sort().join(',')==='mainId,standId'&&validId(value.standId)&&validId(value.mainId)?{standId:value.standId,mainId:value.mainId}:null;}
  function create({host=null,language=()=> 'nl',now=()=>performance.now(),setTimer=setTimeout,clearTimer=clearTimeout,onState=()=>{}}={}){
    let current=null,confirmedAt=null,visible=true,availability='checking',timer=null,disposed=false,rendered='';
    const cancel=()=>{if(timer!==null)clearTimer(timer);timer=null;};
    function snapshot(){
      const age=confirmedAt===null?Infinity:now()-confirmedAt;
      const status=visible&&age>=0&&age<FRESH_MS?'connected':availability==='unknown'?'unknown':'checking';
      const locale=Object.hasOwn(words,language())?language():'nl';
      return {shown:!disposed&&current!==null,status,label:words[locale][status]};
    }
    function publish(){
      const value=snapshot();
      if(host){
        host.hidden=!value.shown;host.dataset.connectionState=value.status;
        const html=wifi+'<span>'+value.label+'</span>';
        if(html!==rendered){host.innerHTML=html;rendered=html;}
      }
      onState({...value});return value;
    }
    function arm(){cancel();if(!disposed&&visible&&current&&confirmedAt!==null){const remaining=FRESH_MS-(now()-confirmedAt);if(remaining>0)timer=setTimer(()=>{timer=null;publish();},remaining);}}
    function setContext(value){
      if(disposed)return;
      const next=context(value);
      if(!current||!next||next.standId!==current.standId||next.mainId!==current.mainId){cancel();confirmedAt=null;availability='checking';}
      current=next;publish();arm();
    }
    function confirm(value){
      if(disposed||!visible||!current||!plain(value)||Object.keys(value).sort().join(',')!=='kind,mainId,standId'||!PROOFS.has(value.kind)||value.standId!==current.standId||value.mainId!==current.mainId)return false;
      const time=now();if(!Number.isFinite(time)||time<0)return false;
      confirmedAt=time;availability='checking';publish();arm();return true;
    }
    function connectionState(value){
      if(disposed)return;
      // 'connected' alone can come from a cache or local write head. It does
      // not renew evidence. A node error must never declare MAIN offline.
      if(['offline','disconnected'].includes(value)){cancel();confirmedAt=null;availability='unknown';}
      else if(['connecting','checking','reconnect-required','code-required','setup-required','migration-required'].includes(value)){cancel();confirmedAt=null;availability='checking';}
      publish();
    }
    function setVisible(value){
      if(disposed||typeof value!=='boolean')return;
      if(value!==visible){visible=value;confirmedAt=null;availability='checking';cancel();}publish();
    }
    function refresh(){if(!disposed)publish();}
    function dispose(){disposed=true;cancel();current=null;confirmedAt=null;publish();}
    publish();return Object.freeze({setContext,confirm,connectionState,setVisible,refresh,dispose,snapshot});
  }
  return Object.freeze({create,FRESH_MS});
}));
