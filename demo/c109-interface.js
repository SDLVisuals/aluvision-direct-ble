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

  /* ---------- Colour pickers: the brightness track fills up ---------- */
  const fill=input=>input.style.setProperty('--fill',((Number(input.value)-Number(input.min||0))/((Number(input.max||100)-Number(input.min||0))||1)*100)+'%');
  const fillAll=()=>document.querySelectorAll('.shared-colour-picker input[data-setting="bri"]').forEach(fill);
  document.addEventListener('input',event=>{if(event.target?.matches?.('.shared-colour-picker input[data-setting="bri"]'))fill(event.target);},true);
  // The app also sets the value itself (another zone, a preset): check now and then.
  setInterval(()=>{if(!document.hidden)fillAll();},400);
  let fillQueued=false;
  new MutationObserver(()=>{if(!fillQueued){fillQueued=true;requestAnimationFrame(()=>{fillQueued=false;fillAll();});}}).observe(document.body,{childList:true,subtree:true});

  /* ---------- Alles bedienen: the scope line goes under "Hele stand" ---------- */
  function scopeIntoPowerCard(){
    const sheet=document.querySelector('#effect-dialog [data-stand-control-sheet]');if(!sheet)return;
    const scope=sheet.querySelector('.stand-control-scope'),card=sheet.querySelector('.power-card-stand>div:first-child');if(!scope||!card)return;
    let line=card.querySelector('.c109-scope');
    if(!line){line=document.createElement('small');line.className='c109-scope';card.append(line);}
    if(line.textContent!==scope.textContent)line.textContent=scope.textContent;
  }
  let scopeQueued=false;
  new MutationObserver(()=>{if(!scopeQueued){scopeQueued=true;requestAnimationFrame(()=>{scopeQueued=false;scopeIntoPowerCard();});}}).observe(document.body,{childList:true,subtree:true});

  /* ---------- No zooming: pinch and double-tap stay on the app ---------- */
  for(const name of ['gesturestart','gesturechange'])document.addEventListener(name,event=>event.preventDefault(),{passive:false});
  document.addEventListener('touchmove',event=>{if(event.touches?.length>1)event.preventDefault();},{passive:false});

  /* ---------- Start colour: hand over to the app's theme ---------- */
  // c109-early.js painted the saved theme's background before the styles
  // loaded; once the app sets its theme, the app's own colours take over.
  function themeReady(){
    const theme=document.body?.dataset.theme;if(!theme)return;
    root.style.backgroundColor=theme==='dark'?'#131512':'#f5f4f2';root.style.colorScheme=theme==='dark'?'dark':'light';
  }
  const watchTheme=()=>{themeReady();new MutationObserver(themeReady).observe(document.body,{attributes:true,attributeFilter:['data-theme']});};
  if(document.body)watchTheme();else document.addEventListener('DOMContentLoaded',watchTheme,{once:true});

  /* ---------- Receiver page: outputs open with the receiver ---------- */
  // Opening an SPI receiver shows its outputs, pixels, sides and order
  // straight away instead of behind one more menu.
  // Pixels: once the ledline has been swiped, its moving finger hint goes.
  document.addEventListener('pointerdown',event=>{
    const scrub=event.target instanceof Element&&event.target.closest('[data-pixel-scrub]');if(scrub)scrub.dataset.c109Swiped='';
  },true);
  document.addEventListener('toggle',event=>{
    const card=event.target;if(!(card instanceof HTMLDetailsElement)||!card.open||!card.matches('.receiver-overview-card'))return;
    const outputs=card.querySelector('details.receiver-connections');if(outputs&&!outputs.open)outputs.open=true;
  },true);
}());
