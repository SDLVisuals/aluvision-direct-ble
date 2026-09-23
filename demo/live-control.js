/* A single radio queue for firmware-confirmed light changes. The preview is
 * immediate; a relay or late reply never proves that LEDs emitted light. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LightningLiveControl = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  function create({send,onState,delay=100,setTimer=setTimeout,clearTimer=clearTimeout}) {
    if (typeof send !== 'function' || typeof onState !== 'function') throw Error('LIVE_QUEUE_INVALID');
    const queue=new Map(), desired=new Map(), states=new Map();
    let active=null,draining=false,timer=null,version=0;
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
          const [id,item]=queue.entries().next().value;queue.delete(id);
          if(desired.get(id)?.signature!==item.signature)continue;
          active={id,signature:item.signature};
          let error=null;
          try{
            const reply=await send(item.request);
            if(reply?.status!=='applied-in-firmware'||reply.receiverId!==id||
               !Number.isSafeInteger(reply.generation)||reply.generation<1)throw Error('LIVE_UNCONFIRMED');
          }catch(cause){error=cause?.code||cause?.message||'LIVE_UNCONFIRMED';}
          active=null;
          if(desired.get(id)?.signature===item.signature)emit(id,error?'failed':'applied',error||'');
        }
      }finally{active=null;draining=false;schedule();}
    }
    function request(input){
      const copied={...input,channels:[...input.channels]},id=copied.receiverId,sig=signature(copied);
      desired.set(id,{signature:sig,version:++version});
      if(active?.id===id&&active.signature===sig){queue.delete(id);emit(id,'pending');return;}
      queue.set(id,{request:copied,signature:sig});emit(id,'pending');schedule();
    }
    function preview(id){
      desired.set(id,{signature:null,version:++version});queue.delete(id);emit(id,'preview');
    }
    function clear(){
      if(timer!==null)clearTimer(timer);timer=null;queue.clear();desired.clear();states.clear();
    }
    return Object.freeze({request,preview,clear,state:id=>states.get(id)||{kind:'idle',code:''}});
  }
  return Object.freeze({create});
});
