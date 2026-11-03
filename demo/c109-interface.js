/* C109 interface: tells c109-interface.css when the top bar is still under
 * the safe area (clock, Dynamic Island). Presentation only. */
(function(){
  'use strict';
  const root=document.documentElement;let queued=false;
  function update(){
    queued=false;
    const bar=document.querySelector('header.brand-bar');
    const strip=parseFloat(getComputedStyle(document.body,'::before').height)||0;
    const top=!!bar&&strip>0&&bar.getClientRects().length>0&&bar.getBoundingClientRect().bottom>strip+1;
    root.classList.toggle('c109-bar-top',top);
  }
  const queue=()=>{if(!queued){queued=true;requestAnimationFrame(update);}};
  addEventListener('scroll',queue,{passive:true});addEventListener('resize',queue);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue();
  // Page changes can move the bar without a scroll event.
  new MutationObserver(queue).observe(document.body,{childList:true});

  /* ---------- Starting an animation: the receivers synchronise ---------- */
  // The native app schedules a shared start a little ahead (its "lead", about
  // 12 s). When it reports that lead, a card shows the wait with a progress
  // bar. It says the receivers are synchronising, never that the light changed;
  // nothing is shown without a reported lead, and a failure simply hides it.
  //   document.dispatchEvent(new CustomEvent('lightning:animation-sync',{detail:{leadMs:12000}}))
  //   document.dispatchEvent(new CustomEvent('lightning:animation-sync',{detail:{done:true}}))
  const copy=(key,params)=>{let value=key;try{const c=window.LightningUICopy,l=root.lang||'nl';if(c?.has(key))value=c.t(key,l);}catch(_){}
    return params?value.replace(/\{(\w+)\}/g,(m,k)=>Object.prototype.hasOwnProperty.call(params,k)?String(params[k]):m):value;};
  let sync=null;
  function hideSync(){
    if(!sync)return;const {card,timer}=sync;sync=null;clearInterval(timer);
    card.classList.add('is-leaving');setTimeout(()=>card.remove(),260);
  }
  function showSync(leadMs){
    if(!Number.isFinite(leadMs)||leadMs<=0||leadMs>30000)return hideSync();
    if(sync){clearInterval(sync.timer);sync.card.remove();sync=null;}
    const card=document.createElement('div');card.className='c109-sync';card.setAttribute('role','status');card.setAttribute('aria-live','polite');
    card.innerHTML='<span class="c109-sync-icon" aria-hidden="true"></span><span class="c109-sync-copy"><b></b><small></small></span><span class="c109-sync-bar" aria-hidden="true"><i></i></span>';
    card.querySelector('b').textContent=copy('Animatie synchroniseren');
    document.body.append(card);
    const ends=Date.now()+leadMs,bar=card.querySelector('.c109-sync-bar>i'),note=card.querySelector('small');
    const tick=()=>{
      const left=Math.max(0,ends-Date.now());
      note.textContent=copy('De receivers starten samen over {seconds} s.',{seconds:Math.ceil(left/1000)});
      if(reducedMotion())bar.style.width=(100-left/leadMs*100)+'%';
      if(left<=0)hideSync();
    };
    sync={card,timer:setInterval(tick,250)};tick();
    if(!reducedMotion()){bar.style.transition='none';bar.style.width='0%';void bar.offsetWidth;bar.style.transition='width '+leadMs+'ms linear';bar.style.width='100%';}
  }
  const reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  document.addEventListener('lightning:animation-sync',event=>{const detail=event.detail||{};if(detail.done||detail.failed)hideSync();else showSync(Number(detail.leadMs));});
}());
