// C109cr-0: (superseded by C109cr-9) kept as a no-op so older call sites stay valid.
window.__c109SoftClose=function(){};
/* C109 interface: tells c109-interface.css when the top bar is still under
 * the safe area (clock, Dynamic Island). Presentation only. */
(function(){
  'use strict';
  const root=document.documentElement;let queued=false,barMetrics=null;
  // C109ap: the bar is measured once per page change or resize; on scroll
  // this is arithmetic on scrollY, never a layout read (that read cost up to
  // 290 ms per scroll while the mode row folds on a slow phone).
  function measureBar(){
    const bar=document.querySelector('header.brand-bar');
    if(!bar||bar.getClientRects().length===0){barMetrics=null;return;}
    const strip=parseFloat(getComputedStyle(document.body,'::before').height)||0;
    barMetrics={strip,sticky:getComputedStyle(bar).position==='sticky',bottom:bar.offsetTop+bar.offsetHeight};
  }
  function update(){
    queued=false;
    if(!barMetrics)measureBar();
    const top=!!barMetrics&&barMetrics.strip>0&&(barMetrics.sticky||barMetrics.bottom-window.scrollY>barMetrics.strip+1);
    root.classList.toggle('c109-bar-top',top);
  }
  const queue=()=>{if(!queued){queued=true;requestAnimationFrame(update);}};
  const remeasure=()=>{barMetrics=null;queue();};
  addEventListener('scroll',queue,{passive:true});addEventListener('resize',remeasure);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',remeasure,{once:true});else remeasure();
  // Page changes can move the bar without a scroll event.
  new MutationObserver(remeasure).observe(document.body,{childList:true});

  /* ---------- Starting an animation: the receivers synchronise ---------- */
  // The native app schedules a shared start a little ahead (its "lead", about
  // 12 s). When it reports that lead, a card shows the wait with a progress
  // bar. It says the receivers are synchronising, never that the light changed;
  // nothing is shown without a reported lead, and a failure simply hides it.
  //   document.dispatchEvent(new CustomEvent('lightning:animation-sync',{detail:{leadMs:12000}}))
  //   document.dispatchEvent(new CustomEvent('lightning:animation-sync',{detail:{done:true}}))
  // C109br: the animation sync speaks through the one activity place (see LightningActivity below).
  document.addEventListener('lightning:animation-sync',event=>{const detail=event.detail||{};window.LightningActivity?.animationSync(detail);});

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
    let zones=[...document.querySelectorAll('#main .stand-page article.zone-entry')].map(article=>({
      name:article.querySelector('.zone-card-heading>b')?.textContent.trim()||'',type:/SPI/.test(article.querySelector('.zone-family-badge')?.textContent||'')?'spi':'rgbw'})).filter(zone=>zone.name);
    // C109bn: remember the zones; a re-render while the stand page is not
    // behind the sheet must not fall back to an empty card for a moment.
    if(zones.length)scopeZonesC109=zones;else if(scopeZonesC109)zones=scopeZonesC109;
    const key=zones.length?JSON.stringify(zones):scope.textContent;
    let line=card.querySelector('.c109-scope');
    if(!line){line=document.createElement('span');line.className='c109-scope';card.append(line);}
    if(line.dataset.key===key)return;line.dataset.key=key;
    if(!zones.length){line.textContent=scope.textContent;return;}
    line.replaceChildren(...zones.map(zone=>{const chip=document.createElement('span');chip.className='c109-zone-chip';chip.dataset.type=zone.type;
      const glyph=document.createElement('i');glyph.setAttribute('aria-hidden','true');const name=document.createElement('b');name.textContent=zone.name;chip.append(glyph,name);return chip;}));
  }
  // C109bn: a colour change re-renders the whole "Hele stand" card. The zone
  // chips are put back in the same task (a mutation callback runs before the
  // next paint), so the card never shows for a frame without them and the
  // sheet below it never jumps.
  let scopeZonesC109=null;
  new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.power-card,[data-stand-control-sheet]')||n.querySelector?.('.power-card-stand')))))scopeIntoPowerCard();}).observe(document.body,{childList:true,subtree:true});

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
    // C138jank: aria-pressed is in this observer's own filter; an unchanged write re-ran syncModeTabs + syncPill every frame.
    if(gradient.getAttribute('aria-pressed')!==String(isGradient))gradient.setAttribute('aria-pressed',String(isGradient));
    if(colour&&inColour&&colour.getAttribute('aria-pressed')!==String(!isGradient))colour.setAttribute('aria-pressed',String(!isGradient));
    const modeC138=isGradient?'gradient':colour?.getAttribute('aria-pressed')==='true'?'colour':'animations';if(tabs.dataset.c109Mode!==modeC138)tabs.dataset.c109Mode=modeC138;
  }
  let toSolidC139=false; /* C139ui-2c: Kleur tapped from Animaties; the new row must not first mark Verloop */
  let viaGradient=false; /* C138ui-19: Verloop from Animaties opened Kleur (the internal Kleur click reset the gradient 60 ms later) */function whenRendered(test,then,tries=40){if(test())return then();if(tries>0)requestAnimationFrame(()=>whenRendered(test,then,tries-1));}
  document.addEventListener('click',event=>{
    const button=event.target instanceof Element&&event.target.closest('#main .control-mode-tabs>button');if(!button)return;
    if(button.dataset.action==='colour-gradient109'){
      event.preventDefault();event.stopPropagation();
      const choose=()=>{const target=modeChoice('gradient');if(target&&target.getAttribute('aria-pressed')!=='true')target.click();setTimeout(syncModeTabs,30);};
      if(modeChoice('gradient'))return choose();
      viaGradient=true;try{button.closest('.control-mode-tabs').querySelector('[data-action="colour"]')?.click();}finally{viaGradient=false;}
      whenRendered(()=>!!modeChoice('gradient'),choose);return;
    }
    if(button.dataset.action==='colour'){
      const solid=modeChoice('solid');
      if(solid&&solid.getAttribute('aria-pressed')!=='true'){event.preventDefault();event.stopPropagation();solid.click();setTimeout(syncModeTabs,30);}
      // Coming from Animaties: the colour screen opens in its last mode; Kleur
      // means a solid colour, so switch it once the screen is there.
      else if(!viaGradient&&!solid&&button.closest('.control-mode-tabs')?.querySelector('[data-action="colour-gradient109"]')){
        toSolidC139=true;setTimeout(()=>{toSolidC139=false;},700);
        whenRendered(()=>!!modeChoice('solid'),()=>{toSolidC139=false;const choice=modeChoice('solid');if(choice&&choice.getAttribute('aria-pressed')!=='true')choice.click();setTimeout(syncModeTabs,30);});}
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
    // C109ap: while the row is folding or opening, nothing is measured; a
    // read here would force an extra layout on every frame of the motion.
    if(dock.hasAttribute('data-c109-folding'))return;
    // C109ah: only a bar that really sticks to the top folds (landscape keeps
    // the picture in its own column and simply scrolls).
    if(getComputedStyle(dock).position!=='sticky'){if(stuck)foldLabels(dock,false);return;}
    const rest=parseFloat(getComputedStyle(dock).top)||0,top=dock.getBoundingClientRect().top,docked=window.scrollY>8&&top<=rest+1;
    if(!stuck&&docked)foldLabels(dock,true);else if(stuck&&(window.scrollY<=8||top>rest+14))foldLabels(dock,false);}
  // The width is measured at the moment of folding, in the engine that draws
  // it (WebKit measures a little wider than Chrome), and handed back as
  // "none" once open, so a word is never cut short or shown with "…".
  // C109at: the ledline picture shows only the ledlines. Everything that is a
  // setting of the zone — Bekijk als, Ledlinevolgorde, Voorbeeldgrootte —
  // lives behind a round gear next to the zone name, in one small sheet.
  // Under the picture: a round "all ledlines" icon and the full-screen
  // button; the "Je bedient" captions are gone. A second tap on the same
  // ledline keeps only that ledline. Every row presses the app's original
  // controls, which stay the single source of truth.
  const ZONE_T={nl:{title:'Zone-instellingen',size:'Voorbeeldgrootte',all:'Alle ledlines kiezen'},en:{title:'Zone settings',size:'Preview size',all:'Select all LED lines'},fr:{title:'Réglages de la zone',size:'Taille de l’aperçu',all:'Sélectionner toutes les lignes LED'},de:{title:'Zonen-Einstellungen',size:'Vorschaugröße',all:'Alle LED-Linien wählen'}};
  const zt=key=>{const lang=(document.documentElement.lang||'nl').slice(0,2);return (ZONE_T[lang]||ZONE_T.nl)[key];};
  // C139tt-5: the zone gear is created in the form C109ct-2 (regear) gives every settings icon. It used to be created with
  // an older drawing that regear replaced a moment later: a second DOM insertion per zone render that re-matched :has()
  // on the whole body (one full style pass in the next frame).
  const GEAR='<svg viewBox="0 0 24 24" aria-hidden="true" data-c109-gear="" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.1"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  const ALL_ICON='<svg class="c109-all-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="12" height="3.2" rx="1.6" fill="currentColor"/><rect x="3" y="10.4" width="12" height="3.2" rx="1.6" fill="currentColor"/><rect x="3" y="15.8" width="9" height="3.2" rx="1.6" fill="currentColor"/><circle cx="18" cy="16.5" r="4.6" fill="currentColor"/><path d="m15.9 16.6 1.5 1.4 2.8-3" fill="none" stroke="var(--c109-check-ink,#fff)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CHEV='<svg class="c109-view-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function zoneSheet(){
    let d=document.getElementById('c109-zone-sheet');if(d)return d;
    d=document.createElement('dialog');d.id='c109-zone-sheet';d.className='c109-zone-sheet';d.setAttribute('aria-label',zt('title'));window.__c109SoftClose?.(d);
    d.innerHTML='<header class="c109-sheet-head"><h2></h2><button type="button" class="c109-sheet-close" aria-label=""><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button></header><div class="c109-sheet-rows"></div>';
    d.querySelector('.c109-sheet-close').addEventListener('click',()=>d.close());
    d.addEventListener('click',event=>{if(event.target===d)d.close();});
    document.body.append(d);return d;
  }
  function sheetRow(cls,icon,title,sub,onClick){
    const row=document.createElement('button');row.type='button';row.className='c109-sheet-row '+cls;
    row.innerHTML='<span class="c109-tool-ic" aria-hidden="true"></span><span class="c109-tool-copy"><b></b><small></small></span>'+CHEV;
    if(icon)row.firstChild.append(icon.cloneNode(true));row.querySelector('b').textContent=title;row.querySelector('small').textContent=sub||'';row.querySelector('small').hidden=!sub;
    row.addEventListener('click',onClick);return row;
  }
  function openZoneSheet(){
    const d=zoneSheet();d.querySelector('h2').textContent=zt('title');d.querySelector('.c109-sheet-close').setAttribute('aria-label',lt('close'));
    const rows=d.querySelector('.c109-sheet-rows');rows.innerHTML='';
    const spatial=document.querySelector('#main .spatial-choice-toggle');
    if(spatial){const caption=(spatial.querySelector('small')||spatial.querySelector('.spatial-choice-title'))?.textContent.trim()||'';const value=(spatial.querySelector('b')||spatial.querySelector('.spatial-choice-current'))?.textContent.trim()||document.querySelector('#main .v50-preview-heading>span')?.textContent.trim()||'';
      const row=sheetRow('is-view',spatial.querySelector('.spatial-choice-current-icon svg'),caption,value,()=>{d.close();setTimeout(()=>document.querySelector('#main .spatial-choice-toggle')?.click(),80);});
      row.classList.toggle('is-blocked',spatial.disabled||spatial.getAttribute('aria-disabled')==='true');if(row.classList.contains('is-blocked'))row.querySelector('small').textContent=lt('needsStand');rows.append(row);}
    const order=document.querySelector('#main .ledline-setup-toggle[data-action=layout]');
    if(order){const parts=(order.getAttribute('aria-label')||order.textContent.trim()).split(/\s*·\s*/);
      const row=sheetRow('is-order',order.querySelector('svg'),parts[0]||'',parts[1]||'',()=>{d.close();setTimeout(()=>{const o=document.querySelector('#main .ledline-setup-toggle[data-action=layout]');if(!o)return;if(o.getAttribute('aria-expanded')!=='true')o.click();setTimeout(()=>document.querySelector('#main .ledline-setup.ui606-line-tools')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'}),120);},80);});
      row.classList.toggle('is-blocked',order.disabled);if(order.disabled)row.querySelector('small').textContent=lt('needsStand');rows.append(row);}
    const picker=document.querySelector('#main .preview-size-picker');
    if(picker){const wrap=document.createElement('div');wrap.className='c109-sheet-size';wrap.innerHTML='<small></small><div class="c109-sheet-seg" role="group"></div>';wrap.querySelector('small').textContent=zt('size');
      const seg=wrap.querySelector('.c109-sheet-seg');
      for(const original of picker.querySelectorAll('button[data-action=preview-size]')){const b=document.createElement('button');b.type='button';b.dataset.size=original.dataset.id;b.textContent=original.textContent.trim();b.setAttribute('aria-pressed',original.getAttribute('aria-pressed')||'false');
        b.addEventListener('click',()=>{const target=document.querySelector('#main .preview-size-picker button[data-action=preview-size][data-id="'+b.dataset.size+'"]');target?.click();for(const other of seg.children)other.setAttribute('aria-pressed',String(other===b));});seg.append(b);}
      rows.append(wrap);}
    if(!d.open)d.showModal();
  }
  function syncViewTools(){
    const dock=document.querySelector('#main .control-preview-dock');if(!dock)return;
    const line=dock.querySelector('.control-dock-context-line');
    const hasSettings=!!document.querySelector('#main .spatial-choice-toggle, #main .ledline-setup-toggle[data-action=layout], #main .preview-size-picker');
    if(line&&hasSettings&&!line.querySelector('.c109-zone-gear')){const gear=document.createElement('button');gear.type='button';gear.className='c109-zone-gear';gear.setAttribute('aria-label',zt('title'));gear.innerHTML=GEAR;gear.addEventListener('click',openZoneSheet);line.append(gear);}
    const all=dock.querySelector('.v50-preview-toolbar .v50-select-all');
    if(all&&!all.querySelector('.c109-all-icon')){all.insertAdjacentHTML('afterbegin',ALL_ICON);all.setAttribute('aria-label',zt('all'));all.classList.add('c109-all-btn');}
    document.body.classList.toggle('c109-zone-sheet',hasSettings);
  }
  // a second tap on the same ledline keeps only that ledline
  let lastLineTap={id:null,at:0};
  document.addEventListener('click',event=>{
    const target=event.target.closest?.('#main .v50-preview-line-target');if(!target||!event.isTrusted)return;
    const id=target.dataset.id,now=performance.now();
    if(lastLineTap.id===id&&now-lastLineTap.at<420){
      lastLineTap={id:null,at:0};event.preventDefault();event.stopImmediatePropagation();
      const all=document.querySelector('#main .v50-preview-toolbar .v50-select-all');if(!all)return;
      all.click();requestAnimationFrame(()=>requestAnimationFrame(()=>{document.querySelector('#main .v50-preview-line-target[data-id="'+id+'"]')?.click();try{window.LightningInterfaceHaptics?.emit?.('impact','line-solo',{userInitiated:true});}catch(_){}}));
      return;}
    lastLineTap={id,at:now};
  },true);
  let viewQueued=false;
  new MutationObserver(()=>{const gl=document.querySelector('#main .control-preview-dock .control-dock-context-line');if(gl&&!gl.querySelector('.c109-zone-gear'))syncViewTools(); /* C139ui-11: the zone gear is in the first frame (no jump of the tab row) */if(!viewQueued){viewQueued=true;requestAnimationFrame(()=>{viewQueued=false;syncViewTools();});}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','disabled','aria-disabled','aria-pressed']});
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
    if(!bounce)return;requestAnimationFrame(()=>element.classList.add('c109-release')); // C138ui-15: no forced layout per tap
    setTimeout(()=>element.classList.remove('c109-release'),560);};
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
  // C109al: the expanders the app does not animate itself (Meer varianten,
  // port settings, receiver menu, brand suggestions, scene help, order
  // details) open and close with the same spring as everything else. The
  // summary click is taken over only for those; the app's own fold for the
  // receiver cards and the fine controls stays untouched.
  const FOLD_SEL='details.family-more-variants,details.receiver-connections,details.receiver-manage-menu,details.brand-suggestions,details.scene-workflow-help,details.v593-order-status-details';
  const folds=new WeakMap();
  function springFold(details){
    const summary=details.querySelector(':scope>summary');if(!summary||typeof details.animate!=='function')return details.open=!details.open;
    const running=folds.get(details);const open=running?!running.open:!details.open;
    if(running){running.animation.cancel();folds.delete(details);}
    const from=details.getBoundingClientRect().height;
    details.open=true;const children=[...details.children].filter(c=>c!==summary);
    if(!open)children.forEach(c=>c.inert=true);
    const to=open?details.getBoundingClientRect().height:(()=>{details.open=false;const h=details.getBoundingClientRect().height;details.open=true;return h;})();
    const prev=details.getAttribute('style');details.setAttribute('style',(prev||'')+';overflow:hidden!important');
    const spring=getComputedStyle(document.documentElement).getPropertyValue('--c109-spring').trim()||'cubic-bezier(.34,1.3,.64,1)';
    let anim;try{anim=details.animate([{height:from+'px'},{height:to+'px'}],{duration:open?480:320,easing:open?spring:'cubic-bezier(.3,.9,.4,1)',fill:'both'});}
    catch(_){try{anim=details.animate([{height:from+'px'},{height:to+'px'}],{duration:open?480:320,easing:'cubic-bezier(.34,1.3,.64,1)',fill:'both'});}catch(__){if(prev===null)details.removeAttribute('style');else details.setAttribute('style',prev);if(!open){details.open=false;children.forEach(c=>c.inert=false);}return;}}
    const fold={open,animation:anim};folds.set(details,fold);
    const done=()=>{if(folds.get(details)!==fold)return;folds.delete(details);anim.cancel();if(prev===null)details.removeAttribute('style');else details.setAttribute('style',prev);
      if(!open){details.open=false;children.forEach(c=>c.inert=false);}};
    anim.finished.then(done,done);
  }
  document.addEventListener('click',event=>{
    if(matchMedia('(prefers-reduced-motion:reduce)').matches||event.button!==0||event.defaultPrevented)return;
    const summary=event.target.closest?.('summary'),details=summary?.parentElement;
    if(!details?.matches?.(FOLD_SEL)||summary!==details.querySelector(':scope>summary'))return;
    if(event.target.closest?.('button,a,input,select,textarea,[role=button]'))return;
    event.preventDefault();springFold(details);
  });
  // C109am: the stand loading screen. When a stand is loaded (stand Wi-Fi,
  // link, readmission, adoption, first load) a full screen shows a progress
  // bar and the phase in plain words; "Intussen verder" shrinks it to a
  // capsule above the tab bar so the customer can use the app meanwhile. The
  // progress is kept in storage, so leaving the app and coming back shows the
  // current state again, never an error because they were away.
  // Contract: window event `lightning:stand-load-progress` with detail
  // {phase:'discover'|'access'|'receivers'|'zones'|'libraries'|'done'|'failed',
  //  done?:number,total?:number,standId?:string,name?:string}. Until native
  // sends it, the app's own READMIT_* / ADOPT_* log lines drive the phases.
  const LOAD_T={
    nl:{title:'Stand inladen',discover:'Receivers zoeken',access:'Toegang controleren',receivers:'Receivers verbinden',zones:'Zones en kleuren inladen',libraries:'Animaties en scènes inladen',done:'Stand ingeladen',failed:'Nog geen verbinding met de stand. Zodra die er is, gaat het inladen verder.',note:'Je kunt de app intussen verlaten. Het inladen gaat door.',minimise:'Intussen verder',close:'Sluiten',retry:'Opnieuw proberen',show:'Tonen',failedShort:'Nog geen verbinding',needsStand:'Zodra de stand verbonden is'},
    en:{title:'Loading your stand',discover:'Finding receivers',access:'Checking access',receivers:'Connecting receivers',zones:'Loading zones and colours',libraries:'Loading animations and scenes',done:'Stand loaded',failed:'No connection to the stand yet. Loading continues as soon as it is back.',note:'You can leave the app meanwhile. Loading continues.',minimise:'Continue meanwhile',close:'Close',retry:'Try again',show:'Show',failedShort:'No connection yet',needsStand:'Once the stand is connected'},
    fr:{title:'Chargement du stand',discover:'Recherche des receivers',access:'Vérification de l’accès',receivers:'Connexion des receivers',zones:'Chargement des zones et couleurs',libraries:'Chargement des animations et scènes',done:'Stand chargé',failed:'Pas encore de connexion au stand. Le chargement reprend dès qu’elle revient.',note:'Vous pouvez quitter l’app entre-temps. Le chargement continue.',minimise:'Continuer en attendant',close:'Fermer',retry:'Réessayer',show:'Afficher',failedShort:'Pas encore de connexion',needsStand:'Dès que le stand est connecté'},
    de:{title:'Stand wird geladen',discover:'Receiver suchen',access:'Zugang prüfen',receivers:'Receiver verbinden',zones:'Zonen und Farben laden',libraries:'Animationen und Szenen laden',done:'Stand geladen',failed:'Noch keine Verbindung zum Stand. Sobald sie da ist, geht das Laden weiter.',note:'Du kannst die App inzwischen verlassen. Das Laden läuft weiter.',minimise:'Inzwischen weiter',close:'Schließen',retry:'Erneut versuchen',show:'Anzeigen',failedShort:'Noch keine Verbindung',needsStand:'Sobald der Stand verbunden ist'}};
  const lt=key=>{const lang=(document.documentElement.lang||'nl').slice(0,2);return (LOAD_T[lang]||LOAD_T.nl)[key]??LOAD_T.nl[key];};
  const PHASE_SPAN={discover:[0,20],access:[20,35],receivers:[35,60],zones:[60,85],libraries:[85,98],done:[100,100]};
  const LOAD_KEY='c109.standLoad';
  let load=null,loadDoneTimer=0,loadCreep=0,loadFullTimer=0;
  const loadSave=()=>{try{if(load)localStorage.setItem(LOAD_KEY,JSON.stringify(load));else localStorage.removeItem(LOAD_KEY);}catch(_){}};
  function loadEl(){
    let el=document.getElementById('c109-load');if(el)return el;
    el=document.createElement('section');el.id='c109-load';el.setAttribute('role','status');el.setAttribute('aria-live','polite');
    el.innerHTML='<div class="c109-load-card"><img class="c109-load-logo" alt="Aluvision" src="assets/aluvision-logo.png"><div class="c109-load-strips" aria-hidden="true"><i></i><i></i><i></i></div><h2 class="c109-load-title"></h2><p class="c109-load-name"></p><div class="c109-load-bar" aria-hidden="true"><b></b></div><p class="c109-load-phase"></p><p class="c109-load-note"></p><div class="c109-load-actions"><button type="button" class="c109-load-min"></button><button type="button" class="c109-load-retry" hidden></button><button type="button" class="c109-load-close" hidden></button></div></div><button type="button" class="c109-load-capsule" hidden><span class="c109-load-ring" aria-hidden="true"></span><span class="c109-load-capsule-text"></span></button>';
    el.querySelector('.c109-load-min').addEventListener('click',()=>{if(!load)return;load.minimised=true;renderLoad();loadSave();});
    el.querySelector('.c109-load-capsule').addEventListener('click',()=>{if(!load)return;load.minimised=false;renderLoad();loadSave();});
    el.querySelector('.c109-load-close').addEventListener('click',()=>{load=null;renderLoad();loadSave();});
    el.querySelector('.c109-load-retry').addEventListener('click',()=>{if(!load)return;load.phase='discover';load.pct=0;load.at=Date.now();renderLoad();loadSave();try{window.dispatchEvent(new CustomEvent('lightning:stand-load-retry',{detail:{standId:load.standId}}));}catch(_){}});
    el.addEventListener('click',event=>{if(event.target===el&&load&&load.phase!=='done'){load.minimised=true;renderLoad();loadSave();}});
    document.body.append(el);return el;
  }
  // C109cf: the loading also feeds a native Live Activity (iPhone lock screen /
  // Dynamic Island) and an Android progress notification. Contract for native:
  // window event 'lightning:stand-load-activity' and log line
  // 'C109_LIVE_ACTIVITY {"state":"update"|"failed"|"end","phase","title","detail","progress":0..1,"standName","standId"}'.
  // Sent only when something changes, at most every 400 ms (the end always).
  let liveLast='',liveAt=0,liveTimer=0;
  function liveActivity(d){
    const json=JSON.stringify(d);if(json===liveLast)return;
    const send=()=>{liveLast=json;liveAt=Date.now();try{window.dispatchEvent(new CustomEvent('lightning:stand-load-activity',{detail:d}));}catch(_){}try{window.__c98log?.('C109_LIVE_ACTIVITY '+json);}catch(_){}};
    clearTimeout(liveTimer);const wait=d.state==='end'?0:Math.max(0,400-(Date.now()-liveAt));
    if(wait)liveTimer=setTimeout(send,wait);else send();
  }
  function renderLoad(){
    const el=loadEl();
    if(!load){clearTimeout(etaTick);el.classList.remove('is-on','is-min','is-done','is-failed');el.hidden=true;document.body.classList.remove('c109-loading');clearInterval(loadCreep);loadCreep=0;try{window.__c109ActLoad?.(null);}catch(_){}liveActivity({state:'end'});return;}
    el.hidden=false;el.classList.add('is-on');el.classList.toggle('is-min',!!load.minimised);el.classList.toggle('is-done',load.phase==='done');el.classList.toggle('is-failed',load.phase==='failed');
    document.body.classList.toggle('c109-loading',!load.minimised);
    const eta=etaText(load),etaS=etaSeconds(load);const phaseText=(lt(load.phase)||'')+(eta?' · '+eta:'');const pct=Math.round(load.pct);
    clearTimeout(etaTick);if(etaS)etaTick=setTimeout(()=>{if(load&&!document.hidden)renderLoad();},1000);
    el.querySelector('.c109-load-title').textContent=load.phase==='done'?lt('done'):lt('title');
    const name=el.querySelector('.c109-load-name');name.textContent=load.name||'';name.hidden=!load.name;
    el.querySelector('.c109-load-phase').textContent=load.phase==='done'?'':phaseText;
    el.querySelector('.c109-load-note').textContent=load.phase==='failed'?'':lt('note');
    el.querySelector('.c109-load-bar>b').style.width=pct+'%';el.style.setProperty('--c109-load-pct',String(pct));
    el.querySelector('.c109-load-bar').classList.toggle('is-soft',!!load.indeterminate&&load.phase!=='done'&&load.phase!=='failed');
    el.querySelector('.c109-load-min').hidden=load.phase==='done'||load.phase==='failed';el.querySelector('.c109-load-min').textContent=lt('minimise');
    el.querySelector('.c109-load-retry').hidden=load.phase!=='failed';el.querySelector('.c109-load-retry').textContent=lt('retry');
    el.querySelector('.c109-load-close').hidden=load.phase!=='failed';el.querySelector('.c109-load-close').textContent=lt('close');
    const capsule=el.querySelector('.c109-load-capsule');capsule.hidden=!load.minimised;
    // C109cf: the small state lives in the one notice place (under the connection pill)
    {const short=load.phase==='done'?lt('done'):load.phase==='failed'?lt('failedShort'):lt('title');
     const detail=load.phase==='done'||load.phase==='failed'?'':phaseText;
     try{window.__c109ActLoad?.(load.minimised?{title:short,detail,progress:load.phase==='failed'?NaN:pct/100,onTap:()=>{if(!load)return;load.minimised=false;renderLoad();loadSave();}}:null);}catch(_){}
     liveActivity({state:load.phase==='done'?'end':load.phase==='failed'?'failed':'update',phase:load.phase,title:short,detail,progress:pct/100,etaSeconds:etaS?etaS.sec:null,etaLate:!!etaS?.late,standName:load.name||'',standId:load.standId||''});}
    el.querySelector('.c109-load-capsule-text').textContent=load.phase==='done'?lt('done'):load.phase==='failed'?lt('failedShort'):(lt('title')+' · '+phaseText);
    if(!loadCreep)loadCreep=setInterval(()=>{if(!load||load.phase==='done'||load.phase==='failed'||!load.indeterminate)return;const end=(PHASE_SPAN[load.phase]||[0,0])[1];if(load.pct<end-1){load.pct+=(end-load.pct)*.06;renderLoad();}},900);
  }
  // C109cg: time estimate while the stand loads. Every phase is timed; per
  // stand the average of the last 3 loads is kept. First time: ±60 s, spread
  // like the last measurement on the tablet (connecting receivers is the bulk).
  // It counts down, never below "±5 s"; past the estimate it says "duurt
  // langer dan verwacht" — never a red message.
  const ETA_ORDER=['discover','access','receivers','zones','libraries'];
  const ETA_DEFAULT={discover:6,access:6,receivers:30,zones:12,libraries:6};
  const ETA_T={nl:{s:'nog ±{n} s',m:'nog ±{n} min',late:'duurt langer dan verwacht'},en:{s:'about {n} s left',m:'about {n} min left',late:'taking longer than expected'},fr:{s:'encore ±{n} s',m:'encore ±{n} min',late:'plus long que prévu'},de:{s:'noch ±{n} s',m:'noch ±{n} Min.',late:'dauert länger als erwartet'}};
  const et=(k,n)=>{const lang=(document.documentElement.lang||'nl').slice(0,2);return ((ETA_T[lang]||ETA_T.nl)[k]).replace('{n}',n);};
  const etaKey=id=>'c109.loadTimes.'+(id||'any');
  function etaHistory(id){for(const k of [etaKey(id),etaKey('')]){try{const h=JSON.parse(localStorage.getItem(k)||'null');if(h&&typeof h==='object')return h;}catch(_){}}return null;}
  function etaExpected(id){const h=etaHistory(id),out={};for(const ph of ETA_ORDER){const list=Array.isArray(h?.[ph])?h[ph].filter(Number.isFinite):[];out[ph]=list.length?list.reduce((a,b)=>a+b,0)/list.length:ETA_DEFAULT[ph];}return out;}
  function etaRemember(l){if(!l?.durs)return;
    for(const key of new Set([etaKey(l.standId),etaKey('')])){let h={};try{h=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(_){}
      for(const ph of ETA_ORDER){const v=l.durs[ph];if(!Number.isFinite(v)||v<0||v>600)continue;h[ph]=[...(Array.isArray(h[ph])?h[ph]:[]),Math.round(v*10)/10].slice(-3);}
      try{localStorage.setItem(key,JSON.stringify(h));}catch(_){}}}
  function etaSeconds(l){
    if(!l||l.phase==='done'||l.phase==='failed')return null;const i=ETA_ORDER.indexOf(l.phase);if(i<0)return null;
    const exp=etaExpected(l.standId),inPhase=(Date.now()-(l.phaseAt||l.at||Date.now()))/1000;
    let rest=Math.max(0,exp[l.phase]-inPhase);for(const ph of ETA_ORDER.slice(i+1))rest+=exp[ph];
    const late=inPhase>exp[l.phase]+Math.max(5,exp[l.phase]*.5);
    return {sec:Math.max(5,Math.round(rest)),late};}
  function etaText(l){const e=etaSeconds(l);if(!e)return '';if(e.late)return et('late');if(e.sec>=90)return et('m',Math.round(e.sec/60));return et('s',e.sec<=5?5:Math.round(e.sec/5)*5);}
  let etaTick=0;
  function handleLoad(d){
    if(!d||!d.phase||!(d.phase in PHASE_SPAN||d.phase==='failed'))return;
    // C109aq: never a locked app. The screen starts as the capsule above the
    // tab bar; only native's full:true opens the full view, and even that one
    // shrinks to the capsule by itself after a few seconds, or on a tap beside
    // the card. A failure always lives in the capsule.
    if(!load){if(d.phase==='done'||d.phase==='failed')return;load={phase:d.phase,pct:0,standId:'',name:'',at:Date.now(),startAt:Date.now(),phaseAt:Date.now(),durs:{},minimised:d.full!==true,indeterminate:true};}
    else if(d.full===true)load.minimised=false;else if(d.minimised===true)load.minimised=true;
    if(d.phase==='failed')load.minimised=true;
    clearTimeout(loadFullTimer);if(!load.minimised&&d.phase!=='done')loadFullTimer=setTimeout(()=>{if(load&&!load.minimised&&load.phase!=='done'){load.minimised=true;renderLoad();loadSave();}},7000);
    if(d.standId)load.standId=String(d.standId);if(d.name||d.standName)load.name=String(d.name||d.standName);
    {const now=Date.now();if(!load.phaseAt)load.phaseAt=load.startAt||now;if(!load.durs)load.durs={};
     if(d.phase!==load.phase){if(ETA_ORDER.includes(load.phase))load.durs[load.phase]=(load.durs[load.phase]||0)+(now-load.phaseAt)/1000;load.phaseAt=now;}
     if(d.phase==='done'){etaRemember(load);}}
    load.phase=d.phase;load.at=Date.now();
    const span=PHASE_SPAN[d.phase];
    if(span){const known=Number.isFinite(d.done)&&Number.isFinite(d.total)&&d.total>0;load.indeterminate=!known;
      const target=d.phase==='done'?100:known?span[0]+(span[1]-span[0])*Math.min(1,d.done/d.total):span[0]+(span[1]-span[0])*.3;load.pct=Math.max(load.pct,target);}
    renderLoad();loadSave();
    clearTimeout(loadDoneTimer);if(d.phase==='done')loadDoneTimer=setTimeout(()=>{load=null;renderLoad();loadSave();},2400);
  }
  window.addEventListener('lightning:stand-load-progress',event=>handleLoad(event.detail||{}));
  window.LightningStandLoad=Object.freeze({progress:handleLoad,begin:d=>handleLoad({phase:'discover',...(d||{})}),done:d=>handleLoad({phase:'done',...(d||{})}),failed:d=>handleLoad({phase:'failed',...(d||{})}),dismiss(){load=null;renderLoad();loadSave();},state:()=>load?{...load}:null});
  // the app's own log lines, until native sends the event
  {const original=window.__c98log;const fromLog=line=>{const s=String(line);
      if(s.startsWith('READMIT_START')||s.startsWith('READMIT_RESUME'))handleLoad({phase:load&&load.phase!=='discover'?'access':'discover'});
      else if(s.startsWith('SHARED_ADOPT'))handleLoad({phase:'receivers'});
      else if(s.startsWith('ADOPT_OK'))handleLoad({phase:'zones'});
      else if(s.startsWith('READMIT_OK'))handleLoad({phase:'done'});
      else if(s.startsWith('READMIT_FAIL')||s.startsWith('ADOPT_FAIL'))handleLoad({phase:'failed'});};
    window.__c98log=function(line){try{fromLog(line);}catch(_){}return typeof original==='function'?original.apply(this,arguments):undefined;};}
  // leaving and coming back: restore what was in progress
  try{const saved=JSON.parse(localStorage.getItem(LOAD_KEY)||'null');if(saved&&Date.now()-saved.at<5*60*1000&&saved.phase!=='done'){load=saved;load.minimised=true;renderLoad();}else localStorage.removeItem(LOAD_KEY);}catch(_){}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&load)renderLoad();});
  // C109ao: no `:has()` in the stylesheet. One marker pass, batched per
  // frame in the existing observer, sets plain classes instead; the style
  // engine then never has to search subtrees (a page change took 150 ms on
  // a slow CPU with :has, 55 ms without).
  function syncMarkers(){
    const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>r.querySelectorAll(s);
    const set=(el,cls,on)=>{if(el&&el.classList.contains(cls)!==!!on)el.classList.toggle(cls,!!on);};
    const main=$('#main'),dock=$('#main .control-preview-dock');
    set(document.body,'c109-dock',!!dock);
    set(main,'c109-spi',!!$('#main .control-mode-tabs [data-action="colour-gradient109"]'));
    for(const tabs of $$('#main .control-mode-tabs'))set(tabs,'c109-three',tabs.querySelectorAll(':scope>button').length>=3);
    for(const actions of $$('#main .control-dock-actions'))set(actions,'c109-three',!!actions.querySelector('[data-action="colour-gradient109"]'));
    const dialog=$('#effect-dialog');
    if(dialog){const sheet=!!dialog.querySelector('[data-stand-control-sheet]');set(dialog,'c109-stand-sheet',sheet);set(dialog,'c109-scope-in-card',sheet&&!!dialog.querySelector('[data-stand-control-sheet] .power-card-stand .c109-scope'));}
    for(const d of $$('.pixel-setup-dialog'))set(d,'c109-port-pick',!!d.querySelector('.pixel-port-pick109'));
    for(const b of $$('.pixel-setup-body'))set(b,'c109-notice',!!b.querySelector('.pixel-count-preview .pixel-preview-notice'));
    for(const c of $$('#main .receiver-overview-card'))set(c,'c109-has-conn',!!c.querySelector('.receiver-connections'));
    for(const r of $$('.receiver-port-row'))set(r,'c109-off',!!r.querySelector('.receiver-port-switch[aria-checked="false"]'));
    for(const r of $$('.scene-card-row.ui606-scene-card'))set(r,'c109-quick',!!r.querySelector(':scope>.scene-quick-edit109'));
    for(const r of $$('.slider-row')){set(r,'c109-bri',!!r.querySelector(':scope>input:is([data-setting="bri"],[data-setting="brightness"],[data-setting="bgBrightness"])'));const label=r.querySelector(':scope>label');if(label)set(label,'c109-no-icon',!label.querySelector('.setting-label-icon'));}
    for(const r of $$('.gradient-reverse-row'))set(r,'c109-on',!!r.querySelector('input:checked'));
    set(document.documentElement,'c109-dark',document.body.dataset.theme==='dark');
    set(document.documentElement,'c109-modal',document.body.classList.contains('v50-layout-modal')||!!$('dialog[open]:modal'));
    // C109bd: a dialog of its own (the order editor is a panel in the page, not one): endless animations behind it pause.
    set(document.documentElement,'c109-dialog',!!$('dialog[open]:modal'));
    for(const s of $$('#main .ledline-setup.ui606-line-tools'))set(s,'c109-closed',s.querySelector('.ledline-setup-toggle')?.getAttribute('aria-expanded')==='false'&&!s.querySelector('dialog[open]'));
    set(document.body,'c109-scene-edit',!!$('.scene-edit-workbench'));
    // C109bl: the two choice rows of the Beweging card (type, direction) get the sliding pill like every other capsule row
    for(const row of $$('#main .gradient-motion-choices')){set(row,'c109-motion-type',!!row.querySelector('[data-gradient-motion-type]'));set(row,'c109-motion-flow',!!row.querySelector('[data-gradient-motion-flow]'));}
    for(const p of $$('.animation-family-preview,.animation-effect-preview'))set(p,'c109-spatial',!!p.querySelector(':scope>canvas.tunnel-effect-preview'));
  }
  let markerQueued=false;
  const queueMarkers=()=>{if(markerQueued)return;markerQueued=true;requestAnimationFrame(()=>{markerQueued=false;syncMarkers();});};
  new MutationObserver(queueMarkers).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open','aria-checked','aria-expanded','data-theme','class','checked']});
  document.addEventListener('change',queueMarkers,true);
  syncMarkers();
  // C109bd: while the page is hidden no animation runs at all.
  const syncHidden=()=>document.documentElement.classList.toggle('c109-hidden',document.hidden);document.addEventListener('visibilitychange',syncHidden);syncHidden();
  // C109aq: never a locked app, part two. The app makes the page inert while
  // the ledline-order sheet is open. If that sheet disappears through a
  // re-render without the release, the whole page would stay untouchable.
  // Every two seconds: no open sheet and still locked → release.
  setInterval(()=>{
    const sheetOpen=!!document.querySelector('[data-order-open="true"]');
    // C137: the setup-busy banner (another phone is setting up) blocks the page on purpose; it releases itself.
    if(sheetOpen||document.body.classList.contains('c137-setup-busy'))return;
    const locked=document.body.classList.contains('v50-layout-modal')||[...document.querySelectorAll('body>*,#main>*,main>*')].some(n=>n.inert&&!n.matches('details *'));
    if(!locked)return;
    document.body.classList.remove('v50-layout-modal');
    for(const n of document.querySelectorAll('body>*,#main>*,main>*,main>*>*'))if(n.inert&&!n.closest('details'))n.inert=false;
  },2000);
  // C109as: a calm connection chip where light actions live (the zone page
  // and Alles bedienen): "Stand niet bereikbaar · opnieuw verbinden…" while
  // the stand cannot be reached, "Opnieuw verbinden…" while it reconnects,
  // nothing once connected. Never blocks a tap. Native sends
  // `lightning:stand-connection` {state:'connected'|'connecting'|'unreachable'};
  // until then the app's own connection indicator (connected / checking /
  // unknown) drives it.
  const CONN_T={nl:{unreachable:'Stand niet bereikbaar · opnieuw verbinden…',connecting:'Opnieuw verbinden…'},en:{unreachable:'Stand unreachable · reconnecting…',connecting:'Reconnecting…'},fr:{unreachable:'Stand injoignable · reconnexion…',connecting:'Reconnexion…'},de:{unreachable:'Stand nicht erreichbar · verbinde erneut…',connecting:'Verbinde erneut…'}};
  let connNative=null,connNativeAt=0;
  function connState(){
    // C139ui-3: while the header pill still holds a fresh answer from the MAIN, one failed action does not turn the
    // notice line into "Stand niet bereikbaar" (the pill drops itself when the failure is confirmed).
    const pillC139=document.getElementById('main-connection-indicator675');
    if(connNative==='unreachable'&&pillC139&&!pillC139.hidden&&pillC139.dataset.connectionState==='connected')return 'connected';
    if(connNative&&Date.now()-connNativeAt<90000)return connNative;
    const host=document.getElementById('main-connection-indicator675');
    if(!host||host.hidden)return null;
    const s=host.dataset.connectionState;return s==='connected'?'connected':s==='checking'?'connecting':s==='unknown'?'unreachable':null;
  }
  function renderConn(){
    let el=document.getElementById('c109-conn');
    if(!el){el=document.createElement('div');el.id='c109-conn';el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.innerHTML='<span class="c109-conn-dot" aria-hidden="true"></span><span class="c109-conn-text"></span>';document.body.append(el);}
    const state=connState();
    // C109bq: the header pill already says it while it is on screen; one message is enough.
    const head=document.getElementById('main-connection-indicator675');
    const headVisible=!!head&&!head.hidden&&(()=>{const r=head.getBoundingClientRect();return r.height>0&&r.bottom>0&&r.top<innerHeight;})();
    // C109cl: no capsule of its own any more: "verbinden" goes into the one notice place
    // and has priority there. With the header pill on screen the pill says it, and the
    // bubble stays quiet (no loading or saving next to it); scrolled away, it is the
    // amber line on the tab bar.
    {const busy=state==='connecting'||state==='unreachable';const lang0=(document.documentElement.lang||'nl').slice(0,2);
     try{window.__c109ActConn?.(busy?(headVisible?{silent:true}:{title:(CONN_T[lang0]||CONN_T.nl)[state],state,onTap:()=>head?.click()}):null);}catch(_){}}
    const show=false;
    if(el.hidden!==!show)el.hidden=!show;if(!show)return; // C138jank: an unchanged write re-queued renderConn through its own 'hidden' observer every frame
    const lang=(document.documentElement.lang||'nl').slice(0,2);const T=CONN_T[lang]||CONN_T.nl;
    el.dataset.state=state;const text=T[state];const t=el.querySelector('.c109-conn-text');if(t.textContent!==text)t.textContent=text;
  }
  window.addEventListener('lightning:stand-connection',event=>{const s=event.detail&&event.detail.state;if(['connected','connecting','unreachable'].includes(s)){connNative=s;connNativeAt=Date.now();renderConn();}});
  let connQueued=false;const queueConn=()=>{if(connQueued)return;connQueued=true;requestAnimationFrame(()=>{connQueued=false;renderConn();});};
  new MutationObserver(queueConn).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-connection-state','hidden','open','class']});
  let connScrollQueued=false;addEventListener('scroll',()=>{if(connScrollQueued)return;connScrollQueued=true;requestAnimationFrame(()=>{connScrollQueued=false;renderConn();});},{passive:true});
  setInterval(renderConn,5000);renderConn();
  // C109au: behind the connection pill (header pill on the native app, the
  // C109as chip on the zone page) lives a small mesh sheet: which receiver
  // does what, the channel, signal, response time and how stable each link
  // is. Native feeds it with `lightning:mesh-status` or
  // window.LightningMesh.update({...}); without data the sheet shows the
  // stand and its state, and the demo shows demo figures, marked as such.
  const MESH_T={
    nl:{title:'Mesh-netwerk',channel:'Kanaal',receivers:'Receivers',stability:'Stabiliteit',latency:'Reactietijd',main:'Hoofdreceiver',node:'Receiver',drives:'stuurt',ports:'poorten',port:'poort',hops:'via',hop:'sprong',hopsN:'sprongen',direct:'rechtstreeks',updated:'Bijgewerkt',justNow:'zojuist',ago:'geleden',demo:'Demo-gegevens: in de echte stand komen hier de echte metingen.',waiting:'De details verschijnen zodra de stand verbonden is.',connected:'Verbonden',connecting:'Verbinden…',unreachable:'Niet bereikbaar',good:'Stabiel',fair:'Wisselend',poor:'Zwak',offline:'Niet gezien',sec:'s',min:'min',firmware:'Firmware'},
    en:{title:'Mesh network',channel:'Channel',receivers:'Receivers',stability:'Stability',latency:'Response',main:'Main receiver',node:'Receiver',drives:'drives',ports:'ports',port:'port',hops:'via',hop:'hop',hopsN:'hops',direct:'direct',updated:'Updated',justNow:'just now',ago:'ago',demo:'Demo figures: the real stand shows real measurements here.',waiting:'Details appear once the stand is connected.',connected:'Connected',connecting:'Connecting…',unreachable:'Unreachable',good:'Stable',fair:'Variable',poor:'Weak',offline:'Not seen',sec:'s',min:'min',firmware:'Firmware'},
    fr:{title:'Réseau mesh',channel:'Canal',receivers:'Récepteurs',stability:'Stabilité',latency:'Réponse',main:'Récepteur principal',node:'Récepteur',drives:'pilote',ports:'ports',port:'port',hops:'via',hop:'saut',hopsN:'sauts',direct:'direct',updated:'Mis à jour',justNow:'à l’instant',ago:'',demo:'Données de démo : le vrai stand affiche ici les vraies mesures.',waiting:'Les détails apparaissent dès que le stand est connecté.',connected:'Connecté',connecting:'Connexion…',unreachable:'Injoignable',good:'Stable',fair:'Variable',poor:'Faible',offline:'Non vu',sec:'s',min:'min',firmware:'Firmware'},
    de:{title:'Mesh-Netzwerk',channel:'Kanal',receivers:'Receiver',stability:'Stabilität',latency:'Reaktion',main:'Hauptreceiver',node:'Receiver',drives:'steuert',ports:'Ports',port:'Port',hops:'über',hop:'Sprung',hopsN:'Sprünge',direct:'direkt',updated:'Aktualisiert',justNow:'gerade eben',ago:'her',demo:'Demo-Werte: im echten Stand stehen hier die echten Messungen.',waiting:'Die Details erscheinen, sobald der Stand verbunden ist.',connected:'Verbunden',connecting:'Verbinden…',unreachable:'Nicht erreichbar',good:'Stabil',fair:'Wechselnd',poor:'Schwach',offline:'Nicht gesehen',sec:'s',min:'Min.',firmware:'Firmware'}};
  const mt=key=>{const lang=(document.documentElement.lang||'nl').slice(0,2);return (MESH_T[lang]||MESH_T.nl)[key]??MESH_T.nl[key];};
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isNative=()=>window.LightningNativeRuntime?.native===true||window.__lightningV30NativeHost===true;
  let mesh=null;
  function meshClean(d){
    if(!d||typeof d!=='object')return null;
    const num=(v,lo,hi)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(+v)?Math.min(hi,Math.max(lo,+v)):null;
    const receivers=Array.isArray(d.receivers)?d.receivers.slice(0,40).map(r=>r&&typeof r==='object'?{id:String(r.id??''),name:String(r.name??'').slice(0,60),type:/spi/i.test(String(r.type??''))?'SPI':'RGBW',role:r.role==='main'?'main':'node',drives:String(r.drives??'').slice(0,80),ports:num(r.ports,0,64),rssi:num(r.rssi,-120,0),latencyMs:num(r.latencyMs,0,99999),hops:num(r.hops,0,16),stability:num(r.stability,0,1),lastSeenMs:num(r.lastSeenMs,0,1e9),firmware:String(r.firmware??'').slice(0,24)}:null).filter(Boolean):[];
    return {name:String(d.name??'').slice(0,60),channel:num(d.channel,1,196),band:String(d.band??'').slice(0,12),receivers,updatedAt:Number.isFinite(+d.updatedAt)?+d.updatedAt:Date.now()};
  }
  function meshDemo(){
    const j=(a,b)=>a+Math.round(Math.random()*(b-a));
    return meshClean({name:'Demo',channel:6,band:'2.4 GHz',receivers:[
      {id:'main',name:'Receiver 1',type:'RGBW',role:'main',drives:'Demohoek · 3 ledlines',ports:3,rssi:-48,latencyMs:j(6,11),hops:0,stability:.99,lastSeenMs:j(100,900),firmware:'C123'},
      {id:'r2',name:'Receiver 2',type:'SPI',role:'node',drives:'Lichttunnel · 1 ledline',ports:1,rssi:j(-66,-58),latencyMs:j(12,24),hops:1,stability:.96,lastSeenMs:j(200,1500),firmware:'C123'},
      {id:'r3',name:'Receiver 3',type:'RGBW',role:'node',drives:'Wand · 2 ledlines',ports:2,rssi:j(-74,-64),latencyMs:j(18,38),hops:1,stability:.91,lastSeenMs:j(300,2500),firmware:'C123'}]});
  }
  const sigBars=rssi=>rssi===null?0:rssi>=-55?4:rssi>=-65?3:rssi>=-75?2:rssi>=-85?1:0;
  const stabKey=(s,seen)=>seen!==null&&seen>30000?'offline':s===null?null:s>=.9?'good':s>=.7?'fair':'poor';
  function meshSheet(){
    let d=document.getElementById('c109-mesh-sheet');if(d)return d;
    d=document.createElement('dialog');d.id='c109-mesh-sheet';d.className='c109-zone-sheet c109-mesh-sheet';window.__c109SoftClose?.(d);
    d.innerHTML='<header class="c109-sheet-head"><div class="c109-mesh-title"><h2></h2><small class="c109-mesh-sub"></small></div><button type="button" class="c109-sheet-close" aria-label=""><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button></header><div class="c109-mesh-body"></div>';
    d.querySelector('.c109-sheet-close').addEventListener('click',()=>d.close());
    d.addEventListener('click',event=>{if(event.target===d)d.close();});
    document.body.append(d);return d;
  }
  function meshState(){
    const s=connState();if(s)return s;
    const host=document.getElementById('main-connection-indicator675');const v=host?.dataset.connectionState;
    return v==='connected'?'connected':v==='checking'?'connecting':v==='unknown'?'unreachable':isNative()?'connecting':'connected';
  }
  function renderMesh(){
    const d=document.getElementById('c109-mesh-sheet');if(!d||!d.open)return;
    const data=mesh||(!isNative()?meshDemo():null),state=meshState();
    const standName=data?.name||document.querySelector('#main-connection-indicator675 small')?.textContent?.trim()||'';
    d.setAttribute('aria-label',mt('title'));d.querySelector('h2').textContent=mt('title');d.querySelector('.c109-sheet-close').setAttribute('aria-label',lt('close'));
    d.querySelector('.c109-mesh-sub').innerHTML='<i class="c109-mesh-state" data-state="'+esc(state)+'"></i>'+esc(mt(state))+(standName?' · '+esc(standName):'');
    const body=d.querySelector('.c109-mesh-body');
    if(!data){body.innerHTML='<p class="c109-mesh-wait">'+esc(mt('waiting'))+'</p>';return;}
    const rs=data.receivers,lat=rs.map(r=>r.latencyMs).filter(v=>v!==null),st=rs.map(r=>r.stability).filter(v=>v!==null);
    const avgLat=lat.length?Math.round(lat.reduce((a,b)=>a+b,0)/lat.length):null,minSt=st.length?Math.min(...st):null;
    const tiles=[[mt('channel'),data.channel!==null?String(data.channel):'–',data.band],[mt('receivers'),String(rs.length),rs.some(r=>r.role==='main')?'MAIN + '+(rs.length-1):''],[mt('stability'),minSt!==null?Math.round(minSt*100)+'%':'–',minSt!==null?mt(stabKey(minSt,null)):''],[mt('latency'),avgLat!==null?avgLat+' ms':'–','']];
    let html='<div class="c109-mesh-tiles">'+tiles.map(([k,v,s])=>'<div class="c109-mesh-tile"><small>'+esc(k)+'</small><b>'+esc(v)+'</b><span>'+esc(s)+'</span></div>').join('')+'</div><ul class="c109-mesh-list">';
    for(const r of [...rs].sort((a,b)=>(a.role==='main'?0:1)-(b.role==='main'?0:1))){
      const bars=sigBars(r.rssi),key=stabKey(r.stability,r.lastSeenMs);
      const hops=r.hops===null?'':r.hops===0?mt('direct'):mt('hops')+' '+r.hops+' '+(r.hops===1?mt('hop'):mt('hopsN'));
      const meta=[r.type,r.ports!==null?r.ports+' '+mt(r.ports===1?'port':'ports'):'',hops,r.firmware?mt('firmware')+' '+r.firmware:''].filter(Boolean).join(' · ');
      html+='<li class="c109-mesh-row" data-role="'+r.role+'"><span class="c109-mesh-ic" aria-hidden="true">'+(r.role==='main'?'<svg viewBox="0 0 24 24"><path d="M4 17h16M5 15l1.5-8 4 4L12 5l1.5 6 4-4L19 15Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>':'<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 12h.01M12 12h.01M16 12h.01" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>')+'</span>'
        +'<span class="c109-mesh-copy"><b>'+esc(r.name||(r.role==='main'?mt('main'):mt('node')))+(r.role==='main'?' <em>'+esc(mt('main'))+'</em>':'')+'</b>'+(r.drives?'<span class="c109-mesh-drives">'+esc(mt('drives'))+' '+esc(r.drives)+'</span>':'')+'<small>'+esc(meta)+'</small></span>'
        +'<span class="c109-mesh-stats"><span class="c109-mesh-sig" aria-label="'+(r.rssi!==null?esc(r.rssi+' dBm'):'')+'" data-bars="'+bars+'"><i></i><i></i><i></i><i></i></span>'+(r.latencyMs!==null?'<b>'+esc(Math.round(r.latencyMs))+' ms</b>':'')+(key?'<small class="c109-mesh-stab" data-k="'+key+'">'+esc(mt(key))+(r.stability!==null&&key!=='offline'?' · '+Math.round(r.stability*100)+'%':'')+'</small>':'')+'</span></li>';
    }
    const age=Math.max(0,Date.now()-data.updatedAt),ageText=age<5000?mt('justNow'):age<60000?Math.round(age/1000)+' '+mt('sec')+' '+mt('ago'):Math.round(age/60000)+' '+mt('min')+' '+mt('ago');
    html+='</ul><p class="c109-mesh-foot">'+(mesh?esc(mt('updated'))+' '+esc(ageText.trim()):esc(mt('demo')))+'</p>';
    body.innerHTML=html;
  }
  function openMesh(){const d=meshSheet();if(!d.open)d.showModal();renderMesh();try{window.LightningInterfaceHaptics?.emit?.('selection','mesh-open',{userInitiated:true});}catch(_){}}
  window.LightningMesh={update(detail){const clean=meshClean(detail);if(!clean)return false;mesh=clean;renderMesh();return true;},open:openMesh,get data(){return mesh;}};
  window.addEventListener('lightning:mesh-status',event=>{window.LightningMesh.update(event.detail);});
  document.addEventListener('click',event=>{const hit=event.target.closest?.('#main-connection-indicator675,#c109-conn');if(!hit)return;event.preventDefault();openMesh();});
  setInterval(()=>{const d=document.getElementById('c109-mesh-sheet');if(d?.open)renderMesh();},4000);
  // C109bb: a small, calm bubble from the connection pill when something in
  // the mesh changes (a receiver drops out or comes back, is added or removed,
  // the channel moves, a link gets unstable). Native sends
  // `lightning:mesh-change` {kind, receiverId, name}; until then changes are
  // read from consecutive `lightning:mesh-status` updates. About three
  // seconds, one at a time, never an error tone; a tap opens the mesh sheet.
  const CHANGE_T={
    nl:{offline:'{name} is even niet bereikbaar',online:'{name} is weer verbonden',added:'{name} is toegevoegd',removed:'{name} is verwijderd',rekey:'Netwerksleutel vernieuwd',channel:'Kanaal gewijzigd naar {channel}',unstable:'{name} heeft een wisselend signaal',main:'{name} is nu de hoofdreceiver',restart:'{name} is herstart en weer verbonden',generic:'Mesh-netwerk gewijzigd',receiver:'Een receiver',tap:'Tik voor details'},
    en:{offline:'{name} is unreachable for a moment',online:'{name} is connected again',added:'{name} was added',removed:'{name} was removed',rekey:'Network key renewed',channel:'Channel changed to {channel}',unstable:'{name} has a variable signal',main:'{name} is now the main receiver',restart:'{name} restarted and is connected again',generic:'Mesh network changed',receiver:'A receiver',tap:'Tap for details'},
    fr:{offline:'{name} est momentanément injoignable',online:'{name} est de nouveau connecté',added:'{name} a été ajouté',removed:'{name} a été retiré',rekey:'Clé réseau renouvelée',channel:'Canal changé en {channel}',unstable:'{name} a un signal variable',main:'{name} est maintenant le récepteur principal',restart:'{name} a redémarré et est de nouveau connecté',generic:'Réseau mesh modifié',receiver:'Un récepteur',tap:'Touchez pour les détails'},
    de:{offline:'{name} ist kurz nicht erreichbar',online:'{name} ist wieder verbunden',added:'{name} wurde hinzugefügt',removed:'{name} wurde entfernt',rekey:'Netzwerkschlüssel erneuert',channel:'Kanal gewechselt auf {channel}',unstable:'{name} hat ein wechselndes Signal',main:'{name} ist jetzt der Hauptreceiver',restart:'{name} wurde neu gestartet und ist wieder verbunden',generic:'Mesh-Netzwerk geändert',receiver:'Ein Receiver',tap:'Tippen für Details'}};
  const ct=(key,p={})=>{const lang=(document.documentElement.lang||'nl').slice(0,2);const T=CHANGE_T[lang]||CHANGE_T.nl;return (T[key]??CHANGE_T.nl[key]??T.generic).replace(/\{(\w+)\}/g,(_,k)=>p[k]??'');};
  const CHANGE_KINDS=['offline','online','added','removed','rekey','channel','unstable','main','restart'];
  const changeQueue=[];let changeTimer=0,changeShowing=null;
  function changeAnchor(){
    const head=document.getElementById('main-connection-indicator675');
    if(head&&!head.hidden){const r=head.getBoundingClientRect();if(r.height>0&&r.width>0)return {rect:r,side:'below'};}
    const chip=document.getElementById('c109-conn');
    if(chip&&!chip.hidden){const r=chip.getBoundingClientRect();if(r.height>0)return {rect:r,side:'above'};}
    return null;
  }
  function changeBubble(){
    let el=document.getElementById('c109-mesh-note');if(el)return el;
    el=document.createElement('button');el.type='button';el.id='c109-mesh-note';el.hidden=true;el.setAttribute('aria-live','polite');
    el.innerHTML='<i class="c109-mesh-note-dot" aria-hidden="true"></i><span class="c109-mesh-note-copy"><b></b><small></small></span>';
    el.addEventListener('click',()=>{hideChange(true);openMesh();});
    document.body.append(el);return el;
  }
  function hideChange(now){
    clearTimeout(changeTimer);changeTimer=0;const el=document.getElementById('c109-mesh-note');if(!el||el.hidden)return;
    changeShowing=null;
    if(now||matchMedia('(prefers-reduced-motion:reduce)').matches){el.hidden=true;nextChange();return;}
    el.classList.add('is-out');setTimeout(()=>{el.classList.remove('is-out');el.hidden=true;nextChange();},260);
  }
  function nextChange(){
    if(changeShowing||!changeQueue.length)return;
    const item=changeQueue.shift();const el=changeBubble();const anchor=changeAnchor();
    el.dataset.kind=item.kind;el.querySelector('b').textContent=item.text;el.querySelector('small').textContent=ct('tap');
    el.classList.remove('is-out');el.hidden=false;el.style.left='';el.style.right='';el.style.top='';el.style.bottom='';el.dataset.side=anchor?anchor.side:'top';
    const margin=12,width=Math.min(innerWidth-2*margin,el.offsetWidth||300);
    if(anchor){const cx=anchor.rect.left+anchor.rect.width/2;let left=Math.round(cx-width/2);left=Math.max(margin,Math.min(innerWidth-margin-width,left));el.style.left=left+'px';el.style.setProperty('--c109-tail',Math.round(cx-left)+'px');
      if(anchor.side==='below')el.style.top=Math.round(anchor.rect.bottom+10)+'px';else el.style.bottom=Math.round(innerHeight-anchor.rect.top+10)+'px';}
    else{el.style.left=Math.round((innerWidth-width)/2)+'px';el.style.top='calc(env(safe-area-inset-top,0px) + 64px)';el.style.setProperty('--c109-tail','50%');}
    changeShowing=item;
    try{window.LightningInterfaceHaptics?.emit?.('notice','mesh-change',{userInitiated:false});}catch(_){}
    changeTimer=setTimeout(()=>hideChange(false),item.ms||3200);
  }
  function noteChange(detail){
    if(!detail||typeof detail!=='object')return false;
    const kind=CHANGE_KINDS.includes(detail.kind)?detail.kind:'generic';
    const name=String(detail.name??'').trim().slice(0,40)||ct('receiver');
    const text=ct(kind,{name,channel:Number.isFinite(+detail.channel)?String(+detail.channel):''});
    const key=kind+'|'+String(detail.receiverId??name);
    // the same change twice within a few seconds is one bubble
    if(changeShowing?.key===key||changeQueue.some(q=>q.key===key))return true;
    changeQueue.push({kind,text,key,ms:Number.isFinite(+detail.ms)?Math.min(8000,Math.max(1500,+detail.ms)):3200});
    if(changeQueue.length>4)changeQueue.splice(0,changeQueue.length-4);
    nextChange();return true;
  }
  window.addEventListener('lightning:mesh-change',event=>{noteChange(event.detail);});
  window.LightningMesh.notify=noteChange;
  // derive changes from consecutive status updates until native sends them
  let meshPrev=null,meshDerive=true;
  window.addEventListener('lightning:mesh-change',()=>{meshDerive=false;},{once:true});
  const meshDown=r=>r.lastSeenMs!==null&&r.lastSeenMs>30000;
  window.addEventListener('lightning:mesh-status',event=>{
    if(event.detail?.changes==='native')meshDerive=false;
    const cur=mesh;if(!cur)return;
    if(meshPrev&&meshDerive){
      const prevById=new Map(meshPrev.receivers.map(r=>[r.id,r]));
      for(const r of cur.receivers){const p=prevById.get(r.id);
        if(!p){noteChange({kind:'added',receiverId:r.id,name:r.name});continue;}
        if(meshDown(r)&&!meshDown(p))noteChange({kind:'offline',receiverId:r.id,name:r.name});
        else if(!meshDown(r)&&meshDown(p))noteChange({kind:'online',receiverId:r.id,name:r.name});
        else if(r.stability!==null&&p.stability!==null&&r.stability<.7&&p.stability>=.7)noteChange({kind:'unstable',receiverId:r.id,name:r.name});
        if(r.role==='main'&&p.role!=='main')noteChange({kind:'main',receiverId:r.id,name:r.name});}
      for(const p of meshPrev.receivers)if(!cur.receivers.some(r=>r.id===p.id))noteChange({kind:'removed',receiverId:p.id,name:p.name});
      if(cur.channel!==null&&meshPrev.channel!==null&&cur.channel!==meshPrev.channel)noteChange({kind:'channel',channel:cur.channel});
    }
    meshPrev=cur;
  });
  addEventListener('resize',()=>{if(changeShowing)hideChange(true);});
  // C109bj: the Tijdlijn tab under "Meer instellingen" for animations that
  // run line after line. The picture follows "Bekijk als" (wall / tunnel /
  // normal ledlines); between every two ledlines sits a pause capsule. Every
  // change applies live, like the sliders. The pauses are stored as
  // lineGapsMs (null = evenly spaced = the old behaviour) and, for the
  // receivers, translated into virtual line slots (step d = greatest common
  // divisor of the pauses; slot_k = round(start_k / d); LINECOUNT = max+1),
  // which the firmware already understands. Slots are sent only when the
  // native app reports support (runtime.services.lineSlots).
  const TL_T={
    nl:{tabSettings:'Instellingen',tabTimeline:'Tijdlijn',hint:'Tik tussen twee ledlines voor de pauze.',pause:'Pauze tussen {a} en {b}',even:'Gelijk verdelen',total:'Hele reeks',again:'dan opnieuw',longer:'Langer…',sec:'s',live:'Live',soon:'De stand volgt de pauzes zodra de app is bijgewerkt.',picture:'Ledlines in volgorde'},
    en:{tabSettings:'Settings',tabTimeline:'Timeline',hint:'Tap between two LED lines for the pause.',pause:'Pause between {a} and {b}',even:'Space evenly',total:'Whole sequence',again:'then again',longer:'Longer…',sec:'s',live:'Live',soon:'The stand follows the pauses once the app is updated.',picture:'LED lines in order'},
    fr:{tabSettings:'Réglages',tabTimeline:'Chronologie',hint:'Touchez entre deux lignes LED pour la pause.',pause:'Pause entre {a} et {b}',even:'Répartir également',total:'Séquence entière',again:'puis à nouveau',longer:'Plus long…',sec:'s',live:'En direct',soon:'Le stand suivra les pauses dès la mise à jour de l’app.',picture:'Lignes LED dans l’ordre'},
    de:{tabSettings:'Einstellungen',tabTimeline:'Zeitleiste',hint:'Tippe zwischen zwei LED-Linien für die Pause.',pause:'Pause zwischen {a} und {b}',even:'Gleich verteilen',total:'Ganze Abfolge',again:'dann erneut',longer:'Länger…',sec:'s',live:'Live',soon:'Der Stand folgt den Pausen, sobald die App aktualisiert ist.',picture:'LED-Linien in Reihenfolge'}};
  const tlt=(key,p={})=>{const lang=(document.documentElement.lang||'nl').slice(0,2);const T=TL_T[lang]||TL_T.nl;return (T[key]??TL_T.nl[key]).replace(/\{(\w+)\}/g,(_,k)=>p[k]??'');};
  const fmtS=ms=>{const s=Math.round(ms/100)/10;return (s%1?s.toFixed(1):String(s)).replace('.',',')+' '+tlt('sec');};
  const gcd=(a,b)=>{while(b){[a,b]=[b,a%b];}return a;};
  // the virtual slots for a list of pauses (ms), quantised to the receiver family's step
  function virtualSlots(gaps,quantum){
    const q=Math.max(10,quantum|0),round=v=>Math.max(0,Math.round(v/q)*q);
    const g=gaps.map(round);
    let d=g.reduce((acc,v)=>v>0?(acc?gcd(acc,v):v):acc,0)||q;d=Math.max(d,q);
    const starts=[0];for(const v of g)starts.push(starts[starts.length-1]+v);
    const limit=120;
    while(Math.round(starts[starts.length-1]/d)+1>limit)d+=q;
    const slots=starts.map(v=>Math.round(v/d));
    return {step:d,slots,count:slots[slots.length-1]+1,starts};
  }
  let tlTab='settings';try{tlTab=localStorage.getItem('c109.timelineTab')||'settings';}catch(_){}
  let tlOpenGap=-1,tlLonger=false,tlApplyTimer=0,tlDraft=null;
  function tlBridge(){return window.LightningTimelineC109||null;}
  function tlGaps(bridge,lines){
    const state=bridge.state()||{},n=lines.length;if(n<2)return [];
    if(tlDraft&&tlDraft.n===n)return tlDraft.gaps.slice();
    const base=Math.max(0,Math.round(Number(state.lineDelayMs)||0));
    const stored=Array.isArray(state.lineGapsMs)&&state.lineGapsMs.length===n-1?state.lineGapsMs.map(v=>Math.max(0,Math.round(Number(v)||0))):null;
    return stored||Array.from({length:n-1},()=>base);
  }
  function tlApply(bridge,gaps){
    const quantum=bridge.zoneType()==='SPI'?40:10,allEqual=gaps.every(v=>v===gaps[0]);
    const v=virtualSlots(gaps,quantum);
    const patch=allEqual?{lineDelayMs:Math.min(60000,gaps[0]||0),lineGapsMs:null,lineSlots:null,lineSlotCount:null}
      :{lineDelayMs:Math.min(5000,v.step),lineGapsMs:gaps.slice(),lineSlots:bridge.slotsSupported()?v.slots:null,lineSlotCount:bridge.slotsSupported()?v.count:null};
    clearTimeout(tlApplyTimer);tlApplyTimer=setTimeout(()=>{try{bridge.apply(patch);}catch(_){}},220);
  }
  function tlPicture(host,bridge,lines,gaps,view){
    const n=lines.length,starts=[0];for(const g of gaps)starts.push(starts[starts.length-1]+g);
    const cap=(i)=>`<button type="button" class="c109-tl-gap${gaps[i]!==gaps[0]||tlOpenGap===i?' is-custom':''}${tlOpenGap===i?' is-open':''}" data-gap="${i}" aria-expanded="${tlOpenGap===i}" aria-label="${tlt('pause',{a:i+1,b:i+2})}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>${fmtS(gaps[i])}</button>`;
    const canvas=document.querySelector('#main .control-preview-dock canvas[data-preview]');
    let badges=null;try{badges=JSON.parse(canvas?.dataset.lineTargetBadges||'null');}catch(_){badges=null;}
    if(['wall','tunnel'].includes(view)&&canvas&&Array.isArray(badges)&&badges.length>=n&&canvas.width>0){
      let src='';try{src=canvas.toDataURL('image/jpeg',.82);}catch(_){src='';}
      const spi=bridge.zoneType()==='SPI';
      const pts=lines.map(line=>badges.find(b=>(spi?b.lineId:b.receiverId)===(spi?line.id:line.receiverId))).filter(Boolean);
      if(src&&pts.length===n){
        // the app's own wall/tunnel picture, with one tidy strip underneath:
        // badge · start time, a pause capsule between every two
        const w=canvas.clientWidth||canvas.width,h=canvas.clientHeight||canvas.height;
        let html=`<div class="c109-tl-stage" data-view="${view}" style="aspect-ratio:${w}/${h}"><img src="${src}" alt=""></div><div class="c109-tl-strip">`;
        lines.forEach((line,i)=>{html+=`<span class="c109-tl-node"><b>${i+1}</b><small>${fmtS(starts[i])}</small></span>`;if(i<n-1)html+=`<span class="c109-tl-link"><i></i>${cap(i)}<i></i></span>`;});
        return html+'</div>';
      }
    }
    let html=`<div class="c109-tl-stage c109-tl-rows" data-view="normal" aria-label="${tlt('picture')}">`;
    lines.forEach((line,i)=>{html+=`<div class="c109-tl-row"><b>${i+1}</b><i${i===n-1?' class="dim"':''}></i><span>${fmtS(starts[i])}</span></div>`;if(i<n-1)html+=`<div class="c109-tl-between"><span></span>${cap(i)}</div>`;});
    return html+'</div>';
  }
  function tlPicker(gaps){
    const i=tlOpenGap;if(i<0||i>=gaps.length)return '';
    const v=gaps[i],quick=[200,500,1000,2000,5000,8000];
    return `<div class="c109-tl-picker"><header><b>${tlt('pause',{a:i+1,b:i+2})}</b><span><em>${fmtS(v).replace(' '+tlt('sec'),'')}</em><small>${tlt('sec')}</small></span></header>
      <input type="range" class="c109-tl-range" min="0" max="10000" step="100" value="${Math.min(10000,v)}" aria-label="${tlt('pause',{a:i+1,b:i+2})}">
      <div class="c109-tl-ticks"><span>0</span><span>2 s</span><span>4 s</span><span>6 s</span><span>8 s</span><span>10 s</span></div>
      <div class="c109-tl-quick">${quick.map(q=>`<button type="button" data-ms="${q}" aria-pressed="${q===v}">${fmtS(q)}</button>`).join('')}<button type="button" class="is-more" data-longer aria-expanded="${tlLonger}">${tlt('longer')}</button></div>
      ${tlLonger?`<label class="c109-tl-longer"><input type="number" inputmode="decimal" min="0" max="60" step="0.1" value="${(v/1000).toFixed(1)}"> ${tlt('sec')}</label>`:''}</div>`;
  }
  function renderTimeline(host){
    const bridge=tlBridge();if(!bridge)return;
    const lines=bridge.lines();const ok=bridge.available()&&lines.length>=2;
    host.hidden=!ok;const section=host.closest('#animation-settings');
    if(!ok){section?.classList.remove('c109-timeline-on');return;}
    const on=tlTab==='timeline';section?.classList.toggle('c109-timeline-on',on);
    const gaps=tlGaps(bridge,lines),starts=gaps.reduce((acc,g)=>acc+g,0);
    let html=`<div class="c109-tl-tabs" role="tablist"><button type="button" role="tab" aria-selected="${!on}" data-tl-tab="settings">${tlt('tabSettings')}</button><button type="button" role="tab" aria-selected="${on}" data-tl-tab="timeline">${tlt('tabTimeline')}</button></div>`;
    if(on){
      html+=`<div class="c109-tl-head"><p>${tlt('hint')}</p><span class="c109-tl-live"><i></i>${tlt('live')}</span></div>`;
      html+=tlPicture(host,bridge,lines,gaps,bridge.view());
      html+=tlPicker(gaps);
      html+=`<div class="c109-tl-foot"><button type="button" class="c109-tl-even" data-even><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>${tlt('even')}</button><span class="c109-tl-total">${tlt('total')} <b>${fmtS(starts)}</b> · ${tlt('again')}</span></div>`;
      if(bridge.native()&&!bridge.slotsSupported()&&!gaps.every(v=>v===gaps[0]))html+=`<p class="c109-tl-soon">${tlt('soon')}</p>`;
    }
    host.innerHTML=html;
  }
  function syncTimeline(){for(const host of document.querySelectorAll('[data-c109-timeline]'))renderTimeline(host);}
  document.addEventListener('click',event=>{
    const host=event.target.closest?.('[data-c109-timeline]');if(!host)return;
    const bridge=tlBridge();if(!bridge)return;const lines=bridge.lines();
    const tab=event.target.closest('[data-tl-tab]');if(tab){tlTab=tab.dataset.tlTab;try{localStorage.setItem('c109.timelineTab',tlTab);}catch(_){}renderTimeline(host);return;}
    const gapBtn=event.target.closest('[data-gap]');if(gapBtn){const i=+gapBtn.dataset.gap;tlOpenGap=tlOpenGap===i?-1:i;tlLonger=false;renderTimeline(host);return;}
    const quick=event.target.closest('.c109-tl-quick button[data-ms]');if(quick){const gaps=tlGaps(bridge,lines);gaps[tlOpenGap]=+quick.dataset.ms;tlDraft={n:lines.length,gaps};renderTimeline(host);tlApply(bridge,gaps);return;}
    if(event.target.closest('[data-longer]')){tlLonger=!tlLonger;renderTimeline(host);if(tlLonger)host.querySelector('.c109-tl-longer input')?.focus();return;}
    if(event.target.closest('[data-even]')){const gaps=tlGaps(bridge,lines);const avg=Math.round(gaps.reduce((a,b)=>a+b,0)/gaps.length/100)*100;const even=gaps.map(()=>avg);tlDraft={n:lines.length,gaps:even};tlOpenGap=-1;renderTimeline(host);tlApply(bridge,even);return;}
  });
  document.addEventListener('input',event=>{
    const host=event.target.closest?.('[data-c109-timeline]');if(!host)return;const bridge=tlBridge();if(!bridge)return;const lines=bridge.lines();
    if(event.target.matches('.c109-tl-range')){const gaps=tlGaps(bridge,lines);gaps[tlOpenGap]=+event.target.value;tlDraft={n:lines.length,gaps};
      const em=host.querySelector('.c109-tl-picker header em');if(em)em.textContent=fmtS(gaps[tlOpenGap]).replace(' '+tlt('sec'),'');
      for(const b of host.querySelectorAll('.c109-tl-quick button[data-ms]'))b.setAttribute('aria-pressed',String(+b.dataset.ms===gaps[tlOpenGap]));
      const cap=host.querySelector(`[data-gap="${tlOpenGap}"]`);if(cap){cap.lastChild.textContent=fmtS(gaps[tlOpenGap]);}
      tlApply(bridge,gaps);return;}
    if(event.target.matches('.c109-tl-longer input')){const s=Math.max(0,Math.min(60,Number(String(event.target.value).replace(',','.'))||0));const gaps=tlGaps(bridge,lines);gaps[tlOpenGap]=Math.round(s*10)*100;tlDraft={n:lines.length,gaps};tlApply(bridge,gaps);const cap=host.querySelector(`[data-gap="${tlOpenGap}"]`);if(cap)cap.lastChild.textContent=fmtS(gaps[tlOpenGap]);}
  });
  document.addEventListener('change',event=>{const host=event.target.closest?.('[data-c109-timeline]');if(host&&event.target.matches('.c109-tl-range,.c109-tl-longer input'))renderTimeline(host);});
  // the draft is forgotten when the page changes (a new render brings the stored state)
  new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('[data-c109-timeline]')||n.querySelector?.('[data-c109-timeline]'))))){tlDraft=null;tlOpenGap=-1;syncTimeline();}}).observe(document.body,{childList:true,subtree:true});
  syncTimeline();
  // C109br: one place for "the app is busy with the stand". Saving the stand
  // on the receivers and synchronising an animation never float over the
  // controls: with the connection pill on screen the notice comes out of that
  // pill; scrolled away, it sits as a small tab on the top edge of the tab bar.
  // It only appears when the work takes longer than ~1.2 s, and a finished
  // job says "Alles gesynchroniseerd" once (also after setting up or changing
  // a receiver: those end with the same save on the receivers).
  const ACT_T={
    nl:{save:'Stand bewaren op receivers',sync:'Animatie synchroniseren',join:'Standanimatie synchroniseren',joinHint:'Alle receivers worden op één tijd afgestemd.',startIn:'Samen starten over {s} s',done:'Alles gesynchroniseerd',saved:'Bewaard op alle receivers',retry:'Bewaren op de receivers lukt nog niet. Het wordt vanzelf opnieuw geprobeerd.'},
    en:{save:'Saving the stand on the receivers',sync:'Synchronising the animation',join:'Synchronising the stand animation',joinHint:'All receivers are being aligned to one clock.',startIn:'Starting together in {s} s',done:'All synchronised',saved:'Saved on all receivers',retry:'Saving on the receivers has not worked yet. It will be retried automatically.'},
    fr:{save:'Enregistrement du stand sur les récepteurs',sync:'Synchronisation de l’animation',join:'Synchronisation de l’animation du stand',joinHint:'Tous les récepteurs se calent sur une même horloge.',startIn:'Départ commun dans {s} s',done:'Tout est synchronisé',saved:'Enregistré sur tous les récepteurs',retry:'L’enregistrement sur les récepteurs n’a pas encore abouti. Nouvel essai automatique.'},
    de:{save:'Stand wird auf den Receivern gespeichert',sync:'Animation wird synchronisiert',join:'Standanimation wird synchronisiert',joinHint:'Alle Receiver werden auf eine Uhr abgestimmt.',startIn:'Gemeinsamer Start in {s} s',done:'Alles synchronisiert',saved:'Auf allen Receivern gespeichert',retry:'Speichern auf den Receivern hat noch nicht geklappt. Es wird automatisch erneut versucht.'}};
  const at=(key,p={})=>{const lang=(document.documentElement.lang||'nl').slice(0,2);return ((ACT_T[lang]||ACT_T.nl)[key]??ACT_T.nl[key]).replace(/\{(\w+)\}/g,(_,k)=>p[k]??'');};
  const ACT_DELAY=1200;
  let act=null,actDoneTimer=0;
  function actPill(){
    const head=document.getElementById('main-connection-indicator675');
    if(!head||head.hidden)return null;const r=head.getBoundingClientRect();
    return r.height>0&&r.bottom>4&&r.top<innerHeight?r:null;
  }
  function actEl(){
    let el=document.getElementById('c109-activity');if(el)return el;
    el=document.createElement('div');el.id='c109-activity';el.hidden=true;el.setAttribute('role','status');el.setAttribute('aria-live','polite');
    el.innerHTML='<i class="c109-act-ring" aria-hidden="true"></i><span class="c109-act-copy"><b></b><small></small></span>';
    el.addEventListener('click',()=>{try{(connAct&&!connAct.silent?connAct:loadAct)?.onTap?.();}catch(_){}});
    document.body.append(el);return el;
  }
  function actPlace(el){
    const pill=actPill(),margin=12;
    el.style.left='';el.style.top='';el.style.bottom='';el.style.width='';
    const width=Math.min(innerWidth-2*margin,el.offsetWidth||260);
    if(pill){
      el.dataset.anchor='pill';
      const cx=pill.left+pill.width/2;let left=Math.round(cx-width/2);left=Math.max(margin,Math.min(innerWidth-margin-width,left));
      el.style.left=left+'px';el.style.top=Math.round(pill.bottom+10)+'px';el.style.setProperty('--c109-tail',Math.round(cx-left)+'px');
    }else if(el.classList.contains('is-notice')){
      // a notice without a connection pill (web demo): a capsule under the logo bar
      el.dataset.anchor='top';const brand=document.querySelector('header.brand-bar')?.getBoundingClientRect();
      el.style.left=Math.max(margin,Math.round((innerWidth-width)/2))+'px';el.style.top=Math.round((brand&&brand.bottom>0?brand.bottom:4)+10)+'px';
    }else{
      // inside the tab bar: a thin line along its top edge (the words stay in the pill)
      el.dataset.anchor='nav';
      const nav=document.querySelector('nav.navigation');const r=nav?.getBoundingClientRect();
      if(r&&r.height){const inset=Math.max(18,r.height*.4);el.style.left=Math.round(r.left+inset)+'px';el.style.top=Math.round(r.top+4)+'px';el.style.width=Math.round(r.width-2*inset)+'px';}
      else{el.style.left='24px';el.style.width=(innerWidth-48)+'px';el.style.bottom='90px';}
    }
  }
  // C109cf: one notice at a time, in one place. Loading the stand comes first
  // (it used to be a second capsule at the bottom); a save shows when it is done.
  let loadAct=null,connAct=null;
  window.__c109ActConn=data=>{const next=data||null;if(JSON.stringify(next&&{...next,onTap:0})===JSON.stringify(connAct&&{...connAct,onTap:0}))return;connAct=next;const el=actEl();el.classList.toggle('is-conn',!!connAct&&!connAct.silent);el.dataset.connState=connAct?.state||'';actRender();};
  window.__c109ActLoad=data=>{loadAct=data||null;const el=actEl();el.classList.toggle('is-load',!!loadAct);if(loadAct)clearTimeout(actDoneTimer);actRender();};
  // C109cs: a short confirmation ("Scène opgeslagen en actief.") shows in this same place at the top,
  // not as a toast at the bottom. Returns false when the bubble is busy (loading/connection): the toast stays.
  window.__c109Notice=(text)=>{const t=String(text||'').trim();if(!t)return false;if(loadAct||(connAct&&!connAct.silent)||act)return false;
    const el=actEl();el.classList.remove('is-out');el.classList.add('is-done','is-notice');el.removeAttribute('data-spin');
    el.querySelector('b').textContent=t;const small=el.querySelector('small');small.textContent='';small.hidden=true;
    el.querySelector('.c109-act-ring').style.setProperty('--c109-p','100');el.hidden=false;actPlace(el);
    clearTimeout(actDoneTimer);const ms=Math.min(6000,2400+t.length*22);
    actDoneTimer=setTimeout(()=>{el.classList.add('is-out');setTimeout(()=>{if(!act){el.hidden=true;el.classList.remove('is-out','is-done','is-notice');}},240);},ms);return true;};
  function actRender(){
    const el=actEl();const cur=connAct?(connAct.silent?null:connAct):(loadAct||(act&&act.visible?act:null));
    if(!cur){if(!el.hidden&&!el.classList.contains('is-done')){el.classList.add('is-out');setTimeout(()=>{if(!(connAct&&!connAct.silent)&&!(loadAct&&!connAct)&&!(act?.visible&&!connAct)&&!el.classList.contains('is-done')){el.hidden=true;el.classList.remove('is-out');}},240);}return;}
    el.classList.remove('is-out','is-done');
    el.querySelector('b').textContent=cur.title;const small=el.querySelector('small');small.textContent=cur.detail||'';small.hidden=!cur.detail;
    const ring=el.querySelector('.c109-act-ring');
    if(Number.isFinite(cur.progress)){el.removeAttribute('data-spin');ring.style.setProperty('--c109-p',String(Math.max(6,Math.min(100,Math.round(cur.progress*100)))));}
    else{el.setAttribute('data-spin','');ring.style.setProperty('--c109-p','25');}
    el.hidden=false;actPlace(el);
  }
  function actStart(key,data){
    clearTimeout(actDoneTimer);
    if(act&&act.key===key){Object.assign(act,data);actRender();return;}
    if(act)clearTimeout(act.timer);
    act={key,startAt:Date.now(),visible:false,...data};
    // BGSAVE-C138: an activity with a gate shows only once the gate allows it (checked again every 0.5 s).
    const reveal=()=>{if(!act||act.key!==key)return;if(typeof act.gate==='function'&&!act.gate()){act.timer=setTimeout(reveal,500);return;}act.visible=true;actRender();};
    act.timer=setTimeout(reveal,data.delay??ACT_DELAY);
  }
  function actEnd(key,doneText){
    if(!act||act.key!==key)return;
    const shown=act.visible,lasted=Date.now()-act.startAt;clearTimeout(act.timer);act=null;
    if(!shown&&lasted<900||doneText===false){actRender();return;}
    if(loadAct||connAct){actRender();return;}
    const el=actEl();el.classList.remove('is-out');el.classList.add('is-done');el.removeAttribute('data-spin');
    el.querySelector('b').textContent=doneText||at('done');const small=el.querySelector('small');small.textContent='';small.hidden=true;
    el.querySelector('.c109-act-ring').style.setProperty('--c109-p','100');
    el.hidden=false;actPlace(el);
    try{window.LightningInterfaceHaptics?.emit?.('success','synchronised',{userInitiated:false});}catch(_){}
    clearTimeout(actDoneTimer);actDoneTimer=setTimeout(()=>{el.classList.add('is-out');setTimeout(()=>{if(!act){el.hidden=true;el.classList.remove('is-out','is-done');}},240);},2400);
  }
  // the app's own "stand bewaren" strip is read, never shown
  // C109cw-3: the automatic check of the stand context at app start, and after coming back to the
  // app, is not a save the customer made: it runs silently. The pill shows only for a save that
  // follows the customer's own action, and says "Alles gesynchroniseerd" only when the receivers
  // really confirmed it (a pending or interrupted check ends without a word).
  let lastUserAtC109=0,lastVisibleAtC109=Date.now(),lastCtxC109=null;
  addEventListener('pointerdown',()=>{lastUserAtC109=Date.now();},{capture:true,passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')lastVisibleAtC109=Date.now();});
  window.addEventListener('lightning:receiver-context',e=>{const d=e.detail;if(d&&typeof d.status==='string')lastCtxC109={status:d.status,at:Date.now()};});
  const saveIsAutomaticC109=()=>{const now=Date.now();return now-lastVisibleAtC109<20000||now-lastUserAtC109>20000;};
  // BGSAVE-C138: saving on the receivers is background work. Its capsule appears only after 3 s and only while the
  // customer has not touched the screen for 4 s; it ends silently (no "Alles gesynchroniseerd" for a save nobody
  // saw). A save that was visible and still ended unconfirmed gives one calm notice, at most once per 10 minutes,
  // and not when the customer's own light use made it step aside.
  let saveFailAtBGSAVE=0;
  function saveFailNoticeBGSAVE(){
    const now=Date.now();if(now-saveFailAtBGSAVE<600000||now-lastUserAtC109<6000)return;
    try{if(window.__c109Notice?.(at('retry')))saveFailAtBGSAVE=now;}catch(_){}
  }
  function readSaveStrip(){
    const strip=document.querySelector('[data-context-progress-c114]');
    if(!strip||strip.hidden){if(act?.key==='save'){const shown=act.visible===true,synced=lastCtxC109?.status==='synced';actEnd('save',shown&&synced?at('done'):false);if(shown&&!synced)saveFailNoticeBGSAVE();}return;}
    if(act?.key!=='save'&&saveIsAutomaticC109())return;
    const text=strip.querySelector('[data-context-progress-text]')?.textContent||'',m=text.match(/(\d+)\/(\d+)/);
    actStart('save',{title:at('save'),detail:m?m[1]+' / '+m[2]:'',progress:m?Number(m[1])/Math.max(1,Number(m[2])):NaN,delay:3000,gate:()=>Date.now()-lastUserAtC109>=4000});
  }
  let saveWatched=null;
  new MutationObserver(()=>{const strip=document.querySelector('[data-context-progress-c114]');
    if(strip&&strip!==saveWatched){saveWatched=strip;new MutationObserver(readSaveStrip).observe(strip,{attributes:true,attributeFilter:['hidden','style'],subtree:true,childList:true,characterData:true});}
    readSaveStrip();}).observe(document.body,{childList:true});
  let syncTick=0;
  window.LightningActivity={
    animationSync(detail){
      clearInterval(syncTick);
      if(detail.done)return actEnd(act?.key==='join'?'join':'sync',at('done'));
      if(detail.failed){if(act){clearTimeout(act.timer);act=null;}return actRender();}
      if(detail.joining)return actStart('join',{title:at('join'),detail:at('joinHint'),progress:NaN});
      const lead=Number(detail.leadMs);if(!Number.isFinite(lead)||lead<=0||lead>30000)return;
      const ends=Date.now()+lead;
      const tick=()=>{const left=Math.max(0,ends-Date.now());
        actStart('sync',{title:at('sync'),detail:at('startIn',{s:Math.ceil(left/1000)}),progress:1-left/lead,delay:lead<2500?99999:ACT_DELAY});
        if(left<=0){clearInterval(syncTick);actEnd('sync',at('done'));}};
      tick();syncTick=setInterval(tick,250);
    },
    start:actStart,end:actEnd,get current(){return act;}
  };
  let actScroll=false;addEventListener('scroll',()=>{if(actScroll)return;actScroll=true;requestAnimationFrame(()=>{actScroll=false;const el=document.getElementById('c109-activity');if(el&&!el.hidden)actPlace(el);});},{passive:true});
  addEventListener('resize',()=>{const el=document.getElementById('c109-activity');if(el&&!el.hidden)actPlace(el);});
  // C109bs: a port is a plug with its number, in every language. Every short
  // "P1".."P4" label (receiver card chips, the pixel editor, the order rows,
  // the setup summary) gets data-c109-port; CSS draws the plug in the port's
  // colour with the number inside. The text itself stays, for the app's logic
  // and for screen readers.
  // C109by: also a short label that spells the port out ("Poort 1", "Port 1", "Sortie 1", "Ausgang 1")
  const PORT_LABEL=/^(?:P|Poort|Port|Sortie|Ausgang)\s?([1-4])$/;
  function markPorts(root){
    const list=root.matches?.('b,strong,span,small')?[root]:[];
    for(const el of root.querySelectorAll?.('b,strong,span,small')||[])list.push(el);
    for(const el of list){
      if(el.childElementCount||el.dataset.c109Port||el.closest('[data-c109-noport]'))continue;
      const text=(el.textContent||'').trim();
      // "Receiver 1 · P1" in the order rows: the port becomes its own plug
      const tail=/^(.+?) · P([1-4])$/.exec(text);
      if(tail&&el.matches('small,span')&&el.closest('#main,dialog')){el.textContent=tail[1]+' · ';const plug=document.createElement('b');plug.className='c109-plug-inline';plug.textContent='P'+tail[2];el.append(plug);continue;}
      const m=PORT_LABEL.exec(text);if(!m)continue;
      if(!el.closest('#main,dialog,#effect-dialog'))continue;
      el.dataset.c109Port=m[1];
      if(!el.hasAttribute('aria-label'))el.setAttribute('aria-label',(document.documentElement.lang||'nl').startsWith('nl')?'Poort '+m[1]:'Port '+m[1]);
      const bg=getComputedStyle(el).backgroundColor;
      if(!bg||/rgba\(0, 0, 0, 0\)|transparent/.test(bg))el.classList.add('c109-plug-plain');
      // C109by: a label without its own colour gets the port's colour, the same one as in the chips
      if(el.classList.contains('c109-plug-plain')&&!getComputedStyle(el).getPropertyValue('--port-colour').trim()){try{const c=window.LightningPixelSetup?.portColour?.(Number(m[1]),3);if(c?.hex){el.style.setProperty('--port-colour',c.hex);el.style.setProperty('--port-ink',c.ink||'#fff');}}catch(_){}}
    }
  }
  new MutationObserver(records=>{for(const r of records){if(r.type==='characterData'){const p=r.target.parentElement;if(p){delete p.dataset.c109Port;markPorts(p);}continue;}for(const n of r.addedNodes)if(n.nodeType===1)markPorts(n);}}).observe(document.body,{childList:true,subtree:true,characterData:true});
  markPorts(document.body);
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
    const after=dock.offsetHeight,base=parseFloat(getComputedStyle(dock).marginBottom)||0;dock.dataset.c109MarginBase=String(base);dock.style.marginBottom=Math.max(0,base+before-after)+'px';
    syncPill(true);requestAnimationFrame(()=>requestAnimationFrame(()=>dock.removeAttribute('data-c109-measure')));
  }
  // C109ai: the fold is one motion. Every part — capsules, labels, the rows
  // that disappear, the bar background, logo and badge — moves with the same
  // duration and the same spring. Rows collapse from their measured height,
  // so the bottom margin that keeps the page still matches them frame by
  // frame. While things move the pressed pill hides and the button carries
  // its own fill; the pill comes back once everything has settled.
  const FOLD_MS=560,foldOffMemo=new Map(); /* C138ui-20: the measured fold offset survives a render (no 8 px jump) */
  const foldRows=dock=>[...dock.querySelectorAll('.control-location-summary,.preview-wrap>.preview-top,[data-live-status],.v50-selection-summary small,.v50-selection-summary em,.animation-wayfinding')];
  function foldLabels(dock,fold){
    foldedBefore=fold;
    // C109ci: the hidden zone-name line stays in the flow (no page jump), so the
    // folded bar slides up by its height: only the button row is left, compact.
    {const setOff=v=>dock.style.setProperty('--c109-fold-off',v+'px');
     if(!fold){clearTimeout(dock.c109OffTimer);setOff(0);}
     else{if(!Number.isFinite(dock.c109FoldOff))dock.c109FoldOff=foldOffMemo.get(dock.className+'|'+innerWidth);if(Number.isFinite(dock.c109FoldOff))setOff(dock.c109FoldOff);
       // measured once in the folded state (button row 8 px below the bar's top), then remembered
       clearTimeout(dock.c109OffTimer);dock.c109OffTimer=setTimeout(()=>{if(!dock.hasAttribute('data-c109-stuck'))return;const acts=dock.querySelector('.control-dock-actions');if(!acts)return;
         const cur=parseFloat(dock.style.getPropertyValue('--c109-fold-off'))||0,rel=acts.getBoundingClientRect().top-dock.getBoundingClientRect().top;
         // the app may already lift the bar (--sticky-preview-offset on the sticky-preview dock): only the rest is ours
         const lifted=parseFloat(getComputedStyle(dock).getPropertyValue('--sticky-preview-offset'))||0;const v=Math.max(0,Math.round(rel-8-lifted));if(Math.abs(v-cur)>1)setOff(v);dock.c109FoldOff=v;foldOffMemo.set(dock.className+'|'+innerWidth,v);},560);}}
    const rows=foldRows(dock),modeButtons=[...dock.querySelectorAll('.control-mode-tabs>button')],modeTabs=dock.querySelector('.control-mode-tabs'),labels=[...dock.querySelectorAll('.c109-label')];
    // 1. Measure in the current state: row heights, label and capsule widths,
    //    and (when folding) how much shorter the bar is going to be.
    // Opening: the open heights are measured for real (state toggled with
    // every transition off), not guessed from the clipped content.
    // C109ao: measurements are remembered per rendered dock, so a fold or an
    // unfold costs one layout, not four (each one is ~25 ms on a slow phone).
    const sameRows=dock.c109Rows&&dock.c109Rows.length===rows.length&&dock.c109Rows.every((r,i)=>r===rows[i]);
    let rowHeights;
    if(fold){rowHeights=rows.map(row=>row.getBoundingClientRect().height);dock.c109Rows=rows;dock.c109OpenRows=rowHeights;}
    else if(sameRows&&dock.c109OpenRows)rowHeights=dock.c109OpenRows;
    else{dock.setAttribute('data-c109-measure','');dock.removeAttribute('data-c109-stuck');dock.offsetHeight;rowHeights=rows.map(row=>row.getBoundingClientRect().height);dock.setAttribute('data-c109-stuck','');dock.offsetHeight;dock.removeAttribute('data-c109-measure');dock.offsetHeight;dock.c109Rows=rows;dock.c109OpenRows=rowHeights;}
    const labelWidths=labels.map(label=>fold?(label.getBoundingClientRect().width||label.scrollWidth):label.scrollWidth);
    const buttonWidths=modeButtons.map(button=>button.getBoundingClientRect().width);
    if(!('c109MarginBase' in dock.dataset))dock.dataset.c109MarginBase=String(parseFloat(getComputedStyle(dock).marginBottom)||0);
    if(fold){dock.c109Widths=buttonWidths;
      if(!Number.isFinite(dock.c109Delta)){const before=dock.offsetHeight;dock.setAttribute('data-c109-measure','');dock.setAttribute('data-c109-stuck','');
        const after=dock.offsetHeight;dock.removeAttribute('data-c109-stuck');dock.offsetHeight;dock.removeAttribute('data-c109-measure');dock.offsetHeight;
        dock.c109Delta=Math.max(0,before-after);}}
    // 2. Pin everything at its current size with every transition off, so
    //    the pin itself never starts a glide: px to px glides, auto does not.
    dock.setAttribute('data-c109-measure','');
    rows.forEach((row,i)=>{row.style.maxHeight=rowHeights[i]+'px';});
    labels.forEach((label,i)=>{label.style.maxWidth=(fold?labelWidths[i]:0)+'px';});
    modeButtons.forEach((button,i)=>{button.style.width=buttonWidths[i]+'px';button.style.flex='0 0 auto';});
    if(modeTabs)modeTabs.style.flex='0 1 auto';
    dock.offsetWidth;dock.removeAttribute('data-c109-measure');dock.offsetWidth;
    // 3. Switch state; every pinned value now glides to its target together.
    dock.setAttribute('data-c109-folding','');
    if(fold)dock.setAttribute('data-c109-stuck','');else dock.removeAttribute('data-c109-stuck');
    const base=parseFloat(dock.dataset.c109MarginBase)||0;
    dock.style.marginBottom=(fold?base+(dock.c109Delta||0):base)+'px';
    const openWidths=dock.c109Widths?.length===modeButtons.length?dock.c109Widths:null;
    modeButtons.forEach((button,i)=>{button.style.width=fold?'44px':(openWidths?openWidths[i]:120)+'px';});
    labels.forEach((label,i)=>{label.style.maxWidth=(fold?0:labelWidths[i])+'px';});
    // 4. Settled: release the pins of the open state and bring the pill back.
    clearTimeout(dock.c109SettleTimer);
    dock.c109SettleTimer=setTimeout(()=>{
      if(!fold&&!dock.hasAttribute('data-c109-stuck')){modeButtons.forEach(button=>{button.style.width='';button.style.flex='';});if(modeTabs)modeTabs.style.flex='';labels.forEach(label=>{label.style.maxWidth='';});rows.forEach(row=>{row.style.maxHeight='';});dock.style.marginBottom='';}
      syncPill(true);dock.removeAttribute('data-c109-folding');
      // C109bq: the page may have scrolled on while the row moved; settle on where it is now.
      requestAnimationFrame(markStuck);
    },FOLD_MS+40);
  }
  // Labels of the mode row and the back button sit in their own span, so they
  // can glide in and out instead of jumping when the row folds to icons.
  const labelWidthC138=new Map();
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
      if(label.style.getPropertyValue('--c109-lw')||label.dataset.c109Measured)return;label.dataset.c109Measured='1';
      // C138ui-5: every render rebuilt the row and measured each label again (two forced layouts per label per tap).
      // The width only depends on the text, the button kind and the screen width: reuse it.
      const keyC138=label.textContent+'|'+(label.closest('button')?.className||'').replace(/\b(c109-\S+|is-\S+|c106-\S+)\b/g,'')+'|'+innerWidth+'|'+root.lang;const knownC138=labelWidthC138.get(keyC138);
      if(knownC138){label.style.setProperty('--c109-lw',knownC138+'px');return;}
      const keep=label.style.maxWidth;label.style.transition='none';label.style.maxWidth='none';const width=Math.ceil(label.getBoundingClientRect().width/((label.closest('button')?.getBoundingClientRect().width||1)/(label.closest('button')?.offsetWidth||1)));label.style.maxWidth=keep;label.offsetWidth;label.style.transition='';
      if(width>0&&label.style.getPropertyValue('--c109-lw')!==width+'px')label.style.setProperty('--c109-lw',width+'px');
      if(width>0&&document.fonts?.status!=='loading')labelWidthC138.set(keyC138,width);
    });
  }
  addEventListener('scroll',()=>requestAnimationFrame(markStuck),{passive:true});
  // Measure again once fonts are ready and when the screen size changes.
  document.fonts?.ready?.then(()=>{document.querySelectorAll('#main .c109-label').forEach(l=>l.style.removeProperty('--c109-lw'));wrapModeLabels();});
  addEventListener('resize',()=>{document.querySelectorAll('#main .c109-label').forEach(l=>l.style.removeProperty('--c109-lw'));requestAnimationFrame(wrapModeLabels);});
  // The pressed button's pill is one element that slides to the new choice
  // with the spring. The app rebuilds the row when the mode changes, so the
  // last position is remembered and the new pill starts from there.
  let pillFollow=false;
  // C109ak: one sliding pill for every row of choices in the app — the zone
  // row, the Alles bedienen tabs, the receiver filters, the tunnel/wall
  // choice and the tab bar. The pill copies the look of the chosen button and
  // glides to the next choice with the same spring everywhere.
  const PILL_TABS=[['#main .control-mode-tabs','button[aria-pressed=true]'],['#effect-dialog .stand-controls-tabs','button[aria-selected=true]'],['#main .receiver-filters','button[aria-pressed=true]'],['nav.navigation','button[aria-current=page]'],['#main .spatial-topology-choice','button[aria-pressed=true]'],['#main .family-spatial-options','button[aria-pressed=true]'],['#main .gradient-motion-choices.c109-motion-type','button[aria-pressed=true]'],['#main .gradient-motion-choices.c109-motion-flow','button[aria-pressed=true]']];
  const pillMemory=new Map(),pillLookC138=new Map();
  function syncPillFor(sel,pressedSel,instant){
    const tabs=document.querySelector(sel);if(!tabs){pillMemory.delete(sel);return;} /* C139ui-11: a row that left the page (stand page, other zone) is no start point for the next one */
    const pressed=tabs.querySelector(':scope>'+pressedSel);let pill=tabs.querySelector(':scope>.c109-pill');
    if(!pressed){pill?.remove();tabs.classList.remove('has-c109-pill');if(sel==='nav.navigation')pillMemory.delete(sel); /* C139ins-3: no tab (Instellingen) -> the next tab's pill starts on its own button */return;}
    const last=pillMemory.get(sel);
    // The look is read from the chosen button with every transition and the
    // pill's own override off, and refreshed whenever the choice or the theme
    // changes (at first paint the stylesheets may not have styled it yet).
    // C138ui-2: every page render rebuilt the pill rows and re-read the chosen button's look (two forced style
    // recalcs + layout per row, 60-130 ms per tap on the tablet). The look only depends on the button kind and the
    // theme, so it is cached per row/button/theme; a changed theme or button still reads it fresh.
    const lookKey=sel+'|'+pressed.className.replace(/\bc109-settled\b/g,'')+'|'+(pressed.dataset.action||'')+'|'+(pressed.dataset.id||pressed.dataset.mode||'')+'|'+(document.body.dataset.theme||'')+'|'+(document.documentElement.dataset.theme||'')+'|'+matchMedia('(prefers-color-scheme: dark)').matches;
    const readLook=()=>{const hit=pillLookC138.get(lookKey);if(hit&&hit.ok&&hit.n<64){hit.n++; /* C139ui-9 */tabs.classList.add('has-c109-pill');return hit.v;}tabs.classList.remove('has-c109-pill');pressed.classList.add('c109-settled');pressed.offsetWidth;const look=getComputedStyle(pressed);
      const v={bg:look.backgroundColor,img:look.backgroundImage,bs:look.boxShadow,br:look.borderRadius,bd:look.borderTopWidth!=='0px'?`${look.borderTopWidth} ${look.borderTopStyle} ${look.borderTopColor}`:'0'};
      pressed.classList.remove('c109-settled');tabs.classList.add('has-c109-pill');if(v.bg&&v.bg!=='rgba(0, 0, 0, 0)'||v.img!=='none'){const same=!!hit&&JSON.stringify(hit.v)===JSON.stringify(v);pillLookC138.set(lookKey,{v,n:0,ok:same&&document.readyState==='complete'});}return v;}; /* C139ui-9: cache only a confirmed look */
    const applyLook=v=>{pill.style.backgroundColor=v.bg;pill.style.backgroundImage=v.img;pill.style.boxShadow=v.bs;pill.style.borderRadius=v.br;pill.style.border=v.bd;pill.c109For=pressed;pill.c109Theme=document.body.dataset.theme||'';};
    if(!pill){
      pill=document.createElement('span');pill.className='c109-pill';pill.setAttribute('aria-hidden','true');
      // C139ui-2d: the new pill starts where the last one stood (or on its own button) before its first style pass, so it
      // never slides in from the row's left edge (Kleur) when the app rebuilds the row.
      const from=last&&Math.abs(last.tabsWidth-tabs.offsetWidth)<2?last:{x:pressed.offsetLeft,y:pressed.offsetTop,w:pressed.offsetWidth,h:pressed.offsetHeight};
      pill.style.width=from.w+'px';pill.style.height=from.h+'px';pill.style.transform=`translate(${from.x}px,${from.y}px)`;
      // C139tt-3: a row that is not rendered (the closed tunnel/wall choice on every zone page) has nothing to slide: no
      // start-frame flush and no second measurement, which forced a full style pass per render for an invisible pill.
      if(!tabs.offsetWidth&&!pressed.offsetWidth&&!pressed.offsetHeight){tabs.prepend(pill);applyLook(readLook());pillMemory.set(sel,{x:0,y:0,w:0,h:0,tabsWidth:0});return;}
      tabs.prepend(pill);applyLook(readLook());pill.offsetWidth;
    }
    else if(pill.c109For!==pressed||pill.c109Theme!==(document.body.dataset.theme||''))applyLook(readLook());
    const target={x:pressed.offsetLeft,y:pressed.offsetTop,w:pressed.offsetWidth,h:pressed.offsetHeight,tabsWidth:tabs.offsetWidth};
    const now=pill.style.transform,next=`translate(${target.x}px,${target.y}px)`;
    if(now!==next||pill.style.width!==target.w+'px'){pill.classList.toggle('is-moving',!!now&&!pillFollow&&!instant);pill.style.width=target.w+'px';pill.style.height=target.h+'px';pill.style.transform=next;}
    pillMemory.set(sel,target);
  }
  function syncPill(instant){for(const [sel,pressedSel] of PILL_TABS)syncPillFor(sel,pressedSel,instant);}
  addEventListener('resize',()=>requestAnimationFrame(syncPill));matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>requestAnimationFrame(()=>requestAnimationFrame(syncPill))); /* C139ui-12: re-measure the pill after a system theme switch */
  let modeQueued=false;
  // The pill is placed right away (before the next paint), then checked again.
  // C109ba: a mutation far from any pill row (a slider value during a wheel
  // drag) no longer re-measures every pill.
  const PILL_SEL=PILL_TABS.map(([sel])=>sel).join(',');
  let pillDirty=false;
  new MutationObserver(records=>{keepFolded();if(records.some(r=>r.type==='childList'||r.target.closest?.(PILL_SEL)))pillDirty=true;if(pillDirty&&PILL_TABS.some(([sel])=>document.querySelector(sel+':not(.has-c109-pill)'))){const fresh=toSolidC139?null:document.querySelector('#main .control-mode-tabs:not(.has-c109-pill)');if(fresh){fresh.classList.add('c139-quiet');syncModeTabs();void fresh.offsetWidth;fresh.classList.remove('c139-quiet');}syncPill();} /* C139ui-2c: a rebuilt row shows Verloop at once, no Kleur flash */if(!modeQueued){modeQueued=true;requestAnimationFrame(()=>{modeQueued=false;syncModeTabs();if(pillDirty){pillDirty=false;syncPill();}});}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-gradient-mode','aria-pressed','aria-selected','aria-current','open']});
  // Stand page: one big switch for the whole stand. It uses the zones' own
  // tested on/off switches, one after the other, so every zone (also one
  // with a gradient) is switched exactly as when you tap it yourself.
  const POWER_TEXT={nl:['Hele stand','Aan','Uit','Hele stand aan of uit'],en:['Whole stand','On','Off','Whole stand on or off'],fr:['Tout le stand','Allumé','Éteint','Tout le stand allumé ou éteint'],de:['Gesamter Stand','An','Aus','Gesamten Stand ein- oder ausschalten']};
  const powerText=i=>(POWER_TEXT[root.lang]||POWER_TEXT.nl)[i];
  const zoneSwitches=()=>[...document.querySelectorAll('#main .stand-page [data-action="zone-power"][role="switch"]:not(:disabled)')]; // C138ui-15: an empty zone's disabled switch no longer blocks the whole-stand switch
  let standPowerBusy=false;
  function syncStandPower(){
    const hero=document.querySelector('#main .stand-page .stand-hero100');if(!hero)return;
    const switches=zoneSwitches();let button=hero.querySelector('.stand-power109');
    if(!switches.length){button?.remove();return;}
    if(!button){
      button=document.createElement('button');button.type='button';button.className='stand-power109';button.setAttribute('role','switch');
      button.innerHTML='<span class="stand-power-ring109" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/></svg></span><span class="stand-power-copy109"><b></b><small></small></span><span class="stand-power-track109" aria-hidden="true"><i></i></span>';
      (hero.querySelector('.stand-hero-copy')||hero).append(button);
    }
    const on=switches.every(item=>item.getAttribute('aria-checked')==='true'),some=switches.some(item=>item.getAttribute('aria-checked')==='true');
    // C138jank: write only what changed. Every write re-queued this function through its own observer (aria-checked and
    // the <b>/<small> text nodes), so the stand page ran it, and every body observer, on each frame (~90/s with no input).
    const sameC138=(el,name,value)=>{if(el.getAttribute(name)!==value)el.setAttribute(name,value);};
    sameC138(button,'aria-checked',String(on));sameC138(button,'data-state',on?'on':some?'mixed':'off');sameC138(button,'aria-label',powerText(3));
    const titleC138=button.querySelector('b'),subC138=button.querySelector('small'),subTextC138=powerText(on||some?1:2);
    if(titleC138.textContent!==powerText(0))titleC138.textContent=powerText(0);if(subC138.textContent!==subTextC138)subC138.textContent=subTextC138;
    const disabledC138=standPowerBusy||switches.some(item=>item.disabled);if(button.disabled!==disabledC138)button.disabled=disabledC138;
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
  let zoneDraggedC139=false; // C139zv: the first-time nudge plays only until the user has dragged a zone once
  function syncZoneGrips(){
    document.querySelectorAll('.stand-animation-live [data-stand-animation-preview]').forEach(list=>{
      const together=list.dataset.standMode109==='whole',cards=zoneCards(list),sortable=cards.length>1&&!together;list.toggleAttribute('data-c109-sortable',sortable);
      let hint=list.previousElementSibling?.matches?.('.zone-drag-hint109')?list.previousElementSibling:null;
      if(sortable&&!hint){hint=document.createElement('p');hint.className='zone-drag-hint109';hint.innerHTML='<span aria-hidden="true"></span>';hint.append(ZONE_HINT_TEXT[root.lang]||ZONE_HINT_TEXT.nl);list.before(hint);
        if(!zoneDraggedC139&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)cards[1]?.classList.add('nudge109');} /* C139zv: no replay after every drop */
      if(!sortable){hint?.remove();cards.forEach(card=>card.querySelector(':scope>.zone-grip109')?.remove());list.querySelector(':scope>.zone-slot139')?.remove();return;}
      // C139zv: the dashed landing place is made here (hidden), with the grips, so picking a card up adds nothing to the page
      if(!list.querySelector(':scope>.zone-slot139')){const slot=document.createElement('div');slot.className='zone-slot139';slot.setAttribute('aria-hidden','true');list.prepend(slot);}
      cards.forEach(card=>{
        if(cards.length<2||card.querySelector(':scope>.zone-grip109'))return;
        const grip=document.createElement('button');grip.type='button';grip.className='zone-grip109';grip.setAttribute('aria-label',ZONE_GRIP_TEXT[root.lang]||ZONE_GRIP_TEXT.nl);
        card.append(grip);
      });
    });
  }
  function commitZoneOrder(list,moved){
    const ids=zoneCards(list).map(card=>card.dataset.standAnimationZone).filter(id=>id&&id!=='unassigned');
    document.dispatchEvent(new CustomEvent('c109:zone-order',{detail:{ids}}));
    // C109cr: when the app cannot keep the order yet (stand still connecting, busy), it redraws the old
    // order at once; the moved card then visibly settles back instead of silently jumping
    const want=ids.join(),movedId=moved?.dataset.standAnimationZone;
    setTimeout(()=>{const now=document.querySelector('.stand-animation-live [data-stand-animation-preview]');if(!now)return;
      if(zoneCards(now).map(c=>c.dataset.standAnimationZone).filter(id=>id&&id!=='unassigned').join()===want)return;
      const card=movedId&&now.querySelector('[data-stand-animation-zone="'+CSS.escape(movedId)+'"]');
      if(card&&typeof card.animate==='function'&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
        card.animate([{transform:'translateX(0)'},{transform:'translateX(-7px)'},{transform:'translateX(6px)'},{transform:'translateX(-3px)'},{transform:'translateX(0)'}],{duration:360,easing:'ease-in-out'});},80);
  }
  document.addEventListener('keydown',event=>{
    const grip=event.target instanceof Element&&event.target.closest('.zone-grip109');if(!grip||!['ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();const card=grip.closest('.stand-animation-zone'),list=card.parentElement;
    const other=event.key==='ArrowUp'?card.previousElementSibling:card.nextElementSibling;if(!other?.matches('.stand-animation-zone'))return;
    if(event.key==='ArrowUp')other.before(card);else other.after(card);grip.focus();tick();commitZoneOrder(list,card);
  });
  // C139zv: the zone order drags like Ledlinevolgorde (C109ct-1). Measured before (3 zones, tablet and phone): once the held
  // card passed another one it jumped a whole card (181 px) away from the finger, after two cards 361 px; the passed card
  // jumped instead of sliding; the restarted first-time nudge took the held card over; on release it snapped up to 369 px;
  // on a phone on its side nothing could be reordered (no autoscroll). Now the card stays under the finger (also after a
  // swap and while the window scrolls near its edges), between the first and the last place; the others slide aside; a
  // dashed place shows where it lands; on release it glides into that place, and only then the app saves (and redraws).
  let zoneDrag=null,zoneSaveC139=null;
  const zoneReduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}};
  const zoneOrderOf=list=>zoneCards(list).map(c=>c.dataset.standAnimationZone).join();
  const zoneSlide=(el,from,ms)=>{if(!el||!from||typeof el.animate!=='function'||zoneReduced())return null;const dy=from.top-el.getBoundingClientRect().top;if(Math.abs(dy)<.5)return null;
    try{return el.animate([{transform:`translateY(${dy}px)`},{transform:'none'}],{duration:ms,easing:'cubic-bezier(.32,.72,0,1)'});}catch(_){return null;}};
  document.addEventListener('pointerdown',event=>{
    const grip=event.target instanceof Element&&event.target.closest('.zone-grip109');if(!grip||event.button>0||event.isPrimary===false||zoneDrag)return;
    const card=grip.closest('.stand-animation-zone'),list=card?.parentElement;if(!card||!list)return;
    event.preventDefault();zoneDraggedC139=true;
    // a new drag before the last drop was saved: one save afterwards, against the order the app still holds
    let before=zoneOrderOf(list);if(zoneSaveC139?.list===list){before=zoneSaveC139.before;zoneSaveC139=null;}
    // start from where the card is seen (the first-time nudge or a landing glide may still be moving it)
    const seen=card.getBoundingClientRect().top;card.getAnimations().forEach(a=>{try{a.cancel();}catch(_){}});
    for(const c of zoneCards(list))if(c.classList.contains('nudge109')){const r=c.getBoundingClientRect();c.classList.remove('nudge109');if(c!==card)zoneSlide(c,r,200);}
    const scroller=card.closest('dialog')||document.scrollingElement||document.documentElement,head=[...scroller.querySelectorAll('header')].find(h=>getComputedStyle(h).position==='sticky');
    const d=zoneDrag={id:event.pointerId,before,y:event.clientY,startY:event.clientY-(seen-card.getBoundingClientRect().top),scroll0:scroller.scrollTop,ty:null,raf:0};
    card.classList.add('is-dragging109');document.documentElement.classList.add('c139-zone-drag');tick();
    // the dashed landing place: made ahead by syncZoneGrips (inserting it here cost a full layout at the pick-up, 28 ms at CPU x4)
    let slot=list.querySelector(':scope>.zone-slot139');if(!slot){slot=document.createElement('div');slot.className='zone-slot139';slot.setAttribute('aria-hidden','true');list.prepend(slot);}d.slot=slot;
    const placeSlot=()=>{const r=card.getBoundingClientRect(),lr=list.getBoundingClientRect();slot.style.cssText=`left:${r.left-lr.left}px;width:${r.width}px;height:${r.height}px;transform:translateY(${r.top-(d.ty||0)-lr.top}px)`;};
    placeSlot();slot.classList.remove('is-out139');slot.classList.add('is-on139');
    const place=()=>{const cards=zoneCards(list),first=cards[0],last=cards[cards.length-1],top0=card.offsetTop;
      const ty=Math.max(first.offsetTop-top0,Math.min(last.offsetTop+last.offsetHeight-card.offsetHeight-top0,d.y-d.startY+scroller.scrollTop-d.scroll0));
      if(ty!==d.ty){d.ty=ty;card.style.transform=`translateY(${ty}px)`;}};
    const step=()=>{d.raf=0;if(zoneDrag!==d)return;if(!card.isConnected){end();return;}
      place();
      // the held card's edge past the middle of a neighbour: that card slides into the free place (layout boxes, so its
      // own glide never swaps it back; a fast finger may pass more than one card in a frame)
      for(let n=0;n<8;n++){const cards=zoneCards(list),i=cards.indexOf(card),y0=card.offsetTop+d.ty,next=cards[i+1],prev=cards[i-1];
        const other=next&&y0+card.offsetHeight>next.offsetTop+next.offsetHeight/2+4?next:prev&&y0<prev.offsetTop+prev.offsetHeight/2-4?prev:null;if(!other)break;
        const from=other.getBoundingClientRect(),top0=card.getBoundingClientRect().top;list.insertBefore(other,other===next?card:card.nextSibling);
        d.startY+=card.getBoundingClientRect().top-top0;place();zoneSlide(other,from,200);placeSlot();tick();}
      // near the window's edges (under its sticky title, above its bottom) the list scrolls along, as far as it goes
      const box=scroller===document.scrollingElement?{top:0,bottom:innerHeight}:scroller.getBoundingClientRect(),lb=list.getBoundingClientRect();
      const top=Math.max(box.top,head?head.getBoundingClientRect().bottom:box.top),bot=Math.min(box.bottom,innerHeight),zone=Math.min(56,(bot-top)/4);
      const now=performance.now(),k=Math.min(6,Math.max(.5,(now-(d.t||now))/16.7||1));d.t=now; // the same speed at any frame rate
      let v=0;if(d.y<top+zone&&lb.top<top)v=-Math.ceil((top+zone-d.y)/6*k);else if(d.y>bot-zone&&lb.bottom>bot)v=Math.ceil((d.y-bot+zone)/6*k);
      if(v){const b=scroller.scrollTop;scroller.scrollTop=b+v;if(scroller.scrollTop!==b)place();}
      d.raf=requestAnimationFrame(step);};
    const move=ev=>{if(zoneDrag!==d||ev.pointerId!==d.id)return;ev.preventDefault();d.y=ev.clientY;};
    const up=ev=>{if(zoneDrag===d&&ev.pointerId===d.id)end();};
    function end(){
      if(zoneDrag!==d)return;zoneDrag=null;cancelAnimationFrame(d.raf);
      removeEventListener('pointermove',move,true);removeEventListener('pointerup',up,true);removeEventListener('pointercancel',up,true);
      document.documentElement.classList.remove('c139-zone-drag');card.classList.remove('is-dragging109');
      if(!card.isConnected){card.style.transform='';slot.classList.remove('is-on139','is-out139');return;} // the app redrew the list meanwhile: its order stands
      // land: from where they are seen, the cards glide into their places (the list already holds the new order)
      const seenAll=new Map(zoneCards(list).map(c=>[c,c.getBoundingClientRect()]));
      card.classList.add('is-landing139');card.style.transform='';slot.classList.add('is-out139');
      const glides=[...seenAll].map(([c,r])=>zoneSlide(c,r,c===card?240:200)).filter(Boolean);
      const save=zoneSaveC139={list,before:d.before,done:false,timer:0};
      const landed=()=>{if(save.done)return;save.done=true;clearTimeout(save.timer);card.classList.remove('is-landing139');if(zoneDrag?.slot!==slot)slot.classList.remove('is-on139','is-out139');
        if(zoneSaveC139!==save)return;zoneSaveC139=null;if(zoneOrderOf(list)!==save.before)commitZoneOrder(list,card);};
      save.timer=setTimeout(landed,glides.length?400:0);if(glides.length)Promise.all(glides.map(a=>a.finished)).then(landed,landed);
    }
    addEventListener('pointermove',move,true);addEventListener('pointerup',up,true);addEventListener('pointercancel',up,true);
    d.raf=requestAnimationFrame(step);
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

// C109cc: the open Ledlinevolgorde sheet always covers the whole screen. On the
// iPhone it once stayed inside the controls column (shifted right, under the
// tab bar): an ancestor still had a transform, filter or running animation,
// which pins a fixed panel to that ancestor. While the sheet is open, every
// ancestor is kept free of those, and finished entry animations are dropped.
(function(){
  let mark=0,saved=null;
  function freeOrderSheet(){
    mark=0;
    const sheet=document.querySelector('.ledline-setup[data-order-open="true"]');
    document.documentElement.classList.toggle('c109-order-open',!!sheet);
    if(!sheet){for(const e of document.querySelectorAll('.ledline-setup[data-c109-top]'))delete e.dataset.c109Top;
      if(saved!==null){const y=saved;saved=null;try{scrollTo({top:y,behavior:'instant'});}catch(_){scrollTo(0,y);}}return;}
    // the sheet starts below the Aluvision logo (top bar, or the docked zone bar's logo)
    // scrolled down, the logo is gone: the page behind the sheet goes back to the top (restored on close)
    if(!sheet.dataset.c109Top&&scrollY>0){const bar0=document.querySelector('header.brand-bar')?.getBoundingClientRect();if(!bar0||bar0.top<-1){saved=scrollY;try{scrollTo({top:0,behavior:'instant'});}catch(_){scrollTo(0,0);}}}
    let top=0;const img=document.querySelector('header.brand-bar img');const ir=img?.getBoundingClientRect();
    if(ir&&ir.height&&ir.bottom>4)top=Math.max(0,img.closest('header').getBoundingClientRect().bottom);
    else{const dock=document.querySelector('#main .control-preview-dock[data-c109-stuck] .control-dock-actions')?.getBoundingClientRect();if(dock&&dock.bottom>4)top=dock.bottom;}
    if(!sheet.dataset.c109Top){sheet.dataset.c109Top='';document.documentElement.style.setProperty('--c109-order-top',Math.round(top)+'px');}
    for(let e=sheet.parentElement;e&&e!==document.body;e=e.parentElement){
      e.classList.add('c109-order-host');
      try{for(const a of e.getAnimations?.()||[])if(a.effect?.target===e)a.finish();}catch(_){}
    }
  }
  function soon(){if(!mark)mark=setTimeout(freeOrderSheet,0);}
  new MutationObserver(list=>{
    for(const m of list){
      if(m.type==='attributes'||[...m.addedNodes,...m.removedNodes].some(n=>n.nodeType===1&&(n.matches?.('.ledline-setup')||n.querySelector?.('.ledline-setup')))){freeOrderSheet();break;} /* C138ui-16: microtask, before the first paint */
    }
  }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-order-open']});
  document.addEventListener('animationstart',()=>{if(document.documentElement.classList.contains('c109-order-open'))soon();},true);
  soon();
}());

// C109cd: the Aluvision logo stays in view from every menu. A menu that would
// reach over the logo starts just below it (the logo in the top bar, or the
// small logo in the docked zone bar), and the dimmed layer leaves the logo
// clear. The full-screen preview keeps the whole screen.
(function(){
  const root=document.documentElement;
  function logoBottom(){
    const img=document.querySelector('header.brand-bar img');
    if(img){const r=img.getBoundingClientRect();if(r.height&&r.bottom>4&&r.top<innerHeight){const bar=img.closest('header').getBoundingClientRect();return Math.max(r.bottom,Math.min(bar.bottom,r.bottom+14));}}
    const dock=document.querySelector('#main .control-preview-dock[data-c109-stuck] .control-dock-actions');
    if(dock){const r=dock.getBoundingClientRect();if(r.height&&r.bottom>4)return r.bottom;}
    return 0;
  }
  function place(d){
    if(!d.open||d.classList.contains('v50-fullscreen-preview')||d.querySelector('.v50-full-preview'))return;
    d.classList.remove('c109-below-logo');
    const b=Math.round(logoBottom());d.classList.toggle('c109-logo-clear',!!b);if(!b)return;root.style.setProperty('--c109-logo-bottom',b+'px');
    // offsetTop: where the menu ends up, not where its slide-in animation is now
    if(d.offsetTop>=b+2)return;
    root.style.setProperty('--c109-logo-bottom',b+'px');
    d.classList.add('c109-below-logo');
  }
  new MutationObserver(list=>{for(const m of list){const d=m.target;if(d instanceof HTMLDialogElement){if(d.open){place(d);setTimeout(()=>place(d),0);} /* C138ui-16 */else d.classList.remove('c109-below-logo');}}})
    .observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  // a menu that grows after opening (content loads in) is checked again
  if(typeof ResizeObserver==='function'){// C109ce: placed after the observer's callback; moving the menu inside it made WebKit
    // report "ResizeObserver loop completed" (logged by the app as "Script error.").
    const ro=new ResizeObserver(entries=>{for(const e of entries){const d=e.target;if(d.open&&!d.classList.contains('c109-below-logo'))setTimeout(()=>place(d),0);}});
    const watch=()=>{for(const d of document.querySelectorAll('dialog'))if(d.dataset.c109Ro===undefined){d.dataset.c109Ro='';ro.observe(d);}}; // C138jank: '' is falsy, so every childList re-set all dialogs
    new MutationObserver(watch).observe(document.body,{childList:true,subtree:true});watch();}
  addEventListener('resize',()=>{for(const d of document.querySelectorAll('dialog[open]'))place(d);},{passive:true});
}());

// C109ch: no error toasts for the customer. A toast that reports a failure
// ("niet gelukt", "controleer", "probeer opnieuw", … in all four languages)
// is kept out of sight and only logged; confirmations still show.
(function(){
  const ERR=/opnieuw verbinden|reconnecting|reconnexion|wieder mit|niet gelukt|mislukt|niet bevestigd|niet bereikbaar|niet beschikbaar|kon niet|kon nog niet|controleer|probeer (het )?opnieuw|failed|could not|couldn.t|not confirmed|not available|unavailable|check the|try again|échou|impossible|non confirm|non disponible|vérifiez|réessayez|fehlgeschlagen|nicht bestätigt|nicht verfügbar|nicht erreichbar|konnte nicht|prüfen|überprüfen|erneut versuchen/i;
  function check(el){
    const text=(el.textContent||'').trim();
    const quiet=!el.hidden&&ERR.test(text);
    // C109cs: everything that is not an error goes to the notice place at the top
    let routed=false;
    if(el.hidden){delete el.dataset.c109Routed;delete el.dataset.c109RoutedOk;}
    else if(!quiet&&text){
      if(el.dataset.c109Routed!==text){el.dataset.c109Routed=text;try{routed=!!window.__c109Notice?.(text);}catch(_){routed=false;}el.dataset.c109RoutedOk=routed?'1':'0';}
      else routed=el.dataset.c109RoutedOk==='1';
    }
    if(quiet||routed){if(!el.hasAttribute('data-c109-quiet')){el.setAttribute('data-c109-quiet','');if(quiet)try{window.__c98log?.('C109_TOAST_QUIET '+text.slice(0,160));}catch(_){}}}
    else if(el.hasAttribute('data-c109-quiet'))el.removeAttribute('data-c109-quiet');
  }
  function watch(){const el=document.getElementById('toast');if(!el||el.dataset.c109Watch)return;el.dataset.c109Watch='';
    new MutationObserver(()=>check(el)).observe(el,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['hidden']});check(el);}
  watch();if(!document.getElementById('toast'))new MutationObserver((l,o)=>{if(document.getElementById('toast')){watch();o.disconnect();}}).observe(document.body,{childList:true,subtree:true});
}());

// C109ck: "Bekijk animaties" and the other steps into and out of an animation
// group no longer cut hard: the new page glides in from the right (back: from
// the left) with a soft settle, the way iOS moves between pages. Only the page
// content moves; the logo bar, the zone bar and the tab bar stay put.
(function(){
  const FWD=new Set(['family','animation-category-choice']);
  const isBack=b=>b.dataset.action==='family-back'||b.classList.contains('animation-gallery-return');
  const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}};
  function glide(back){
    const host=document.querySelector('#main .editor-controls')||document.querySelector('#main');
    if(!host||typeof host.animate!=='function')return;
    try{host.getAnimations?.().forEach(a=>{if(a.id==='c109-nav')a.cancel();});
      const a=host.animate([{transform:`translate3d(${back?-34:42}px,0,0) scale(.985)`,opacity:0},{offset:.55,opacity:1},{transform:'none',opacity:1}],{duration:420,easing:'cubic-bezier(.32,.72,0,1)'});a.id='c109-nav';}catch(_){}
  }
  document.addEventListener('click',event=>{
    const b=event.target instanceof Element&&event.target.closest('#main [data-action]');if(!b||b.disabled)return;
    const back=isBack(b),fwd=FWD.has(b.dataset.action);if((!back&&!fwd)||reduced())return;
    // after the app has drawn the new page (same task, or the next frame at the latest)
    const main=document.getElementById('main');let done=false;
    const go=()=>{if(done)return;done=true;mo.disconnect();glide(back);};
    const mo=new MutationObserver(()=>go());if(main)mo.observe(main,{childList:true,subtree:true});
    setTimeout(()=>{mo.disconnect();},600);
  },true);
}());

// C109co: Ledline-instellingen for a customer. The top shows the ledline's
// colour and "Poort ① · 104 pixels" instead of the technical receiver name;
// the Pixels row says how many pixels; renaming a receiver is not a customer
// action, and "Zone wijzigen" is not shown twice.
(function(){
  const T={nl:{port:'Poort',pixels:'pixels',line:'Ledline'},en:{port:'Port',pixels:'pixels',line:'LED line'},fr:{port:'Port',pixels:'pixels',line:'Ligne LED'},de:{port:'Port',pixels:'Pixel',line:'LED-Linie'}};
  const tt=k=>{const l=(document.documentElement.lang||'nl').slice(0,2);return (T[l]||T.nl)[k];};
  function tidy(){
    for(const sec of document.querySelectorAll('[data-order-line-settings]')){
      const id=sec.querySelector('.order-settings-identity652');if(!id)continue;
      const span=id.querySelector(':scope>div>span'),small=id.querySelector(':scope>div>small'),title=id.querySelector(':scope>div>b');
      const raw=(small?.dataset.c109Raw??small?.textContent)||'';if(small&&!small.dataset.c109Raw)small.dataset.c109Raw=raw;
      const px=(raw.match(/(\d+)\s*px/)||[])[1];
      // the port comes from the line itself (stored once: the text gets rewritten below)
      if(span&&!id.dataset.c109LinePort){const pe=span.querySelector('[data-c109-port]');const n=pe?.dataset.c109Port||((pe?.textContent||span.textContent||'').match(/\bP\s?([1-4])\b/)||[])[1];id.dataset.c109LinePort=n||'0';}
      const portN=id.dataset.c109LinePort&&id.dataset.c109LinePort!=='0'?id.dataset.c109LinePort:'';
      const plain=el=>{if(!el)return;el.dataset.c109Noport='';delete el.dataset.c109Port;el.classList.remove('c109-plug-plain','c109-plug-inline');el.style.removeProperty('--port-colour');el.removeAttribute('aria-label');};
      const key=(portN||'-')+'|'+(px||'-')+'|'+(document.documentElement.lang||'');
      if(id.dataset.c109Tidy!==key){
        id.dataset.c109Tidy=key;
        plain(span);if(span)span.textContent=portN?tt('port')+' '+portN+(px?' · '+px+' '+tt('pixels'):''):'RGBW';
        if(small)small.hidden=true;
        if(title&&!title.textContent.trim())title.textContent=tt('line');
      }
      // the Pixels row: plug + count, not the plug alone
      const tile=sec.querySelector('.spi-settings659 [data-action="receiver-pixels-only"] small');
      if(tile&&px&&portN){plain(tile);const want=tt('port')+' '+portN+' · '+px+' '+tt('pixels');if(tile.textContent!==want)tile.textContent=want;}
      sec.classList.toggle('c109-has-spi-tiles',!!sec.querySelector('.spi-settings659'));
    }
  }
  let q=0;new MutationObserver(()=>{if(q)return;q=setTimeout(()=>{q=0;tidy();},0);}).observe(document.body,{childList:true,subtree:true});
  tidy();
}());

// C109cp: interface sweep. Receivers filter row only when it can filter something; Alles bedienen
// gets the same close button on Kleur as on Animaties; '1 van 1 poorten' reads '1 poort'.
(function(){
  const one={nl:[/\b1 van 1 poorten\b/,'1 poort'],en:[/\b1 of 1 ports\b/,'1 port'],fr:[/\b1 sur 1 ports\b/,'1 port'],de:[/\b1 von 1 (Ausgängen|Ports)\b/,'1 Ausgang']};
  function sweep(){
    const f=document.querySelector('#main .receiver-filters');
    if(f){const u=f.querySelector('[data-id=unassigned] .ui606-filter-count');const all=f.querySelector('[data-id=all]');
      f.classList.toggle('c109-filter-idle',!!u&&u.textContent.trim()==='0'&&all?.getAttribute('aria-pressed')!=='false');}
    const d=document.getElementById('effect-dialog');
    const h=d?.open&&d.querySelector('#effect-dialog-content>header');
    if(h&&h.querySelector('.stand-controls-tabs')&&!h.querySelector('.icon-button[data-action=effect-dialog-close]')){
      const b=document.createElement('button');b.type='button';b.className='icon-button c109-added-close';b.dataset.action='effect-dialog-close';
      const lang=(document.documentElement.lang||'nl').slice(0,2);
      b.setAttribute('aria-label',{nl:'Venster sluiten',en:'Close window',fr:'Fermer la fenêtre',de:'Fenster schließen'}[lang]||'Venster sluiten');
      b.innerHTML='<svg class="icon" data-icon="close" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"></path></svg>';
      h.querySelector('h2')?.after(b);
    }
    const lang=(document.documentElement.lang||'nl').slice(0,2);const r=one[lang];
    if(r)for(const dd of document.querySelectorAll('dialog[open]')){const tw=document.createTreeWalker(dd,NodeFilter.SHOW_TEXT);let n;while((n=tw.nextNode())){if(r[0].test(n.nodeValue))n.nodeValue=n.nodeValue.replace(r[0],r[1]);}}
  }
  let q=0;new MutationObserver(()=>{if(q)return;q=setTimeout(()=>{q=0;sweep();},0);}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-pressed','open']});
  sweep();
}());

// C109cq: Ledlinevolgorde — the dark example can be hidden (remembered on this phone) and brought back.
(function(){
  const KEY='c109.orderDemoHidden';
  const T={nl:{hide:'Voorbeeld verbergen',show:'Voorbeeld tonen',port:'Poort'},en:{hide:'Hide example',show:'Show example',port:'Port'},fr:{hide:'Masquer l’exemple',show:'Afficher l’exemple',port:'Port'},de:{hide:'Beispiel ausblenden',show:'Beispiel zeigen',port:'Port'}};
  const tt=k=>(T[(document.documentElement.lang||'nl').slice(0,2)]||T.nl)[k];
  const hidden=()=>{try{return localStorage.getItem(KEY)==='1';}catch(_){return false;}};
  const motion=()=>{try{return !matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return true;}};
  const setHidden=v=>{
    const demo=document.querySelector('.order-visual-intro655 .order-demo109');
    const save=()=>{try{v?localStorage.setItem(KEY,'1'):localStorage.removeItem(KEY);}catch(_){}apply();};
    if(!demo||!motion()||typeof demo.animate!=='function'){save();return;}
    if(v){const h=demo.getBoundingClientRect().height;demo.style.overflow='hidden';
      const a=demo.animate([{opacity:1,height:h+'px'},{opacity:0,height:'0px'}],{duration:240,easing:'cubic-bezier(.4,0,.6,1)',fill:'forwards'});
      a.onfinish=()=>{save();a.cancel();demo.style.overflow='';};}
    else{save();const d2=document.querySelector('.order-visual-intro655 .order-demo109');if(!d2)return;const h=d2.getBoundingClientRect().height;d2.style.overflow='hidden';
      const a=d2.animate([{opacity:0,height:'0px'},{opacity:1,height:h+'px'}],{duration:300,easing:'cubic-bezier(.32,.72,0,1)'});
      a.onfinish=()=>{d2.style.overflow='';};}
  };
  function apply(){
    // each ledline card: 'Poort [1]' instead of the technical receiver name ('SPI 0F30 · ')
    for(const sm of document.querySelectorAll('.order-focus-endpoint664')){
      const plug=sm.querySelector('[data-c109-port],.c109-plug-inline');const first=sm.firstChild;
      if(plug&&first&&first.nodeType===3){const want=tt('port')+' ';if(first.nodeValue!==want)first.nodeValue=want;}
    }
    for(const sec of document.querySelectorAll('.order-visual-intro655')){
      const demo=sec.querySelector('.order-demo109');if(!demo)continue;
      if(!demo.querySelector(':scope>.c109-demo-hide')){
        const b=document.createElement('button');b.type='button';b.className='c109-demo-hide';b.setAttribute('aria-label',tt('hide'));
        b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>';
        b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setHidden(true);});demo.prepend(b);
      }
      if(!sec.querySelector('.c109-demo-show')){
        const s=document.createElement('button');s.type='button';s.className='c109-demo-show';
        s.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg><span></span>';
        s.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setHidden(false);});
        (sec.querySelector('.order-visual-heading655')||demo).after(s);
      }
      // C138jank: the text write is a childList mutation that re-ran apply() through its own observer.
      {const showC138=sec.querySelector('.c109-demo-show span');if(showC138.textContent!==tt('show'))showC138.textContent=tt('show');
       const hideC138=sec.querySelector('.c109-demo-hide');if(hideC138&&hideC138.getAttribute('aria-label')!==tt('hide'))hideC138.setAttribute('aria-label',tt('hide'));}
      sec.classList.toggle('c109-demo-off',hidden());
    }
  }
  let q=0;new MutationObserver(()=>{if(q)return;q=setTimeout(()=>{q=0;apply();},0);}).observe(document.body,{childList:true,subtree:true});
  apply();
}());


// C109cr-1: a page or tab switch no longer flashes empty. The old page stays
// on screen as a ghost (a copy, canvases included, clipped to the content area)
// that fades or slides out while the app's new page comes in. Zero latency.
(function(){
  const FWD=new Set(['zone','overview-zone','scene-open','scene-new-current','scene-start-edit','receiver-add','zone-new','family','animation-category-choice','stand-scenes']);
  const BACK=new Set(['stand','family-back','assignment-back']);
  const FADE=new Set(['colour','animations','colour-gradient109','controls','overview-receivers','scenes','settings','receivers']);
  const STRIP=['data-action','data-preview','data-colour-picker','data-gradient-workspace','data-order-open','data-receiver-detail','data-stand-animation-preview','data-zone-sheet','data-setting','data-id','role','tabindex','id','aria-live'];
  const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}};
  const root=document.documentElement;
  function build(page,clipTop){
    const r=page.getBoundingClientRect();if(r.width<10||r.height<10)return null;
    const nav=document.getElementById('navigation')?.getBoundingClientRect().top??innerHeight;
    const visTop=Math.max(clipTop||0,0,r.top),visBottom=Math.min(nav,innerHeight,r.bottom);if(visBottom-visTop<24)return null;
    const g=page.cloneNode(true);
    const src=page.querySelectorAll('canvas'),dst=g.querySelectorAll('canvas');
    // C138ui-3: copy each canvas bitmap with drawImage (GPU copy) instead of a PNG toDataURL encode per canvas,
    // which held every page/tab switch 20-80 ms on the tablet. Off-screen canvases are dropped instead of copied.
    dst.forEach((c,i)=>{const sc=src[i];try{const bb=sc.getBoundingClientRect();if(!bb.width||!bb.height||bb.bottom<0||bb.top>innerHeight||!sc.width||!sc.height){c.style.visibility='hidden';return;}
      c.width=sc.width;c.height=sc.height;c.style.cssText=sc.style.cssText;c.style.width=bb.width+'px';c.style.height=bb.height+'px';c.getContext('2d').drawImage(sc,0,0);for(const a of [...c.attributes])if(!/^(class|style|width|height)$/.test(a.name))c.removeAttribute(a.name);}catch(_){c.remove();}});
    g.querySelectorAll('video,iframe,dialog,script').forEach(e=>e.remove());
    g.querySelectorAll(STRIP.map(n=>'['+n+']').join(',')).forEach(e=>{for(const n of STRIP)e.removeAttribute(n);});
    g.removeAttribute('id');g.classList.remove('app-page-enter');g.classList.add('c109-ghost-page');g.setAttribute('aria-hidden','true');g.inert=true;
    g.style.cssText+=';position:absolute;left:0;top:'+(r.top-visTop)+'px;width:'+r.width+'px;margin:0;';
    const box=document.createElement('div');box.className='c109-ghost';box.setAttribute('aria-hidden','true');box.inert=true;
    box.style.cssText='left:'+r.left+'px;top:'+visTop+'px;width:'+r.width+'px;height:'+(visBottom-visTop)+'px;';
    box.append(g);
    // reference point: where the content sat before the switch, so the copy is aligned once it is in the DOM
    const refSel=page.querySelector('.editor-controls')?'.editor-controls':null;
    const refTop=(refSel?page.querySelector(refSel):page).getBoundingClientRect().top;
    // C139tt-6: without a reference point the copy already sits exactly where the page stood (fixed box at visTop, page at
    // r.top-visTop, margin 0, transform none): measuring it only forced a full style pass per page switch.
    box.c109Align=!refSel?null:()=>{try{const ref=g.querySelector(refSel);if(!ref)return;const dy=refTop-ref.getBoundingClientRect().top;if(Math.abs(dy)>1)g.style.top=(parseFloat(g.style.top)+dy)+'px';}catch(_){}};
    return box;
  }
  document.addEventListener('click',event=>{
    const b=event.target instanceof Element&&event.target.closest('#main [data-action],#main .animation-gallery-return');if(!b||b.disabled)return;
    const action=b.dataset.action||(b.classList.contains('animation-gallery-return')?'family-back':'');
    const kind=FWD.has(action)?'fwd':BACK.has(action)?'back':FADE.has(action)?'fade':'';if(!kind)return;
    const main=document.getElementById('main');const page=main&&main.firstElementChild;if(!page)return;
    const dock=main.querySelector('.control-preview-dock .control-dock-surface')||main.querySelector('.control-preview-dock');
    const brand=document.querySelector('header.brand-bar');
    const clipTop=(kind==='fade'&&dock)?dock.getBoundingClientRect().bottom:(brand?brand.getBoundingClientRect().bottom:0);
    let ghost=null;try{ghost=build(page,clipTop);}catch(_){ghost=null;}
    if(!ghost)return;
    // the direction class stays until the next switch: taking it away later would change the
    // animation-name of a page that still carries app-page-enter, and that restarts its entrance
    root.classList.remove('c109-nav-fwd','c109-nav-back','c109-nav-fade');root.classList.add('c109-nav-'+(reduced()?'fade':kind));
    let done=false,ended=false;
    const finish=()=>{if(done)return;done=true;clearTimeout(tm);
      main.append(ghost);ghost.c109Align?.();if(kind==='fade'){const nd=main.querySelector('.control-preview-dock .control-dock-surface')||main.querySelector('.control-preview-dock');const clip=()=>{if(!nd||!ghost.isConnected)return;const nb=Math.round(nd.getBoundingClientRect().bottom),gt=parseFloat(ghost.style.top)||0;if(nb>gt){const dh=nb-gt,gp=ghost.firstElementChild;ghost.style.top=nb+'px';ghost.style.height=Math.max(0,(parseFloat(ghost.style.height)||0)-dh)+'px';if(gp)gp.style.top=((parseFloat(gp.style.top)||0)-dh)+'px';}};clip();if(nd&&window.ResizeObserver){const ro=new ResizeObserver(clip);ro.observe(nd);setTimeout(()=>ro.disconnect(),700);}}
      const slow=reduced();const dur=slow?140:(kind==='fade'?240:320);
      const to=slow||kind==='fade'?{opacity:0}:{opacity:0,transform:'translate3d('+(kind==='fwd'?-40:40)+'px,0,0)'};
      const end=()=>{ended=true;mo.disconnect();ghost.remove();};
      try{const a=ghost.animate([{opacity:1,transform:'none'},to],{duration:dur,easing:'cubic-bezier(.32,.72,0,1)',fill:'forwards'});a.onfinish=end;a.oncancel=end;}
      catch(_){end();}
      setTimeout(()=>{if(!ended)end();},dur+150);};
    // the ghost goes in the moment the app has replaced the page (same task, or a frame later); a second
    // render in that window wipes main, so the ghost is put back until its fade is over
    const mo=new MutationObserver(()=>{if(!done){if(main.firstElementChild&&main.firstElementChild!==page)finish();}else if(!ended&&!ghost.isConnected)main.append(ghost);});mo.observe(main,{childList:true});
    const tm=setTimeout(()=>{if(!done){mo.disconnect();ghost=null;}},450);
  },true);
}());

