/* Native installation-security integration. Session trust and durable owner
 * records are separate from the public app model and receiver discovery. */
(() => {
  'use strict';
  if (window.AluvisionLocalTestMode?.enabled) return;
  const connection = window.AluvisionNativeConnection, gateway = window.AluvisionNativeWifi;
  if (!connection?.available || !gateway?.transactRaw || !window.AluvisionDeviceTrust || !window.AluvisionSecureTrustStore) return;
  const store = window.AluvisionSecureTrustStore.create({journal: connection.secretJournal});
  const parse = window.AluvisionDeviceTrust.parseFields, enc = new TextEncoder();
  const valid = (value, size) => typeof value === 'string' && value.length === size && /^[0-9A-F]+$/.test(value) && !/^0+$/.test(value);
  const fail = (code, message) => Object.assign(new Error(message), {code});
  const encode = fields => Object.entries(fields).filter(([,value]) => value !== null && value !== undefined && value !== '').map(([key,value]) => {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || !['string','number','boolean'].includes(typeof value) || /[;\x00-\x1F\x7F]/.test(String(value))) throw fail('SECURE_CONTROL_FORMAT', 'Ongeldige lichtopdracht.');
    return key + '=' + value;
  }).join(';');
  let epoch = 0, nodeEnrollment = null, commandId = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  const handles = new Map(), opening = new Map(), queue = []; let busy = false, nativeLease = null, recoveryRotation = null;
  const context = () => gateway.installationContext();
  function serialSession(session,prepare=async(action,payload)=>payload) {
    let tail = Promise.resolve(), retired = false;
    return Object.freeze({
      get ownerSessionActive(){return !retired && session.ownerSessionActive;},
      ownerCommand(action,payload,transact) {
        if (retired) return Promise.reject(fail('TRUST_EXPIRED','De beveiligde sessie wordt vernieuwd.'));
        const result=tail.then(async()=>session.ownerCommand(action,await prepare(action,payload),transact));
        tail=result.catch(()=>{});return result;
      },
      recoveryRequest:(...args)=>session.recoveryRequest(...args),
      recoveryContinuation:(...args)=>session.recoveryContinuation(...args),
      async retireForRenewal(){retired=true;await tail;session.close();},
      close:()=>{retired=true;session.close();}
    });
  }
  const current = generation => generation === epoch && gateway.isReady() && !nativeLease;
  function invalidateSessions() {
    epoch++; for (const handle of handles.values()) { clearTimeout(handle.expiryTimer); handle.session.close(); } handles.clear();
  }
  window.addEventListener('aluvision-transport-session-changed', () => {
    invalidateSessions();
    while (queue.length) queue.shift().reject(fail('SECURE_CONNECTION_CHANGED', 'De verbinding is gewijzigd. De opgeslagen installatie blijft behouden.'));
  });
  async function ensure(rid, {allowBlank = false, installationId = context().meshId, isCurrent = () => true} = {}) {
    if (!valid(rid,16) || !valid(installationId,8) || !isCurrent()) throw fail('TRUST_TARGET', 'Kies de receiver opnieuw.');
    const generation = epoch, cacheKey = installationId + ':' + rid, directRid=gateway.gatewayRid();
    const active = () => current(generation) && gateway.gatewayRid() === directRid;
    const cached = handles.get(cacheKey);
    if (cached?.session.ownerSessionActive && active()) return cached;
    if(cached?.temporaryPin&&active())throw fail('PIN_SESSION_EXPIRED','Je tijdelijke verbinding is verlopen. Kies Bestaande installatie verbinden en voer je PIN opnieuw in.');
    if (opening.has(cacheKey)) return opening.get(cacheKey);
    const promise = (async () => {
      if (!active()) throw fail('TRUST_DIRECT_REQUIRED', 'Verbind eerst met de gekozen hoofdreceiver.');
      let record = await store.load(installationId);
      if (!record && allowBlank) record = await store.createInstallation(installationId, () => active() && isCurrent());
      if (!record) throw fail('TRUST_OWNER_REQUIRED', 'Herstel deze installatie eerst met je installatiepincode.');
      const saved = record.receivers[rid], info = gateway.receiverInfo(rid);
      const receiverType = saved?.receiverType || String(info?.DEVTYPE || info?.receiverType || '').toUpperCase();
      let rawTransact=fields=>gateway.transactRaw({V:18,...fields},{timeout:10000});
      if(rid!==directRid) {
        if(record.receivers[directRid]?.role!=='MAIN'||!window.AluvisionNodeEnrollment?.relay)throw fail('TRUST_MAIN_REQUIRED','Verbind eerst met je eigen hoofdreceiver.');
        const main=await ensure(directRid,{installationId,isCurrent});
        rawTransact=window.AluvisionNodeEnrollment.relay({main,rid,mac:saved?.mac||String(info?.PHYSID||info?.STAMAC||info?.mac||'').toUpperCase(),isCurrent:active});
      }
      const signer = await store.signer(installationId);
      const result = await window.AluvisionDeviceTrust.open({rid, receiverType, physicalId: saved?.mac || '', expectedDeviceKey: saved?.publicKey || '', allowBlank, signer,
        transact: rawTransact,
        pinDevice: descriptor => store.pinReceiver(installationId, descriptor, () => active() && isCurrent()),
        isCurrent: active, recoveryRequestRaw: rid===directRid ? (frame,target) => connection.secureRecoveryRequest(frame,target) : undefined,
        recoveryRenew: rid===directRid ? options=>renewRecovery(rid,installationId,options) : undefined});
      if (!active() || !isCurrent()) {result.session.close(); throw fail('TRUST_CANCELLED','Receiver toevoegen geannuleerd.');}
      const prepare=async(action,payload)=>{
        if(rid===directRid||!['MESH_PEER_STAGE','MESH_PEER_COMMIT','MESH_SECURE_STATUS','PROXY_CONFIG','RELEASE_RECEIVER'].includes(action))return payload;
        const main=await ensure(directRid,{installationId}),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(payload))),n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
        const proof=parse(await main.session.ownerCommand('AUTHORIZE_NODE_COMMAND',encode({NODE:rid,NONCE:result.nonce,ACTION:action,SHA256:digest}),main.transact));
        if(!active()||proof.STATUS!=='OK'||!valid(proof.MAINPROOF,128))throw fail('NODE_OWNER_PROOF','De hoofdreceiver heeft deze wijziging niet goedgekeurd.');
        const unhex=value=>Uint8Array.from(value.match(/../g),part=>parseInt(part,16));
        const key=await crypto.subtle.importKey('raw',unhex(main.descriptor.publicKey),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
        const signed='ALUVISION-NODE-COMMAND-V1|INSTALLATION='+installationId+'|NODE='+rid+'|NONCE='+result.nonce+'|ACTION='+action+'|SHA256='+digest;
        if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,unhex(proof.MAINPROOF),enc.encode(signed)))throw fail('NODE_OWNER_PROOF','De goedkeuring van je hoofdreceiver klopt niet.');
        return payload+';MAINPROOF='+proof.MAINPROOF;
      };
      const handle = {...result, session:serialSession(result.session,prepare), rid, installationId, isCurrent: active, transact: rawTransact};
      handles.set(cacheKey,handle); return handle;
    })();
    opening.set(cacheKey,promise);
    try {return await promise;} finally {if(opening.get(cacheKey)===promise) opening.delete(cacheKey);}
  }
  async function renewRecovery(rid, installationId, {previous,transaction,started,isCurrent}) {
    if (recoveryRotation || nativeLease) throw fail('RECOVERY_BUSY','Een andere beveiligde verbinding wordt nog afgerond.');
    const rotation={},generation=epoch,key=installationId+':'+rid;
    recoveryRotation=rotation;
    const check=()=>{if(!current(generation)||!isCurrent()||gateway.gatewayRid()!==rid)throw fail('RECOVERY_CANCELLED','Herstel is onderbroken. De opgeslagen installatie blijft behouden.');};
    try {
      check();
      // Stop dequeuing ordinary edits, finish the current command, and retain
      // pending latest values. A handshake must not replace an in-flight key.
      const deadline=Date.now()+10000;
      while(busy){check();if(Date.now()>=deadline)throw fail('RECOVERY_BUSY','De vorige opdracht wordt nog afgerond.');await new Promise(resolve=>setTimeout(resolve,20));}
      const old=handles.get(key);
      if(!old)throw fail('RECOVERY_EXPIRED','De vorige herstelsessie is niet meer beschikbaar.');
      await old.session.retireForRenewal();check();
      if(handles.get(key)===old)handles.delete(key);
      const next=await ensure(rid,{installationId,isCurrent});check();
      if(started){
        const record=await store.load(installationId),tx=Array.from(transaction,value=>value.toString(16).padStart(2,'0')).join('').toUpperCase();
        if(previous.rid!==rid||!valid(previous.client,16)||!valid(previous.nonce,32)||!valid(record?.device?.id,16))throw fail('RECOVERY_IDENTITY','De herstelidentiteit klopt niet.');
        const reply=parse(await next.session.ownerCommand('RECOVERY_REBIND',encode({TXN:tx,PREVIOUSCLIENT:previous.client,PREVIOUSNONCE:previous.nonce,DEVICEID:record.device.id}),next.transact));
        check();
        if(reply.STATUS!=='OK'||reply.DETAIL!=='RECOVERY_REBOUND'||reply.TXN!==tx)throw fail('RECOVERY_REBIND','De receiver kon dezelfde hersteltransactie niet veilig hervatten.');
      }
      return next.session.recoveryContinuation(isCurrent);
    } finally {
      if(recoveryRotation===rotation)recoveryRotation=null;
      pump();
    }
  }
  async function claimMain(material, {isCurrent = () => true} = {}) {
    const {meshId,networkKey} = context(), rid = gateway.gatewayRid(), generation = epoch;
    const check = () => {if (!current(generation) || !isCurrent() || gateway.gatewayRid() !== rid || context().meshId !== meshId || context().networkKey !== networkKey) throw fail('TRUST_CANCELLED','Receiver toevoegen geannuleerd.');};
    const claimCurrent = () => {try {check();return true;} catch {return false;}};
    const requested = {MESHID:meshId,NETWORK:networkKey,SALT:material.salt,VERIFIER:material.pinVerifier,RECOVERY:material.recoveryVerifier,
      ...(material.localTestMigration === true ? {LOCALTEST:1} : {})};
    if (!valid(requested.NETWORK,16) || !valid(requested.SALT,32) || !valid(requested.VERIFIER,64) || !valid(requested.RECOVERY,64)) throw fail('TRUST_PIN','De pincode kon niet veilig worden voorbereid.');
    const checkRegistry = record => {
      if (record?.pendingRelease)
        throw fail('TRUST_RELEASE_PENDING','Controleer eerst de lopende receiververwijdering. Daarna kun je opnieuw koppelen en een PIN instellen.');
      if (Object.values(record?.receivers || {}).some(receiver => receiver.role === 'MAIN' && receiver.rid !== rid))
        throw fail('TRUST_DIFFERENT_MAIN','Deze installatie heeft al een andere hoofdreceiver. Herstel de bestaande installatie met je PIN, of maak bewust een aparte installatie. Er is niets vervangen.');
      if (record?.pending && (record.pending.type !== 'claim-main' || record.pending.rid !== rid))
        throw fail('TRUST_PENDING_CLAIM','Een andere receiver wordt nog ingesteld in deze installatie. Rond die inrichting af of herstel de bestaande installatie. Voor een nieuw systeem kies je een aparte installatie. Er is niets vervangen.');
      if (record?.pending && JSON.stringify(record.pending.fields) !== JSON.stringify(requested))
        throw fail('TRUST_PENDING_CLAIM','Deze receiver heeft een onafgeronde inrichting. Hervat dezelfde pincode; maak geen nieuwe installatie.');
    };
    // A reset receiver may keep its physical MAC but have a new RID/device key.
    // Never claim it first and only then discover that the journal has a MAIN.
    check(); let record = await store.load(meshId); check(); checkRegistry(record);
    const handle = await ensure(rid,{allowBlank:true,installationId:meshId,isCurrent:claimCurrent}); check();
    record = await store.load(meshId); check(); checkRegistry(record);
    if (!record.pending) record = await store.update(meshId,next => {
      // Revalidate inside the serialized CAS update, not just before awaits.
      checkRegistry(next);
      if (!next.pending) next.pending = {type:'claim-main',rid,fields:requested,recoveryKey:material.recoveryKey};
    }, claimCurrent);
    record = await store.load(meshId); check(); checkRegistry(record);
    if (!record?.pending) throw fail('TRUST_PENDING_CLAIM','De bewaarde inrichting is gewijzigd. Heropen de installatie; er is niets op de receiver gewijzigd.');
    const reply = parse(await handle.session.ownerCommand('CLAIM_MAIN', encode(record.pending.fields), handle.transact)); check();
    if (reply.STATUS !== 'OK' || reply.DETAIL !== 'CLAIM_MAIN_READY' || reply.RID !== rid || reply.PHYSID !== handle.descriptor.mac || reply.DEVTYPE !== handle.descriptor.receiverType || reply.MESHID !== meshId || reply.NETWORK !== networkKey || reply.ROLE !== 'MAIN' || reply.PINSET !== '1') throw fail('TRUST_CLAIM_UNCONFIRMED','De receiver heeft de inrichting nog niet volledig bevestigd. De herstelgegevens blijven bewaard.');
    await store.update(meshId,next => {checkRegistry(next);next.receivers[rid].role='MAIN';next.receivers[rid].number=1;next.pending=null;}, claimCurrent); check();
    handle.session.close(); handles.delete(meshId+':'+rid);
    const owned = await ensure(rid,{isCurrent}); check();
    return {ok:true,claimed:true,rid,meshId,networkKey,receiverType:reply.DEVTYPE,role:'MAIN',number:1,session:owned.session,recoveryKey:material.recoveryKey};
  }
  async function registerRestoredOwner(session, material, isCurrent = () => true, {existingPin = false} = {}) {
    const id = material.meshId; await store.createInstallation(id,isCurrent);
    if (existingPin) await store.update(id, next => { next.configurationAccess = 'remote-pending'; }, isCurrent);
    const record = await store.load(id), signer = await store.signer(id);
    const reply = parse(await session.ownerCommand('REGISTER_APP',encode({APPKEY:signer.publicKey,DEVICEID:record.device.id}), fields => gateway.transactRaw({V:18,...fields},{timeout:10000})));
    if (!isCurrent() || reply.STATUS!=='OK' || reply.DETAIL!=='APP_REGISTERED' || reply.RID!==material.rid || reply.MESHID!==id || reply.DEVTYPE!==material.receiverType || !valid(reply.PHYSID,12) || !valid(reply.DEVICEKEY,130)) throw fail('TRUST_REGISTER_UNCONFIRMED','De telefoonregistratie is niet volledig bevestigd.');
    await store.pinReceiver(id,{rid:material.rid,mac:reply.PHYSID,receiverType:reply.DEVTYPE,publicKey:reply.DEVICEKEY,role:'MAIN'},isCurrent);
    // A newly trusted phone may control the installation, but its initially
    // empty local model must never overwrite a receiver's existing backup.
    // REGISTER_APP may retire the receiver's provisional/SRP session. Do not
    // retain an apparently live JS handle whose authority changed remotely.
    session.close(); handles.delete(id+':'+material.rid);
    return {ok:true};
  }
  async function recoverPendingMain({isCurrent=()=>true}={}) {
    const id=context().meshId,rid=gateway.gatewayRid(),record=await store.load(id),pending=record?.pending;
    if(pending?.type!=='claim-main'||pending.rid!==rid)return false;
    const handle=await ensure(rid,{installationId:id,isCurrent});
    if(handle.trustState!=='OWNED')return false;
    const reply=parse(await handle.session.ownerCommand('CLAIM_STATUS','QUERY=1',handle.transact));
    if(!isCurrent()||reply.STATUS!=='OK'||reply.DETAIL!=='CLAIM_STATUS'||reply.RID!==rid||reply.PHYSID!==handle.descriptor.mac||reply.DEVTYPE!==handle.descriptor.receiverType||reply.DEVICEKEY!==handle.descriptor.publicKey||reply.MESHID!==pending.fields.MESHID||reply.NETWORK!==pending.fields.NETWORK||reply.ROLE!=='MAIN'||reply.MAIN!==rid||reply.MAINMAC!==handle.descriptor.mac||reply.NUMBER!=='1'||reply.APPKEY!==record.owner.publicKey)throw fail('TRUST_CLAIM_UNCONFIRMED','De hoofdreceiver bevestigde niet de bewaarde inrichting. De gegevens blijven behouden.');
    await store.update(id,next=>{next.receivers[rid].role='MAIN';next.receivers[rid].number=1;next.recoveryKeyToSave=pending.recoveryKey;next.pending=null;},isCurrent);
    return true;
  }
  function adoptPinSession(session,material,isCurrent=()=>true) {
    if(!isCurrent()||!session?.ownerSessionActive||material?.verified!==true||material.role!=='MAIN'||
       material.rid!==gateway.gatewayRid()||!valid(material.meshId,8)||!['SPI','RGBW'].includes(material.receiverType))
      throw fail('PIN_NOT_CONFIRMED','De hoofdreceiver heeft de pincodeverbinding niet bevestigd.');
    // A PIN proof authorizes this short-lived connection. It is not a durable
    // APPKEY/device enrolment and must never be written as one in the journal.
    invalidateSessions();
    const generation=epoch,directRid=gateway.gatewayRid();
    const active=()=>current(generation)&&gateway.gatewayRid()===directRid;
    const handle={rid:material.rid,installationId:material.meshId,temporaryPin:true,
      descriptor:{rid:material.rid,receiverType:material.receiverType,role:'MAIN'},
      session:serialSession(session),isCurrent:active,transact:fields=>gateway.transactRaw({V:18,...fields},{timeout:10000})};
    handles.set(material.meshId+':'+material.rid,handle);
    const expiresAt=Number(session.ownerSessionExpiresAt);
    if(Number.isFinite(expiresAt)&&expiresAt>Date.now())handle.expiryTimer=setTimeout(()=>{
      if(handles.get(material.meshId+':'+material.rid)!==handle||!active())return;
      handle.session.close();
      window.dispatchEvent(new CustomEvent('aluvision:pin-access-expired',{detail:{rid:material.rid}}));
    },Math.min(90000,expiresAt-Date.now()));
    return handle;
  }
  async function pauseForNativeOperation() {
    if (nativeLease || recoveryRotation) throw fail('OTA_BUSY','Een beveiligde receiveractie wordt nog afgerond. Wacht even.');
    const lease = {}; nativeLease = lease;
    while(queue.length) queue.shift().reject(fail('OTA_BUSY','De receiver wordt bijgewerkt. De verlichting kan daarna opnieuw worden bediend.'));
    const deadline = Date.now()+12000;
    try {
      while(busy || opening.size) {
        if(Date.now()>=deadline) throw fail('OTA_BUSY','De vorige verbinding is nog bezig. Probeer de update straks opnieuw.');
        await new Promise(resolve=>setTimeout(resolve,25));
      }
      invalidateSessions();
    } catch(error) { if(nativeLease===lease) nativeLease=null; invalidateSessions(); throw error; }
    let released=false;
    return () => { if(released)return;released=true;if(nativeLease===lease){nativeLease=null;invalidateSessions();} };
  }
  async function provisionTopology({isCurrent=()=>true}={}) {
    const installationId=context().meshId,record=await store.load(installationId);
    if(!record||!window.AluvisionMeshProvisioning?.create)throw fail('MESH_PROVISIONING_UNAVAILABLE','De beveiligde netwerkconfiguratie is niet beschikbaar.');
    const receivers=Object.values(record.receivers).filter(receiver=>['MAIN','NODE'].includes(receiver.role));
    if((gateway.installationReceiverRids?.()||[]).some(rid=>!receivers.some(receiver=>receiver.rid===rid)))throw fail('MESH_OWNER_PROOF_REQUIRED','Niet alle bestaande receivers hebben bevestigde eigenaarstoegang. De bestaande installatie is niet vervangen.');
    const coordinator=window.AluvisionMeshProvisioning.create({journal:connection.secretJournal,isCurrent,
      sessionProvider:receiver=>ensure(receiver.rid,{installationId,isCurrent})});
    const options={installationId,receivers,ownerPublic:record.owner.publicKey};
    return await connection.secretJournal.load(installationId) ? coordinator.resume(options) : coordinator.start(options);
  }
  async function runCommand(item) {
    if (!current(item.epoch) || item.options?.signal?.aborted) throw fail('SECURE_CONNECTION_CHANGED','De receiververbinding is gewijzigd.');
    const handle = await ensure(gateway.gatewayRid()), fields = {...item.fields};
    delete fields.KEY; delete fields.PAIR_TOKEN;
    fields.ID ??= (commandId = commandId === 0xFFFFFFFF ? 1 : commandId + 1);
    const plain = encode(fields);
    if (enc.encode(plain).length > 1152) throw fail('SECURE_CONTROL_SIZE','De lichtopdracht is te groot.');
    const reply = await handle.session.ownerCommand('CONTROL',plain,handle.transact);
    if (!current(item.epoch) || item.options?.signal?.aborted) throw fail('SECURE_CONNECTION_CHANGED','De receiververbinding is gewijzigd.');
    return parse(reply);
  }
  async function pump() {if(busy||recoveryRotation)return;busy=true;try{while(queue.length&&!recoveryRotation){const item=queue.shift();try{item.resolve(await runCommand(item));}catch(error){item.reject(error);}}}finally{busy=false;}}
  function control(fields, options = {}) {
    return new Promise((resolve,reject) => {
      if(nativeLease){reject(fail('OTA_BUSY','De receiver wordt bijgewerkt. Wacht tot de update klaar is.'));return;}
      const type = String(fields?.TYPE||'').toUpperCase(), scope = String(fields?.TARGET||gateway.gatewayRid())+':'+String(fields?.PORT??0);
      const previous = queue.at(-1);
      if (type==='LIVE' && previous?.type==='LIVE' && previous.scope===scope) {
        queue.pop(); previous.resolve({STATUS:'SUPERSEDED',DETAIL:'LIVE_SUPERSEDED',superseded:true,accepted:false,confirmed:false});
      }
      if(queue.length>=64){reject(fail('SECURE_CONTROL_BUSY','Wacht even tot de receiver de vorige wijzigingen heeft verwerkt.'));return;}
      queue.push({fields:{...fields},options,type,scope,epoch,resolve,reject});pump();
    });
  }
  window.AluvisionSecureConnection = Object.freeze({ensure,claimMain,registerRestoredOwner,recoverPendingMain,adoptPinSession,control,store,pauseForNativeOperation,provisionTopology,
    async markConfigurationRestored(id,isCurrent=()=>true) {return store.update(id,next=>{next.configurationAccess='restored';},isCurrent);},
    async prepareOwnerRecord(material,isCurrent,{existingPin=false}={}) {
      const record=await store.createInstallation(material.meshId,isCurrent);
      return existingPin ? store.update(material.meshId,next=>{next.configurationAccess='remote-pending';},isCurrent) : record;
    },
    getDeviceCredentials: async id => {const record=await store.load(id);if(!record)throw fail('TRUST_OWNER_REQUIRED','Herstel eerst je installatie met de pincode.');return {...record.device};},
    async hasTrustedMain(rid) {const cached=handles.get(context().meshId+':'+rid);if(cached?.temporaryPin)return cached.session.ownerSessionActive&&cached.isCurrent();const record=await store.load(context().meshId);return record?.receivers?.[rid]?.role==='MAIN';},
    async pendingClaim() {return (await store.load(context().meshId))?.pending || null;},
    registerNodeEnrollment(provider) {if(typeof provider?.enroll!=='function')throw fail('TRUST_NODE_ADAPTER','Ongeldige receiverinschrijving.');nodeEnrollment=provider;},
    async enrollNode(descriptor,options) {
      const provider=nodeEnrollment||window.AluvisionNodeEnrollment;
      if(!provider?.enroll)throw fail('TRUST_NODE_UNAVAILABLE','Veilige receiverinschrijving is nog niet beschikbaar.');
      const settings=context();
      const result=await provider.enroll(descriptor,{...options,store,ensure,installationId:settings.meshId,networkKey:settings.networkKey,mainRid:gateway.gatewayRid()});
      await provisionTopology(options);return result;
    }
  });
})();
