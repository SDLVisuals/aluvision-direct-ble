/* In de app (C250): de tutorials van de nieuwe zonepagina, uit prototypes/zone-facelift/tutorial.js. De telefoon toont
 * zone-tutorial/index.html (een kopie van de zonepagina uit het prototype, met eigen opslag, zonder verbinding).
 */
/* De tutorials van de zonepagina (C147p; 13 nov 2026 herwerkt op de nieuwe zonepagina). Drie tutorials:
 *   spi   eenvoudig, voor een SPI-zone: het voorbeeld, een kleur, + Verloop, Animaties (meteen alle), er één kiezen,
 *         Horizontaal of Verticaal, de snelheid, het tandwiel, en waar je de uitleg terugvindt;
 *   rgbw  eenvoudig, voor een RGBW-zone: het voorbeeld, een kleur, één receiver aantikken, een animatie, looplicht,
 *         Verticaal, het tandwiel;
 *   pro   gevorderd: een looplicht op een SPI-zone, de richting, de snelheid, en Eigen timing (wanneer elke ledline
 *         aangaat: het ritme tikken, snel instellen, hoe lang een ronde duurt).
 * Een tutorial start nooit vanzelf: de eerste keer vraagt de pagina het (tutorial-ask.js van de app), daarna is er de
 * knop in het tandwiel. De telefoon toont de échte zonepagina (deze pagina in een iframe, ?tut=1, met eigen opslag): wat
 * je ziet, is wat je in de app krijgt. Een vinger tikt en sleept; een ring toont waar. De stand ernaast toont hetzelfde
 * licht. Dezelfde schil als de andere tutorials (ki-*): Overslaan, pauze (tik op het beeld), voortgang, Opnieuw /
 * Aan de slag; bij "beweging beperken" stap voor stap met ‹ en ›.
 */
window.ZfIntro=(()=>{
'use strict';
const KEY='zf-c147p-uitleg-',LW=350,ABORT=Symbol('stop');
const reduce=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}};
const ICON_PAUSE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5.5h3.2v13H7.5zM13.3 5.5h3.2v13h-3.2z"/></svg>';
const ICON_PLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
const ICON_REPLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5"/></svg>';
// de telefoon groot genoeg om te zien wat er gebeurt; de stand ernaast (de eigenaar 14 nov)
const LAYOUT={land:{W:1000,H:700,stand:{x:18,y:110,w:586,h:440},label:{x:24,y:78},phone:{x:640,y:4,w:322,h:692}},
  port:{W:600,H:1000,stand:{x:22,y:34,w:556,h:162},label:{x:26,y:6},phone:{x:118,y:205,w:364,h:786}}};
// ---------- de stappen ----------
// say: de ondertitel (kort) · show: waar de omcirkeling staat (ook stap voor stap) · now: de eindtoestand · play: met vinger
const top=c=>{c.w.scrollTo({top:0,behavior:'smooth'});return c.wait(550);};
const wheelDrag=async(c,R0=205,turn=4.6)=>{const wh=c.q('[data-wheel]');await c.reveal(wh,150);await c.ring(wh);await c.wait(800);
  const C=c.w.LightningColour,R=260,pts=[];for(let k=0;k<=26;k++){const a=(R0+k*turn)*Math.PI/180;pts.push([130+Math.cos(a)*100,130+Math.sin(a)*100]);}
  const at=([x,y])=>{const r=wh.getBoundingClientRect();return c.pt(r.left+x/R*r.width,r.top+y/R*r.height);};
  await c.move(...at(pts[0]),900);await c.press(true);
  for(const p of pts){c.w.__zf.setColour(C.hex(C.fromPoint(p[0],p[1],R)));await c.move(...at(p),95);}
  await c.press(false);await c.ring(null);await top(c);await c.show(c.q('.zf-stage'),1300);};
