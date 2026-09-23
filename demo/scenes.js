/* V30 scenes contain light snapshots, never credentials or port configuration.
 * All IO is explicit and uses only this preview's namespaced local store. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./model.js'):root.LightningModel,
    typeof module==='object'&&module.exports?require('./presets.js'):root.LightningPresets);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningScenes=api;
})(typeof globalThis==='object'?globalThis:this,function(M,P){
  'use strict';
  const STORAGE_KEY='aluvision.v30.scenes.v1',MAX_SCENES=100,copy=v=>JSON.parse(JSON.stringify(v));
  const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
  const text=(v,max=160)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u001f]/.test(v);
  function fail(message){throw Error(message);}
  function light(state,strict=false){
    return P.sanitizeLightState(state,strict);
  }
  function validate(scene){
    if(!plain(scene)||scene.version!==1||!text(scene.id)||!text(scene.standId)||!text(scene.name,64)||!Array.isArray(scene.zones)||!scene.zones.length||scene.zones.length>100)fail('Deze scène is niet geldig.');
    const zoneIds=new Set(),receiverIds=new Set();
    const zones=scene.zones.map(z=>{
      if(!plain(z)||!text(z.id)||zoneIds.has(z.id)||!text(z.name,64)||!['RGBW','SPI'].includes(z.type)||!Array.isArray(z.receivers)||!z.receivers.length||z.receivers.length>1000)fail('De zones in de scène zijn niet geldig.');
      zoneIds.add(z.id);
      return {id:z.id,name:z.name,type:z.type,receivers:z.receivers.map(r=>{
        if(!plain(r)||!text(r.id)||receiverIds.has(r.id))fail('Een receiver staat meermaals in de scène.');
        receiverIds.add(r.id);return {id:r.id,state:light(r.state,true)};
      })};
    });
    return {version:1,id:scene.id,standId:scene.standId,name:scene.name.trim(),zones};
  }
  function capture(model,standId,zoneIds,name,options={}){
    M.assertValid(model);
    if(!text(name,64)||!Array.isArray(zoneIds)||!zoneIds.length||new Set(zoneIds).size!==zoneIds.length)fail('Kies minstens één zone en geef je scène een naam.');
    const stand=model.stands.find(s=>s.id===standId);if(!stand)fail('Deze stand bestaat niet.');
    return validate({version:1,id:options.id||'scene-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),standId,name,
      zones:zoneIds.map(id=>{const z=stand.zones.find(z=>z.id===id);if(!z)fail('De gekozen zone hoort niet bij deze stand.');
        return {id:z.id,name:z.name,type:z.type,receivers:M.zoneReceivers(model,z.id).map(r=>({id:r.id,state:light(r.state)}))};})});
  }
  function previewZones(model,input){
    const scene=validate(input);M.assertValid(model);
    const stand=model.stands.find(s=>s.id===scene.standId);
    const zones=new Map((stand?.zones||[]).map(z=>[z.id,z]));
    const receivers=new Map(model.receivers.map(r=>[r.id,r]));
    return scene.zones.map(saved=>{
      const zone=zones.get(saved.id),matchingZone=zone&&zone.type===saved.type;
      const result={id:saved.id,name:saved.name,type:saved.type,layout:matchingZone?zone.layout:null,
        receivers:[],available:false,reason:'',receiverCount:saved.receivers.length};
      if(!stand){result.reason='Deze scène hoort bij een andere stand.';return result;}
      if(!matchingZone){result.reason='Deze zone ontbreekt of heeft een ander type.';return result;}
      const members=new Set(zone.receiverIds);
      if(saved.receivers.some(r=>{
        const current=receivers.get(r.id);
        return !current||current.standId!==scene.standId||current.zoneId!==saved.id||
          current.type!==saved.type||current.lifecycle!=='added'||!members.has(r.id);
      })){
        result.reason='Een receiver uit deze zone is verplaatst of verwijderd. Bewaar een nieuwe scène.';
        return result;
      }
      if(zone.receiverIds.length!==saved.receivers.length){
        result.reason='Deze zone heeft extra receivers. De scène wijzigt alleen opgeslagen receivers. Bewaar een nieuwe scène voor een passend voorbeeld.';
        return result;
      }
      // Activation keeps current physical order and geometry; match them using only saved lights.
      // Project rendering fields explicitly so credentials and extra device data stay out.
      const savedReceivers=new Map(saved.receivers.map(r=>[r.id,r]));
      result.receivers=zone.receiverIds.map(id=>{
        const current=receivers.get(id),snapshot=savedReceivers.get(id);
        return {id,name:current.name,type:saved.type,connection:current.connection,
          outputs:current.outputs.map(p=>({port:p.port,enabled:p.enabled,pixels:p.pixels,reversed:p.reversed})),state:copy(snapshot.state)};
      });
      result.available=true;
      return result;
    });
  }
  function compatibility(model,input){
    try{
      const scene=validate(input);M.assertValid(model);
      const stand=model.stands.find(s=>s.id===scene.standId);if(!stand)return {ok:false,reason:'Deze scène hoort bij een andere stand.'};
      for(const saved of scene.zones){
        const zone=stand.zones.find(z=>z.id===saved.id);if(!zone||zone.type!==saved.type)return {ok:false,reason:'Een zone uit deze scène ontbreekt of heeft een ander type.'};
        const live=M.zoneReceivers(model,zone.id);
        if(saved.receivers.some(r=>!live.some(unit=>unit.id===r.id)))return {ok:false,reason:'Een receiver uit deze scène is verplaatst of verwijderd. Bewaar een nieuwe scène.'};
      }
      return {ok:true,reason:''};
    }catch(error){return {ok:false,reason:error.message};}
  }
  function apply(model,input){
    const check=compatibility(model,input);if(!check.ok)fail(check.reason);
    const scene=validate(input),next=copy(model);
    for(const zone of scene.zones)for(const saved of zone.receivers)next.receivers.find(r=>r.id===saved.id).state=copy(saved.state);
    return M.assertValid(next);
  }
  function createStore(storage){
    function load(){try{
      const raw=storage?.getItem(STORAGE_KEY);if(!storage)fail('Lokale opslag is niet beschikbaar.');
      if(raw===null)return {scenes:[],error:null};
      if(typeof raw!=='string'||raw.length>2000000)fail('De scèneopslag is te groot.');
      const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.scenes)||data.scenes.length>MAX_SCENES)fail('De opgeslagen scènes zijn niet geldig.');
      const scenes=data.scenes.map(validate);if(new Set(scenes.map(s=>s.id)).size!==scenes.length)fail('Dubbele scène-identiteit.');
      return {scenes,error:null};
    }catch(error){return {scenes:[],error:{message:error.message}};}}
    function write(scenes,previous){try{const raw=JSON.stringify({version:1,scenes});if(raw.length>2000000)fail('De scèneopslag is vol.');storage.setItem(STORAGE_KEY,raw);return {scenes,error:null};}catch(error){return {scenes:previous,error:{message:'Scènes konden niet worden bewaard. '+error.message}};}}
    function save(scene){const current=load();if(current.error)return current;try{
      const entry=validate(scene),list=current.scenes.slice(),index=list.findIndex(s=>s.id===entry.id);
      if(index<0){if(list.length>=MAX_SCENES)fail('Je hebt al 100 scènes.');list.push(entry);}else list[index]=entry;
      return write(list,current.scenes);
    }catch(error){return {...current,error:{message:error.message}};}}
    function rename(id,name){const current=load();if(current.error)return current;try{
      if(!text(name,64))fail('Geef je scène een naam van maximaal 64 tekens.');
      const index=current.scenes.findIndex(scene=>scene.id===id);if(index<0)fail('Deze scène bestaat niet meer.');
      const nextName=name.trim();if(current.scenes[index].name===nextName)return current;
      const list=current.scenes.slice();list[index]={...list[index],name:nextName};
      return write(list,current.scenes);
    }catch(error){return {...current,error:{message:error.message}};}}
    function remove(id){const current=load();if(current.error)return current;if(!current.scenes.some(s=>s.id===id))return current;return write(current.scenes.filter(s=>s.id!==id),current.scenes);}
    return Object.freeze({load,save,rename,remove});
  }
  return Object.freeze({STORAGE_KEY,capture,validate,previewZones,compatibility,apply,createStore});
});