// C109cr-2: the app scrolls the page after a Kleur/Animaties switch so the
// controls sit right under the preview ("reveal"). When they are already fully
// in view that scroll only looks like a jump, so it is skipped then.
(function(){
  let until=0;const MODE=new Set(['colour','animations','colour-gradient109']);
  document.addEventListener('click',e=>{const b=e.target instanceof Element&&e.target.closest('#main .control-preview-dock [data-action]');if(b&&MODE.has(b.dataset.action))until=performance.now()+600;},true);
  const orig=window.scrollTo;
  window.scrollTo=function(a){
    try{
      if(performance.now()<until&&a&&typeof a==='object'&&a.behavior==='smooth'){
        const t=document.querySelector('#main [data-control-mode="colour"] .shared-colour-picker,#main .animation-context,#main .animation-library-inline,#main [data-gradient-workspace]');
        if(t){const r=t.getBoundingClientRect();const dockB=document.querySelector('#main .control-dock-surface')?.getBoundingClientRect().bottom||0;
          const nav=document.getElementById('navigation')?.getBoundingClientRect().top??innerHeight;
          if(r.top>=dockB-2&&Math.min(r.bottom,r.top+440)<=nav+1){until=0;return;}}
      }
    }catch(_){}
    return orig.apply(this,arguments);
  };
}());

