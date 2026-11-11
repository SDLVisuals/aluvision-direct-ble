/* C144b Ledlines instellen — tutorial van stap 1 "Ledlines en pixels" in de app (11 nov 2026, gebruiker: "Tutorial in de
 * app"). Gemaakt uit de tutorial van prototype C142p (prototypes/ledlines-herkennen/herkennen.js, Intro), met:
 *   - het echte palet van de receiver: Ledline 1 Rood, 2 Blauw, 3 Geel, 4 Oranje (palet 5, zoals de kleurtegels);
 *   - "Ledline n" = de ledline op uitgang n; op de stand staan ze als 3, 1, 2 (waar je ze insteekt, maakt niet uit);
 *     aan uitgang 4 hangt de kabel los (er hangen altijd vier kabels aan een receiver);
 *   - de receiver-tekening uit design/receiver (kopie: receiver-art.js);
 *   - een eigen <dialog>, zodat de tutorial boven het modale setup-dialoog ligt.
 * Opent de eerste keer vanzelf bij de eerste setup (pixel-setup.js) en daarna via "Bekijk tutorial".
 * Alleen weergave: hier wordt niets naar een receiver gestuurd en niets bewaard behalve "al gezien" (localStorage).
 */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const css=c=>`rgb(${c.map(v=>Math.max(0,Math.min(255,Math.round(v)))).join(',')})`;
const reduce=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}};
// het palet van de receiver (palet 5): uitgang 1 rood, 2 blauw, 3 geel, 4 oranje
const LINES=[{n:1,name:'Rood',hex:'#FF0000',ink:'#C81E1E',inkD:'#FF6B6B'},{n:2,name:'Blauw',hex:'#0000FF',ink:'#1F3FD1',inkD:'#8DA2FF'},
  {n:3,name:'Geel',hex:'#FFFF00',ink:'#7A6A00',inkD:'#FFE14D'},{n:4,name:'Oranje',hex:'#FF1700',ink:'#C2410C',inkD:'#FF8A5C'}];
const sleeve=(c,extra='')=>`<span class="hk-sleeve" style="--c:${c}${extra}"></span>`;
const ICON_CHECK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const ICON_CROSS='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
const ICON_NEXT='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const ICON_PLUS='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg>';
const ICON_REPLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5"/></svg>';
const ICON_PLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
const ICON_PAUSE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5.5h3.2v13H7.5zM13.3 5.5h3.2v13h-3.2z"/></svg>';
const ICON_CHAIN='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12h4M10 12h4M17.5 12h4"/><path d="M6 8.5l2.5 3.5L6 15.5M13.5 8.5l2.5 3.5-2.5 3.5"/></svg>';
const ICON_PLUG='<svg viewBox="0 0 44 16" aria-hidden="true"><path class="co" d="M1 8H3.5M30.5 8H44"/><path class="ci" d="M1 8H3.5M30.5 8H44"/>'+
  '<rect class="w" x="3" y="5" width="4" height="6" rx="1"/><path class="l" d="M4.3 5.8v4.4M5.7 5.8v4.4"/><rect class="w" x="7" y="4" width="4" height="8" rx="1.2"/>'+
  '<rect class="w" x="11" y="2" width="8" height="12" rx="2"/><path class="l" d="M13 3.4v9.2M15 3.4v9.2M17 3.4v9.2"/><rect class="r" x="19" y="3.6" width="1.6" height="8.8" rx=".6"/>'+
  '<rect class="w" x="20.6" y="4" width="6" height="8" rx="1.2"/><rect class="w" x="26.6" y="5" width="4.4" height="6" rx="1"/><path class="l" d="M27.9 5.8v4.4M29.3 5.8v4.4"/></svg>';

const SENT1='Waar je ze insteekt, maakt niet uit. Kijk naar je stand: <b>tik de kleuren aan die branden.</b>';
const SENT2='Pixels stel je per ledline in. Kijk naar je stand: <b>zet het rode blokje op het einde.</b>';
const SENT3='Per ledline ingesteld: je ledlines kunnen nu <b>apart</b> spelen, elk met een eigen animatie tot de laatste pixel.';
const NEXTTXT='<b>Stap 2: volgorde en kanten, per zone.</b> Daarna spelen alle receivers in je zone samen als één lange ledline en loopt een animatie mooi van de ene ledline in de volgende.';
const LATER='<b>Later een ledline bijhangen? Dat kan altijd.</b> Doe dan alle stappen opnieuw voor die ledline.';
const AlvSetup=(()=>{
  const STEPS=[{n:1,name:'Ledlines en pixels'},{n:2,name:'Volgorde en kanten'}];
  const WHY='Bij SPI krijgt elke ledline eigen data.';
  const CHECK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  let gid=0;
  function icon(){const id='spg'+(++gid);
    return `<svg class="sp-icon" viewBox="0 0 28 28" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" x2="1">`+
      `<stop offset="0" stop-color="#2F6BFF"/><stop offset=".5" stop-color="#FFC61A"/><stop offset="1" stop-color="#9B4DFF"/></linearGradient></defs>`+
      `<path d="M4 5.5h20M4 11h20"/><circle class="sp-k1" cx="10" cy="5.5" r="2.2"/><circle class="sp-k2" cx="18" cy="11" r="2.2"/>`+
      `<rect x="2.5" y="16.5" width="23" height="7" rx="1.6"/><rect x="4.6" y="18.6" width="18.8" height="2.8" rx="1.2" fill="url(#${id})" stroke="none"/></svg>`;}

  // ---------- de kop in de app ----------
  // pos: 1 ledlines, 2 pixels (stap 1) · 3 volgorde, 4 kanten (stap 2) · 5 alles ingesteld
  function headHtml(){
    return `<div class="sp-intro"><i aria-hidden="true">${icon()}</i><span><b>Ledlines instellen</b><small>${WHY}</small></span></div>`+
      `<div class="sp-steps" role="list" aria-label="Ledlines instellen in 2 stappen">`+STEPS.map(s=>
        `<button type="button" class="sp-step" role="listitem" data-sp="${s.n}"><span class="sp-no">Stap ${s.n}<i class="sp-ok" aria-hidden="true">${CHECK}</i></span>`+
        `<b>${s.name}</b><span class="sp-bars" aria-hidden="true"><i data-seg="${2*s.n-1}"></i><i data-seg="${2*s.n}"></i></span></button>`).join('')+`</div>`;
  }

  function mockHead(){return `<div class="spm-intro"><i>${icon()}</i><span><b>Ledlines instellen</b><small>${WHY}</small></span></div>`;}
  // anim: het deel dat in de tutorial vol loopt (data-mseg="n", via de tijdlijn van de tutorial)
  function mockSteps(pos,{done1=pos>2,anim=0}={}){
    return `<div class="spm-steps">`+STEPS.map(s=>{const cur=pos<=4&&Math.ceil(pos/2)===s.n,done=s.n===1&&done1;
      const seg=k=>`<i class="${k<=pos&&k!==anim?'on':''}"><i${k===anim?` data-mseg="${k}"`:''}></i></i>`;
      return `<span class="spm-step${cur?' is-now':''}${done?' is-done':''}"><span class="spm-no">Stap ${s.n}<i>${CHECK}</i></span><b>${s.name}</b>`+
        `<span class="spm-bars">${seg(2*s.n-1)}${seg(2*s.n)}</span></span>`;}).join('')+`</div>`;
  }

  function mockSteps(pos,{done1=pos>2,anim=0}={}){
    return `<div class="spm-steps">`+STEPS.map(s=>{const cur=pos<=4&&Math.ceil(pos/2)===s.n,done=s.n===1&&done1;
      const seg=k=>`<i class="${k<=pos&&k!==anim?'on':''}"><i${k===anim?` data-mseg="${k}"`:''}></i></i>`;
      return `<span class="spm-step${cur?' is-now':''}${done?' is-done':''}"><span class="spm-no">Stap ${s.n}<i>${CHECK}</i></span><b>${s.name}</b>`+
        `<span class="spm-bars">${seg(2*s.n-1)}${seg(2*s.n)}</span></span>`;}).join('')+`</div>`;
  }
  return {mockHead,mockSteps};
})();

