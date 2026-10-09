(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningV50Interactions=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function reorderPalette(state,from,to,count){
    if(!state||!Array.isArray(state.colors)||!Number.isInteger(count)||count<2||count>Math.min(8,state.colors.length)||![from,to].every(n=>Number.isInteger(n)&&n>=0&&n<count))throw new TypeError('PALETTE_ORDER_INVALID');
    const indices=Array.from({length:count},(_,i)=>i);indices.splice(to,0,indices.splice(from,1)[0]);
    const patch={};
    for(const [key,fallback] of [['colors','#000000'],['whiteChannels',0],['rgbEnabled',true],['whiteEnabled',true]]){
      if(!Array.isArray(state[key]))continue;
      patch[key]=indices.map(i=>state[key][i]??fallback).concat(state[key].slice(count));
    }
    if(state.rgbwLast&&typeof state.rgbwLast==='object'){
      patch.rgbwLast={...state.rgbwLast};
      indices.forEach((old,i)=>{delete patch.rgbwLast['palette'+i];if(state.rgbwLast['palette'+old])patch.rgbwLast['palette'+i]={...state.rgbwLast['palette'+old]};});
    }
    return patch;
  }
  function installPaletteDrag({document,onMove,onActivity=()=>{}}){
    let active=null;
    function finish(commit){
      const drag=active;if(!drag)return;active=null;
      drag.handle.removeAttribute('aria-grabbed');drag.rows.forEach(row=>row.removeAttribute('data-palette-drop'));
      if(drag.handle.hasPointerCapture?.(drag.pointerId))drag.handle.releasePointerCapture(drag.pointerId);
      onActivity(false);
      if(commit&&drag.handle.isConnected&&drag.to!==drag.from)onMove(drag.from,drag.to,drag.host);
    }
    document.addEventListener('pointerdown',event=>{
      const handle=event.target.closest?.('[data-palette-handle]');
      if(!handle||handle.disabled||event.button!==0||event.isPrimary===false||active)return;
      const host=handle.closest('.palette'),rows=[...host.querySelectorAll('[data-palette-item]')],from=rows.indexOf(handle.closest('[data-palette-item]'));
      if(rows.length<2||from<0)return;
      active={handle,host,rows,from,to:from,pointerId:event.pointerId};
      event.preventDefault();handle.setPointerCapture(event.pointerId);handle.setAttribute('aria-grabbed','true');onActivity(true);
    });
    document.addEventListener('pointermove',event=>{
      if(!active||event.pointerId!==active.pointerId)return;
      if(!active.handle.isConnected)return finish(false);
      let nearest=active.from,distance=Infinity;
      active.rows.forEach((row,index)=>{const rect=row.getBoundingClientRect(),d=Math.hypot(event.clientX-(rect.left+rect.width/2),event.clientY-(rect.top+rect.height/2));if(d<distance){distance=d;nearest=index;}});
      active.to=nearest;active.rows.forEach((row,index)=>row.toggleAttribute('data-palette-drop',index===nearest));event.preventDefault();
    });
    document.addEventListener('pointerup',event=>{if(active?.pointerId===event.pointerId)finish(true);});
    for(const type of ['pointercancel','lostpointercapture'])document.addEventListener(type,event=>{if(active?.pointerId===event.pointerId)finish(false);});
    document.addEventListener('keydown',event=>{
      const handle=event.target.closest?.('[data-palette-handle]');if(!handle)return;
      if(event.key==='Escape'){finish(false);return;}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||handle.disabled)return;
      const host=handle.closest('.palette'),rows=[...host.querySelectorAll('[data-palette-item]')],from=rows.indexOf(handle.closest('[data-palette-item]')),to=from+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1);
      if(to<0||to>=rows.length)return;event.preventDefault();onMove(from,to,host);
      host.querySelector(`[data-palette-item="${to}"] [data-palette-handle]`)?.focus({preventScroll:true});
    });
    return {isActive:()=>!!active,cancel:()=>finish(false)};
  }
  return Object.freeze({reorderPalette,installPaletteDrag});
});
