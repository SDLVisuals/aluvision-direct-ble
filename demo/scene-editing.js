/* Pure saved-scene editing. Loading is explicit intent; the caller alone
 * dispatches returned receiver IDs and performs explicit scene persistence. */
(function(root,factory){
  const cjs=typeof module==='object'&&module.exports;
  const api=factory(cjs?require('./model.js'):root.LightningModel,
    cjs?require('./scenes.js'):root.LightningScenes,
    cjs?require('./stand-animations.js'):root.LightningStandAnimations);
  if(cjs)module.exports=api;else root.LightningSceneEditing=api;
}(typeof globalThis==='object'?globalThis:this,function(M,Scenes,StandAnimations){
  'use strict';
  if(!M||!Scenes||!StandAnimations)throw Error('Load model, scenes and stand-animations before scene-editing.js');
  const copy=value=>JSON.parse(JSON.stringify(value));
  const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
  function fail(message){throw Object.assign(Error(message),{code:'SCENE_EDIT_CHANGED'});}
  function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
  function canonical(value){
    if(Array.isArray(value))return value.map(canonical);
    if(plain(value))return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
    return value;
  }
  const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const shared=scene=>scene.zones.some(zone=>zone.receivers.some(receiver=>Object.hasOwn(receiver.state,'standAnimation')));
  function scopeSignature(model,standId){
    M.assertValid(model);
    const stand=model.stands.find(item=>item.id===standId);
    if(!stand)fail('Deze stand bestaat niet meer. Open de scène opnieuw.');
    const zones=stand.zones.map(zone=>({id:zone.id,type:zone.type,layout:zone.layout,
      receiverIds:[...zone.receiverIds],lineOrder:M.lineIds(model,zone.id)})).sort((a,b)=>a.id.localeCompare(b.id));
    const receivers=model.receivers.filter(receiver=>receiver.standId===standId).map(receiver=>({
      id:receiver.id,standId:receiver.standId,zoneId:receiver.zoneId,type:receiver.type,role:receiver.role,
      lifecycle:receiver.lifecycle,rid:receiver.rid??null,deviceFingerprint:receiver.deviceFingerprint??null,
      outputs:copy(receiver.outputs)
    })).sort((a,b)=>a.id.localeCompare(b.id));
    return JSON.stringify(canonical({standId,zones,receivers}));
  }
  function current(session,model){
    if(!plain(session)||session.version!==1||!plain(session.original)||!plain(session.dirtyByReceiverId)||
       session.standId!==session.original.standId||!Array.isArray(session.zoneIds)||typeof session.scopeSignature!=='string')
      fail('Deze scènebewerking is niet meer geldig. Open de scène opnieuw.');
    const original=Scenes.validate(session.original);
    if(!equal(session.zoneIds,original.zones.map(zone=>zone.id))||session.shared!==shared(original)||
       scopeSignature(model,session.standId)!==session.scopeSignature)
      fail('De receivers, ledlines of opstelling zijn veranderd. Open de scène opnieuw; je opgeslagen scène is niet gewijzigd.');
    return original;
  }
  function requireCompatible(model,scene,exact=false){
    const check=Scenes.compatibility(model,scene);
    if(!check.ok)fail(check.reason);
    if(exact){const zones=Scenes.previewZones(model,scene),bad=zones.find(zone=>!zone.available);if(bad)fail(bad.reason);}
  }
  function validateShared(model,scene){
    if(shared(scene)&&!StandAnimations.active(Scenes.apply(model,scene),scene.standId))
      fail('Deze gezamenlijke animatie gebruikt de hele stand. Kies alle zones of open de scène opnieuw.');
  }
  function captureCurrent(model,session){
    const stand=model.stands.find(item=>item.id===session.standId);
    const zoneIds=stand.zones.filter(zone=>M.zoneReceivers(model,zone.id).length).map(zone=>zone.id);
    if(!zoneIds.length)fail('Deze stand heeft geen verlichting om te bewaren.');
    try{return Scenes.capture(model,session.standId,zoneIds,session.original.name,{id:session.original.id});}
    catch(error){fail(error.message);}
  }
  function begin(model,input,{zoneId=null}={}){
    const original=Scenes.validate(input);requireCompatible(model,original,true);validateShared(model,original);
    if(zoneId!==null&&!original.zones.some(zone=>zone.id===zoneId))fail('Deze zone hoort niet bij de opgeslagen scène.');
    const wholeStandLoaded=zoneId===null||shared(original);
    const selected=wholeStandLoaded?original:{...original,zones:original.zones.filter(zone=>zone.id===zoneId)};
    const loaded=Scenes.apply(model,selected);
    const session=freeze({version:1,standId:original.standId,original:copy(original),
      zoneIds:original.zones.map(zone=>zone.id),scopeSignature:scopeSignature(model,original.standId),
      shared:shared(original),dirtyByReceiverId:{}});
    return {session,model:loaded,receiverIds:selected.zones.flatMap(zone=>zone.receivers.map(receiver=>receiver.id)),wholeStandLoaded};
  }
  function record(session,model,receiverIds){
    const original=current(session,model);
    if(!Array.isArray(receiverIds)||receiverIds.some(id=>typeof id!=='string')||new Set(receiverIds).size!==receiverIds.length)
      fail('De gewijzigde receivers zijn niet geldig.');
    const selected=[];
    for(const id of receiverIds){
      const receiver=model.receivers.find(item=>item.id===id);
      if(!receiver)fail('Een gewijzigde receiver bestaat niet meer. Open de scène opnieuw.');
      if(receiver.standId===session.standId){
        if(receiver.lifecycle!=='added'||receiver.zoneId===null)fail('Wijs deze receiver eerst aan een zone toe.');
        selected.push(id);
      }
    }
    if(!selected.length)return session;
    const captured=captureCurrent(model,session),states=new Map(captured.zones.flatMap(zone=>zone.receivers.map(receiver=>[receiver.id,receiver.state])));
    const saved=new Map(original.zones.flatMap(zone=>zone.receivers.map(receiver=>[receiver.id,receiver.state])));
    const dirty=copy(session.dirtyByReceiverId);
    for(const id of selected){
      const state=states.get(id);if(!state)fail('De gewijzigde receiver hoort niet meer bij deze scènebewerking.');
      if(saved.has(id)&&equal(saved.get(id),state))delete dirty[id];
      else Object.defineProperty(dirty,id,{value:copy(state),enumerable:true,configurable:true,writable:true});
    }
    return freeze({...session,dirtyByReceiverId:dirty});
  }
  function build(session,model,{zoneIds=session.zoneIds,name=session.original.name}={}){
    const original=current(session,model);
    if(!Array.isArray(zoneIds)||!zoneIds.length||zoneIds.some(id=>typeof id!=='string')||new Set(zoneIds).size!==zoneIds.length)
      fail('Kies minstens één zone om in deze scène te bewaren.');
    const savedZones=new Map(original.zones.map(zone=>[zone.id,zone]));
    const materializeShared=session.shared&&Object.keys(session.dirtyByReceiverId).length>0;
    const needsCurrent=materializeShared||zoneIds.some(id=>!savedZones.has(id));
    const captured=needsCurrent?captureCurrent(model,session):null;
    const currentZones=new Map((captured?.zones||[]).map(zone=>[zone.id,zone]));
    const currentStates=new Map((captured?.zones||[]).flatMap(zone=>zone.receivers.map(receiver=>[receiver.id,receiver.state])));
    const zones=zoneIds.map(id=>{
      const saved=savedZones.get(id);
      if(!saved){const added=currentZones.get(id);if(!added)fail('Deze zone is leeg, verwijderd of hoort bij een andere stand.');return copy(added);}
      const zone=copy(saved);
      for(const receiver of zone.receivers){
        const state=materializeShared?currentStates.get(receiver.id):Object.hasOwn(session.dirtyByReceiverId,receiver.id)?session.dirtyByReceiverId[receiver.id]:null;
        if(materializeShared&&!state)fail('De gezamenlijke animatie kan niet gedeeltelijk worden bijgewerkt. Kies alle zones.');
        if(state)receiver.state=copy(state);
      }
      return zone;
    });
    const result=Scenes.validate({...original,name,zones});
    requireCompatible(model,result,true);validateShared(model,result);
    return result;
  }
  function loadZone(session,model,zoneId){
    const draft=build(session,model);
    if(!draft.zones.some(zone=>zone.id===zoneId))fail('Deze zone hoort niet bij de opgeslagen scène.');
    const wholeStandLoaded=shared(draft);
    const selected=wholeStandLoaded?draft:{...draft,zones:draft.zones.filter(zone=>zone.id===zoneId)};
    return {session,model:Scenes.apply(model,selected),
      receiverIds:selected.zones.flatMap(zone=>zone.receivers.map(receiver=>receiver.id)),wholeStandLoaded};
  }
  function loadAll(session,model,{zoneIds=session.zoneIds,name=session.original.name}={}){
    const draft=build(session,model,{zoneIds,name});
    return {session,model:Scenes.apply(model,draft),
      receiverIds:draft.zones.flatMap(zone=>zone.receivers.map(receiver=>receiver.id)),wholeStandLoaded:true};
  }
  function variation(input,id,name){
    const original=Scenes.validate(input);
    if(typeof id!=='string'||!id||id===original.id)fail('Deze scène kon niet als nieuwe scène worden bewaard.');
    return Scenes.validate({...original,id,name:name===undefined?original.name:name});
  }
  function activation(model,input){
    const scene=Scenes.validate(input);requireCompatible(model,scene,true);validateShared(model,scene);
    return {model:Scenes.apply(model,scene),receiverIds:scene.zones.flatMap(zone=>zone.receivers.map(receiver=>receiver.id))};
  }
  return Object.freeze({begin,record,build,loadZone,loadAll,variation,activation});
}));
