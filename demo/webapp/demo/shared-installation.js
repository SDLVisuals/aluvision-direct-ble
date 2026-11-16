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
  // C111: what this phone last held in sync with the MAIN (layout and light),
  // per stand, kept across app restarts. On first contact after a restart the
  // MAIN's document wins, except for a layout or light this phone changed
  // after that sync and never got to publish (an edit made on a zone screen,
  // where publishing waits, right before the app was closed).
  const SYNC_KEY='aluvision.shared-sync.v1:';
  // C112: the MAIN stores the document in 768-byte chunks, one radio round
  // trip each (~0.2 s), so a 23 KB layout took ~8 s to share. A compressed
  // copy (deflate-raw, base64url behind the PACKED prefix) is ~6x smaller.
  // Reading accepts both forms, so plain documents of older apps still load.
  const PACKED='ALVZ1:';
  const streams=()=>typeof CompressionStream==='function'&&typeof DecompressionStream==='function'&&typeof Response==='function'&&typeof Blob==='function';
  function base64url(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  function unbase64url(text){const s=atob(text.replace(/-/g,'+').replace(/_/g,'/'));const out=new Uint8Array(s.length);for(let i=0;i<s.length;++i)out[i]=s.charCodeAt(i);return out;}
  async function pack(json){
    if(json.length<2048||!streams())return json;
    try{
      const bytes=new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
      const packed=PACKED+base64url(bytes);
      // Never store a copy that does not read back to the same document.
      return packed.length<json.length&&await unpack(packed)===json?packed:json;
    }catch(_){return json;}
  }
  async function unpack(text){
    if(typeof text!=='string'||!text.startsWith(PACKED))return text;
    if(!streams())throw Object.assign(Error('SHARED_FORMAT'),{code:'SHARED_FORMAT'});
    try{return await new Response(new Blob([unbase64url(text.slice(PACKED.length))]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();}
    catch(_){throw Object.assign(Error('SHARED_FORMAT'),{code:'SHARED_FORMAT'});}
  }
  function loadSynced(standId){try{const v=JSON.parse(globalThis.localStorage?.getItem(SYNC_KEY+standId)||'null');return v&&typeof v.model==='string'&&typeof v.light==='string'?v:null;}catch(_){return null;}}
  // C118: the libraries last held in sync are kept too. They are the merge base after a restart, so a phone's
  // old copy never counts as "added here" and never brings back what another phone deleted.
  function saveSynced(standId,doc){try{globalThis.localStorage?.setItem(SYNC_KEY+standId,JSON.stringify({model:canonical(doc.model),light:canonical(doc.light||{}),
    libraries:canonical(Object.fromEntries(LISTS.map(list=>[list,Array.isArray(doc.libraries?.[list])?doc.libraries[list]:[]])))}));}catch(_){}}
  function syncedLibraries(standId){try{const v=loadSynced(standId);if(!v||typeof v.libraries!=='string')return null;const libs=JSON.parse(v.libraries);
    return plain(libs)&&LISTS.every(list=>Array.isArray(libs[list]))?{libraries:libs}:null;}catch(_){return null;}}
  // C118: durable deletion of scenes, presets and colours. A deleted id is a tombstone {id: deletion time} in the
  // shared document (libraries.tombstones) and in this phone's own store, so no older copy, archive or upload
  // can bring it back. Same idea as the durable receiver removal / anti-ghost.
  const TOMB_KEY='aluvision.library-tombstones.v1:',TOMB_DAYS=365,TOMB_MAX=1000;
  function tombstonesOf(doc){
    const t=plain(doc?.libraries?.tombstones)?doc.libraries.tombstones:{},out={};
    for(const list of LISTS){out[list]={};const src=plain(t[list])?t[list]:{};
      for(const [id,at] of Object.entries(src))if(id.length>0&&id.length<=160&&Number.isSafeInteger(at)&&at>0)out[list][id]=at;}
    return out;
  }
  function unionTombstones(...all){
    const out={},cutoff=Date.now()-TOMB_DAYS*86400000;
    for(const list of LISTS){const m=new Map();
      for(const t of all)for(const [id,at] of Object.entries(t?.[list]||{}))if(Number.isSafeInteger(at)&&at>=cutoff)m.set(id,Math.max(m.get(id)||0,at));
      out[list]=Object.fromEntries([...m].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1)).slice(0,TOMB_MAX).sort((a,b)=>a[0]<b[0]?-1:1));}
    return out;
  }
  const hasTombstones=t=>LISTS.some(list=>Object.keys(t?.[list]||{}).length);
  function withoutTombstoned(libraries,tombs){
    for(const list of LISTS)if(Array.isArray(libraries[list]))libraries[list]=libraries[list].filter(item=>!(plain(item)&&typeof item.id==='string'&&Object.hasOwn(tombs[list]||{},item.id)));
    return libraries;
  }
  function loadLocalTombstones(standId){try{const v=JSON.parse(globalThis.localStorage?.getItem(TOMB_KEY+standId)||'null');return plain(v)?tombstonesOf({libraries:{tombstones:v}}):tombstonesOf(null);}catch(_){return tombstonesOf(null);}}
  // Ids in the base that this phone's libraries no longer hold were deleted here: stamp each once, durably.
  function recordLocalDeletions(standId,baseLibraries,localLibraries){
    if(!plain(baseLibraries))return loadLocalTombstones(standId);
    const saved=loadLocalTombstones(standId);let changed=false;const now=Date.now();
    for(const list of LISTS){const here=new Set((localLibraries?.[list]||[]).filter(plain).map(item=>item.id));
      for(const item of baseLibraries[list]||[])if(plain(item)&&typeof item.id==='string'&&!here.has(item.id)&&!saved[list][item.id]){saved[list][item.id]=now;changed=true;}}
    if(changed){const next=unionTombstones(saved);try{globalThis.localStorage?.setItem(TOMB_KEY+standId,JSON.stringify(next));}catch(_){}
      try{globalThis.__c98log?.('C118 LIBRARY_TOMBSTONE '+LISTS.map(list=>list+'='+Object.keys(next[list]).length).join(' '));}catch(_){}return next;}
    return saved;
  }

  function documentFor(standId,model,libraries,light,tombstones){
    const doc={format:FORMAT,version:VERSION,standId,model:copy(model),
      libraries:{scenes:copy(libraries.scenes||[]),presets:copy(libraries.presets||[]),colors:copy(libraries.colors||[])}};
    if(tombstones&&hasTombstones(tombstones)){doc.libraries.tombstones=unionTombstones(tombstones);withoutTombstoned(doc.libraries,doc.libraries.tombstones);}
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
  // C113: a receiver another phone removed (in the base, gone from remote)
  // never comes back through this phone's edited layout; it would become a
  // ghost entry that blocks finding and re-adding that receiver.
  function withoutRemovedElsewhere(model,base,remote){
    const ids=list=>new Set((Array.isArray(list)?list:[]).filter(plain).map(r=>r.id));
    const kept=ids(remote?.receivers),gone=[...ids(base?.receivers)].filter(id=>!kept.has(id));
    if(!gone.length||!Array.isArray(model.receivers))return model;
    const drop=new Set(gone);
    model.receivers=model.receivers.filter(r=>!drop.has(r?.id));
    for(const zone of Array.isArray(model.stand?.zones)?model.stand.zones:[]){
      if(Array.isArray(zone.receiverIds))zone.receiverIds=zone.receiverIds.filter(id=>!drop.has(id));
      if(Array.isArray(zone.lineOrder))zone.lineOrder=zone.lineOrder.filter(line=>!drop.has(String(line).replace(/:[0-9]+$/,'')));
    }
    return model;
  }
  function merge(base,local,remote,libraryBase){
    const result=copy(remote);
    // Layout: this phone's edit wins only if it changed it since the common
    // base. Without a base (first contact) the MAIN's layout wins.
    if(base&&canonical(local.model)!==canonical(base.model))result.model=withoutRemovedElsewhere(copy(local.model),base.model,remote.model);
    // C118: libraries merge against the last synchronized libraries. Without any base the MAIN's libraries win,
    // exactly like the layout: an old local copy is never "added here". Tombstones always win.
    const libBase=base?.libraries||libraryBase?.libraries||null;
    for(const list of LISTS)result.libraries[list]=libBase?mergeList(libBase[list],local.libraries[list],remote.libraries[list]):copy(remote.libraries[list]||[]);
    const tombs=unionTombstones(tombstonesOf(remote),tombstonesOf(local),tombstonesOf(base));
    if(hasTombstones(tombs)){result.libraries.tombstones=tombs;withoutTombstoned(result.libraries,tombs);}
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
   *        statusIdle() -> boolean         (optional: a status question may run now)
   *        notice(code)                    (optional user-facing problem) */
  function create(hooks){
    const states=new Map();let timer=null,running=false,stopped=false,paused=false;
    const stateOf=standId=>{if(!states.has(standId))states.set(standId,{revision:null,doc:null,key:null,failures:0,until:0,layoutBlocked:false,libraryOnly:false,removal:null,removalProtected:false});return states.get(standId);};
    const encoder=typeof TextEncoder==='function'?new TextEncoder():null;
    const bytes=text=>encoder?encoder.encode(text).length:text.length;
    const current=(standId,st)=>!stopped&&states.get(standId)===st&&hooks.stands().includes(standId);
    const deferred=()=>Object.assign(Error('SHARED_DEFERRED'),{code:'SHARED_DEFERRED'});
    // C137e: a phone that adopted a receiver without its stand context (C134) has it without zone, or not at all
    // (RELAY_TOMBSTONED, not reachable at load). Its upload must never wipe what the MAIN document holds for it:
    // - a receiver in the MAIN document that this phone does not have (and is not removing) stays, with its zone place;
    // - a receiver that has no zone here but one in the MAIN document keeps that zone, unless this phone changed
    //   zones itself (editZones) since the last synchronization.
    // C137y: a receiver may never point at a zone the document does not have (seen after a zone delete): it becomes
    // "no zone" instead of a dangling reference, both before an upload and before applying a downloaded document.
    function dropDanglingZonesC137(model){
      if(!plain(model)||!Array.isArray(model.receivers)||!Array.isArray(model.stand?.zones))return model;
      const ids=new Set(model.stand.zones.map(z=>z?.id));let next=null;
      model.receivers.forEach((r,i)=>{if(plain(r)&&r.zoneId!=null&&!ids.has(r.zoneId)){next=next||copy(model);next.receivers[i].zoneId=null;}});
      if(next)try{globalThis.__c98log?.('C137 SHARED_DANGLING_ZONE fixed');}catch(_){}
      return next||model;
    }
    function preserveFromMainC137(standId,st,model){
      const base=st.doc?.model;if(!base||!plain(model)||!Array.isArray(model.receivers)||!Array.isArray(base.receivers))return model;
      const zones=Array.isArray(model.stand?.zones)?model.stand.zones:null,baseZones=Array.isArray(base.stand?.zones)?base.stand.zones:[];
      if(!zones)return model;
      const removing=new Set(loadRemovals(standId).targets.map(t=>t.id));
      // C137u: only a receiver whose zone THIS phone changed since the last sync may lose the MAIN's zone.
      const zoneEdited=id=>(globalThis.__zoneEditsC137?.[id]||0)>(st.syncedAtC137||0);
      let next=null;const out=()=>next||(next=copy(model));const kept=[],touched=new Map();
      // Base order first (the MAIN's ledline order stays exactly as it was), then what only this phone has.
      const ordered=(baseList,localList,keep)=>{const all=Array.isArray(localList)?localList:[];const fromBase=(Array.isArray(baseList)?baseList:[]).filter(x=>all.includes(x)||keep(x));
        return [...fromBase,...all.filter(x=>!fromBase.includes(x))];};
      const mark=(id,zoneId)=>{if(!baseZones.some(z=>z?.id===zoneId)||!zones.some(z=>z?.id===zoneId))return false;if(!touched.has(zoneId))touched.set(zoneId,new Set());touched.get(zoneId).add(id);return true;};
      const kidsOrder=[];
      for(const row of base.receivers){
        if(!plain(row)||typeof row.id!=='string'||removing.has(row.id))continue;
        const here=model.receivers.find(r=>r?.id===row.id);
        if(!here){
          if(row.role==='main')continue;
          out().receivers.push(copy(row));if(row.zoneId)mark(row.id,row.zoneId);kept.push(row.id+':kept');kidsOrder.push(row.id);continue;
        }
        if(!zoneEdited(row.id)&&here.zoneId==null&&row.zoneId&&mark(row.id,row.zoneId)){
          out().receivers.find(x=>x?.id===row.id).zoneId=row.zoneId;kept.push(row.id+':zone');st.preserveNeedsApplyC137=true;
        }
      }
      if(next){
        const baseIds=base.receivers.map(r=>r?.id);
        next.receivers=ordered(baseIds,next.receivers.map(r=>r.id),()=>false).map(id=>next.receivers.find(r=>r.id===id));
        for(const [zoneId,ids] of touched){
          const zone=next.stand.zones.find(z=>z?.id===zoneId),from=baseZones.find(z=>z?.id===zoneId);
          if(Array.isArray(zone.receiverIds))zone.receiverIds=ordered(from.receiverIds,zone.receiverIds,id=>ids.has(id));
          if(Array.isArray(zone.lineOrder))zone.lineOrder=ordered(from.lineOrder,zone.lineOrder,line=>ids.has(String(line).replace(/:[0-9]+$/,'')));
        }
      }
      if(next&&Date.now()-(st.preserveLoggedC137||0)>30000){st.preserveLoggedC137=Date.now();removalLog('C137 SHARED_PRESERVE '+kept.join(','));}
      return next||model;
    }
    function localDocument(standId,st,snap){
      const tombs=unionTombstones(tombstonesOf(st.doc),recordLocalDeletions(standId,st.doc?.libraries||syncedLibraries(standId)?.libraries,snap.libraries));
      return documentFor(standId,st.layoutBlocked&&st.doc?st.doc.model:dropDanglingZonesC137(preserveFromMainC137(standId,st,snap.model)),snap.libraries,
        st.removalProtected&&st.layoutBlocked&&st.doc?st.doc.light:snap.light,tombs);
    }
    async function upload(standId,st,doc,controlScreen=false){
      const snap=hooks.snapshot(standId);
      if(!current(standId,st)||!snap||snap.writable===false||(controlScreen?!hooks.controlUploadIdle?.():hooks.idle&&!hooks.idle()))throw deferred();
      const json=await pack(canonical(doc));if(bytes(json)>MAX_BYTES){hooks.notice?.('SHARED_TOO_LARGE');return false;}
      if(!current(standId,st))return false;
      const r=await hooks.services.sharedDocument({op:'write',standId,base:st.revision||0,json});
      if(!current(standId,st))return false;
      if(r?.status==='committed'){st.revision=r.revision;st.doc=doc;st.key=canonical(doc);st.syncedAtC137=Date.now();saveSynced(standId,doc);hooks.seen?.(standId,r.revision);return true;}
      // From a control screen another phone's newer document is not merged
      // here; that waits until this screen is left (the ordinary pass).
      if(r?.status==='conflict'){if(controlScreen){st.controlConflict=true;return false;}await download(standId,st,doc);return false;}
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
      try{remote=parse(await unpack(r.json),standId);remote.model=dropDanglingZonesC137(remote.model);}
      catch(error){if(error?.code!=='SHARED_FOREIGN')throw error;st.revision=r.revision;st.doc=null;st.key='';st.libraryOnly=libraryOnly;return;}
      const pending=local&&st.key!==null&&canonical(local)!==st.key;
      let next=pending||st.revision===null&&local?merge(st.doc,local,remote,st.doc?null:syncedLibraries(standId)):remote;
      // C118: an item this phone deleted (its own tombstone) never comes back from a document that still holds it;
      // the merged document (with the tombstone) is uploaded on the next pass.
      const ownTombs=loadLocalTombstones(standId);
      if(next===remote&&hasTombstones(ownTombs)&&LISTS.some(list=>(remote.libraries[list]||[]).some(item=>plain(item)&&Object.hasOwn(ownTombs[list],item.id)))){
        next=copy(remote);next.libraries.tombstones=unionTombstones(tombstonesOf(remote),ownTombs);withoutTombstoned(next.libraries,next.libraries.tombstones);
      }
      if(st.revision===null&&local&&!pending&&!libraryOnly&&next!==remote){
        const synced=loadSynced(standId);
        if(synced){
          if(canonical(local.model)!==synced.model&&canonical(local.model)!==canonical(remote.model))next.model=copy(local.model);
          if(local.light&&canonical(local.light)!==synced.light&&canonical(local.light)!==canonical(remote.light||{}))next.light=copy(local.light);
        }
      }
      const applied=await hooks.apply(standId,next,{revision:r.revision,libraryOnly});
      if(!current(standId,st))return;
      // A layout this phone cannot show yet (a receiver added elsewhere) is
      // never overwritten by this phone's older layout.
      if(!libraryOnly){st.layoutBlocked=applied?.layout===false;if(!st.layoutBlocked)st.removalProtected=false;if(st.layoutBlocked)hooks.notice?.('SHARED_LAYOUT_NEEDS_PIN',{standId});}
      st.libraryOnly=libraryOnly;
      st.revision=r.revision;st.doc=remote;st.syncedAtC137=Date.now();hooks.seen?.(standId,r.revision);
      // What this phone holds right after applying counts as in sync, even
      // if its native layer normalised it (order, derived fields). Only a
      // real user edit differs from it later, so two phones never upload in
      // turns. A merge still differs on purpose: it must be uploaded.
      const after=next===remote||canonical(next)===canonical(remote)?hooks.snapshot(standId):null;
      // C98: this phone's own layout is newer than the MAIN's document; keep
      // the key on the document so the next pass uploads this layout.
      const syncedDoc=applied?.layout!=='local'&&after?documentFor(standId,st.layoutBlocked?remote.model:preserveFromMainC137(standId,st,after.model),
          // Native layout adoption may await I/O. Only the libraries actually
          // installed by apply count as synchronized; later edits stay dirty.
          applied?.libraries||next.libraries,st.removalProtected&&st.layoutBlocked?remote.light:after.light,tombstonesOf(remote)):null;
      st.key=syncedDoc?canonical(syncedDoc):canonical(remote);
      if(syncedDoc&&!st.layoutBlocked)saveSynced(standId,syncedDoc);
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
    // C118: a confirmed removal is durable intent of this phone. It is kept per stand across app restarts and
    // retried after a conflict or an uncertain write, always as one exact CAS on a freshly read document that
    // still holds the exact removed identity (id, rid, fingerprint). A receiver that came back meanwhile with
    // another fingerprint (factory reset, added again) is never removed by this old receipt.
    const REMOVAL_KEY='aluvision.shared-removal.v1:',REMOVAL_DAYS=14;
    const removalLog=text=>{try{globalThis.__c98log?.(text);}catch(_){}};
    function loadRemovals(standId){
      try{
        const v=JSON.parse(globalThis.localStorage?.getItem(REMOVAL_KEY+standId)||'null');
        if(!plain(v)||!Array.isArray(v.targets)||!Number.isFinite(v.at))return {targets:[],at:0};
        if(Date.now()-v.at>REMOVAL_DAYS*86400000){globalThis.localStorage?.removeItem(REMOVAL_KEY+standId);removalLog('C118 SHARED_REMOVAL_EXPIRED');return {targets:[],at:0};}
        const targets=v.targets.filter(row=>removedIdentity(row)&&row.standId===standId).slice(0,64);
        return {targets:targets.filter((row,index)=>targets.findIndex(other=>other.id===row.id)===index),at:v.at};
      }catch(_){return {targets:[],at:0};}
    }
    function saveRemovals(standId,targets,at){
      try{
        if(!targets.length)globalThis.localStorage?.removeItem(REMOVAL_KEY+standId);
        else globalThis.localStorage?.setItem(REMOVAL_KEY+standId,JSON.stringify({targets:copy(targets),at:at||Date.now()}));
        return true;
      }catch(_){return false;}
    }
    // Turn the durable intent into one CAS job on the current authenticated base.
    function planRemoval(standId,st,snap){
      if(st.removal||!current(standId,st)||!snap||snap.writable===false||!Number.isSafeInteger(st.revision)||st.revision<1||!st.doc)return false;
      const saved=loadRemovals(standId);if(!saved.targets.length)return false;
      const rows=Array.isArray(st.doc.model?.receivers)?st.doc.model.receivers:[],local=Array.isArray(snap.model?.receivers)?snap.model.receivers:[];
      const keep=saved.targets.filter(target=>{
        // Added again on this phone: the ordinary layout path owns that receiver now.
        if(local.some(row=>row?.id===target.id||row?.rid===target.rid)){removalLog('C118 SHARED_REMOVAL_OBSOLETE local '+target.id);return false;}
        // Gone from the document (another phone published it) or there with another identity (re-added): done.
        if(!rows.some(row=>sameRemoved(row,target))){removalLog('C118 SHARED_REMOVAL_SETTLED '+target.id+(rows.some(row=>row?.id===target.id)?' readded':' absent'));return false;}
        return true;
      });
      if(keep.length!==saved.targets.length)saveRemovals(standId,keep,saved.at);
      if(!keep.length)return false;
      const next=pruneConfirmed(st.doc,standId,keep);
      if(!next){removalLog('C118 SHARED_REMOVAL_WAIT shape');return false;}
      st.removal={base:st.revision,doc:st.doc,targets:copy(keep),next};
      st.layoutBlocked=true;st.removalProtected=true;return true;
    }
    function confirmedRemoval(standId,identities){
      const st=hooks.stands().includes(standId)?stateOf(standId):null,snap=hooks.snapshot(standId);
      if(st&&current(standId,st)){st.layoutBlocked=true;st.removalProtected=true;}
      if(!Array.isArray(identities)||!identities.length)return 'NO_SHARED_BASE';
      if(identities.length>64||identities.some(row=>!removedIdentity(row)||row.standId!==standId))return 'IDENTITY_CHANGED';
      const saved=loadRemovals(standId);
      const targets=[...identities,...saved.targets].filter((row,index,all)=>all.findIndex(other=>other.id===row.id)===index).slice(0,64);
      if(!saveRemovals(standId,targets,saved.at||Date.now()))removalLog('C118 SHARED_REMOVAL_NOT_DURABLE');
      if(st&&current(standId,st)&&st.removal){st.removal=null;}
      // Without a synchronized revision the intent waits for the next validated read.
      const queued=st&&planRemoval(standId,st,snap);
      changed();return queued?'QUEUED':'QUEUED_DURABLE';
    }
    async function publishConfirmedRemoval(standId,st,snap){
      const job=st.removal;
      if(!job||!current(standId,st)||hooks.idle&&!hooks.idle())return;
      const fresh=hooks.snapshot(standId);if(!fresh||fresh.writable===false||!current(standId,st)||hooks.idle&&!hooks.idle())return;
      st.removal=null;
      // Another base or a changed local stand: read again; the durable intent is re-planned on that read.
      if(job.base!==st.revision||job.doc!==st.doc||!stillRemoved(fresh,job.targets)){
        st.revision=null;removalLog('C118 SHARED_REMOVAL_RECONCILE');return;
      }
      const json=await pack(canonical(job.next));if(bytes(json)>MAX_BYTES){hooks.notice?.('SHARED_TOO_LARGE');return;}
      if(!current(standId,st))return;
      // Exactly one CAS per job; conflicts and uncertain writes require a fresh read,
      // never rebase an old removal onto another incarnation or new revision.
      let result;
      try{result=await hooks.services.sharedDocument({op:'write',standId,base:job.base,json});}
      catch(error){if(current(standId,st)){st.revision=null;removalLog('C118 SHARED_REMOVAL_UNCONFIRMED retry');}throw error;}
      if(!current(standId,st))return;
      if(result?.status==='committed'&&Number.isSafeInteger(result.revision)&&result.revision>job.base){
        st.doc=job.next;st.key=canonical(job.next);hooks.seen?.(standId,result.revision);
        const saved=loadRemovals(standId),done=new Set(job.targets.map(row=>row.id));
        saveRemovals(standId,saved.targets.filter(row=>!done.has(row.id)||!job.targets.some(target=>sameRemoved(target,row))),saved.at);
        removalLog('C118 SHARED_REMOVAL_COMMITTED rev='+result.revision+' n='+job.targets.length);
      }else removalLog('C118 SHARED_REMOVAL_'+(result?.status==='conflict'?'CONFLICT':'UNCONFIRMED')+' retry');
      st.revision=null;
      // Adopt current names/libraries through the ordinary validated reader;
      // the next pass re-plans whatever is still pending on that fresh base.
      await download(standId,st,null);
    }
    // C137c: a status-only question (nothing to upload) at most every 10 s, 5 s for 30 s after an action.
    function statusDue(st){const gap=globalThis.__pollGapC137?.()??10000;if(Date.now()-(st.statusAt||0)<gap)return false;
      // C138ui: no status-only question while the user is operating (at most 20 s late; uploads are not held).
      if((globalThis.__interactiveHoldC138ui?.()||0)>0&&Date.now()-(st.statusAt||0)<20000)return false;
      st.statusAt=Date.now();return true;}
    async function pass(standId){
      const st=stateOf(standId);if(Date.now()<st.until)return;st.controlConflict=false;
      // C137l: this phone shows a receiver without the zone the MAIN document gives it (adopted without its stand context):
      // the document is applied here once per revision, so this phone's own view gets the zone back as well.
      if(st.preserveNeedsApplyC137&&Number.isSafeInteger(st.revision)&&st.preserveAppliedRevC137!==st.revision&&(!hooks.idle||hooks.idle())){
        st.preserveNeedsApplyC137=false;st.preserveAppliedRevC137=st.revision;removalLog('C137 SHARED_APPLY_ZONES rev='+st.revision);
        await download(standId,st,null);return;
      }
      const snap=hooks.snapshot(standId);if(!snap)return;
      if(!st.removal&&snap.writable!==false)planRemoval(standId,st,snap);
      if(st.removal&&snap.writable!==false){await publishConfirmedRemoval(standId,st,snap);return;}
      const local=localDocument(standId,st,snap),localKey=canonical(local);
      if(snap.writable===false){
        // Pending addition/removal blocks publishing layout, not reading the
        // independent scene/preset libraries. Never upload this projection.
        if(!statusDue(st))return;
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
      if(!statusDue(st))return;
      const s=await hooks.services.sharedDocument({op:'status',standId});
      if(s.revision!==st.revision)await download(standId,st,null);
    }
    // C111: on a zone/stand control screen reading and publishing wait, but a
    // short status question every 25 s keeps the connection indicator honest
    // ("Verbonden" needs a MAIN exchange within 40 s). Same fast owner lane as
    // the light on iPhone and Android, so it never displaces light control.
    let lastStatusC111=0;
    async function keepAlive(){
      if(!hooks.statusIdle?.()||Date.now()-lastStatusC111<25000)return;lastStatusC111=Date.now();
      for(const standId of hooks.stands()){const st=stateOf(standId);if(st.revision===null||Date.now()<st.until)continue;
        try{await hooks.services.sharedDocument({op:'status',standId});}catch(_){/* the next real pass reports lasting problems */}}
    }
    // C113: on a control screen the light was only shared after leaving it,
    // so other phones kept showing an old animation. A write now takes about
    // 1.3 s on the same fast owner lane as the light, so once the light has
    // been quiet this phone uploads its own change from there too.
    async function controlUpload(){
      for(const standId of hooks.stands()){
        const st=stateOf(standId);
        const log=globalThis.__c98log;
        if(st.revision===null||st.libraryOnly||st.removal||st.controlConflict||Date.now()<st.until){log?.('SHARED_CONTROL skip rev='+st.revision+' lib='+!!st.libraryOnly+' conflict='+!!st.controlConflict);continue;}
        const snap=hooks.snapshot(standId);if(!snap||snap.writable===false){log?.('SHARED_CONTROL skip snapshot');continue;}
        const local=localDocument(standId,st,snap);if(canonical(local)===st.key)continue;
        log?.('SHARED_CONTROL upload');
        try{await upload(standId,st,local,true);st.failures=0;}
        catch(error){
          if(['SHARED_DEFERRED','LIVE_CONTROL_BUSY','LIVE_CONTROL_SUPERSEDED','SHARED_BUSY'].includes(error?.code))continue;
          st.failures++;st.until=Date.now()+Math.min(30000,POLL_MS*2**Math.min(st.failures,4));
        }
      }
    }
    async function tick(){
      if(running||stopped||paused)return;running=true;
      try{
        if(hooks.idle&&!hooks.idle()){if(hooks.controlUploadIdle?.())await controlUpload();else{if(Date.now()-(tick.logged||0)>5000){tick.logged=Date.now();globalThis.__c98log?.('SHARED_CONTROL waiting');}await keepAlive();}return;}
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