// C109cr-3: a receiver opens as a sheet from the bottom with Klaar, instead of
// folding out under the card. The card itself (name, zone, port chips) stays in
// the list; the sheet holds the picture, the tools and the receiver options.
(function(){
  const T={nl:{done:'Klaar',close:'Sluiten'},en:{done:'Done',close:'Close'},fr:{done:'Terminé',close:'Fermer'},de:{done:'Fertig',close:'Schließen'}};
  const tt=k=>(T[(document.documentElement.lang||'nl').slice(0,2)]||T.nl)[k];
  const scrolls=new Map();
  const SEL='details.receiver-overview-card';
  function close(d){
    if(!d.open||d.classList.contains('is-closing'))return;
    d.classList.remove('is-opening');d.classList.add('is-closing');
    let done=false;const end=()=>{if(done)return;done=true;d.classList.remove('is-closing');
      d.querySelector(':scope>.receiver-details>.c109-rsheet-ports')?.replaceChildren(); /* C138ui-17 */
      d.open=false;};
    const sheet=d.querySelector(':scope>.receiver-details');
    sheet?.addEventListener('animationend',end,{once:true});setTimeout(end,320);
  }
  function decorate(d){
    const sheet=d.querySelector(':scope>.receiver-details');if(!sheet)return;
    if(!d.querySelector(':scope>.c109-rsheet-backdrop')){
      const bd=document.createElement('button');bd.type='button';bd.className='c109-rsheet-backdrop';bd.setAttribute('aria-label',tt('close'));bd.tabIndex=-1;
      bd.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();close(d);});
      sheet.before(bd);
    }
    if(!sheet.querySelector(':scope>.c109-rsheet-head')){
      const h=document.createElement('header');h.className='c109-rsheet-head';
      const name=d.querySelector('summary .receiver-heading-copy>b')?.textContent.trim()||'';
      const fam=d.querySelector('summary .receiver-family-badge')?.textContent.trim()||'';
      const zone=d.querySelector('summary .receiver-zone-chip100 span')?.textContent.trim()||'';
      const sub=[fam,zone].filter(Boolean).join(' · ');
      h.innerHTML='<div><small></small><b></b></div><button type="button" class="c109-sheet-close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button>';
      h.querySelector('small').textContent=sub;h.querySelector('b').textContent=name;
      const x=h.querySelector('button');x.setAttribute('aria-label',tt('close'));x.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();close(d);});
      sheet.prepend(h);
    }
    if(!sheet.querySelector(':scope>.c109-rsheet-foot')){
      const f=document.createElement('footer');f.className='c109-rsheet-foot';
      const b=document.createElement('button');b.type='button';b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span></span>';
      b.querySelector('span').textContent=tt('done');b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();close(d);});
      f.append(b);sheet.append(f);
    }
    // the port chips (pixels per port) belong in the sheet, above the picture; they go back to the card on close
    const chips=d.querySelector(':scope>summary>.receiver-port-chips109'),hint=d.querySelector(':scope>summary>.port-chips-hint109');
    if(chips){let holder=sheet.querySelector(':scope>.c109-rsheet-ports');
      if(!holder){holder=document.createElement('section');holder.className='c109-rsheet-ports';sheet.querySelector(':scope>.c109-rsheet-head').after(holder);}
      if(!holder.firstChild){holder.append(chips.cloneNode(true));if(hint)holder.append(hint.cloneNode(true));}} /* C138ui-17: a copy, the card below keeps its chips and height (no 34 px jump) */
    // the connections block is always unfolded inside the sheet
    const conn=sheet.querySelector('.receiver-connections');if(conn&&!conn.open)conn.open=true;
    const id=d.dataset.receiverDetail;
    if(!sheet.dataset.c109Scroll){sheet.dataset.c109Scroll='1';sheet.addEventListener('scroll',()=>scrolls.set(id,sheet.scrollTop),{passive:true});}
    const saved=scrolls.get(id);if(saved&&Math.abs(sheet.scrollTop-saved)>2)sheet.scrollTop=saved;
  }
  function sync(){
    const open=[...document.querySelectorAll(SEL+'[open]')];
    for(const d of open)decorate(d);
    document.documentElement.classList.toggle('c109-rsheet-open',open.length>0);
  }
  // a user opening (not a re-render) plays the rise
  document.addEventListener('toggle',e=>{const d=e.target;if(!(d instanceof Element)||!d.matches(SEL))return;
    if(d.open){if(d.classList.contains('is-opening'))scrolls.delete(d.dataset.receiverDetail);decorate(d); /* C138ui-17: only a tap (which sets is-opening) animates */const sheet=d.querySelector(':scope>.receiver-details');sheet?.addEventListener('animationend',()=>d.classList.remove('is-opening'),{once:true});setTimeout(()=>d.classList.remove('is-opening'),600);}
    else d.classList.remove('is-opening','is-closing');
    sync();},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){const d=document.querySelector(SEL+'[open]');if(d){e.preventDefault();close(d);}}});
  // the toggle event comes a task later than the open attribute: arm the rise at the tap itself
  document.addEventListener('click',e=>{const sm=e.target instanceof Element&&e.target.closest(SEL+'>summary');if(!sm)return;const d=sm.parentElement;
    if(e.target.closest('button,a,[data-action]'))return;if(!d.open){d.classList.add('is-opening');setTimeout(()=>d.classList.remove('is-opening'),700);}},true);
  // C138ui-17: an open sheet the app just re-rendered is decorated right away (microtask, before the first paint); it
  // used to show one frame without its head/foot/ports and then jump 233 px.
  let q=0;new MutationObserver(()=>{for(const d of document.querySelectorAll(SEL+'[open]'))if(!d.querySelector(':scope>.receiver-details>.c109-rsheet-head')){sync();break;}if(q)return;q=setTimeout(()=>{q=0;sync();},0);}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
  sync();
}());

