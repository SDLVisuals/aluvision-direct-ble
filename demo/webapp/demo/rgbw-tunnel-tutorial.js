/* Aluvision: de tutorial "Tunneleffecten" bij RGBW (C233). De uitleganimatie uit prototype rgbw-tunnel (C145p),
 * ongewijzigd in beeld en tijdlijn; alleen de verpakking is die van de app: een eigen <dialog> (zodat ze boven het
 * scherm "Zet je receivers in volgorde" ligt), het logo van de app en "al gezien" in localStorage.
 * Het verhaal (afspraak 11 november):
 *   a. 1 RGBW-receiver: zijn 4 ledlines hebben samen dezelfde kleur, dus nog geen tunneleffect;
 *   b. een 2e en 3e receiver in dezelfde zone; c. nu loopt het licht van receiver naar receiver;
 *   d. verkeerde volgorde: het licht springt heen en weer; juiste volgorde: het loopt mooi door;
 *   e. tip: 1 ledline per receiver geeft het fijnste tunneleffect;
 *   f. zo zet je de volgorde (het scherm van de app, zonder kanten); bij Klaar loopt één keer het testlicht.
 * Start nooit vanzelf: de app vraagt het één keer (tutorial-ask.js), daarna is er de knop "Bekijk tutorial" op het
 * scherm "Zet je receivers in volgorde". Dat scherm staat voorlopig alleen in de tester (tester-preview.js).
 * Alleen weergave: hier wordt niets naar een receiver gestuurd en niets bewaard behalve "al gezien".
 */
