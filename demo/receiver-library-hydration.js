/* Cold local archive hydration only. No radio, playback replay, preferences,
 * owner material or automatic receiver writes. Existing local libraries win. */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./model.js'):root.LightningModel);
  if(node)module.exports=api;else root.LightningReceiverLibraryHydration=api;
})(typeof globalThis==='object'?globalThis:this,function(Model){
  'use strict';
  const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
  const copy=value=>Array.isArray(value)?value.map(copy):plain(value)?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,copy(item)])):value;
  const fail=()=>{throw Object.assign(Error('De lokale herstelbibliotheek is niet bevestigd.'),{code:'RECOVERED_LIBRARY_HYDRATION_INVALID'});};
  const require=value=>{if(!value)fail();};
  function compareKeys(a,b){
    let i=0,j=0;while(i<a.length&&j<b.length){
      if(/[0-9]/.test(a[i])&&/[0-9]/.test(b[j])){const ai=i,bj=j;while(i<a.length&&/[0-9]/.test(a[i]))i++;while(j<b.length&&/[0-9]/.test(b[j]))j++;const an=BigInt(a.slice(ai,i)),bn=BigInt(b.slice(bj,j));if(an!==bn)return an<bn?-1:1;}
      else{const x=a[i].toLowerCase(),y=b[j].toLowerCase();if(x!==y)return x<y?-1:1;i++;j++;}
    }
    return (a.length-i)-(b.length-j)||(a<b?-1:a>b?1:0);
  }
  function quoted(value){
    require(typeof value==='string'&&value.length<=4096);for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const d=value.charCodeAt(++i);require(d>=0xdc00&&d<=0xdfff);}else require(c<0xdc00||c>0xdfff);}
    return JSON.stringify(value).replace(/\//g,'\\/');
  }
  function decimal17(value){
    // Java BigDecimal(double).round(17, HALF_EVEN) rounds exact binary values,
    // not JS toPrecision's upward ties. Work on the IEEE-754 rational directly.
    const binary=new DataView(new ArrayBuffer(8));binary.setFloat64(0,Math.abs(value),false);const bits=binary.getBigUint64(0,false),encoded=Number((bits>>52n)&2047n);
    let numerator=(bits&((1n<<52n)-1n))+(encoded?1n<<52n:0n),denominator=1n,power=(encoded?encoded-1023:-1022)-52;
    if(power>=0)numerator<<=BigInt(power);else denominator<<=BigInt(-power);
    let exponent=Math.floor(Math.log10(Math.abs(value)));
    const atPower=e=>e>=0?numerator-denominator*10n**BigInt(e):numerator*10n**BigInt(-e)-denominator;
    while(atPower(exponent)<0n)exponent--;while(atPower(exponent+1)>=0n)exponent++;
    const scale=16-exponent,n=scale>=0?numerator*10n**BigInt(scale):numerator,d=scale>=0?denominator:denominator*10n**BigInt(-scale);
    let rounded=n/d;const remainder=n%d;if(remainder*2n>d||(remainder*2n===d&&rounded%2n===1n))rounded++;
    if(rounded===10n**17n){rounded/=10n;exponent++;}
    const digits=String(rounded).replace(/0+$/,'');let result;
    if(exponent>=-4&&exponent<17){const dot=exponent+1;result=dot<=0?'0.'+'0'.repeat(-dot)+digits:dot>=digits.length?digits+'0'.repeat(dot-digits.length):digits.slice(0,dot)+'.'+digits.slice(dot);}
    else result=digits[0]+(digits.length>1?'.'+digits.slice(1):'')+'e'+(exponent<0?'-':'+')+String(Math.abs(exponent)).padStart(2,'0');
    return (value<0?'-':'')+result;
  }
  // The public digest codec is AlvRecoverySnapshot.encode, not the
  // platform-dependent org.json quote/numberToString or saved-light commands.
  function canonical(value,depth=0,count={nodes:0}){
    require(depth<=20&&++count.nodes<=50000);if(value===null)return 'null';
    if(Array.isArray(value)){require(value.length<=1200);return '['+value.map(v=>canonical(v,depth+1,count)).join(',')+']';}
    if(plain(value)){const keys=Object.keys(value);require(keys.length<=64&&!keys.some(k=>k.length>64||['__proto__','prototype','constructor'].includes(k)));return '{'+keys.sort(compareKeys).map(k=>quoted(k)+':'+canonical(value[k],depth+1,count)).join(',')+'}';}
    if(typeof value==='string')return quoted(value);if(typeof value==='boolean')return String(value);
    require(typeof value==='number'&&Number.isFinite(value));if(Object.is(value,-0))return '-0';if(value===0)return '0';
    if(Number.isInteger(value)){require(Number.isSafeInteger(value));return String(value);}
    return decimal17(value);
  }
  async function digest(value,crypto){require(crypto?.subtle?.digest);const bytes=new TextEncoder().encode(canonical(value));require(bytes.length<=262144);const result=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(result),v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();}
  function exact(value,keys){require(plain(value)&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|'));}
  function eligible(view){
    exact(view,['model','draft','revision']);require(view.draft===null&&Number.isInteger(view.revision)&&view.revision>=0&&view.revision<=2147483646&&view.model?.demo===false&&Model?.validate(view.model).valid);
    require(view.model.stands.length>0&&view.model.stands.length<=60&&view.model.receivers.length>0&&view.model.receivers.every(r=>r.lifecycle==='added'));
  }
  function create({getView,isIdle,isVisible,loadRecoveredLibraries,libraries,crypto=globalThis.crypto}={}){
    require([getView,isIdle,isVisible,loadRecoveredLibraries].every(f=>typeof f==='function')&&libraries?.prepareMissing&&libraries?.missingMatches&&libraries?.restoreMissingMany);
    let inFlight=null;
    function resume(view=getView()){
      let pinned,key;try{eligible(view);pinned=copy(view);key=canonical(pinned);}catch(_){return Promise.resolve({status:'skipped',reason:'view'});}
      if(inFlight)return inFlight.key===key?inFlight.promise:Promise.resolve({status:'skipped',reason:'busy'});
      const task={key,promise:null};inFlight=task;
      task.promise=(async()=>{
        let missing;
        const current=()=>{try{return isIdle()===true&&isVisible()===true&&canonical(getView())===key&&(!missing||libraries.missingMatches(missing)===true);}catch(_){return false;}};
        try{
          if(!current())return {status:'skipped',reason:'inactive'};
          missing=libraries.prepareMissing();if(!missing)return {status:'skipped',reason:'existing'};
          if(!current())return {status:'skipped',reason:'changed'};
          const modelDigest=await digest(pinned.model,crypto);if(!current())return {status:'skipped',reason:'changed'};
          const batches=[];
          for(const stand of pinned.model.stands){
            const received=await loadRecoveredLibraries({standId:stand.id,expectedRevision:pinned.revision});if(!current())return {status:'skipped',reason:'changed'};
            if(!plain(received)||received.status!=='available')return {status:'skipped',reason:'unavailable'};
            const reply=copy(received); // No mutable reply can change after SHA await.
            exact(reply,['status','standId','viewRevision','viewModelDigest','libraries','librariesDigest','archiveDigest','source']);
            require(reply.standId===stand.id&&reply.viewRevision===pinned.revision&&reply.viewModelDigest===modelDigest&&reply.source==='native-recovered-archive'&&/^[A-F0-9]{64}$/.test(reply.archiveDigest)&&/^[A-F0-9]{64}$/.test(reply.librariesDigest));
            const libraryDigest=await digest(reply.libraries,crypto);if(!current())return {status:'skipped',reason:'changed'};require(libraryDigest===reply.librariesDigest);
            batches.push({standId:stand.id,libraries:copy(reply.libraries)});
          }
          if(!current())return {status:'skipped',reason:'changed'};
          const result=libraries.restoreMissingMany(batches,missing,current);require(result?.restored===true);return {status:'restored',...result};
        }catch(_){return {status:'unavailable',code:'RECOVERED_LIBRARY_HYDRATION_INVALID'};}
      })().finally(()=>{if(inFlight===task)inFlight=null;});return task.promise;
    }
    return Object.freeze({resume});
  }
  return Object.freeze({create,canonical,digest});
});