// C109cr-4: Ledlinevolgorde closes softly. Klaar first drops the sheet (220 ms),
// then the app's own close runs. (The app closes instantly otherwise.)
(function(){
  let forwarding=false;
  document.addEventListener('click',event=>{
    if(forwarding)return;
    const b=event.target instanceof Element&&event.target.closest('#main .order-assignment-done652');if(!b||b.disabled)return;
    const sheet=b.closest('[data-order-open="true"]');if(!sheet||typeof sheet.animate!=='function'||document.documentElement.classList.contains('c137bp-wizard'))return; /* C138ui-18: in the add wizard the step veil takes over at once */
    try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;}catch(_){}
    event.preventDefault();event.stopImmediatePropagation();
    const go=()=>{forwarding=true;try{b.click();}finally{forwarding=false;}};
    sheet.dataset.c109Closing=''; // C138ui-16: the zone preview behind it is painted during the fade (no black bar)
    try{const a=sheet.animate([{opacity:1,transform:'none'},{opacity:0,transform:'translate3d(0,28px,0)'}],{duration:220,easing:'cubic-bezier(.4,0,.6,1)',fill:'forwards'});
      let done=false;const end=()=>{if(done)return;done=true;go();setTimeout(()=>{if(sheet.isConnected&&sheet.dataset.orderOpen==='true')a.cancel();},600);};a.onfinish=end;a.oncancel=end;setTimeout(end,300);}
    catch(_){go();}
  },true);
}());