const pick=async(c,id,offset=230)=>{const sel=`[data-libinline] [data-choose="${id}"]`;await c.reveal(c.q(sel),offset);await c.tapOn(sel);await c.wait(500);await top(c);await c.show(c.q('.zf-stage'),1600);};
const tunnelOf=(c,type)=>c.w.__zf.CATALOG[type].find(e=>e.category==='tunnel')?.id;
const ending=say=>[
  {say,show:d=>d.querySelector('.zf-gearsheet .zf-panel'),now:c=>c.w.__zf.openGear(),
    async play(c){await top(c);await c.tapOn('[data-action=gear]');await c.wait(1000);await c.show(c.q('.zf-gearsheet .zf-panel'),2400);}},
  {say:'Deze uitleg vind je hier altijd terug.',show:d=>d.querySelector('.zf-tutrow'),now:c=>{const p=c.q('.zf-gearsheet .zf-panel');if(p)p.scrollTop=9999;},
    async play(c){const p=c.q('.zf-gearsheet .zf-panel');if(p)p.scrollTo({top:p.scrollHeight,behavior:'smooth'});await c.wait(900);await c.show(c.q('.zf-tutrow'),2600);}}];
// gevorderd: hetzelfde verhaal voor SPI (ledlines) en RGBW (receivers)
const proSteps=(type,word,count)=>[
  {say:`Een looplicht loopt van ${word} naar ${word}.`,show:d=>d.querySelector('.zf-stage'),now:c=>{c.w.__zf.setTab('anim');c.w.__zf.choose(tunnelOf(c,type));},
    async play(c){await top(c);await c.tapOn('[data-tab=anim]');await c.wait(800);await c.reveal(c.q('[data-libinline] [data-g=tunnel]'),240);
      await c.tapOn('[data-libinline] [data-g=tunnel]');await c.wait(700);await c.show(c.q('[data-libinline] .zf-loophead'),1600);await pick(c,tunnelOf(c,type),260);}},
  {say:'Kies de richting.',show:d=>d.querySelector('.zf-run .zf-dirs'),now:c=>c.click('.zf-run [data-dir]:not([aria-pressed=true])'),
    async play(c){await c.reveal(c.q('.zf-run'),190);await c.tapOn('.zf-run [data-dir]:not([aria-pressed=true])');await c.wait(600);await top(c);await c.show(c.q('.zf-stage'),1500);}},
  {say:'Open Geavanceerd en kies Eigen timing.',show:d=>d.querySelector('.zf-adv .zf-morebody'),
    now:c=>{const a=c.q('.zf-adv');if(a)a.open=true;c.click('[data-advtab=seq]');if(c.q('[data-action=seqon]')?.getAttribute('aria-checked')!=='true')c.click('[data-action=seqon]');},
    async play(c){await c.reveal(c.q('.zf-adv'),200);await c.tapOn('.zf-adv summary');await c.wait(700);await c.tapOn('[data-advtab=seq]');await c.wait(700);
      if(c.q('[data-action=seqon]')?.getAttribute('aria-checked')!=='true'){await c.tapOn('[data-action=seqon]');await c.wait(600);}await c.show(c.q('.zf-adv .zf-morebody'),1400);}},
  {say:`Tik het ritme: één tik per ${word}.`,show:d=>d.querySelector('[data-seqtap]'),now:c=>c.click('.zf-adv [data-action=seq]'),
    async play(c){await c.reveal(c.q('.zf-adv [data-action=seq]'),220);await c.tapOn('.zf-adv [data-action=seq]');await c.wait(1200);
      const t=c.q('[data-seqtap]');await c.ring(t);await c.wait(700);await c.move(...c.center(t),900);
      for(let k=0;k<count;k++){await c.press(true);t.click();await c.press(false);await c.wait(k===count-3?1000:420);}await c.wait(1200);await c.ring(null);}},
  {say:'Of kies snel een ritme.',show:d=>d.querySelector('.zf-seqpresets'),now:c=>c.click('[data-seqpreset=pairs]'),
    async play(c){await c.reveal(c.q('.zf-seqpresets'),200);await c.show(c.q('.zf-seqpresets'),1200);await c.tapOn('[data-seqpreset=pairs]');await c.wait(1800);}},
  {say:'Hoe lang duurt één ronde? Schuif het bij.',show:d=>d.querySelector('#zf-seqdur'),now:c=>c.slide('#zf-seqdur',3),
    async play(c){const inp=c.q('#zf-seqdur');await c.reveal(inp,220);await c.drag(inp,3);await c.ring(null);await c.wait(1300);}},
  {say:'Tik op Klaar: je eigen timing speelt.',show:d=>d.querySelector('.zf-stage'),now:c=>c.click('.zf-seqpage .zf-pageback'),
    async play(c){const b=c.q('.zf-seqpage .zf-pageback');await c.reveal(b,320);await c.tapOn('.zf-seqpage .zf-pageback');await c.wait(900);await top(c);await c.show(c.q('.zf-stage'),2000);}},
  {say:`Horen ${word==='ledline'?'ledlines':'receivers'} bij elkaar? Voeg ze samen onder het tandwiel.`,show:d=>d.querySelector('.zf-gearsheet [data-joinsec]'),
    now:c=>{c.w.__zf.openGear();const j=c.q('.zf-gearsheet [data-joinsec]');if(j)j.scrollIntoView({block:'center'});},
    async play(c){await top(c);await c.tapOn('[data-action=gear]');await c.wait(1000);const j=c.q('.zf-gearsheet [data-joinsec]');await c.reveal(j,120);await c.wait(1200);
      await c.tapOn('.zf-gearsheet [data-jpick="0"]');await c.tapOn('.zf-gearsheet [data-jpick="1"]');await c.wait(500);await c.tapOn('.zf-gearsheet [data-joinsel]');await c.wait(1300);
      await c.show(c.q('.zf-gearsheet .zf-jlist'),2200);}}];
