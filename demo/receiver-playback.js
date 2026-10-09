/* Read-only V32 playback import. Native authenticates the owner/session; this
 * codec accepts only known bounded light fields and never sends a command. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./model.js'),require('./preview.js'),require('./reference-animations.js')):factory(root.LightningModel,root.LightningPreview,root.LightningReferenceAnimations);if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningReceiverPlayback=api;})(typeof globalThis==='object'?globalThis:this,function(M,P,R){
 'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 const fail=()=>{throw Object.assign(Error('De actieve lichtinstelling is nog niet volledig uitgelezen.'),{code:'PLAYBACK_UNCONFIRMED'});};
 const SPI=['STATIC','GRADIENT','BREATHE','CHASE','COMET','SCANNER','SPARKLE','WAVE','SEQUENCE','ALL','MIRROR','ALTERNATE','CASCADE','DUAL','FLOW','WARM','MINIMAL'];
 const V30=['rgb-jumping','seven-jumping','rgb-gradient','seven-gradient','tunnel-travel','tunnel-bounce','tunnel-center','tunnel-outside','tunnel-cascade','tunnel-handoff','tunnel-pulse','tunnel-echo','tunnel-pixel-curtain','tunnel-pixel-cross','brand-white-breathe','brand-warm-white','brand-accent','brand-sweep','brand-focus','brand-soft-gradient'].map(id=>'v30-'+id);
 const whole=[0,1,2,3,4,17,18,19,20,25];
 const basic='STATUS DETAIL SCHEMA RID INSTALLATION DEVTYPE PORT PORTMASK GEN PLAYBACKRESUME FX VAR BRIGHT SPEED SMOOTH COLORS FG1 FG2 FG3 FG4 BG BGON BGBRIGHT REVERSE PHASEMS LINEINDEX LINECOUNT V30ID';
 const spi='PIXELS GROUP OFFSET WIDTH SPACING OBJECTS TRAIL SPREAD RANDOM BOUNCE MIRROR PHYSREVERSE POWERLIMIT WHITEMIX PARALLEL';
 const modern='V30TIME V30PIXELS V30GROUP V30OFFSET V30COLORS V30FADE V30WIDTH V30DELAY V30SPEED V30SMOOTH V30BRIGHT V30BGON V30BGBRIGHT V30REVERSE V30PARALLEL V30LINEINDEX V30LINECOUNT V30FG1 V30FG2 V30FG3 V30FG4 V30FG5 V30FG6 V30FG7 V30BG V30BRAND';
 const hex=colour=>'#'+colour.slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
 const rgbwEffect=engine=>engine==='STATIC'?0:engine==='STROBE'?3:engine==='SPARKLE'?5:['CHASE','CASCADE','SEQUENCE','WAVE'].includes(engine)?6:['FLOW','GRADIENT'].includes(engine)?2:engine==='SMOOTH'?4:1;
 function decode(receiver,status){
  if(!status||Object.keys(status).sort().join(',')!=='fields,port,receiverId,rid,type'||status.receiverId!==receiver.id||status.rid!==receiver.rid||status.type!==receiver.type||!Number.isInteger(status.port)||status.port<1||status.port>4)fail();
  const f=status.fields;if(!f||typeof f!=='object'||Array.isArray(f))fail();
  const isSPI=receiver.type==='SPI';
  const allowed=new Set((basic+' '+(isSPI?spi:'LINEDELAY SPACING')+' '+modern).split(' '));
  for(const[key,value]of Object.entries(f))if(!allowed.has(key)||typeof value!=='string'||value.length>96)fail();
  const n=(key,min,max)=>{if(!/^(0|[1-9]\d*)$/.test(f[key]||''))fail();const value=Number(f[key]);if(!Number.isSafeInteger(value)||value<min||value>max)fail();return value;};
  const bool=key=>n(key,0,1)===1;
  const colour=key=>{if(typeof f[key]!=='string'||!/^(0|[1-9]\d*),(0|[1-9]\d*),(0|[1-9]\d*),(0|[1-9]\d*)$/.test(f[key]))fail();const channels=f[key].split(',').map(Number);if(channels.some(v=>v>255))fail();return channels;};
  if(f.STATUS!=='OK'||f.DETAIL!=='PLAYBACK_STATUS'||f.SCHEMA!=='1'||f.RID!==receiver.rid||f.DEVTYPE!==receiver.type||!/^([A-F0-9]{8})$/.test(f.INSTALLATION)||/^0+$/.test(f.INSTALLATION)||n('PORT',1,4)!==status.port||!['NONE','PENDING','SAVED','RESTORED','STORAGE_ERROR'].includes(f.PLAYBACKRESUME))fail();
  const mask=n('PORTMASK',1,isSPI?15:3);if(!(mask&(1<<(status.port-1))))fail();
  n('GEN',0,4294967295);const id=n('V30ID',0,isSPI?43:20),variant=n('VAR',0,255),fx=n('FX',0,isSPI?16:6),catalog=P.catalog(receiver.type);
  let entry=null;
  if(id)entry=id<=20?catalog.find(e=>e.state.v30Effect===V30[id-1]):id<=30?catalog.find(e=>e.state.previewFamily==='RGBW'&&e.state.variant===whole[id-21]):catalog.find(e=>R.wireId(e.state.v30Effect)===id);
  else if(fx)entry=catalog.find(e=>!e.state.v30Effect&&e.state.previewFamily!=='RGBW'&&e.state.variant===variant&&(isSPI?e.state.engine===SPI[fx]:rgbwEffect(e.state.engine)===fx));
  if((id||fx)&&!entry)fail();
  const state={...M.defaultState(),...(entry?copy(entry.state):{engine:'STATIC',variant:0,animation:'Vaste kleur'}),v30Effect:entry?.state.v30Effect||null,previewFamily:entry?.state.previewFamily||null,category:entry?.category||null,legacySpi:entry?.state.legacySpi===true};
  const prefix=id?'V30':'',count=n(prefix+'COLORS',1,id?7:4),palette=Array.from({length:id?7:4},(_,i)=>colour(prefix+'FG'+(i+1))).slice(0,count),background=colour(prefix+'BG'),brightness=n(prefix+'BRIGHT',0,100);
  Object.assign(state,{colors:palette.map(hex),whiteChannels:palette.map(c=>c[3]),rgbEnabled:palette.map(()=>true),whiteEnabled:palette.map(()=>true),colorCount:count,
   r:palette[0][0],g:palette[0][1],b:palette[0][2],w:palette[0][3],bri:brightness,brightness,
   speed:n(prefix+'SPEED',0,100),smooth:n(prefix+'SMOOTH',0,100),background:hex(background),backgroundWhite:background[3],backgroundOn:bool(prefix+'BGON'),
   bgBrightness:n(prefix+'BGBRIGHT',0,100)*(id?1:brightness/100),backgroundRgbEnabled:true,backgroundWhiteEnabled:true,direction:bool(prefix+'REVERSE')?'left':'right',on:brightness>0,power:brightness>0});
  const lines=n(prefix+'LINECOUNT',1,120);n(prefix+'LINEINDEX',0,lines-1);
  if(id){
   Object.assign(state,{fadeAmount:n('V30FADE',0,100),width:n('V30WIDTH',0,100),delayMs:n('V30DELAY',0,10000),brandColor:hex(colour('V30BRAND'))});
   n('V30TIME',0,Number.MAX_SAFE_INTEGER);n('V30PIXELS',1,8192);n('V30GROUP',1,8192);n('V30OFFSET',0,8191);bool('V30PARALLEL');
   if(id>=21&&id<=30)state.spacing=state.fadeAmount;
  }else if(isSPI){
   const random=n('RANDOM',0,255);
   Object.assign(state,{widthPixels:n('WIDTH',1,8192),spacing:n('SPACING',0,100),objectCount:n('OBJECTS',1,8),trailLength:n('TRAIL',0,100),spread:n('SPREAD',0,100),randomness:random&128?25:Math.min(random,100),lineDelayMs:random&128?(random&127)*40:0,bounce:bool('BOUNCE'),mirror:bool('MIRROR')});
   n('PHASEMS',0,999);n('POWERLIMIT',0,100);n('WHITEMIX',0,100);n('GROUP',1,8192);n('OFFSET',0,8191);bool('PARALLEL');
  }else{
   Object.assign(state,{lineDelayMs:n('LINEDELAY',0,60000),spacing:f.SPACING==='-1'?state.spacing:n('SPACING',0,100)});n('PHASEMS',0,999);
  }
  if(isSPI){const output=receiver.outputs.find(o=>o.port===status.port&&o.enabled);if(!output||n('PIXELS',1,1024)!==output.pixels||bool('PHYSREVERSE')!==output.reversed)fail();}
  return {state,mask,installation:f.INSTALLATION};
 }
 function restore(model,statuses,{standId}={}){
  M.assertValid(model);if(model.demo!==false||!Array.isArray(statuses)||statuses.length>120)fail();
  if(standId!==undefined&&(typeof standId!=='string'||!model.stands.some(stand=>stand.id===standId)))fail();
  const next=copy(model),seen=new Set(),installations=new Map();
  const receivers=standId===undefined?next.receivers:next.receivers.filter(receiver=>receiver.standId===standId);
  if(standId!==undefined&&!receivers.length)fail();
  for(const receiver of receivers){
   const rows=statuses.filter(s=>s?.receiverId===receiver.id).sort((a,b)=>a.port-b.port);if(!rows.length)fail();
   const values=rows.map(row=>{const key=row.receiverId+'/'+row.port;if(seen.has(key))fail();seen.add(key);return decode(receiver,row);});
   const first=values[0],expectedMask=receiver.type==='SPI'?receiver.outputs.reduce((v,o)=>v|(o.enabled?1<<(o.port-1):0),0):first.mask;
   if(values.some(v=>v.mask!==expectedMask||v.installation!==first.installation||receiver.type!=='SPI'&&JSON.stringify(v.state)!==JSON.stringify(first.state))||rows.reduce((v,s)=>v|(1<<(s.port-1)),0)!==expectedMask)fail();
   const prior=installations.get(receiver.standId);if(prior&&prior!==first.installation)fail();installations.set(receiver.standId,first.installation);
   receiver.state=first.state;
   if(receiver.type==='SPI'){
    const ports={};
    values.forEach((value,index)=>{
     const delta={};
     for(const key of Object.keys(value.state))if(!['bri','on','standAnimation','portStates'].includes(key)&&JSON.stringify(value.state[key])!==JSON.stringify(first.state[key]))delta[key]=copy(value.state[key]);
     if(Object.keys(delta).length)ports[String(rows[index].port)]=delta;
    });
    if(Object.keys(ports).length)receiver.state.portStates=ports;
   }
  }
  if(seen.size!==statuses.length)fail();return M.assertValid(next);
 }
 return Object.freeze({decode,restore});
});