// C109cr-6: Alles bedienen — switching Kleur/Animaties inside the window cross-fades
// the panel (a copy of the old panel fades out over the new one) instead of cutting.
(function(){
  const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}};
  document.addEventListener('click',e=>{
    const b=e.target instanceof Element&&e.target.closest('dialog[open]:not(.c109-dialog-ghost) [data-action=stand-control-mode]');if(!b||b.getAttribute('aria-selected')==='true'||reduced())return;
    const d=b.closest('dialog');const content=d.querySelector('#effect-dialog-content')||d;const host=()=>d.querySelector('.stand-controls-sheet');const before=host();if(!before)return;
    let ghost=null;
    try{const r=before.getBoundingClientRect(),cr=content.getBoundingClientRect();
      ghost=before.cloneNode(true);const src=before.querySelectorAll('canvas'),dst=ghost.querySelectorAll('canvas');
      dst.forEach((c,i)=>{try{const sc=src[i],bb=sc.getBoundingClientRect();c.width=sc.width;c.height=sc.height;c.style.width=bb.width+'px';c.style.height=bb.height+'px';c.getContext('2d').drawImage(sc,0,0);for(const a of [...c.attributes])if(!/^(class|style|width|height)$/.test(a.name))c.removeAttribute(a.name);}catch(_){c.remove();}}); // C138ui-15: drawImage, no PNG encode (tab switch froze ~1 s at tablet speed)
      ghost.querySelectorAll('[id],[data-action],[role],[tabindex]').forEach(x=>{x.removeAttribute('id');x.removeAttribute('data-action');x.removeAttribute('role');x.removeAttribute('tabindex');});
      ghost.classList.add('c109-panel-ghost');ghost.inert=true;ghost.setAttribute('aria-hidden','true');
      if(getComputedStyle(content).position==='static')content.style.position='relative';
      ghost.style.cssText+=';position:absolute;left:'+(r.left-cr.left)+'px;top:'+(r.top-cr.top+content.scrollTop)+'px;width:'+r.width+'px;height:'+r.height+'px;margin:0;pointer-events:none;z-index:5;overflow:hidden;animation:none;transition:none;';
    }catch(_){ghost=null;}
    let done=false;const go=()=>{if(done)return;done=true;mo.disconnect();clearTimeout(tm);const h=host();if(!h||h===before)return;
      if(ghost){content.append(ghost);try{const a=ghost.animate([{opacity:1},{opacity:0}],{duration:220,easing:'cubic-bezier(.4,0,.6,1)',fill:'forwards'});a.onfinish=()=>ghost.remove();a.oncancel=()=>ghost.remove();}catch(_){ghost.remove();}setTimeout(()=>ghost?.isConnected&&ghost.remove(),400);}
      if(typeof h.animate==='function')try{h.animate([{opacity:0,transform:'translate3d(0,8px,0)'},{opacity:1,transform:'none'}],{duration:260,easing:'cubic-bezier(.32,.72,0,1)'});}catch(_){}};
    const mo=new MutationObserver(()=>{if(host()!==before)go();});mo.observe(d,{childList:true,subtree:true});
    const tm=setTimeout(()=>{mo.disconnect();},500);
  },true);
}());