const SCRIPTS={
  spi:{title:'Tutorial: je SPI-zone',zone:'flex',final:['Zo werk je met je zone.','Kies een kleur of een animatie om te beginnen.'],steps:[
    {say:'Bovenaan zie je je ledlines, live.',show:d=>d.querySelector('.zf-stage'),now(){},async play(c){await c.show(c.q('.zf-stage'),2600);}},
    {say:'Kies een kleur. Je stand kleurt mee.',show:d=>d.querySelector('.wheel-wrap'),now:c=>c.w.__zf.setColour('#9B4DFF'),play:c=>wheelDrag(c)},
    {say:'Tik op + Verloop voor een tweede kleur.',show:d=>d.querySelector('[data-rail]'),now:c=>c.click('[data-action=addcol]'),
      async play(c){await top(c);await c.tapOn('[data-action=addcol]');await c.wait(700);await c.show(c.q('[data-rail]'),2000);}},
    {say:'Tik op Animaties: alles staat klaar.',show:d=>d.querySelector('[data-libinline]'),now:c=>c.w.__zf.setTab('anim'),
      async play(c){await top(c);await c.tapOn('[data-tab=anim]');await c.wait(900);await c.show(c.q('[data-libinline]'),2200);}},
    {say:'Tik er één aan. Ze speelt meteen.',show:d=>d.querySelector('.zf-stage'),now:c=>{c.w.__zf.setTab('anim');c.w.__zf.choose('spi-wave-29');},play:c=>pick(c,'spi-wave-29')},
    {say:'Staan je ledlines rechtop? Kies Verticaal.',show:d=>d.querySelector('.zf-dock [data-viewto=verticaal]'),now:c=>c.click('.zf-dock [data-viewto=verticaal]'),
      async play(c){await top(c);await c.tapOn('.zf-dock [data-viewto=verticaal]');await c.wait(600);await c.show(c.q('.zf-stage'),1800);}},
    ...ending('Meer instellingen vind je onder het tandwiel.')]},
  rgbw:{title:'Tutorial: je RGBW-zone',zone:'tunnel',final:['Zo werk je met je RGBW-zone.','Kies een kleur of een animatie om te beginnen.'],steps:[
    {say:'Bovenaan zie je je receivers, live.',show:d=>d.querySelector('.zf-stage'),now(){},async play(c){await c.show(c.q('.zf-stage'),2600);}},
    {say:'Kies een kleur. Alle receivers kleuren mee.',show:d=>d.querySelector('.wheel-wrap'),now:c=>c.w.__zf.setColour('#FF5E3A'),play:c=>wheelDrag(c,330,3.4)},
    {say:'Tik een receiver aan en kies een andere kleur.',show:d=>d.querySelector('.zf-stage .v50-preview-line-target[data-select="1"]'),
      now:c=>{c.w.__zf.select([1]);c.w.__zf.setColour('#1FC45B');},
      async play(c){await top(c);await c.tapOn('.zf-stage .v50-preview-line-target[data-select="1"]');await c.wait(600);await wheelDrag(c,95,4);}},
    {say:'Tik op Alle om weer alles te kiezen.',show:d=>d.querySelector('.zf-stage [data-select=all]'),now:c=>c.click('.zf-stage [data-select=all]'),
      async play(c){await top(c);await c.tapOn('.zf-stage [data-select=all]');await c.wait(1400);}},
    {say:'Tik op Animaties en kies er één.',show:d=>d.querySelector('.zf-stage'),now:c=>{c.w.__zf.setTab('anim');c.w.__zf.choose('rgbw-breathe-1');},
      async play(c){await top(c);await c.tapOn('[data-tab=anim]');await c.wait(900);await pick(c,'rgbw-breathe-1');}},
    {say:'Staan ze rechtop? Kies Verticaal.',show:d=>d.querySelector('.zf-dock [data-viewto=verticaal]'),now:c=>c.click('.zf-dock [data-viewto=verticaal]'),
      async play(c){await top(c);await c.tapOn('.zf-dock [data-viewto=verticaal]');await c.wait(600);await c.show(c.q('.zf-stage'),1800);}},
    ...ending('Volgorde en meer vind je onder het tandwiel.')]},
  pro:{title:'Tutorial: looplicht en timing (SPI)',zone:'flex',final:['Zo maak je je eigen looplicht.','Probeer het ritme van je stand.'],steps:proSteps('SPI','ledline',5)},
  prorgbw:{title:'Tutorial: looplicht en timing (RGBW)',zone:'tunnel',final:['Zo maak je je eigen looplicht.','Probeer het ritme van je stand.'],steps:proSteps('RGBW','receiver',3)}};
