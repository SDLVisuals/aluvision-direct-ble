/* Presentation only. A Wi-Fi association or cached native session is not a
 * heartbeat. Only the caller's validated fresh MAIN exchange can confirm it. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningMainConnectionIndicator=api;}(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const FRESH_MS=40000,PROOFS=new Set(['projection','unchanged','firmware-ack','exchange']);
  const words={
    nl:{connected:'Hoofdreceiver verbonden',checking:'Verbinding controleren',unknown:'Verbinding niet bevestigd'},
    en:{connected:'Main receiver connected',checking:'Checking connection',unknown:'Connection not confirmed'},
    fr:{connected:'Récepteur principal connecté',checking:'Vérification de la connexion',unknown:'Connexion non confirmée'},
    de:{connected:'Hauptreceiver verbunden',checking:'Verbindung prüfen',unknown:'Verbindung nicht bestätigt'}
  };
  // Visible pill text; the full sentence above stays for screen readers.
  const short={
    nl:{connected:'Verbonden',checking:'Verbinden…',unknown:'Geen verbinding'},
    en:{connected:'Connected',checking:'Connecting…',unknown:'Not connected'},
    fr:{connected:'Connecté',checking:'Connexion…',unknown:'Non connecté'},
    de:{connected:'Verbunden',checking:'Verbinden…',unknown:'Nicht verbunden'}
  };
  const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
  const validId=x=>typeof x==='string'&&x.length>=1&&x.length<=160&&!/[\u0000-\u001f\u007f]/.test(x);
  function context(value){return plain(value)&&Object.keys(value).sort().join(',')==='mainId,standId'&&validId(value.standId)&&validId(value.mainId)?{standId:value.standId,mainId:value.mainId}:null;}
  function create({host=null,language=()=> 'nl',standName=()=>'',now=()=>performance.now(),setTimer=setTimeout,clearTimer=clearTimeout,onState=()=>{}}={}){
    let current=null,confirmedAt=null,visible=true,availability='checking',timer=null,disposed=false,rendered='';
    const cancel=()=>{if(timer!==null)clearTimer(timer);timer=null;};
    function snapshot(){
      const age=confirmedAt===null?Infinity:now()-confirmedAt;
      const status=visible&&age>=0&&age<FRESH_MS?'connected':availability==='unknown'?'unknown':'checking';
      const locale=Object.hasOwn(words,language())?language():'nl';
      let name='';try{name=String(standName()||'').trim().slice(0,60);}catch(_){}
      return {shown:!disposed&&current!==null,status,label:words[locale][status],short:short[locale][status],standName:name};
    }
    function publish(){
      const value=snapshot();
      if(host){
        host.hidden=!value.shown;host.dataset.connectionState=value.status;
        const html='<i class="mci-dot" aria-hidden="true"></i><span class="mci-copy" aria-hidden="true"><b>'+escape(value.short)+'</b>'+(value.standName?'<small>'+escape(value.standName)+'</small>':'')+'</span><span class="mci-sr">'+escape(value.label)+(value.standName?' · '+escape(value.standName):'')+'</span>';
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
      // C107: a channel that needs re-opening drops the evidence; a mere
      // check or (re)connect keeps a fresh exchange with the MAIN as proof,
      // so a cold start shows "Verbonden" after its first exchange, not
      // only after the stand projection ~20 s later.
      else if(['reconnect-required','code-required','setup-required','migration-required'].includes(value)){cancel();confirmedAt=null;availability='checking';}
      else if(['connecting','checking'].includes(value)){availability='checking';if(confirmedAt===null)cancel();}
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