// C109cr-7: theme and language changes cross-fade the whole screen (View Transitions) instead of flipping.
(function(){
  let forwarding=false;
  document.addEventListener('click',e=>{
    if(forwarding||typeof document.startViewTransition!=='function')return;
    const b=e.target instanceof Element&&e.target.closest('#main [data-action=theme],#main [data-action=language]');if(!b||b.disabled)return;
    if(b.getAttribute('aria-pressed')==='true'||b.getAttribute('aria-checked')==='true')return;
    try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;}catch(_){}
    e.preventDefault();e.stopImmediatePropagation();
    document.documentElement.classList.add('c109-vt-flat');
    const t=document.startViewTransition(()=>{forwarding=true;try{b.click();}finally{forwarding=false;}});
    t.finished.finally(()=>document.documentElement.classList.remove('c109-vt-flat'));
  },true);
}());


// C109cr-9: every modal window closes softly. The app's close() runs unchanged and at once;
// what the user sees is a copy of the window's last frame dropping and fading (200 ms).
(function(){
  if(!window.HTMLDialogElement)return;
  const real=HTMLDialogElement.prototype.close;
  const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}};
  function copy(d){
    const r=d.getBoundingClientRect();if(r.width<8||r.height<8)return;
    const g=d.cloneNode(true);
    const src=d.querySelectorAll('canvas'),dst=g.querySelectorAll('canvas');
    dst.forEach((c,i)=>{try{const sc=src[i],bb=sc.getBoundingClientRect();c.width=sc.width;c.height=sc.height;c.style.cssText=sc.style.cssText;c.style.width=bb.width+'px';c.style.height=bb.height+'px';c.getContext('2d').drawImage(sc,0,0);for(const a of [...c.attributes])if(!/^(class|style|width|height)$/.test(a.name))c.removeAttribute(a.name);}catch(_){c.remove();}}); // C138ui-15: drawImage instead of a PNG encode per canvas
    g.querySelectorAll('[id],[data-action],[role],[tabindex],[aria-live],input,select,textarea,video,iframe').forEach(x=>{if(/^(INPUT|SELECT|TEXTAREA|VIDEO|IFRAME)$/.test(x.tagName)&&x.tagName!=='INPUT'){x.remove();return;}x.removeAttribute('id');x.removeAttribute('data-action');x.removeAttribute('role');x.removeAttribute('tabindex');x.removeAttribute('aria-live');if(x.tagName==='INPUT')x.disabled=true;});
    g.classList.add('c109-dialog-ghost');g.inert=true;g.setAttribute('aria-hidden','true');
    g.style.cssText+=';position:fixed;inset:auto;left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px;margin:0;max-width:none;max-height:none;z-index:2147483000;pointer-events:none;overflow:hidden;transform:none;animation:none;transition:none;';
    let bdColor='transparent';try{if(d.matches(':modal')){bdColor='rgba(10,12,14,.42)';const c=getComputedStyle(d,'::backdrop').backgroundColor;if(c&&c!=='rgba(0, 0, 0, 0)')bdColor=c;}}catch(_){}
    const bd=document.createElement('div');bd.className='c109-dialog-ghost-bd';bd.style.cssText='position:fixed;inset:0;z-index:2147482999;pointer-events:none;background:'+bdColor+';';
    document.body.append(bd,g);
    const kill=()=>{g.remove();bd.remove();};
    try{const a=g.animate([{opacity:1,transform:'none'},{opacity:0,transform:'translate3d(0,22px,0) scale(.985)'}],{duration:200,easing:'cubic-bezier(.4,0,.6,1)',fill:'forwards'});
      bd.animate([{opacity:1},{opacity:0}],{duration:200,easing:'ease-out',fill:'forwards'});a.onfinish=kill;a.oncancel=kill;}catch(_){kill();}
    setTimeout(()=>{if(g.isConnected)kill();},320);
  }
  HTMLDialogElement.prototype.close=function(v){
    // C138ui-15: a dialog the user dismissed has already faded out with the app's own exit (app.js dismissDialog stamps
    // data-c138-exited-at); a copy on top of that came back at full opacity and faded a second time.
    if(this.open&&!(Date.now()-Number(this.dataset.c138ExitedAt||0)<500)&&!this.classList.contains('c109-dialog-ghost')&&!reduced()&&!(document.documentElement.classList.contains('c137bp-wizard')&&this.matches('.pixel-setup-dialog,.spi-zone-direction-dialog'))){try{copy(this);}catch(_){}} // C137bp
    return real.call(this,v);
  };
}());