let KIND='spi',STEPS=SCRIPTS.spi.steps;
// ---------- de schil (dezelfde als de andere tutorials) ----------
let root=null,frame=null,L=null,G=null,layoutName='',run=0,paused=false,staticMode=false,step=0,raf=0,ro=null,t0=0;
function shell(){
  const el=document.createElement('div');el.className='ki zfi';el.hidden=true;el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label',SCRIPTS[KIND].title);el.dataset.kind=KIND;
  el.innerHTML=`<div class="ki-top"><img src="assets/aluvision-logo.png" alt="Aluvision"><b>Tutorial</b><button type="button" class="ki-btn" data-ki="skip">Overslaan</button></div>`+
    `<div class="ki-box" data-ki-box><div class="ki-fit" data-ki-fit></div></div>`+
    `<div class="ki-subs" aria-hidden="true">${STEPS.map((s,i)=>`<p class="ki-sub" data-sub="${i}">${s.say}</p>`).join('')}<p class="ki-sub final" data-sub="final">${SCRIPTS[KIND].final[0]}<span>${SCRIPTS[KIND].final[1]}</span></p></div><p class="ki-sr" data-ki-sr aria-live="polite"></p>`+
    `<div class="ki-bottom"><button type="button" class="ki-btn hk-pause" data-ki="pause" aria-label="Pauzeren">${ICON_PAUSE}</button><div class="ki-progress" data-ki-progress><i></i></div>`+
    `<div class="ki-steps" data-ki-steps hidden><button type="button" class="ki-btn" data-ki="prev" aria-label="Vorige stap">‹</button><span class="ki-dots">${'<i></i>'.repeat(STEPS.length)}</span><button type="button" class="ki-btn" data-ki="next" aria-label="Volgende stap">›</button></div>`+
    `<div class="ki-end" data-ki-end hidden><button type="button" class="ki-btn" data-ki="replay">${ICON_REPLAY}Opnieuw</button><button type="button" class="ki-btn primary" data-ki="close">Aan de slag</button></div></div>`;
  el.addEventListener('click',e=>{const b=e.target.closest('[data-ki]');if(!b)return;({skip:close,close,replay:()=>begin(0),prev:()=>go(step-1),next:()=>go(step+1),pause:togglePause})[b.dataset.ki]?.();});
  el.querySelector('[data-ki-box]').addEventListener('click',()=>togglePause());
  el.addEventListener('keydown',e=>{if(e.key==='Escape')close();else if(staticMode&&e.key==='ArrowRight')go(step+1);else if(staticMode&&e.key==='ArrowLeft')go(step-1);});
  document.body.append(el);return el;}
