/* Explicit receiver removal, separate from disconnect, deleting a port or
 * deleting the app. A stored intent survives a lost ACK and a receiver reboot.
 * Only the pinned device's signed, fresh release receipt permits local removal. */
(() => {
  'use strict';
  const hex = value => Array.from(value,n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
  const bytes = value => Uint8Array.from(value.match(/../g)||[],n=>parseInt(n,16));
  const valid = (value,length) => typeof value==='string' && value.length===length && /^[0-9A-F]+$/.test(value) && !/^0+$/.test(value);
  const fail = (code,message) => Object.assign(new Error(message),{code});
  const encode = value => Object.entries(value).map(([key,item])=>key+'='+item).join(';');
  const clone = value => JSON.parse(JSON.stringify(value));
  function create({secure,gateway,crypto=globalThis.crypto}={}) {
    let busy=false;
    const parse=window.AluvisionDeviceTrust.parseFields;
    async function inspect(rid,{isCurrent=()=>true}={}) {
      const context=gateway.installationContext(),id=context.meshId;
      const current=()=>isCurrent()&&gateway.installationContext().meshId===id&&gateway.installationContext().networkKey===context.networkKey;
      const check=()=>{if(!current())throw fail('RELEASE_CANCELLED','Verwijderen geannuleerd. Je receiver blijft bewaard.');};
      check();
      let record=await secure.store.load(id);check();
      const pending=record?.pendingRelease||(!record?.receivers?.[rid]&&record?.releaseReceipts?.[rid]);
      if(pending){validate(pending,id,rid);return {id,pending,descriptor:pending.descriptor,mainRid:pending.mainRid,mode:pending.mode||'OWNED'};}
      if(!gateway.isReady())throw fail('RELEASE_CONNECT','Maak eerst verbinding met je receiver. Daarna kun je hem verwijderen.');
      // A lost CLAIM_MAIN acknowledgement may have left a durable intent.
      // Reconcile it through the existing authenticated claim proof only.
      if(record?.pending?.type==='claim-main'&&record.pending.rid===rid&&gateway.gatewayRid()===rid&&secure.recoverPendingMain){
        await secure.recoverPendingMain({isCurrent:current});check();record=await secure.store.load(id);check();
      }
      if(record?.pending)throw fail('RELEASE_SETUP_PENDING','De inrichting is nog niet afgerond. Rond eerst deze koppeling af; er is niets verwijderd.');
      const source=record?.receivers?.[rid],main=Object.values(record?.receivers||{}).find(item=>item.role==='MAIN');
      if(source&&['MAIN','NODE'].includes(source.role)&&main)
        return {id,descriptor:clone(source),sourceDescriptor:clone(source),mainRid:main.rid,mode:'OWNED'};
      if(gateway.gatewayRid()!==rid)throw fail('RELEASE_CONNECT','Verbind met deze receiver om de oude koppeling te verwijderen.');
      // The old PIN-free app model is not proof of ownership. A narrow
      // firmware check inside the pinned channel must prove the same retained
      // test installation. Never turn its PENDING descriptor into a MAIN.
      if(!valid(context.networkKey,16))throw fail('RELEASE_PIN_REQUIRED','Verbind eerst met je installatie via je PIN. Je receiver blijft bewaard.');
      const handle=await secure.ensure(rid,{allowBlank:true,installationId:id,isCurrent:current});check();
      if(handle.trustState!=='BLANK')throw fail('RELEASE_PIN_REQUIRED','Deze receiver is beveiligd. Verbind eerst met je installatie-PIN.');
      const reply=parse(await handle.session.ownerCommand('RELEASE_CHECK',encode({TARGET:rid,PORT:0,INSTALLATION:id,NETWORK:context.networkKey}),handle.transact));check();
      if(reply.STATUS!=='OK'||reply.DETAIL!=='RELEASE_CHECK')throw fail('RELEASE_FIRMWARE_REQUIRED','Voor het verwijderen van deze oude koppeling is de nieuwste receiverfirmware nodig. Je receiver blijft bewaard.');
      const d=handle.descriptor;
      if(reply.RID!==rid||reply.PHYSID!==d?.mac||reply.DEVTYPE!==d?.receiverType||reply.DEVICEKEY!==d?.publicKey||
         reply.INSTALLATION!==id||reply.NETWORK!==context.networkKey||reply.RELEASEMODE!=='LEGACY'||reply.ROLE!=='MAIN'||reply.MAIN!==rid||reply.PINSET!=='0')
        throw fail('RELEASE_IDENTITY','De receiver bevestigt niet dezelfde installatie. Er is niets verwijderd.');
      if(reply.RELEASABLE!=='1')throw fail(reply.BLOCKER==='RELEASE_REMOVE_NODES_FIRST'?'RELEASE_MAIN_HAS_NODES':'RELEASE_BLOCKED',
        reply.BLOCKER==='RELEASE_REMOVE_NODES_FIRST'?'Verwijder eerst de andere receivers. Je hoofdreceiver blijft bewaard.':'De receiver kan nu niet worden verwijderd. Wacht tot andere wijzigingen klaar zijn en probeer opnieuw.');
      record=await secure.store.load(id);check();
      const saved=record?.receivers?.[rid];
      if(record?.pending||record?.pendingRelease||Object.values(record?.receivers||{}).some(item=>['MAIN','NODE'].includes(item.role))||
         !saved||saved.role!=='PENDING'||saved.rid!==rid||saved.mac!==d.mac||saved.publicKey!==d.publicKey||saved.receiverType!==d.receiverType)
        throw fail('RELEASE_CHANGED','De koppeling is intussen gewijzigd. Open de receiver opnieuw.');
      return {id,descriptor:{...clone(saved),role:'MAIN'},sourceDescriptor:clone(saved),mainRid:rid,mode:'LEGACY',legacyNetwork:context.networkKey};
    }
    function validate(pending,id,rid) {
      if(!pending || pending.installationId!==id || pending.rid!==rid || !valid(id,8) || !valid(rid,16) ||
         !valid(pending.transaction,16) || !valid(pending.mainRid,16) || pending.descriptor?.rid!==rid ||
         !valid(pending.descriptor.publicKey,130) || !valid(pending.descriptor.mac,12) ||
         !['SPI','RGBW'].includes(pending.descriptor.receiverType) || !['MAIN','NODE'].includes(pending.descriptor.role) ||
         pending.mode!==undefined&&!['LEGACY','OWNED'].includes(pending.mode) ||
         pending.mode==='LEGACY'&&(!valid(pending.legacyNetwork,16)||pending.mainRid!==rid||pending.descriptor.role!=='MAIN'||
           pending.sourceDescriptor?.role!=='PENDING'||pending.sourceDescriptor.rid!==rid||
           pending.sourceDescriptor.mac!==pending.descriptor.mac||pending.sourceDescriptor.publicKey!==pending.descriptor.publicKey||
           pending.sourceDescriptor.receiverType!==pending.descriptor.receiverType))
        throw fail('RELEASE_RECORD','De bewaarde verwijdering klopt niet. Er is niets gewist.');
      return pending;
    }
    async function status(pending) {
      validate(pending,pending.installationId,pending.rid);
      if(gateway.gatewayRid()!==pending.rid || !gateway.isReady())
        throw fail('RELEASE_CONNECT','Verbind met deze receiver om de verwijdering te controleren.');
      const nonce=hex(crypto.getRandomValues(new Uint8Array(16)));
      const reply=await gateway.transactRaw({V:18,TYPE:'RELEASE_STATUS',TARGET:pending.rid,TXN:pending.transaction,CNONCE:nonce},{timeout:8000});
      const d=pending.descriptor;
      if(reply.STATUS!=='OK'||reply.DETAIL!=='RECEIVER_RELEASED'||reply.RID!==pending.rid||reply.PHYSID!==d.mac||
         reply.DEVTYPE!==d.receiverType||reply.INSTALLATION!==pending.installationId||reply.MAIN!==pending.mainRid||
         reply.TXN!==pending.transaction||reply.CNONCE!==nonce||reply.CURRENT!=='1'||reply.PINSET!=='0'||
         reply.DEVICEKEY!==d.publicKey||!valid(reply.SIGNATURE,128))
        throw fail('RELEASE_UNCONFIRMED','De receiver heeft het wissen van de koppeling nog niet bevestigd. Je gegevens blijven bewaard.');
      const text='ALUVISION-RELEASE-V1|RID='+reply.RID+'|PHYSID='+reply.PHYSID+'|TYPE='+reply.DEVTYPE+
        '|INSTALLATION='+reply.INSTALLATION+'|MAIN='+reply.MAIN+'|TXN='+reply.TXN+'|CNONCE='+nonce+'|CURRENT=1|PINSET=0';
      const key=await crypto.subtle.importKey('raw',bytes(d.publicKey),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
      if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,bytes(reply.SIGNATURE),new TextEncoder().encode(text)))
        throw fail('RELEASE_SIGNATURE','De veilige bevestiging klopt niet. Er is niets uit de app verwijderd.');
      await secure.store.update(pending.installationId,next=>{
        const saved=next.pendingRelease?.rid===pending.rid?next.pendingRelease:next.releaseReceipts?.[pending.rid];
        if(saved?.transaction!==pending.transaction||saved.rid!==pending.rid||saved.mainRid!==pending.mainRid||
           saved.installationId!==pending.installationId||JSON.stringify(saved.descriptor)!==JSON.stringify(pending.descriptor))throw fail('RELEASE_CHANGED','De verwijdering is gewijzigd.');
        saved.verified=true;
      });
      return {confirmed:true,rid:pending.rid,installationId:pending.installationId,role:d.role};
    }
    async function revokeNode(pending) {
      if(pending.descriptor.role!=='NODE'||pending.mainRevoked)return;
      if(gateway.gatewayRid()!==pending.mainRid)throw fail('RELEASE_MAIN_CONNECT','Verbind eerst met de hoofdreceiver om deze receiver uit het netwerk te halen.');
      const main=await secure.ensure(pending.mainRid);
      const response=parse(await main.session.ownerCommand('MESH_PEER_REVOKE',encode({TXN:pending.transaction,
        TARGET:pending.rid,MAC:pending.descriptor.mac,IFREV:pending.meshRevision}),main.transact));
      if(response.STATUS!=='OK'||response.DETAIL!=='MESH_PEER_REVOKED'||response.TARGETRID!==pending.rid||
         response.TARGETMAC!==pending.descriptor.mac||response.TX!==pending.transaction||response.REVOCATIONACK!=='1'||
         Number(response.REV)!==pending.meshRevision+1||!valid(response.DIGEST,64))
        throw fail('RELEASE_MAIN_UNCONFIRMED','De hoofdreceiver heeft het loskoppelen nog niet bevestigd. Controleer opnieuw.');
      await secure.store.update(pending.installationId,next=>{
        if(next.pendingRelease?.transaction!==pending.transaction)throw fail('RELEASE_CHANGED','De verwijdering is gewijzigd.');
        next.pendingRelease.mainRevoked=true;
      });
      pending.mainRevoked=true;
    }
    async function prepare(pending,isCurrent=()=>true,{freshAttempt=false}={}) {
      const handle=await secure.ensure(pending.rid,{isCurrent,allowBlank:pending.mode==='LEGACY',installationId:pending.installationId});
      if(!isCurrent())throw fail('RELEASE_CANCELLED','Verwijderen geannuleerd.');
      // An explicit retry reuses the durable transaction, never a new release.
      // Firmware repeats ACCEPTED for this exact intent without another erase.
      const response=parse(await handle.session.ownerCommand('RELEASE_RECEIVER',encode({TARGET:pending.rid,INSTALLATION:pending.installationId,PORT:0,
        TXN:pending.transaction,CONFIRM:pending.descriptor.role==='MAIN'?'REMOVE_INSTALLATION':'REMOVE_RECEIVER',
        ...(pending.mode==='LEGACY'?{LOCALTEST:1,NETWORK:pending.legacyNetwork}:{})}),handle.transact));
      if(response.STATUS==='ERROR') {
        const deniedBeforeWrite=new Set(['RELEASE_DENIED','RELEASE_AUTHORIZATION_REQUIRED','RELEASE_EXACT_TARGET_REQUIRED',
          'RELEASE_MODE_MISMATCH','RELEASE_CONFIRMATION_REQUIRED','RELEASE_ROLE_UNSUPPORTED','PIN_ROTATION_PENDING',
          'RELEASE_OTA_BUSY','RELEASE_COORDINATED_AUTHORITY_REQUIRED','RELEASE_SECURITY_STORAGE_REQUIRED','RELEASE_REMOVE_NODES_FIRST']);
        if(!freshAttempt||!deniedBeforeWrite.has(response.DETAIL))
          throw fail('RELEASE_UNCONFIRMED','De verwijdering wordt nog gecontroleerd. De bewaarde opdracht blijft behouden.');
        await secure.store.update(pending.installationId,next=>{if(next.pendingRelease?.transaction===pending.transaction)delete next.pendingRelease;});
        throw fail('RELEASE_REJECTED','De receiver staat verwijderen nog niet toe. Controleer of andere receivers nog gekoppeld zijn en probeer opnieuw.');
      }
      if(response.STATUS!=='ACCEPTED'||response.DETAIL!=='RELEASE_PREPARED'||response.RID!==pending.rid||response.INSTALLATION!==pending.installationId||response.TXN!==pending.transaction)
        throw fail('RELEASE_UNCONFIRMED','De receiver heeft de verwijdering nog niet bevestigd. Controleer opnieuw.');
      await secure.store.update(pending.installationId,next=>{
        if(next.pendingRelease?.transaction!==pending.transaction)throw fail('RELEASE_CHANGED','De verwijdering is gewijzigd.');
        next.pendingRelease.prepared=true;
      });
      pending.prepared=true;
    }
    async function remove(rid,{confirmMain=false,isCurrent=()=>true}={}) {
      if(busy)throw fail('RELEASE_BUSY','De verwijdering wordt al gecontroleerd.');
      busy=true;
      try {
        const originalCurrent=isCurrent,context=gateway.installationContext();
        isCurrent=()=>originalCurrent()&&gateway.installationContext().meshId===context.meshId&&gateway.installationContext().networkKey===context.networkKey;
        const info=await inspect(rid,{isCurrent}),id=info.id;
        let record=await secure.store.load(id),pending=info.pending;
        if(!isCurrent())throw fail('RELEASE_CANCELLED','Verwijderen geannuleerd.');
        if(pending){
          validate(pending,id,rid);
          if(!pending.prepared&&!pending.verified) {
            // The first ACK may have been lost just before restart. A signed
            // final receipt proves completion; absence is never proof of it.
            if(gateway.gatewayRid()===rid) {
              try {await status(pending);pending.verified=true;}
              catch(error){if(error.code==='RELEASE_SIGNATURE')throw error;}
            }
            if(!pending.verified)await prepare(pending,isCurrent);
          }
          if(pending.descriptor.role==='NODE'&&!pending.mainRevoked)await revokeNode(pending);
          return await status(pending);
        }
        const descriptor=info.descriptor,main={rid:info.mainRid};
        if(!isCurrent())throw fail('RELEASE_CANCELLED','Verwijderen geannuleerd.');
        if(record.pending)throw fail('RELEASE_SETUP_PENDING','Rond eerst het toevoegen van je receiver af.');
        if(descriptor.role==='MAIN' && !confirmMain)throw fail('RELEASE_CONFIRM_MAIN','Bevestig eerst dat je de hoofdreceiver wilt verwijderen.');
        if(descriptor.role==='MAIN' && (Object.keys(record.receivers).some(key=>key!==rid)||
            (gateway.installationReceiverRids?.()||[]).some(key=>key!==rid)))
          throw fail('RELEASE_MAIN_HAS_NODES','Verwijder eerst de andere receivers. Zo blijft geen receiver zonder hoofdreceiver achter.');
        let meshRevision;
        if(descriptor.role==='NODE') {
          if(gateway.gatewayRid()!==main.rid)throw fail('RELEASE_MAIN_CONNECT','Verbind eerst met je hoofdreceiver.');
          const owner=await secure.ensure(main.rid,{isCurrent});
          const topology=parse(await owner.session.ownerCommand('MESH_SECURE_STATUS','QUERY=STATUS',owner.transact));
          meshRevision=Number(topology.REV);
          if(topology.STATUS!=='OK'||topology.SELFRID!==main.rid||topology.INSTALLATION!==id||topology.MESHSEC!=='AUTHENTICATED_LINKS'||
             !Number.isSafeInteger(meshRevision)||meshRevision<1||meshRevision>=0xFFFFFFFF)
            throw fail('RELEASE_NETWORK','De beveiligde netwerkverbinding is nog niet bevestigd. De receiver is niet verwijderd.');
        }
        await secure.ensure(rid,{isCurrent,allowBlank:info.mode==='LEGACY',installationId:id});
        if(!isCurrent())throw fail('RELEASE_CANCELLED','Verwijderen geannuleerd.');
        pending={rid,installationId:id,mainRid:main.rid,transaction:hex(crypto.getRandomValues(new Uint8Array(8))),descriptor:clone(descriptor),verified:false,
          ...(info.mode==='LEGACY'?{mode:'LEGACY',legacyNetwork:info.legacyNetwork,sourceDescriptor:info.sourceDescriptor}:{}),
          ...(descriptor.role==='NODE'?{meshRevision,mainRevoked:false}:{})};
        await secure.store.update(id,next=>{
          if(next.pendingRelease||next.pending||JSON.stringify(next.receivers[rid])!==JSON.stringify(info.sourceDescriptor)||
             descriptor.role==='MAIN'&&(Object.keys(next.receivers).some(key=>key!==rid)||
               (gateway.installationReceiverRids?.()||[]).some(key=>key!==rid)))throw fail('RELEASE_CHANGED','De receiver is intussen gewijzigd.');
          next.pendingRelease=clone(pending);
        },isCurrent);
        await prepare(pending,isCurrent,{freshAttempt:true});
        await revokeNode(pending);
        return {confirmed:false,pending:true,rid};
      } finally {busy=false;}
    }
    async function complete(rid) {
      const id=gateway.installationContext().meshId,record=await secure.store.load(id),pending=validate(record?.pendingRelease || (!record?.receivers?.[rid] && record?.releaseReceipts?.[rid]),id,rid);
      if(!pending.verified||pending.descriptor.role==='NODE'&&!pending.mainRevoked)throw fail('RELEASE_UNCONFIRMED','De veilige verwijdering is nog niet bevestigd.');
      await secure.store.update(id,next=>{
        // Recheck under the journal's serialized update: a fresh claim may
        // have appeared after load, while an old receipt was being resumed.
        const activePending=next.pendingRelease?.rid===rid?next.pendingRelease:null;
        if(next.pendingRelease&&!activePending || !activePending&&next.receivers[rid])
          throw fail('RELEASE_CHANGED','De receiver is intussen opnieuw gekoppeld of de verwijdering is gewijzigd.');
        const saved=activePending||next.releaseReceipts?.[rid];
        if(saved?.transaction!==pending.transaction||!saved.verified)throw fail('RELEASE_CHANGED','De verwijdering is gewijzigd.');
        next.releaseReceipts||={};next.releaseReceipts[rid]=clone(saved);
        delete next.receivers[rid];delete next.pendingRelease;
        if(pending.descriptor.role==='MAIN'){next.pending=null;delete next.configurationAccess;delete next.recoveryKeyToSave;}
      });
      return {confirmed:true};
    }
    async function finish(rid,{isCurrent=()=>true,timeoutMs=25000}={}) {
      const context=gateway.installationContext(),id=context.meshId,deadline=Date.now()+timeoutMs;
      const current=()=>isCurrent()&&gateway.installationContext().meshId===id&&gateway.installationContext().networkKey===context.networkKey;
      let reconnected=false;
      while(Date.now()<deadline&&current()){
        const record=await secure.store.load(id),pending=record?.pendingRelease||record?.releaseReceipts?.[rid];
        validate(pending,id,rid);
        if(!current())break;
        try{return await status(pending);}catch(error){
          if(['RELEASE_SIGNATURE','RELEASE_CHANGED','RELEASE_RECORD'].includes(error.code))throw error;
        }
        if(!current())break;
        if(!reconnected&&typeof gateway.reconnectReleased==='function'){
          reconnected=true;
          try{await gateway.reconnectReleased(rid);}catch(_){}
        }
        await new Promise(resolve=>setTimeout(resolve,650));
      }
      if(!current())throw fail('RELEASE_CANCELLED','De verwijdering blijft bewaard. Open deze receiver om verder te controleren.');
      throw fail('RELEASE_WAITING','De receiver wordt nog gecontroleerd. Zodra hij opnieuw bereikbaar is, kun je hier veilig verdergaan.');
    }
    return Object.freeze({inspect,remove,status,complete,finish});
  }
  window.AluvisionReceiverRelease=Object.freeze({create});
  if(!window.AluvisionSecureConnection||!window.AluvisionNativeWifi)return;
  const release=create({secure:window.AluvisionSecureConnection,gateway:window.AluvisionNativeWifi});
  let prompt=null;
  const safe=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  async function open(id) {
    const device=(db.devices||[]).find(item=>item.id===id);if(!device)return;
    const context=window.AluvisionNativeWifi.installationContext();
    const token={id,rid:String(device.rid||'').toUpperCase(),confirmed:false,context};prompt=token;
    token.isCurrent=()=>prompt===token&&token.root?.isConnected&&
      window.AluvisionNativeWifi.installationContext().meshId===context.meshId&&
      window.AluvisionNativeWifi.installationContext().networkKey===context.networkKey;
    modal(`<section data-receiver-release><div class="eyebrow">RECEIVER VERWIJDEREN</div><h1>${safe(window.customerDeviceName?.(device)||device.name)} verwijderen?</h1><div data-release-details></div><p id="v21ReleaseStatus" role="status">Koppeling controleren…</p><div class="row"><button class="button soft" onclick="closeModal()">Terug</button><button class="button red" disabled data-release-submit onclick="v21ConfirmReceiverRelease()">Receiver verwijderen</button></div><div data-release-recovery></div></section>`);
    token.root=document.querySelector('[data-receiver-release]');
    try {
      const info=await release.inspect(token.rid,{isCurrent:token.isCurrent});
      if(!token.isCurrent())return;
      const main=info.descriptor.role==='MAIN',pending=Boolean(info.pending);token.main=main;token.pending=pending;
      token.root.querySelector('[data-release-details]').innerHTML=`<p class="danger-note">${main?
        (info.mode==='LEGACY'?'Dit is je hoofdreceiver. Je koppeling wordt verwijderd. Op deze oude koppeling staat nog geen PIN.':'Dit is je hoofdreceiver. De koppeling en installatie-PIN op deze receiver worden verwijderd.'):
        'Deze receiver wordt losgekoppeld. Je andere receivers en hun instellingen blijven behouden.'}</p>${main?'<p class="sub">Andere receivers nog gekoppeld? Verwijder die eerst. Er wordt nooit automatisch een andere receiver gewist.</p>':''}${main&&!pending?'<label class="v20-show-code"><input id="v21ReleaseConfirm" type="checkbox"><span>Ik wil deze hoofdreceiver verwijderen.</span></label>':''}`;
      token.root.querySelector('#v21ReleaseStatus').textContent=pending?'De vorige verwijdering wordt hervat.':'Na bevestigen handelt de app de verwijdering automatisch af.';
      const button=token.root.querySelector('[data-release-submit]');button.disabled=false;button.textContent=pending?'Verwijdering hervatten':'Receiver verwijderen';
    }catch(error){if(token.isCurrent())showRecovery(token,error);}
  }
  function showRecovery(active,error){
    if(!active.isCurrent())return;
    active.root.querySelector('#v21ReleaseStatus').textContent=error?.message||'De verbinding is niet beschikbaar. Je receiver blijft bewaard.';
    const target=active.root.querySelector('[data-release-recovery]');target.replaceChildren();
    const action=document.createElement('button');action.className='button soft';action.type='button';
    if(['RELEASE_PIN_REQUIRED','TRUST_OWNER_REQUIRED'].includes(error?.code)){
      action.textContent='Verbinden met mijn PIN';action.onclick=()=>{if(active.isCurrent())window.AluvisionAccountlessRecovery?.openExisting('connect');};
    }else if(error?.code==='RELEASE_SETUP_PENDING'){
      action.textContent='Koppeling afronden';action.onclick=()=>{if(active.isCurrent())window.startPairing?.(active.id);};
    }else if(error?.code==='RELEASE_FIRMWARE_REQUIRED'){
      return;
    }else{
      action.textContent='Opnieuw controleren';action.onclick=async()=>{
        if(!active.isCurrent())return;action.disabled=true;
        try{if(!window.AluvisionNativeWifi.isReady())await window.AluvisionNativeWifi.connect({interactive:false});
          if(active.isCurrent())await open(active.id);
        }catch(next){if(active.isCurrent()){action.disabled=false;active.root.querySelector('#v21ReleaseStatus').textContent=next.message;}}
      };
    }
    target.append(action);
  }
  window.requestDeleteDevice=id=>open(id).catch(()=>window.toast?.('Verbind eerst met je installatie. Je receiver is niet verwijderd.'));
  window.v21ConfirmReceiverRelease=async()=>{
    const active=prompt;if(!active||!active.root?.isConnected||active.busy)return {confirmed:false};
    if(active.main&&!active.pending&&!document.getElementById('v21ReleaseConfirm')?.checked){window.toast?.('Bevestig eerst het verwijderen van de hoofdreceiver.');return {confirmed:false};}
    active.busy=true;active.root.setAttribute('aria-busy','true');const button=active.root.querySelector('[data-release-submit]');if(button)button.disabled=true;
    const show=text=>{const status=active.root.querySelector('#v21ReleaseStatus');if(status)status.textContent=text;};
    try {
      show('Verwijdering veilig controleren…');
      let result;
      try{result=await release.remove(active.rid,{confirmMain:active.main,isCurrent:active.isCurrent});}
      catch(error){
        if(!active.isCurrent())throw error;
        const record=await window.AluvisionSecureConnection.store.load(active.context.meshId);
        if(!active.isCurrent()||record?.pendingRelease?.rid!==active.rid||
           ['RELEASE_SIGNATURE','RELEASE_RECORD','RELEASE_CHANGED','RELEASE_CANCELLED'].includes(error.code))throw error;
        // The radio ACK can disappear just before the reboot. Check the same
        // durable intent automatically; never send another erase blindly.
        result={confirmed:false,pending:true};
      }
      if(!active.isCurrent())return {confirmed:false,pending:true};
      active.pending=true;
      if(!result.confirmed){show('De receiver start opnieuw. De app rondt het verwijderen automatisch af…');
        if(button)button.textContent='Bezig met verwijderen…';
        result=await release.finish(active.rid,{isCurrent:active.isCurrent});
      }
      if(!active.isCurrent())return {confirmed:false,pending:true};
      // Keep an idempotent private receipt before updating the public model;
      // a crash between these writes can resume without forgetting the proof.
      await release.complete(active.rid);
      if(!active.isCurrent())return {confirmed:false,pending:true};
      // Remove only the confirmed physical receiver, never siblings/other ports
      // of another device.
      (db.installations||[]).forEach(location=>{
        (location.zones||[]).forEach(zone=>(zone.groups||[]).forEach(group=>{
          group.receivers=(group.receivers||[]).filter(line=>line.deviceId!==active.id);if(!group.receivers.length)group.receiverType=null;
        }));
        if(location.security?.primaryReceiverId===active.id)location.security={recoveryConfigured:false};
      });
      db.devices=(db.devices||[]).filter(device=>device.id!==active.id);save();
      // The confirmed local removal must not wait for an optional host mirror:
      // a late host response may otherwise close a newly opened screen.
      try {Promise.resolve(window.api?.('/api/forget',{rid:active.rid})).catch(()=>{});} catch (_) {}
      prompt=null;closeModal();render();window.toast?.('Receiver verwijderd · opnieuw toevoegen vraagt een nieuwe koppeling');
      return result;
    }catch(error){if(active.isCurrent()){showRecovery(active,error);if(button)button.textContent=active.pending?'Verwijdering hervatten':'Receiver verwijderen';}return {confirmed:false};}
    finally{active.busy=false;active.root.removeAttribute('aria-busy');if(button)button.disabled=false;}
  };
  // Every receiver-wide delete entry must use the explicit confirmation UI.
  window.deleteDevice=id=>open(id);
})();