// C109cs: the live-status line on a zone card ("Het verloop is nog niet bevestigd…") is a technical
// receipt state, not something a customer can act on; it is logged, not shown.
(function(){
  const RE=/verloop is nog niet bevestigd|gradient (has not|hasn.t) been confirmed|dégradé n.est pas encore confirmé|Verlauf (ist )?noch nicht bestätigt/i;
  function quiet(){for(const n of document.querySelectorAll('#main [data-state="failed"]')){const t=(n.textContent||'').trim();if(!t)continue;
    if(RE.test(t)){if(!n.hasAttribute('data-c109-quiet')){n.setAttribute('data-c109-quiet','');try{window.__c98log?.('C109_LIVE_QUIET '+t.slice(0,120));}catch(_){}}}
    else if(n.hasAttribute('data-c109-quiet'))n.removeAttribute('data-c109-quiet');}}
  let q=0;new MutationObserver(()=>{if(q)return;q=setTimeout(()=>{q=0;quiet();},0);}).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-state','hidden']});
  quiet();
}());


// C109ct-1: Ledlinevolgorde uses the same drag as the zones: the card you hold follows your
// finger, the others slide out of the way, and on release the app's own move logic runs
// (one place at a time, through its keyboard path) so saving and receivers stay untouched.
(function(){
  const SHEET='[data-order-open="true"]';
  const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}};
  const tick=()=>{try{window.LightningNativeRuntime?.selectionFeedback?.();}catch(_){}};
  const key=(el,k)=>el.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
  let drag=null,blockClickUntil=0;
  const slotsOf=sheet=>[...sheet.querySelectorAll('[data-order-slot]')];
  const cardOf=slot=>slot.querySelector(':scope>[data-order-item]');
  function flip(el,from){if(!el||typeof el.animate!=='function'||reduced())return;const to=el.getBoundingClientRect();const dy=from.top-to.top;if(Math.abs(dy)<1)return;
    try{el.animate([{transform:`translateY(${dy}px)`},{transform:'none'}],{duration:200,easing:'cubic-bezier(.32,.72,0,1)'});}catch(_){}}
  function commit(sheet,lineId,fromIndex,toIndex){
    // the app only accepts its own order: put the DOM back first, then move one place at a time
    const dir=toIndex>fromIndex?'ArrowDown':'ArrowUp';let moved=0;
    for(let i=0;i<Math.abs(toIndex-fromIndex);i++){
      const live=document.querySelector(SHEET);if(!live)break;
      const h=live.querySelector(`[data-order-item="${CSS.escape(lineId)}"] [data-order-handle]`);if(!h)break;
      const before=[...live.querySelectorAll('[data-order-item]')].map(c=>c.dataset.orderItem).join();
      key(h,'Enter');key(h,dir);key(h,'Enter');
      const after=[...(document.querySelector(SHEET)?.querySelectorAll('[data-order-item]')||[])].map(c=>c.dataset.orderItem).join();
      if(after===before){key(h,'Escape');break;}moved++;
    }
    return moved;
  }
  addEventListener('pointerdown',event=>{
    const handle=event.target instanceof Element&&event.target.closest(SHEET+' [data-order-handle]');if(!handle||event.button>0||event.isPrimary===false||drag)return;
    const card=handle.closest('[data-order-item]'),slot=card?.closest('[data-order-slot]'),sheet=card?.closest(SHEET);if(!card||!slot||!sheet)return;
    if(handle.disabled)return;
    // ours, not the app's pointer drag (this runs on window, before the app's document listener)
    event.stopImmediatePropagation();event.preventDefault();blockClickUntil=performance.now()+800;
    const slots=slotsOf(sheet);const fromIndex=slots.indexOf(slot);if(fromIndex<0)return;
    const order0=slots.map(s=>cardOf(s)?.dataset.orderItem||'');
    const scroller=sheet;const scroll0=scroller.scrollTop;
    drag={id:event.pointerId,lineId:card.dataset.orderItem,card,sheet,scroller,scroll0,startY:event.clientY,y:event.clientY,fromIndex,curIndex:fromIndex,order0,raf:0,hold:true};
    card.classList.add('c109-order-dragging');document.documentElement.classList.add('c109-order-drag');tick();
    // C138ui-9: this drag owns pointerdown (stopImmediatePropagation above), so the app never saw the grab and the line
    // was only selected (= pulsing on the real LEDs) after release. Tell the app now; it selects exactly as a tap does.
    try{window.dispatchEvent(new CustomEvent('aluvision:order-grab-c138',{detail:{lineId:card.dataset.orderItem}}));}catch(_){}
    const place=()=>{if(!drag)return;const d=drag;let ty=d.y-d.startY+(d.scroller.scrollTop-d.scroll0);
      // the card stays between the first and the last place
      const slots=slotsOf(d.sheet);const first=slots[0]?.getBoundingClientRect(),last=slots[slots.length-1]?.getBoundingClientRect();const me=d.card.getBoundingClientRect();
      if(first&&last){const top0=me.top-(d.lastTy||0);ty=Math.max(first.top-top0,Math.min(last.bottom-me.height-top0,ty));}
      d.lastTy=ty;d.card.style.transform=`translateY(${ty}px)`;};
    const step=()=>{
      if(!drag)return;const d=drag;if(!d.card.isConnected){cancel();return;}
      place();
      const slots=slotsOf(d.sheet);const mine=d.card.getBoundingClientRect();const cy=mine.top+mine.height/2;
      // crossing the middle of a neighbour: that card slides into my old place
      const next=slots[d.curIndex+1],prev=slots[d.curIndex-1];
      if(next&&cy>next.getBoundingClientRect().top+next.getBoundingClientRect().height/2-4){
        const other=cardOf(next);const otherBox=other?.getBoundingClientRect();const myTop=mine.top;
        if(other)slots[d.curIndex].append(other);next.append(d.card);d.curIndex++;
        d.startY+=d.card.getBoundingClientRect().top-myTop;place();if(other&&otherBox)flip(other,otherBox);tick();
      }else if(prev&&cy<prev.getBoundingClientRect().top+prev.getBoundingClientRect().height/2+4){
        const other=cardOf(prev);const otherBox=other?.getBoundingClientRect();const myTop=mine.top;
        if(other)slots[d.curIndex].append(other);prev.append(d.card);d.curIndex--;
        d.startY+=d.card.getBoundingClientRect().top-myTop;place();if(other&&otherBox)flip(other,otherBox);tick();
      }
      // auto-scroll near the sheet's edges (under the header, above the footer)
      const head=Math.max(d.sheet.getBoundingClientRect().top,d.sheet.querySelector(':scope>.ledline-setup-toggle')?.getBoundingClientRect().bottom??-Infinity); /* C138ui-16 */
      const foot=d.sheet.querySelector('.order-assignment-footer652')?.getBoundingClientRect().top||d.sheet.getBoundingClientRect().bottom;
      const zone=56;let dy=0;if(d.y<head+zone)dy=-Math.ceil((head+zone-d.y)/6);else if(d.y>foot-zone)dy=Math.ceil((d.y-(foot-zone))/6);
      if(dy){const before=d.scroller.scrollTop;d.scroller.scrollTop=before+dy;if(d.scroller.scrollTop!==before)place();}
      d.raf=requestAnimationFrame(step);
    };
    const move=ev=>{if(!drag||ev.pointerId!==drag.id)return;ev.preventDefault();drag.y=ev.clientY;if(!drag.raf)drag.raf=requestAnimationFrame(step);};
    const restore=(d)=>{const slots=slotsOf(d.sheet);const cards=new Map(slots.map(s=>[cardOf(s)?.dataset.orderItem,cardOf(s)]));d.order0.forEach((id,i)=>{const c=cards.get(id);if(c&&slots[i]&&c.parentElement!==slots[i])slots[i].append(c);});};
    const end=(ok)=>{
      const d=drag;if(!d)return;drag=null;cancelAnimationFrame(d.raf);
      removeEventListener('pointermove',move,true);removeEventListener('pointerup',up,true);removeEventListener('pointercancel',up,true);
      document.documentElement.classList.remove('c109-order-drag');
      // where the eye left every card (the held one under the finger, the others shifted)
      const seen=new Map([...d.sheet.querySelectorAll('[data-order-item]')].map(c=>[c.dataset.orderItem,c.getBoundingClientRect()]));
      d.card.classList.remove('c109-order-dragging');d.card.style.transform='';
      const changed=ok&&d.curIndex!==d.fromIndex;
      // C138ui-16 (measured: after release the card hung ~0.9 s under the finger at tablet speed, because the app's commit and
      // full render ran inside pointerup): a changed order lands at once (the DOM already holds it); the app gets it after that frame.
      if(changed){requestAnimationFrame(()=>{const go=!reduced();
        for(const c of d.sheet.querySelectorAll('[data-order-item]')){const r0=seen.get(c.dataset.orderItem);if(!r0)continue;const dy=r0.top-c.getBoundingClientRect().top;
          if(Math.abs(dy)>.5&&go&&typeof c.animate==='function')try{c.animate([{transform:`translateY(${dy}px)`},{transform:'none'}],{duration:260,easing:'cubic-bezier(.32,.72,0,1)'});}catch(_){}}
        setTimeout(()=>{restore(d);let moved=0;try{moved=commit(d.sheet,d.lineId,d.fromIndex,d.curIndex);}catch(_){moved=0;}
          if(!moved&&go){const n=document.querySelector(SHEET)?.querySelector(`[data-order-item="${CSS.escape(d.lineId)}"]`);if(n&&typeof n.animate==='function')try{n.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(5px)'},{transform:'translateX(0)'}],{duration:320,easing:'ease-in-out'});}catch(_){}}
        },0);});return;}
      restore(d);
      let moved=0;
      // hold every card where it was seen until the app's new layout is final (next frame), then glide into place
      const hold=()=>{const live=document.querySelector(SHEET);if(!live)return;for(const c of live.querySelectorAll('[data-order-item]')){const r0=seen.get(c.dataset.orderItem);if(!r0)continue;const dy=r0.top-c.getBoundingClientRect().top;c.style.transform=Math.abs(dy)>.5?`translateY(${dy}px)`:'';}};
      hold();
      requestAnimationFrame(()=>{const live=document.querySelector(SHEET);if(!live)return;const go=!reduced();
        for(const c of live.querySelectorAll('[data-order-item]')){c.style.transform='';const r0=seen.get(c.dataset.orderItem);if(!r0)continue;const dy=r0.top-c.getBoundingClientRect().top;
          if(Math.abs(dy)>.5&&go&&typeof c.animate==='function')try{c.animate([{transform:`translateY(${dy}px)`},{transform:'none'}],{duration:260,easing:'cubic-bezier(.32,.72,0,1)'});}catch(_){}}
        if(changed&&!moved&&go){const n=live.querySelector(`[data-order-item="${CSS.escape(d.lineId)}"]`);if(n&&typeof n.animate==='function')try{n.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(5px)'},{transform:'translateX(0)'}],{duration:320,easing:'ease-in-out',delay:260});}catch(_){}}
      });
    };
    const up=ev=>{if(!drag||ev.pointerId!==drag.id)return;ev.preventDefault();end(ev.type==='pointerup');};
    const cancel=()=>end(false);
    addEventListener('pointermove',move,true);addEventListener('pointerup',up,true);addEventListener('pointercancel',up,true);
    drag.raf=requestAnimationFrame(step);
  },true);
  // the tap that ends our drag must not reach the app's handle click (it would start its keyboard pickup)
  addEventListener('click',e=>{if(performance.now()<blockClickUntil&&e.target instanceof Element&&e.target.closest(SHEET+' [data-order-handle]')){e.stopImmediatePropagation();e.preventDefault();}},true);
}());

// C138ui-10 (9 Nov, measured on the tablet: fingers held an order card 5-7 s and nothing happened, only the narrow grip
// could drag): holding a card for 0.3 s now grabs it exactly like the grip (same C109ct-1 drag, selected and pulsing at
// once via C138ui-9). A short tap still selects, moving first still scrolls, Kleur and the gear keep their own tap.
(function(){
  const SHEET='[data-order-open="true"]',HOLD_MS=300,SLOP=8;
  let pend=null,heldId=null,heldLine=null,blockCardClickUntil=0;
  const dragging=()=>document.documentElement.classList.contains('c109-order-drag');
  const clear=()=>{if(pend){clearTimeout(pend.timer);pend=null;}};
  addEventListener('pointerdown',event=>{
    if(event.button>0||event.isPrimary===false||dragging())return;
    const target=event.target instanceof Element?event.target:null;const card=target?.closest(SHEET+' [data-order-item]');if(!card)return;
    if(target.closest('[data-order-handle]'))return;
    const control=target.closest('button,a,input,select,textarea,summary,[role=switch]');
    if(control&&!control.matches('.order-focus-select664'))return;
    const handle=card.querySelector('[data-order-handle]');if(!handle||handle.disabled)return;
    clear();
    const p={id:event.pointerId,type:event.pointerType,x:event.clientX,y:event.clientY,card,handle};
    p.timer=setTimeout(()=>{if(pend!==p)return;pend=null;if(!card.isConnected||!handle.isConnected||handle.disabled||dragging())return;
      heldId=p.id;heldLine=card.dataset.orderItem;
      try{handle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,composed:true,pointerId:p.id,pointerType:p.type,isPrimary:true,button:0,buttons:1,clientX:p.x,clientY:p.y}));}catch(_){heldId=null;}
    },HOLD_MS);
    pend=p;
  },true);
  addEventListener('pointermove',event=>{if(pend&&event.pointerId===pend.id&&Math.hypot(event.clientX-pend.x,event.clientY-pend.y)>SLOP)clear();},true);
  const release=event=>{if(pend&&event.pointerId===pend.id)clear();if(heldId!==null&&event.pointerId===heldId){heldId=null;blockCardClickUntil=performance.now()+600;}};
  addEventListener('pointerup',release,true);addEventListener('pointercancel',release,true);
  // while a held card is dragged the page must not scroll, and Android's long-press menu must not take the touch over
  // (only while the order panel is open, so scrolling elsewhere never waits for this listener)
  const blockScroll=event=>{if(heldId!==null&&dragging()&&event.cancelable)event.preventDefault();};let blocking=false;
  const syncBlock=()=>{const want=document.documentElement.classList.contains('c109-order-open');if(want===blocking)return;blocking=want;
    if(want)addEventListener('touchmove',blockScroll,{capture:true,passive:false});else removeEventListener('touchmove',blockScroll,{capture:true});};
  new MutationObserver(syncBlock).observe(document.documentElement,{attributes:true,attributeFilter:['class']});syncBlock();
  addEventListener('contextmenu',event=>{if((pend||heldId!==null||dragging())&&event.target instanceof Element&&event.target.closest(SHEET))event.preventDefault();},true);
  // the release of a held card is not a tap on it
  addEventListener('click',event=>{if(performance.now()<blockCardClickUntil&&event.target instanceof Element&&heldLine!==null&&event.target.closest(SHEET+' [data-order-item]')?.dataset.orderItem===heldLine){event.stopImmediatePropagation();event.preventDefault();}},true); // C138ui-16: a quick tap on another card still selects
}());