// de telefoon met de echte pagina; de stand ernaast
// Liggend of staand. Gemeten op beeld + ondertitel samen: die som verandert niet met de indeling. (De ondertitel is
// staand 16 px hoger; kiezen op het beeld alleen kon op de grens blijven wisselen, en dan herbegon de animatie telkens.)
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
  fit.innerHTML=`<b class="zfi-label" style="left:${L.label.x}px;top:${L.label.y}px">Je stand</b><div class="zfi-stand" style="left:${s.x}px;top:${s.y}px;width:${s.w}px;height:${s.h}px"><canvas data-zfi-stand></canvas></div>`+
    `<div class="rti zfi-phone" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px"><i class="rti-b l" style="top:18%;height:4%"></i><i class="rti-b l" style="top:25.5%;height:7.5%"></i><i class="rti-b l" style="top:34.5%;height:7.5%"></i><i class="rti-b r" style="top:27%;height:11.5%"></i>`+
    `<div class="rti-body" style="border-radius:${R.toFixed(1)}px"><div class="rti-screen" style="inset:${bz}px;border-radius:${(R-bz).toFixed(1)}px">${status}`+
    `<iframe class="zfi-frame" data-zfi-frame title="De zonepagina in de tutorial" tabindex="-1" aria-hidden="true" style="top:${stH}px;width:${LW}px;height:${lh.toFixed(1)}px;transform:scale(${sc.toFixed(4)})"></iframe>`+
    `<i class="rti-island" style="top:${(sw*.026).toFixed(1)}px;width:${(sw*.29).toFixed(1)}px;height:${(sw*.085).toFixed(1)}px"></i><i class="rti-home" style="bottom:${(hmH*.32).toFixed(1)}px;width:${(sw*.36).toFixed(1)}px"></i></div></div></div>`+
    `<i class="zfi-ring" data-zfi-ring></i><i class="ki-finger zfi-finger" data-zfi-finger></i>`;
  frame=fit.querySelector('[data-zfi-frame]');LightningTutorialFrame.fill(frame,'zone-tutorial','?tut=1&uitleg=0');}
// ---------- de stand: hetzelfde licht als het voorbeeld op de telefoon ----------
function drawStand(){raf=0;if(!root||root.hidden)return;const c=root.querySelector('[data-zfi-stand]'),w=frame?.contentWindow;
  try{if(c&&w&&w.__zf&&w.LightningPreview&&w.ZLijn){
    // de stand zelf: met dezelfde gladde lijnen als het voorbeeld (de eigenaar 13 nov: niet de oude wand);
    // zonder de selectie van de app (op de stand dimt er niets)
    const o={...w.__zf.mainSpec(),time:reduce()?1.5:(performance.now()-t0)/1000,labels:false,main:false,selectionOverlay:false,interactiveLines:false,selectionFeedback:false,selection:{kind:'all'},dim:null};
    const f=w.LightningPreview.rows(o);
    // dezelfde weergave als de zone (de eigenaar 13 nov): plat (Horizontaal) of rechtop (Verticaal), en bij "1 ledline" één
    // doorlopende ledline
    w.ZLijn.draw(c,{lines:f.rows.map(row=>row.pixels.map(w.LightningColour.screenRGB)),ids:null,layout:o.layout==='continuous'?'continuous':'stacked',vertical:o.vertical===true,numbers:true,pixels:false});}}catch(_){}
  raf=requestAnimationFrame(drawStand);}
