/* Exact-target bootstrap relay. The MAIN authenticates permission to relay;
 * the inner signed ECDH session authenticates/pins the selected NODE. Neither
 * discovered MAC addresses nor an unencrypted radio reply grant ownership. */
(() => {
  'use strict';
  const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
  const hex=bytes=>Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('').toUpperCase();
  const bytes=value=>Uint8Array.from(value.match(/../g)||[],part=>parseInt(part,16));
  const fail=(code,message)=>Object.assign(new Error(message),{code});
  const valid=(value,length)=>typeof value==='string'&&value.length===length&&/^[0-9A-F]+$/.test(value)&&!/^0+$/.test(value);
  const encode=fields=>Object.entries(fields).map(([key,value])=>{
    if(!/^[A-Z][A-Z0-9_]*$/.test(key)||/[;\x00-\x1F\x7F]/.test(String(value)))throw fail('BOOTSTRAP_FORMAT','Ongeldige receiveropdracht.');
    return key+'='+value;
  }).join(';');
  const parse=text=>window.AluvisionDeviceTrust.parseFields(text);
  const sha=async data=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',data)));
  function relay({main,rid,mac,isCurrent=()=>true}) {
    if(!valid(rid,16)||!valid(mac,12)||!main?.session?.ownerSessionActive||main.rid===rid)throw fail('BOOTSTRAP_TARGET','Kies een bereikbare extra receiver.');
    let busy=false,sequence=crypto.getRandomValues(new Uint32Array(1))[0]||1;
    return async frame=>{
      if(busy)throw fail('BOOTSTRAP_BUSY','De gekozen receiver verwerkt nog een beveiligde stap.');
      if(!['TRUST_HELLO','TRUST_AUTH','SECURE_OWNER'].includes(frame?.TYPE)||frame.TARGET!==rid)throw fail('BOOTSTRAP_SCOPE','Deze opdracht mag niet via de koppelverbinding worden verstuurd.');
      const wire=enc.encode(encode({V:18,...frame,ID:frame.ID??(sequence=sequence===0xFFFFFFFF?1:sequence+1)}));
      if(wire.length<1||wire.length>4096)throw fail('BOOTSTRAP_SIZE','De beveiligde receiveropdracht is te groot.');
      const tx=hex(crypto.getRandomValues(new Uint8Array(8))),deadline=Date.now()+10000;
      if(!valid(tx,16))throw fail('BOOTSTRAP_RANDOM','De koppelverbinding kon niet veilig worden voorbereid.');
      const check=()=>{if(!isCurrent()||!main.isCurrent()||!main.session.ownerSessionActive||Date.now()>=deadline)throw fail('BOOTSTRAP_INTERRUPTED','De koppelverbinding is onderbroken. De bestaande installatie blijft behouden.');};
      async function command(action,payload) {
        check();const result=parse(await main.session.ownerCommand(action,encode(payload),main.transact));check();
        if(result.STATUS!=='OK')throw fail(result.DETAIL==='PROXY_RESULT_UNCERTAIN'?'BOOTSTRAP_RESULT_UNCERTAIN':'BOOTSTRAP_REJECTED','De receiver heeft deze beveiligde stap niet bevestigd. Controleer de verbinding; de opgeslagen gegevens blijven behouden.');
        if(result.TX!==tx)throw fail('BOOTSTRAP_REPLY','De bevestiging hoort niet bij deze receiveraanvraag.');
        return result;
      }
      function ready(reply,next) {
        if(reply.DETAIL!=='PROXY_READY'||reply.MAIN!==rid||Number(reply.NEXT)!==next||!/^[0-4]$/.test(reply.STATE||''))throw fail('BOOTSTRAP_REPLY','De receiver bevestigde niet de juiste koppelstap.');
      }
      busy=true;
      try {
        const digest=await sha(wire);check();
        let reply=await command('BOOTSTRAP_BEGIN',{TX:tx,NODE:rid,MAC:mac,TOTAL:wire.length,HASH:digest});ready(reply,0);
        for(let offset=0;offset<wire.length;offset+=512) {
          const part=wire.subarray(offset,offset+512);reply=await command('BOOTSTRAP_PART',{TX:tx,OFF:offset,DATA:hex(part)});ready(reply,offset+part.length);
        }
        do {
          reply=await command('BOOTSTRAP_COMMIT',{TX:tx});ready(reply,wire.length);
          if(reply.STATE==='3')break;
          if(reply.STATE!=='2')throw fail('BOOTSTRAP_RESULT_UNCERTAIN','De receiveruitkomst is nog niet zeker. Controleer de status opnieuw.');
          await new Promise(resolve=>setTimeout(resolve,75));
        } while(Date.now()<deadline);
        const length=Number(reply.REPLYBYTES),expected=reply.REPLYHASH;
        if(reply.STATE!=='3'||!Number.isInteger(length)||length<1||length>4096||!valid(expected,64))throw fail('BOOTSTRAP_REPLY','Het beveiligde receiverantwoord is onvolledig.');
        const out=new Uint8Array(length);
        for(let offset=0;offset<length;offset+=512) {
          const size=Math.min(512,length-offset),part=await command('BOOTSTRAP_READ',{TX:tx,OFF:offset,LEN:size});
          if(part.DETAIL!=='PROXY_DATA'||Number(part.OFF)!==offset||!new RegExp('^[0-9A-F]{'+size*2+'}$').test(part.DATA||''))throw fail('BOOTSTRAP_REPLY','Een deel van het receiverantwoord ontbreekt.');
          out.set(bytes(part.DATA),offset);
        }
        if(await sha(out)!==expected)throw fail('BOOTSTRAP_REPLY','De integriteitscontrole van het receiverantwoord is mislukt.');
        check();return parse(dec.decode(out));
      } finally {busy=false;}
    };
  }
  async function enroll(descriptor,{store,ensure,isCurrent=()=>true,installationId,networkKey,mainRid}) {
    const rid=String(descriptor.rid||'').toUpperCase(),record=await store.load(installationId);
    if(!record||record.receivers[mainRid]?.role!=='MAIN'||rid===mainRid)throw fail('NODE_MAIN_REQUIRED','Koppel eerst je hoofdreceiver.');
    const existing=record.receivers[rid],usedNumbers=new Set(Object.values(record.receivers).filter(value=>value.rid!==rid).map(value=>Number(value.number)||1));
    let number=Number(existing?.number)||Number(descriptor.number)||2;
    if(!Number.isInteger(number)||number<2||number>250||usedNumbers.has(number))number=Array.from({length:249},(_,i)=>i+2).find(value=>!usedNumbers.has(value));
    if(!number)throw fail('NODE_NUMBER','Er is geen vrije receiverplaats beschikbaar.');
    const check=()=>{if(!isCurrent())throw fail('NODE_CANCELLED','Receiver toevoegen geannuleerd. De bestaande installatie blijft behouden.');};
    check();const main=await ensure(mainRid,{installationId,isCurrent}),node=await ensure(rid,{installationId,allowBlank:true,isCurrent});check();
    if(node.trustState!=='BLANK') {
      const saved=existing?.role==='NODE'?existing.admission:record.pending?.type==='claim-node'&&record.pending.rid===rid?record.pending.admission:null;
      if(saved) {
        const status=parse(await node.session.ownerCommand('CLAIM_STATUS','QUERY=1',node.transact));check();
        if(status.STATUS!=='OK'||status.DETAIL!=='CLAIM_STATUS'||status.RID!==rid||status.PHYSID!==saved.PHYSID||status.DEVICEKEY!==saved.DEVICEKEY||status.DEVTYPE!==node.descriptor.receiverType||status.ROLE!=='NODE'||status.MESHID!==installationId||status.NETWORK!==networkKey||status.MAIN!==mainRid||status.MAINMAC!==saved.MAINMAC||status.APPKEY!==saved.APPKEY||status.NUMBER!==saved.NUMBER)throw fail('NODE_CLAIM_UNCERTAIN','De receiver bevestigde niet de opgeslagen inrichting. Er is niets vervangen.');
        await store.update(installationId,next=>{next.receivers[rid]={...next.receivers[rid],role:'NODE',number:Number(saved.NUMBER),mainRid,admission:saved};if(next.pending?.rid===rid)next.pending=null;},isCurrent);
        return {STATUS:'OK',DETAIL:'MESH_PAIRED',TARGETACK:'1',TARGETRID:rid,RID:rid,DEVTYPE:node.descriptor.receiverType,MESHROLE:'NODE',MESHROUTING:'1',NUMBER:Number(saved.NUMBER)};
      }
      throw fail('NODE_CLAIM_UNCERTAIN','Deze receiver heeft mogelijk al toegang gekregen. Controleer de bewaarde inrichting; voeg hem niet als nieuwe hoofdreceiver toe.');
    }
    const signer=await store.signer(installationId),expected={INSTALLATION:installationId,NETWORK:networkKey,MAIN:mainRid,MAINMAC:main.descriptor.mac,MAINKEY:main.descriptor.publicKey,
      NODE:rid,PHYSID:node.descriptor.mac,DEVICEKEY:node.descriptor.publicKey,APPKEY:signer.publicKey,NUMBER:String(number),NONCE:node.nonce};
    const reply=parse(await main.session.ownerCommand('AUTHORIZE_NODE',encode({NODE:rid,PHYSID:expected.PHYSID,DEVICEKEY:expected.DEVICEKEY,APPKEY:expected.APPKEY,NUMBER:number,NONCE:expected.NONCE}),main.transact));check();
    if(reply.STATUS!=='OK'||Object.entries(expected).some(([key,value])=>reply[key]!==value)||!valid(reply.SIGNATURE,128))throw fail('NODE_ADMISSION','De hoofdreceiver bevestigde niet deze exacte extra receiver.');
    const transcript='ALUVISION-NODE-ADMISSION-V1|'+Object.entries(expected).map(([key,value])=>key+'='+value).join('|');
    const publicKey=await crypto.subtle.importKey('raw',bytes(expected.MAINKEY),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,bytes(reply.SIGNATURE),enc.encode(transcript)))throw fail('NODE_ADMISSION','De handtekening van je hoofdreceiver klopt niet.');
    check();const admission={...expected,SIGNATURE:reply.SIGNATURE};
    await store.update(installationId,next=>{
      if(next.pending&&(next.pending.type!=='claim-node'||next.pending.rid!==rid))throw fail('NODE_PENDING','Rond eerst de bewaarde receiverinrichting af.');
      // A fresh signed BLANK state proves the previous admission did not
      // commit. Only then replace its nonce-bound pending certificate.
      next.pending={type:'claim-node',rid,number,admission};
    },isCurrent);check();
    const claimed=parse(await node.session.ownerCommand('CLAIM_NODE',encode(admission),node.transact));check();
    if(claimed.STATUS!=='OK'||claimed.DETAIL!=='CLAIM_NODE_READY'||claimed.RID!==rid||claimed.PHYSID!==expected.PHYSID||claimed.DEVTYPE!==node.descriptor.receiverType||claimed.DEVICEKEY!==expected.DEVICEKEY||claimed.MESHID!==installationId||claimed.ROLE!=='NODE'||claimed.MAIN!==mainRid||Number(claimed.NUMBER)!==number)throw fail('NODE_CLAIM_UNCERTAIN','De extra receiver heeft de inrichting nog niet volledig bevestigd. De herstelgegevens blijven bewaard.');
    await store.update(installationId,next=>{next.receivers[rid]={...next.receivers[rid],role:'NODE',number,mainRid,admission};next.pending=null;},isCurrent);
    node.session.close();
    return {STATUS:'OK',DETAIL:'MESH_PAIRED',TARGETACK:'1',TARGETRID:rid,RID:rid,DEVTYPE:node.descriptor.receiverType,MESHROLE:'NODE',MESHROUTING:'1',NUMBER:number};
  }
  window.AluvisionNodeEnrollment=Object.freeze({relay,enroll});
})();