// C109ct-2: one settings icon everywhere — a clean gear — and the settings button on a ledline
// card in Ledlinevolgorde opens the receiver's own panel (the same menu as under Receivers).
(function(){
  const GEAR='<circle cx="12" cy="12" r="3.1"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>';
  function regear(){
    for(const svg of document.querySelectorAll('svg[data-icon="settings"]:not([data-c109-gear]),svg[data-icon="sliders"]:not([data-c109-gear]),.c109-zone-gear svg:not([data-c109-gear])')){
      svg.setAttribute('data-c109-gear','');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.9');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.innerHTML=GEAR;
    }
  }
  let q=0;new MutationObserver(()=>{if(q)return;q=setTimeout(()=>{q=0;regear();},0);}).observe(document.documentElement,{childList:true,subtree:true});regear();
  // ledline settings in Ledlinevolgorde → the receiver's panel
  addEventListener('click',e=>{
    const b=e.target instanceof Element&&e.target.closest('[data-order-open="true"] [data-action="layout-receiver-settings"][data-id]');if(!b)return;
    const id=b.dataset.id||'';const receiverId=id.includes(':')?id.slice(0,id.lastIndexOf(':')):id;if(!receiverId)return;
    e.preventDefault();e.stopImmediatePropagation();
    document.querySelector('#navigation [data-id="receivers"]')?.click();
    const t0=performance.now();const tryOpen=()=>{const d=document.querySelector(`details.receiver-overview-card[data-receiver-detail="${CSS.escape(receiverId)}"]`);
      if(d){for(let e=d.parentElement;e&&e!==document.body;e=e.parentElement)for(const a of e.getAnimations?.()||[])if(a.effect?.target===e)try{a.finish();}catch(_){} /* C138ui-16 */if(!d.open){d.classList.add('is-opening');d.open=true;setTimeout(()=>d.classList.remove('is-opening'),700);}try{d.scrollIntoView({block:'center',behavior:'instant'});}catch(_){}return;}
      if(performance.now()-t0<2000)setTimeout(tryOpen,60);};
    setTimeout(tryOpen,60);
  },true);
}());


// C109cu-1: opening a zone lands in the section of its light. An animation opens on
// Animaties with that animation's settings; a gradient opens on Verloop (the app already
// remembers that mode); a solid colour opens on Kleur. The same when a zone is opened
// while editing a scene. The switch happens before the first paint, so nothing flashes.
(function(){
  const ENTER=new Set(['zone','overview-zone','scene-edit-zone','scene-zone-edit']);
  const STATIC={nl:'Vaste kleur',en:'Static colour',fr:'Couleur fixe',de:'Feste Farbe'};
  const lang=()=>(document.documentElement.lang||'nl').slice(0,2);
  const mixed=()=>{try{return window.LightningV50Texts?.t('v50DifferentSettings',lang())||'Verschillende instellingen';}catch(_){return 'Verschillende instellingen';}};
  const main=document.getElementById('main');if(!main)return;
  let pending=null;
  document.addEventListener('click',e=>{const b=e.target instanceof Element&&e.target.closest('#main [data-action]');if(!b||!ENTER.has(b.dataset.action))return;pending={at:performance.now(),stage:0};},true);
  new MutationObserver(()=>{
    if(!pending)return;
    if(performance.now()-pending.at>2500){pending=null;return;}
    const tabs=main.querySelector('.control-mode-tabs');if(!tabs)return;
    if(pending.stage===0){
      // C139ui-7: app.js (C139ui-2) already opens the zone on its own light; a gradient (Verloop) is no animation.
      if(main.querySelector('[data-gradient-workspace][data-gradient-mode="gradient"]')){pending=null;return;}
      const label=(main.querySelector('[data-current-light]')?.textContent||'').trim();
      const isStatic=!label||label===STATIC[lang()]||label===STATIC.nl||label===mixed();
      if(isStatic){pending=null;return;}
      const anim=tabs.querySelector('[data-action="animations"]');
      if(!anim||anim.getAttribute('aria-pressed')==='true'){pending=null;return;}
      pending.stage=1;pending.at=performance.now();anim.click();return;
    }
    if(pending.stage===1){
      if(main.querySelector('.active-animation-workspace')){pending=null;return;}
      const edit=main.querySelector('[data-action="animation-current-edit"]');
      if(edit){pending=null;edit.click();}
    }
  }).observe(main,{childList:true,subtree:true});
}());

// C109cu-2: on the Verloop screen, "Omzetten naar animatie" takes the gradient to the
// moving-gradient animations (slide, wave, breathe, light head) where its settings live.
(function(){
  const TX={nl:['Omzetten naar animatie','Laat dit verloop bewegen: schuiven, golven, ademen of een lichtkop.'],en:['Turn into an animation','Make this gradient move: slide, wave, breathe or a light head.'],fr:['Transformer en animation','Faites bouger ce dégradé : glisser, onduler, respirer ou une tête lumineuse.'],de:['In Animation umwandeln','Lass diesen Verlauf laufen: schieben, wellen, atmen oder ein Lichtkopf.']};
  const lang=()=>(document.documentElement.lang||'nl').slice(0,2);
  const ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h2l2-5 3 10 3-14 3 14 2-5h3"/></svg>';
  const CHEV='<svg class="c109-view-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
  // C139ui-1: open the Beweging card right here (app.js 'aluvision:gradient-motion-c139'): no jump to Animaties.
  // The card takes the row's place; it is scrolled into view only as far as it runs under the tab bar.
  function openHere(){
    window.dispatchEvent(new CustomEvent('aluvision:gradient-motion-c139'));
    showCardC139(true);
  }
  // C139ui-1b: measured before the fade-in (its first frame sits 8 px higher). Only a sticky preview dock above the card
  // limits the scroll, at the height where it docks; landscape keeps the dock in its own column (or lets it scroll away),
  // so there the card may use the full height.
  function showCardC139(fade){
    let tries=30;(function look(){
      const card=document.querySelector('#main [data-gradient-motion-card]');
      if(!card){if(--tries>0)requestAnimationFrame(look);return;}
      const r=card.getBoundingClientRect(),nav=document.getElementById('navigation'),navTop=nav&&!nav.hidden&&nav.getBoundingClientRect().height?nav.getBoundingClientRect().top:innerHeight;
      const dock=document.querySelector('#main .control-preview-dock'),d=dock?.getBoundingClientRect(),cs=dock&&getComputedStyle(dock);
      const dockBottom=d&&cs.position==='sticky'&&d.right>r.left+1&&d.left<r.right-1?Math.max(0,d.bottom-Math.max(0,d.top-(parseFloat(cs.top)||0))):0;
      const over=r.bottom-(navTop-12),room=r.top-dockBottom-12,by=Math.min(over,Math.max(0,room));
      if(by>1)window.scrollBy({top:by,behavior:'smooth'});
      if(fade&&!matchMedia('(prefers-reduced-motion: reduce)').matches){card.classList.add('c139-reveal');setTimeout(()=>card.classList.remove('c139-reveal'),450);}
    })();
  }
  // C139ui-1c: after "Verloop in beweging" in Animaties (app.js) the page was just rebuilt; reveal the card once the
  // preview dock has settled (two frames with the card at the same place), without the fade.
  window.addEventListener('aluvision:gradient-motion-shown-c139',()=>{let last=null,n=0;(function settle(){const card=document.querySelector('#main [data-gradient-motion-card]');if(!card)return;
    const top=Math.round(card.getBoundingClientRect().top);if(top!==last&&++n<12){last=top;requestAnimationFrame(settle);return;}showCardC139(false);})();});
  function place(){
    const ws=document.querySelector('#main [data-gradient-workspace][data-gradient-mode="gradient"]');
    if(!ws||ws.querySelector('.c109-grad-anim'))return;
    // C139ui-1: right under Verloopkleuren, where the Beweging card opens; while the gradient moves, the card itself
    // (with its on/off switch) stands there instead of this row.
    if(ws.querySelector('[data-gradient-motion-card]'))return;
    const anchor=ws.querySelector('.static-gradient-editor')||ws.querySelector('.gradient-apply-card');if(!anchor)return;
    const [t1,t2]=TX[lang()]||TX.nl;
    const b=document.createElement('button');b.type='button';b.className='c109-sheet-row c109-grad-anim';
    b.innerHTML='<span class="c109-tool-ic">'+ICON+'</span><span class="c109-tool-copy"><b></b><small></small></span>'+CHEV;
    b.querySelector('b').textContent=t1;b.querySelector('small').textContent=t2;
    b.addEventListener('click',e=>{e.preventDefault();openHere();});
    anchor.after(b);
  }
  let q=0;new MutationObserver(()=>{if(q)return;q=1;queueMicrotask(()=>{q=0;place();});}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-gradient-mode']});
  place();
}());

// C109cw-1: a quieter, faster start. The automatic "is the stand context on every receiver" check
// (syncInstallationContext) began ~1.5 s after the first shared-document read and could hold the
// MAIN for 5–30 s on the tablet, so the mesh status, "Verbonden" and the first colour waited behind
// it. It now waits 20 s after the app start (through the existing C135 quiet hook): light, shared
// document and mesh status go first; after the window one wake-up asks for the same check as before.
(function(){
  'use strict';
  if(window.__quietAfterLoadC135)return;
  const now=Date.now();window.__quietAfterLoadC135={shared:0,context:now+25000,mesh:0};
  // The check does not retry by itself when something else holds the MAIN at that moment (the app's own
  // 20 s roster check, a zone's pre-warm): wake again a few times until the runtime reports a context pass.
  let seen=false;window.addEventListener('lightning:receiver-context',()=>{if(Date.now()>now+25000)seen=true;});
  const wake=()=>{try{if(!seen&&document.visibilityState!=='hidden')window.dispatchEvent(new Event('c98-setup-screen-left'));}catch(_){}};
  for(const ms of [25600,45000,80000,150000])setTimeout(wake,ms);
}());

// C109cw-2: start profile. Marks when the customer sees the stand page, the zone cards, the
// connection, the mesh status and the context check, counts page rebuilds and main-thread stalls,
// keeps the last 300 log lines in window.__c109log (also on Android, whose host drops them) and
// reports once after 30 s: 'C109_BOOT stand=0.5 zones=0.5 conn=5.4 mesh=16.6 ctx=6.4:pending …'.
(function(){
  'use strict';
  const marks={},log=[];const t=()=>Math.round(performance.now())/1000;
  const mark=(k,v)=>{if(!(k in marks))marks[k]=v===undefined?t():v;};
  const orig=window.__c98log;window.__c109log=log;
  window.__c98log=function(m){try{log.push(t().toFixed(1)+' '+String(m).slice(0,300));if(log.length>300)log.shift();}catch(_){}try{if(/^C137 ZONE_ADOPT recv=/.test(String(m)))setTimeout(()=>window.__c109AdoptNotice?.(),600);}catch(_){}try{orig?.(m);}catch(_){}};
  let renders=0,stalls=0;const main=document.getElementById('main');
  const check=()=>{if(main.querySelector('.stand-page'))mark('stand');if(main.querySelector('[data-action="zone"],[data-action="overview-zone"]'))mark('zones');};
  if(main){new MutationObserver(ms=>{for(const m of ms)if(m.target===main)renders++;check();}).observe(main,{childList:true,subtree:true});check();}
  try{new PerformanceObserver(l=>{for(const e of l.getEntries())stalls+=e.duration;}).observe({type:'longtask',buffered:true});}catch(_){}
  window.addEventListener('lightning:stand-connection',e=>{if(e.detail?.state==='connected')mark('conn');});
  window.addEventListener('lightning:mesh-status',()=>mark('mesh'),{once:true});
  window.addEventListener('lightning:receiver-context',e=>{const d=e.detail;if(d?.contextPhase==='complete'&&['synced','pending','unavailable'].includes(d.status))mark('ctx',t().toFixed(1)+':'+d.status);});
  window.__c109boot=()=>({...marks,renders,stalls:Math.round(stalls)/1000,upS:t()});
  setTimeout(()=>{const line='C109_BOOT '+Object.entries(window.__c109boot()).map(([k,v])=>k+'='+v).join(' ');try{window.__c98log?.(line);}catch(_){}try{console.info(line);}catch(_){}},30000);
}());

// C109cw-4: a receiver that is not reachable, or not in a zone yet, says so in its sheet — calmly, with
// the one button that helps (choose a zone) — and its pixel/side/order tiles look muted instead of
// failing silently. The C137ar self-repair (a zoneless receiver joins the only zone of its kind) is
// announced once in the notice place.
(function(){
  'use strict';
  const T={
    nl:{nozone:'Nog niet in een zone',nozoneHint:'Kies een zone; daarna kun je kanten en volgorde instellen.',choose:'Zone kiezen',offHint:'Zodra hij weer aan staat, kun je pixels, kanten en volgorde weer aanpassen.',adopted:'Receiver automatisch in zijn zone gezet.'},
    en:{nozone:'Not in a zone yet',nozoneHint:'Choose a zone; then you can set sides and order.',choose:'Choose zone',offHint:'Once it is on again, you can adjust pixels, sides and order.',adopted:'Receiver placed in its zone automatically.'},
    fr:{nozone:'Pas encore dans une zone',nozoneHint:'Choisissez une zone ; vous pourrez ensuite régler les côtés et l’ordre.',choose:'Choisir une zone',offHint:'Dès qu’il sera rallumé, vous pourrez à nouveau régler pixels, côtés et ordre.',adopted:'Récepteur placé automatiquement dans sa zone.'},
    de:{nozone:'Noch in keiner Zone',nozoneHint:'Wähle eine Zone; danach kannst du Kanten und Reihenfolge einstellen.',choose:'Zone wählen',offHint:'Sobald er wieder an ist, kannst du Pixel, Kanten und Reihenfolge wieder anpassen.',adopted:'Receiver automatisch in seine Zone gesetzt.'}};
  const tt=k=>(T[(document.documentElement.lang||'nl').slice(0,2)]||T.nl)[k];
  function status(d){
    const sheet=d.querySelector(':scope>.receiver-details'),head=sheet?.querySelector(':scope>.c109-rsheet-head');if(!head)return;
    d.dataset.c109st='1';sheet.querySelector(':scope>.c109-rsheet-status')?.remove();
    const off=d.querySelector(':scope>summary .receiver-status[data-state="offline"]');
    const chip=d.querySelector(':scope>summary .receiver-zone-chip100');
    const group=d.closest('[data-zone-group]');
    const nozone=!off&&!!chip&&(group?group.dataset.zoneGroup==='':!!d.querySelector('.receiver-connections [data-action="receiver-directions"][disabled]'));
    d.classList.toggle('c109-offline',!!off);d.classList.toggle('c109-nozone',nozone);
    if(!off&&!nozone)return;
    const p=document.createElement('div');p.className='c109-rsheet-status';p.dataset.kind=off?'offline':'nozone';p.setAttribute('role','status');
    p.innerHTML='<i aria-hidden="true"></i><span><b></b><small></small></span>';
    p.querySelector('b').textContent=off?off.textContent.trim():tt('nozone');p.querySelector('small').textContent=off?tt('offHint'):tt('nozoneHint');
    if(nozone){const b=document.createElement('button');b.type='button';b.textContent=tt('choose');b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();chip.click();});p.append(b);}
    head.after(p);
  }
  document.addEventListener('toggle',e=>{const d=e.target;if(d instanceof HTMLDetailsElement&&d.matches('details.receiver-overview-card')&&d.open)setTimeout(()=>status(d),0);},true);
  const main=document.getElementById('main');
  if(main)new MutationObserver(()=>{for(const d of main.querySelectorAll('details.receiver-overview-card[open]:not([data-c109st])'))if(d.querySelector(':scope>.receiver-details>.c109-rsheet-head'))status(d);}).observe(main,{childList:true,subtree:true});
  window.__c109AdoptNotice=()=>{try{window.__c109Notice?.(tt('adopted'));}catch(_){}};
}());
