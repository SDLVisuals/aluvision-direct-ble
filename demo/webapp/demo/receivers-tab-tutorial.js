/* Aluvision: de tutorial van de Receivers-tab (14 nov herbouwd, de eigenaar: "er zitten daar nog een hoop bugs bij").
 * Zoals de zone-tutorials: een telefoon met de échte Receivers-tab (receivers-tutorial/index.html in een iframe, met
 * voorbeeldreceivers, zonder verbinding), een vinger die tikt en een gele ring die eerst toont waar. Ernaast de stand:
 * die knippert mee als je op knipperen tikt, en een ledline gaat er uit en weer aan.
 * Korte, rustige stappen:
 *   je receivers per zone · groen = verbonden · knipperen om hem te vinden · een receiver openen · de ledlines en hun
 *   pixels · één ledline laten knipperen · een ledline uit (twee tikken op de stekker) en weer aan (het plusje) ·
 *   Looprichting · Meer: een andere zone · een receiver toevoegen · waar je deze uitleg terugvindt.
 * Start nooit vanzelf: de knop "Bekijk tutorial" op de Receivers-tab opent ze. Hier gaat niets naar een receiver en
 * wordt niets bewaard behalve "al gezien". Overslaan, pauze (tik op het beeld), Opnieuw / Aan de slag; bij "beweging
 * beperken" stap voor stap met ‹ en ›.
 */