const Intro=(()=>{
  const LEAD=1200,END=39000,SLOW=1.4,KEY='aluvision.ledlinesTutorial.c144';
  const SOCK=['1','2','3','4'];                                   // de 4 aansluitingen, van links naar rechts (zonder nummers)
  const LIDS=['1','2','3','4'],CONN=['3','2','1'];                 // ledlines in de app; op de stand hangen er 3 (van links naar rechts; ledline 1 hangt als derde)
  const WIRE={1:'1',2:'2',3:'3'},EMPTY='4',MISS='4';               // ledline → uitgang (zo kruisen de verlengkabels niet); aan uitgang 4 hangt de kabel los, groen hangt nergens
  const C=Object.fromEntries(LINES.map(L=>[String(L.n),hex(L.hex)]));
  const PITCH=9,NPX=24,LEN=PITCH*NPX,GAPX=36,M=12,FW=CONN.length*LEN+(CONN.length-1)*GAPX+2*M,LY=42,DH=22,RIM=4.5;
  const LX0=Object.fromEntries(CONN.map((k,i)=>[k,M+i*(LEN+GAPX)]));
  // de receiver: de echte tekening (design/receiver/receiver-art.js), van boven gezien en liggend zoals in het ontwerp:
  // de DATA-kap met de vier uitgangen links, de stroom rechts. Hij ligt onder de rechterkant van de rij, zodat elke kabel
  // van zijn connector omlaag loopt en van links in zijn uitgang komt. RS = wereld-px per mm; RL/RT = linker-/bovenkant.
  const RA=window.AluvisionReceiverArt,RS=1.6;
  const RART=o=>RA.build({view:'top',theme:'dark',cable:0,power:true,powerCable:10,led:'#1FC45B',shadow:false,scale:RS,title:'Aluvision SPI-receiver',...o});
  const RB=RART({outputs:[true,true,true,true]});
  // waar elke uitgang zit (het begin van de kabel), vanaf de linker-bovenhoek van de tekening
  const PORT=Object.fromEntries(RB.anchors.map(a=>[String(a.port),{dx:(a.x-RB.viewBox.x)*RS,dy:(a.y-RB.viewBox.y)*RS}]));
  const RY=LY+150,RT=RY-2,RH=RB.height,FH=RT+RH+52;   // onderaan ruimte voor een losse kabel met zijn connector
  // C146p: kabels zoals op de stand. Elke uitgang heeft een vaste kabel (allemaal even lang; ze waaieren licht uit) met
  // een witte schroefconnector; elke ledline zijn eigen kabeltje met connector; daartussen een verlengkabel.
  const K=window.AlvKabels;
  const pig=(rl,u)=>K.bend(K.V(rl+PORT[u].dx,RT+PORT[u].dy),K.V(-1,0),12,30,(2.5-(+u))*5);   // de vaste kabel van uitgang u
  const tipX=rl=>Math.min(...['1','2','3','4'].map(u=>{const b=pig(rl,u);return K.add(b.end,b.dir,K.CL).x;}));
  const RL=LX0[CONN[CONN.length-1]]-4.5+46-tipX(0),RX=RL+RB.width/2,RCY=RT+RH/2;   // de uitgangen net rechts van de laatste connector
  const SY=s=>RT+PORT[s].dy;
  const NX0=LX0[CONN[0]]-LEN-GAPX,NEWK='4';   // later erbij: de groene ledline links naast de drie, op de lege uitgang
  const CONN2=['a','b'],LX2={a:M,b:M+LEN+GAPX},FW2=2*LEN+GAPX+2*M,RL2=LX2.b-4.5+46-tipX(0),WIRE2={a:'2',b:'1'},DATA2={a:'#3bd1ff',b:'#ff7ab6'};
  // breedte van elke groep (ledlines + receiver); de tweede groep staat ernaast (liggend) of eronder (staand)
  const G1W=Math.max(FW,RL+RB.width+12),G2W=Math.max(FW2,RL2+RB.width+12),R2X=G1W+110;
  const R2={land:{x:R2X,y:0},port:{x:(FW-FW2)/2,y:FH+90}},WSZ={land:{w:R2X+G2W,h:FH},port:{w:G1W,h:2*FH+90}};
  const CHAIN={...Object.fromEntries(CONN.map(k=>[k,LX0[k]])),a:R2X+LX2.a,b:R2X+LX2.b};   // samen: de plaats in de lange ledline
  const INOUT='cubic-bezier(.65,0,.35,1)',OUT='cubic-bezier(.2,.8,.2,1)',POP='cubic-bezier(.3,1.5,.5,1)';
  // korte, gewone zinnen; eerst waarom je dit doet
  const SUBS=['Bij SPI krijgt elke ledline zijn eigen data.','In een zone spelen alle receivers samen, als één lange ledline.','Zo loopt een animatie eindeloos door.',
    'Of je bedient ze apart: elk een eigen animatie.','Stel ze eerst in: elke ledline brandt nu in een eigen kleur.','Waar je ze insteekt, maakt niet uit.',
    'Tik de kleuren aan die je ziet.','Zie je een kleur niet? Daar hangt niets aan.','Nu de pixels, per ledline.','Geen rood blokje te zien? Schuif terug.',
    'Het einde brandt niet? Veeg verder, pixel per pixel.','Rood blokje op het einde? Perfect.','Zo stel je de pixels per ledline in.','Later een ledline bijhangen? Dat kan altijd: doe dan alle stappen opnieuw voor die ledline.',
    'Pixels ingesteld. Daarna stap 2: per zone de volgorde en de kanten.'];
  const SUB_T=[[-1100,2400],[2400,5800],[5800,8200],[8200,11300],[11300,13800],[13800,16700],[16700,18900],[18900,21000],[21000,22300],[22300,24100],[24100,26300],[26300,28500],[28500,31800],[31800,34900],[34900,END]];   // elke zin blijft tot de volgende
  const STEPS=[300,4300,6900,9500,12900,15100,18750,20200,21800,23000,25100,27100,29800,34300,END];
  // pixels (24 getekende pixels per ledline): ledline 1 in detail, dan 2 en 3 sneller
  const P1={on:21500,dragA:[23400,24100],swipe:[25200,26300],ok:26400,next:28050};   // terugschuiven tot te kort, dan over de liniaal vegen tot het einde   // terugschuiven tot te kort, dan +10, +10, +1
  const FT=1270;P1.end=P1.next+420;                               // na de tik op Volgende dooft de ledline uit
  const FAST=[['2',28800],['3',30400]];                           // elk: invloeien, één schuifbeweging, ✓, Volgende, uitvloeien
  const PX_END=FAST[FAST.length-1][1]+FT;                         // na de laatste ledline spelen ze meteen hun eigen animatie
  const SAMEN=[[2300,8100]],APART=[[8100,10700],[PX_END,END]];   // samen als één ledline en apart (begin); op het einde alleen apart
  const NUMS={1:{max:163,...Object.fromEntries(Array.from({length:21},(_,i)=>['v'+(63+i),63+i])),good:84},2:{start:163,good:62},3:{start:163,good:96}};   // elke ledline begint op het maximum
  const TAPS={1:17200,2:17700,3:18200};                          // de 3 kleuren die branden; groen niet
  const NEXT1=20300,DONE=PX_END+80;                               // Volgende na de kleuren; het eindscherm
  const LAYOUT={
    land:{W:1000,H:625,zone:[WSZ.land.w/2,FH/2-10,500,300,Math.min(.6,960/WSZ.land.w)],close:[RX-30,RCY,500,330,2.1],all:[G1W/2,FH/2,500,300,Math.min(1.1,960/G1W)],side:[G1W/2,FH/2,300,300,Math.min(.7,575/G1W)],side4:[(NX0+RL+RB.width)/2,FH/2,300,300,Math.min(.54,575/(RL+RB.width-NX0+10))],rcv0:[RX-40,RCY,500,330,1.3],rcv:[RX-40,RCY,300,330,1.3],l1:[LX0['1']+LEN/2,LY,300,290,2.3],phone:{x:600,y:10,w:330,h:606},enter:'translate(70px,0px)'},
    port:{W:600,H:1000,zone:[WSZ.port.w/2,WSZ.port.h/2,300,470,Math.min(.66,570/WSZ.port.w)],close:[RX-30,RCY,300,470,1.6],all:[G1W/2,FH/2,300,470,Math.min(.7,570/G1W)],side:[G1W/2,FH/2,300,190,Math.min(.7,570/G1W)],side4:[(NX0+RL+RB.width)/2,FH/2,300,190,Math.min(.55,570/(RL+RB.width-NX0+10))],rcv0:[RX-40,RCY-10,300,440,1.15],rcv:[RX-40,RCY-10,300,215,1.15],l1:[LX0['1']+LEN/2,LY,300,205,2.3],phone:{x:40,y:330,w:520,h:600},enter:'translate(0px,70px)'}
  };
  let root=null,anims=[],timers=[],layoutName='',staticMode=false,step=0,ro=null;

  function tr(el,prop,pts){
    if(!el||typeof el.animate!=='function')return;
    const m=[];pts.slice().sort((a,b)=>a[0]-b[0]).forEach(p=>{const l=m[m.length-1];if(l&&Math.abs(l[0]-p[0])<.5){l[1]=p[1];if(p[2])l[2]=p[2];}else m.push(p.slice());});
    const kf=m.map(([t,v,e])=>({[prop]:v,offset:Math.min(1,Math.max(0,(t+LEAD)/(LEAD+END))),easing:e||'linear'}));
    if(kf[0].offset>0)kf.unshift({...kf[0],offset:0,easing:'linear'});
    if(kf[kf.length-1].offset<1)kf.push({...kf[kf.length-1],offset:1});
    anims.push(el.animate(kf,{duration:(LEAD+END)*SLOW,fill:'both'}));
  }
  function shell(){
    const el=document.createElement('div');el.className='ki';el.hidden=true;
    el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Tutorial: ledlines instellen');
    el.innerHTML=`<div class="ki-top"><img src="assets/aluvision-logo.png" alt="Aluvision"><b>Tutorial</b><button type="button" class="ki-btn" data-ki="skip">Overslaan</button></div>`+
      `<div class="ki-box" data-ki-box><div class="ki-fit" data-ki-fit></div></div>`+
      `<div class="ki-subs" aria-hidden="true">${SUBS.map((s,i)=>i<SUBS.length-1?`<p class="ki-sub" data-sub="${i}">${s}</p>`:`<p class="ki-sub final" data-sub="${i}">Pixels ingesteld.<span>Daarna stap 2: per zone de volgorde en de kanten.</span></p>`).join('')}</div>`+
      `<p class="ki-sr" data-ki-sr aria-live="polite"></p>`+
      `<div class="ki-bottom"><button type="button" class="ki-btn hk-pause" data-ki="pause" aria-label="Pauzeren">${ICON_PAUSE}</button><div class="ki-progress" data-ki-progress><i></i></div>`+
      `<div class="ki-steps" data-ki-steps hidden><button type="button" class="ki-btn" data-ki="prev" aria-label="Vorige stap">‹</button><span class="ki-dots">${'<i></i>'.repeat(STEPS.length)}</span><button type="button" class="ki-btn" data-ki="next" aria-label="Volgende stap">›</button></div>`+
      `<div class="ki-end" data-ki-end hidden><button type="button" class="ki-btn" data-ki="replay">${ICON_REPLAY}Opnieuw</button><button type="button" class="ki-btn primary" data-ki="close">Aan de slag</button></div></div>`;
    el.addEventListener('click',e=>{const b=e.target.closest('[data-ki]');if(!b)return;
      ({skip:close,close,replay:()=>{step=0;start(-LEAD);},prev:()=>go(step-1),next:()=>go(step+1),pause:togglePause})[b.dataset.ki]?.();});
    el.querySelector('[data-ki-box]').addEventListener('click',()=>togglePause());   // tik op het beeld: pauze / verder
    el.addEventListener('keydown',e=>{if(e.key==='Escape')close();else if(staticMode&&e.key==='ArrowRight')go(step+1);else if(staticMode&&e.key==='ArrowLeft')go(step-1);});
    const dialog=document.createElement('dialog');dialog.className='ki-dialog';dialog.setAttribute('aria-label','Tutorial: ledlines instellen');
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',()=>{if(root&&!root.hidden)close();});   // ook van buitenaf gesloten (terugknop): netjes opruimen
    dialog.append(el);document.body.append(dialog);return el;
  }
  // de stand: 3 ledlines (zoals in C141p), elk met zijn connector en een kabel naar de receiver. De aansluitingen hebben
  // geen nummers in de app; blauw zit op de derde, geel op de eerste, paars op de tweede; aan de vierde hangt de kabel los.
  function sceneHtml(){
    const box=(x,y,w,h)=>`left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px`;
    const shade='linear-gradient(180deg,rgba(255,255,255,0) 20%,rgba(255,255,255,.42) 36%,rgba(255,255,255,.3) 52%,rgba(255,255,255,0) 70%,rgba(0,0,0,.14) 80%)';
    let paths='',data='',h='',plugs='';
    // het vaste kabeltje van elke ledline (allemaal even lang): uit het einde van de strip, de bocht om, naar zijn connector
    const lead=x0=>{const cx=x0-4.5;return K.tube(`M${x0} ${LY}H${cx+3.5}Q${cx} ${LY} ${cx} ${LY+3.5}V${LY+19}`,'thin');};
    // de vaste kabel van uitgang u met zijn connector (los: alleen de mannelijke kant); tip = waar de verlengkabel begint
    const fixed=(rl,u,loose)=>{const b=pig(rl,u),c=K.plugAt(b.end,b.dir,loose?K.MALE:K.PLUG);return {b,d:K.tube(b.d),plug:c.html,tip:c.tip};};
    // de verlengkabel: van de connector aan de vaste kabel naar de connector onder de ledline (x0)
    const cord=(x0,f)=>K.link(f.tip,f.b.dir,K.V(x0-4.5,LY+53),K.V(0,-1));
    // de data loopt van de uitgang door de vaste kabel, de verlengkabel en het kabeltje van de ledline tot in de ledline
    // (het pad begint in de ledline: de streepjes lopen naar het begin toe)
    const noM=d=>d.replace(/^M[-\d. ]+/,'');
    const dataD=(x0,f)=>{const cx=x0-4.5;return `M${x0} ${LY}H${cx+3.5}Q${cx} ${LY} ${cx} ${LY+3.5}V${LY+53}`+noM(cord(x0,f).rev)+`L${f.b.end.x.toFixed(1)} ${f.b.end.y.toFixed(1)}`+noM(f.b.rev);};
    for(const k of CONN){const x0=LX0[k],f=fixed(RL,WIRE[k]);
      paths+=lead(x0)+f.d+K.tube(cord(x0,f).d);plugs+=f.plug;
      data+=`<path class="hk-data" data-dash="${k}" d="${dataD(x0,f)}" style="stroke:${LINES[k-1].hex}"/>`;}   // de data loopt van de receiver naar de ledline
    // er hangen altijd vier kabels aan de receiver: waar geen ledline aan hangt, ligt de kabel los, met zijn connector
    const FREE1=SOCK.filter(u=>!Object.values(WIRE).includes(u));
    const FL={};for(const u of FREE1){const f=FL[u]=fixed(RL,u,true);paths+=f.d;plugs+=f.plug;}
    // later: een verlengkabel van de losse kabel naar de nieuwe ledline; zijn connector klikt op de losse connector
    {const f=FL[EMPTY],dN=cord(NX0,f).d;paths+=['e','c','h'].map(c=>`<path class="kb-${c} hk-newc" data-new${c} d="${dN}"/>`).join('');
      plugs+=K.plugAt(f.b.end,f.b.dir,K.FEMALE,1,' data-newp').html;}
    h+=`<svg class="hk-cables" width="${FW}" height="${FH}" viewBox="0 0 ${FW} ${FH}" aria-hidden="true">${paths}${data}</svg>`;
    // de receiver zelf; de connectors aan zijn vaste kabels; de ring rond de losse connector
    const rcv=x=>{const b=RART({outputs:[true,true,true,true]});return `<div class="hk-rart" style="${box(x,RT,b.width,b.height)}">${b.svg}</div>`;};
    h+=rcv(RL)+`<div class="hk-free">${plugs}</div>`;
    {const r=K.add(FL[EMPTY].b.end,FL[EMPTY].b.dir,13.7);h+=`<i class="hk-ring" data-ring style="${box(r.x-21,r.y-12.5,42,25)}"></i>`;}   // "daar hangt niets aan"
    // samen: alle ledlines in één kleur met een witte chase die door alle ledlines na elkaar loopt; apart: elk een eigen animatie
    // (een witte loop, zacht ademen, lopende streepjes)
    const one=k=>`<i class="hk-an one" data-one="${k}" style="left:0;right:0"><i data-oneb="${k}" style="left:0;width:${10*PITCH}px"></i></i>`;   // één kleur + witte chase
    const sep={1:`<i class="hk-an run" data-sep="1" style="left:0;right:0"><i data-run="1" style="left:0;width:${8*PITCH}px"></i></i>`,
      2:`<i class="hk-an breathe" data-sep="2" style="left:0;right:0"><i data-br="2" style="left:0;right:0"></i></i>`,
      3:`<i class="hk-an stripes" data-sep="3" style="left:0;right:0"><i data-st="3" style="left:0;width:3200px"></i></i>`,
      a:`<i class="hk-an breathe c2" data-sep="a" style="left:0;right:0"><i data-br="a" style="left:0;right:0"></i></i>`,
      b:`<i class="hk-an run c2" data-sep="b" style="left:0;right:0"><i data-run="b" style="left:0;width:${8*PITCH}px"></i></i>`};
    const plug=cx=>K.plugV(cx,LY+19);
    const sleeveOnly=k=>`<i class="ki-shade" style="left:0;right:0;background:${shade}"></i><i class="ki-rim" style="left:0;right:0;height:${RIM}px"></i><i class="ki-rim b" style="left:0;right:0;top:auto;height:${RIM}px"></i>`;
    for(const k of CONN){
      const x0=LX0[k],own=C[k],cx=x0-4.5;
      h+=plug(cx);
      h+=`<i class="ki-gl" data-gl="${k}" style="${box(x0-24,LY-34,LEN+48,68)};border-radius:34px;background:${css(own)};filter:blur(18px)"></i>`;
      h+=`<i class="hk-wgl" data-wg="${k}" style="${box(x0-10,LY-19,LEN+20,38)};border-radius:19px"></i>`;   // witte gloed van het testlicht
      h+=`<i class="ki-dif" data-dif="${k}" style="${box(x0,LY-DH/2,LEN,DH)};border-radius:1.5px">`+
        `<i class="ki-px" data-px="${k}" style="left:0;right:0;background:${css(own)};transform-origin:0% 50%"></i>`+one(k)+sep[k]+
        `<i class="hk-dark" data-dark="${k}" style="left:0;right:0"></i><i class="hk-wfs" data-wf="${k}" style="left:0;width:${LEN}px"></i>`+
        `<i class="hk-rbs" data-rb="${k}" style="left:0;width:${PITCH}px"></i>`+(k==='1'?`<i class="hk-grid" data-grid="1" style="left:0;right:0"></i>`:'')+
        `<i class="ki-shade" style="left:0;right:0;background:${shade}"></i>`+
        `<i class="ki-rim" style="left:0;right:0;height:${RIM}px"></i><i class="ki-rim b" style="left:0;right:0;top:auto;height:${RIM}px"></i></i>`;
      // ✗ / ✓ boven het einde van de ledline: kleiner bij ledline 1 (daar zoomt de camera in), groter bij 2 en 3 (van ver gezien)
      const bs=k==='1'?24:44,bb=box(x0+LEN-bs/2,LY-(k==='1'?40:52)-bs/2,bs,bs);
      h+=(k==='1'?`<i class="ki-cross" data-xa="1" style="${bb}">${ICON_CROSS}</i><i class="ki-cross" data-xb="1" style="${bb}">${ICON_CROSS}</i>`:'')+
        `<i class="hk-okb" data-ok="${k}" style="${bb}">${ICON_CHECK}</i>`;
    }
    // de tweede receiver in dezelfde zone (alleen in het begin), en de zone eromheen
    const r2=R2[layoutName],ws=WSZ[layoutName];let p2='',d2='',g='';
    const FREE2=SOCK.filter(s=>s!==WIRE2.a&&s!==WIRE2.b);
    let pl2='';
    for(const u of FREE2){const f=fixed(RL2,u,true);p2+=f.d;pl2+=f.plug;}
    for(const k of CONN2){const x0=LX2[k],f=fixed(RL2,WIRE2[k]);p2+=lead(x0)+f.d+K.tube(cord(x0,f).d);pl2+=f.plug;
      d2+=`<path class="hk-data" data-dash="${k}" d="${dataD(x0,f)}" style="stroke:${DATA2[k]}"/>`;}
    g+=`<svg class="hk-cables" width="${FW2}" height="${FH}" viewBox="0 0 ${FW2} ${FH}" aria-hidden="true">${p2}${d2}</svg>`;
    g+=rcv(RL2)+`<div class="hk-free">${pl2}</div>`;
    for(const k of CONN2){const x0=LX2[k];g+=plug(x0-4.5)+`<i class="ki-dif" style="${box(x0,LY-DH/2,LEN,DH)};border-radius:1.5px">`+one(k)+sep[k]+sleeveOnly(k)+`</i>`;}
    h+=`<i class="hk-zone" data-zone style="${box(-34,LY-66,ws.w+68,ws.h-LY+66+26)}"><b>Zone Flex spi</b></i>`;
    {const cx=NX0-4.5,nc=C[NEWK];   // later een ledline erbij (de kabel naar de lege uitgang staat bij de andere kabels)
      h+=`<div class="hk-newg" data-newg><svg class="hk-cables" width="${FW+300}" height="${FH}" viewBox="0 0 ${FW+300} ${FH}" aria-hidden="true">${lead(NX0)}</svg>`+
        plug(cx)+`<i class="ki-gl" data-ngl style="${box(NX0-24,LY-34,LEN+48,68)};border-radius:34px;background:${css(nc)};filter:blur(18px)"></i>`+
        `<i class="ki-dif" style="${box(NX0,LY-DH/2,LEN,DH)};border-radius:1.5px"><i class="ki-px" data-npx style="left:0;right:0;background:${css(nc)};transform-origin:0% 50%"></i>${sleeveOnly(NEWK)}</i>`+
        `<i class="hk-okb hk-plusb" data-nplus style="${box(NX0+LEN/2-22,LY-74,44,44)}">${ICON_PLUS}</i></div>`;}
    h+=`<div class="hk-r2" data-r2 style="left:${r2.x}px;top:${r2.y}px;width:${FW2}px;height:${FH}px">${g}</div>`;
    return h;
  }
  // de telefoon: dezelfde schermen als de app (kleuren kiezen, pixels per ledline, klaar)
  function phoneHtml(L){
    const p=L.phone;
    const top=()=>AlvSetup.mockHead();   // dezelfde kop als de app: icoon, Ledlines instellen, waarom
    const tut=`<span class="ki-tut"><i>${ICON_PLAY}</i>Bekijk tutorial</span>`;
    const tile=k=>`<div class="hkm-tile" data-mt="${k}" style="--c:${LINES[k-1].hex}">${sleeve(LINES[k-1].hex)}<span><b>Ledline ${k}</b><small>${LINES[k-1].name}</small></span>`+
      `<i class="hkm-sel" data-msel="${k}"></i><i class="hkm-pulse" data-mpulse="${k}"></i>${k===MISS?'<i class="hkm-miss" data-mmiss></i>':''}<span class="hkm-tick"><i data-mtick="${k}">${ICON_CHECK}</i></span></div>`;
    let nums='';for(const k of CONN)for(const [kind,v] of Object.entries(NUMS[k]))nums+=`<b data-mn="${k}-${kind}">${v}</b>`;
    const chips=[...CONN].sort().map((k,i)=>`<div class="hkm-nowb" data-mchip="${k}" style="--c:${LINES[k-1].hex};opacity:0"><div class="hkm-now"><div class="hkm-now-top"><span class="hkm-now-dot"></span><b>Ledline ${k}</b><span class="hkm-now-of">${i+1} van ${CONN.length}</span></div>`+
      `<div class="hkm-now-segs">${[...CONN].sort().map((m,j)=>`<i class="${j<=i?'on':''}" style="--c:${LINES[m-1].hex}"></i>`).join('')}</div></div><b class="ki-title">Waar eindigt ledline ${k}?</b></div>`).join('');
    const MZC=9,mz=`<div class="hkm-zoom" data-mzoom><div class="hkm-ztrack" data-mztrack style="width:${163*MZC}px"><i class="hkm-zbase"></i><i class="hkm-zw" data-mzw style="width:${163*MZC}px"></i><i class="hkm-zr" data-mzr></i><i class="hkm-zsep"></i><i class="hkm-zrim"></i>`+
      Array.from({length:16},(_,i)=>`<b style="left:${((i+1)*10-.5)*MZC}px">${(i+1)*10}</b>`).join('')+`</div><i class="hkm-zmark"></i></div>`;
    const row=k=>{const on=CONN.includes(k);return `<div class="hkm-row${on?'':' off'}">${sleeve(LINES[k-1].hex)}<span><b>Ledline ${k}</b><small>${on?`${NUMS[k].good} pixels`:'Niet aangesloten · blijft uit'}</small></span>${on?`<i class="hkm-ok">${ICON_CHECK}</i>`:''}</div>`;};
    return `<div class="ki-phone" data-phone style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px"><div class="ki-screen">`+
      // A: welke kleuren zie je?
      `<div class="hkm-scr" data-scr="a">${top()}${AlvSetup.mockSteps(1)}`+
        `<small class="hkm-eyebrow">Receiver · Flex spi</small><b class="ki-title">Welke kleuren zie je?</b><span class="ki-sentence">${SENT1}</span>${tut}`+
        `<div class="hkm-tiles">${LIDS.map(tile).join('')}</div><span class="hkm-help">Ik zie niets branden</span></div>`+
      // B: pixels per ledline
      `<div class="hkm-scr" data-scr="b">${top()}${AlvSetup.mockSteps(2,{done1:false})}`+
        `<div class="hkm-swap">${chips}</div><span class="ki-sentence">${SENT2}</span>${tut}`+
        `<div class="hkm-count"><span class="hkm-num">${nums}<small>pixels</small></span></div>`+mz+
        `<div class="hkm-steps"><span data-mbtn="m10">−10</span><span class="one" data-mbtn="m1">−1</span><span class="one" data-mbtn="p1">+1</span><span data-mbtn="p10">+10</span></div>`+
        `<div class="hkm-strip"><i class="ki-plug">${ICON_PLUG}</i><span class="hkm-sl" data-msl><i class="w" data-mwf></i><i class="r" data-mrb></i><i class="rim"></i></span></div>`+
        `<div class="hkm-scale"><span>0</span><span>163 pixels</span></div></div>`+
      // C: klaar
      `<div class="hkm-scr" data-scr="c">${top()}${AlvSetup.mockSteps(2,{done1:true})}`+
        `<small class="hkm-eyebrow">Receiver · Flex spi</small><b class="ki-title">Pixels ingesteld</b><span class="ki-sentence">${SENT3}</span>`+
        `<div class="hkm-done">${LIDS.map(row).join('')}</div><div class="hkm-next hkm-later" data-mlater><i>${ICON_PLUS}</i><span>${LATER}</span><i class="hkm-hl" data-mlhl></i></div><div class="hkm-next"><i>${ICON_CHAIN}</i><span>${NEXTTXT}</span></div></div>`+
      `</div><div class="ki-foot"><span class="ki-next" data-knext><span class="hkm-lab" data-lab="next">Volgende${ICON_NEXT}</span><span class="hkm-lab" data-lab="done">${ICON_CHECK}Klaar</span><span class="hkm-lab" data-lab="go">Ga verder naar stap 2${ICON_NEXT}</span></span></div></div>`;
  }
  function build(){
    const box=root.querySelector('[data-ki-box]'),fit=root.querySelector('[data-ki-fit]'),bw=box.clientWidth,bh=box.clientHeight;
    layoutName=bw/Math.max(1,bh)>=1.05?'land':'port';const L=LAYOUT[layoutName];
    root.dataset.layout=layoutName;fit.style.width=L.W+'px';fit.style.height=L.H+'px';fit.style.setProperty('--ki-scale',Math.min(bw/L.W,bh/L.H).toFixed(4));
    const ws=WSZ[layoutName];
    fit.innerHTML=`<div class="ki-world" data-world style="left:${L.W/2-ws.w/2}px;top:${L.H/2-ws.h/2}px;width:${ws.w}px;height:${ws.h}px">${sceneHtml()}</div>`+'<i class="hk-focus" data-focus aria-hidden="true"></i>'+phoneHtml(L)+'<i class="ki-finger" data-finger></i>';
    return {L,fit};
  }
  function refit(){
    if(!root||root.hidden)return;
    const box=root.querySelector('[data-ki-box]'),bw=box.clientWidth,bh=box.clientHeight,want=bw/Math.max(1,bh)>=1.05?'land':'port';
    if(want!==layoutName){start((anims[0]?.currentTime??0)/SLOW-LEAD);return;}
    const L=LAYOUT[layoutName];root.querySelector('[data-ki-fit]').style.setProperty('--ki-scale',Math.min(bw/L.W,bh/L.H).toFixed(4));
  }
  // camera: zet punt (wx,wy) van de stand op (px,py) van het doek, op schaal s
  const camAt=(L,[wx,wy,px,py,s])=>{const ws=WSZ[layoutName];return `translate(${(px-L.W/2-(wx-ws.w/2)*s).toFixed(1)}px,${(py-L.H/2-(wy-ws.h/2)*s).toFixed(1)}px) scale(${s})`;};
  function timeline(L,fit){
    anims.forEach(a=>a.cancel());anims=[];
    const q=s=>fit.querySelector(s),sc=parseFloat(fit.style.getPropertyValue('--ki-scale'))||1,fr=fit.getBoundingClientRect();
    const pos=el=>{const r=el.getBoundingClientRect();return [(r.left+r.width/2-fr.left)/sc,(r.top+r.height/2-fr.top)/sc];};
    // posities in de telefoon meten vóór er iets beweegt (de telefoon schuift straks van opzij of van onder in beeld)
    const msl=q('[data-msl]'),mw=msl.offsetWidth,r0=msl.getBoundingClientRect(),hY=pos(msl)[1],ZP=pos(q('[data-mzoom]')),zw=q('[data-mzoom]').offsetWidth/2,MZC=9;
    const TILE=Object.fromEntries(LIDS.map(k=>[k,pos(q(`[data-mt="${k}"]`))])),nextP=pos(q('[data-knext]'));
    const hx=v=>[((r0.left-fr.left)/sc)+v/163*mw,hY];
    const cam=n=>camAt(L,L[n]);
    // 1. camera: de receiver dichtbij (de data loopt door elke kabel), uitzoomen tot de hele zone (twee receivers) voor
    //    samen/apart, naar de eerste receiver voor de kleuren,
    //    terug naar de receiver ("waar je ze insteekt, maakt niet uit"), opzij voor de telefoon, nog eens naar de receiver
    //    (de lege aansluiting), helemaal in op ledline 1, opzij voor 2 en 3, en op het einde de hele stand in het midden
    // rustige, zachte camerabewegingen; tijdens het stilstaan zoomt hij heel langzaam iets in, zodat het beeld nooit stilvalt
    const MOVE='cubic-bezier(.45,.05,.25,1)',camD=(n,f)=>{const v=L[n].slice();v[4]*=f;return camAt(L,v);};
    const SHOTS=[['close',-LEAD,1300],['zone',3700,10600],['all',11900,13300],['rcv0',14500,15500],['side',16700,18900],['rcv',20100,20900],['l1',22100,27500],['side',28700,31600],['side4',32300,END]];
    tr(q('[data-world]'),'transform',SHOTS.flatMap(([n,a,d],i)=>[[a,camD(n,1)],[d,camD(n,1.03),i<SHOTS.length-1?MOVE:undefined]]));
    // 2. de data loopt door elke kabel naar zijn ledline (elk in zijn eigen kleur): in het begin en bij "maakt niet uit"
    for(const k of [...CONN,...CONN2]){const el=q(`[data-dash="${k}"]`);
      tr(el,'opacity',CONN2.includes(k)?[[-LEAD,0],[2600,0,'ease'],[3200,1],[10200,1,'ease'],[10700,0]]:[[-LEAD,0],[-700,0,'ease'],[-200,1],[10200,1,'ease'],[10700,0],[14000,0,'ease'],[14400,1],[15600,1,'ease'],[16000,0]]);
      tr(el,'strokeDashoffset',[[-LEAD,'0px'],[END,`${((END+LEAD)*.09).toFixed(0)}px`]]);}
    // 3. samen: alle ledlines van de zone gaan in één kleur en een witte chase loopt door alle ledlines na elkaar, alsof
    //    het één lange ledline is (en dan opnieuw: eindeloos); apart: elk een eigen animatie. In het begin en op het einde.
    const win=ws=>{const op=[[0,0]];for(const [a,b] of ws){op.push([a,0,'ease'],[a+350,1]);if(b<END)op.push([b-300,1,'ease'],[b,0]);}return op;};
    for(const k of [...CONN,...CONN2]){tr(q(`[data-one="${k}"]`),'opacity',win(SAMEN));tr(q(`[data-sep="${k}"]`),'opacity',CONN2.includes(k)?win([APART[0]]):win(APART));
      // de chase: één witte band die de lange ledline afloopt, van de eerste ledline tot de laatste van de zone, en opnieuw
      const BWc=10*PITCH,V=.5,TC=(CHAIN.b+LEN+BWc)/V+250,mv=[[0,`translateX(${-BWc}px)`]];
      for(const [a,b] of SAMEN)for(let t0=a+300;t0<b;t0+=TC){const te=t0+CHAIN[k]/V,tx=t0+(CHAIN[k]+LEN+BWc)/V;if(te>=b)break;
        mv.push([te,`translateX(${-BWc}px)`],[tx,`translateX(${LEN}px)`],[tx+1,`translateX(${-BWc}px)`]);}
      tr(q(`[data-oneb="${k}"]`),'transform',mv);}
    tr(q('[data-zone]'),'opacity',[[0,0],[2700,0,'ease'],[3300,1],[10300,1,'ease'],[10800,0]]);   // de zone met beide receivers
    tr(q('[data-r2]'),'opacity',[[0,0],[2300,0,'ease'],[3000,1],[10700,1,'ease'],[11300,0]]);   // komt in beeld als de camera naar de zone uitzoomt; daarna alleen de eerste receiver
    {const bw=8*PITCH,from=`translateX(${-bw}px)`,to=`translateX(${LEN}px)`,mv=[[0,from]];
      for(const [a,b] of APART)for(let t=a+150;t+1000<=b+200;t+=1150)mv.push([t,from,'cubic-bezier(.45,0,.55,1)'],[t+1000,to],[t+1001,from]);
      tr(q('[data-run="1"]'),'transform',mv);tr(q('[data-run="b"]'),'transform',mv.map(([t,v,e])=>[t?t+500:t,v,e]));}
    {const op=[[0,.25]];for(const [a,b] of APART)for(let t=a;t<b;t+=700)op.push([t,.25,'ease'],[t+350,1,'ease']);tr(q('[data-br="2"]'),'opacity',op);tr(q('[data-br="a"]'),'opacity',op.map(([t,v,e])=>[t?t+350:t,v,e]));}
    tr(q('[data-st="3"]'),'transform',[[-LEAD,'translateX(-3000px)'],[END,`translateX(${(-3000+(END+LEAD)*.05).toFixed(0)}px)`]]);
    // 4. de kleuren: de aangesloten ledlines gaan aan in hun eigen kleur, vanaf hun connector. Een kleur aantikken: die
    //    ledline pulseert twee keer in zijn eigen kleur (geen witte puls). Tijdens het pixelkiezen zijn alle ledlines uit
    //    (donker); na de laatste ledline speelt elke ledline apart een eigen animatie.
    const ON={1:11500,2:11750,3:12000};
    for(const k of CONN){
      const t=ON[k],tp=TAPS[k]+220;   // de puls komt bij de tik zelf
      tr(q(`[data-px="${k}"]`),'transform',[[0,'scaleX(0)'],[t,'scaleX(0)',OUT],[t+650,'scaleX(1)']]);
      tr(q(`[data-gl="${k}"]`),'opacity',[[0,0],[t+100,0,'ease'],[t+750,.75],[tp,.75,'ease'],[tp+200,.3,'ease'],[tp+420,.95,'ease'],[tp+640,.3,'ease'],[tp+900,.75],
        [P1.on,.75,'ease'],[P1.on+300,0]]);
      tr(q(`[data-dark="${k}"]`),'opacity',[[0,0],[tp,0,'ease'],[tp+200,.5,'ease'],[tp+420,0,'ease'],[tp+640,.5,'ease'],[tp+900,0],
        [P1.on,0,'ease'],[P1.on+300,1],[PX_END+50,1,'ease'],[PX_END+400,0]]);
    }
    // de lege aansluiting licht op: daar hangt niets aan (tegelijk met de groene keuze in de app)
    const blink=[[0,0],[19200,0,OUT],[19500,1],[19800,.35,'ease'],[20100,1,'ease'],[20400,.35,'ease'],[20700,1,'ease'],[21000,0]];
    tr(q('[data-ring]'),'opacity',blink);
    tr(q('[data-ring]'),'transform',[[0,'scale(0.6)'],[19200,'scale(0.6)',POP],[19550,'scale(1)']]);
    tr(q('[data-mmiss]'),'opacity',blink);
    // 5. pixels: wit tot het gekozen aantal en het rode blokje op de laatste pixel
    const f=c=>`scaleX(${Math.max(0,(c-1)/NPX).toFixed(4)})`,x=c=>`translateX(${((c-1)*PITCH).toFixed(1)}px)`;
    const test=(k,a,b,cs)=>{   // cs: [[tijd, pixel, easing]]
      tr(q(`[data-wf="${k}"]`),'opacity',[[0,0],[a,0,'ease'],[a+300,1],[b,1,'ease'],[b+300,0]]);
      tr(q(`[data-rb="${k}"]`),'opacity',[[0,0],[a,0,'ease'],[a+300,1],[b,1,'ease'],[b+300,0]]);
      tr(q(`[data-wf="${k}"]`),'transform',[[0,f(cs[0][1])],...cs.map(([t,c,e])=>[t,f(c),e])]);
      tr(q(`[data-rb="${k}"]`),'transform',[[0,x(cs[0][1])],...cs.map(([t,c,e])=>[t,x(c),e])]);
      const g=c=>`scaleX(${(((Math.min(c,NPX+1)-1)*PITCH+20)/(LEN+20)).toFixed(4)})`;   // de witte gloed: zo ver als het wit
      tr(q(`[data-wg="${k}"]`),'opacity',[[0,0],[a,0,'ease'],[a+300,.34],[b,.34,'ease'],[b+300,0]]);
      tr(q(`[data-wg="${k}"]`),'transform',[[0,g(cs[0][1])],...cs.map(([t,c,e])=>[t,g(c),e])]);
    };
    test('1',P1.on,P1.end,[[P1.on,30],[P1.dragA[0],30,INOUT],[P1.dragA[1],3],[P1.swipe[0],3],[P1.swipe[1],24]]);   // vegen: pixel per pixel tot het einde
    tr(q('[data-focus]'),'opacity',[[0,0],[21500,0,'ease'],[22100,1],[27700,1,'ease'],[28400,0]]);   // naast de telefoon vervaagt de rest van de stand
    tr(q('[data-grid="1"]'),'opacity',[[0,0],[21700,0,'ease'],[22200,1],[27500,1,'ease'],[27900,0]]);   // de pixels zie je van dichtbij
    tr(q('[data-xa="1"]'),'opacity',[[0,0],[22350,0,OUT],[22600,1],[23300,1,'ease'],[23500,0]]);
    tr(q('[data-xa="1"]'),'transform',[[0,'scale(0.3)'],[22350,'scale(0.3)',POP],[22700,'scale(1)']]);
    tr(q('[data-xb="1"]'),'opacity',[[0,0],[24300,0,OUT],[24550,1],[25950,1,'ease'],[26200,0]]);
    tr(q('[data-xb="1"]'),'transform',[[0,'scale(0.3)'],[24300,'scale(0.3)',POP],[24650,'scale(1)']]);
    tr(q('[data-ok="1"]'),'opacity',[[0,0],[P1.ok,0,OUT],[P1.ok+250,1],[P1.end-100,1,'ease'],[P1.end+200,0]]);
    tr(q('[data-ok="1"]'),'transform',[[0,'scale(0.3)'],[P1.ok,'scale(0.3)',POP],[P1.ok+400,'scale(1)']]);
    for(const [k,t] of FAST){
      test(k,t,t+FT,[[t,30],[t+250,30,INOUT],[t+800,24]]);
      tr(q(`[data-ok="${k}"]`),'opacity',[[0,0],[t+800,0,OUT],[t+950,1],[t+FT-100,1,'ease'],[t+FT+200,0]]);
      tr(q(`[data-ok="${k}"]`),'transform',[[0,'scale(0.3)'],[t+800,'scale(0.3)',POP],[t+1100,'scale(1)']]);
    }
    // 6. de telefoon: kleuren kiezen → pixels per ledline → pixels ingesteld (met het kaartje: samen kan na volgorde en kanten)
    tr(q('[data-phone]'),'opacity',[[0,0],[15900,0,OUT],[16700,1]]);
    tr(q('[data-phone]'),'transform',[[0,L.enter],[15900,L.enter,OUT],[16700,'translate(0px,0px)']]);
    tr(q('[data-scr="a"]'),'opacity',[[0,1],[NEXT1+650,1,'ease'],[NEXT1+950,0]]);
    tr(q('[data-scr="b"]'),'opacity',[[0,0],[NEXT1+750,0,'ease'],[NEXT1+1100,1],[DONE-50,1,'ease'],[DONE+250,0]]);
    tr(q('[data-scr="c"]'),'opacity',[[0,0],[DONE,0,'ease'],[DONE+300,1]]);
    const SL='cubic-bezier(.3,.7,.2,1)';   // de schermen schuiven zacht in en uit
    tr(q('[data-scr="a"]'),'transform',[[0,'translateX(0px)'],[NEXT1+650,'translateX(0px)','ease'],[NEXT1+950,'translateX(-18px)']]);
    tr(q('[data-scr="b"]'),'transform',[[0,'translateX(18px)'],[NEXT1+750,'translateX(18px)',SL],[NEXT1+1150,'translateX(0px)'],[DONE-50,'translateX(0px)','ease'],[DONE+250,'translateX(-18px)']]);
    tr(q('[data-scr="c"]'),'transform',[[0,'translateX(18px)'],[DONE,'translateX(18px)',SL],[DONE+400,'translateX(0px)']]);
    for(const k of CONN){const t=TAPS[k]+220;   // vinkje en ring bij de tik zelf (niet pas als de vinger al weg is)
      tr(q(`[data-msel="${k}"]`),'opacity',[[0,0],[t,0,'ease'],[t+150,1]]);
      tr(q(`[data-mtick="${k}"]`),'opacity',[[0,0],[t,0,'ease'],[t+150,1]]);
      tr(q(`[data-mpulse="${k}"]`),'opacity',[[0,0],[t-40,0,OUT],[t+80,1],[t+1000,0]]);}   // de keuze licht op in zijn kleur en vervaagt
    // de kleur-chip bovenaan: "Ledline n · i van 3", in die kleur
    const chipAt={1:[NEXT1+750,P1.end],2:[P1.end,FAST[0][1]+FT],3:[FAST[0][1]+FT,DONE+250]};
    for(const k of CONN){const [a,b]=chipAt[k];tr(q(`[data-mchip="${k}"]`),'opacity',[[0,0],[a,0,'ease'],[a+200,1],[b-150,1,'ease'],[b,0]]);}
    // het pixelgetal (groot) en de strip in de app (schaal 0–163)
    const show=(sel,a,b,f=150)=>tr(q(sel),'opacity',[[0,0],[a,0,'ease'],[a+f,1],[b-f,1,'ease'],[b,0]]);
    show('[data-mn="1-max"]',NEXT1+750,23750);
    {const [a,b]=P1.swipe,per=(b-a)/21,hard=(sel,x,y)=>tr(q(sel),'opacity',[[0,0],[x-.6,0],[x,1],[y,1],[y+.6,0]]);   // elk getal precies aansluitend: nooit een leeg moment
      tr(q('[data-mn="1-v63"]'),'opacity',[[0,0],[23800,0,'ease'],[23950,1],[a+.5*per,1],[a+.5*per+.6,0]]);
      for(let v=64;v<84;v++)hard(`[data-mn="1-v${v}"]`,a+(v-63-.5)*per,a+(v-63+.5)*per);
      tr(q('[data-mn="1-good"]'),'opacity',[[0,0],[b-per/2-.6,0],[b-per/2,1],[P1.end-100,1,'ease'],[P1.end+50,0]]);}   // het getal telt mee tijdens het vegen
    FAST.forEach(([k,t],i)=>{const a=i?FAST[i-1][1]+FT:P1.end;show(`[data-mn="${k}-start"]`,a+100,t+550);show(`[data-mn="${k}-good"]`,t+600,i<FAST.length-1?t+FT+50:DONE+250);});
    const mf=v=>`scaleX(${(v/163).toFixed(4)})`,mx=v=>`translateX(${(v/163*mw).toFixed(1)}px)`;
    const mpts=[[0,163],[P1.dragA[0],163,INOUT],[P1.dragA[1],63],[P1.swipe[0],63],[P1.swipe[1],84],[P1.end,84,'ease'],[P1.end+200,163]];
    FAST.forEach(([k,t],i)=>{const v=NUMS[k].good;mpts.push([t+250,163,INOUT],[t+800,v]);if(i<FAST.length-1)mpts.push([t+FT,v,'ease'],[t+FT+200,163]);});
    tr(q('[data-mwf]'),'transform',mpts.map(([t,v,e])=>[t,mf(v),e]));
    tr(q('[data-mrb]'),'transform',mpts.map(([t,v,e])=>[t,`translateX(${(v/163*mw-mw*.03).toFixed(1)}px)`,e]));
    // de liniaal volgt mee: het rode blokje blijft in het midden, de pixels schuiven eronder door
    tr(q('[data-mztrack]'),'transform',mpts.map(([t,v,e])=>[t,`translateX(${(zw-(v-.5)*MZC).toFixed(1)}px)`,e]));
    tr(q('[data-mzw]'),'transform',mpts.map(([t,v,e])=>[t,`scaleX(${(Math.max(0,v-1)/163).toFixed(4)})`,e]));
    tr(q('[data-mzr]'),'transform',mpts.map(([t,v,e])=>[t,`translateX(${((v-1)*MZC).toFixed(1)}px)`,e]));
    // de vinger: 3 kleuren aantikken, even boven groen blijven (niet tikken), Volgende; slepen (te kort → te lang →
    // juist); Volgende; 2× snel slepen; Klaar
    const fg=q('[data-finger]'),at=(p,dy=0,s=1)=>`translate(${p[0].toFixed(1)}px,${(p[1]+dy).toFixed(1)}px) scale(${s})`;
    const tap=(p,t0)=>[[t0,at(p,50,1.15),OUT],[t0+300,at(p,0,1),'ease'],[t0+340,at(p,0,1),'ease'],[t0+420,at(p,0,.84),OUT],[t0+520,at(p,0,1),'ease']];
    const fpts=[[0,at(TILE['1'],60,1.15)]];
    for(const k of CONN)fpts.push(...tap(TILE[k],TAPS[k]-200));
    fpts.push([19100,at(TILE[MISS],38,1.15),'ease'],[19900,at(TILE[MISS],30,1.15),'ease']);
    fpts.push(...tap(nextP,NEXT1));
    // schuif terug op de strip (te kort), dan rustig over de liniaal vegen, pixel per pixel, tot het rode blokje op het einde staat
    const z0=[ZP[0]+21*MZC/2,ZP[1]],z1=[ZP[0]-21*MZC/2,ZP[1]];
    fpts.push([23000,at(hx(163),50,1.15),OUT],[23250,at(hx(163),0,1),'ease'],[P1.dragA[0],at(hx(163),0,.9),INOUT],[P1.dragA[1],at(hx(63),0,.9),'ease'],
      [24300,at(hx(63),30,1.1),'ease'],[24750,at(z0,40,1.12),OUT],[25050,at(z0,0,1),'ease'],[P1.swipe[0],at(z0,0,.9)],[P1.swipe[1],at(z1,0,.9),'ease'],
      [P1.swipe[1]+180,at(z1,0,1),'ease'],[26800,at(z1,30,1.1),'ease'],...tap(nextP,P1.next));
    for(const [k,t] of FAST){const v=NUMS[k].good;fpts.push([t+100,at(hx(163),0,1),'ease'],[t+250,at(hx(163),0,.9),INOUT],[t+800,at(hx(v),0,.9),'ease'],...tap(nextP,t+FT-420));}
    tr(fg,'transform',fpts);
    tr(fg,'opacity',[[0,0],[16850,0,OUT],[17100,.95],[NEXT1+600,.95,'ease'],[NEXT1+850,0],[22850,0,OUT],[23100,.95],[DONE+50,.95,'ease'],[DONE+350,0]]);
    // de knop onderaan: licht even op bij elke tik; bij de laatste ledline wordt "Volgende" "Klaar"
    const presses=[NEXT1,P1.next,...FAST.map(([,t])=>t+FT-420)],kp=[[0,'scale(1)']];
    for(const t of presses)kp.push([t+340,'scale(1)','ease'],[t+420,'scale(0.96)',OUT],[t+540,'scale(1)']);
    tr(q('[data-knext]'),'transform',kp);
    const lastIn=FAST[FAST.length-2][1]+FT;
    tr(q('[data-lab="next"]'),'opacity',[[0,1],[lastIn,1,'ease'],[lastIn+250,0]]);
    tr(q('[data-lab="done"]'),'opacity',[[0,0],[lastIn,0,'ease'],[lastIn+250,1],[DONE,1,'ease'],[DONE+250,0]]);
    // later een ledline erbij: hij verschijnt, de losse kabel loopt naar hem toe, hij gaat aan, een plusje
    {const NEW=['e','c','h'].map(c=>q(`[data-new${c}]`)),nc=NEW[1],Ln=nc.getTotalLength();for(const el of NEW)el.style.strokeDasharray=`${Ln.toFixed(1)}`;
      tr(q('[data-newg]'),'opacity',[[0,0],[32300,0,OUT],[32800,1]]);
      tr(q('[data-newp]'),'opacity',[[0,0],[32400,0,'ease'],[32700,1]]);   // een verlengkabel klikt op de losse kabel ...
      for(const el of NEW){tr(el,'strokeDashoffset',[[0,`-${Ln.toFixed(1)}px`],[32700,`-${Ln.toFixed(1)}px`,INOUT],[33500,'0px']]);   // ... en loopt naar de nieuwe ledline
        tr(el,'opacity',[[0,0],[32600,0],[32700,1]]);}
      tr(q('[data-npx]'),'transform',[[0,'scaleX(0)'],[33500,'scaleX(0)',OUT],[34150,'scaleX(1)']]);
      tr(q('[data-ngl]'),'opacity',[[0,0],[33600,0,'ease'],[34250,.75]]);
      tr(q('[data-nplus]'),'opacity',[[0,0],[33900,0,OUT],[34150,1],[END,1]]);
      tr(q('[data-nplus]'),'transform',[[0,'scale(0.3)'],[33900,'scale(0.3)',POP],[34300,'scale(1)']]);}
    tr(q('[data-mlhl]'),'opacity',[[0,0],[31900,0,'ease'],[32300,1],[32800,.35,'ease'],[33300,1,'ease'],[33800,.35,'ease'],[34300,1,'ease'],[34900,0]]);   // het kaartje "later een ledline bijhangen" licht op
    tr(q('[data-lab="go"]'),'opacity',[[0,0],[DONE,0,'ease'],[DONE+250,1]]);   // op het eindscherm: "Ga verder naar stap 2"
    // ondertitels en voortgang
    SUB_T.forEach(([a,b],i)=>{const el=root.querySelector(`[data-sub="${i}"]`),last=b>=END;
      tr(el,'opacity',[[-LEAD,0],[a,0,OUT],[a+450,1],...(last?[]:[[b-300,1,'ease'],[b,0]])]);
      tr(el,'transform',[[-LEAD,'translateY(6px)'],[a,'translateY(6px)',OUT],[a+450,'translateY(0px)'],...(last?[]:[[b-300,'translateY(0px)','ease'],[b,'translateY(-4px)']])]);});
    tr(root.querySelector('[data-ki-progress]>i'),'transform',[[-LEAD,'scaleX(0)'],[END,'scaleX(1)']]);
  }
  function say(i){const sr=root.querySelector('[data-ki-sr]');if(sr)sr.textContent=SUBS[i]||'';}
  // pauzeren om rustig te lezen: alles staat stil, de ondertitel blijft staan
  let paused=false;
  function setPaused(p){paused=p;const b=root.querySelector('[data-ki="pause"]');b.innerHTML=p?ICON_PLAY:ICON_PAUSE;b.setAttribute('aria-label',p?'Verder afspelen':'Pauzeren');root.classList.toggle('is-paused',p);}
  function togglePause(){
    if(staticMode||!anims.length||!root.querySelector('[data-ki-end]').hidden)return;
    if(!paused){anims.forEach(a=>a.pause());timers.forEach(clearTimeout);timers=[];setPaused(true);}
    else{const t=(anims[0].currentTime??0)/SLOW-LEAD;anims.forEach(a=>a.play());schedule(t);setPaused(false);}
  }
  function schedule(t0){SUB_T.forEach(([a],i)=>{if(a>=t0)timers.push(setTimeout(()=>say(i),(a-t0)*SLOW));});timers.push(setTimeout(()=>setEnd(true),Math.max(0,(END-t0)*SLOW)));}
  function setEnd(on){root.querySelector('[data-ki-end]').hidden=!on;root.querySelector('[data-ki="skip"]').hidden=on;root.querySelector('[data-ki-progress]').hidden=on||staticMode;
    root.querySelector('[data-ki="pause"]').hidden=on||staticMode;
    if(on)root.querySelector('[data-ki="close"]').focus({preventScroll:true});}
  function go(i){
    step=Math.max(0,Math.min(STEPS.length-1,i));
    anims.forEach(a=>{a.pause();a.currentTime=(STEPS[step]+LEAD)*SLOW;});
    root.querySelectorAll('.ki-dots i').forEach((d,j)=>d.classList.toggle('on',j===step));
    root.querySelector('[data-ki="prev"]').disabled=step===0;
    const last=step===STEPS.length-1;root.querySelector('[data-ki-steps]').hidden=last;setEnd(last);say(step);
  }
  function start(t0){
    timers.forEach(clearTimeout);timers=[];setEnd(false);
    const {L,fit}=build();timeline(L,fit);
    root.querySelector('[data-ki-steps]').hidden=!staticMode;root.querySelector('[data-ki-progress]').hidden=staticMode;root.querySelector('[data-ki="pause"]').hidden=staticMode;
    if(staticMode){go(Math.max(0,STEPS.findIndex(s=>s>=t0)));return;}
    anims.forEach(a=>{a.currentTime=(t0+LEAD)*SLOW;});
    setPaused(false);schedule(t0);
  }
  function open(){
    if(!root)root=shell();
    staticMode=reduce();step=0;root.hidden=false;document.documentElement.classList.add('ki-open');
    const dialog=root.parentElement;if(dialog&&!dialog.open){try{dialog.showModal();}catch(_){dialog.setAttribute('open','');}}
    if(!ro&&typeof ResizeObserver==='function'){ro=new ResizeObserver(()=>refit());ro.observe(root.querySelector('[data-ki-box]'));}
    requestAnimationFrame(()=>{start(-LEAD);root.querySelector('[data-ki="skip"]').focus({preventScroll:true});});
  }
  function close(){
    timers.forEach(clearTimeout);timers=[];anims.forEach(a=>a.cancel());anims=[];
    if(root){root.hidden=true;root.querySelector('[data-ki-fit]').innerHTML='';const dialog=root.parentElement;if(dialog?.open)dialog.close();}
    document.documentElement.classList.remove('ki-open');
    try{localStorage.setItem(KEY,'1');}catch(_){}
    $('[data-pixel-action="tutorial"]')?.focus({preventScroll:true});
  }
  return {open,close,SLOW,LEAD,END,seenBefore:()=>{try{return localStorage.getItem(KEY)==='1';}catch(_){return false;}}};
})();

window.LightningLedlineTutorial=Object.freeze({open:Intro.open,close:Intro.close,seen:Intro.seenBefore});
})();
