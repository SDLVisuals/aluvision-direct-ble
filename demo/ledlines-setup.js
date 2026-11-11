/* C144 Ledlines instellen (11 nov 2026, gebruiker: "Ja, in de app"): de weergave van de eerste setup van een
 * SPI-receiver, zoals het prototype (prototypes/ledlines-herkennen = C142p, prototypes/ledlines-instellen):
 *   - één kop voor de hele setup: icoon, "Ledlines instellen", waarom, Stap 1 "Ledlines en pixels" en
 *     Stap 2 "Volgorde en kanten", elk met een balkje per deel;
 *   - stap 1: kleurtegels ("Welke kleuren zie je?"), per ledline de liniaal ("Waar eindigt ledline n?") en
 *     "Pixels ingesteld".
 * Alleen weergave. pixel-setup.js houdt de toestand, het testlicht en het opslaan; hier wordt niets naar een receiver
 * gestuurd en niets bewaard. Er staan geen poortnummers in deze schermen ("waar je ze insteekt, maakt niet uit").
 */
(function(root){'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const CHECK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  const NEXT='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const BACK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
  const PLUS='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg>';
  const PLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
  const CHAIN='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12h4M10 12h4M17.5 12h4"/><path d="M6 8.5l2.5 3.5L6 15.5M13.5 8.5l2.5 3.5-2.5 3.5"/></svg>';
  const T=Object.freeze({
    title:'Ledlines instellen',why:'Bij SPI krijgt elke ledline eigen data.',steps:'Ledlines instellen in 2 stappen',
    step1:'Ledlines en pixels',step2:'Volgorde en kanten',stepNo:'Stap {n}',stepDone:', ingesteld',stepNow:', nu bezig',
    colours:'Welke kleuren zie je?',coloursSay:'Waar je ze insteekt, maakt niet uit. Kijk naar je stand: <b>tik de kleuren aan die branden.</b>',
    ledline:'Ledline {n}',coloursGroup:'Kleuren die je ziet',coloursNone:'Tik minstens één kleur aan die brandt.',
    where:'Waar eindigt ledline {n}?',whereSay:'Pixels stel je per ledline in. Kijk naar je stand: <b>zet het rode blokje op het einde.</b>',
    of:'{i} van {n}',pixels:'pixels',count:'Aantal pixels van ledline {n}',ruler:'Laatste pixel van ledline {n}: veeg om pixel per pixel te schuiven',
    minus10:'10 pixels minder',minus1:'Eén pixel minder',plus1:'Eén pixel meer',plus10:'10 pixels meer',
    done:'Pixels ingesteld',doneSay:'Per ledline ingesteld: je ledlines kunnen nu <b>apart</b> spelen, elk met een eigen animatie tot de laatste pixel.',
    off:'Niet aangesloten · blijft uit',offShort:'Uit',
    later:'<b>Later een ledline bijhangen? Dat kan altijd.</b> Doe dan alle stappen opnieuw voor die ledline.',
    next2:'<b>Stap 2: volgorde en kanten, per zone.</b> Daarna spelen alle receivers in je zone samen als één lange ledline en loopt een animatie mooi van de ene ledline in de volgende.',
    eyebrow:'Receiver · {name}',
    tutorial:'Bekijk tutorial',
    goNext:'Volgende',goDone:'Klaar',goBack:'Terug',goClose:'Sluiten',goStep2:'Ga verder naar stap 2',goFinish:'Opslaan en klaar'
  });
  function t(key,params={}){return String(T[key]??key).replace(/\{(\w+)\}/g,(_,name)=>params[name]??'');}
  const metres=value=>`≈ ${(value/26).toLocaleString('nl-BE',{maximumFractionDigits:2,minimumFractionDigits:2})} m`;

  // ---------- het icoon en de kop ----------
  // Twee schuifjes (instellen) boven een brandende ledline. Elk exemplaar een eigen verloop-id.
  let gid=0;
  function icon(){const id='lsg'+(++gid);
    return `<svg class="ls-icon" viewBox="0 0 28 28" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" x2="1">`+
      `<stop offset="0" stop-color="#2F6BFF"/><stop offset=".5" stop-color="#FFC61A"/><stop offset="1" stop-color="#9B4DFF"/></linearGradient></defs>`+
      `<path d="M4 5.5h20M4 11h20"/><circle class="ls-k1" cx="10" cy="5.5" r="2.2"/><circle class="ls-k2" cx="18" cy="11" r="2.2"/>`+
      `<rect x="2.5" y="16.5" width="23" height="7" rx="1.6"/><rect x="4.6" y="18.6" width="18.8" height="2.8" rx="1.2" fill="url(#${id})" stroke="none"/></svg>`;}
  // pos: 1 ledlines, 2 pixels (stap 1) · 3 volgorde, 4 kanten (stap 2) · 5 alles ingesteld
  // steps:false → zonder de stappenrij (de wizardbalk bovenaan toont ze dan al)
  function head(pos,{done1=pos>2,done2=pos>4,steps:withSteps=true}={}){
    const steps=[{n:1,name:t('step1'),done:done1},{n:2,name:t('step2'),done:done2}];
    const intro=`<div class="ls-head"><div class="ls-intro"><i aria-hidden="true">${icon()}</i><span><b>${esc(t('title'))}</b><small>${esc(t('why'))}</small></span></div>`;
    if(!withSteps)return intro+`</div>`;
    return intro+
      `<ol class="ls-steps" aria-label="${esc(t('steps'))}">`+steps.map(s=>{const now=pos<=4&&Math.ceil(pos/2)===s.n;
        return `<li class="${now?'is-now':''}${s.done?' is-done':''}"${now?' aria-current="step"':''} aria-label="${esc(t('stepNo',{n:s.n})+': '+s.name+(s.done?t('stepDone'):now?t('stepNow'):''))}">`+
          `<span class="ls-no">${esc(t('stepNo',{n:s.n}))}<i aria-hidden="true">${CHECK}</i></span><b>${esc(s.name)}</b>`+
          `<span class="ls-bars" aria-hidden="true"><i class="${2*s.n-1<=Math.min(pos,4)?'on':''}"></i><i class="${2*s.n<=Math.min(pos,4)?'on':''}"></i></span></li>`;}).join('')+`</ol></div>`;
  }
  const tutorialButton=()=>globalThis.LightningLedlineTutorial?`<button type="button" class="ls-tut" data-pixel-action="tutorial"><i aria-hidden="true">${PLAY}</i><span>${esc(t('tutorial'))}</span></button>`:'';
  // een stukje ledline in een kleur, met de witte randjes van de echte ledline
  const sleeve=hex=>`<span class="ls-sleeve" style="--c:${esc(hex)}" aria-hidden="true"></span>`;

  // ---------- stap 1, deel 1: de kleuren die branden ----------
  function outputs(rows,{colour,name='',pulse=null}){
    return `<small class="ls-eyebrow">${esc(t('eyebrow',{name:name||'SPI'}))}</small><h2 class="ls-title">${esc(t('colours'))}</h2><p class="ls-say">${t('coloursSay')}</p>${tutorialButton()}`+
      `<div class="ls-tiles" role="group" aria-label="${esc(t('coloursGroup'))}">`+rows.map(row=>{const c=colour(row.port);
        return `<button type="button" class="ls-tile${row.enabled&&row.port===pulse?' is-pulse':''}" data-pixel-action="output" data-port="${row.port}" data-pixel-palette-port="${row.port}" aria-pressed="${row.enabled}" style="--port-colour:${esc(c.hex)};--port-ink:${esc(c.ink)}">`+
          `<span class="ls-line">${sleeve('var(--port-colour)')}</span><span class="ls-tname"><b>${esc(t('ledline',{n:row.port}))}</b><small class="pixel-port-colour">${esc(c.label)}</small></span>`+
          `<i class="ls-tick" aria-hidden="true">${CHECK}</i></button>`;}).join('')+`</div>`+
      `<p class="ls-status" data-ports-preview-status role="status" aria-live="polite"></p>`+
      (rows.some(row=>row.enabled)?'':`<p class="ls-hint">${esc(t('coloursNone'))}</p>`);
  }

  // ---------- stap 1, deel 2: per ledline de pixels ----------
  // De liniaal: je ledline van dichtbij, pixel per pixel; het rode blokje (de laatste pixel) staat altijd in het midden.
  // Vegen: 14 px = 1 pixel; snel vegen en loslaten laat hem uitlopen. Daaronder −10 · −1 · +1 · +10 en het overzicht.
  const ZC=14;
  function pixels(row,{colour,list,max=163}){
    const c=colour(row.port),i=list.indexOf(row.port),v=row.pixels;
    const segs=list.map((port,k)=>`<i class="${k<i?'done':k===i?'now':''}" style="--c:${esc(colour(port).hex)}"></i>`).join('');
    const labels=Array.from({length:Math.floor(max/10)},(_,k)=>`<b style="left:${(((k+1)*10-.5)*ZC).toFixed(1)}px">${(k+1)*10}</b>`).join('');
    return `<div class="ls-now" style="--c:${esc(c.hex)}"><div class="ls-now-top"><span class="ls-now-dot"></span><b>${esc(t('ledline',{n:row.port}))}</b><span class="ls-now-of">${esc(t('of',{i:i+1,n:list.length}))}</span></div>`+
        `<div class="ls-now-segs" aria-hidden="true">${segs}</div></div>`+
      `<h2 class="ls-title">${esc(t('where',{n:row.port}))}</h2><p class="ls-say">${t('whereSay')}</p>${tutorialButton()}`+
      `<section class="pixel-setup-panel ls-px" data-pixel-panel="pixels" data-pixels-per-meter="26">`+
        `<div class="ls-count"><label><input data-pixel-count type="number" inputmode="numeric" min="0" max="${max}" step="1" value="${v}" aria-label="${esc(t('count',{n:row.port}))}"></label>`+
          `<small>${esc(t('pixels'))} · <span data-ls-metres>${esc(metres(v))}</span></small></div>`+
        `<div class="ls-ruler" data-ls-ruler role="slider" tabindex="0" aria-label="${esc(t('ruler',{n:row.port}))}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${v}" data-max="${max}">`+
          `<div class="ls-rtrack" data-ls-rtrack style="width:${max*ZC}px"><i class="ls-rbase"></i><i class="ls-rw" data-ls-rw></i><i class="ls-rr" data-ls-rr></i><i class="ls-rsep"></i><i class="ls-rrim"></i>${labels}</div>`+
          `<i class="ls-rmark" aria-hidden="true"></i></div>`+
        `<div class="ls-pm" role="group"><button type="button" data-pixel-action="pixel-step" data-pixel-delta="-10" aria-label="${esc(t('minus10'))}">−10</button>`+
          `<button type="button" class="dark" data-pixel-action="pixel-less" aria-label="${esc(t('minus1'))}">−1</button>`+
          `<button type="button" class="dark" data-pixel-action="pixel-more" aria-label="${esc(t('plus1'))}">+1</button>`+
          `<button type="button" data-pixel-action="pixel-step" data-pixel-delta="10" aria-label="${esc(t('plus10'))}">+10</button></div>`+
        `<input type="range" class="ls-range c109-own-range" data-pixel-range min="0" max="${max}" step="1" value="${Math.min(v,max)}" style="--pixel-range-fill:${Math.round(Math.min(v,max)/max*100)}%" aria-label="${esc(t('count',{n:row.port}))}">`+
        `<div class="ls-scale" aria-hidden="true"><span>0</span><span>${max} ${esc(t('pixels'))}</span></div>`+
        // dezelfde onderdelen als het oude pixelscherm, zodat pixel-setup.js ongewijzigd kan bijwerken
        `<div class="ls-preview" data-pixel-preview aria-hidden="true"></div>`+
        `<p data-pixel-error class="pixel-setup-error" role="alert" hidden>Kies een heel aantal van 0 tot ${max} pixels.</p>`+
        `<p class="pixel-zero-hint" data-pixel-empty ${v===0?'':'hidden'}>Stel het aantal pixels in om verder te gaan.</p>`+
      `</section>`;
  }
  function paintRuler(panel,value){
    const z=panel?.querySelector?.('[data-ls-ruler]');if(!z)return;
    const tk=z.querySelector('[data-ls-rtrack]'),v=Number(value)||0,vf=z._lsFloat??v,w=z.clientWidth||z.getBoundingClientRect().width||0;
    tk.style.transform=`translateX(${(w/2-(vf-.5)*ZC).toFixed(1)}px)`;
    z.querySelector('[data-ls-rw]').style.width=`${Math.max(0,v-1)*ZC}px`;
    const r=z.querySelector('[data-ls-rr]');r.style.left=`${(v-1)*ZC}px`;r.style.display=v>0?'':'none';
    z.setAttribute('aria-valuenow',String(v));z.setAttribute('aria-valuetext',`${v} ${t('pixels')}`);
    const m=panel.querySelector('[data-ls-metres]');if(m)m.textContent=metres(v);
  }
  // Vegen over de liniaal (relatief: 14 px = 1 pixel), met uitlopen na een snelle veeg. Pijltjes: 1 pixel, PageUp/Down 10.
  function bindRuler(container,{onChange,onCommit=()=>{},isEnabled=()=>true,value=()=>0}={}){
    let drag=null,mom=0;
    const reduce=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}};
    const ruler=()=>container.querySelector('[data-ls-ruler]');
    const set=(z,vf)=>{const max=Number(z.dataset.max)||163;vf=Math.max(0,Math.min(max,vf));z._lsFloat=vf;const r=Math.round(vf);
      if(r!==value())onChange(r);else paintRuler(z.closest('[data-pixel-panel]'),r);return vf;};
    const rest=z=>{z._lsFloat=null;const tk=z.querySelector('[data-ls-rtrack]');if(tk&&!reduce()){tk.classList.add('snap');setTimeout(()=>tk.classList.remove('snap'),200);}
      paintRuler(z.closest('[data-pixel-panel]'),value());onCommit();};
    function down(e){const z=e.target.closest?.('[data-ls-ruler]');if(!z||!isEnabled()||e.button>0)return;e.preventDefault();cancelAnimationFrame(mom);
      try{z.setPointerCapture(e.pointerId);}catch(_){}drag={z,id:e.pointerId,x:e.clientX,v0:z._lsFloat??value(),hist:[[e.timeStamp,e.clientX]]};z.classList.add('is-dragging');}
    function move(e){if(!drag||e.pointerId!==drag.id)return;if(!isEnabled()){end(e);return;}set(drag.z,drag.v0-(e.clientX-drag.x)/ZC);
      drag.hist.push([e.timeStamp,e.clientX]);if(drag.hist.length>8)drag.hist.shift();}
    function end(e){if(!drag||e&&e.pointerId!==undefined&&e.pointerId!==drag.id)return;const z=drag.z,now=e?.timeStamp??performance.now(),h=drag.hist.filter(p=>now-p[0]<110),a=h[0],b=h[h.length-1];
      let vel=a&&b&&b[0]>a[0]?-(b[1]-a[1])/(b[0]-a[0])/ZC:0;z.classList.remove('is-dragging');drag=null;
      if(Math.abs(vel)>.012&&!reduce()&&isEnabled()){let last=performance.now();const max=Number(z.dataset.max)||163;
        const step=time=>{if(!z.isConnected||!isEnabled())return;const d=Math.min(48,time-last);last=time;vel*=Math.pow(.93,d/16);const nv=set(z,(z._lsFloat??value())+vel*d);
          if(Math.abs(vel)>.004&&nv>0&&nv<max)mom=requestAnimationFrame(step);else rest(z);};
        mom=requestAnimationFrame(step);}else rest(z);}
    function key(e){const z=e.target.closest?.('[data-ls-ruler]');if(!z||!isEnabled())return;const d={ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1,PageUp:10,PageDown:-10}[e.key];if(!d)return;
      e.preventDefault();const max=Number(z.dataset.max)||163,next=Math.max(0,Math.min(max,value()+d));if(next!==value()){onChange(next);onCommit();}}
    const resize=()=>{const z=ruler();if(z)paintRuler(z.closest('[data-pixel-panel]'),value());};
    container.addEventListener('pointerdown',down);container.addEventListener('pointermove',move);container.addEventListener('pointerup',end);container.addEventListener('pointercancel',end);
    container.addEventListener('keydown',key);addEventListener('resize',resize);
    return ()=>{cancelAnimationFrame(mom);container.removeEventListener('pointerdown',down);container.removeEventListener('pointermove',move);container.removeEventListener('pointerup',end);
      container.removeEventListener('pointercancel',end);container.removeEventListener('keydown',key);removeEventListener('resize',resize);};
  }

  // ---------- stap 1, klaar: pixels ingesteld ----------
  function review(rows,{colour,name=''}){
    return `<small class="ls-eyebrow">${esc(t('eyebrow',{name:name||'SPI'}))}</small><h2 class="ls-title">${esc(t('done'))}</h2><p class="ls-say">${t('doneSay')}</p>`+
      `<ul class="ls-sum">`+rows.map(row=>{const c=colour(row.port);
        return row.enabled
          ?`<li data-pixel-palette-port="${row.port}" style="--port-colour:${esc(c.hex)};--port-ink:${esc(c.ink)}">${sleeve('var(--port-colour)')}<span><b>${esc(t('ledline',{n:row.port}))}</b><small>${row.pixels} ${esc(t('pixels'))} · ${esc(metres(row.pixels))}</small></span><em class="ls-ok" aria-label="ingesteld">${CHECK}</em></li>`
          :`<li class="off" data-pixel-palette-port="${row.port}" style="--port-colour:${esc(c.hex)};--port-ink:${esc(c.ink)}">${sleeve('var(--port-colour)')}<span><b>${esc(t('ledline',{n:row.port}))}</b><small>${esc(t('off'))}</small></span><em class="ls-offb">${esc(t('offShort'))}</em></li>`;}).join('')+`</ul>`+
      `<div class="ls-card"><i aria-hidden="true">${PLUS}</i><p>${t('later')}</p></div><div class="ls-card"><i aria-hidden="true">${CHAIN}</i><p>${t('next2')}</p></div>`;
  }
  // de knoppen onderaan, met dezelfde acties als het oude scherm
  function button(action,label,{primary=false,icon:ic='',disabled=false,after=false}={}){
    return `<button type="button" class="${primary?'ls-primary':'ls-secondary'}" data-pixel-action="${action}"${disabled?' disabled':''}>${after?'':ic}<span>${esc(label)}</span>${after?ic:''}</button>`;}

  root.LightningLedlineSetup=Object.freeze({T,t,icon,head,outputs,pixels,review,paintRuler,bindRuler,button,ICONS:Object.freeze({CHECK,NEXT,BACK,PLUS,CHAIN})});
})(typeof globalThis!=='undefined'?globalThis:this);
