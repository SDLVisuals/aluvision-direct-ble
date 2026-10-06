/* Installation libraries are public light data, never access credentials.
 * Three existing stores are restored through one durable local transaction.
 * Uncommitted restarts roll back; committed restarts finish idempotently. */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./scenes.js'):root.LightningScenes,node?require('./presets.js'):root.LightningPresets,node?require('./colours-library.js'):root.LightningColoursLibrary);
  if(node)module.exports=api;else root.LightningInstallationLibraries=api;
})(typeof globalThis==='object'?globalThis:this,function(Scenes,Presets,Colors){
  'use strict';
  const JOURNAL_KEY='aluvision.v32.installation-libraries-transaction.v1',MAX_BYTES=128*1024,MAX_JOURNAL_BYTES=6*1024*1024;
  const definitions=[{key:Scenes.STORAGE_KEY,field:'scenes',validate:Scenes.validate,limit:2000000},{key:Presets.STORAGE_KEY,field:'presets',validate:Presets.validate,limit:512000},{key:Colors.STORAGE_KEY,field:'colors',validate:Colors.validate,limit:64000}];
  const copy=value=>JSON.parse(JSON.stringify(value)),plain=value=>value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
  const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
  const size=value=>new TextEncoder().encode(value).length;
  const canonical=value=>JSON.stringify(value,(_,entry)=>plain(entry)?Object.fromEntries(Object.keys(entry).sort().map(key=>[key,entry[key]])):entry);
  const validStand=value=>typeof value==='string'&&value.length>0&&value.length<=160&&!/[\u0000-\u001f\u007f]/.test(value);
  function bounded(value,depth=0){
    if(depth>16)fail('LIBRARY_FORMAT','De bewaarde bibliotheken zijn te ingewikkeld.');
    if(value&&typeof value==='object'){
      if(!Array.isArray(value)&&!plain(value))fail('LIBRARY_FORMAT','De bewaarde bibliotheken zijn ongeldig.');
      for(const key of Object.keys(value)){if(['__proto__','constructor','prototype'].includes(key))fail('LIBRARY_FORMAT','De bewaarde bibliotheken zijn ongeldig.');bounded(value[key],depth+1);}
    }else if(typeof value==='number'&&!Number.isFinite(value))fail('LIBRARY_FORMAT','De bewaarde bibliotheken bevatten een ongeldig getal.');
  }
  function keys(value,allowed){if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail('LIBRARY_FORMAT','De bewaarde bibliotheken bevatten onbekende gegevens.');}
  function list(value,validate){
    if(!Array.isArray(value)||value.length>100)fail('LIBRARY_LIMIT','Een bibliotheek bevat meer dan 100 items.');
    const ids=new Set();return Array.from(value,item=>{const clean=validate(item);if(ids.has(clean.id))fail('LIBRARY_FORMAT','Een bibliotheek bevat dubbele identificaties.');ids.add(clean.id);return clean;});
  }
  function validate(value,standId){
    if(!validStand(standId))fail('LIBRARY_STAND','Kies een bestaande stand.');
    bounded(value);keys(value,['version','scenes','presets','colors']);
    if(value.version!==1)fail('LIBRARY_FORMAT','Deze bibliotheekversie wordt niet ondersteund.');
    const result={version:1,scenes:list(value.scenes,Scenes.validate),presets:list(value.presets,Presets.validate),colors:Colors.validateColors(value.colors)};
    if(result.scenes.some(scene=>scene.standId!==standId))fail('LIBRARY_STAND','De scènes horen bij een andere stand.');
    if(size(JSON.stringify(result))>MAX_BYTES)fail('LIBRARY_LIMIT','De bibliotheken zijn te groot om op je receiver te bewaren.');
    return result;
  }
  function validateRaw(raw,definition){
    if(raw===null)return;
    if(typeof raw!=='string'||size(raw)>definition.limit)fail('LIBRARY_STORAGE','De bestaande bibliotheekopslag is ongeldig.');
    let value;try{value=JSON.parse(raw);}catch(_){fail('LIBRARY_STORAGE','De bestaande bibliotheekopslag is niet leesbaar.');}
    bounded(value);keys(value,['version',definition.field]);if(value.version!==1)fail('LIBRARY_STORAGE','De bestaande bibliotheekversie is ongeldig.');
    const items=list(value[definition.field],definition.validate);if(definition.field==='colors')Colors.validateColors(items);
  }
  function merge(existing,incoming,validateItem){
    const result=existing.map(copy),byId=new Map(result.map(item=>[item.id,item]));
    for(const incomingItem of incoming){
      const item=copy(incomingItem),old=byId.get(item.id);
      if(old&&canonical(old)===canonical(item))continue;
      if(old){
        // A content-derived suffix preserves both versions without generating
        // another copy each time the same installation is recovered.
        let hash=2166136261;for(const character of canonical(item)){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619)>>>0;}
        const base=item.id.slice(0,130)+'.recovered-'+hash.toString(16).padStart(8,'0');let candidate=base,suffix=2;
        while(byId.has(candidate)&&canonical({...item,id:candidate})!==canonical(byId.get(candidate)))candidate=base+'-'+suffix++;
        item.id=candidate;if(byId.has(candidate))continue;
      }
      const clean=validateItem(item);byId.set(clean.id,clean);result.push(clean);
    }
    if(result.length>100)fail('LIBRARY_LIMIT','De samengevoegde bibliotheek bevat meer dan 100 items. Je bestaande items blijven bewaard.');
    return result;
  }
  function create(storage,{onRestore=()=>{}}={}){
    const available=()=>{if(!storage?.getItem||!storage?.setItem||!storage?.removeItem)fail('LIBRARY_STORAGE','De bibliotheken kunnen niet lokaal worden bewaard.');};
    function put(key,raw){if(raw===null)storage.removeItem(key);else storage.setItem(key,raw);if(storage.getItem(key)!==raw)fail('LIBRARY_STORAGE','De bibliotheken zijn nog niet volledig lokaal bevestigd.');}
    function snapshot(){available();return Object.fromEntries(definitions.map(definition=>{const raw=storage.getItem(definition.key);validateRaw(raw,definition);return [definition.key,raw];}));}
    function readJournal(){
      available();const raw=storage.getItem(JOURNAL_KEY);if(raw===null)return null;
      if(typeof raw!=='string'||size(raw)>MAX_JOURNAL_BYTES)fail('LIBRARY_STORAGE','De bibliotheekherstelactie is beschadigd.');
      let journal;try{journal=JSON.parse(raw);}catch(_){fail('LIBRARY_STORAGE','De bibliotheekherstelactie is niet leesbaar.');}
      bounded(journal);keys(journal,['version','phase','before','after']);
      if(journal.version!==1||!['prepared','committed'].includes(journal.phase))fail('LIBRARY_STORAGE','De bibliotheekherstelactie is ongeldig.');
      for(const values of [journal.before,journal.after]){keys(values,definitions.map(definition=>definition.key));for(const definition of definitions){if(!Object.hasOwn(values,definition.key))fail('LIBRARY_STORAGE','De bibliotheekherstelactie is onvolledig.');validateRaw(values[definition.key],definition);}}
      return journal;
    }
    function recover(){
      const journal=readJournal();if(!journal)return false;
      for(const definition of definitions){const current=storage.getItem(definition.key);if(current!==journal.before[definition.key]&&current!==journal.after[definition.key])fail('LIBRARY_CONFLICT','Een bibliotheek is ondertussen gewijzigd. De herstelactie blijft bewaard.');}
      const values=journal.phase==='committed'?journal.after:journal.before;
      for(const definition of definitions)put(definition.key,values[definition.key]);put(JOURNAL_KEY,null);return true;
    }
    function load(){
      recover();const before=snapshot(),libraries={};
      for(const definition of definitions){const raw=before[definition.key];libraries[definition.field]=raw===null?(definition.field==='colors'?Colors.defaults():[]):list(JSON.parse(raw)[definition.field],definition.validate);}
      return {libraries,before};
    }
    function capture(standId){const {libraries}=load();return validate({version:1,...libraries,scenes:libraries.scenes.filter(scene=>scene.standId===standId)},standId);}
    function restore(payload,standId){
      const incoming=validate(payload,standId),{libraries:current,before}=load();
      // Capture shows the normal UI defaults on an untouched device. Those
      // defaults are not persisted user entries to merge into a recovered
      // archive: preserve an explicitly empty/full archive exactly on a new
      // phone, while retaining every colour that really was stored locally.
      if(before[Colors.STORAGE_KEY]===null)current.colors=[];
      const merged={scenes:merge(current.scenes,incoming.scenes,Scenes.validate),presets:merge(current.presets,incoming.presets,Presets.validate),colors:Colors.validateColors(merge(current.colors,incoming.colors,Colors.validate))};
      const after=Object.fromEntries(definitions.map(definition=>{const raw=JSON.stringify({version:1,[definition.field]:merged[definition.field]});validateRaw(raw,definition);return [definition.key,raw];}));
      const journal={version:1,phase:'prepared',before,after},prepared=JSON.stringify(journal);
      if(size(prepared)>MAX_JOURNAL_BYTES)fail('LIBRARY_LIMIT','De bibliotheekherstelactie is te groot. Je bestaande items blijven bewaard.');
      for(const definition of definitions)if(storage.getItem(definition.key)!==before[definition.key])fail('LIBRARY_CONFLICT','Een bibliotheek is ondertussen gewijzigd. Controleer de herstelactie opnieuw.');
      let staged=false,committed=false;
      try{
        put(JOURNAL_KEY,prepared);staged=true;
        for(const definition of definitions)put(definition.key,after[definition.key]);
        put(JOURNAL_KEY,JSON.stringify({...journal,phase:'committed'}));committed=true;
        put(JOURNAL_KEY,null);
      }catch(error){
        if(staged&&!committed){
          try{for(const definition of definitions)put(definition.key,before[definition.key]);put(JOURNAL_KEY,null);}catch(_){/* Complete before-images remain available for the next launch. */}
        }
        fail('LIBRARY_STORAGE','De bibliotheken zijn nog niet volledig bevestigd. Je herstelactie kan opnieuw worden gecontroleerd.');
      }
      onRestore(copy(merged));return {restored:true,scenes:merged.scenes.length,presets:merged.presets.length,colors:merged.colors.length};
    }
    function replaceFromCentral(payload,standId){
      // A connected phone is a cache. Do not merge stale local entries into
      // MAIN's authoritative library or invent '.recovered' duplicates.
      const incoming=validate(payload,standId),{libraries:current,before}=load();
      const next={scenes:[...current.scenes.filter(scene=>scene.standId!==standId),...incoming.scenes],presets:incoming.presets,colors:incoming.colors};
      const after=Object.fromEntries(definitions.map(definition=>{
        const raw=JSON.stringify({version:1,[definition.field]:next[definition.field]});validateRaw(raw,definition);return [definition.key,raw];
      }));
      if(definitions.every(definition=>before[definition.key]===after[definition.key]))return {restored:true,unchanged:true};
      const journal={version:1,phase:'prepared',before,after};
      if(size(JSON.stringify(journal))>MAX_JOURNAL_BYTES)fail('LIBRARY_LIMIT','De bibliotheken zijn te groot. Je bestaande kopie blijft bewaard.');
      let staged=false,committed=false;
      try{
        put(JOURNAL_KEY,JSON.stringify(journal));staged=true;
        for(const definition of definitions)put(definition.key,after[definition.key]);
        put(JOURNAL_KEY,JSON.stringify({...journal,phase:'committed'}));committed=true;put(JOURNAL_KEY,null);
      }catch(_){
        if(staged&&!committed)try{for(const definition of definitions)put(definition.key,before[definition.key]);put(JOURNAL_KEY,null);}catch(_){/* Recover retains the complete before-image. */}
        fail('LIBRARY_STORAGE','De centrale bibliotheken konden niet volledig worden geladen. Je vorige kopie blijft herstelbaar.');
      }
      onRestore(copy(next));return {restored:true,scenes:next.scenes.length,presets:next.presets.length,colors:next.colors.length};
    }
    return Object.freeze({capture,restore,replaceFromCentral,recover});
  }
  return Object.freeze({create,validate,JOURNAL_KEY,MAX_BYTES});
});
