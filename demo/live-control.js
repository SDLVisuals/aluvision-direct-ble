/* A single radio queue for firmware-confirmed light changes. The preview is
 * immediate; a relay or late reply never proves that LEDs emitted light. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LightningLiveControl = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const SPI_ENGINES=['STATIC','GRADIENT','BREATHE','CHASE','COMET','SCANNER','SPARKLE','WAVE','SEQUENCE','ALL','MIRROR','ALTERNATE','CASCADE','DUAL','FLOW','WARM','MINIMAL'];
  const RGBW_ENGINES=[...SPI_ENGINES,'PULSE','STROBE','SMOOTH'];
  const V30_EFFECTS=['rgb-jumping','seven-jumping','rgb-gradient','seven-gradient','tunnel-travel','tunnel-bounce','tunnel-center','tunnel-outside','tunnel-cascade','tunnel-handoff','tunnel-pulse','tunnel-echo','tunnel-pixel-curtain','tunnel-pixel-cross','brand-white-breathe','brand-warm-white','brand-accent','brand-sweep','brand-focus','brand-soft-gradient'].map(id=>'v30-'+id);
  const clone=value=>JSON.parse(JSON.stringify(value));
  // Full lighting intent. Geometry is deliberately not accepted from this
  // object; the native owner resolves it against its persisted receiver list.
  function requestFor(receiver,{zone,receivers}={}) {
    if(!receiver||!['RGBW','SPI'].includes(receiver.type))return null;
    const state=receiver.state||{},spi=receiver.type==='SPI';
    let extension=state.engine==='V30'||state.v30Effect;
    let extensionId=extension?V30_EFFECTS.indexOf(state.v30Effect)+1:0;
    if(extension&&(!extensionId||!spi&&[13,14].includes(extensionId)))return null;
    let engine=state.engine||'STATIC',variant=Number(state.variant??0);
    if(extension){engine='BREATHE';variant=0;}
    if(!(spi?SPI_ENGINES:RGBW_ENGINES).includes(engine)||!Number.isInteger(variant)||variant<0||variant>(spi?181:31))return null;
    if(spi&&state.previewFamily==='RGBW') {
      const whole=[0,1,2,3,4,17,18,19,20,25].indexOf(variant);
      if(whole<0)return null;
      extension=true;extensionId=21+whole;engine='BREATHE';variant=0;
    }
    const number=(value,fallback,min,max)=>{
      const n=Number(value??fallback);return Number.isFinite(n)&&n>=min&&n<=max?Math.round(n):null;
    };
    const colour=(hex,white,rgb=true,w=true)=>{
      if(typeof hex!=='string'||!/^#[a-f\d]{6}$/i.test(hex))return null;
      const neutral=number(white,0,0,255);if(neutral===null)return null;
      return [...(rgb===false?[0,0,0]:[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))),w===false?0:neutral];
    };
    const hex=state.colors?.length?state.colors:['#'+[state.r??0,state.g??0,state.b??0].map(n=>Math.max(0,Math.min(255,Number(n)||0)).toString(16).padStart(2,'0')).join('')];
    const count=engine==='STATIC'?1:number(state.colorCount,hex.length,1,extension&&extensionId<=20?7:4);
    if(count===null||count>hex.length)return null;
    const palette=hex.slice(0,count).map((c,i)=>colour(c,state.whiteChannels?.[i]??(i===0?state.w:0),state.rgbEnabled?.[i],state.whiteEnabled?.[i]));
    const background=colour(typeof state.background==='object'?state.background?.rgb:state.background??'#000000',state.backgroundWhite??state.background?.white??0,state.backgroundRgbEnabled,state.backgroundWhiteEnabled);
    if(palette.some(c=>!c)||!background)return null;
    const brightness=number(state.bri??state.brightness,100,0,100);
    const scene={engine,variant,palette,background,
      speed:number(state.speed,30,0,100),smooth:number(state.smooth,90,0,100),
      backgroundBrightness:number(state.bgBrightness,0,0,100),backgroundOn:state.backgroundOn===true,
      motionReverse:['left','reverse'].includes(state.direction),widthPixels:number(state.widthPixels,4,1,8192),
      spacing:number(state.spacing,50,0,100),objectCount:number(state.objectCount,1,1,8),
      trailLength:number(state.trailLength,45,0,100),spread:number(state.spread,50,0,100),
      randomness:number(state.randomness,25,0,100),bounce:state.bounce===true,mirror:state.mirror===true,
      lineDelayMs:number(state.lineDelayMs,0,0,5000)};
    if(state.on===false||state.power===false)scene.backgroundOn=false;
    if(extension){
      const brand=colour(state.brandColor||hex[0]||'#C94E46',0);
      scene.v30={effect:extensionId,fadeAmount:number(extensionId>=21?state.spacing:state.fadeAmount,90,0,100),
        width:number(state.width,65,0,100),delayMs:number(state.delayMs,300,0,10000),brand};
      if(Object.values(scene.v30).some(value=>value===null))return null;
      if(state.on===false||state.power===false)scene.backgroundOn=false;
    }
    if(brightness===null||Object.values(scene).some(value=>value===null))return null;
    return {standId:receiver.standId,receiverId:receiver.id,kind:spi?'SPI_SCENE':'RGBW_SCENE',
      brightness:state.on===false||state.power===false?0:brightness,transitionMs:0,channels:[],scene};
  }
  function create({send,sendBatch,onState,delay=0,setTimer=setTimeout,clearTimer=clearTimeout}) {
    if (typeof send !== 'function' || typeof onState !== 'function') throw Error('LIVE_QUEUE_INVALID');
    if (sendBatch!==undefined && typeof sendBatch!=='function') throw Error('LIVE_QUEUE_INVALID');
    const queue=new Map(), desired=new Map(), states=new Map();
    let active=null,draining=false,timer=null,version=0,epoch=0;
    const emit=(id,kind,code='')=>{const value={kind,code};states.set(id,value);onState(id,value);};
    const signature=request=>JSON.stringify(request);
    function schedule(){
      if(draining||timer!==null||!queue.size)return;
      timer=setTimer(()=>{timer=null;void drain();},delay);
    }
    async function drain(){
      if(draining)return;
      draining=true;
      try{
        while(queue.size){
          // App colour-wheel handlers enqueue the selected receivers together.
          // Take their latest values in insertion order, with one native owner
          // operation per stand. Never accumulate a gesture history.
          const items=new Map();let stand;
          for(const [id,item] of queue){
            if(desired.get(id)?.signature!==item.signature){queue.delete(id);continue;}
            if(items.size && (!sendBatch || item.request.standId!==stand))break;
            stand=item.request.standId;items.set(id,item);queue.delete(id);
            if(items.size===(sendBatch?30:1))break;
          }
          if(!items.size)continue;
          const runEpoch=epoch;
          active={items,epoch:runEpoch};
          let error=null,results;
          try{
            if(sendBatch && items.size>1){
              const reply=await sendBatch([...items.values()].map(item=>item.request));
              if(reply?.status!=='batch-complete'||!Array.isArray(reply.results)||reply.results.length!==items.size)
                throw Error('LIVE_UNCONFIRMED');
              results=new Map();
              for(const result of reply.results){
                if(!items.has(result?.receiverId)||results.has(result.receiverId))throw Error('LIVE_UNCONFIRMED');
                if(result.status==='applied-in-firmware'){
                  if(!Number.isSafeInteger(result.generation)||result.generation<1)throw Error('LIVE_UNCONFIRMED');
                }else if(!['unconfirmed','not-sent'].includes(result.status)||typeof result.code!=='string'||
                         !/^[A-Z][A-Z0-9_]{0,79}$/.test(result.code))throw Error('LIVE_UNCONFIRMED');
                results.set(result.receiverId,result);
              }
            }else{
              const [id,item]=items.entries().next().value,reply=await send(item.request);
              if(reply?.status!=='applied-in-firmware'||reply.receiverId!==id||
                 !Number.isSafeInteger(reply.generation)||reply.generation<1)throw Error('LIVE_UNCONFIRMED');
              results=new Map([[id,reply]]);
            }
          }catch(cause){error=cause?.code||cause?.message||'LIVE_UNCONFIRMED';}
          active=null;
          for(const [id,item] of items){
            if(epoch!==runEpoch||desired.get(id)?.signature!==item.signature)continue;
            const result=results?.get(id),code=error||(result.status==='applied-in-firmware'?'':result.code);
            emit(id,code?'failed':'applied',code||'');
          }
        }
      }finally{active=null;draining=false;schedule();}
    }
    function request(input){
      const copied=clone(input),id=copied.receiverId,sig=signature(copied);
      desired.set(id,{signature:sig,version:++version});
      if(active?.epoch===epoch&&active.items.get(id)?.signature===sig){queue.delete(id);emit(id,'pending');return;}
      queue.set(id,{request:copied,signature:sig});emit(id,'pending');schedule();
    }
    function preview(id){
      desired.set(id,{signature:null,version:++version});queue.delete(id);emit(id,'preview');
    }
    function clear(){
      epoch++;if(timer!==null)clearTimer(timer);timer=null;queue.clear();desired.clear();states.clear();
    }
    return Object.freeze({request,preview,clear,state:id=>states.get(id)||{kind:'idle',code:''}});
  }
  return Object.freeze({create,requestFor});
});