(function(){
const RxIntro=(()=>{
'use strict';
const KEY='aluvision.receiversTutorial.v2',LW=390,ABORT=Symbol('stop');
const reduce=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}};
const ICON_PAUSE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5.5h3.2v13H7.5zM13.3 5.5h3.2v13h-3.2z"/></svg>';
const ICON_PLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
const ICON_REPLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5"/></svg>';
const LAYOUT={land:{W:1000,H:700,stand:{x:18,y:110,w:586,h:440},label:{x:24,y:78},phone:{x:640,y:4,w:322,h:692}},
  port:{W:600,H:1000,stand:{x:22,y:34,w:556,h:162},label:{x:26,y:6},phone:{x:118,y:205,w:364,h:786}}};
// ---------- de stappen ----------
// say: de ondertitel · show: wat omcirkeld wordt · now: de eindtoestand (stap voor stap) · play: met vinger ·
// pre: stap voor stap, wat er vóór het omcirkelen moet gebeuren (de vellen dicht)
const page=c=>c.d.querySelector('dialog.rx-sheet[open][data-rx-receiver] .rx-panel');
const listTop=c=>{c.w.scrollTo({top:0,behavior:'smooth'});return c.wait(550);};
const STEPS=[
  {say:'Je receivers, per zone.',show:d=>d.querySelector('.rx-zone'),now(){},
    async play(c){await c.reveal(c.q('.rx-zone'),90);await c.show(c.q('.rx-zone'),2600);}},
  {say:'Groen: verbonden.',show:d=>d.querySelector('[data-rx-card=r1] .rx-dot')?.parentElement,now(){},
    async play(c){await c.show(c.q('[data-rx-card=r1] .rx-dot')?.parentElement,2200);}},
  {say:'Tik hier: de receiver knippert. Zo vind je hem.',show:d=>d.querySelector('[data-rx-card=r1] [data-action=visual-identify]'),
    now:c=>{if(!c.w.__rx.state().receivers[0].blinking)c.click('[data-rx-card=r1] [data-action=visual-identify]');},
    async play(c){await c.tapOn('[data-rx-card=r1] [data-action=visual-identify]');await c.wait(2600);
      await c.tapOn('[data-rx-card=r1] [data-action=visual-identify]');await c.wait(500);}},
  {say:'Tik op het tandwiel om hem te openen.',show:d=>d.querySelector('dialog.rx-sheet[open] .rx-panel'),
    now:c=>{if(c.w.__rx.state().receivers[0].blinking)c.click('[data-rx-card=r1] [data-action=visual-identify]');c.w.__rx.open('r1');},
    async play(c){await c.tapOn('[data-rx-open=r1]');await c.wait(1300);}},
  {say:'Elke ledline met haar aantal pixels.',show:d=>d.querySelector('dialog.rx-sheet[open] .rx-lines'),now(){},
    async play(c){await c.show(c.q('dialog.rx-sheet[open] .rx-lines'),2600);}},
  {say:'Tik op een ledline: ze knippert.',show:d=>d.querySelector('dialog.rx-sheet[open] .rx-line-light[data-port="2"]'),
    now:c=>c.click('dialog.rx-sheet[open] .rx-line-light[data-port="2"]'),
    async play(c){await c.tapOn('dialog.rx-sheet[open] .rx-line-light[data-port="2"]');await c.wait(2400);
      await c.tapOn('dialog.rx-sheet[open] .rx-line-light[data-port="2"]');await c.wait(400);}},
  {say:'Ledline uit: tik twee keer op de stekker.',show:d=>d.querySelector('dialog.rx-sheet[open] .rx-line[data-ports="3"]'),
    now:c=>{const l=c.w.__rx.state().receivers[0].lines[2];if(l.on){l.on=false;l.px=0;}const b=c.w.__rx.state().receivers[0].lines[1];b.blinking=false;c.w.__rx.render();},
    async play(c){const sel='dialog.rx-sheet[open] button.rx-line-unplug[data-port="3"]';
      await c.tapOn(sel);await c.wait(1100);await c.tapOn(sel);await c.wait(1500);
      await c.show(c.q('dialog.rx-sheet[open] button.rx-line.off[data-ports="3"]'),1300);}},
  {say:'Weer aan: tik op het plusje en kies de pixels.',show:d=>d.querySelector('dialog.rx-sheet[open] .rx-line[data-ports="3"]'),
    now:c=>{const l=c.w.__rx.state().receivers[0].lines[2];l.on=true;l.px=96;c.w.__rx.render();},
    async play(c){await c.tapOn('dialog.rx-sheet[open] button.rx-line.off[data-ports="3"]');await c.wait(2200);
      await c.show(c.q('dialog.rx-sheet[open] .rx-line[data-ports="3"]'),1400);}},
  {say:'Looprichting: in welke volgorde het licht loopt.',show:d=>d.querySelector('dialog.rx-sheet[open] [data-rx=order]'),now(){},
    async play(c){await c.show(c.q('dialog.rx-sheet[open] [data-rx=order]'),2800);}},
  {say:'Andere zone? Tik op Meer, dan Zone.',show:d=>d.querySelector('dialog.rx-sheet[open] [data-rx=more]'),
    now:c=>{c.click('dialog.rx-sheet[open] [data-rx=more]');c.click('dialog.rx-moresheet[open] [data-rx=zone]');},
    async play(c){await c.tapOn('dialog.rx-sheet[open] [data-rx=more]');await c.wait(1000);
      await c.tapOn('dialog.rx-moresheet[open] [data-rx=zone]');await c.wait(1100);
      const picks=c.q('dialog.rx-sheet[open] .rx-zpicks')||c.q('dialog.rx-sheet[open] .rx-zopts');await c.show(picks,2600);}},
  {say:'Nieuwe receiver? Tik hier.',show:d=>d.querySelector('#main [data-action=receiver-add]'),pre:c=>{c.w.__rx.closeAll();c.w.scrollTo(0,0);},now:c=>{c.w.__rx.closeAll();c.w.scrollTo(0,0);},
    async play(c){c.w.__rx.closeAll();await c.wait(700);await listTop(c);await c.show(c.q('#main [data-action=receiver-add]'),2600);}},
  {say:'Deze uitleg vind je hier altijd terug.',show:d=>d.querySelector('#main [data-rx=intro]'),now:c=>c.q('#main [data-rx=intro]')?.scrollIntoView({block:'center'}),
    async play(c){const b=c.q('#main [data-rx=intro]');await c.reveal(b,420);await c.show(b,2600);}}];
const FINAL=['Zo werk je met je receivers.','Tik op een receiver om te beginnen.'];
// ---------- de schil (dezelfde als de zone-tutorials) ----------
let root=null,frame=null,L=null,G=null,layoutName='',run=0,paused=false,staticMode=false,step=0,raf=0,ro=null,t0=0;
function shell(){
  const el=document.createElement('div');el.className='ki rxi';el.hidden=true;
  el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Tutorial: je receivers');
  el.innerHTML=`<div class="ki-top"><img src="assets/aluvision-logo.png" alt="Aluvision"><b>Tutorial</b><button type="button" class="ki-btn" data-ki="skip">Overslaan</button></div>`+
    `<div class="ki-box" data-ki-box><div class="ki-fit" data-ki-fit></div></div>`+
    `<div class="ki-subs" aria-hidden="true">${STEPS.map((s,i)=>`<p class="ki-sub" data-sub="${i}">${s.say}</p>`).join('')}<p class="ki-sub final" data-sub="final">${FINAL[0]}<span>${FINAL[1]}</span></p></div><p class="ki-sr" data-ki-sr aria-live="polite"></p>`+
    `<div class="ki-bottom"><button type="button" class="ki-btn hk-pause" data-ki="pause" aria-label="Pauzeren">${ICON_PAUSE}</button><div class="ki-progress" data-ki-progress><i></i></div>`+
    `<div class="ki-steps" data-ki-steps hidden><button type="button" class="ki-btn" data-ki="prev" aria-label="Vorige stap">‹</button><span class="ki-dots">${'<i></i>'.repeat(STEPS.length)}</span><button type="button" class="ki-btn" data-ki="next" aria-label="Volgende stap">›</button></div>`+
    `<div class="ki-end" data-ki-end hidden><button type="button" class="ki-btn" data-ki="replay">${ICON_REPLAY}Opnieuw</button><button type="button" class="ki-btn primary" data-ki="close">Aan de slag</button></div></div>`;
  el.addEventListener('click',e=>{const b=e.target.closest('[data-ki]');if(!b)return;({skip:close,close,replay:()=>begin(0),prev:()=>go(step-1),next:()=>go(step+1),pause:togglePause})[b.dataset.ki]?.();});
  el.querySelector('[data-ki-box]').addEventListener('click',()=>togglePause());
  el.addEventListener('keydown',e=>{if(staticMode&&e.key==='ArrowRight')go(step+1);else if(staticMode&&e.key==='ArrowLeft')go(step-1);});
  // een eigen <dialog>, zodat de tutorial boven de pagina en haar vensters ligt
  const dialog=document.createElement('dialog');dialog.className='ki-dialog';dialog.setAttribute('aria-label','Tutorial: je receivers');
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  dialog.append(el);document.body.append(dialog);return el;}
function pickLayout(box){const subs=root.querySelector('.ki-subs'),h=box.clientHeight+(subs?subs.offsetHeight-104:0);return box.clientWidth/Math.max(1,h)>=1.05?'land':'port';}
function build(){
  const bx=root.querySelector('[data-ki-box]'),fit=root.querySelector('[data-ki-fit]'),bw=bx.clientWidth,bh=bx.clientHeight;
  layoutName=pickLayout(bx);L=LAYOUT[layoutName];root.dataset.layout=layoutName;
  fit.style.width=L.W+'px';fit.style.height=L.H+'px';fit.style.setProperty('--ki-scale',Math.min(bw/L.W,bh/L.H).toFixed(4));
  const p=L.phone,bz=+(p.w*.024).toFixed(1),sw=p.w-2*bz,sh=p.h-2*bz,R=p.w*.155,stH=+(sw*.118).toFixed(1),hmH=+(sw*.07).toFixed(1),sc=sw/LW,lh=(sh-stH-hmH)/sc;
  G={x:p.x+bz,y:p.y+bz+stH,sc};
  const status=`<div class="rti-status" style="height:${stH}px;font-size:${(sw*.04).toFixed(1)}px"><b>9:41</b><span>`+
    `<svg viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx=".7"/><rect x="5" y="5.5" width="3" height="6.5" rx=".7"/><rect x="10" y="3" width="3" height="9" rx=".7"/><rect x="15" y="0" width="3" height="12" rx=".7"/></svg>`+
    `<svg viewBox="0 0 27 13" aria-hidden="true"><rect x=".6" y=".6" width="22.8" height="11.8" rx="3.6" fill="none" stroke-width="1.1" opacity=".45"/><rect x="2.3" y="2.3" width="19.4" height="8.4" rx="2.2"/></svg></span></div>`;
  const s=L.stand;
  fit.innerHTML=`<b class="rxi-label" style="left:${L.label.x}px;top:${L.label.y}px">Je stand</b><div class="rxi-stand" style="left:${s.x}px;top:${s.y}px;width:${s.w}px;height:${s.h}px"><canvas data-rxi-stand></canvas></div>`+
    `<div class="rti" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px"><i class="rti-b l" style="top:18%;height:4%"></i><i class="rti-b l" style="top:25.5%;height:7.5%"></i><i class="rti-b l" style="top:34.5%;height:7.5%"></i><i class="rti-b r" style="top:27%;height:11.5%"></i>`+
    `<div class="rti-body" style="border-radius:${R.toFixed(1)}px"><div class="rti-screen" style="inset:${bz}px;border-radius:${(R-bz).toFixed(1)}px">${status}`+
    `<iframe class="rxi-frame" data-rxi-frame title="De Receivers-tab in de tutorial" tabindex="-1" aria-hidden="true" style="top:${stH}px;width:${LW}px;height:${lh.toFixed(1)}px;transform:scale(${sc.toFixed(4)})"></iframe>`+
    `<i class="rti-island" style="top:${(sw*.026).toFixed(1)}px;width:${(sw*.29).toFixed(1)}px;height:${(sw*.085).toFixed(1)}px"></i><i class="rti-home" style="bottom:${(hmH*.32).toFixed(1)}px;width:${(sw*.36).toFixed(1)}px"></i></div></div></div>`+
    `<i class="rxi-ring" data-rxi-ring></i><i class="ki-finger rxi-finger" data-rxi-finger></i>`;
  frame=fit.querySelector('[data-rxi-frame]');LightningTutorialFrame.fill(frame,'receivers-tutorial','?tut=1');}
// ---------- de stand: wat de telefoon nu doet, op de leds ----------
// Balie: één SPI-receiver met zijn ledlines in de kleur van hun poort. Achterwand: twee RGBW-receivers, elk één paneel.
// Knippert een receiver of één ledline, dan knippert dat hier ook. Een ledline die uit staat, is donker.
function drawStand(){raf=0;if(!root||root.hidden)return;const cv=root.querySelector('[data-rxi-stand]'),S=frame?.contentWindow?.__rx?.state?.();
  if(cv&&S){const box=cv.parentElement,dpr=Math.min(2,window.devicePixelRatio||1),W=box.clientWidth,H=box.clientHeight;
    if(cv.width!==Math.round(W*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
    const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
    const t=reduce()?0:(performance.now()-t0)/1000,blinkOn=Math.floor(t*2.4)%2===0,land=W/H>2.2?false:true;
    const label=(txt,x,y)=>{g.fillStyle='#8e8c87';g.font='800 13px system-ui,-apple-system,sans-serif';g.fillText(txt.toUpperCase(),x,y);};
    const bar=(x,y,w,h,col,on)=>{g.fillStyle='#1d1e22';g.fillRect(x,y,w,h);if(!on)return;g.save();g.shadowColor=col;g.shadowBlur=14;g.fillStyle=col;g.fillRect(x,y,w,h);g.restore();};
    const spi=S.receivers.find(r=>r.type==='spi'),rgbw=S.receivers.filter(r=>r.type==='rgbw');
    const pad=22,colW=land?W-2*pad:(W-3*pad)/2;
    // Balie
    let x=pad,y=land?36:30;label('Balie',x,y-10);
    const lines=spi?.lines||[],lh=land?16:8,gap=land?26:13;
    lines.forEach((l,i)=>{const on=l.on&&(!spi.blinking||blinkOn)&&(!l.blinking||blinkOn),len=l.on?Math.max(.25,l.px/120):1;
      bar(x,y+i*gap,colW*len,lh,l.hex,on);});
    // Achterwand
    if(land){y=y+lines.length*gap+44;}else{x=pad*2+colW;y=30;}
    label('Achterwand',x,y-10);
    const pw=(colW-14)/2,ph=Math.min(land?70:H-y-pad,H-y-pad);
    rgbw.forEach((r,i)=>{const on=!r.blinking||blinkOn;g.fillStyle='#1d1e22';g.fillRect(x+i*(pw+14),y,pw,ph);
      if(on){g.save();g.shadowColor='#fff1d6';g.shadowBlur=16;g.fillStyle='#f6ead2';g.fillRect(x+i*(pw+14),y,pw,ph);g.restore();}});}
  raf=requestAnimationFrame(drawStand);}
// ---------- vinger, ring en wachten (met pauze en stoppen) ----------
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(my,ms){let left=ms;while(left>0){if(my!==run)throw ABORT;await sleep(Math.min(60,left));if(!paused)left-=60;}if(my!==run)throw ABORT;}
function ctx(my){const fit=root.querySelector('[data-ki-fit]'),finger=fit.querySelector('[data-rxi-finger]'),ringEl=fit.querySelector('[data-rxi-ring]'),w=frame.contentWindow,d=w.document;
  const c={w,d,q:sel=>d.querySelector(sel),wait:ms=>wait(my,ms),
    pt:(x,y)=>[G.x+x*G.sc,G.y+y*G.sc],
    center(el){const r=el.getBoundingClientRect();return c.pt(r.left+r.width/2,r.top+r.height/2);},
    async move(x,y,ms=900){finger.style.transitionDuration=ms+'ms';finger.style.left=x+'px';finger.style.top=y+'px';finger.style.opacity='1';await c.wait(ms);},
    async press(on){finger.classList.toggle('is-press',on);await c.wait(220);},
    async ring(el){if(!el){ringEl.classList.remove('is-on');return;}const r=el.getBoundingClientRect(),[x,y]=c.pt(r.left,r.top),pad=6;
      Object.assign(ringEl.style,{left:x-pad+'px',top:y-pad+'px',width:r.width*G.sc+2*pad+'px',height:r.height*G.sc+2*pad+'px'});ringEl.classList.add('is-on');await c.wait(250);},
    // in beeld brengen: in een open vel scrolt het vel, anders de lijst (boven de onderbalk)
    async reveal(el,offset=150){if(!el)return;const panel=el.closest('.rx-panel');
      if(panel){const r=el.getBoundingClientRect(),pr=panel.getBoundingClientRect();if(r.top<pr.top+20||r.bottom>pr.bottom-20){panel.scrollTo({top:Math.max(0,panel.scrollTop+r.top-pr.top-offset),behavior:'smooth'});await c.wait(650);}return;}
      const r=el.getBoundingClientRect(),nav=(d.querySelector('nav')?.getBoundingClientRect().top||w.innerHeight)-16;
      if(r.top<70||r.bottom>nav){w.scrollTo({top:Math.max(0,w.scrollY+r.top-offset),behavior:'smooth'});await c.wait(650);}},
    // tikken: eerst omcirkelen (zo zie je waar), dan schuift de vinger erheen en tikt
    async tapOn(sel){let el=d.querySelector(sel);if(!el)return;await c.reveal(el);el=d.querySelector(sel)||el;await c.ring(el);await c.wait(800);
      await c.move(...c.center(el),900);await c.press(true);el.click();await c.press(false);await c.wait(300);await c.ring(null);},
    async show(el,ms=2000){if(!el)return;await c.reveal(el);await c.ring(el);await c.wait(ms);await c.ring(null);},
    click(sel){d.querySelector(sel)?.click();}};
  return c;}
async function ready(my){for(let k=0;k<200;k++){const w=frame?.contentWindow;if(w&&w.__rx&&w.document.querySelector('.rx-card'))return;await wait(my,60);}throw ABORT;}
// ---------- afspelen ----------
function say(i){root.querySelectorAll('.ki-sub').forEach(p=>p.classList.toggle('is-on',p.dataset.sub===String(i)));const sr=root.querySelector('[data-ki-sr]');if(sr)sr.textContent=i==='final'?FINAL[0]:STEPS[i]?.say||'';}
function progress(f){const i=root.querySelector('[data-ki-progress]>i');if(i)i.style.transform=`scaleX(${Math.max(0,Math.min(1,f))})`;}
function setEnd(on){root.querySelector('[data-ki-end]').hidden=!on;root.querySelector('[data-ki="skip"]').hidden=on;root.querySelector('[data-ki-progress]').hidden=on||staticMode;
  root.querySelector('[data-ki="pause"]').hidden=on||staticMode;if(on)root.querySelector('[data-ki="close"]').focus({preventScroll:true});}
function setPaused(p){paused=p;const b=root.querySelector('[data-ki="pause"]');b.innerHTML=p?ICON_PLAY:ICON_PAUSE;b.setAttribute('aria-label',p?'Verder afspelen':'Pauzeren');root.classList.toggle('is-paused',p);}
function togglePause(){if(staticMode||!root.querySelector('[data-ki-end]').hidden)return;setPaused(!paused);}
async function start(c){c.w.__rx.reset();await c.wait(400);}
async function play(from){const my=++run;setEnd(false);setPaused(false);try{await ready(my);const c=ctx(my);await start(c);
  for(let k=0;k<from;k++){STEPS[k].now(c);await c.wait(150);}
  for(let k=from;k<STEPS.length;k++){step=k;say(k);progress(k/STEPS.length);await c.wait(800);await STEPS[k].play(c);await c.ring(null);await c.wait(1100);}
  await c.ring(null);root.querySelector('[data-rxi-finger]').style.opacity='0';progress(1);say('final');setEnd(true);}catch(e){if(e!==ABORT)console.warn('receivers-tutorial',e);}}
// stap voor stap (beweging beperken): de eindtoestand van de vorige stappen, met de ring op de plek
async function go(i){step=Math.max(0,Math.min(STEPS.length-1,i));const my=++run;
  root.querySelectorAll('.ki-dots i').forEach((d,j)=>d.classList.toggle('on',j===step));root.querySelector('[data-ki="prev"]').disabled=step===0;
  try{await ready(my);const c=ctx(my);await start(c);for(let k=0;k<step;k++){STEPS[k].now(c);await c.wait(200);}STEPS[step].pre?.(c);await c.wait(350);
    const el=STEPS[step].show(c.d);say(step);if(el){await c.reveal(el);await c.ring(el);}
    const last=step===STEPS.length-1;root.querySelector('[data-ki-steps]').hidden=last;setEnd(last);}catch(e){if(e!==ABORT)console.warn('receivers-tutorial',e);}}
function begin(from){build();t0=performance.now();root.querySelector('[data-ki-steps]').hidden=!staticMode;root.querySelector('[data-ki-progress]').hidden=staticMode;root.querySelector('[data-ki="pause"]').hidden=staticMode;
  if(!raf)raf=requestAnimationFrame(drawStand);if(staticMode)go(from);else play(from);}
function refit(){if(!root||root.hidden)return;const bx=root.querySelector('[data-ki-box]'),want=pickLayout(bx);
  if(want!==layoutName){begin(step);return;}root.querySelector('[data-ki-fit]').style.setProperty('--ki-scale',Math.min(bx.clientWidth/L.W,bx.clientHeight/L.H).toFixed(4));}
function open(){if(!root)root=shell();staticMode=reduce();step=0;root.hidden=false;document.documentElement.classList.add('ki-open');
  const dialog=root.parentElement;if(dialog&&!dialog.open){try{dialog.showModal();}catch(_){dialog.setAttribute('open','');}}
  if(!ro&&typeof ResizeObserver==='function'){ro=new ResizeObserver(()=>refit());ro.observe(root.querySelector('[data-ki-box]'));}
  requestAnimationFrame(()=>{begin(0);root.querySelector('[data-ki="skip"]').focus({preventScroll:true});});}
function close(){run++;cancelAnimationFrame(raf);raf=0;if(root){root.hidden=true;root.querySelector('[data-ki-fit]').innerHTML='';const dialog=root.parentElement;if(dialog?.open)dialog.close();}frame=null;
  document.documentElement.classList.remove('ki-open');try{localStorage.setItem(KEY,'1');}catch(_){}
  document.querySelector('[data-rx=intro]')?.focus({preventScroll:true});}
return {open,close,seenBefore:()=>{try{return localStorage.getItem(KEY)==='1';}catch(_){return false;}}};
})();
window.LightningReceiversTutorial=Object.freeze({open:RxIntro.open,close:RxIntro.close,seen:RxIntro.seenBefore});
})();
