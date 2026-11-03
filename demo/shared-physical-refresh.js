/* Native reads only: shared line identities are a hint, never output settings. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.LightningSharedPhysicalRefreshC98=factory();})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  // C105: compact, stable summary of one SPI receiver's outputs.
  function outputsHint(receiver){
    return Array.isArray(receiver?.outputs)?receiver.outputs.map(o=>[o.port,o.enabled===true?1:0,o.pixels,o.reversed===true?1:0].join(':')).join(','):'';
  }
  function candidates(model,remote){
    if(!model||!remote||!remote.stand||!Array.isArray(remote.receivers)||!Array.isArray(remote.stand.zones)||remote.receivers.length>64)return null;
    const stand=model.stands?.find(s=>s.id===remote.stand.id);if(!stand)return null;
    const local=new Map(model.receivers.filter(r=>r.standId===stand.id).map(r=>[r.id,r]));
    const seen=new Set(),known=new Map(),ports=new Map(),missingOrder=new Set();
    for(const r of remote.receivers){
      const own=local.get(r?.id);
      if(!own||seen.has(r.id)||own.lifecycle!=='added'||r.standId!==stand.id||['rid','deviceFingerprint','type','role'].some(k=>r[k]!==own[k]))return null;
      seen.add(r.id);known.set(r.id,own);
    }
    if(seen.size!==local.size)return null;
    const lines=new Set();
    for(const zone of remote.stand.zones){
      if(!Array.isArray(zone.receiverIds)||zone.receiverIds.some(id=>!known.has(id)))return null;
      if(!Object.hasOwn(zone,'lineOrder')){
        // Older documents did not publish an order until it was edited.
        // Read known SPI geometry once; the caller publishes a full native
        // line list, so the next unchanged revision needs no further read.
        for(const id of zone.receiverIds)if(known.get(id).type==='SPI')missingOrder.add(id);
        continue;
      }
      if(!Array.isArray(zone.lineOrder)||zone.lineOrder.length>256)return null;
      for(const id of zone.lineOrder){
        if(typeof id!=='string'||lines.has(id))return null;lines.add(id);
        const colon=id.lastIndexOf(':'),rid=id.slice(0,colon),text=id.slice(colon+1),own=known.get(rid);
        if(colon<1||!own||!zone.receiverIds.includes(rid)||!/^\d$/.test(text))return null;
        const port=Number(text);if(own.type==='RGBW'){if(port!==0)return null;continue;}
        if(own.type!=='SPI'||port<1||port>4)return null;
        if(!ports.has(rid))ports.set(rid,new Set());ports.get(rid).add(port);
      }
    }
    const result=[...missingOrder];
    for(const [id,requested] of ports){
      const own=known.get(id),actual=own.outputs?.filter(p=>p.enabled===true).map(p=>p.port);
      if(!Array.isArray(actual))return null;
      if(actual.length!==requested.size||actual.some(p=>!requested.has(p)))if(!missingOrder.has(id))result.push(id);
    }
    return result.sort();
  }
  // C105: SPI receivers whose output summary from another phone (ports,
  // pixels, direction) differs from this phone's own. Only a reason for one
  // authenticated readback; the hint itself is never applied as a setting.
  function hintCandidates(model,remote){
    const hints=remote?.outputsC105,stand=model?.stands?.find(s=>s.id===remote?.stand?.id);
    if(!stand||!hints||typeof hints!=='object'||Array.isArray(hints))return [];
    return Object.entries(hints).filter(([id,hint])=>{
      const own=model.receivers.find(r=>r.id===id&&r.standId===stand.id&&r.lifecycle==='added');
      return own&&own.type==='SPI'&&typeof hint==='string'&&hint.length<=200&&hint!==outputsHint(own);
    }).map(([id])=>id).sort();
  }
  return Object.freeze({candidates,outputsHint,hintCandidates});
});
