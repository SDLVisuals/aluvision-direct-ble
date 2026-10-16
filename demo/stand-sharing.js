/* Explicit sharing only. A link contains access credentials, never stand data.
 * No storage, networking, navigation, enrollment or code generation lives here. */
(function(root,factory){
  const cjs=typeof module==='object'&&module.exports;
  const api=factory(cjs?require('./stand-sharing-copy.js'):root.LightningStandSharingCopy);if(cjs)module.exports=api;else root.LightningStandSharing=api;
})(typeof globalThis==='object'?globalThis:this,function(SharingCopy){
  'use strict';
  if(!SharingCopy)throw new Error('Load stand-sharing-copy.js before stand-sharing.js');
  const VERSION=1,MAX_LINK=1024,keys='ssid,standCode,standId,version';
  const fail=code=>{throw Object.assign(Error(SharingCopy.t('sharingNotConfirmed','nl')),{code});};
  const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
  const utf8=value=>new TextEncoder().encode(value);
  function validate(value,expectedStandId){
    if(!plain(value)||Object.keys(value).sort().join(',')!==keys)fail('STAND_SHARE_INVALID');
    if(value.version!==VERSION)fail('STAND_SHARE_VERSION');
    if(typeof value.standId!=='string'||! /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value.standId)||
       expectedStandId!==undefined&&value.standId!==expectedStandId)fail('STAND_IDENTITY_UNCONFIRMED');
    if(typeof value.ssid!=='string'||utf8(value.ssid).length<1||utf8(value.ssid).length>32||/[\u0000-\u001f\u007f\ud800-\udfff]/u.test(value.ssid)||
       typeof value.standCode!=='string'||! /^[\x20-\x7e]{8,63}$/.test(value.standCode))fail('STAND_SHARE_INVALID');
    return {version:VERSION,standId:value.standId,ssid:value.ssid,standCode:value.standCode};
  }
  function encode64(data){
    let binary='';for(const byte of data)binary+=String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function format(value){return 'aluvision://stand?v=1#'+encode64(utf8(JSON.stringify(validate(value))));}
  function parse(input,expectedStandId){
    if(typeof input!=='string'||input.length>MAX_LINK)fail('STAND_SHARE_INVALID');
    const match=/^aluvision:\/\/stand\?v=([0-9]+)#([A-Za-z0-9_-]+)$/.exec(input.trim());
    if(!match)fail('STAND_SHARE_INVALID');if(match[1]!=='1')fail('STAND_SHARE_VERSION');
    let decoded,raw;
    try{const bytes=Uint8Array.from(atob(match[2].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
      if(encode64(bytes)!==match[2])fail('STAND_SHARE_INVALID');raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);decoded=JSON.parse(raw);
    }catch(_){fail('STAND_SHARE_INVALID');}
    const result=validate(decoded,expectedStandId);
    // Canonical form rejects duplicate JSON keys, extra fields, alternate
    // encodings and ambiguous versions; nothing is inferred from a URL host.
    if(JSON.stringify(result)!==raw)fail('STAND_SHARE_INVALID');return result;
  }
  function connection(value,expectedStandId){const data=validate(value,expectedStandId);return {ssid:data.ssid,standCode:data.standCode,expectedStandId:data.standId};}
  function available(services,capabilities){return capabilities?.simpleStandShare===true&&typeof services?.standSessionShare==='function';}
  async function obtain(services,capabilities,snapshot){
    if(!available(services,capabilities))fail('STAND_SHARE_UNAVAILABLE');
    if(!snapshot?.standId||!snapshot?.ssid)fail('STAND_NOT_CONNECTED');
    const value=validate(await services.standSessionShare({standId:snapshot.standId}),snapshot.standId);
    if(value.ssid!==snapshot.ssid)fail('STAND_IDENTITY_UNCONFIRMED');return value;
  }

  /* QR Code Model 2, byte mode, low ECC, versions 1–15, fixed valid mask 0.
   * Drawing/ECC algorithms adapted from Project Nayuki's MIT QR library:
   * https://github.com/nayuki/QR-Code-generator
   * Copyright (c) Project Nayuki. (MIT License)
   * Permission is hereby granted, free of charge, to any person obtaining a
   * copy of this software and associated documentation files (the "Software"),
   * to deal in the Software without restriction, including without limitation
   * the rights to use, copy, modify, merge, publish, distribute, sublicense,
   * and/or sell copies of the Software, and to permit persons to whom the
   * Software is furnished to do so, subject to the following conditions:
   * The above copyright notice and this permission notice shall be included
   * in all copies or substantial portions of the Software.
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
   * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
   * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
   * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
   * DEALINGS IN THE SOFTWARE. */
  function qr(value){
    const input=utf8(format(value)),ecc=[0,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22],blocks=[0,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6];
    const raw=v=>{let count=(16*v+128)*v+64;if(v>=2){const n=Math.floor(v/7)+2;count-=(25*n-10)*n-55;if(v>=7)count-=36;}return Math.floor(count/8);};
    let version=1;for(;version<=15;version++)if(input.length*8+4+(version<10?8:16)<=8*(raw(version)-ecc[version]*blocks[version]))break;
    if(version>15)fail('STAND_SHARE_TOO_LARGE');
    const size=4*version+17,capacity=raw(version)-ecc[version]*blocks[version],bits=[];
    const push=(value,count)=>{for(let i=count-1;i>=0;i--)bits.push((value>>>i)&1);};
    push(4,4);push(input.length,version<10?8:16);for(const byte of input)push(byte,8);
    push(0,Math.min(4,capacity*8-bits.length));while(bits.length%8)bits.push(0);
    const data=[];for(let i=0;i<bits.length;i+=8)data.push(bits.slice(i,i+8).reduce((value,bit)=>(value<<1)|bit,0));
    for(let pad=0;data.length<capacity;pad++)data.push(pad%2?0x11:0xec);
    const multiply=(x,y)=>{let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11d);z^=((y>>>i)&1)*x;}return z;};
    const divisor=Array(ecc[version]).fill(0);divisor[divisor.length-1]=1;let root=1;
    for(let i=0;i<divisor.length;i++){for(let j=0;j<divisor.length;j++){divisor[j]=multiply(divisor[j],root);if(j+1<divisor.length)divisor[j]^=divisor[j+1];}root=multiply(root,2);}
    const count=blocks[version],short=Math.floor(raw(version)/count),numShort=count-raw(version)%count,chunks=[];let offset=0;
    for(let i=0;i<count;i++){const length=short-ecc[version]+(i<numShort?0:1),block=data.slice(offset,offset+length),remainder=Array(divisor.length).fill(0);offset+=length;
      for(const byte of block){const factor=byte^remainder.shift();remainder.push(0);for(let j=0;j<divisor.length;j++)remainder[j]^=multiply(divisor[j],factor);}
      if(i<numShort)block.push(0);chunks.push(block.concat(remainder));}
    const codewords=[];for(let i=0;i<chunks[0].length;i++)for(let j=0;j<count;j++)if(i!==short-ecc[version]||j>=numShort)codewords.push(chunks[j][i]);
    const matrix=Array.from({length:size},()=>Array(size).fill(false)),fixed=Array.from({length:size},()=>Array(size).fill(false));
    const set=(x,y,on)=>{matrix[y][x]=!!on;fixed[y][x]=true;},bit=(value,i)=>((value>>>i)&1)!==0;
    for(let i=0;i<size;i++){set(6,i,i%2===0);set(i,6,i%2===0);}
    for(const [x,y] of [[3,3],[size-4,3],[3,size-4]])for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++)if(x+dx>=0&&x+dx<size&&y+dy>=0&&y+dy<size){const d=Math.max(Math.abs(dx),Math.abs(dy));set(x+dx,y+dy,d!==2&&d!==4);}
    if(version>1){const n=Math.floor(version/7)+2,step=Math.floor((version*8+n*3+5)/(n*4-4))*2,positions=[6];for(let pos=size-7;positions.length<n;pos-=step)positions.splice(1,0,pos);
      for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(!(i===0&&j===0||i===0&&j===n-1||i===n-1&&j===0))for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(positions[i]+dx,positions[j]+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);}
    let remainder=8;for(let i=0;i<10;i++)remainder=(remainder<<1)^((remainder>>>9)*0x537);const formatBits=((8<<10)|remainder)^0x5412;
    for(let i=0;i<=5;i++)set(8,i,bit(formatBits,i));set(8,7,bit(formatBits,6));set(8,8,bit(formatBits,7));set(7,8,bit(formatBits,8));for(let i=9;i<15;i++)set(14-i,8,bit(formatBits,i));
    for(let i=0;i<8;i++)set(size-1-i,8,bit(formatBits,i));for(let i=8;i<15;i++)set(8,size-15+i,bit(formatBits,i));set(8,size-8,true);
    if(version>=7){let rem=version;for(let i=0;i<12;i++)rem=(rem<<1)^((rem>>>11)*0x1f25);const packed=(version<<12)|rem;for(let i=0;i<18;i++){const a=size-11+i%3,b=Math.floor(i/3);set(a,b,bit(packed,i));set(b,a,bit(packed,i));}}
    let index=0;for(let right=size-1;right>=1;right-=2){if(right===6)right=5;for(let vertical=0;vertical<size;vertical++)for(let j=0;j<2;j++){const x=right-j,y=((right+1)&2)===0?size-1-vertical:vertical;if(!fixed[y][x]){const on=index<codewords.length*8?bit(codewords[index>>>3],7-(index&7)):false;matrix[y][x]=on!==((x+y)%2===0);index++;}}}
    return {version,size,matrix};
  }
  function svg(value,{translate:tx=key=>SharingCopy.t(key,'nl')}={}){const {size,matrix}=qr(value),total=size+8;let path='';for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(matrix[y][x])path+=`M${x+4},${y+4}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" role="img" aria-label="${escape(copyText(tx,'sharingQrLabel'))}" style="display:block;width:100%;max-width:340px;margin:0 auto;shape-rendering:crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  }
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function copyText(tx,key){
    const fallback=SharingCopy.t(key,'nl');
    try{const value=typeof tx==='function'?tx(key):null;return typeof value==='string'&&value!==key?value:fallback;}
    catch(_){return fallback;}
  }
  const messages={STAND_SHARE_UNAVAILABLE:'sharingErrorUnavailable',
    STAND_NOT_CONNECTED:'sharingErrorNotConnected',STAND_SHARE_VERSION:'sharingErrorVersion',
    STAND_SHARE_INVALID:'sharingErrorInvalid',STAND_IDENTITY_UNCONFIRMED:'sharingErrorIdentity',
    STAND_CONNECTION_CANCELLED:'sharingErrorCancelled',STAND_SHARE_SCAN_UNAVAILABLE:'sharingErrorScanUnavailable',
    STAND_SHARE_CAMERA_DENIED:'sharingErrorCameraDenied',STAND_SHARE_LINK_UNAVAILABLE:'sharingErrorLinkUnavailable',
    STAND_CONNECTION_BUSY:'sharingErrorBusy',STAND_CANCELLED:'sharingErrorConnectCancelled',
    WIFI_JOIN_UNSUPPORTED:'sharingErrorWifiUnsupported',WIFI_JOIN_DENIED:'sharingErrorWifiDenied',
    WIFI_JOIN_TIMEOUT:'sharingErrorWifiTimeout',WIFI_JOIN_UNAVAILABLE:'sharingErrorWifiUnavailable',
    LOCAL_NETWORK_DENIED:'sharingErrorLocalNetwork',STAND_WRONG_WIFI:'sharingErrorWrongWifi',STAND_AUTH_FAILED:'sharingErrorAuth',
    STAND_SHARE_COPY_UNAVAILABLE:'sharingErrorCopyUnavailable',STAND_WIFI_CREDENTIAL_UNAVAILABLE:'sharingErrorWifiCredential',
    stand_wifi_credential_unavailable:'sharingErrorWifiCredential',STAND_INSPECTION_REQUIRED:'sharingErrorInspection'};
  const friendlyKey=error=>Object.hasOwn(messages,error?.code)?messages[error.code]:'sharingConnectFailed';
  const friendly=(error,tx)=>copyText(tx,friendlyKey(error));
  const closedCode=error=>Object.hasOwn(messages,error?.code)?error.code:'STAND_SHARE_UNCONFIRMED';
  const wifiFallbackCodes=new Set(['WIFI_JOIN_UNSUPPORTED','WIFI_JOIN_DENIED','WIFI_JOIN_TIMEOUT','WIFI_JOIN_UNAVAILABLE']);
  // Secrets exist only for an explicit foreground share/join screen. Public
  // state, errors and callbacks never carry the link, passphrase or raw reply.
  function create({services={},capabilities={},standConnection,onConnected=()=>{},onManual=()=>{},onChange=()=>{},clipboard,document:doc,window:win,
    setTimer=setTimeout,clearTimer=clearTimeout,privacyMs=120000,translate:tx=key=>SharingCopy.t(key,'nl')}={}){
    let mode='join',phase='idle',message='',secret=null,showCode=false,wifiFallback=false,epoch=0,job=null,disposed=false,element=null,privacyTimer=null,abortController=null;
    const caps=()=>typeof capabilities==='function'?capabilities():capabilities;
    const snapshot=()=>standConnection?.snapshot?.();
    const state=()=>({mode,phase,message:message?copyText(tx,message):'',busy:job!==null,hasAccess:secret!==null,
      shareAvailable:available(services,caps()),scanAvailable:caps()?.simpleStandScan===true&&typeof services.scanStandShare==='function'});
    const update=()=>{if(element)element.innerHTML=render();onChange(state());};
    function clear(){secret=null;showCode=false;wifiFallback=false;if(privacyTimer!==null)clearTimer(privacyTimer);privacyTimer=null;}
    function touched(){if(!secret)return;if(privacyTimer!==null)clearTimer(privacyTimer);privacyTimer=setTimer(()=>{privacyTimer=null;conceal();message='sharingPrivacyHidden';update();},privacyMs);}
    function open(next){if(!['share','join'].includes(next))fail('STAND_SHARE_INVALID');++epoch;mode=next;phase='idle';message='';clear();update();return state();}
    async function operation(run,{joining=false}={}){
      if(disposed||job)fail('STAND_CONNECTION_BUSY');const ticket=epoch;phase=joining?'connecting':'loading';message='';
      const check=()=>{if(disposed||ticket!==epoch)fail('STAND_CONNECTION_CANCELLED');};
      abortController=new AbortController();const signal=abortController.signal;
      const pending=(async()=>{try{const result=await Promise.resolve().then(()=>{check();return run(check,signal);});check();return result;}
        catch(error){if(!disposed&&ticket===epoch){clear();phase='error';message=friendlyKey(error);}throw Object.assign(Error(friendly(error,tx)),{code:closedCode(error)});}
        finally{if(job===pending){job=null;abortController=null;}if(!disposed&&ticket===epoch)update();}})();job=pending;update();return pending;
    }
    async function load(){return operation(async check=>{
      const before=snapshot();const value=await obtain(services,caps(),before),after=snapshot();
      check();
      if(!after||after.standId!==before.standId||after.ssid!==before.ssid)fail('STAND_IDENTITY_UNCONFIRMED');
      secret=value;showCode=true;phase='ready';message='';touched();return state();
    });}
    function parseLink(text,expectedStandId){if(disposed||job)fail('STAND_CONNECTION_BUSY');clear();message='';try{secret=parse(text,expectedStandId);phase='ready';touched();}
      catch(error){phase='error';message=friendlyKey(error);update();throw Object.assign(Error(friendly(error,tx)),{code:error.code});}update();return state();}
    async function scan(){if(!state().scanAvailable)fail('STAND_SHARE_SCAN_UNAVAILABLE');return operation(async(check,signal)=>{
      const reply=await services.scanStandShare({},signal);check();if(reply?.status==='cancelled'&&Object.keys(reply).join(',')==='status'){clear();phase='idle';message='sharingScanCancelled';return state();}
      if(reply?.status!=='scanned'||Object.keys(reply).sort().join(',')!=='status,text')fail('STAND_SHARE_INVALID');
      secret=parse(reply.text);phase='ready';touched();return state();
    });}
    async function join({joinWifi=true}={}){if(!secret||mode!=='join')fail('STAND_SHARE_INVALID');const request=connection(secret),ticket=epoch;clear();
      try{let connected=null;const outcome=await operation(async check=>{
        if(typeof standConnection?.connect!=='function')fail('STAND_SHARE_UNAVAILABLE');
        // Only this foreground Scan/Open button asks the platform to join.
        // The QR/link codec remains unchanged; resume and background do not.
        const result=await standConnection.connect(joinWifi?{...request,joinWifi:true}:request);check();
        if(result?.view){phase='connected';message='sharingStandOpened';connected=result;}
        else{phase='error';message='sharingSetupRequired';}
        return state();
      },{joining:true});if(connected)await onConnected(connected);return outcome;}
      catch(error){
        // Retain only this foreground QR/link's ephemeral credentials for the
        // explicit system-Wifi fallback. Cancellation/background still wipe.
        if(wifiFallbackCodes.has(error?.code)&&!disposed&&ticket===epoch&&mode==='join'&&!doc?.hidden){
          secret=validate({version:VERSION,standId:request.expectedStandId,ssid:request.ssid,standCode:request.standCode});wifiFallback=true;phase='error';message=friendlyKey(error);touched();update();
        }
        throw error;
      }finally{request.standCode='';}}
    async function copyLink(){if(mode!=='share'||!secret)fail('STAND_SHARE_INVALID');const writer=clipboard||win?.navigator?.clipboard;
      if(typeof writer?.writeText!=='function')fail('STAND_SHARE_COPY_UNAVAILABLE');const link=format(secret),ticket=epoch;
      try{await writer.writeText(link);if(ticket===epoch&&!disposed){message='sharingLinkCopied';update();}}
      catch(_){fail('STAND_SHARE_COPY_UNAVAILABLE');}}
    async function copyCode(){if(!secret)fail('STAND_SHARE_INVALID');const writer=clipboard||win?.navigator?.clipboard;
      if(typeof writer?.writeText!=='function')fail('STAND_SHARE_COPY_UNAVAILABLE');const code=secret.standCode,ticket=epoch;
      try{await writer.writeText(code);if(ticket===epoch&&!disposed){message='sharingCodeCopied';update();}}
      catch(_){fail('STAND_SHARE_COPY_UNAVAILABLE');}}
    async function copyWifi(){if(mode!=='share'||!secret)fail('STAND_SHARE_INVALID');const writer=clipboard||win?.navigator?.clipboard;
      if(typeof writer?.writeText!=='function')fail('STAND_SHARE_COPY_UNAVAILABLE');const text=`Wifi-netwerk: ${secret.ssid}\nWifi-PIN: ${secret.standCode}`,ticket=epoch;
      try{await writer.writeText(text);if(ticket===epoch&&!disposed){message='sharingWifiCopied';update();}}
      catch(_){fail('STAND_SHARE_COPY_UNAVAILABLE');}}
    async function shareWifi(){if(mode!=='share'||!secret||caps()?.simpleStandShareSheet!==true||typeof services.shareStandWifi!=='function')fail('STAND_SHARE_LINK_UNAVAILABLE');
      const standId=secret.standId;
      return operation(async(check,signal)=>{const result=await services.shareStandWifi({standId},signal);check();
        if(!plain(result)||Object.keys(result).join(',')!=='status'||!['shared','cancelled'].includes(result.status))fail('STAND_SHARE_INVALID');
        phase='ready';message=result.status==='shared'?'sharingWifiOffered':'sharingCancelled';return state();});
    }
    async function shareLink(){if(mode!=='share'||!secret)fail('STAND_SHARE_INVALID');const text=format(secret),ticket=epoch;
      if(caps()?.simpleStandShareSheet===true&&typeof services.shareStandLink==='function'){
        return operation(async(check,signal)=>{const result=await services.shareStandLink({text},signal);check();
          if(!plain(result)||Object.keys(result).join(',')!=='status'||!['shared','cancelled'].includes(result.status))fail('STAND_SHARE_INVALID');
          phase='ready';message=result.status==='shared'?'sharingLinkOffered':'sharingCancelled';return state();});
      }
      if(typeof win?.navigator?.share!=='function')fail('STAND_SHARE_LINK_UNAVAILABLE');
      try{await win.navigator.share({title:copyText(tx,'sharingShareTitle'),url:text});if(ticket===epoch&&!disposed){message='sharingLinkOffered';update();}}
      catch(error){if(error?.name==='AbortError'){if(ticket===epoch&&!disposed){message='sharingCancelled';update();}}else fail('STAND_SHARE_LINK_UNAVAILABLE');}
    }
    async function cancel(){const joining=phase==='connecting';++epoch;clear();phase='idle';message='';update();
      abortController?.abort();
      if(joining&&typeof standConnection?.disconnect==='function')await standConnection.disconnect();}
    function render(){const s=state();
      if(mode==='share')return `<section class="stand-sharing card"><p>${escape(copyText(tx,'sharingWifiIntro'))}</p>${!s.shareAvailable?`<p role="status">${escape(copyText(tx,'sharingErrorUnavailable'))}</p>`:secret?`<label class="dialog-field">${escape(copyText(tx,'sharingWifiNetwork'))}<input data-stand-share-network readonly value="${escape(secret.ssid)}"></label><label class="dialog-field stand-pin-display">${escape(copyText(tx,'sharingWifiPin'))}<input data-stand-share-code type="text" readonly autocomplete="off" spellcheck="false" value="${escape(secret.standCode)}"></label><button class="button full" data-stand-sharing-action="share-wifi" ${s.busy||caps()?.simpleStandShareSheet!==true?'disabled':''}>${escape(copyText(tx,'sharingWifiShare'))}</button><button class="button secondary full" data-stand-sharing-action="copy-wifi" ${s.busy?'disabled':''}>${escape(copyText(tx,'sharingCopyDetails'))}</button><small>${escape(copyText(tx,'sharingAccessWarning'))}</small>`:s.busy?`<p role="status">${escape(copyText(tx,'sharingLoading'))}</p>`:`<button class="button full" data-stand-sharing-action="load">${escape(copyText(tx,'sharingShowDetails'))}</button>`}<p data-stand-share-status role="status" aria-live="polite">${escape(s.message)}</p></section>`;
      return `<section class="stand-sharing card"><p>${escape(copyText(tx,'sharingJoinIntro'))}</p></section>`;
    }
    async function click(event){const button=event.target.closest?.('[data-stand-sharing-action]');if(!button||!element?.contains(button))return;
      const ticket=epoch;event.preventDefault();touched();try{switch(button.dataset.standSharingAction){case'load':await load();break;case'copy-wifi':await copyWifi();break;case'share-wifi':await shareWifi();break;case'copy':await copyLink();break;case'copy-code':await copyCode();break;case'share':await shareLink();break;case'show-code':showCode=!showCode;update();break;case'manual':await cancel();await onManual();break;case'join':await join();break;case'join-connected':await join({joinWifi:false});break;case'scan':await scan();if(ticket===epoch&&!disposed&&mode==='join'&&secret)await join();break;case'cancel':await cancel();break;case'parse':{const input=element.querySelector('[data-stand-join-link]'),text=input?.value||'';if(input)input.value='';parseLink(text);break;}}}
      catch(error){if(!disposed&&ticket===epoch){phase='error';message=friendlyKey(error);update();}}}
    function conceal(){++epoch;abortController?.abort();clear();phase='idle';message='';update();}
    function hidden(){if(doc?.hidden){const joining=phase==='connecting';conceal();if(joining)void standConnection?.disconnect?.();}}
    function pageHide(){const joining=phase==='connecting';conceal();if(joining)void standConnection?.disconnect?.();}
    function mount(target){if(element){element.removeEventListener('click',click);element.removeEventListener('pointerdown',touched);element.removeEventListener('keydown',touched);}element=target;target.addEventListener('click',click);target.addEventListener('pointerdown',touched);target.addEventListener('keydown',touched);update();}
    function dispose(){++epoch;abortController?.abort();clear();disposed=true;if(element){element.removeEventListener('click',click);element.removeEventListener('pointerdown',touched);element.removeEventListener('keydown',touched);element.innerHTML='';element=null;}doc?.removeEventListener('visibilitychange',hidden);win?.removeEventListener('pagehide',pageHide);}
    doc?.addEventListener('visibilitychange',hidden);win?.addEventListener('pagehide',pageHide);
    return Object.freeze({open,load,parseLink,scan,join,copyLink,copyCode,shareLink,copyWifi,shareWifi,cancel,mount,render,state,dispose});
  }
  return Object.freeze({VERSION,MAX_LINK,validate,format,parse,connection,available,obtain,qr,svg,create});
});
