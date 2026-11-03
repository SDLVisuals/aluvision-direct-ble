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

  function documentFor(standId,model,libraries,light){
    const doc={format:FORMAT,version:VERSION,standId,model:copy(model),
      libraries:{scenes:copy(libraries.scenes||[]),presets:copy(libraries.presets||[]),colors:copy(libraries.colors||[])}};
    // C98: the current light per receiver, so every phone shows what the
    // ledlines show. Display data only: applying it never sends a command.
    if(light&&typeof light==='object')doc.light=copy(light);
    return doc;
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
    // Light: this phone's newer choice wins only if it changed since the base.
    if(base&&local.light&&canonical(local.light)!==canonical(base.light||{}))result.light=copy(local.light);
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
    const states=new Map();let timer=null,running=false,stopped=false,paused=false;
    const stateOf=standId=>{if(!states.has(standId))states.set(standId,{revision:null,doc:null,key:null,failures:0,until:0,layoutBlocked:false,libraryOnly:false,removal:null,removalProtected:false});return states.get(standId);};
    const encoder=typeof TextEncoder==='function'?new TextEncoder():null;
    const bytes=text=>encoder?encoder.encode(text).length:text.length;
    const current=(standId,st)=>!stopped&&states.get(standId)===st&&hooks.stands().includes(standId);
    const deferred=()=>Object.assign(Error('SHARED_DEFERRED'),{code:'SHARED_DEFERRED'});
    function localDocument(standId,st,snap){
      return documentFor(standId,st.layoutBlocked&&st.doc?st.doc.model:snap.model,snap.libraries,
        st.removalProtected&&st.layoutBlocked&&st.doc?st.doc.light:snap.light);
    }
    async function upload(standId,st,doc){
      const snap=hooks.snapshot(standId);
      if(!current(standId,st)||!snap||snap.writable===false||hooks.idle&&!hooks.idle())throw deferred();
      const json=canonical(doc);if(bytes(json)>MAX_BYTES){hooks.notice?.('SHARED_TOO_LARGE');return false;}
      const r=await hooks.services.sharedDocument({op:'write',standId,base:st.revision||0,json});
      if(!current(standId,st))return false;
      if(r?.status==='committed'){st.revision=r.revision;st.doc=doc;st.key=canonical(doc);hooks.seen?.(standId,r.revision);return true;}
      if(r?.status==='conflict'){await download(standId,st,doc);return false;}
      throw Object.assign(Error('SHARED_UNCONFIRMED'),{code:'SHARED_UNCONFIRMED'});
    }
    // Load the MAIN's document. When this phone has unsaved edits, they are
    // merged on top; the merged result is uploaded on the next pass.
    async function download(standId,st,local){
      const r=await hooks.services.sharedDocument({op:'read',standId});
      if(!current(standId,st)||hooks.idle&&!hooks.idle())throw deferred();
      // A library edit can happen while the native read is in flight. Merge
      // the current local snapshot, never the one captured before the read.
      const snap=hooks.snapshot(standId);if(!snap)throw deferred();
      local=localDocument(standId,st,snap);const libraryOnly=snap.writable===false;
      if(!r||r.revision===0||r.json===null){st.revision=0;st.doc=null;st.libraryOnly=libraryOnly;return;}
      let remote;
      try{remote=parse(r.json,standId);}
      catch(error){if(error?.code!=='SHARED_FOREIGN')throw error;st.revision=r.revision;st.doc=null;st.key='';st.libraryOnly=libraryOnly;return;}
      const pending=local&&st.key!==null&&canonical(local)!==st.key;
      const next=pending||st.revision===null&&local?merge(st.doc,local,remote):remote;
      const applied=await hooks.apply(standId,next,{revision:r.revision,libraryOnly});
      if(!current(standId,st))return;
      // A layout this phone cannot show yet (a receiver added elsewhere) is
      // never overwritten by this phone's older layout.
      if(!libraryOnly){st.layoutBlocked=applied?.layout===false;if(!st.layoutBlocked)st.removalProtected=false;if(st.layoutBlocked)hooks.notice?.('SHARED_LAYOUT_NEEDS_PIN',{standId});}
      st.libraryOnly=libraryOnly;
      st.revision=r.revision;st.doc=remote;hooks.seen?.(standId,r.revision);
      // What this phone holds right after applying counts as in sync, even
      // if its native layer normalised it (order, derived fields). Only a
      // real user edit differs from it later, so two phones never upload in
      // turns. A merge still differs on purpose: it must be uploaded.
      const after=next===remote?hooks.snapshot(standId):null;
      // C98: this phone's own layout is newer than the MAIN's document; keep
      // the key on the document so the next pass uploads this layout.
      st.key=applied?.layout==='local'?canonical(remote):
        after?canonical(documentFor(standId,st.layoutBlocked?remote.model:after.model,
          // Native layout adoption may await I/O. Only the libraries actually
          // installed by apply count as synchronized; later edits stay dirty.
          applied?.libraries||next.libraries,st.removalProtected&&st.layoutBlocked?remote.light:after.light)):canonical(remote);
    }
    // The caller is the existing successful native removal callback. This
    // queue edits documentary membership only; it never removes hardware.
    function removedIdentity(row){
      return plain(row)&&typeof row.id==='string'&&row.id.length>0&&row.id.length<=160&&
        typeof row.standId==='string'&&row.standId.length>0&&row.standId.length<=160&&
        /^[0-9A-F]{16}$/.test(row.rid)&&/[^0]/.test(row.rid)&&
        /^[0-9A-F]{64}$/.test(row.deviceFingerprint)&&/[^0]/.test(row.deviceFingerprint)&&
        ['RGBW','SPI'].includes(row.type)&&row.role==='node';
    }
    const sameRemoved=(a,b)=>plain(a)&&plain(b)&&['id','standId','rid','deviceFingerprint','type','role'].every(key=>a[key]===b[key]);
    function stillRemoved(snap,targets){
      return snap&&snap.writable!==false&&Array.isArray(snap.model?.receivers)&&
        targets.every(target=>!snap.model.receivers.some(row=>row.id===target.id||row.rid===target.rid));
    }
    function pruneConfirmed(doc,standId,targets){
      if(!doc||doc.standId!==standId||doc.model?.stand?.id!==standId||!Array.isArray(doc.model.receivers)||
        !Array.isArray(doc.model.stand.zones)||!Array.isArray(targets)||!targets.length||targets.length>64||
        new Set(targets.map(row=>row.id)).size!==targets.length||
        targets.some(target=>!removedIdentity(target)||target.standId!==standId||
          doc.model.receivers.filter(row=>row.id===target.id).length!==1||
          !doc.model.receivers.some(row=>sameRemoved(row,target))))return null;
      const next=copy(doc),ids=new Set(targets.map(row=>row.id)),lines=new Set(targets.flatMap(row=>(row.type==='SPI'?[1,2,3,4]:[0]).map(port=>row.id+':'+port)));
      next.model.receivers=next.model.receivers.filter(row=>!ids.has(row.id));
      for(const zone of next.model.stand.zones){
        if(!Array.isArray(zone.receiverIds)||Object.hasOwn(zone,'lineOrder')&&!Array.isArray(zone.lineOrder))return null;
        zone.receiverIds=zone.receiverIds.filter(id=>!ids.has(id));
        if(zone.lineOrder)zone.lineOrder=zone.lineOrder.filter(id=>!lines.has(id));
      }
      // Historical scenes and domain membership stay archival. Only the
      // removed node's current-light entry disappears; other state is exact.
      if(plain(next.light)){
        const rows=next.light.version===2&&plain(next.light.receivers)?next.light.receivers:next.light;
        for(const id of ids)delete rows[id];
      }
      return next;
    }
    function confirmedRemoval(standId,identities){
      const st=hooks.stands().includes(standId)?stateOf(standId):null,snap=hooks.snapshot(standId);
      if(st&&current(standId,st)){st.layoutBlocked=true;st.removalProtected=true;}
      if(!st||!current(standId,st)||!Number.isSafeInteger(st.revision)||st.revision<1||!st.doc||
        !Array.isArray(identities)||!identities.length)return 'NO_SHARED_BASE';
      if(identities.length>64||identities.some(row=>!plain(row)))return 'IDENTITY_CHANGED';
      const targets=[...(st.removal?.targets||[]),...identities].filter((row,index,all)=>all.findIndex(other=>other.id===row.id)===index);
      const next=pruneConfirmed(st.doc,standId,targets);
      if(!next||!stillRemoved(snap,targets))return 'IDENTITY_CHANGED';
      // Preserve the exact authenticated base. A later change/rejoin cannot
      // inherit this receipt or turn into an automatic deletion retry.
      st.removal={base:st.revision,doc:st.doc,targets:copy(targets),next};
      st.layoutBlocked=true;changed();return 'QUEUED';
    }
    async function publishConfirmedRemoval(standId,st,snap){
      const job=st.removal;
      if(!job||!current(standId,st)||hooks.idle&&!hooks.idle())return;
      const fresh=hooks.snapshot(standId);if(!fresh||fresh.writable===false||!current(standId,st)||hooks.idle&&!hooks.idle())return;
      st.removal=null;
      if(job.base!==st.revision||job.doc!==st.doc||!stillRemoved(fresh,job.targets)){
        st.revision=null;hooks.notice?.('SHARED_REMOVAL_RECONCILE');return;
      }
      const json=canonical(job.next);if(bytes(json)>MAX_BYTES){hooks.notice?.('SHARED_TOO_LARGE');return;}
      // Exactly one CAS; conflicts and uncertain writes require a fresh read,
      // never rebase an old removal onto another incarnation or new revision.
      let result;
      try{result=await hooks.services.sharedDocument({op:'write',standId,base:job.base,json});}
      catch(error){if(current(standId,st)){st.revision=null;hooks.notice?.('SHARED_REMOVAL_UNCONFIRMED');}throw error;}
      if(!current(standId,st))return;
      if(result?.status==='committed'&&Number.isSafeInteger(result.revision)&&result.revision>job.base){
        st.doc=job.next;st.key=canonical(job.next);hooks.seen?.(standId,result.revision);
      }else hooks.notice?.(result?.status==='conflict'?'SHARED_REMOVAL_CONFLICT':'SHARED_REMOVAL_UNCONFIRMED');
      st.revision=null;
      // Adopt current names/libraries through the ordinary validated reader.
      // A failed read is retried by the existing poll, not by another CAS.
      await download(standId,st,null);
    }
    async function pass(standId){
      const st=stateOf(standId);if(Date.now()<st.until)return;
      const snap=hooks.snapshot(standId);if(!snap)return;
      if(st.removal&&snap.writable!==false){await publishConfirmedRemoval(standId,st,snap);return;}
      const local=localDocument(standId,st,snap),localKey=canonical(local);
      if(snap.writable===false){
        // Pending addition/removal blocks publishing layout, not reading the
        // independent scene/preset libraries. Never upload this projection.
        const s=await hooks.services.sharedDocument({op:'status',standId});
        if(s.revision!==st.revision)await download(standId,st,local);
        st.libraryOnly=true;return;
      }
      // Reapply the same remote revision after lifecycle work completes so
      // the layout/light skipped during library-only sync is not forgotten.
      if(st.libraryOnly){await download(standId,st,local);return;}
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
      if(running||stopped||paused)return;running=true;
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
            // C98: only a lasting problem (several minutes), never a brief hiccup.
            if(st.failures===10)hooks.notice?.(error?.code||'SHARED_UNAVAILABLE');
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
    // C107: no polling while this phone opens or re-admits its stand (one MAIN owner session).
    function pause(){paused=true;}
    function resume(){if(!paused)return;paused=false;changed();}
    return Object.freeze({start,stop,tick,changed,forget,confirmedRemoval,pause,resume});
  }
  return Object.freeze({FORMAT,VERSION,MAX_BYTES,POLL_MS,create,merge,mergeList,documentFor,parse,canonical});
});
