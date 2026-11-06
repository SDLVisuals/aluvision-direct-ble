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
    if(!sync)return;const {card,timer}=sync;
    // A stand animation that aligns quickly still shows its card long enough to read.
    const wait=sync.joining?Math.max(0,sync.shownAt+1400-Date.now()):0;
    if(wait){clearTimeout(sync.later);sync.later=setTimeout(hideSync,wait);return;}
    sync=null;clearInterval(timer);
    card.classList.add('is-leaving');setTimeout(()=>card.remove(),260);
  }
  function syncCard(title){
    if(sync){clearInterval(sync.timer);clearTimeout(sync.later);sync.card.remove();sync=null;}
    const card=document.createElement('div');card.className='c109-sync';card.setAttribute('role','status');card.setAttribute('aria-live','polite');
    card.innerHTML='<span class="c109-sync-icon" aria-hidden="true"></span><span class="c109-sync-copy"><b></b><small></small></span><span class="c109-sync-bar" aria-hidden="true"><i></i></span>';
    card.querySelector('b').textContent=copy(title);
    // An open modal sheet (Alles bedienen) sits in the top layer: show the
    // card inside it, or it would stay hidden behind the sheet.
    const sheet=[...document.querySelectorAll('dialog[open]')].reverse().find(d=>d.matches(':modal'));
    if(sheet)card.classList.add('in-sheet');(sheet||document.body).append(card);return card;
  }
  // C111: a stand animation has no reported lead; the bar runs without a
  // countdown until the stand answers.
  function showJoining(){
    if(sync&&!sync.joining)return;
    const card=syncCard('Standanimatie synchroniseren');card.classList.add('is-joining');
    card.querySelector('small').textContent=copy('Alle receivers worden op één tijd afgestemd.');
    sync={card,timer:0,joining:true,shownAt:Date.now()};
  }
  function showSync(leadMs){
    if(!Number.isFinite(leadMs)||leadMs<=0||leadMs>30000)return hideSync();
    const card=syncCard('Animatie synchroniseren');
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
  // The sheet closes while the receivers still sync: the card moves to the page.
  document.addEventListener('close',event=>{
    if(sync&&event.target instanceof Element&&event.target.contains(sync.card)){sync.card.classList.remove('in-sheet');document.body.append(sync.card);}
  },true);
  document.addEventListener('lightning:animation-sync',event=>{const detail=event.detail||{};if(detail.done||detail.failed)hideSync();else if(detail.joining)showJoining();else showSync(Number(detail.leadMs));});

  /* ---------- Colour pickers: the brightness track fills up ---------- */
  const fill=input=>input.style.setProperty('--fill',((Number(input.value)-Number(input.min||0))/((Number(input.max||100)-Number(input.min||0))||1)*100)+'%');
  // C109: every brightness slider in the app has the same yellow fill.
  // C109: every slider shows how far it is filled (same look everywhere).
  const BRIGHTNESS='input[type=range]';
  const fillAll=()=>document.querySelectorAll(BRIGHTNESS).forEach(fill);
  document.addEventListener('input',event=>{if(event.target?.matches?.(BRIGHTNESS))fill(event.target);},true);
  // The app also sets the value itself (another zone, a preset): check now and then.
  setInterval(()=>{if(!document.hidden)fillAll();},400);
  let fillQueued=false;
  new MutationObserver(()=>{if(!fillQueued){fillQueued=true;requestAnimationFrame(()=>{fillQueued=false;fillAll();});}}).observe(document.body,{childList:true,subtree:true});

  /* ---------- Alles bedienen: the scope line goes under "Hele stand" ---------- */
  function scopeIntoPowerCard(){
    const sheet=document.querySelector('#effect-dialog [data-stand-control-sheet]');if(!sheet)return;
    const scope=sheet.querySelector('.stand-control-scope'),card=sheet.querySelector('.power-card-stand>div:first-child');if(!scope||!card)return;
    // C109: the zones as small chips (type icon + name) instead of a sentence.
    const zones=[...document.querySelectorAll('#main .stand-page article.zone-entry')].map(article=>({
      name:article.querySelector('.zone-card-heading>b')?.textContent.trim()||'',type:/SPI/.test(article.querySelector('.zone-family-badge')?.textContent||'')?'spi':'rgbw'})).filter(zone=>zone.name);
    const key=zones.length?JSON.stringify(zones):scope.textContent;
    let line=card.querySelector('.c109-scope');
    if(!line){line=document.createElement('span');line.className='c109-scope';card.append(line);}
    if(line.dataset.key===key)return;line.dataset.key=key;
    if(!zones.length){line.textContent=scope.textContent;return;}
    line.replaceChildren(...zones.map(zone=>{const chip=document.createElement('span');chip.className='c109-zone-chip';chip.dataset.type=zone.type;
      const glyph=document.createElement('i');glyph.setAttribute('aria-hidden','true');const name=document.createElement('b');name.textContent=zone.name;chip.append(glyph,name);return chip;}));
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
  // Receiver picture: tapping a ledline makes that port blink (the same
  // action as its hidden Knipperen button); a port that is off opens Pixels.
  document.addEventListener('click',event=>{
    const canvas=event.target instanceof Element&&event.target.closest('canvas[data-product-receiver][data-compact="false"]');if(!canvas)return;
    let centres=[];try{centres=JSON.parse(canvas.dataset.portCentres||'[]');}catch(_){return;}
    const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;
    const near=centres.filter(c=>y>=c.top-.12&&y<=c.bottom+.06).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x))[0];
    if(!near||Math.abs(near.x-x)>.11)return;
    const card=canvas.closest('[data-receiver-detail]'),id=canvas.dataset.productReceiver;
    const blink=card?.querySelector(`[data-action="port-identify"][data-receiver="${CSS.escape(id)}"][data-port="${near.port}"]`);
    (blink||card?.querySelector(`.port-chip109[data-ports="${near.port}"]`))?.click();
  });
  // Zone screen: Kleur, Verloop (SPI) and Animaties are one row. Verloop is
  // the colour screen in its gradient mode; Kleur is the same screen in solid.
  const modeChoice=mode=>document.querySelector(`#main [data-gradient-mode-choice="${mode}"]`);
  function syncModeTabs(){
    wrapModeLabels();
    const tabs=document.querySelector('#main .control-mode-tabs');if(!tabs)return;
    const colour=tabs.querySelector('[data-action="colour"]'),gradient=tabs.querySelector('[data-action="colour-gradient109"]');if(!gradient)return;
    const workspace=document.querySelector('#main [data-gradient-workspace]'),inColour=colour?.getAttribute('aria-pressed')==='true'||!!workspace;
    const isGradient=inColour&&workspace?.dataset.gradientMode==='gradient';
    gradient.setAttribute('aria-pressed',String(isGradient));
    if(colour&&inColour)colour.setAttribute('aria-pressed',String(!isGradient));
    tabs.dataset.c109Mode=isGradient?'gradient':colour?.getAttribute('aria-pressed')==='true'?'colour':'animations';
  }
  function whenRendered(test,then,tries=20){if(test())return then();if(tries>0)setTimeout(()=>whenRendered(test,then,tries-1),60);}
  document.addEventListener('click',event=>{
    const button=event.target instanceof Element&&event.target.closest('#main .control-mode-tabs>button');if(!button)return;
    if(button.dataset.action==='colour-gradient109'){
      event.preventDefault();event.stopPropagation();
      const choose=()=>{const target=modeChoice('gradient');if(target&&target.getAttribute('aria-pressed')!=='true')target.click();setTimeout(syncModeTabs,30);};
      if(modeChoice('gradient'))return choose();
      button.closest('.control-mode-tabs').querySelector('[data-action="colour"]')?.click();
      whenRendered(()=>!!modeChoice('gradient'),choose);return;
    }
    if(button.dataset.action==='colour'){
      const solid=modeChoice('solid');
      if(solid&&solid.getAttribute('aria-pressed')!=='true'){event.preventDefault();event.stopPropagation();solid.click();setTimeout(syncModeTabs,30);}
      // Coming from Animaties: the colour screen opens in its last mode; Kleur
      // means a solid colour, so switch it once the screen is there.
      else if(!solid&&button.closest('.control-mode-tabs')?.querySelector('[data-action="colour-gradient109"]'))
        whenRendered(()=>!!modeChoice('solid'),()=>{const choice=modeChoice('solid');if(choice&&choice.getAttribute('aria-pressed')!=='true')choice.click();setTimeout(syncModeTabs,30);});
    }
  },true);
  // The dock's own scrolled flag is not set on every screen; the mode row
  // turns into icons as soon as the page has scrolled under the dock.
  // Hysteresis: the row folds at 72 px and unfolds below 36 px, so it never
  // flickers between both states while the finger rests near the edge.
  // C109: the row folds exactly when the dock docks at the top (its own
  // sticky position), so docking and folding are one movement; it unfolds
  // once the dock has clearly left that position again.
  function markStuck(){const dock=document.querySelector('#main .control-preview-dock');if(!dock)return;const stuck=dock.hasAttribute('data-c109-stuck');
    // C109ah: only a bar that really sticks to the top folds (landscape keeps
    // the picture in its own column and simply scrolls).
    if(getComputedStyle(dock).position!=='sticky'){if(stuck)foldLabels(dock,false);return;}
    const rest=parseFloat(getComputedStyle(dock).top)||0,top=dock.getBoundingClientRect().top,docked=window.scrollY>8&&top<=rest+1;
    if(!stuck&&docked)foldLabels(dock,true);else if(stuck&&(window.scrollY<=8||top>rest+14))foldLabels(dock,false);}
  // The width is measured at the moment of folding, in the engine that draws
  // it (WebKit measures a little wider than Chrome), and handed back as
  // "none" once open, so a word is never cut short or shown with "…".
  // C109ww: "Bekijk als" and "Volgorde" move up into the ledline picture
  // without adding buttons: the view name above the picture becomes the
  // Bekijk-als chip, and Volgorde is one round icon next to Alle / Bekijk.
  // Both simply press the original controls, which stay the single source.
  function syncViewTools(){
    const dock=document.querySelector('#main .control-preview-dock');if(!dock)return;
    const spatial=document.querySelector('#main .spatial-choice-toggle'),order=document.querySelector('#main .ledline-setup-toggle[data-action=layout]');
    const heading=dock.querySelector('.v50-preview-heading');
    if(heading&&spatial&&!heading.querySelector('.c109-view-chip')){
      const chip=document.createElement('button');chip.type='button';chip.className='c109-view-chip';
      const name=heading.querySelector(':scope>span')?.textContent.trim()||'';
      chip.setAttribute('aria-label',(spatial.getAttribute('aria-label')||spatial.textContent.trim()).replace(/\s+/g,' '));
      chip.innerHTML='<span class="c109-view-ic" aria-hidden="true"></span><b></b><svg class="c109-view-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      const glyph=spatial.querySelector('.spatial-choice-current-icon svg');if(glyph)chip.firstChild.append(glyph.cloneNode(true));
      chip.querySelector('b').textContent=name;
      chip.addEventListener('click',()=>document.querySelector('#main .spatial-choice-toggle')?.click());
      heading.prepend(chip);heading.classList.add('has-c109-chip');
    }
    if(order&&!dock.querySelector('.c109-order-btn')){
      const button=document.createElement('button');button.type='button';button.className='c109-order-btn';
      button.setAttribute('aria-label',order.getAttribute('aria-label')||order.textContent.trim());
      button.innerHTML=order.querySelector('svg')?.outerHTML||'';
      button.addEventListener('click',()=>{const original=document.querySelector('#main .ledline-setup-toggle[data-action=layout]');if(!original)return;
        if(original.getAttribute('aria-expanded')!=='true')original.click();
        setTimeout(()=>document.querySelector('#main .ledline-setup.ui606-line-tools')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'}),120);});
      const toolbar=dock.querySelector('.v50-preview-toolbar'),host=toolbar||dock.querySelector('.preview-size-row');
      if(host)host.insertBefore(button,toolbar?toolbar.querySelector('.v50-preview-expand'):null);
    }
    document.body.classList.toggle('c109-view-tools',!!(dock.querySelector('.c109-view-chip')||dock.querySelector('.c109-order-btn')));
  }
  let viewQueued=false;
  new MutationObserver(()=>{if(!viewQueued){viewQueued=true;requestAnimationFrame(()=>{viewQueued=false;syncViewTools();});}}).observe(document.body,{childList:true,subtree:true});
  // C109xx: the "stand bewaren" strip becomes a small capsule with a ring;
  // the ring follows the app's own progress (bar width) or turns while the
  // number of receivers is not known yet.
  function syncSaveRing(){
    const strip=document.querySelector('[data-context-progress-c114]');if(!strip)return;
    const bar=strip.querySelector('[data-context-progress-bar]'),text=strip.querySelector('[data-context-progress-text]')?.textContent||'';
    const known=/\d+\/\d+/.test(text),value=parseFloat(bar?.style.width)||0;
    const next=String(known?value:25);if(strip.style.getPropertyValue('--c109-p')!==next)strip.style.setProperty('--c109-p',next);
    if(strip.hasAttribute('data-c109-spin')===known)strip.toggleAttribute('data-c109-spin',!known);
    if(!strip.c109Watched){strip.c109Watched=true;new MutationObserver(syncSaveRing).observe(strip,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style']});}
  }
  new MutationObserver(()=>{if(document.querySelector('[data-context-progress-c114]'))syncSaveRing();}).observe(document.body,{childList:true});
  // C109yy: one press feel for the whole app. A press sinks at once, the
  // release springs back past its size and settles (the CSS 'scale' property,
  // so it never fights an element's own transform). Every deliberate tap also
  // gives a light haptic tick through the existing native channel; main
  // actions a firmer tap; sliders tick while they move. Browser/demo: no-op.
  const pressSelector='button,summary,[role=button],[role=tab],[role=switch],a.button,label.switch';
  let pressed=null,pressX=0,pressY=0;
  const reduceMotion=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
  document.addEventListener('pointerdown',event=>{
    if(event.button!==0||reduceMotion())return;
    const element=event.target.closest?.(pressSelector);
    if(!element||element.disabled||element.getAttribute('aria-disabled')==='true'||element.closest('[data-c109-nopress],input[type=range]'))return;
    pressed=element;pressX=event.clientX;pressY=event.clientY;element.classList.remove('c109-release');element.classList.add('c109-press');
  },{capture:true,passive:true});
  const letGo=bounce=>{if(!pressed)return;const element=pressed;pressed=null;element.classList.remove('c109-press');
    if(!bounce)return;void element.offsetWidth;element.classList.add('c109-release');setTimeout(()=>element.classList.remove('c109-release'),560);};
  document.addEventListener('pointermove',event=>{if(pressed&&Math.hypot(event.clientX-pressX,event.clientY-pressY)>12)letGo(false);},{capture:true,passive:true});
  document.addEventListener('pointerup',()=>letGo(true),{capture:true,passive:true});
  document.addEventListener('pointercancel',()=>letGo(false),{capture:true,passive:true});
  addEventListener('scroll',()=>letGo(false),{passive:true,capture:true});
  const haptic=(kind,key,options)=>{try{return window.LightningInterfaceHaptics?.emit?.(kind,key,options)===true;}catch(_){return false;}};
  const firmTap=':is(.button.primary,.colour-picker-done,.animation-start-action,.stand-power109,[data-action=nav],[data-action=power],.c109-order-btn,[data-action=stand-control-mode],.control-mode-tabs>button)';
  document.addEventListener('click',event=>{
    const element=event.target.closest?.(pressSelector);if(!element||element.disabled)return;
    const key='tap:'+(element.dataset.action||element.className.split(' ')[0]||element.tagName).slice(0,60);
    haptic(element.matches(firmTap)?'impact':'selection',key,{event});
  });
  document.addEventListener('change',event=>{
    if(event.isTrusted&&event.target.matches?.('input[type=checkbox],input[type=radio]'))haptic('selection','toggle',{userInitiated:true});
  });
  const rangeStep=new WeakMap();
  document.addEventListener('input',event=>{
    const range=event.target;if(!event.isTrusted||!range.matches?.('input[type=range]'))return;
    const min=+range.min||0,max=range.max===''?100:+range.max,span=max-min||1,value=+range.value,step=Math.round((value-min)/span*10);
    if(rangeStep.get(range)===step)return;rangeStep.set(range,step);
    haptic(step===0||step===10?'impact':'selection','range',{userInitiated:true});
  });
  // C109tt: a tap on a ledline re-renders the dock. If the bar was folded,
  // the new dock starts folded too (no flash of the open view, no jump).
  let foldedBefore=false;
  function keepFolded(){
    const dock=document.querySelector('#main .control-preview-dock');if(!dock)return;
    const badge=dock.querySelector('.control-dock-type-badge')?.textContent||'',actions=dock.querySelector('.control-dock-actions');
    if(actions&&badge){const type=/spi/i.test(badge)?'SPI':'RGBW';if(actions.dataset.c109Type!==type)actions.dataset.c109Type=type;}
    if(!foldedBefore||dock.hasAttribute('data-c109-stuck')||window.scrollY<=8||getComputedStyle(dock).position!=='sticky')return;
    wrapModeLabels();
    const before=dock.offsetHeight;dock.setAttribute('data-c109-measure','');dock.setAttribute('data-c109-stuck','');
    const after=dock.offsetHeight,base=parseFloat(getComputedStyle(dock).marginBottom)||0;dock.style.marginBottom=Math.max(0,base+before-after)+'px';
    syncPill();requestAnimationFrame(()=>requestAnimationFrame(()=>dock.removeAttribute('data-c109-measure')));
  }
  function foldLabels(dock,fold){
    foldedBefore=fold;
    // C109jj: the folded bar drops its extra text, so it gets shorter; a
    // matching bottom margin keeps the page under it exactly where it was.
    if(fold){const before=dock.offsetHeight;dock.setAttribute('data-c109-measure','');dock.setAttribute('data-c109-stuck','');const after=dock.offsetHeight;dock.removeAttribute('data-c109-stuck');dock.offsetHeight;dock.removeAttribute('data-c109-measure');dock.offsetHeight;
      const base=parseFloat(getComputedStyle(dock).marginBottom)||0;dock.style.marginBottom=Math.max(0,base+before-after)+'px';}
    else dock.style.marginBottom='';
    // C109kk: folded, the mode buttons become separate round buttons; their
    // width glides from the open size to a circle and back, the pill follows.
    // C109nn: the capsules get a real width (px to px), so they shrink and
    // grow continuously; the group stays centred the whole way.
    const modeButtons=[...dock.querySelectorAll('.control-mode-tabs>button')],modeTabs=dock.querySelector('.control-mode-tabs');
    if(fold){dock.c109Widths=modeButtons.map(button=>button.getBoundingClientRect().width);modeButtons.forEach((button,i)=>{button.style.width=dock.c109Widths[i]+'px';button.style.flex='0 0 auto';});if(modeTabs)modeTabs.style.flex='0 1 auto';}
    else{modeButtons.forEach(button=>{button.style.width=button.getBoundingClientRect().width+'px';button.style.flex='0 0 auto';});if(modeTabs)modeTabs.style.flex='0 1 auto';}
    const labels=[...dock.querySelectorAll('.c109-label')],widths=labels.map(label=>label.scrollWidth);
    labels.forEach((label,i)=>{label.style.maxWidth=(fold?(label.getBoundingClientRect().width||widths[i]):0)+'px';});
    dock.offsetWidth;
    if(fold)dock.setAttribute('data-c109-stuck','');else dock.removeAttribute('data-c109-stuck');
    const openWidths=dock.c109Widths?.length===modeButtons.length?dock.c109Widths:null;
    modeButtons.forEach((button,i)=>{button.style.width=fold?'44px':(openWidths?openWidths[i]:120)+'px';});
    clearTimeout(dock.c109OpenTimer);
    if(!fold)dock.c109OpenTimer=setTimeout(()=>{if(dock.hasAttribute('data-c109-stuck'))return;modeButtons.forEach(button=>{button.style.width='';button.style.flex='';});if(modeTabs)modeTabs.style.flex='';syncPill();},720);
    followPill(900);
    labels.forEach((label,i)=>{label.style.maxWidth=(fold?0:widths[i])+'px';
      if(!fold)label.addEventListener('transitionend',function done(event){if(event.propertyName!=='max-width')return;label.removeEventListener('transitionend',done);if(!dock.hasAttribute('data-c109-stuck'))label.style.maxWidth='';});});
  }
  // Labels of the mode row and the back button sit in their own span, so they
  // can glide in and out instead of jumping when the row folds to icons.
  function wrapModeLabels(){
    document.querySelectorAll('#main :is(.control-mode-tabs>button,.control-dock-actions>.control-dock-back)').forEach(button=>{
      if(button.querySelector(':scope>.c109-label'))return;
      [...button.childNodes].filter(node=>node.nodeType===3&&node.textContent.trim()).forEach(node=>{const span=document.createElement('span');span.className='c109-label';span.textContent=node.textContent.trim();node.replaceWith(span);});
      [...button.querySelectorAll(':scope>span:not(.c109-label):not(.tab-gradient-dot109):not(.sr-only)')].forEach(span=>span.classList.add('c109-label'));
    });
    // The glide runs to each word's own width, so folding and unfolding take
    // the same visible time (a fixed maximum made one direction a hard cut).
    const dock=document.querySelector('#main .control-preview-dock');
    if(dock&&!dock.hasAttribute('data-c109-stuck')&&dock.dataset.scrolled!=='true')document.querySelectorAll('#main .c109-label').forEach(label=>{
      if(label.style.getPropertyValue('--c109-lw'))return;
      const keep=label.style.maxWidth;label.style.transition='none';label.style.maxWidth='none';const width=Math.ceil(label.getBoundingClientRect().width/((label.closest('button')?.getBoundingClientRect().width||1)/(label.closest('button')?.offsetWidth||1)));label.style.maxWidth=keep;label.offsetWidth;label.style.transition='';
      if(width>0&&label.style.getPropertyValue('--c109-lw')!==width+'px')label.style.setProperty('--c109-lw',width+'px');
    });
  }
  addEventListener('scroll',()=>requestAnimationFrame(markStuck),{passive:true});
  // Measure again once fonts are ready and when the screen size changes.
  document.fonts?.ready?.then(()=>{document.querySelectorAll('#main .c109-label').forEach(l=>l.style.removeProperty('--c109-lw'));wrapModeLabels();});
  addEventListener('resize',()=>{document.querySelectorAll('#main .c109-label').forEach(l=>l.style.removeProperty('--c109-lw'));requestAnimationFrame(wrapModeLabels);});
  // The pressed button's pill is one element that slides to the new choice
  // with the spring. The app rebuilds the row when the mode changes, so the
  // last position is remembered and the new pill starts from there.
  let lastPill=null;
  let pillFollow=false;
  function followPill(ms){const end=performance.now()+ms;pillFollow=true;const step=()=>{syncPill();if(performance.now()<end)requestAnimationFrame(step);else{pillFollow=false;syncPill();}};requestAnimationFrame(step);}
  function syncPill(){
    const tabs=document.querySelector('#main .control-mode-tabs');if(!tabs)return;
    const pressed=tabs.querySelector(':scope>button[aria-pressed=true]');let pill=tabs.querySelector(':scope>.c109-pill');
    if(!pressed){pill?.remove();tabs.classList.remove('has-c109-pill');return;}
    if(!pill){
      const look=getComputedStyle(pressed);pill=document.createElement('span');pill.className='c109-pill';pill.setAttribute('aria-hidden','true');
      pill.style.backgroundColor=look.backgroundColor;pill.style.backgroundImage=look.backgroundImage;pill.style.boxShadow=look.boxShadow;pill.style.borderRadius=look.borderRadius;pill.style.border=look.borderTopWidth!=='0px'?`${look.borderTopWidth} ${look.borderTopStyle} ${look.borderTopColor}`:'0';
      tabs.prepend(pill);tabs.classList.add('has-c109-pill');
      if(lastPill&&Math.abs(lastPill.tabsWidth-tabs.offsetWidth)<2){pill.style.width=lastPill.w+'px';pill.style.height=lastPill.h+'px';pill.style.transform=`translate(${lastPill.x}px,${lastPill.y}px)`;pill.offsetWidth;}
    }
    const target={x:pressed.offsetLeft,y:pressed.offsetTop,w:pressed.offsetWidth,h:pressed.offsetHeight,tabsWidth:tabs.offsetWidth};
    const now=pill.style.transform,next=`translate(${target.x}px,${target.y}px)`;
    if(now!==next||pill.style.width!==target.w+'px'){pill.classList.toggle('is-moving',!!now&&!pillFollow);pill.style.width=target.w+'px';pill.style.height=target.h+'px';pill.style.transform=next;}
    lastPill=target;
  }
  addEventListener('resize',()=>requestAnimationFrame(syncPill));
  let modeQueued=false;
  // The pill is placed right away (before the next paint), then checked again.
  new MutationObserver(()=>{keepFolded();if(document.querySelector('#main .control-mode-tabs:not(.has-c109-pill)'))syncPill();if(!modeQueued){modeQueued=true;requestAnimationFrame(()=>{modeQueued=false;syncModeTabs();syncPill();});}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-gradient-mode','aria-pressed']});
  // Stand page: one big switch for the whole stand. It uses the zones' own
  // tested on/off switches, one after the other, so every zone (also one
  // with a gradient) is switched exactly as when you tap it yourself.
  const POWER_TEXT={nl:['Hele stand','Aan','Uit','Hele stand aan of uit'],en:['Whole stand','On','Off','Whole stand on or off'],fr:['Tout le stand','Allumé','Éteint','Tout le stand allumé ou éteint'],de:['Gesamter Stand','An','Aus','Gesamten Stand ein- oder ausschalten']};
  const powerText=i=>(POWER_TEXT[root.lang]||POWER_TEXT.nl)[i];
  const zoneSwitches=()=>[...document.querySelectorAll('#main .stand-page [data-action="zone-power"][role="switch"]')];
  let standPowerBusy=false;
  function syncStandPower(){
    const hero=document.querySelector('#main .stand-page .stand-hero100');if(!hero)return;
    const switches=zoneSwitches();let button=hero.querySelector('.stand-power109');
    if(!switches.length){button?.remove();return;}
    if(!button){
      button=document.createElement('button');button.type='button';button.className='stand-power109';button.setAttribute('role','switch');
      button.innerHTML='<span class="stand-power-ring109" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/></svg></span><span class="stand-power-copy109"><b></b><small></small></span>';
      (hero.querySelector('.stand-hero-copy')||hero).append(button);
    }
    const on=switches.every(item=>item.getAttribute('aria-checked')==='true'),some=switches.some(item=>item.getAttribute('aria-checked')==='true');
    button.setAttribute('aria-checked',String(on));button.dataset.state=on?'on':some?'mixed':'off';button.setAttribute('aria-label',powerText(3));
    button.querySelector('b').textContent=powerText(0);button.querySelector('small').textContent=powerText(on||some?1:2);
    button.disabled=standPowerBusy||switches.some(item=>item.disabled);
  }
  document.addEventListener('click',async event=>{
    const button=event.target instanceof Element&&event.target.closest('#main .stand-power109');if(!button||standPowerBusy)return;
    event.preventDefault();standPowerBusy=true;button.disabled=true;
    const want=!zoneSwitches().every(item=>item.getAttribute('aria-checked')==='true');
    try{
      for(let guard=0;guard<16;guard++){
        const next=zoneSwitches().find(item=>(item.getAttribute('aria-checked')==='true')!==want&&!item.disabled);if(!next)break;
        next.click();await new Promise(done=>setTimeout(done,140));
      }
    }finally{standPowerBusy=false;syncStandPower();}
  });
  let powerQueued=false;
  new MutationObserver(()=>{if(!powerQueued){powerQueued=true;requestAnimationFrame(()=>{powerQueued=false;syncStandPower();});}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-checked']});
  // Stand animation: drag the numbered zone cards into the order the light
  // should travel. The grip moves a card; on release the app saves the order.
  const ZONE_GRIP_TEXT={nl:'Sleep om de volgorde te wijzigen',en:'Drag to change the order',fr:'Glissez pour changer l’ordre',de:'Ziehen, um die Reihenfolge zu ändern'};
  const tick=()=>{try{window.LightningNativeRuntime?.selectionFeedback?.();}catch(_){}};
  function zoneCards(list){return [...list.querySelectorAll(':scope>.stand-animation-zone[data-stand-animation-zone]')];}
  const ZONE_HINT_TEXT={nl:'Sleep de zones in de volgorde waarin het licht moet lopen.',en:'Drag the zones into the order the light should travel.',fr:'Faites glisser les zones dans l’ordre où la lumière doit passer.',de:'Zieh die Zonen in die Reihenfolge, in der das Licht laufen soll.'};
  function syncZoneGrips(){
    document.querySelectorAll('.stand-animation-live [data-stand-animation-preview]').forEach(list=>{
      const together=list.dataset.standMode109==='whole',cards=zoneCards(list),sortable=cards.length>1&&!together;list.toggleAttribute('data-c109-sortable',sortable);
      let hint=list.previousElementSibling?.matches?.('.zone-drag-hint109')?list.previousElementSibling:null;
      if(sortable&&!hint){hint=document.createElement('p');hint.className='zone-drag-hint109';hint.innerHTML='<span aria-hidden="true"></span>';hint.append(ZONE_HINT_TEXT[root.lang]||ZONE_HINT_TEXT.nl);list.before(hint);
        if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)cards[1]?.classList.add('nudge109');}
      if(!sortable){hint?.remove();cards.forEach(card=>card.querySelector(':scope>.zone-grip109')?.remove());return;}
      cards.forEach(card=>{
        if(cards.length<2||card.querySelector(':scope>.zone-grip109'))return;
        const grip=document.createElement('button');grip.type='button';grip.className='zone-grip109';grip.setAttribute('aria-label',ZONE_GRIP_TEXT[root.lang]||ZONE_GRIP_TEXT.nl);
        card.append(grip);
      });
    });
  }
  function commitZoneOrder(list){
    const ids=zoneCards(list).map(card=>card.dataset.standAnimationZone).filter(id=>id&&id!=='unassigned');
    document.dispatchEvent(new CustomEvent('c109:zone-order',{detail:{ids}}));
  }
  document.addEventListener('keydown',event=>{
    const grip=event.target instanceof Element&&event.target.closest('.zone-grip109');if(!grip||!['ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();const card=grip.closest('.stand-animation-zone'),list=card.parentElement;
    const other=event.key==='ArrowUp'?card.previousElementSibling:card.nextElementSibling;if(!other?.matches('.stand-animation-zone'))return;
    if(event.key==='ArrowUp')other.before(card);else other.after(card);grip.focus();tick();commitZoneOrder(list);
  });
  document.addEventListener('pointerdown',event=>{
    const grip=event.target instanceof Element&&event.target.closest('.zone-grip109');if(!grip||event.button>0)return;
    event.preventDefault();const card=grip.closest('.stand-animation-zone'),list=card.parentElement,startY=event.clientY,before=zoneCards(list).map(c=>c.dataset.standAnimationZone).join();
    card.classList.add('is-dragging109');let lastY=startY;
    const move=ev=>{
      const dy=ev.clientY-lastY;card.style.transform=`translateY(${ev.clientY-startY}px)`;
      const siblings=zoneCards(list).filter(c=>c!==card);
      for(const other of siblings){const box=other.getBoundingClientRect(),mid=box.top+box.height/2,mine=card.getBoundingClientRect();
        if(dy>0&&mine.bottom>mid&&card.compareDocumentPosition(other)&Node.DOCUMENT_POSITION_FOLLOWING&&box.top>card.offsetTop-9999){const old=card.getBoundingClientRect().top;other.after(card);const shift=card.getBoundingClientRect().top-old;lastY=ev.clientY;card.style.transform=`translateY(${ev.clientY-startY-shift}px)`;tick();break;}
        if(dy<0&&mine.top<mid&&card.compareDocumentPosition(other)&Node.DOCUMENT_POSITION_PRECEDING){const old=card.getBoundingClientRect().top;other.before(card);const shift=card.getBoundingClientRect().top-old;lastY=ev.clientY;card.style.transform=`translateY(${ev.clientY-startY-shift}px)`;tick();break;}
      }
    };
    const up=()=>{removeEventListener('pointermove',move);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);
      card.classList.remove('is-dragging109');card.style.transform='';
      if(zoneCards(list).map(c=>c.dataset.standAnimationZone).join()!==before)commitZoneOrder(list);};
    addEventListener('pointermove',move);addEventListener('pointerup',up);addEventListener('pointercancel',up);
  });
  let gripQueued=false;
  new MutationObserver(()=>{if(!gripQueued){gripQueued=true;requestAnimationFrame(()=>{gripQueued=false;syncZoneGrips();});}}).observe(document.body,{childList:true,subtree:true});
  // Ledline order: a hairline under the head only once the list scrolls under it.
  document.addEventListener('scroll',event=>{
    const sheet=event.target instanceof Element&&event.target.matches('.ledline-setup[data-order-open="true"]')?event.target:null;if(!sheet)return;
    sheet.toggleAttribute('data-c109-scrolled',sheet.scrollTop>4);
  },{capture:true,passive:true});
  // Pixels: once the ledline has been swiped, its moving finger hint goes.
  document.addEventListener('pointerdown',event=>{
    const scrub=event.target instanceof Element&&event.target.closest('[data-pixel-scrub]');if(scrub)scrub.dataset.c109Swiped='';
  },true);
  document.addEventListener('toggle',event=>{
    const card=event.target;if(!(card instanceof HTMLDetailsElement)||!card.open||!card.matches('.receiver-overview-card'))return;
    const outputs=card.querySelector('details.receiver-connections');if(outputs&&!outputs.open)outputs.open=true;
  },true);
}());