// ---------- vinger, ring en wachten (met pauze en stoppen) ----------
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(my,ms){let left=ms;while(left>0){if(my!==run)throw ABORT;await sleep(Math.min(60,left));if(!paused)left-=60;}if(my!==run)throw ABORT;}
function ctx(my){const fit=root.querySelector('[data-ki-fit]'),finger=fit.querySelector('[data-zfi-finger]'),ringEl=fit.querySelector('[data-zfi-ring]'),w=frame.contentWindow,d=w.document;
  const c={w,d,q:sel=>d.querySelector(sel),wait:ms=>wait(my,ms),
    pt:(x,y)=>[G.x+x*G.sc,G.y+y*G.sc],
    center(el){const r=el.getBoundingClientRect();return c.pt(r.left+r.width/2,r.top+r.height/2);},
    async move(x,y,ms=900){finger.style.transitionDuration=ms+'ms';finger.style.left=x+'px';finger.style.top=y+'px';finger.style.opacity='1';await c.wait(ms);},
    async press(on){finger.classList.toggle('is-press',on);await c.wait(220);},
    async ring(el){if(!el){ringEl.classList.remove('is-on');return;}const r=el.getBoundingClientRect(),[x,y]=c.pt(r.left,r.top),pad=6;
      Object.assign(ringEl.style,{left:x-pad+'px',top:y-pad+'px',width:r.width*G.sc+2*pad+'px',height:r.height*G.sc+2*pad+'px'});ringEl.classList.add('is-on');await c.wait(250);},
    // in beeld brengen: onder de balk die bovenaan blijft staan (die wordt kleiner bij scrollen), boven de onderbalk
    async reveal(el,offset=150){if(!el)return;const sheet=el.closest('.zf-panel');if(sheet){sheet.scrollTo({top:Math.max(0,el.offsetTop-offset),behavior:'smooth'});await c.wait(650);return;}
      const below=()=>(d.querySelector('[data-dock]')?.getBoundingClientRect().bottom||0)+18;
      w.scrollTo({top:Math.max(0,w.scrollY+el.getBoundingClientRect().top-Math.max(offset,300)),behavior:'smooth'});await c.wait(650);
      const gap=el.getBoundingClientRect().top-below();if(Math.abs(gap)>8){w.scrollTo({top:Math.max(0,w.scrollY+gap),behavior:'smooth'});await c.wait(450);}},
    // tikken: eerst omcirkelen (zo zie je waar), dan schuift de vinger erheen en tikt
    async tapOn(sel){const el=d.querySelector(sel);if(!el)return;await c.ring(el);await c.wait(750);await c.move(...c.center(el),900);await c.press(true);el.click();await c.press(false);await c.wait(300);await c.ring(null);},
    // iets tonen: omcirkelen en even laten staan
    async show(el,ms=2000){if(!el)return;await c.ring(el);await c.wait(ms);await c.ring(null);},
    click(sel){d.querySelector(sel)?.click();},
    slide(sel,v){const inp=d.querySelector(sel);if(!inp)return;inp.value=v;inp.dispatchEvent(new w.Event('input',{bubbles:true}));},
    async drag(inp,to){const r=inp.getBoundingClientRect(),min=+inp.min||0,max=+inp.max||100,from=+inp.value,xAt=v=>r.left+14+(v-min)/(max-min)*(r.width-28),y=r.top+r.height/2;
      await c.ring(inp);await c.wait(600);await c.move(...c.pt(xAt(from),y),900);await c.press(true);for(let k=1;k<=16;k++){const v=+(from+(to-from)*k/16).toFixed(2);c.slide('#'+inp.id,v);await c.move(...c.pt(xAt(v),y),85);}await c.press(false);}};
  return c;}
async function ready(my){for(let k=0;k<200;k++){const w=frame?.contentWindow;if(w&&w.__zf&&w.document.querySelector('.zf-stage'))return;await wait(my,60);}throw ABORT;}
// ---------- afspelen ----------
function say(i){root.querySelectorAll('.ki-sub').forEach(p=>p.classList.toggle('is-on',p.dataset.sub===String(i)));const sr=root.querySelector('[data-ki-sr]');if(sr)sr.textContent=i==='final'?SCRIPTS[KIND].final[0]:STEPS[i]?.say||'';}
function progress(f){const i=root.querySelector('[data-ki-progress]>i');if(i)i.style.transform=`scaleX(${Math.max(0,Math.min(1,f))})`;}
function setEnd(on){root.querySelector('[data-ki-end]').hidden=!on;root.querySelector('[data-ki="skip"]').hidden=on;root.querySelector('[data-ki-progress]').hidden=on||staticMode;
  root.querySelector('[data-ki="pause"]').hidden=on||staticMode;if(on)root.querySelector('[data-ki="close"]').focus({preventScroll:true});}
function setPaused(p){paused=p;const b=root.querySelector('[data-ki="pause"]');b.innerHTML=p?ICON_PLAY:ICON_PAUSE;b.setAttribute('aria-label',p?'Verder afspelen':'Pauzeren');root.classList.toggle('is-paused',p);}
function togglePause(){if(staticMode||!root.querySelector('[data-ki-end]').hidden)return;setPaused(!paused);}
async function startZone(c){c.w.__zf.reset();await c.wait(300);if(SCRIPTS[KIND].zone!=='flex'){c.w.__zf.openZone(SCRIPTS[KIND].zone);await c.wait(400);}}
async function play(from){const my=++run;setEnd(false);setPaused(false);try{await ready(my);const c=ctx(my);await startZone(c);await c.wait(200);
  for(let k=0;k<from;k++)STEPS[k].now(c);
  for(let k=from;k<STEPS.length;k++){step=k;say(k);progress(k/STEPS.length);await c.wait(700);await STEPS[k].play(c);await c.ring(null);await c.wait(1200);}
  await c.ring(null);root.querySelector('[data-zfi-finger]').style.opacity='0';progress(1);say('final');setEnd(true);}catch(e){if(e!==ABORT)console.warn('zone-tutorial',KIND,e);}}
