/* Scenes contain immutable light/logical-arrangement snapshots, never credentials or port configuration.
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
  const dense=value=>Array.isArray(value)&&Array.from({length:value.length},(_,index)=>Object.hasOwn(value,index)).every(Boolean);
  function arrangement(value,type){
    if(!plain(value)||Object.keys(value).sort().join(',')!=='layout,lineOrder,presentation')fail('De opgeslagen opstelling is niet geldig.');
    const {layout,presentation,lineOrder}=value;
    if(!(type==='SPI'?['continuous','stacked','vertical']:['stacked','vertical']).includes(layout)||
      !['normal','tunnel','wall'].includes(presentation)||
      (layout==='vertical')!==(presentation==='wall')&&layout!=='stacked'||/* C211d: a stacked zone may be saved as Wand */presentation==='tunnel'&&layout!=='stacked'||
      !dense(lineOrder)||!lineOrder.length||lineOrder.length>240||new Set(lineOrder).size!==lineOrder.length||
      lineOrder.some(id=>typeof id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}:[0-4]$/.test(id)))
      fail('De opgeslagen opstelling is niet geldig.');
    return {layout,presentation,lineOrder:[...lineOrder]};
  }
  function identity(value){
    if(!plain(value)||Object.keys(value).sort().join(',')!=='deviceFingerprint,rid'||
      !(value.rid===null||typeof value.rid==='string'&&/^[0-9A-F]{16}$/.test(value.rid)&&/[^0]/.test(value.rid))||
      !(value.deviceFingerprint===null||typeof value.deviceFingerprint==='string'&&/^[0-9A-F]{64}$/.test(value.deviceFingerprint)&&/[^0]/.test(value.deviceFingerprint)))
      fail('De opgeslagen receiveridentiteit is niet geldig.');
    return {rid:value.rid,deviceFingerprint:value.deviceFingerprint};
  }
  function light(state,strict=false){
    if(!plain(state))fail('De lichtinstellingen in de scène zijn niet geldig.');
    const clean={...state};delete clean.standAnimation;delete clean.portStates;
    const result=P.sanitizeLightState(clean,strict);
    if(Object.hasOwn(state,'portStates')){
      const overrides=state.portStates;
      if(!plain(overrides)||Object.keys(overrides).length>4||Object.keys(overrides).some(port=>!/^[1-4]$/.test(port)))fail('De lichtinstellingen per SPI-ledline zijn niet geldig.');
      const portStates={};
      for(const [port,override]of Object.entries(overrides)){
        if(!M.validPortLightState(override))fail('De lichtinstellingen per SPI-ledline zijn niet geldig.');
        // A scene is still light-only. Preserve each explicit sparse delta;
        // inherit missing fields from its real receiver, never another port.
        const effective=M.lightStateFor({type:'SPI',state:{...clean,portStates:{[port]:override}}},Number(port)),merged=P.sanitizeLightState(effective,strict);
        const delta=Object.fromEntries(Object.keys(override).filter(key=>P.STATE_FIELDS.includes(key)&&(override[key]===null||Object.hasOwn(merged,key))).map(key=>[key,override[key]===null?null:copy(merged[key])]));
        if(Object.keys(delta).length)portStates[port]=delta;
      }
      if(Object.keys(portStates).length)result.portStates=portStates;
    }
    if(Object.hasOwn(state,'standAnimation')){
      if(result.portStates)fail('Een standanimatie kan geen afzonderlijke SPI-ledline-instellingen bevatten.');
      const standAnimations=typeof module==='object'&&module.exports?require('./stand-animations.js'):globalThis.LightningStandAnimations;
      if(!standAnimations)fail('De gezamenlijke animatie kan niet worden gelezen.');
      result.standAnimation=standAnimations.validateMarker(state.standAnimation);
    }
    return result;
  }
  function validate(scene){
    if(!plain(scene)||![1,2].includes(scene.version)||!text(scene.id)||!text(scene.standId)||!text(scene.name,64)||!dense(scene.zones)||!scene.zones.length||scene.zones.length>100)fail('Deze scène is niet geldig.');
    if(scene.version===2&&Object.keys(scene).sort().join(',')!=='id,name,standId,version,zones')fail('Deze scène bevat onbekende gegevens.');
    const zoneIds=new Set(),receiverIds=new Set();
    const zones=scene.zones.map(z=>{
      if(!plain(z)||!text(z.id)||zoneIds.has(z.id)||!text(z.name,64)||!['RGBW','SPI'].includes(z.type)||!dense(z.receivers)||!z.receivers.length||z.receivers.length>(scene.version===2?30:1000))fail('De zones in de scène zijn niet geldig.');
      zoneIds.add(z.id);
      if(scene.version===2&&Object.keys(z).filter(key=>key!=='gradientDomains').sort().join(',')!=='arrangement,id,name,receivers,type')fail('De scènezone bevat onbekende gegevens.');
      if(Object.hasOwn(z,'gradientDomains')&&(z.type!=='SPI'||!M.validGradientDomains(z.gradientDomains)))fail('De bewaarde verloopselecties zijn ongeldig.');
      const spatial=scene.version===2?arrangement(z.arrangement,z.type):null;
      const result={id:z.id,name:z.name,type:z.type,...(Object.hasOwn(z,'gradientDomains')?{gradientDomains:copy(z.gradientDomains)}:{}),...(spatial?{arrangement:spatial}:{}),receivers:z.receivers.map(r=>{
        if(!plain(r)||!text(r.id)||receiverIds.has(r.id))fail('Een receiver staat meermaals in de scène.');
        if(scene.version===2&&Object.keys(r).sort().join(',')!=='id,identity,state')fail('De opgeslagen receiver bevat onbekende gegevens.');
        receiverIds.add(r.id);const state=light(r.state,true);
        if(z.type!=='SPI'&&state.portStates)fail('Afzonderlijke uitgangsinstellingen zijn alleen voor SPI.');
        return {id:r.id,...(scene.version===2?{identity:identity(r.identity)}:{}),state};
      })};
      if(spatial){
        const members=new Set(result.receivers.map(receiver=>receiver.id)),seen=new Set();
        for(const key of spatial.lineOrder){const split=key.lastIndexOf(':'),id=key.slice(0,split),port=Number(key.slice(split+1));
          if(!members.has(id)||(z.type==='RGBW'?port!==0:port<1||port>4))fail('De opgeslagen ledlinevolgorde past niet bij deze scène.');seen.add(id);}
        if(seen.size!==members.size)fail('De opgeslagen ledlinevolgorde mist een receiver.');
      }
      return result;
    });
    return {version:scene.version,id:scene.id,standId:scene.standId,name:scene.name.trim(),zones};
  }
  function capture(model,standId,zoneIds,name,options={}){
    M.assertValid(model);
    if(!text(name,64)||!Array.isArray(zoneIds)||!zoneIds.length||new Set(zoneIds).size!==zoneIds.length)fail('Kies minstens één zone en geef je scène een naam.');
    const stand=model.stands.find(s=>s.id===standId);if(!stand)fail('Deze stand bestaat niet.');
    if(zoneIds.some(id=>!stand.zones.some(zone=>zone.id===id)))fail('De gekozen zone hoort niet bij deze stand.');
    const members=model.receivers.filter(receiver=>receiver.standId===standId&&receiver.lifecycle==='added');
    const captured=members.filter(receiver=>zoneIds.includes(receiver.zoneId));
    if(captured.some(receiver=>receiver.state.standAnimation)&&captured.length!==members.length)
      fail('Deze animatie gebruikt de hele stand. Kies alle zones en wijs losse receivers eerst aan een zone toe.');
    return validate({version:2,id:options.id||'scene-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),standId,name,
      zones:stand.zones.filter(zone=>zoneIds.includes(zone.id)).map(z=>{
        return {id:z.id,name:z.name,type:z.type,...(z.gradientDomains?{gradientDomains:copy(z.gradientDomains)}:{}),arrangement:{layout:z.layout,lineOrder:M.lineIds(model,z.id),
          presentation:options.presentations?.[z.id]??(z.layout==='vertical'?'wall':'normal')},
          receivers:M.zoneReceivers(model,z.id).map(r=>({id:r.id,identity:{rid:r.rid||null,deviceFingerprint:r.deviceFingerprint||null},
            state:light(z.layout==='continuous'?M.lightStateFor(r,0):r.state)}))};})});
  }
  function arrangementCompatibility(model,saved,zone){
    if(!saved.arrangement)return '';
    if(saved.receivers.some(snapshot=>{const current=model.receivers.find(receiver=>receiver.id===snapshot.id);return !current||snapshot.identity.rid!==(current.rid||null)||snapshot.identity.deviceFingerprint!==(current.deviceFingerprint||null);}))
      return 'De receiveridentiteit van deze scène is gewijzigd. Je opgeslagen scène blijft bewaard.';
    if(zone.receiverIds.length!==saved.receivers.length||saved.receivers.some(r=>!zone.receiverIds.includes(r.id)))
      return 'De ledlines in deze zone zijn gewijzigd. Je opgeslagen scène blijft bewaard.';
    const current=M.lineIds(model,zone.id),order=saved.arrangement.lineOrder;
    if(current.length!==order.length||current.some(id=>!order.includes(id)))
      return 'Een ledline uit deze scène ontbreekt of is uitgeschakeld. Je opgeslagen scène blijft bewaard.';
    return '';
  }
  function portCompatibility(zone,current,state){
    if(!state.portStates)return '';
    if(zone.layout==='continuous')return 'Deze scène gebruikt losse SPI-ledlines. Kies die opstelling of bewaar een nieuwe scène.';
    if(Object.keys(state.portStates).some(port=>!current.outputs.some(output=>output.enabled&&output.port===Number(port))))
      return 'Een SPI-uitgang uit deze scène is uitgeschakeld of ontbreekt. Bewaar een nieuwe scène.';
    return '';
  }
  // SCENE-JOIN (9 Nov, user: "scènes moeten blijven werken als er een receiver bijkomt"). Derive the scene that
  // plays today. A receiver that joined a saved zone after the save is added to that zone's snapshot IN MEMORY:
  //  - a continuous SPI zone with one zone recipe, or a whole-stand animation: the newcomer takes that recipe, so the
  //    animation/gradient spans the new geometry. Nothing to update (adaptedIds).
  //  - any other zone (an extra RGBW, an SPI in a stacked/vertical zone): the rest plays unchanged; the newcomer takes
  //    the zone's one common saved light, else keeps its own current light, and needsUpdate asks for a new save.
  // Pure and idempotent. Storage changes only on an explicit save, so the shared library format is unchanged.
  const canon=v=>Array.isArray(v)?v.map(canon):plain(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
  const sameLight=(a,b)=>JSON.stringify(canon(a))===JSON.stringify(canon(b));
  const lineReceiver=line=>line.slice(0,line.lastIndexOf(':'));
  const hasSelection=state=>[state,...Object.values(state.portStates||{})].some(s=>Object.hasOwn(s,'staticGradientDomain')||Object.hasOwn(s,'staticGradientGroup'));
  function mergeOrder(saved,current,fresh){
    // Keep the saved order; place each new id right after its nearest current predecessor.
    const out=[...saved];
    current.forEach((id,index)=>{
      if(!fresh(id)||out.includes(id))return;
      let at=0;for(let j=index-1;j>=0;j--){const k=out.indexOf(current[j]);if(k>=0){at=k+1;break;}}
      out.splice(at,0,id);
    });
    return out;
  }
  function zoneTrial(model,zone){
    const temp=copy(model),target=M.getZone(temp,zone.id);
    if(zone.arrangement){target.layout=zone.arrangement.layout;target.lineOrder=[...zone.arrangement.lineOrder];}
    if(zone.gradientDomains)target.gradientDomains=copy(zone.gradientDomains);else delete target.gradientDomains;
    for(const receiver of zone.receivers)temp.receivers.find(item=>item.id===receiver.id).state=copy(receiver.state);
    return M.assertValid(temp);
  }
  function spanGradient(model,zone,oldLines){
    // Only a gradient over ALL saved lines grows with the zone; a partial gradient stays partial.
    const temp=zoneTrial(model,zone),group=M.gradientDomainGroup(temp,zone.id,zone.receivers[0].state);
    if(!Array.isArray(group)||group.length!==oldLines.length||oldLines.some(line=>!group.includes(line)))return null;
    const prepared=M.prepareGradientDomain(temp,zone.id,{kind:'all'});
    return {domain:prepared.domain,gradientDomains:copy(M.getZone(prepared.model,zone.id).gradientDomains)};
  }
  function dropSelection(state){
    const next=copy(state);delete next.staticGradientDomain;delete next.staticGradientGroup;
    for(const [port,override]of Object.entries(next.portStates||{})){
      delete override.staticGradientDomain;delete override.staticGradientGroup;if(!Object.keys(override).length)delete next.portStates[port];
    }
    if(next.portStates&&!Object.keys(next.portStates).length)delete next.portStates;
    return next;
  }
  function reconcile(model,input){
    const scene=validate(input),unchanged={scene,changed:false,needsUpdate:false,addedIds:[],adaptedIds:[]};
    try{
      M.assertValid(model);
      const stand=model.stands.find(item=>item.id===scene.standId);if(!stand)return unchanged;
      const known=new Set(scene.zones.flatMap(zone=>zone.receivers.map(receiver=>receiver.id)));
      const shared=scene.zones.some(zone=>zone.receivers.some(receiver=>receiver.state.standAnimation));
      const savedZones=new Map(scene.zones.map(zone=>[zone.id,zone]));
      const newcomers=zone=>zone.type?M.zoneReceivers(model,zone.id).filter(receiver=>!known.has(receiver.id)&&receiver.type===zone.type):[];
      const joined=stand.zones.filter(zone=>(shared||savedZones.has(zone.id))&&(!savedZones.has(zone.id)||savedZones.get(zone.id).type===zone.type)&&newcomers(zone).length);
      if(!joined.length)return unchanged;
      const peers=scene.zones.flatMap(zone=>zone.receivers.map(receiver=>({type:zone.type,state:receiver.state})));
      const standRecipe=type=>{
        const peer=peers.find(item=>item.type===type&&item.state.standAnimation);if(peer)return copy(peer.state);
        const base=copy(peers.find(item=>item.state.standAnimation).state),marker=base.standAnimation.state;delete base.portStates;
        return Object.assign(base,copy(marker),{receiverType:type,previewFamily:type==='SPI'&&!marker.v30Effect?'RGBW':null});
      };
      const addedIds=[],adaptedIds=[];let needsUpdate=false;
      const joinedIds=new Set(joined.map(zone=>zone.id));
      const zoneOrder=shared?mergeOrder(scene.zones.map(zone=>zone.id),stand.zones.map(zone=>zone.id),id=>joinedIds.has(id)):scene.zones.map(zone=>zone.id);
      const zones=[];
      for(const id of zoneOrder){
        const saved=savedZones.get(id),zone=stand.zones.find(item=>item.id===id);
        if(!joinedIds.has(id)){if(saved)zones.push(saved);continue;}
        try{
          const incoming=newcomers(zone),fresh=new Set(incoming.map(receiver=>receiver.id)),byId=new Map(incoming.map(receiver=>[receiver.id,receiver]));
          const result=saved?copy(saved):{id:zone.id,name:zone.name,type:zone.type,
            ...(scene.version===2?{arrangement:{layout:zone.layout,lineOrder:[],presentation:zone.layout==='vertical'?'wall':'normal'}}:{}),receivers:[]};
          const layout=result.arrangement?.layout??zone.layout,continuous=zone.type==='SPI'&&layout==='continuous';
          const states=result.receivers.map(receiver=>receiver.state);
          const uniform=states.length&&!states[0].portStates&&!Object.hasOwn(states[0],'staticGradientGroup')&&states.every(state=>sameLight(state,states[0]))?states[0]:null;
          let recipe=shared?standRecipe(zone.type):uniform,adapt=shared||!!uniform&&continuous;
          const currentLines=M.lineIds(model,zone.id);
          if(result.arrangement)result.arrangement.lineOrder=mergeOrder(result.arrangement.lineOrder,currentLines,line=>fresh.has(lineReceiver(line)));
          const own=receiver=>{const state=copy(continuous?M.lightStateFor(receiver,0):receiver.state);delete state.standAnimation;return state;};
          const entry=(receiver,state)=>({id:receiver.id,...(scene.version===2?{identity:{rid:receiver.rid||null,deviceFingerprint:receiver.deviceFingerprint||null}}:{}),state:light(state)});
          const order=mergeOrder(result.receivers.map(receiver=>receiver.id),zone.receiverIds,receiverId=>fresh.has(receiverId));
          let receivers=order.map(receiverId=>fresh.has(receiverId)?entry(byId.get(receiverId),recipe?copy(recipe):own(byId.get(receiverId))):result.receivers.find(receiver=>receiver.id===receiverId));
          if(recipe&&!shared&&Object.hasOwn(recipe,'staticGradientDomain')){
            const oldLines=(result.arrangement?.lineOrder??currentLines).filter(line=>!fresh.has(lineReceiver(line)));
            const span=adapt?spanGradient(model,{...result,receivers},oldLines):null;
            if(span){result.gradientDomains=span.gradientDomains;receivers=receivers.map(receiver=>({...receiver,state:{...receiver.state,staticGradientDomain:span.domain}}));}
            else{adapt=false;recipe=null;receivers=receivers.map(receiver=>fresh.has(receiver.id)?entry(byId.get(receiver.id),own(byId.get(receiver.id))):receiver);}
          }
          if(receivers.some(receiver=>fresh.has(receiver.id)&&hasSelection(receiver.state))){
            // A newcomer's own gradient selection may live only in today's zone registry. Keep its colours, drop the
            // selection the saved registry cannot resolve, so playback never stops on GRADIENT_SCOPE.
            const temp=zoneTrial(model,{...result,receivers});
            receivers=receivers.map(receiver=>{
              if(!fresh.has(receiver.id)||!hasSelection(receiver.state))return receiver;
              try{[receiver.state,...Object.values(receiver.state.portStates||{})].forEach(state=>M.gradientDomainGroup(temp,zone.id,state));return receiver;}
              catch(_){return {...receiver,state:light(dropSelection(receiver.state))};}
            });
          }
          result.receivers=receivers;zones.push(result);
          addedIds.push(...fresh);if(adapt)adaptedIds.push(...fresh);else needsUpdate=true;
        }catch(_){if(saved)zones.push(saved);}
      }
      if(!addedIds.length)return unchanged;
      return {scene:validate({...scene,zones}),changed:true,needsUpdate,addedIds,adaptedIds};
    }catch(_){return unchanged;}
  }
  function previewZones(model,input){
    const scene=reconcile(model,input).scene;M.assertValid(model); // SCENE-JOIN
    const stand=model.stands.find(s=>s.id===scene.standId);
    const zones=new Map((stand?.zones||[]).map(z=>[z.id,z]));
    const receivers=new Map(model.receivers.map(r=>[r.id,r]));
    return scene.zones.map(saved=>{
      const zone=zones.get(saved.id),matchingZone=zone&&zone.type===saved.type;
      const result={id:saved.id,name:saved.name,type:saved.type,...(saved.gradientDomains?{gradientDomains:copy(saved.gradientDomains)}:{}),layout:saved.arrangement?.layout??(matchingZone?zone.layout:null),
        ...(saved.arrangement?{presentation:saved.arrangement.presentation,lineOrder:[...saved.arrangement.lineOrder]}:{}),
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
      const changed=arrangementCompatibility(model,saved,zone);if(changed){result.reason=changed;return result;}
      for(const snapshot of saved.receivers){
        const reason=portCompatibility({...zone,layout:result.layout},receivers.get(snapshot.id),snapshot.state);
        if(reason){result.reason=reason;return result;}
      }
      // Activation keeps current physical order and geometry; match them using only saved lights.
      // Project rendering fields explicitly so credentials and extra device data stay out.
      const savedReceivers=new Map(saved.receivers.map(r=>[r.id,r]));
      result.receivers=(saved.arrangement?saved.receivers.map(receiver=>receiver.id):zone.receiverIds).map(id=>{
        const current=receivers.get(id),snapshot=savedReceivers.get(id);
        return {id,name:current.name,type:saved.type,standId:scene.standId,zoneId:saved.id,connection:current.connection,
          outputs:current.outputs.map(p=>({port:p.port,enabled:p.enabled,pixels:p.pixels,reversed:p.reversed})),state:copy(snapshot.state)};
      });
      result.available=true;
      return result;
    });
  }
  function compatibility(model,input){
    try{
      const scene=reconcile(model,input).scene;M.assertValid(model); // SCENE-JOIN
      const stand=model.stands.find(s=>s.id===scene.standId);if(!stand)return {ok:false,reason:'Deze scène hoort bij een andere stand.'};
      if(scene.zones.some(zone=>zone.receivers.some(receiver=>receiver.state.standAnimation))){
        const saved=scene.zones.flatMap(zone=>zone.receivers),members=M.standZoneReceivers(model,scene.standId); // SCENE-JOIN: zoned members, as StandAnimations
        if(saved.length!==members.length||saved.some(receiver=>!members.some(member=>member.id===receiver.id)))
          return {ok:false,reason:'De opstelling van deze standanimatie is gewijzigd. Bewaar een nieuwe scène voor de hele stand.'};
        // C211e: a changed zone order no longer makes the scene unavailable; the scene keeps its own order and
        // apply() / activation put that order back (the user may reorder the stand animation without losing scenes).
      }
      for(const saved of scene.zones){
        const zone=stand.zones.find(z=>z.id===saved.id);if(!zone||zone.type!==saved.type)return {ok:false,reason:'Een zone uit deze scène ontbreekt of heeft een ander type.'};
        const live=M.zoneReceivers(model,zone.id);
        if(saved.receivers.some(r=>!live.some(unit=>unit.id===r.id)))return {ok:false,reason:'Een receiver uit deze scène is verplaatst of verwijderd. Bewaar een nieuwe scène.'};
        const changed=arrangementCompatibility(model,saved,zone);if(changed)return {ok:false,reason:changed};
        for(const snapshot of saved.receivers){
          const reason=portCompatibility({...zone,layout:saved.arrangement?.layout??zone.layout},live.find(unit=>unit.id===snapshot.id),snapshot.state);
          if(reason)return {ok:false,reason};
        }
      }
      return {ok:true,reason:''};
    }catch(error){return {ok:false,reason:error.message};}
  }
  function apply(model,input){
    const check=compatibility(model,input);if(!check.ok)fail(check.reason);
    const scene=reconcile(model,input).scene,next=copy(model); // SCENE-JOIN
    // C211e: a stand-animation scene plays in the zone order it was saved with.
    {const st=next.stands.find(s=>s.id===scene.standId);if(st&&scene.version===2&&scene.zones.some(z=>z.receivers.some(r=>r.state.standAnimation))){
      const order=scene.zones.map(z=>z.id).filter(id=>st.zones.some(z=>z.id===id));let k=0;const byId=new Map(st.zones.map(z=>[z.id,z]));st.zones=st.zones.map(z=>order.includes(z.id)?byId.get(order[k++]):z);}}
    for(const saved of scene.zones)if(saved.arrangement){const zone=M.getZone(next,saved.id);
      if(zone.layout!==saved.arrangement.layout||JSON.stringify(M.lineIds(next,zone.id))!==JSON.stringify(saved.arrangement.lineOrder)){
        zone.layout=saved.arrangement.layout;zone.lineOrder=[...saved.arrangement.lineOrder];
      }
    }
    if(!scene.zones.some(zone=>zone.receivers.some(receiver=>receiver.state.standAnimation))){
      // A normal scene may replace only one zone. Keep the light on the other
      // zones, but dissolve their shared recipe marker to prevent partial waves.
      next.receivers.filter(receiver=>receiver.standId===scene.standId).forEach(receiver=>{delete receiver.state.standAnimation;});
    }
    for(const saved of scene.zones){const zone=M.getZone(next,saved.id);if(saved.gradientDomains)zone.gradientDomains=copy(saved.gradientDomains);else delete zone.gradientDomains;}
    for(const zone of scene.zones)for(const saved of zone.receivers)next.receivers.find(r=>r.id===saved.id).state=copy(saved.state);
    return M.assertValid(next);
  }
  function presentationModel(model,input){
    const scene=validate(input),next=apply(model,scene);
    for(const receiver of next.receivers)receiver.state=copy(model.receivers.find(current=>current.id===receiver.id).state);
    for(const stand of next.stands)for(const zone of stand.zones){const current=M.getZone(model,zone.id);if(current?.gradientDomains)zone.gradientDomains=copy(current.gradientDomains);else delete zone.gradientDomains;}
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
    function save(scene,{insertOnly=false}={}){const current=load();if(current.error)return current;try{
      if(typeof insertOnly!=='boolean')fail('Deze scène kon niet als nieuwe scène worden bewaard.');
      const entry=validate(scene),list=current.scenes.slice(),index=list.findIndex(s=>s.id===entry.id);
      if(insertOnly&&index>=0)fail('Deze scène-identiteit bestaat al. Het origineel is niet gewijzigd.');
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
  return Object.freeze({STORAGE_KEY,capture,validate,arrangement,identity,presentationModel,previewZones,compatibility,apply,createStore,reconcile});
});
