/* C97 shared installation. One public document per stand lives on its MAIN:
 * the stand layout (zones, names) plus the scene, preset and colour libraries.
 * Every phone that knows the PIN loads it on open and polls the revision
 * every 2 s, so a zone or scene made on one phone appears on the others.
 * Writes are compare-and-swap on the MAIN revision; on a conflict the newer
 * document is loaded and this phone's own edits are merged on top of it.
 * Never carries keys, PINs or light commands. */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory();
  if(node)module.exports=api;else root.LightningSharedInstallation=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const FORMAT='aluvision-shared-installation',VERSION=1,MAX_BYTES=256*1024,POLL_MS=2000;
  const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const canonical=v=>JSON.stringify(v,(_,e)=>plain(e)?Object.fromEntries(Object.keys(e).sort().map(k=>[k,e[k]])):e);
  const copy=v=>JSON.parse(JSON.stringify(v));
  const LISTS=['scenes','presets','colors'];

  function documentFor(standId,model,libraries){
    return {format:FORMAT,version:VERSION,standId,model:copy(model),
      libraries:{scenes:copy(libraries.scenes||[]),presets:copy(libraries.presets||[]),colors:copy(libraries.colors||[])}};
  }
  function parse(json,standId){
    const doc=JSON.parse(json);
    // Same format, other stand: a leftover of an earlier owner. It is replaced
    // by this installation, never shown. Anything newer/unknown is left alone.
    if(plain(doc)&&doc.format===FORMAT&&doc.version===VERSION&&doc.standId!==standId)throw Object.assign(Error('SHARED_FOREIGN'),{code:'SHARED_FOREIGN'});
    if(!plain(doc)||doc.format!==FORMAT||doc.version!==VERSION||!plain(doc.model)||!plain(doc.libraries))throw Object.assign(Error('SHARED_FORMAT'),{code:'SHARED_FORMAT'});
    for(const list of LISTS)if(!Array.isArray(doc.libraries[list]))throw Object.assign(Error('SHARED_FORMAT'),{code:'SHARED_FORMAT'});
    return doc;
  }
  // Three-way merge per library item id: this phone's additions, edits and
  // deletions since the common base win; everything else comes from remote.
  function mergeList(base,local,remote){
    const key=item=>canonical(item),byId=list=>new Map((list||[]).filter(i=>plain(i)&&typeof i.id==='string').map(i=>[i.id,i]));
    const b=byId(base),l=byId(local),r=byId(remote),out=new Map(r);
    for(const [id,item] of l)if(!b.has(id)||key(b.get(id))!==key(item))out.set(id,item);
    for(const [id,item] of b)if(!l.has(id)&&r.has(id)&&key(r.get(id))===key(item))out.delete(id);
    const order=[...(remote||[]).map(i=>i?.id),...(local||[]).map(i=>i?.id)];
    return [...new Set(order)].filter(id=>out.has(id)).map(id=>out.get(id));
  }
  function merge(base,local,remote){
    const result=copy(remote);
    // Layout: this phone's edit wins only if it changed it since the common
    // base. Without a base (first contact) the MAIN's layout wins.
    if(base&&canonical(local.model)!==canonical(base.model))result.model=copy(local.model);
    for(const list of LISTS)result.libraries[list]=mergeList(base?.libraries[list],local.libraries[list],remote.libraries[list]);
    return result;
  }

  /* hooks: services.sharedDocument(payload) -> Promise
   *        stands() -> [standId]           (stands with a completed MAIN)
   *        snapshot(standId) -> {model,libraries}
   *        apply(standId,doc) -> Promise<{layout:boolean}>  (writes locally;
   *          layout:false when this phone lacks a receiver the layout uses) 
   *        idle() -> boolean               (no dialog/edit/onboarding running)
   *        notice(code)                    (optional user-facing problem) */
  function create(hooks){
    const states=new Map();let timer=null,running=false,stopped=false;
    const stateOf=standId=>{if(!states.has(standId))states.set(standId,{revision:null,doc:null,key:null,failures:0,until:0,layoutBlocked:false});return states.get(standId);};
    const encoder=typeof TextEncoder==='function'?new TextEncoder():null;
    const bytes=text=>encoder?encoder.encode(text).length:text.length;
    async function upload(standId,st,doc){
      const json=canonical(doc);if(bytes(json)>MAX_BYTES){hooks.notice?.('SHARED_TOO_LARGE');return false;}
      const r=await hooks.services.sharedDocument({op:'write',standId,base:st.revision||0,json});
      if(r?.status==='committed'){st.revision=r.revision;st.doc=doc;st.key=canonical(doc);hooks.seen?.(standId,r.revision);return true;}
      if(r?.status==='conflict'){await download(standId,st,doc);return false;}
      throw Object.assign(Error('SHARED_UNCONFIRMED'),{code:'SHARED_UNCONFIRMED'});
    }
    // Load the MAIN's document. When this phone has unsaved edits, they are
    // merged on top; the merged result is uploaded on the next pass.
    async function download(standId,st,local){
      const r=await hooks.services.sharedDocument({op:'read',standId});
      if(!r||r.revision===0||r.json===null){st.revision=0;st.doc=null;return;}
      let remote;
      try{remote=parse(r.json,standId);}
      catch(error){if(error?.code!=='SHARED_FOREIGN')throw error;st.revision=r.revision;st.doc=null;st.key='';return;}
      const pending=local&&st.key!==null&&canonical(local)!==st.key;
      const next=pending||st.revision===null&&local?merge(st.doc,local,remote):remote;
      const applied=await hooks.apply(standId,next,{revision:r.revision});
      // A layout this phone cannot show yet (a receiver added elsewhere) is
      // never overwritten by this phone's older layout.
      st.layoutBlocked=applied?.layout===false;if(st.layoutBlocked)hooks.notice?.('SHARED_LAYOUT_NEEDS_PIN');
      st.revision=r.revision;st.doc=remote;hooks.seen?.(standId,r.revision);
      // What this phone holds right after applying counts as in sync, even
      // if its native layer normalised it (order, derived fields). Only a
      // real user edit differs from it later, so two phones never upload in
      // turns. A merge still differs on purpose: it must be uploaded.
      const after=next===remote?hooks.snapshot(standId):null;
      // C98: this phone's own layout is newer than the MAIN's document; keep
      // the key on the document so the next pass uploads this layout.
      st.key=applied?.layout==='local'?canonical(remote):
        after?canonical(documentFor(standId,st.layoutBlocked?remote.model:after.model,after.libraries)):canonical(remote);
    }
    async function pass(standId){
      const st=stateOf(standId);if(Date.now()<st.until)return;
      const snap=hooks.snapshot(standId);if(!snap)return;
      const local=documentFor(standId,st.layoutBlocked&&st.doc?st.doc.model:snap.model,snap.libraries),localKey=canonical(local);
      if(st.revision===null){
        // First contact: an empty MAIN adopts this phone's installation;
        // otherwise the MAIN's document is loaded (and merged).
        const s=await hooks.services.sharedDocument({op:'status',standId});
        if(s.revision===0){st.revision=0;await upload(standId,st,local);}
        else await download(standId,st,local);
        return;
      }
      if(localKey!==st.key){await upload(standId,st,local);return;}
      const s=await hooks.services.sharedDocument({op:'status',standId});
      if(s.revision!==st.revision)await download(standId,st,null);
    }
    async function tick(){
      if(running||stopped)return;running=true;
      try{
        if(hooks.idle&&!hooks.idle())return;
        for(const standId of hooks.stands()){
          const st=stateOf(standId);
          try{await pass(standId);st.failures=0;}
          catch(error){
            // A light choice took the owner lane: simply try again next poll.
            if(['SHARED_DEFERRED','LIVE_CONTROL_BUSY','LIVE_CONTROL_SUPERSEDED','SHARED_BUSY'].includes(error?.code))continue;
            // Offline or MAIN busy: back off quietly, never block light control.
            st.failures++;st.until=Date.now()+Math.min(30000,POLL_MS*2**Math.min(st.failures,4));
            if(st.failures===3)hooks.notice?.(error?.code||'SHARED_UNAVAILABLE');
          }
        }
      }finally{running=false;}
    }
    // The first pass waits one poll, so the app has finished loading first.
    function start(){if(!timer&&!stopped)timer=setInterval(()=>{if(typeof document==='undefined'||!document.hidden)void tick().catch(()=>{});},POLL_MS);}
    function stop(){stopped=true;if(timer)clearInterval(timer);timer=null;}
    // Local edits are pushed at once instead of waiting for the next poll.
    function changed(){if(!stopped&&timer)setTimeout(()=>void tick().catch(()=>{}),150);}
    function forget(standId){states.delete(standId);}
    return Object.freeze({start,stop,tick,changed,forget});
  }
  return Object.freeze({FORMAT,VERSION,MAX_BYTES,POLL_MS,create,merge,mergeList,documentFor,parse,canonical});
});
