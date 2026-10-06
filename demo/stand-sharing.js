/* Explicit sharing only. A link contains access credentials, never stand data.
 * No storage, networking, navigation, enrollment or code generation lives here. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningStandSharing=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const VERSION=1,MAX_LINK=1024,keys='ssid,standCode,standId,version';
  const fail=code=>{throw Object.assign(Error('De gedeelde stand is niet bevestigd.'),{code});};
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
  function svg(value){const {size,matrix}=qr(value),total=size+8;let path='';for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(matrix[y][x])path+=`M${x+4},${y+4}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" role="img" aria-label="QR-code om deze stand te openen" style="display:block;width:100%;max-width:340px;margin:0 auto;shape-rendering:crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  }
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const messages={STAND_SHARE_UNAVAILABLE:'Delen is nog niet beschikbaar in deze app. Je huidige stand blijft behouden.',
    STAND_NOT_CONNECTED:'Open eerst je stand voordat je haar deelt.',STAND_SHARE_VERSION:'Deze deellink gebruikt een andere versie. Vraag een nieuwe link.',
    STAND_SHARE_INVALID:'Deze deellink is ongeldig. Vraag een nieuwe link of gebruik de standcode.',
    STAND_IDENTITY_UNCONFIRMED:'De verwachte stand is niet bevestigd. Er zijn geen standgegevens overgenomen.',
    STAND_CONNECTION_CANCELLED:'Geannuleerd. Je stand op de hoofdreceiver blijft behouden.',
    STAND_SHARE_SCAN_UNAVAILABLE:'Scannen is nog niet beschikbaar in deze app. Plak de deellink of gebruik de standcode.',
    STAND_SHARE_CAMERA_DENIED:'De camera is niet toegestaan. Geef Aluvision cameratoegang in Instellingen, of plak de deellink.',
    STAND_SHARE_LINK_UNAVAILABLE:'Het deelvenster is niet beschikbaar. Kopieer de deellink om haar zelf te versturen.',
    STAND_CONNECTION_BUSY:'Er loopt nog een actie. Wacht tot die klaar is en probeer opnieuw.',
    STAND_WRONG_WIFI:'Verbind in Instellingen → Wifi met het getoonde standnetwerk en probeer opnieuw.',
    STAND_AUTH_FAILED:'De gedeelde standcode is niet bevestigd. Vraag een nieuwe link als de code intussen is gewijzigd.',
    STAND_SHARE_COPY_UNAVAILABLE:'Kopiëren is niet beschikbaar. Je kunt de link zelf selecteren.',
    STAND_INSPECTION_REQUIRED:'Herken eerst de hoofdreceiver op het wifi-netwerk waarmee je verbonden bent.'};
  const friendly=error=>messages[error?.code]||'De verbinding of de gedeelde toegang is niet bevestigd. Probeer opnieuw wanneer je met het juiste wifi-netwerk verbonden bent.';
  const closedCode=error=>Object.hasOwn(messages,error?.code)?error.code:'STAND_SHARE_UNCONFIRMED';
  // Secrets exist only for an explicit foreground share/join screen. Public
  // state, errors and callbacks never carry the link, passphrase or raw reply.
  function create({services={},capabilities={},standConnection,onConnected=()=>{},onManual=()=>{},onChange=()=>{},clipboard,document:doc,window:win,
    setTimer=setTimeout,clearTimer=clearTimeout,privacyMs=120000}={}){
    let mode='join',phase='idle',message='',secret=null,showCode=false,epoch=0,job=null,disposed=false,element=null,privacyTimer=null,abortController=null;
    const caps=()=>typeof capabilities==='function'?capabilities():capabilities;
    const snapshot=()=>standConnection?.snapshot?.();
    const state=()=>({mode,phase,message,busy:job!==null,hasAccess:secret!==null,
      shareAvailable:available(services,caps()),scanAvailable:caps()?.simpleStandScan===true&&typeof services.scanStandShare==='function'});
    const update=()=>{if(element)element.innerHTML=render();onChange(state());};
    function clear(){secret=null;showCode=false;if(privacyTimer!==null)clearTimer(privacyTimer);privacyTimer=null;}
    function touched(){if(!secret)return;if(privacyTimer!==null)clearTimer(privacyTimer);privacyTimer=setTimer(()=>{privacyTimer=null;conceal();message='QR-code en standcode zijn weer verborgen. Toon ze opnieuw als je verder wilt delen.';update();},privacyMs);}
    function open(next){if(!['share','join'].includes(next))fail('STAND_SHARE_INVALID');++epoch;mode=next;phase='idle';message='';clear();update();return state();}
    async function operation(run,{joining=false}={}){
      if(disposed||job)fail('STAND_CONNECTION_BUSY');const ticket=epoch;phase=joining?'connecting':'loading';message='';
      const check=()=>{if(disposed||ticket!==epoch)fail('STAND_CONNECTION_CANCELLED');};
      abortController=new AbortController();const signal=abortController.signal;
      const pending=(async()=>{try{const result=await Promise.resolve().then(()=>{check();return run(check,signal);});check();return result;}
        catch(error){if(!disposed&&ticket===epoch){clear();phase='error';message=friendly(error);}throw Object.assign(Error(friendly(error)),{code:closedCode(error)});}
        finally{if(job===pending){job=null;abortController=null;}if(!disposed&&ticket===epoch)update();}})();job=pending;update();return pending;
    }
    async function load(){return operation(async check=>{
      const before=snapshot();const value=await obtain(services,caps(),before),after=snapshot();
      check();
      if(!after||after.standId!==before.standId||after.ssid!==before.ssid)fail('STAND_IDENTITY_UNCONFIRMED');
      secret=value;phase='ready';message='Iedereen met deze QR-code of link krijgt dezelfde bediening. De bestaande standcode verandert niet.';touched();return state();
    });}
    function parseLink(text,expectedStandId){if(disposed||job)fail('STAND_CONNECTION_BUSY');clear();message='';try{secret=parse(text,expectedStandId);phase='ready';touched();}
      catch(error){phase='error';message=friendly(error);update();throw Object.assign(Error(message),{code:error.code});}update();return state();}
    async function scan(){if(!state().scanAvailable)fail('STAND_SHARE_SCAN_UNAVAILABLE');return operation(async(check,signal)=>{
      const reply=await services.scanStandShare({},signal);check();if(reply?.status==='cancelled'&&Object.keys(reply).join(',')==='status'){clear();phase='idle';message='Scannen geannuleerd.';return state();}
      if(reply?.status!=='scanned'||Object.keys(reply).sort().join(',')!=='status,text')fail('STAND_SHARE_INVALID');
      secret=parse(reply.text);phase='ready';touched();return state();
    });}
    async function join(){if(!secret||mode!=='join')fail('STAND_SHARE_INVALID');const request=connection(secret);clear();
      try{let connected=null;const outcome=await operation(async check=>{
        if(typeof standConnection?.connect!=='function')fail('STAND_SHARE_UNAVAILABLE');
        const result=await standConnection.connect(request);check();
        if(result?.view){phase='connected';message='Je actuele stand is geopend.';connected=result;}
        else{phase='error';message='Deze hoofdreceiver heeft nog geen deelbare standcode. Open de bestaande stand op het oorspronkelijke toestel; er wordt niets automatisch ingesteld.';}
        return state();
      },{joining:true});if(connected)await onConnected(connected);return outcome;}finally{request.standCode='';}}
    async function copyLink(){if(mode!=='share'||!secret)fail('STAND_SHARE_INVALID');const writer=clipboard||win?.navigator?.clipboard;
      if(typeof writer?.writeText!=='function')fail('STAND_SHARE_COPY_UNAVAILABLE');const link=format(secret),ticket=epoch;
      try{await writer.writeText(link);if(ticket===epoch&&!disposed){message='Deellink gekopieerd. Behandel deze als je wifiwachtwoord.';update();}}
      catch(_){fail('STAND_SHARE_COPY_UNAVAILABLE');}}
    async function copyCode(){if(!secret)fail('STAND_SHARE_INVALID');const writer=clipboard||win?.navigator?.clipboard;
      if(typeof writer?.writeText!=='function')fail('STAND_SHARE_COPY_UNAVAILABLE');const code=secret.standCode,ticket=epoch;
      try{await writer.writeText(code);if(ticket===epoch&&!disposed){message='Standcode gekopieerd. Plak haar alleen in de wifi-instellingen of deel haar met iemand die je stand mag bedienen.';update();}}
      catch(_){fail('STAND_SHARE_COPY_UNAVAILABLE');}}
    async function shareLink(){if(mode!=='share'||!secret)fail('STAND_SHARE_INVALID');const text=format(secret),ticket=epoch;
      if(caps()?.simpleStandShareSheet===true&&typeof services.shareStandLink==='function'){
        return operation(async(check,signal)=>{const result=await services.shareStandLink({text},signal);check();
          if(!plain(result)||Object.keys(result).join(',')!=='status'||!['shared','cancelled'].includes(result.status))fail('STAND_SHARE_INVALID');
          phase='ready';message=result.status==='shared'?'Deellink aangeboden aan het deelvenster.':'Delen geannuleerd.';return state();});
      }
      if(typeof win?.navigator?.share!=='function')fail('STAND_SHARE_LINK_UNAVAILABLE');
      try{await win.navigator.share({title:'Open mijn Aluvision-stand',url:text});if(ticket===epoch&&!disposed){message='Deellink aangeboden aan het deelvenster.';update();}}
      catch(error){if(error?.name==='AbortError'){if(ticket===epoch&&!disposed){message='Delen geannuleerd.';update();}}else fail('STAND_SHARE_LINK_UNAVAILABLE');}
    }
    async function cancel(){const joining=phase==='connecting';++epoch;clear();phase='idle';message='';update();
      abortController?.abort();
      if(joining&&typeof standConnection?.disconnect==='function')await standConnection.disconnect();}
    function render(){const s=state();
      if(mode==='share')return `<section class="stand-sharing card"><h2>Deel mijn stand</h2><p>Laat iemand deze QR-code scannen in Aluvision, of stuur de deellink. Iedereen gebruikt dezelfde standcode en bedient dezelfde actuele stand.</p>${!s.shareAvailable?`<p role="status">${messages.STAND_SHARE_UNAVAILABLE}</p>`:secret?`<div class="stand-sharing-qr" data-stand-share-qr>${svg(secret)}</div><label class="dialog-field">Wifi-netwerk<input data-stand-share-network readonly value="${escape(secret.ssid)}"></label><label class="dialog-field">Bestaande standcode · je wifiwachtwoord<input data-stand-share-code type="${showCode?'text':'password'}" readonly autocomplete="off" spellcheck="false" value="${escape(secret.standCode)}"></label><button class="button secondary full" data-stand-sharing-action="show-code" aria-pressed="${showCode}">${showCode?'Standcode verbergen':'Standcode tonen'}</button><button class="button secondary full" data-stand-sharing-action="copy-code">Standcode kopiëren</button><button class="button full" data-stand-sharing-action="share" ${s.busy?'disabled':''}>Deellink delen</button><button class="button secondary full" data-stand-sharing-action="copy">Deellink kopiëren</button><details><summary>Deellink bekijken</summary><label class="dialog-field">Deellink<input data-stand-share-link readonly autocomplete="off" value="${escape(format(secret))}"></label></details><button class="text-button" data-stand-sharing-action="cancel">QR-code en code verbergen</button><small>De QR-code en link bevatten je wifiwachtwoord. Ze verdwijnen uit dit scherm zodra je het sluit of even niets doet.</small>`:`<button class="button full" data-stand-sharing-action="load" ${s.busy?'disabled':''}>${s.busy?'Toegang controleren…':'QR-code en bestaande standcode tonen'}</button>`}<p data-stand-share-status role="status" aria-live="polite">${escape(message)}</p></section>`;
      return `<section class="stand-sharing card"><h2>Gedeelde stand openen</h2>${secret?`<p>1. Verbind in Instellingen → Wifi met <b>${escape(secret.ssid)}</b>.</p><label class="dialog-field">Standcode voor wifi<input data-stand-share-code type="${showCode?'text':'password'}" readonly autocomplete="off" value="${escape(secret.standCode)}"></label><button class="button secondary full" data-stand-sharing-action="show-code" aria-pressed="${showCode}">${showCode?'Standcode verbergen':'Standcode tonen'}</button><button class="button secondary full" data-stand-sharing-action="copy-code">Standcode kopiëren voor wifi</button><p>Ben je al met dit wifi verbonden? Open dan de actuele stand hieronder. Moet je nog naar Instellingen? Scan of plak bij terugkeer opnieuw: dit scherm verbergt je code zodra je de app verlaat.</p><button class="button full" data-stand-sharing-action="join" ${s.busy?'disabled':''}>${s.busy?'Stand openen…':'Deze stand openen'}</button>`:`<p>Scan de QR-code in Aluvision of plak de deellink. Je kiest daarna zelf wanneer je verbinding maakt. De app stelt nooit een nieuwe stand in op basis van een link.</p>${s.scanAvailable?`<button class="button full" data-stand-sharing-action="scan" ${s.busy?'disabled':''}>${phase==='loading'?'Camera openen…':'QR-code scannen'}</button>`:'<p class="muted">Scannen is hier niet beschikbaar. Plak de deellink of open met je standcode.</p>'}<label class="dialog-field">Deellink<input data-stand-join-link autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="${MAX_LINK}" placeholder="Plak je aluvision://stand-link" ${s.busy?'disabled':''}></label><button class="button secondary full" data-stand-sharing-action="parse" ${s.busy?'disabled':''}>Deellink controleren</button><button class="button secondary full" data-stand-sharing-action="manual" ${s.busy?'disabled':''}>Handmatig openen met standcode</button>`}<button class="text-button" data-stand-sharing-action="cancel">${s.busy?'Annuleren':'Andere QR-code of link gebruiken'}</button><p data-stand-share-status role="status" aria-live="polite">${escape(message)}</p></section>`;
    }
    async function click(event){const button=event.target.closest?.('[data-stand-sharing-action]');if(!button||!element?.contains(button))return;
      const ticket=epoch;event.preventDefault();touched();try{switch(button.dataset.standSharingAction){case'load':await load();break;case'copy':await copyLink();break;case'copy-code':await copyCode();break;case'share':await shareLink();break;case'show-code':showCode=!showCode;update();break;case'manual':await cancel();await onManual();break;case'join':await join();break;case'scan':await scan();break;case'cancel':await cancel();break;case'parse':{const input=element.querySelector('[data-stand-join-link]'),text=input?.value||'';if(input)input.value='';parseLink(text);break;}}}
      catch(error){if(!disposed&&ticket===epoch){phase='error';message=friendly(error);update();}}}
    function conceal(){++epoch;abortController?.abort();clear();phase='idle';message='';update();}
    function hidden(){if(doc?.hidden){const joining=phase==='connecting';conceal();if(joining)void standConnection?.disconnect?.();}}
    function pageHide(){const joining=phase==='connecting';conceal();if(joining)void standConnection?.disconnect?.();}
    function mount(target){if(element){element.removeEventListener('click',click);element.removeEventListener('pointerdown',touched);element.removeEventListener('keydown',touched);}element=target;target.addEventListener('click',click);target.addEventListener('pointerdown',touched);target.addEventListener('keydown',touched);update();}
    function dispose(){++epoch;abortController?.abort();clear();disposed=true;if(element){element.removeEventListener('click',click);element.removeEventListener('pointerdown',touched);element.removeEventListener('keydown',touched);element.innerHTML='';element=null;}doc?.removeEventListener('visibilitychange',hidden);win?.removeEventListener('pagehide',pageHide);}
    doc?.addEventListener('visibilitychange',hidden);win?.addEventListener('pagehide',pageHide);
    return Object.freeze({open,load,parseLink,scan,join,copyLink,copyCode,shareLink,cancel,mount,render,state,dispose});
  }
  return Object.freeze({VERSION,MAX_LINK,validate,format,parse,connection,available,obtain,qr,svg,create});
});
