/* Display-only last authenticated stand. No credentials, revision witness,
 * connection, checkpoint or mutation authority is restored from this cache. */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./model.js'):root.LightningModel,node?require('./backup.js'):root.LightningBackup);
  if(node)module.exports=api;else root.LightningStandCache=api;
})(typeof globalThis==='object'?globalThis:this,function(Model,Backup){
  'use strict';
  const PREFIX='aluvision.stand-presentation.v1.',MAX_BYTES=512*1024;
  const forbidden=new Set(['__proto__','prototype','constructor','standCode','password','pin','privateKey','ownerKey','sessionKey']);
  const copy=value=>JSON.parse(JSON.stringify(value));
  const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value);
  function publicData(value,depth=0){
    if(depth>20)return false;
    if(value===null||typeof value==='string'||typeof value==='boolean')return true;
    if(typeof value==='number')return Number.isFinite(value);
    if(Array.isArray(value))return value.every(item=>publicData(item,depth+1));
    return !!value&&typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&
      Object.keys(value).every(key=>!forbidden.has(key)&&publicData(value[key],depth+1));
  }
  function cleanModel(value,standId,strict=false){
    if(!id(standId)||!publicData(value)||value.demo!==false||value.stands?.length!==1||value.stands[0].id!==standId||value.receivers?.length>64)return null;
    // Reuse the existing closed public export projection, including nested
    // palettes/port states/animation markers. Unknown model fields are never
    // persisted; cached input itself must already have the closed shape.
    try{return Model.assertValid(Backup.publicModel(value,strict));}catch(_){return null;}
  }
  function create(storage){
    function write(standId,model){
      try{
        const clean=cleanModel(model,standId);if(!clean)return false;
        const text=JSON.stringify({schema:1,standId,model:clean});
        if(new TextEncoder().encode(text).length>MAX_BYTES)return false;
        storage?.setItem(PREFIX+standId,text);return !!storage;
      }catch(_){return false;}
    }
    function read(standId){
      try{
        if(!id(standId))return null;
        const text=storage?.getItem(PREFIX+standId);
        if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)return null;
        const record=JSON.parse(text);
        if(!record||Object.keys(record).sort().join(',')!=='model,schema,standId'||record.schema!==1||record.standId!==standId)return null;
        const clean=cleanModel(record.model,standId,true);if(!clean)return null;
        const model=copy(clean);
        // Previous online flags do not confirm connectivity after restart.
        model.receivers.forEach(receiver=>{receiver.connection='offline';});return model;
      }catch(_){return null;}
    }
    function forget(standId){try{if(id(standId))storage?.removeItem(PREFIX+standId);}catch(_){};}
    return Object.freeze({write,read,forget});
  }
  return Object.freeze({create,PREFIX,MAX_BYTES});
});