(function(){
// het icoon van "Ledlines instellen" op de telefoon in de tutorial (uit de tutorial van stap 1)
const MOCK=window.LightningLedlineTutorial?.setupMock||{};
const TunnelIntro=(()=>{
'use strict';
const reduce=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}};
const RA=window.AluvisionReceiverArt;
const LEAD=1200,END=36000,SLOW=1.25,KEY='aluvision.tunnelTutorial.c233';
const OUT='cubic-bezier(.2,.8,.2,1)',MOVE='cubic-bezier(.45,.05,.25,1)',SPRING='cubic-bezier(.34,1.56,.64,1)';
const ICON_PAUSE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5.5h3.2v13H7.5zM13.3 5.5h3.2v13h-3.2z"/></svg>';
const ICON_PLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
const ICON_REPLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5"/></svg>';
const ICON_CHECK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const ICON_CROSS='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
const ICON_GRIP='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6.5" r="1.5"/><circle cx="15" cy="6.5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="17.5" r="1.5"/><circle cx="15" cy="17.5" r="1.5"/></svg>';
const SUBS=['Tunneleffecten met RGBW.','Eén RGBW-receiver: zijn 4 ledlines hebben dezelfde kleur.','Voeg een 2e en 3e receiver toe aan dezelfde zone.',
  'Nu loopt het licht van receiver naar receiver.','Verkeerde volgorde? Dan springt het licht heen en weer.','Juiste volgorde: het licht loopt mooi door.',
  'Tip: 1 ledline per receiver geeft het fijnste tunneleffect.','Zet de volgorde: elke receiver brandt in een eigen kleur.',
  'Sleep de kaarten in de volgorde van je stand.','Klaar: het testlicht loopt van receiver naar receiver.',''];
const SUB_T=[[-1100,2000],[2000,4600],[4600,7600],[7600,11800],[11800,15400],[15400,19000],[19000,24000],[24000,27000],[27000,29500],[29500,33000],[33000,END]];
const STEPS=[300,3400,6600,10000,13600,17200,21600,25600,28600,31500,END];
// de stand: 3 receivers, elk met een groepje van 4 staande ledlines (zoals poorten van een tunnel)
const GX=[145,355,565],BAR={w:14,h:150,gap:22},BY=58,WW=710,GW=4*BAR.w+3*BAR.gap;
// C146p: kabels zoals op de stand. De receiver ligt onder zijn poort; de zwarte kabel buigt omhoog naar de witte splitter;
// de 4 even lange kabeltjes waaieren uit, elk met een witte schroefconnector; een verlengkabel loopt naar het kabeltje
// van elke ledline. Kabels en connectors iets groter getekend dan de receiver (KS), zodat je ze goed ziet.
const K=window.AlvKabels,RCV_S=.42,KS=.55,LEADV=6;
const RB0=RA?RA.build({type:'rgbw',view:'top',theme:'dark',outputs:[true,true,true,true],cable:0,power:true,powerCable:8,led:'#1FC45B',shadow:false,scale:RCV_S}):null;
// van de tekening alleen de receiver tot aan zijn kap; de zwarte kabel en de rest tekenen we zelf
const RB=RB0?(()=>{const vb=RB0.viewBox,x0=-RA.DIMENSIONS.XE-1.3,w=vb.x+vb.w-x0;
  return {svg:RB0.svg.replace(/viewBox="[^"]*"/,`viewBox="${x0} ${vb.y} ${w} ${vb.h}"`).replace(/ width="[\d.]+"/,` width="${(w*RCV_S).toFixed(2)}"`),width:w*RCV_S,height:RB0.height,
    port:{dx:.3*RCV_S,dy:-vb.y*RCV_S}};})():null;   // port = de uitgang (het rubber in de kap), vanaf de linker-bovenhoek
const AY=BY+BAR.h+LEADV+K.CL*KS;   // de onderkant van de connector onder elke ledline
// de vaste kabels van een receiver met zijn uitgang op p, kabel eerst in richting d0 en dan phi graden afbuigend:
// zwarte kabel, splitter, 4 even lange kabeltjes (fan = hoe ver ze uitwaaieren), connectors (op schaal k)
function kit(p,d0,l2,phi,len,fan,k,ks){const blk=K.bend(p,d0,3,l2,phi),sp=K.splitter(blk.end,blk.dir,ks),ends=K.fan4(sp.exits,sp.dir,len,fan);
  return {blk,sp,ends};}
const grpKit=(cx,py)=>kit(K.V(cx+4,py),K.V(-1,0),22,84,38,64,KS,KS);
const plugsOf=(kt,k,loose)=>kt.ends.map((e,i)=>K.plugAt(e.end,e.dir,loose&&loose(i)?K.MALE:K.PLUG,k));
// zo hoog dat er tussen de connectors aan de kabeltjes en de ledlines 44 px verlengkabel ligt
const PY=(()=>{if(!K||!RB)return BY+BAR.h+120;const t=plugsOf(grpKit(0,0),KS);return AY+44-Math.min(...t.map(q=>q.tip.y));})();
const RT=RB?PY-RB.port.dy:PY,FH=Math.round(RT+(RB?RB.height:28)+34);
const DIM='#cfcfca',FX='#9cc3ff',ID_COL={1:'#2F6BFF',2:'#1FC45B',3:'#F0473D'};   // in f: links Blauw, midden Groen, rechts Rood (zo hangen ze)
const LAYOUT={
  land:{W:1000,H:625,one:[GX[0],FH/2-10,330,300,1.4],three:[WW/2,FH/2,500,300,1.25],side:[WW/2,FH/2,335,300,.88],
    phone:{x:688,y:8,w:282,h:610},enter:'translate(70px,0px)'},
  port:{W:600,H:1000,one:[GX[0],FH/2-10,300,420,1.35],three:[WW/2,FH/2,300,420,.98],side:[WW/2,FH/2,300,104,.48],
    phone:{x:118,y:205,w:364,h:786},enter:'translate(0px,70px)'}
};
let root=null,anims=[],timers=[],layoutName='',staticMode=false,step=0,ro=null,paused=false;
const box=(x,y,w,h)=>`left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px`;
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
  el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Tutorial: tunneleffecten');
  el.innerHTML=`<div class="ki-top"><img src="assets/aluvision-logo.png" alt="Aluvision"><b>Tutorial</b><button type="button" class="ki-btn" data-ki="skip">Overslaan</button></div>`+
    `<div class="ki-box" data-ki-box><div class="ki-fit" data-ki-fit></div></div>`+
    `<div class="ki-subs" aria-hidden="true">${SUBS.map((s,i)=>i<SUBS.length-1?`<p class="ki-sub" data-sub="${i}">${s}</p>`:`<p class="ki-sub final" data-sub="${i}">Tunneleffecten staan aan.<span>Kies een effect op de Tunnel-pagina.</span></p>`).join('')}</div>`+
    `<p class="ki-sr" data-ki-sr aria-live="polite"></p>`+
    `<div class="ki-bottom"><button type="button" class="ki-btn hk-pause" data-ki="pause" aria-label="Pauzeren">${ICON_PAUSE}</button><div class="ki-progress" data-ki-progress><i></i></div>`+
    `<div class="ki-steps" data-ki-steps hidden><button type="button" class="ki-btn" data-ki="prev" aria-label="Vorige stap">‹</button><span class="ki-dots">${'<i></i>'.repeat(STEPS.length)}</span><button type="button" class="ki-btn" data-ki="next" aria-label="Volgende stap">›</button></div>`+
    `<div class="ki-end" data-ki-end hidden><button type="button" class="ki-btn" data-ki="replay">${ICON_REPLAY}Opnieuw</button><button type="button" class="ki-btn primary" data-ki="close">Aan de slag</button></div></div>`;
  el.addEventListener('click',e=>{const b=e.target.closest('[data-ki]');if(!b)return;
    ({skip:close,close,replay:()=>{step=0;start(-LEAD);},prev:()=>go(step-1),next:()=>go(step+1),pause:togglePause})[b.dataset.ki]?.();});
  el.querySelector('[data-ki-box]').addEventListener('click',()=>togglePause());
  el.addEventListener('keydown',e=>{if(e.key==='Escape')close();else if(staticMode&&e.key==='ArrowRight')go(step+1);else if(staticMode&&e.key==='ArrowLeft')go(step-1);});
  // een eigen <dialog>, zodat de tutorial boven het (modale) volgordescherm ligt
  const dialog=document.createElement('dialog');dialog.className='ki-dialog';dialog.setAttribute('aria-label','Tutorial: tunneleffecten');
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',()=>{if(root&&!root.hidden)close();});   // ook van buitenaf gesloten (terugknop): netjes opruimen
  dialog.append(el);document.body.append(dialog);return el;
}
// ---------- de stand ----------
function sceneHtml(){
  let h='';
  // de groepen: 4 staande ledlines (witte randjes links en rechts), een gloed, de receiver eronder, kabels, het nummer
  GX.forEach((cx,gi)=>{const g=gi+1,x0=cx-GW/2;
    // de rechtse ledline aan het rechtse kabeltje enzovoort: zo kruist er niets
    const kt=grpKit(cx,PY),tips=plugsOf(kt,KS);let cab=K.tube(kt.blk.d,'blk sm'),pl='';
    kt.ends.forEach((e,i)=>{const bx=x0+(3-i)*(BAR.w+BAR.gap)+BAR.w/2;
      cab+=K.tube(e.d,'sm')+K.tube(`M${bx.toFixed(1)} ${BY+BAR.h}V${BY+BAR.h+LEADV}`,'sm thin')+K.tube(K.link(tips[i].tip,e.dir,K.V(bx,AY),K.V(0,-1)).d,'sm');
      pl+=tips[i].html+K.plugV(bx,BY+BAR.h+LEADV,KS);});
    h+=`<div class="tnw-g" data-grp="${g}">`+
      `<i class="tnw-glow" data-glow="${g}" style="${box(x0-30,BY-20,GW+60,BAR.h+40)}"></i>`+
      `<svg class="tnw-cab hk-cables" width="${WW}" height="${FH}" viewBox="0 0 ${WW} ${FH}" aria-hidden="true">${cab}</svg>`+
      `<svg class="kb-layer" width="${WW}" height="${FH}" viewBox="0 0 ${WW} ${FH}" aria-hidden="true">${kt.sp.svg}</svg>`+
      Array.from({length:4},(_,j)=>`<i class="tnw-bar" data-bar="${g}" style="${box(x0+j*(BAR.w+BAR.gap),BY,BAR.w,BAR.h)}"></i>`).join('')+
      (RB?`<div class="tnw-rcv" style="${box(cx+4-RB.port.dx,RT,RB.width,RB.height)}">${RB.svg}</div>`:'')+`<div class="hk-free">${pl}</div>`+
      `<i class="tnw-num" style="${box(cx+4+(RB?RB.width/2:0)-14,RT+(RB?RB.height:28)+5,28,24)}">${g}</i></div>`;});
  // e: 8 ledlines, elk met een eigen kleine receiver
  {const S8=.3,K8=.42,R8=RA?RA.build({type:'rgbw',view:'top',theme:'dark',outputs:[true,true,true,true],cable:0,power:true,powerCable:6,led:'#1FC45B',shadow:false,scale:S8}):null;
    const vb=R8?R8.viewBox:null,x0=R8?-RA.DIMENSIONS.XE-1.3:0,w8=R8?(vb.x+vb.w-x0)*S8:0,h8=R8?R8.height:0,svg8=R8?R8.svg.replace(/viewBox="[^"]*"/,`viewBox="${x0} ${vb.y} ${vb.x+vb.w-x0} ${vb.h}"`).replace(/ width="[\d.]+"/,` width="${w8.toFixed(2)}"`):'';
    const pdx=R8?.3*S8-w8/2:0,pdy=R8?-vb.y*S8-h8/2:0;   // de uitgang tegenover het midden van de tekening
    let c8='',sp8='',pl8='',r8='';
    for(let k=0;k<8;k++){const cx=WW/2+(k-3.5)*72,p=K.V(cx+5,FH-36-w8),kt=kit(p,K.V(0,-1),12,-8,22,44,K8,K8),tp=plugsOf(kt,K8,i=>i!==1);
      const ay=BY+BAR.h+LEADV+K.CL*K8;
      c8+=K.tube(kt.blk.d,'blk sm')+kt.ends.map(e=>K.tube(e.d,'sm')).join('')+K.tube(`M${cx} ${BY+BAR.h}V${BY+BAR.h+LEADV}`,'sm thin')+K.tube(K.link(tp[1].tip,kt.ends[1].dir,K.V(cx,ay),K.V(0,-1)).d,'sm');
      sp8+=kt.sp.svg;pl8+=tp.map(q=>q.html).join('')+K.plugV(cx,BY+BAR.h+LEADV,K8);
      // de receiver rechtop (gedraaid), met zijn uitgang bovenaan op p
      if(R8)r8+=`<div class="tnw-rcv" style="${box(p.x+pdy-w8/2,p.y-pdx-h8/2,w8,h8)};transform:rotate(90deg)">${svg8}</div>`;
      r8+=`<i class="tnw-bar is-8" data-bar8="${k}" style="${box(cx-BAR.w/2,BY,BAR.w,BAR.h)}"></i>`;}
    h+=`<div class="tnw-g8" data-g8><svg class="tnw-cab hk-cables" width="${WW}" height="${FH}" viewBox="0 0 ${WW} ${FH}" aria-hidden="true">${c8}</svg>`+
      `<svg class="kb-layer" width="${WW}" height="${FH}" viewBox="0 0 ${WW} ${FH}" aria-hidden="true">${sp8}</svg>${r8}<div class="hk-free">${pl8}</div></div>`;}
  // labels: nog niet mogelijk / mogelijk; de volgorde in de app (verkeerd / juist); tip
  h+=`<i class="tnw-pill no" data-pno style="${box(GX[0]-120,8,240,30)}"><b>Nog geen tunneleffect</b></i>`+
    `<i class="tnw-pill yes" data-pyes style="${box(WW/2-120,8,240,30)}"><b>Tunneleffect mogelijk ✓</b></i>`+
    `<i class="tnw-pill app bad" data-pbad style="${box(WW/2-125,8,250,30)}"><b>In de app: 1 › 3 › 2</b><em>${ICON_CROSS}</em></i>`+
    `<i class="tnw-pill app good" data-pgood style="${box(WW/2-125,8,250,30)}"><b>In de app: 1 › 2 › 3</b><em>${ICON_CHECK}</em></i>`+
    `<i class="tnw-pill tip" data-ptip style="${box(WW/2-140,8,280,30)}"><b>1 ledline per receiver</b></i>`;
  return h;
}
// ---------- de telefoon: het volgordescherm van de app (RGBW: zoals SPI, zonder kanten) ----------
const CARDS=[['B','Blauw','#2F6BFF'],['R','Rood','#F0473D'],['G','Groen','#1FC45B']],CSTEP=58;
function phoneHtml(L){
  const p=L.phone,bz=+(p.w*.024).toFixed(1),sw=p.w-2*bz,sh=p.h-2*bz,R=p.w*.155,stH=+(sw*.118).toFixed(1),hmH=+(sw*.07).toFixed(1),sc=sw/300,lh=(sh-stH-hmH)/sc;
  const rcv='<svg viewBox="0 0 44 16" aria-hidden="true"><path d="M1 8h6" stroke="#1c1c1e" stroke-width="2.4" stroke-linecap="round"/><rect x="7" y="2.5" width="30" height="11" rx="2.4" fill="#1c1c1e"/><circle cx="30" cy="6" r="1.3" fill="#1FC45B"/><path d="M37 8h6" stroke="#bbb" stroke-width="2" stroke-linecap="round"/></svg>';
  const status=`<div class="rti-status" style="height:${stH}px;font-size:${(sw*.04).toFixed(1)}px"><b>9:41</b><span>`+
    `<svg viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx=".7"/><rect x="5" y="5.5" width="3" height="6.5" rx=".7"/><rect x="10" y="3" width="3" height="9" rx=".7"/><rect x="15" y="0" width="3" height="12" rx=".7"/></svg>`+
    `<svg viewBox="0 0 16 12" aria-hidden="true"><path d="M8 11.2 5.6 8.6a3.4 3.4 0 0 1 4.8 0zM3.4 6.4a6.6 6.6 0 0 1 9.2 0L11.1 8a4.4 4.4 0 0 0-6.2 0zM1.1 4.1a9.8 9.8 0 0 1 13.8 0l-1.5 1.6a7.6 7.6 0 0 0-10.8 0z"/></svg>`+
    `<svg viewBox="0 0 27 13" aria-hidden="true"><rect x=".6" y=".6" width="22.8" height="11.8" rx="3.6" fill="none" stroke-width="1.1" opacity=".45"/><rect x="2.3" y="2.3" width="19.4" height="8.4" rx="2.2"/><path d="M25 4.5v4a2 2 0 0 0 0-4z" opacity=".5"/></svg></span></div>`;
  const cards=CARDS.map(([k,n,c],i)=>`<div class="tnm-card" data-tc="${k}" style="top:${i*CSTEP}px;--c:${c}"><span class="tnm-name">${n}</span>`+
    `<span class="tnm-strip"><i class="tnm-rcv">${rcv}</i><i class="tnm-bar"><i class="tnm-band" data-tband="${k}"></i></i></span><span class="tnm-grip" data-tgrip="${k}">${ICON_GRIP}</span></div>`).join('');
  return `<div class="rti" data-phone style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px">`+
    `<i class="rti-b l" style="top:18%;height:4%"></i><i class="rti-b l" style="top:25.5%;height:7.5%"></i><i class="rti-b l" style="top:34.5%;height:7.5%"></i>`+
    `<i class="rti-b r" style="top:27%;height:11.5%"></i><i class="rti-b r" style="top:56%;height:6.5%"></i>`+
    `<div class="rti-body" style="border-radius:${R.toFixed(1)}px"><div class="rti-screen" style="inset:${bz}px;border-radius:${(R-bz).toFixed(1)}px">`+status+
    `<i class="rti-island" style="top:${(sw*.026).toFixed(1)}px;width:${(sw*.29).toFixed(1)}px;height:${(sw*.085).toFixed(1)}px"></i>`+
    `<i class="rti-home" style="bottom:${(hmH*.32).toFixed(1)}px;width:${(sw*.36).toFixed(1)}px"></i>`+
    `<div class="rtm tnm" style="top:${stH}px;height:${lh.toFixed(1)}px;transform:scale(${sc.toFixed(4)})">`+
      `<div class="tnm-head"><i>${typeof MOCK.icon==='function'?MOCK.icon():''}</i><span><b>Volgorde van je receivers</b><small>Voor tunneleffecten in deze zone.</small></span></div>`+
      `<small class="tnm-zone">Zone Rgbw · 3 RGBW-receivers</small><b class="tnm-title">Zet je receivers in volgorde</b>`+
      `<span class="tnm-say">Elke receiver brandt in een eigen kleur. Kijk naar je stand: <b>sleep de kaarten in dezelfde volgorde.</b></span>`+
      `<small class="tnm-ovl">Jouw volgorde</small><div class="tnm-ov">${CARDS.map(([k,,c],i)=>`<i data-tov="${k}" style="left:${(i*33.6).toFixed(1)}%;background:${c}"><i class="tnm-band" data-tovband="${k}"></i></i>`).join('')}</div>`+
      `<div class="tnm-list"><div class="tnm-ranks">${[1,2,3].map(i=>`<b style="top:${(i-1)*CSTEP}px">${i}</b>`).join('')}</div><div class="tnm-cards">${cards}</div></div>`+
      `<span class="tnm-btn" data-tklaar><i data-tklaaron></i><span>Klaar</span>${ICON_CHECK}</span><span class="tnm-toast" data-ttoast>Volgorde bewaard</span>`+
    `</div></div></div></div>`;
}
// Liggend of staand. Gemeten op beeld + ondertitel samen: die som verandert niet met de indeling. (De ondertitel is
// staand 16 px hoger; kiezen op het beeld alleen kon op de grens blijven wisselen, en dan herbegon de animatie telkens.)
function pickLayout(box){const subs=root.querySelector('.ki-subs'),h=box.clientHeight+(subs?subs.offsetHeight-104:0);return box.clientWidth/Math.max(1,h)>=1.05?'land':'port';}
function build(){
  const bx=root.querySelector('[data-ki-box]'),fit=root.querySelector('[data-ki-fit]'),bw=bx.clientWidth,bh=bx.clientHeight;
  layoutName=pickLayout(bx);const L=LAYOUT[layoutName];
  root.dataset.layout=layoutName;fit.style.width=L.W+'px';fit.style.height=L.H+'px';fit.style.setProperty('--ki-scale',Math.min(bw/L.W,bh/L.H).toFixed(4));
  fit.innerHTML=`<div class="ki-world tnw" data-world style="left:${L.W/2-WW/2}px;top:${L.H/2-FH/2}px;width:${WW}px;height:${FH}px">${sceneHtml()}</div>`+phoneHtml(L)+'<i class="ki-finger" data-finger></i>';
  return {L,fit};
}
function refit(){
  if(!root||root.hidden)return;
  const bx=root.querySelector('[data-ki-box]'),bw=bx.clientWidth,bh=bx.clientHeight,want=pickLayout(bx);
  if(want!==layoutName){start((anims[0]?.currentTime??0)/SLOW-LEAD);return;}
  const L=LAYOUT[layoutName];root.querySelector('[data-ki-fit]').style.setProperty('--ki-scale',Math.min(bw/L.W,bh/L.H).toFixed(4));
}
const camAt=(L,[wx,wy,px,py,s])=>`translate(${(px-L.W/2-(wx-WW/2)*s).toFixed(1)}px,${(py-L.H/2-(wy-FH/2)*s).toFixed(1)}px) scale(${s})`;
function timeline(L,fit){
  anims.forEach(a=>a.cancel());anims=[];
  const q=s=>fit.querySelector(s),qa=s=>[...fit.querySelectorAll(s)],sc=parseFloat(fit.style.getPropertyValue('--ki-scale'))||1,fr=fit.getBoundingClientRect();
  const pos=el=>{const r=el.getBoundingClientRect();return [(r.left+r.width/2-fr.left)/sc,(r.top+r.height/2-fr.top)/sc];};
  // posities in de telefoon meten vóór er iets beweegt
  const GRIP_G=pos(q('[data-tgrip="G"]')),GRIP_R=pos(q('[data-tgrip="R"]')),KLAAR=pos(q('[data-tklaar]'));
  // 1. camera
  const camD=(n,f)=>{const v=L[n].slice();v[4]*=f;return camAt(L,v);};
  const SHOTS=[['one',-LEAD,3800],['three',4600,23700],['side',24300,END]];
  tr(q('[data-world]'),'transform',SHOTS.flatMap(([n,a,d],i)=>[[a,camD(n,1)],[d,camD(n,1.03),i<SHOTS.length-1?MOVE:undefined]]));
  // 2. de kleur van elke groep (RGBW: de 4 ledlines van een receiver altijd samen in dezelfde kleur)
  const col={1:[[-LEAD,'#F0473D']],2:[[-LEAD,DIM]],3:[[-LEAD,DIM]]},glo={1:[[-LEAD,.85]],2:[[-LEAD,0]],3:[[-LEAD,0]]};
  const set=(g,t,c,o,e)=>{col[g].push([t,c,e]);glo[g].push([t,o,e]);};
  const flash=(g,t,c=FX,len=420)=>{set(g,t-140,DIM,0,'ease');set(g,t,c,.95,'ease');set(g,t+len,c,.95,'ease');set(g,t+len+260,DIM,0);};
  // a: samen wisselen
  ['#F0473D','#2F6BFF','#1FC45B','#9B4DFF','#FFC61A','#F0473D'].forEach((c,i)=>{const t=-600+i*900;set(1,t,c,.85,'ease');set(1,t+620,c,.85);});
  set(1,4500,c0(4500),.85,'ease');set(1,4800,DIM,0);
  function c0(){return '#F0473D';}
  // c: van receiver naar receiver
  for(let k=0;k<3;k++){const t0=8000+k*1250;[1,2,3].forEach((g,i)=>flash(g,t0+i*400));}
  // d: verkeerde volgorde (1 › 3 › 2): links, rechts, midden; daarna juist (1 › 2 › 3)
  for(let k=0;k<2;k++){const t0=12200+k*1500;[1,3,2].forEach((g,i)=>flash(g,t0+i*420,'#FF8A5C'));}
  for(let k=0;k<2;k++){const t0=15800+k*1450;[1,2,3].forEach((g,i)=>flash(g,t0+i*400));}
  // f: elke receiver in een eigen kleur (links Blauw, midden Groen, rechts Rood); testlicht na Klaar; daarna een tunnel
  const T_ID=24400,T_KLAAR=29500,T_TEST=29800;
  [1,2,3].forEach(g=>{set(g,T_ID,DIM,0,'ease');set(g,T_ID+400,ID_COL[g],.8);set(g,T_TEST-200,ID_COL[g],.8,'ease');set(g,T_TEST+100,'#7a2a26',.25);});
  [1,2,3].forEach((g,i)=>{const t=T_TEST+500+i*650;set(g,t-120,'#7a2a26',.25,'ease');set(g,t+60,'#ffffff',1,'ease');set(g,t+420,'#ffffff',1,'ease');set(g,t+700,'#7a2a26',.25);});
  [1,2,3].forEach(g=>{set(g,32600,'#7a2a26',.25,'ease');set(g,33000,DIM,0);});
  for(let k=0;k<2;k++){const t0=33300+k*1300;[1,2,3].forEach((g,i)=>flash(g,t0+i*380));}
  [1,2,3].forEach(g=>{qa(`[data-bar="${g}"]`).forEach(b=>tr(b,'backgroundColor',col[g]));tr(q(`[data-glow="${g}"]`),'backgroundColor',col[g]);tr(q(`[data-glow="${g}"]`),'opacity',glo[g]);});
  // b: de 2e en 3e receiver komen erbij
  tr(q('[data-grp="2"]'),'opacity',[[-LEAD,0],[4900,0,OUT],[5500,1]]);tr(q('[data-grp="2"]'),'transform',[[-LEAD,'translateY(18px)'],[4900,'translateY(18px)',OUT],[5600,'translateY(0px)']]);
  tr(q('[data-grp="3"]'),'opacity',[[-LEAD,0],[5600,0,OUT],[6200,1]]);tr(q('[data-grp="3"]'),'transform',[[-LEAD,'translateY(18px)'],[5600,'translateY(18px)',OUT],[6300,'translateY(0px)']]);
  // e: 8 ledlines, elk een eigen receiver
  for(const s of ['[data-grp="1"]','[data-grp="2"]','[data-grp="3"]'])tr(q(s),'filter',[[-LEAD,'opacity(1)'],[18900,'opacity(1)','ease'],[19300,'opacity(0)'],[23700,'opacity(0)','ease'],[24200,'opacity(1)']]);
  tr(q('[data-g8]'),'opacity',[[-LEAD,0],[19000,0,'ease'],[19400,1],[23600,1,'ease'],[24000,0]]);
  qa('[data-bar8]').forEach((b,k)=>{const pts=[[-LEAD,DIM]];for(let r=0;r<3;r++){const t=19700+r*1350+k*130;pts.push([t-60,DIM,'ease'],[t,FX,'ease'],[t+230,FX,'ease'],[t+420,DIM]);}tr(b,'backgroundColor',pts);});
  // de labels
  tr(q('[data-pno]'),'opacity',[[-LEAD,0],[-300,0,OUT],[150,1],[7600,1,'ease'],[7900,0]]);
  tr(q('[data-pno]'),'transform',[[-LEAD,'translateX(0px)'],[4400,'translateX(0px)',MOVE],[5400,`translateX(${WW/2-GX[0]}px)`]]);
  tr(q('[data-pyes]'),'opacity',[[-LEAD,0],[7900,0,OUT],[8300,1],[11500,1,'ease'],[11800,0]]);
  tr(q('[data-pyes]'),'transform',[[-LEAD,'scale(.7)'],[7900,'scale(.7)',SPRING],[8400,'scale(1)']]);
  tr(q('[data-pbad]'),'opacity',[[-LEAD,0],[11900,0,OUT],[12200,1],[15200,1,'ease'],[15400,0]]);
  tr(q('[data-pgood]'),'opacity',[[-LEAD,0],[15400,0,OUT],[15700,1],[18700,1,'ease'],[19000,0]]);
  tr(q('[data-ptip]'),'opacity',[[-LEAD,0],[19200,0,OUT],[19600,1],[23500,1,'ease'],[23800,0]]);
  // 3. de telefoon (f): het volgordescherm; slepen (Groen van plaats 3 naar 2), Klaar, testlicht
  tr(q('[data-phone]'),'opacity',[[-LEAD,0],[24300,0,OUT],[25100,1]]);
  tr(q('[data-phone]'),'transform',[[-LEAD,L.enter],[24300,L.enter,OUT],[25100,'translate(0px,0px)']]);
  const T_GRAB=27000,T_MOVE=27400,T_DROP=28300;
  tr(q('[data-tc="G"]'),'transform',[[-LEAD,'translateY(0px) scale(1)'],[T_GRAB,'translateY(0px) scale(1)',OUT],[T_GRAB+250,'translateY(0px) scale(1.04)'],[T_MOVE,'translateY(0px) scale(1.04)',MOVE],[T_DROP,`translateY(${-CSTEP}px) scale(1.04)`,OUT],[T_DROP+250,`translateY(${-CSTEP}px) scale(1)`]]);
  tr(q('[data-tc="G"]'),'boxShadow',[[-LEAD,'0 0 0 0 rgba(0,0,0,0)'],[T_GRAB,'0 0 0 0 rgba(0,0,0,0)','ease'],[T_GRAB+250,'0 14px 26px -10px rgba(0,0,0,.45)'],[T_DROP,'0 14px 26px -10px rgba(0,0,0,.45)','ease'],[T_DROP+250,'0 0 0 0 rgba(0,0,0,0)']]);
  tr(q('[data-tc="R"]'),'transform',[[-LEAD,'translateY(0px)'],[T_MOVE+250,'translateY(0px)',MOVE],[T_DROP-80,`translateY(${CSTEP}px)`]]);
  tr(q('[data-tov="G"]'),'transform',[[-LEAD,'translateX(0%)'],[T_MOVE+250,'translateX(0%)',MOVE],[T_DROP,'translateX(-100%)']]);
  tr(q('[data-tov="R"]'),'transform',[[-LEAD,'translateX(0%)'],[T_MOVE+250,'translateX(0%)',MOVE],[T_DROP,'translateX(100%)']]);
  tr(q('[data-tklaaron]'),'opacity',[[-LEAD,0],[T_KLAAR-40,0],[T_KLAAR,1,'ease'],[T_KLAAR+300,0]]);
  // testlicht in de app: over het overzicht en de kaarten, in dezelfde volgorde als op de stand
  [['B',0],['G',1],['R',2]].forEach(([k,i])=>{const t=T_TEST+500+i*650;
    tr(q(`[data-tband="${k}"]`),'transform',[[-LEAD,'translateX(-120%)'],[t-200,'translateX(-120%)'],[t+600,'translateX(260%)']]);
    tr(q(`[data-tovband="${k}"]`),'transform',[[-LEAD,'translateX(-120%)'],[t-200,'translateX(-120%)'],[t+600,'translateX(260%)']]);});
  tr(q('[data-ttoast]'),'opacity',[[-LEAD,0],[32400,0,OUT],[32700,1],[34800,1,'ease'],[35200,0]]);
  // de vinger: Groen vastnemen (even ingedrukt), naar plaats 2 schuiven, loslaten; dan Klaar
  const fg=q('[data-finger]'),at=(p,dy=0,s=1)=>`translate(${p[0].toFixed(1)}px,${(p[1]+dy).toFixed(1)}px) scale(${s})`;
  const dest=[GRIP_G[0],GRIP_R[1]];
  tr(fg,'transform',[[-LEAD,at(GRIP_G,60,1.15)],[T_GRAB-500,at(GRIP_G,50,1.15),OUT],[T_GRAB-150,at(GRIP_G,0,1),'ease'],[T_GRAB,at(GRIP_G,0,.86)],
    [T_MOVE,at(GRIP_G,0,.86),MOVE],[T_DROP,at(dest,0,.86),OUT],[T_DROP+150,at(dest,0,1),'ease'],[T_KLAAR-450,at(KLAAR,40,1.1),OUT],[T_KLAAR-120,at(KLAAR,0,1),'ease'],[T_KLAAR,at(KLAAR,0,.84),OUT],[T_KLAAR+120,at(KLAAR,0,1)]]);
  tr(fg,'opacity',[[-LEAD,0],[T_GRAB-700,0,'ease'],[T_GRAB-450,.95],[T_KLAAR+250,.95,'ease'],[T_KLAAR+550,0]]);
  // ondertitels en voortgang
  SUB_T.forEach(([a,b],i)=>{const el=root.querySelector(`[data-sub="${i}"]`),last=b>=END;
    tr(el,'opacity',[[-LEAD,0],[a,0,OUT],[a+450,1],...(last?[]:[[b-300,1,'ease'],[b,0]])]);
    tr(el,'transform',[[-LEAD,'translateY(6px)'],[a,'translateY(6px)',OUT],[a+450,'translateY(0px)'],...(last?[]:[[b-300,'translateY(0px)','ease'],[b,'translateY(-4px)']])]);});
  tr(root.querySelector('[data-ki-progress]>i'),'transform',[[-LEAD,'scaleX(0)'],[END,'scaleX(1)']]);
}
function say(i){const sr=root.querySelector('[data-ki-sr]');if(sr)sr.textContent=i<SUBS.length-1?SUBS[i]:'Tunneleffecten staan aan. Kies een effect op de Tunnel-pagina.';}
function setPaused(p){paused=p;const b=root.querySelector('[data-ki="pause"]');b.innerHTML=p?ICON_PLAY:ICON_PAUSE;b.setAttribute('aria-label',p?'Verder afspelen':'Pauzeren');root.classList.toggle('is-paused',p);}
function togglePause(){
  if(staticMode||!anims.length||!root.querySelector('[data-ki-end]').hidden)return;
  if(!paused){anims.forEach(a=>a.pause());timers.forEach(clearTimeout);timers=[];setPaused(true);}
  else{const t=(anims[0].currentTime??0)/SLOW-LEAD;anims.forEach(a=>a.play());schedule(t);setPaused(false);}
}
function schedule(t0){SUB_T.forEach(([a],i)=>{if(a>=t0)timers.push(setTimeout(()=>say(i),(a-t0)*SLOW));});timers.push(setTimeout(()=>setEnd(true),Math.max(0,(END-t0)*SLOW)));}
function setEnd(on){root.querySelector('[data-ki-end]').hidden=!on;root.querySelector('[data-ki="skip"]').hidden=on;root.querySelector('[data-ki-progress]').hidden=on||staticMode;
  root.querySelector('[data-ki="pause"]').hidden=on||staticMode;if(on)root.querySelector('[data-ki="close"]').focus({preventScroll:true});}
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
  if(!RA||!K)return;
  if(!root)root=shell();
  staticMode=reduce();step=0;root.hidden=false;document.documentElement.classList.add('ki-open');
  {const dialog=root.parentElement;if(dialog&&!dialog.open){try{dialog.showModal();}catch(_){dialog.setAttribute('open','');}}}
  if(!ro&&typeof ResizeObserver==='function'){ro=new ResizeObserver(()=>refit());ro.observe(root.querySelector('[data-ki-box]'));}
  requestAnimationFrame(()=>{if(!root||root.hidden)return;start(-LEAD);root.querySelector('[data-ki="skip"]').focus({preventScroll:true});});
}
function close(){
  timers.forEach(clearTimeout);timers=[];anims.forEach(a=>a.cancel());anims=[];
  if(root){root.hidden=true;root.querySelector('[data-ki-fit]').innerHTML='';const dialog=root.parentElement;if(dialog?.open)dialog.close();}
  document.documentElement.classList.remove('ki-open');
  try{localStorage.setItem(KEY,'1');}catch(_){}
}
return {open,close,SLOW,LEAD,END,seenBefore:()=>{try{return localStorage.getItem(KEY)==='1';}catch(_){return false;}}};
})();
window.LightningTunnelTutorial=Object.freeze({open:TunnelIntro.open,close:TunnelIntro.close,seen:TunnelIntro.seenBefore});
})();
