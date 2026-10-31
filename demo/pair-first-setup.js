/* Device-free UI continuation. These local choices are NEVER membership,
 * an authenticated receipt, a native pending journal or permission to write.
 * The caller must load the current native view and outputConfigurationStatus
 * before opening an editor; only existing native services may save changes. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LightningPairFirstSetup=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const KEY='aluvision.spi-pair-first.ui.v1',MAX_ENTRIES=30,MAX_BYTES=65536;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
  const keys=(value,expected)=>plain(value)&&Object.keys(value).sort().join(',')===expected.slice().sort().join(',');
  const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value);
  const hex=(value,length)=>typeof value==='string'&&value.length===length&&/^[A-F0-9]+$/.test(value)&&!/^0+$/.test(value);
  function fail(code){throw Object.assign(Error(code),{code});}
  function outputs(value,{draft=false}={}){
    if(!Array.isArray(value)||value.length!==4||!value.every((row,index)=>keys(row,['port','enabled','pixels','reversed'])&&row.port===index+1&&
      typeof row.enabled==='boolean'&&typeof row.reversed==='boolean'&&Number.isInteger(row.pixels)&&row.pixels>=(draft?0:1)&&row.pixels<=1024))fail('PAIR_FIRST_INVALID');
    return copy(value);
  }
  function sameOutputs(left,right){return Array.isArray(left)&&Array.isArray(right)&&left.length===4&&right.length===4&&left.every((row,index)=>
    ['port','enabled','pixels','reversed'].every(key=>row[key]===right[index]?.[key]));}
  function editableDraft(desired,baseline){
    return desired.every((row,index)=>row.reversed===baseline[index].reversed&&
      (row.pixels<=163||!row.enabled&&!baseline[index].enabled&&row.pixels===baseline[index].pixels));
  }
  function directionGeometry(desired,baseline){return desired.every((row,index)=>row.port===baseline[index].port&&row.enabled===baseline[index].enabled&&
    row.pixels===baseline[index].pixels&&(row.enabled||row.reversed===baseline[index].reversed));}
  function directionChanges(value){
    if(!Array.isArray(value)||value.length>MAX_ENTRIES)fail('PAIR_FIRST_INVALID');
    const rows=value.map(item=>{
      if(!keys(item,['receiverId','rid','fingerprint','baseline','outputs','requiresReconcile'])||!id(item.receiverId)||!hex(item.rid,16)||!hex(item.fingerprint,64)||typeof item.requiresReconcile!=='boolean')fail('PAIR_FIRST_INVALID');
      const baseline=outputs(item.baseline),desired=outputs(item.outputs);
      if(!directionGeometry(desired,baseline))fail('PAIR_FIRST_INVALID');return {...copy(item),baseline,outputs:desired};
    });
    if(new Set(rows.map(row=>row.receiverId)).size!==rows.length||new Set(rows.map(row=>row.rid)).size!==rows.length)fail('PAIR_FIRST_INVALID');return rows;
  }
  function checkpoint(value){
    if(!keys(value,['standId','receiverId','rid','fingerprint','transactionId','role','mainReceiverId','zoneId','phase','baseline','desired','port','directionChanges'])||
      !id(value.standId)||!id(value.receiverId)||!hex(value.rid,16)||!hex(value.fingerprint,64)||!id(value.transactionId)||
      !['main','node'].includes(value.role)||(value.role==='main'?value.mainReceiverId!==null:!id(value.mainReceiverId))||
      value.zoneId!==null&&!id(value.zoneId)||!['pairing','outputs','pixels','review','directions'].includes(value.phase)||
      value.port!==null&&(!Number.isInteger(value.port)||value.port<1||value.port>4))fail('PAIR_FIRST_INVALID');
    const baseline=outputs(value.baseline),desired=outputs(value.desired,{draft:true});
    if(!baseline.some(row=>row.enabled)||!editableDraft(desired,baseline)||
      value.phase==='pixels'&&!desired.some(row=>row.port===value.port&&row.enabled)||
      value.phase!=='pixels'&&value.port!==null||
      ['pairing','directions'].includes(value.phase)&&!sameOutputs(baseline,desired)||
      value.phase==='review'&&(!desired.some(row=>row.enabled)||desired.some(row=>row.enabled&&(row.pixels<1||row.pixels>163))))fail('PAIR_FIRST_INVALID');
    const directions=directionChanges(value.directionChanges);
    if(value.phase==='pairing'&&directions.length)fail('PAIR_FIRST_INVALID');
    return {...copy(value),baseline,desired,directionChanges:directions};
  }
  function fromDraft(draft){
    if(!plain(draft)||draft.receiver?.type!=='SPI'||!['security','zone','review'].includes(draft.stage)||
      !['pending','confirmed'].includes(draft.security?.status)||draft.cancelled!==false||draft.membership!=='pending')fail('PAIR_FIRST_INVALID');
    return checkpoint({standId:draft.stand?.id,receiverId:draft.receiver.id,rid:draft.receiver.rid,fingerprint:draft.receiver.deviceFingerprint,
      transactionId:draft.transactionId,role:draft.role,mainReceiverId:draft.mainReceiverId,zoneId:draft.zoneId||draft.activeZoneId||null,
      phase:'pairing',baseline:outputs(draft.outputs),desired:outputs(draft.outputs),port:null,directionChanges:[]});
  }
  function sameIdentity(left,right){return ['standId','receiverId','rid','fingerprint','transactionId','role','mainReceiverId'].every(key=>left[key]===right[key]);}
  function receiverFor(model,value){
    const row=checkpoint(value),matches=model?.receivers?.filter(receiver=>receiver.id===row.receiverId||receiver.rid===row.rid||receiver.deviceFingerprint===row.fingerprint)||[];
    if(matches.length!==1)return null;
    const receiver=matches[0],stand=model.stands?.find(item=>item.id===row.standId);
    if(!stand||receiver.id!==row.receiverId||receiver.rid!==row.rid||receiver.deviceFingerprint!==row.fingerprint||receiver.standId!==row.standId||
      receiver.type!=='SPI'||receiver.lifecycle!=='added'||receiver.role!==row.role||receiver.onboardingTransactionId!==row.transactionId)return null;
    const mains=model.receivers.filter(item=>item.standId===row.standId&&item.role==='main'&&item.lifecycle==='added');
    if(mains.length!==1||mains[0].id!==(row.role==='main'?row.receiverId:row.mainReceiverId))return null;
    outputs(receiver.outputs);return receiver;
  }
  function fromPublished(model,receiverId){
    const receiver=model?.receivers?.find(item=>item.id===receiverId),main=receiver&&model.receivers.find(item=>item.standId===receiver.standId&&item.role==='main'&&item.lifecycle==='added');
    if(!receiver||!main)fail('PAIR_FIRST_IDENTITY_CHANGED');
    const saved=outputs(receiver.outputs),row=checkpoint({standId:receiver.standId,receiverId:receiver.id,rid:receiver.rid,fingerprint:receiver.deviceFingerprint,
      transactionId:receiver.onboardingTransactionId,role:receiver.role,mainReceiverId:receiver.role==='main'?null:main.id,zoneId:receiver.zoneId,
      phase:'outputs',baseline:saved,desired:saved,port:null,directionChanges:[]});
    if(!receiverFor(model,row))fail('PAIR_FIRST_IDENTITY_CHANGED');return row;
  }
  function restoredDirections(value,model){
    const row=checkpoint(value);if(!receiverFor(model,row)||row.phase!=='directions')return [];
    return row.directionChanges.filter(change=>{
      const receiver=model.receivers.find(item=>item.id===change.receiverId&&item.rid===change.rid&&item.deviceFingerprint===change.fingerprint&&item.type==='SPI'&&
        item.lifecycle==='added'&&item.standId===row.standId&&item.zoneId===row.zoneId);
      return receiver&&directionGeometry(receiver.outputs,change.baseline)&&directionGeometry(change.outputs,receiver.outputs);
    }).map(change=>({receiverId:change.receiverId,outputs:copy(change.outputs),...(change.requiresReconcile?{requiresReconcile:true}:{})}));
  }
  function resolve(value,model,status){
    const row=checkpoint(value),receiver=receiverFor(model,row);
    if(!receiver)return {status:'not-published'};
    if(!plain(status)||!['none','pending'].includes(status.status))fail('PAIR_FIRST_STATUS_UNCONFIRMED');
    const saved=outputs(receiver.outputs),base={...row,zoneId:receiver.zoneId,baseline:saved,desired:saved,phase:'outputs',port:null,directionChanges:[]};
    if(status.status==='pending'){
      const pending=outputs(status.outputs);
      if(!pending.some(port=>port.enabled)||pending.some(port=>port.enabled&&port.pixels>163))fail('PAIR_FIRST_STATUS_UNCONFIRMED');
      // The native journal, not remembered UI choices, owns a pending write.
      return {status:'ready',receiver:copy(receiver),checkpoint:checkpoint({...base,directionChanges:receiver.zoneId===row.zoneId?row.directionChanges:[]}),resumePending:true,pendingOutputs:pending};
    }
    if(row.phase==='pairing')return {status:'ready',receiver:copy(receiver),checkpoint:checkpoint(base),resumePending:false};
    if(row.phase==='directions'&&directionGeometry(saved,row.baseline))return {status:'ready',receiver:copy(receiver),resumePending:false,
      checkpoint:checkpoint({...base,phase:'directions',directionChanges:receiver.zoneId===row.zoneId?restoredDirections(row,model).map(change=>{
        const member=model.receivers.find(item=>item.id===change.receiverId);return {receiverId:member.id,rid:member.rid,fingerprint:member.deviceFingerprint,
          baseline:outputs(member.outputs),outputs:outputs(change.outputs),requiresReconcile:change.requiresReconcile===true};
      }):[]})};
    if(sameOutputs(saved,row.baseline))return {status:'ready',receiver:copy(receiver),checkpoint:checkpoint({...row,zoneId:receiver.zoneId,
      directionChanges:receiver.zoneId===row.zoneId?row.directionChanges:[]}),resumePending:false,
      ...(row.phase==='directions'?{}:{resumeStep:{stage:row.phase,port:row.port,outputs:copy(row.desired)}})};
    // A completed native geometry commit may precede the last local UI write.
    // Only the fresh native view AND an empty native pending journal allow us
    // to continue from those actual counts, never infer a claim or delivery.
    if(row.phase==='review'&&sameOutputs(saved,row.desired))return {status:'ready',receiver:copy(receiver),checkpoint:checkpoint({...base,phase:'directions'}),resumePending:false};
    return {status:'ready',receiver:copy(receiver),checkpoint:checkpoint(base),resumePending:false,changed:true};
  }
  function create({storage,key=KEY}={}){
    if(typeof key!=='string'||key!==KEY)fail('PAIR_FIRST_INVALID');
    function read(){
      try{
        const text=storage?.getItem(key);if(!text)return [];
        if(typeof text!=='string'||text.length>MAX_BYTES)return [];
        const envelope=JSON.parse(text);
        if(!keys(envelope,['version','entries'])||envelope.version!==1||!Array.isArray(envelope.entries)||envelope.entries.length>MAX_ENTRIES)return [];
        const rows=envelope.entries.map(checkpoint);
        if(new Set(rows.map(row=>row.receiverId)).size!==rows.length||new Set(rows.map(row=>row.rid)).size!==rows.length)return [];
        return rows;
      }catch(_){return [];}
    }
    function write(rows){
      if(!storage||typeof storage.setItem!=='function'||typeof storage.getItem!=='function')fail('PAIR_FIRST_STORAGE_UNAVAILABLE');
      const checked=rows.map(checkpoint);
      if(checked.length>MAX_ENTRIES||new Set(checked.map(row=>row.receiverId)).size!==checked.length||new Set(checked.map(row=>row.rid)).size!==checked.length)fail('PAIR_FIRST_INVALID');
      const text=JSON.stringify({version:1,entries:checked});if(text.length>MAX_BYTES)fail('PAIR_FIRST_INVALID');
      try{storage.setItem(key,text);if(storage.getItem(key)!==text)fail('PAIR_FIRST_STORAGE_UNAVAILABLE');}
      catch(_){fail('PAIR_FIRST_STORAGE_UNAVAILABLE');}
      return checked;
    }
    function put(value){
      const row=checkpoint(value),rows=read(),index=rows.findIndex(item=>item.receiverId===row.receiverId||item.rid===row.rid);
      if(index>=0){if(!sameIdentity(rows[index],row))fail('PAIR_FIRST_IDENTITY_CHANGED');rows[index]=row;}else rows.push(row);
      write(rows);return copy(row);
    }
    function get(receiverId){return read().find(row=>row.receiverId===receiverId)||null;}
    function begin(draft){
      const row=fromDraft(draft),rows=read(),index=rows.findIndex(item=>item.receiverId===row.receiverId||item.rid===row.rid),previous=rows[index];
      if(previous){
        if(sameIdentity(previous,row))return previous;
        // An explicitly removed/re-added physical receiver can start a NEW
        // ordinary transaction. Retire only its obsolete local UI bookmark;
        // the normal draft and native claim still decide real admission.
        const context=draft.context?.receivers;
        if(previous.rid!==row.rid||previous.fingerprint!==row.fingerprint||!Array.isArray(context)||context.some(item=>
          item.id===row.receiverId||item.rid===row.rid||item.deviceFingerprint===row.fingerprint))fail('PAIR_FIRST_IDENTITY_CHANGED');
        rows[index]=row;write(rows);return copy(row);
      }
      return put(row);
    }
    function edit(receiverId,step){
      const previous=get(receiverId);if(!previous||!plain(step)||!['outputs','pixels','review'].includes(step.stage))fail('PAIR_FIRST_INVALID');
      return put({...previous,phase:step.stage,port:step.stage==='pixels'?step.port:null,desired:outputs(step.outputs,{draft:true}),directionChanges:[]});
    }
    function afterPixels(receiverId,model){
      const previous=get(receiverId);if(!previous)fail('PAIR_FIRST_INVALID');const receiver=receiverFor(model,previous);if(!receiver)fail('PAIR_FIRST_IDENTITY_CHANGED');
      const saved=outputs(receiver.outputs),next=checkpoint({...previous,zoneId:receiver.zoneId,phase:'directions',baseline:saved,desired:saved,port:null,
        directionChanges:receiver.zoneId===previous.zoneId?previous.directionChanges:[]});
      const valid=new Set(restoredDirections(next,model).map(change=>change.receiverId));
      return put({...next,directionChanges:next.directionChanges.filter(change=>valid.has(change.receiverId))});
    }
    function rememberDirections(receiverId,model,changes){
      const previous=get(receiverId);if(!previous||previous.phase!=='directions'||!receiverFor(model,previous)||!Array.isArray(changes))fail('PAIR_FIRST_INVALID');
      const rows=changes.map(change=>{
        const receiver=model.receivers.find(item=>item.id===change.receiverId&&item.type==='SPI'&&item.lifecycle==='added'&&item.standId===previous.standId&&item.zoneId===previous.zoneId);
        if(!receiver)fail('PAIR_FIRST_IDENTITY_CHANGED');
        return {receiverId:receiver.id,rid:receiver.rid,fingerprint:receiver.deviceFingerprint,baseline:outputs(receiver.outputs),outputs:outputs(change.outputs),requiresReconcile:change.requiresReconcile===true};
      });
      return put({...previous,directionChanges:directionChanges(rows)});
    }
    function remove(receiverId){write(read().filter(row=>row.receiverId!==receiverId));}
    return Object.freeze({entries:read,get,begin,put,edit,afterPixels,rememberDirections,remove});
  }
  const COPY=Object.freeze({
    nl:Object.freeze({title:'SPI verder instellen',hint:'Je receiver is gekoppeld. Stel de poorten, pixels en kanten verder in.',resume:'Instellen verderzetten',next:'Verder · kanten instellen',unassigned:'Je receiver is gekoppeld. Kies een SPI-zone om alle kanten samen in te stellen.',storage:'Je instelstap kon niet op dit toestel worden bewaard. Probeer opnieuw.',changed:'Je aansluitingen zijn gewijzigd. Controleer de poorten en pixels opnieuw.'}),
    en:Object.freeze({title:'Finish SPI setup',hint:'Your receiver is paired. Continue setting its ports, pixels and directions.',resume:'Continue setup',next:'Next · set directions',unassigned:'Your receiver is paired. Choose an SPI zone to align all directions together.',storage:'This setup step could not be saved on this device. Please try again.',changed:'Your connections have changed. Check the ports and pixels again.'}),
    fr:Object.freeze({title:'Terminer la configuration SPI',hint:'Votre récepteur est associé. Continuez avec les ports, pixels et sens.',resume:'Continuer la configuration',next:'Suivant · régler les sens',unassigned:'Votre récepteur est associé. Choisissez une zone SPI pour régler tous les sens ensemble.',storage:'Cette étape n’a pas pu être enregistrée sur cet appareil. Réessayez.',changed:'Vos connexions ont changé. Vérifiez à nouveau les ports et les pixels.'}),
    de:Object.freeze({title:'SPI-Einrichtung abschließen',hint:'Dein Receiver ist gekoppelt. Richte die Anschlüsse, Pixel und Richtungen weiter ein.',resume:'Einrichtung fortsetzen',next:'Weiter · Richtungen einstellen',unassigned:'Dein Receiver ist gekoppelt. Wähle eine SPI-Zone, um alle Richtungen gemeinsam einzustellen.',storage:'Dieser Schritt konnte auf diesem Gerät nicht gespeichert werden. Bitte erneut versuchen.',changed:'Deine Anschlüsse haben sich geändert. Prüfe die Anschlüsse und Pixel erneut.'})
  });
  const continuationCopy={
    laterHint:['Je kunt later verdergaan of de gekoppelde receiver verwijderen.','Continue later, or remove the paired receiver.','Continuez plus tard ou retirez le récepteur associé.','Setze die Einrichtung später fort oder entferne den gekoppelten Receiver.'],
    later:['Later instellen','Set up later','Configurer plus tard','Später einrichten'],
    check:['Instellingen controleren','Check settings','Vérifier les réglages','Einstellungen prüfen'],
    remove:['Receiver verwijderen','Remove receiver','Retirer le récepteur','Receiver entfernen'],
    removeNetwork:['Receivernetwerk verwijderen','Remove receiver network','Retirer le réseau de récepteurs','Receivernetzwerk entfernen']
  };
  function text(key,language='nl'){const locale=String(language).split('-')[0],index=Math.max(0,['nl','en','fr','de'].indexOf(locale));return continuationCopy[key]?.[index]||(COPY[locale]||COPY.nl)[key]||'';}
  return Object.freeze({KEY,MAX_ENTRIES,checkpoint,fromDraft,fromPublished,sameOutputs,receiverFor,resolve,restoredDirections,create,text});
});
