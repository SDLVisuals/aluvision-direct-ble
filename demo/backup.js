/* V32 portable settings. A backup is data, never authority to control hardware.
 * Only named public fields are exported; PINs and ownership keys never enter
 * this module. Restoring topology still requires native identity validation. */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(...['model','presets','scenes','colours-library','preferences','preview'].map((name,index)=>node?require('./'+name+'.js'):[root.LightningModel,root.LightningPresets,root.LightningScenes,root.LightningColoursLibrary,root.LightningPreferences,root.LightningPreview][index]));
  if(node)module.exports=api;else root.LightningBackup=api;
})(typeof globalThis==='object'?globalThis:this,function(M,P,S,C,U,Preview){
  'use strict';
  const FORMAT='aluvision-lighting-backup',MAX_BYTES=4*1024*1024;
  const JOURNAL_KEY='aluvision.v32.backup-transaction.v1',LIGHT_KEY='aluvision.v32.light-intent.v1';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
  const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
  function keys(v,allowed){if(!plain(v)||Object.keys(v).some(k=>!allowed.includes(k)))fail('BACKUP_FORMAT','Dit bestand bevat onbekende gegevens.');}
  function bounded(v,depth=0){
    if(depth>18)fail('BACKUP_FORMAT','Dit bestand is te ingewikkeld.');
    if(typeof v==='number'&&!Number.isFinite(v))fail('BACKUP_FORMAT','Ongeldig getal.');
    if(typeof v==='string'&&v.length>MAX_BYTES)fail('BACKUP_SIZE','De backup is te groot.');
    if(v&&typeof v==='object'){
      if(!Array.isArray(v)&&!plain(v))fail('BACKUP_FORMAT','Ongeldige gegevens.');
      for(const k of Object.keys(v)){if(['__proto__','constructor','prototype'].includes(k))fail('BACKUP_FORMAT','Onveilig bestand.');bounded(v[k],depth+1);}
    }
  }
  function parse(raw){
    if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_BYTES)fail('BACKUP_SIZE','Kies een backup van maximaal 4 MB.');
    let value;try{value=JSON.parse(raw);}catch(_){fail('BACKUP_FORMAT','Dit is geen leesbare backup.');}bounded(value);return value;
  }
  function pick(value,fields,strict){
    if(strict)keys(value,fields);if(!plain(value))fail('BACKUP_FORMAT','Ongeldige instellingen.');
    return Object.fromEntries(fields.filter(k=>Object.hasOwn(value,k)).map(k=>[k,clone(value[k])]));
  }
  function lightState(value,strict=false){
    if(!plain(value))fail('BACKUP_FORMAT','Ongeldige lichtinstellingen.');
    const clean={...value};delete clean.rgbwLast;delete clean.standAnimation;delete clean.portStates;
    const result=P.sanitizeLightState(clean,strict);
    if(Object.hasOwn(value,'rgbwLast')){
      const memory=value.rgbwLast;
      if(!plain(memory)||Object.entries(memory).some(([scope,channels])=>
        !/^(static|background|palette[0-7])$/.test(scope)||!plain(channels)||Object.entries(channels).some(([key,number])=>
          !/^[rgbw]$/.test(key)||!Number.isInteger(number)||number<1||number>255)))fail('BACKUP_FORMAT','De bewaarde kleurkanalen zijn ongeldig.');
      result.rgbwLast=clone(memory);
    }
    if(Object.hasOwn(value,'standAnimation')){
      const standAnimations=typeof module==='object'&&module.exports?require('./stand-animations.js'):globalThis.LightningStandAnimations;
      if(!standAnimations)fail('BACKUP_FORMAT','De gezamenlijke animatie kan niet worden gelezen.');
      result.standAnimation=standAnimations.validateMarker(value.standAnimation);
    }
    if(Object.hasOwn(value,'portStates')){
      const overrides=value.portStates;
      if(!plain(overrides)||Object.keys(overrides).length>4||Object.keys(overrides).some(port=>!/^[1-4]$/.test(port)))fail('BACKUP_FORMAT','De lichtinstellingen per SPI-ledline zijn ongeldig.');
      const portStates={};
      for(const [port,override]of Object.entries(overrides)){
        if(!M.validPortLightState(override))fail('BACKUP_FORMAT','De lichtinstellingen per SPI-ledline zijn ongeldig.');
        const effective=M.lightStateFor({type:'SPI',state:{...clean,portStates:{[port]:override}}},Number(port)),merged=lightState(effective,strict),allowed=new Set([...P.STATE_FIELDS,'rgbwLast']);
        const delta=Object.fromEntries(Object.keys(override).filter(key=>allowed.has(key)&&(override[key]===null||Object.hasOwn(merged,key))).map(key=>[key,override[key]===null?null:clone(merged[key])]));
        if(Object.keys(delta).length)portStates[port]=delta;
      }
      if(Object.keys(portStates).length)result.portStates=portStates;
    }
    return result;
  }
  function publicModel(input,strict=false){
    if(strict)keys(input,['schemaVersion','demo','stands','receivers','scenes','presets']);
    if(input?.schemaVersion!==30||typeof input.demo!=='boolean'||!Array.isArray(input.stands)||input.stands.length>20||!Array.isArray(input.receivers)||input.receivers.length>1200)fail('BACKUP_MODEL','De installatie in deze backup is niet geldig.');
    const model={schemaVersion:30,demo:input.demo,stands:input.stands.map(s=>{
      const next=pick(s,['id','name','zones'],strict);
      if(!Array.isArray(s.zones)||s.zones.length>100)fail('BACKUP_MODEL','Te veel zones.');
      next.zones=s.zones.map(z=>pick(z,['id','name','type','layout','receiverIds','lineOrder'],strict));return next;
    }),receivers:input.receivers.map(r=>{
      const next=pick(r,['id','rid','deviceFingerprint','name','type','standId','zoneId','role','lifecycle','connection','outputs','state','onboardingTransactionId'],strict);
      if(r.lifecycle!=='added')fail('BACKUP_SETUP','Rond eerst het toevoegen van je receiver af.');
      if(!Array.isArray(r.outputs))fail('BACKUP_MODEL','Poortinstellingen ontbreken.');
      next.outputs=r.outputs.map(o=>pick(o,['port','enabled','pixels','reversed'],strict));
      next.state=lightState(r.state,strict);next.connection='unknown';return next;
    }),scenes:[],presets:[]};
    for(const s of model.stands)for(const item of [s,...s.zones])if(typeof item.name!=='string'||item.name.length>64)fail('BACKUP_MODEL','Een naam is te lang.');
    for(const r of model.receivers)if(typeof r.name!=='string'||r.name.length>64)fail('BACKUP_MODEL','Een naam is te lang.');
    for(const r of model.receivers)validateReceiverAnimations(r);
    return M.assertValid(model);
  }
  const catalogues=new Map();
  function validateAnimation(type,state){
    if(state.engine==='STATIC')return;
    if(!['SPI','RGBW'].includes(type))fail('BACKUP_MODEL','Onbekend receivertype.');
    if(!catalogues.has(type))catalogues.set(type,Preview.catalog(type));
    const found=catalogues.get(type).some(effect=>state.v30Effect
      ?effect.state.v30Effect===state.v30Effect&&effect.state.engine===state.engine
      :effect.state.engine===state.engine&&effect.state.variant===(state.variant??0)&&(effect.state.previewFamily||'')===(state.previewFamily||''));
    if(!found)fail('BACKUP_ANIMATION','Deze backup bevat een animatie die deze app niet ondersteunt.');
  }
  function validateReceiverAnimations(receiver){
    validateAnimation(receiver.type,receiver.state);
    for(const port of Object.keys(receiver.state.portStates||{}))validateAnimation(receiver.type,M.lightStateFor(receiver,Number(port)));
  }
  function list(value,validate){
    if(!Array.isArray(value)||value.length>100)fail('BACKUP_LIBRARY','Deze bibliotheek is te groot.');
    const ids=new Set();return value.map(item=>{const next=validate(item);if(ids.has(next.id))fail('BACKUP_LIBRARY','Dubbele items in de backup.');ids.add(next.id);return next;});
  }
  function validate(value){
    bounded(value);keys(value,['format','version','appVersion','createdAt','model','libraries','preferences']);
    if(value.format!==FORMAT||value.version!==1||value.appVersion!=='32.0.0'||typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt)))fail('BACKUP_VERSION','Deze backupversie wordt niet ondersteund.');
    keys(value.libraries,['presets','scenes','colors']);keys(value.preferences,['language','theme']);
    if(!U.languages.some(l=>l.code===value.preferences.language)||!U.themes.includes(value.preferences.theme))fail('BACKUP_PREFERENCES','Ongeldige taal of weergave.');
    return {format:FORMAT,version:1,appVersion:'32.0.0',createdAt:value.createdAt,model:publicModel(value.model,true),libraries:{presets:list(value.libraries.presets,P.validate),scenes:list(value.libraries.scenes,S.validate),colors:C.validateColors(value.libraries.colors)},preferences:clone(value.preferences)};
  }
  function create({model,presets,scenes,colors,preferences},now=new Date()){
    const result=validate({format:FORMAT,version:1,appVersion:'32.0.0',createdAt:now.toISOString(),model:publicModel(model),libraries:{presets,scenes,colors},preferences});
    const raw=JSON.stringify(result,null,2);if(new TextEncoder().encode(raw).length>MAX_BYTES)fail('BACKUP_SIZE','Je backup is groter dan 4 MB.');return raw;
  }
  const read=raw=>validate(parse(raw));
  const identity=r=>JSON.stringify([r.id,r.rid||null,r.deviceFingerprint||null,r.standId,r.type,r.role,r.lifecycle,r.onboardingTransactionId||null]);
  const key=v=>JSON.stringify(v,(_,value)=>plain(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
  function nativeModel(saved,current){
    const desired=publicModel(saved,true),trusted=publicModel(current),byID=new Map(trusted.receivers.map(r=>[r.id,r])),nativeByID=new Map(current.receivers.map(r=>[r.id,r]));
    if(desired.demo||trusted.demo||key(desired.stands.map(s=>s.id).sort())!==key(trusted.stands.map(s=>s.id).sort())||desired.receivers.length!==trusted.receivers.length)fail('BACKUP_INSTALLATION','Open eerst dezelfde installatie op deze telefoon.');
    desired.receivers=desired.receivers.map(r=>{
      const old=byID.get(r.id);if(!old||identity(r)!==identity(old))fail('BACKUP_INSTALLATION','Deze backup hoort niet bij de gekoppelde receivers.');
      if(key(r.outputs)!==key(old.outputs))fail('BACKUP_PORTS','De poortinstellingen verschillen. Herstel die eerst bij je SPI-receiver.');
      const result={...r,connection:'unknown',state:clone(old.state)},native=nativeByID.get(r.id);
      // The portable format deliberately excludes this immutable MAIN field.
      // Preserve it only from the same native-loaded current receiver after
      // exact identity/geometry checks. Native import revalidates the context
      // and every immutable field; the file never grants receiver authority.
      if(Object.hasOwn(native,'physicalId')){
        if(native.role!=='main'||typeof native.physicalId!=='string'||! /^[0-9A-F]{12}$/.test(native.physicalId)||/^0+$/.test(native.physicalId))fail('BACKUP_INSTALLATION','De gekoppelde hoofdreceiver kon niet worden gecontroleerd.');
        result.physicalId=native.physicalId;
      }
      return result;
    });return desired;
  }
  function lightRecord(model){return {version:1,receivers:publicModel(model).receivers.map(r=>({identity:identity(r),state:r.state}))};}
  function restoreLight(model,raw){
    if(!raw)return clone(model);const data=parse(raw);keys(data,['version','receivers']);
    if(data.version!==1||!Array.isArray(data.receivers)||data.receivers.length>1200)fail('LIGHT_STORAGE','De bewaarde lichtkeuze is beschadigd.');
    const states=new Map();for(const r of data.receivers){keys(r,['identity','state']);if(typeof r.identity!=='string'||states.has(r.identity))fail('LIGHT_STORAGE','Ongeldige lichtkeuze.');states.set(r.identity,lightState(r.state,true));}
    const next=clone(model);for(const r of next.receivers)if(states.has(identity(r))){r.state=states.get(identity(r));validateReceiverAnimations(r);}return M.assertValid(next);
  }
  function values(backup){return {[P.STORAGE_KEY]:JSON.stringify({version:1,presets:backup.libraries.presets}),[S.STORAGE_KEY]:JSON.stringify({version:1,scenes:backup.libraries.scenes}),[C.STORAGE_KEY]:JSON.stringify({version:1,colors:backup.libraries.colors}),[U.STORAGE_KEY]:JSON.stringify({version:1,preferences:backup.preferences}),[LIGHT_KEY]:JSON.stringify(lightRecord(backup.model))};}
  const storageKeys=[P.STORAGE_KEY,S.STORAGE_KEY,C.STORAGE_KEY,U.STORAGE_KEY,LIGHT_KEY];
  function transaction(storage){
    const available=()=>{if(!storage?.getItem||!storage?.setItem||!storage?.removeItem)fail('BACKUP_STORAGE','Opslaan is niet beschikbaar op dit apparaat.');};
    function pending(){available();const raw=storage.getItem(JOURNAL_KEY);if(raw===null)return null;const j=parse(raw);keys(j,['version','beforeModel','afterModel','backup']);if(j.version!==1||typeof j.beforeModel!=='string'||typeof j.afterModel!=='string')fail('BACKUP_STORAGE','Herstel kon niet veilig worden hervat.');j.backup=validate(j.backup);return j;}
    function prepare(backup,beforeModel,afterModel){
      available();if(pending())fail('BACKUP_PENDING','Rond eerst de vorige herstelactie af.');
      const valid=validate(backup),next=values(valid);
      // Stage one durable complete record before the native model can commit.
      // Rollforward is idempotent; never repeat radio actions after a crash.
      const j={version:1,beforeModel:key(publicModel(beforeModel)),afterModel:key(publicModel(afterModel)),backup:valid};
      const raw=JSON.stringify(j);if(new TextEncoder().encode(raw).length>MAX_BYTES)fail('BACKUP_SIZE','Deze backup is te groot om veilig te herstellen.');
      storage.setItem(JOURNAL_KEY,raw);if(storage.getItem(JOURNAL_KEY)!==raw)fail('BACKUP_STORAGE','De herstelactie is niet bewaard.');return next;
    }
    function finish(model){
      const j=pending();if(!j)return null;
      if(key(publicModel(model))!==j.afterModel)fail('BACKUP_CONFLICT','De installatie is ondertussen gewijzigd. Je backup blijft bewaard voor herstel.');
      for(const [name,value] of Object.entries(values(j.backup))){if(!storageKeys.includes(name))fail('BACKUP_STORAGE','Onbekende opslag.');storage.setItem(name,value);if(storage.getItem(name)!==value)fail('BACKUP_STORAGE','De backup kon niet volledig worden opgeslagen.');}
      storage.removeItem(JOURNAL_KEY);return j.backup;
    }
    function discard(model){const j=pending();if(j&&key(publicModel(model))!==j.beforeModel)fail('BACKUP_CONFLICT','De installatie is al gewijzigd. Rond het herstel af.');storage.removeItem(JOURNAL_KEY);}
    return Object.freeze({pending,prepare,finish,discard});
  }
  return Object.freeze({FORMAT,MAX_BYTES,JOURNAL_KEY,LIGHT_KEY,create,read,validate,publicModel,nativeModel,identity,key,lightRecord,restoreLight,transaction});
});
