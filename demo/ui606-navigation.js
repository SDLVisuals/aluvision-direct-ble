(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.LightningSwipeBack=api;api.install(root.document,root);}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // A deliberate rightward edge gesture only. Sliders, LED previews, reorder
  // handles, text entry and ordinary vertical scrolling keep their own input.
  function intent(start,current){
    if(!start||!current)return 'cancel';
    const dx=current.x-start.x,dy=current.y-start.y,elapsed=current.time-start.time;
    if(![dx,dy,elapsed,start.x].every(Number.isFinite)||start.x<0||start.x>36||elapsed<0||elapsed>1400)return 'cancel';
    if(dx< -8||Math.abs(dy)>Math.max(16,Math.abs(dx)*.65))return 'cancel';
    if(dx>=88&&dx>Math.abs(dy)*2.2)return 'back';
    return dx>12&&dx>Math.abs(dy)*2.2?'track':'wait';
  }
  function install(doc,win){
    if(!doc?.addEventListener||!win?.addEventListener)return null;
    const navTrail=[];let gesture=null,returning=false,indicator=null;
    const excluded='input,textarea,select,button,a,summary,canvas,[contenteditable]:not([contenteditable="false"]),[role=slider],[data-order-handle],.colour-drag-handle,.palette,.receiver-chips,.animation-category-tabs,.v50-preview-canvas-scroll,.v50-full-canvas-scroll';
    // The active-animation shortcut shares its visual class with Back, but
    // opens settings: only explicit navigation actions count as a return.
    const galleryBack=['[data-action="family-back"]','[data-action="animation-gallery"]','[data-action="animations-gallery"]','[data-action="stand-animation-gallery"]'];
    const visible=node=>!!node&&node.isConnected&&!node.disabled&&node.getAttribute('aria-disabled')!=='true'&&!node.closest('[hidden],[inert]')&&node.getClientRects().length>0;
    function pick(host,selectors){for(const selector of selectors){const node=[...host.querySelectorAll(selector)].find(visible);if(node)return node;}return null;}
    function backTarget(){
      // Modal focus identifies the top layer even when dialogs were opened
      // in a different order to their position in the document.
      const dialog=doc.activeElement?.closest?.('dialog[open]')||[...doc.querySelectorAll('dialog[open]')].at(-1);
      if(dialog){
        if(dialog.matches('.v50-fullscreen-preview')||dialog.querySelector('.v50-full-preview'))return pick(dialog,['[data-action="effect-dialog-close"]']);
        // These editors own their lifecycle and busy guards. Invoke their
        // actual Back/Close control, never a generic save or cancel action.
        if(dialog.matches('.pixel-setup-dialog'))return pick(dialog,['[data-pixel-action="back"]','[data-pixel-action="close"]']);
        if(dialog.matches('[data-onboarding-zone-dialog]'))return pick(dialog,['[data-onboarding-action="zone-picker-close"]']);
        if(dialog.matches('.receiver-removal-sheet'))return pick(dialog,['[data-removal="close"]']);
        if(dialog.matches('.receiver-update-sheet'))return pick(dialog,['[data-update="close"]']);
        return pick(dialog,['[data-action="order-tutorial-close"]','[data-action="spatial-close"]',...galleryBack,'[data-action="effect-dialog-close"]','[data-action="close-help"]']);
      }
      const order=doc.querySelector('[data-order-open="true"]');
      if(order)return pick(order,['.ledline-setup-toggle[data-action="layout"]']);
      const main=doc.querySelector('#main');if(!main)return null;
      const onboarding=main.querySelector('[data-onboarding-stage]');
      if(onboarding)return pick(onboarding,['[data-onboarding-action="back"]','[data-onboarding-action="exit"]']);
      const back=pick(main,[...galleryBack,'.topline .back','.back-to-zones']);
      if(back)return back;
      const previous=navTrail.at(-1);
      return previous?pick(doc,['#navigation [data-action="nav"][data-id="'+previous+'"]']):null;
    }
    function reset(){gesture=null;if(indicator){indicator.remove();indicator=null;}}
    function show(dx){
      if(!indicator){indicator=doc.createElement('div');indicator.className='ui606-back-gesture';indicator.setAttribute('aria-hidden','true');indicator.textContent='‹';doc.body.append(indicator);}
      indicator.style.setProperty('--swipe-progress',String(Math.min(1,Math.max(0,dx/88))));
    }
    const point=touch=>({x:touch.clientX,y:touch.clientY,time:Date.now()});
    function start(event){
      reset();if(event.touches.length!==1||event.defaultPrevented||event.target.closest?.(excluded))return;
      const p=point(event.touches[0]),target=backTarget();if(!Number.isFinite(p.x)||p.x<0||p.x>36||!target)return;
      gesture={start:p,target,id:event.touches[0].identifier};
    }
    function move(event){
      if(!gesture)return;
      if(event.defaultPrevented||event.cancelable===false||event.touches.length!==1||event.touches[0].identifier!==gesture.id||!visible(gesture.target)||gesture.target!==backTarget()){reset();return;}
      const p=point(event.touches[0]),direction=intent(gesture.start,p);
      if(direction==='cancel'){reset();return;}
      if(direction==='track'||direction==='back'){if(event.cancelable)event.preventDefault();show(p.x-gesture.start.x);}
    }
    function end(event){
      const pending=gesture;if(!pending)return;
      const touch=[...event.changedTouches].find(item=>item.identifier===pending.id);
      const complete=!event.defaultPrevented&&event.cancelable!==false&&event.touches.length===0&&touch&&intent(pending.start,point(touch))==='back';
      reset();if(!complete||!visible(pending.target)||pending.target!==backTarget())return;
      if(event.cancelable)event.preventDefault();
      // Use the same guarded user action as the visible Back/Close button.
      // Never change a route, save, cancel a receiver job or dispatch light here.
      returning=true;
      if(pending.target.matches('#navigation [data-action="nav"]'))navTrail.pop();
      try{pending.target.click();}finally{returning=false;}
    }
    function nav(event){
      const button=event.target.closest?.('#navigation [data-action="nav"]');
      if(returning||!visible(button))return;
      const current=doc.querySelector('#navigation [aria-current="page"]')?.dataset.id;
      if(current&&current!==button.dataset.id&&navTrail.at(-1)!==current){navTrail.push(current);if(navTrail.length>20)navTrail.shift();}
    }
    doc.addEventListener('touchstart',start,{passive:true});
    doc.addEventListener('touchmove',move,{passive:false});
    doc.addEventListener('touchend',end,{passive:false});
    doc.addEventListener('touchcancel',reset,{passive:true});
    doc.addEventListener('pointercancel',reset,{passive:true});
    doc.addEventListener('click',nav,true);
    win.addEventListener('pagehide',reset);
    doc.addEventListener('visibilitychange',reset);
    return {destroy(){reset();doc.removeEventListener('touchstart',start);doc.removeEventListener('touchmove',move);doc.removeEventListener('touchend',end);doc.removeEventListener('touchcancel',reset);doc.removeEventListener('pointercancel',reset);doc.removeEventListener('click',nav,true);win.removeEventListener('pagehide',reset);doc.removeEventListener('visibilitychange',reset);}};
  }
  return Object.freeze({intent,install});
});
