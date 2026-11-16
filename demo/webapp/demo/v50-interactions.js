(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningV50Interactions=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function reorderPalette(state,from,to,count){
    if(!state||!Array.isArray(state.colors)||!Number.isInteger(count)||count<2||count>Math.min(8,state.colors.length)||![from,to].every(n=>Number.isInteger(n)&&n>=0&&n<count))throw new TypeError('PALETTE_ORDER_INVALID');
    // Exchange the chosen pair only. Intermediate colours keep their slots,
    // including their independent white channels and remembered channel mix.
    const indices=Array.from({length:count},(_,i)=>i);[indices[from],indices[to]]=[indices[to],indices[from]];
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
    if(!document||typeof document.addEventListener!=='function'||typeof onMove!=='function')throw new TypeError('PALETTE_DRAG_INVALID');
    let active=null,suppressClick=null;
    const items=host=>[...host.querySelectorAll('[data-palette-item]')].filter(row=>row.closest('.palette')===host);
    function valid(drag){
      const rows=items(drag.host);
      return drag.host.isConnected&&drag.handle.isConnected&&rows.length===drag.rows.length&&rows.every((row,index)=>row.isConnected&&row===drag.rows[index]);
    }
    function clean(drag){
      drag.handle.removeAttribute('aria-grabbed');drag.host.removeAttribute('data-palette-swap-active');
      drag.rows.forEach(row=>{
        row.removeAttribute('data-palette-drop');row.removeAttribute('data-palette-swap-source');row.removeAttribute('data-palette-swap-target');
        row.style.removeProperty('--palette-swap-x');row.style.removeProperty('--palette-swap-y');
      });
      try{if(drag.handle.hasPointerCapture?.(drag.pointerId))drag.handle.releasePointerCapture(drag.pointerId);}catch(_){/* A detached source can have lost capture already. */}
    }
    function focus(host,index){host.querySelector(`[data-palette-item="${index}"] [data-palette-handle]`)?.focus({preventScroll:true});}
    function preview(drag){
      // Presentation only: transforms exchange two cards without reordering
      // DOM, editing state, applying light or shifting the remaining colours.
      drag.host.setAttribute('data-palette-swap-active','true');
      drag.rows.forEach((row,index)=>{
        const destination=index===drag.from?drag.to:index===drag.to?drag.from:index,from=drag.layout[index],to=drag.layout[destination];
        row.style.setProperty('--palette-swap-x',(to.left-from.left)+'px');row.style.setProperty('--palette-swap-y',(to.top-from.top)+'px');
        row.toggleAttribute('data-palette-drop',index===drag.to);
        row.toggleAttribute('data-palette-swap-source',index===drag.from);
        row.toggleAttribute('data-palette-swap-target',drag.to!==drag.from&&index===drag.to);
      });
    }
    function finish(commit){
      const drag=active;if(!drag)return;active=null;
      const canCommit=commit&&valid(drag)&&drag.to!==drag.from;
      clean(drag);
      if(canCommit)suppressClick={host:drag.host,until:Date.now()+800};
      try{if(canCommit){onMove(drag.from,drag.to,drag.host);focus(drag.host,drag.to);}}
      finally{onActivity(false);}
    }
    document.addEventListener('pointerdown',event=>{
      if(event.button===0&&event.isPrimary!==false)suppressClick=null;
      const handle=event.target.closest?.('[data-palette-handle]');
      if(!handle||handle.disabled||event.button!==0||event.isPrimary===false||active)return;
      const host=handle.closest('.palette');if(!host)return;
      const rows=items(host),from=rows.indexOf(handle.closest('[data-palette-item]'));
      if(rows.length<2||from<0)return;
      const layout=rows.map(row=>row.getBoundingClientRect()),origin=host.getBoundingClientRect();
      if(layout.some(rect=>![rect.left,rect.top,rect.width,rect.height].every(Number.isFinite)||rect.width<=0||rect.height<=0))return;
      active={handle,host,rows,layout,origin,from,to:from,pointerId:event.pointerId};
      event.preventDefault();
      try{handle.setPointerCapture?.(event.pointerId);}catch(_){/* Document listeners still track the pointer. */}
      handle.setAttribute('aria-grabbed','true');preview(active);onActivity(true);
    });
    document.addEventListener('pointermove',event=>{
      if(!active||event.pointerId!==active.pointerId)return;
      if(!valid(active))return finish(false);
      if(!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return;
      const origin=active.host.getBoundingClientRect(),x=event.clientX-(origin.left-active.origin.left),y=event.clientY-(origin.top-active.origin.top);
      let nearest=active.from,distance=Infinity;
      active.layout.forEach((rect,index)=>{const d=Math.hypot(x-(rect.left+rect.width/2),y-(rect.top+rect.height/2));if(d<distance){distance=d;nearest=index;}});
      if(active.to!==nearest){active.to=nearest;preview(active);}event.preventDefault();
    });
    document.addEventListener('pointerup',event=>{if(active?.pointerId===event.pointerId)finish(true);});
    for(const type of ['pointercancel','lostpointercapture'])document.addEventListener(type,event=>{if(active?.pointerId===event.pointerId)finish(false);});
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&active){event.preventDefault();event.stopPropagation();finish(false);return;}
      const handle=event.target.closest?.('[data-palette-handle]');if(!handle)return;
      if(active||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||handle.disabled||event.altKey||event.ctrlKey||event.metaKey)return;
      const host=handle.closest('.palette');if(!host)return;
      const rows=items(host),from=rows.indexOf(handle.closest('[data-palette-item]')),to=from+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1);
      if(from<0||to<0||to>=rows.length)return;event.preventDefault();onMove(from,to,host);
      focus(host,to);
    },true);
    document.addEventListener('click',event=>{
      if(!suppressClick)return;
      if(Date.now()>suppressClick.until){suppressClick=null;return;}
      if(event.detail!==0&&event.target.closest?.('.palette')===suppressClick.host){event.preventDefault();event.stopImmediatePropagation();suppressClick=null;}
    },true);
    return {isActive:()=>!!active,cancel:()=>finish(false)};
  }
  return Object.freeze({reorderPalette,installPaletteDrag});
});