// stap voor stap (beweging beperken): de eindtoestand van elke stap, met de ring op de plek
async function go(i){step=Math.max(0,Math.min(STEPS.length-1,i));const my=++run;
  root.querySelectorAll('.ki-dots i').forEach((d,j)=>d.classList.toggle('on',j===step));root.querySelector('[data-ki="prev"]').disabled=step===0;
  try{await ready(my);const c=ctx(my);await startZone(c);for(let k=0;k<step;k++){STEPS[k].now(c);await c.wait(120);}await c.wait(350);
    // de plek in beeld brengen: onder de balk die bovenaan blijft staan (die wordt kleiner bij scrollen)
    const el=STEPS[step].show(c.d);if(el){const sheet=el.closest('.zf-panel');
      if(sheet)sheet.scrollTop=Math.max(0,el.offsetTop-150);
      else if(el.closest('[data-dock]'))c.w.scrollTo(0,0);
      else{c.w.scrollTo(0,Math.max(0,c.w.scrollY+el.getBoundingClientRect().top-300));await c.wait(380);
        const gap=el.getBoundingClientRect().top-((c.d.querySelector('[data-dock]')?.getBoundingClientRect().bottom||0)+18);if(Math.abs(gap)>8)c.w.scrollTo(0,Math.max(0,c.w.scrollY+gap));}}
    await c.wait(380);say(step);await c.ring(STEPS[step].show(c.d));
    const last=step===STEPS.length-1;root.querySelector('[data-ki-steps]').hidden=last;setEnd(last);}catch(e){if(e!==ABORT)console.warn('zone-tutorial',KIND,e);}}
function begin(from){build();t0=performance.now();root.querySelector('[data-ki-steps]').hidden=!staticMode;root.querySelector('[data-ki-progress]').hidden=staticMode;root.querySelector('[data-ki="pause"]').hidden=staticMode;
  if(!raf)raf=requestAnimationFrame(drawStand);if(staticMode)go(from);else play(from);}
function refit(){if(!root||root.hidden)return;const bx=root.querySelector('[data-ki-box]'),want=pickLayout(bx);
  if(want!==layoutName){begin(step);return;}root.querySelector('[data-ki-fit]').style.setProperty('--ki-scale',Math.min(bx.clientWidth/L.W,bx.clientHeight/L.H).toFixed(4));}
let onClose=null; // Flutter: de terugweg (app.js zoneTutorialForFlutterA8)
function open(kind='spi',opts={}){if(!SCRIPTS[kind])kind='spi';onClose=typeof opts?.onClose==='function'?opts.onClose:null;
  if(root&&root.dataset.kind!==kind){root.remove();root=null;ro?.disconnect();ro=null;}KIND=kind;STEPS=SCRIPTS[kind].steps;if(!root)root=shell();staticMode=reduce();step=0;root.hidden=false;document.documentElement.classList.add('ki-open');
  if(!ro&&typeof ResizeObserver==='function'){ro=new ResizeObserver(()=>refit());ro.observe(root.querySelector('[data-ki-box]'));}
  requestAnimationFrame(()=>{begin(0);root.querySelector('[data-ki="skip"]').focus({preventScroll:true});});}
function close(){run++;cancelAnimationFrame(raf);raf=0;if(root){root.hidden=true;root.querySelector('[data-ki-fit]').innerHTML='';}frame=null;
  document.documentElement.classList.remove('ki-open');try{localStorage.setItem(KEY+KIND,'1');}catch(_){}
  document.querySelector('[data-action=gear]')?.focus({preventScroll:true});const done=onClose;onClose=null;try{done?.();}catch(_){}}
return {open,close,kinds:Object.keys(SCRIPTS),seenBefore:kind=>{try{return localStorage.getItem(KEY+(kind||'spi'))==='1';}catch(_){return false;}}};
})();
