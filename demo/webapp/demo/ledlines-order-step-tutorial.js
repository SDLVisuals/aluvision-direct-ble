/* Aluvision: tutorial van stap 2 "Looprichting" (volgorde en kanten in één scherm; C229). De uitleganimatie uit prototype ketting-leggen (C141p),
 * ongewijzigd in beeld en tijdlijn; alleen de verpakking is die van de app:
 *   - een eigen <dialog>, zodat de tutorial boven het modale scherm van stap 2 ligt (zoals de tutorial van stap 1);
 *   - pauzeren (knop linksonder, of een tik op het beeld), zoals de tutorial van stap 1;
 *   - de kop op de telefoon komt uit ledlines-tutorial.js (dezelfde kop als in de tutorial van stap 1).
 * Het verhaal: elke ledline krijgt een kleur; je sleept de kaarten in de volgorde van je stand; daarna loopt het einde
 * van elke ledline over in de kleur van de volgende, en waar je een sprong ziet draai je de ledline om; het testlicht
 * toont of alles klopt. Met "beweging beperken" worden het stilstaande stappen.
 * Start nooit vanzelf: de app vraagt het één keer (tutorial-ask.js), daarna is er de knop "Bekijk tutorial".
 * Alleen weergave: hier wordt niets naar een receiver gestuurd en niets bewaard behalve "al gezien" (localStorage).
 */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const css=c=>`rgb(${c.map(v=>Math.max(0,Math.min(255,Math.round(v)))).join(',')})`;
const lin=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);};
const unlin=v=>255*(v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055);
const mix=(a,b,t)=>a.map((v,i)=>unlin(lin(v)*(1-t)+lin(b[i])*t));
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const reduce=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}};
const tailBg=(own,next,deg)=>`linear-gradient(${deg}deg,${css(own)} 0%,${css(mix(own,next,.5))} 12%,${css(next)} 28%,${css(next)} 100%)`;
// de kop van "Ledlines instellen" op de telefoon in de tutorial (uit de tutorial van stap 1)
const MOCK=window.LightningLedlineTutorial?.setupMock||{mockHead:()=>'',mockSteps:()=>''};
const ICON_FLIP='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17 3 4 4-4 4M3 7h18M7 21l-4-4 4-4m14 4H3"/></svg>';
const ICON_GRIP='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6.5" r="1.5"/><circle cx="15" cy="6.5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="17.5" r="1.5"/><circle cx="15" cy="17.5" r="1.5"/></svg>';
const ICON_TEST='<svg viewBox="0 0 28 14" aria-hidden="true"><rect x="1" y="3.5" width="26" height="7" rx="1.5" fill="#F0473D"/><rect x="1" y="3.5" width="26" height="1.5" fill="#fff" opacity=".9"/><rect x="1" y="9" width="26" height="1.5" fill="#fff" opacity=".9"/>'+
  '<g class="tl-dot"><circle cx="17" cy="7" r="4.8" fill="#fff" opacity=".4"/><circle cx="17" cy="7" r="2.6" fill="#fff"/></g></svg>';
const ICON_CHECK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const ICON_BACK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
const ICON_NEXT='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const ICON_CROSS='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
const ICON_REPLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5"/></svg>';
const ICON_PLUG='<svg viewBox="0 0 44 16" aria-hidden="true"><path class="co" d="M1 8H3.5M30.5 8H44"/><path class="ci" d="M1 8H3.5M30.5 8H44"/>'+
  '<rect class="w" x="3" y="5" width="4" height="6" rx="1"/><path class="l" d="M4.3 5.8v4.4M5.7 5.8v4.4"/><rect class="w" x="7" y="4" width="4" height="8" rx="1.2"/>'+
  '<rect class="w" x="11" y="2" width="8" height="12" rx="2"/><path class="l" d="M13 3.4v9.2M15 3.4v9.2M17 3.4v9.2"/><rect class="r" x="19" y="3.6" width="1.6" height="8.8" rx=".6"/>'+
  '<rect class="w" x="20.6" y="4" width="6" height="8" rx="1.2"/><rect class="w" x="26.6" y="5" width="4.4" height="6" rx="1"/><path class="l" d="M27.9 5.8v4.4M29.3 5.8v4.4"/></svg>';
const ICON_PLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
const ICON_PAUSE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5.5h3.2v13H7.5zM13.3 5.5h3.2v13h-3.2z"/></svg>';

const Intro=(()=>{
  // Verhaaltijd in ms (×1,25 = echte tijd). Ze begint bij -LEAD met de lijntekening; daarna licht de eerste ledline op.
  const LEAD=1200,END=29600,SLOW=1.25,KEY='aluvision.ledlinesOrderTutorial.c229';   // samen ≈ 38,5 s
  const C={blauw:hex('#2F6BFF'),geel:hex('#FFC61A'),paars:hex('#9B4DFF'),groen:hex('#1FC45B')},RED=hex('#F0473D');
  const NAME={blauw:'Blauw',geel:'Geel',paars:'Paars',groen:'Groen'};
  const ORDER=['blauw','geel','paars','groen'];                         // links naar rechts
  const NEXT={blauw:'geel',geel:'paars',paars:'groen',groen:'blauw'};   // de laatste loopt over in de eerste: zo zie je ook daar of hij goed staat
  const PAIRS=[['blauw','geel',9900],['geel','paars',10150],['paars','groen',10400],['groen','blauw',10650]]; // stap 2: per aansluiting verschijnt de overgang
  const CONN={blauw:'right',geel:'right',paars:'right',groen:'left'};   // blauw, geel en paars hangen andersom (connector rechts)
  // geen kader: alleen de ledlines (24 pixels elk, overloop = 8 pixels), groot en duidelijk. Tussen twee ledlines is
  // plaats voor twee connectors naast elkaar (bij paars → groen hangen ze allebei in dezelfde opening).
  const PITCH=9,NPX=24,LEN=PITCH*NPX,GAPX=36,M=12,FW=4*LEN+3*GAPX+2*M,FH=120,LY=42,TAILW=8*PITCH,SH=30,DH=22,CAP=0,RIM=4.5;   // RIM = de witte rand boven en onder (de flenzen van de sleeve)
  const LX0={blauw:M,geel:M+LEN+GAPX,paars:M+2*(LEN+GAPX),groen:M+3*(LEN+GAPX)};
  // bij de start staat de eerste ledline helemaal in beeld, met zijn connector eronder (FOCUS, FY0 = midden van dat beeld)
  const FOCUS=LX0.blauw+LEN/2+(CONN.blauw==='left'?-5:5),FY0=LY+16,JJ=[(LX0.blauw+LEN+LX0.geel)/2,(LX0.geel+LEN+LX0.paars)/2,(LX0.paars+LEN+LX0.groen)/2];
  const WAVE_P=360,WAVE_T0=26350,WAVE_D=2400;
  const EASE='cubic-bezier(.32,.72,0,1)',INOUT='cubic-bezier(.65,0,.35,1)',OUT='cubic-bezier(.2,.8,.2,1)',POP='cubic-bezier(.3,1.5,.5,1)';
  // Eén korte, gewone zin per scène, in de woorden van de gebruiker.
  const SUBS=['Wil je je ledlines als één geheel zien?','Elke ledline krijgt een kleur toegewezen.','We beginnen met de volgorde.',
    'Je maakt na wat je op je stand ziet.','Je versleept ze heel makkelijk in de app.','Dan laat je de kleuren doorlopen.',
    'Zie je een sprong?','Tik om te draaien.','Doe dat bij elke sprong.','Nu loopt het mooi door.','Met het testlicht zie je of alles klopt.','Klaar. Je animaties lopen nu mooi door.'];
  const SUB_T=[[-1100,1500],[1700,4850],[5150,6250],[6350,7700],[7800,9450],[9700,11300],[11550,12900],[12950,14700],[14800,17850],[17950,19200],[19300,25000],[26150,END]];
  const STEPS=[200,4600,6000,7200,8600,11000,12600,13800,16000,18800,22300,END];   // stilstaande stappen (beweging beperken): één per ondertitel
  const SWITCH=9450;   // de vinger tikt op "Volgende stap": stap 2
  // vastpakken (stap 1): de ledline pulseert in zijn eigen kleur. Omdraaien (scène 5): [aansluiting, ledline, start van de draai].
  const GRAB={blauw:[6560,7370],geel:[7810,8870]};
  const FIX=[[2,'paars',14000],[1,'geel',16100],[0,'blauw',16850]],FLIPAT=Object.fromEntries(FIX.map(([,k,t])=>[k,t]));
  // testlicht: alles rustig naar rood, dan één brede, zachte witte band met vaste snelheid over alle ledlines, en terug
  const TEST={red:19800,go:20400,stop:24400,back:25000},BW=200,XS=LX0.blauw-BW,XE=LX0.groen+LEN+BW;
  // camera: (x in de rij, plaats op het doek, schaal)
  const LAYOUT={
    land:{W:1000,H:625,restS:1,z0:2.8,zclip:2.2,zin:1.75,side:[FW/2,305,300,.57],tails:[LX0.geel+LEN,300,300,.85],focus:[LX0.paars+LEN/2,300,300,1.1],phone:{x:600,y:10,w:330,h:606},zoom:1.75,enter:'translate(70px,0px)',step:64},
    port:{W:600,H:1000,restS:.58,z0:1.67,zclip:1.35,zin:1.1,side:[FW/2,300,210,.58],tails:[LX0.geel+LEN,300,210,.9],focus:[LX0.paars+LEN/2,300,210,1.15],phone:{x:40,y:330,w:520,h:600},zoom:1.6,enter:'translate(0px,70px)',step:64}
  };
  let root=null,anims=[],timers=[],layoutName='',staticMode=false,step=0,ro=null,paused=false,returnFocus=null;

  // één eigenschap per animatie, over de hele tijdlijn: [tijd, waarde, versnelling naar het volgende punt]
  function tr(el,prop,pts){
    if(!el||typeof el.animate!=='function')return;
    const m=[];pts.slice().sort((a,b)=>a[0]-b[0]).forEach(p=>{const l=m[m.length-1];if(l&&Math.abs(l[0]-p[0])<.5){l[1]=p[1];if(p[2])l[2]=p[2];}else m.push(p.slice());});
    const kf=m.map(([t,v,e])=>({[prop]:v,offset:Math.min(1,Math.max(0,(t+LEAD)/(LEAD+END))),easing:e||'linear'}));
    if(kf[0].offset>0)kf.unshift({...kf[0],offset:0,easing:'linear'});
    if(kf[kf.length-1].offset<1)kf.push({...kf[kf.length-1],offset:1});
    anims.push(el.animate(kf,{duration:(LEAD+END)*SLOW,fill:'both'}));
  }

  // ---------- tekenen ----------
  function shell(){
    const el=document.createElement('div');el.className='ki ki-order';el.hidden=true;
    el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Tutorial: laat de kleuren doorlopen');
    el.innerHTML=`<div class="ki-top"><img src="assets/aluvision-logo.png" alt="Aluvision"><b>Tutorial</b><button type="button" class="ki-btn" data-ki="skip">Overslaan</button></div>`+
      `<div class="ki-box" data-ki-box><div class="ki-fit" data-ki-fit></div></div>`+
      `<div class="ki-subs" aria-hidden="true">${SUBS.map((s,i)=>i<SUBS.length-1?`<p class="ki-sub" data-sub="${i}">${s}</p>`:`<p class="ki-sub final" data-sub="${i}">Klaar.<span>Je animaties lopen nu mooi door.</span></p>`).join('')}</div>`+
      `<p class="ki-sr" data-ki-sr aria-live="polite"></p>`+
      `<div class="ki-bottom"><button type="button" class="ki-btn hk-pause" data-ki="pause" aria-label="Pauzeren">${ICON_PAUSE}</button><div class="ki-progress" data-ki-progress><i></i></div>`+
      `<div class="ki-steps" data-ki-steps hidden><button type="button" class="ki-btn" data-ki="prev" aria-label="Vorige stap">‹</button><span class="ki-dots">${'<i></i>'.repeat(STEPS.length)}</span><button type="button" class="ki-btn" data-ki="next" aria-label="Volgende stap">›</button></div>`+
      `<div class="ki-end" data-ki-end hidden><button type="button" class="ki-btn" data-ki="replay">${ICON_REPLAY}Opnieuw</button><button type="button" class="ki-btn primary" data-ki="close">Aan de slag</button></div></div>`;
    el.addEventListener('click',e=>{const b=e.target.closest('[data-ki]');if(!b)return;
      ({skip:close,close,replay:()=>{step=0;start(-LEAD);},prev:()=>go(step-1),next:()=>go(step+1),pause:togglePause})[b.dataset.ki]?.();});
    el.querySelector('[data-ki-box]').addEventListener('click',()=>togglePause());   // tik op het beeld: pauze / verder
    el.addEventListener('keydown',e=>{if(e.key==='Escape')close();else if(staticMode&&e.key==='ArrowRight')go(step+1);else if(staticMode&&e.key==='ArrowLeft')go(step-1);});
    // een eigen <dialog>, zodat de tutorial boven het (modale) scherm van stap 2 ligt
    const dialog=document.createElement('dialog');dialog.className='ki-dialog';dialog.setAttribute('aria-label','Tutorial: laat de kleuren doorlopen');
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',()=>{if(root&&!root.hidden)close();});   // ook van buitenaf gesloten (terugknop): netjes opruimen
    dialog.append(el);document.body.append(dialog);return el;
  }
  // De aansluiting zoals op de foto's van de echte ledline: de witte kabel komt uit het einde van de strip en buigt omlaag
  // naar een witte, ronde schroefconnector: trekontlasting met ribbels, huls, rode O-ring, gekartelde wartel, huls en
  // ribbels; daarna gaat de kabel verder naar de receiver. cx = de lijn van de kabel.
  const plugX=k=>CONN[k]==='left'?LX0[k]-CAP-4.5:LX0[k]+LEN+CAP+4.5;
  const PLUG=[['ki-rib',3.2,19,5.5,1],['ki-cyl',4,24.5,7,1.5],['ki-oring',4.3,31.5,1.6,.8],['ki-nut',5.5,33,9,2],['ki-cyl',4,42,6,1.5],['ki-rib',3.2,48,5,1]]; // [klasse, halve breedte, y onder de lijn, hoogte, afronding]
  function plugHtml(k,box,D){
    const x1=LX0[k]+LEN,left=CONN[k]==='left',cx=plugX(k);
    return `<i class="ki-cb" style="${box(left?cx-1.5:x1+CAP,LY-1.5,6,21)};border-width:${left?`${D(3)}px 0 0 ${D(3)}px`:`${D(3)}px ${D(3)}px 0 0`};border-radius:${left?`${D(5)}px 0 0 0`:`0 ${D(5)}px 0 0`}"></i>`+
      `<i class="ki-cb2" style="${box(cx-1.5,LY+52.5,3,27)}"></i>`+
      PLUG.map(([c,hw,y,h,r])=>`<i class="${c}" style="${box(cx-hw,LY+y,2*hw,h)};border-radius:${D(r)}px"></i>`).join('');
  }
  // Het begin: dezelfde ledlines als dunne lijntekening, zoals op de doos (zelfde maten, in eenheden van de rij).
  function lineArt(Z,ox,oy,CW,CH){
    let g='';
    for(const k of ORDER){
      const x0=LX0[k],x1=x0+LEN,left=CONN[k]==='left',cx=plugX(k),e=left?x0-CAP:x1+CAP,d=left?1:-1;
      g+=`<rect x="${x0}" y="${LY-DH/2}" width="${LEN}" height="${DH}" rx="1.5"/>`+
        `<path class="f" d="M${x0} ${LY-DH/2+RIM}H${x1}M${x0} ${LY+DH/2-RIM}H${x1}"/>`+
        `<path d="M${e} ${LY}H${cx+3.5*d}Q${cx} ${LY} ${cx} ${LY+3.5}V${LY+19}"/>`+
        PLUG.filter(([c])=>c!=='ki-oring').map(([,hw,y,h,r])=>`<rect x="${cx-hw}" y="${LY+y}" width="${2*hw}" height="${h}" rx="${r}"/>`).join('')+
        `<path class="o" d="M${cx-4.3} ${LY+32.3}H${cx+4.3}"/>`+
        `<path class="f" d="M${cx-2.4} ${LY+21}h4.8M${cx-2.4} ${LY+22.6}h4.8M${cx-3} ${LY+35}v5M${cx-1} ${LY+35}v5M${cx+1} ${LY+35}v5M${cx+3} ${LY+35}v5M${cx-2.4} ${LY+50.5}h4.8"/>`+
        `<path class="c" d="M${cx} ${LY+53}V${LY+79}"/>`;
    }
    const vb=[-ox/Z,-oy/Z,CW/Z,CH/Z].map(v=>v.toFixed(2)).join(' ');
    return `<svg class="ki-la" data-cla viewBox="${vb}" width="${CW}" height="${CH}" aria-hidden="true"><defs><linearGradient id="ki-la-fade" gradientUnits="userSpaceOnUse" x1="0" y1="${LY+53}" x2="0" y2="${LY+79}">`+
      `<stop offset="0" stop-color="#e9e8e3"/><stop offset="1" stop-color="#e9e8e3" stop-opacity="0"/></linearGradient></defs><g>${g}</g></svg>`;
  }
  // De ledlines zoals in de Aluvision-video's "LED line range" en "Ledline cover": een zwart frameprofiel met de witte,
  // ronde opaalcover erop. Aan geeft die één gelijkmatig gloeiende lijn met een zachte gloed, zoals een neonbuis,
  // zonder losse puntjes; uit is hij wit. Aan het begin zit de aansluiting (plugHtml).
  // Op schaal Z (1 = gewoon, L.z0 = het beeld van het begin, groot getekend zodat het scherp blijft).
  function sceneHtml(Z,ox,oy,close){
    const X=v=>(ox+v*Z).toFixed(1),Y=v=>(oy+v*Z).toFixed(1),D=v=>(v*Z).toFixed(2);
    const box=(x,y,w,h)=>`left:${X(x)}px;top:${Y(y)}px;width:${D(w)}px;height:${D(h)}px`;
    const wave=[];for(let j=0;j<=16;j++){const a=ORDER[Math.floor(j/4)%4],b=ORDER[(Math.floor(j/4)+1)%4];wave.push(`${css(mix(C[a],C[b],smooth((j%4)/4)))} ${(j*WAVE_P/16).toFixed(1)}px`);}
    // ronde opaalcover: licht van boven, felle (witte) kern, iets donkerder aan de onderrand
    // de lichtende kern tussen de twee witte randen: licht van boven, iets donkerder onderaan
    const shade='linear-gradient(180deg,rgba(255,255,255,0) 20%,rgba(255,255,255,.42) 36%,rgba(255,255,255,.3) 52%,rgba(255,255,255,0) 70%,rgba(0,0,0,.14) 80%)';
    // de overloop: een kort verloop en dan een duidelijk blok in de kleur van de volgende ledline
    const tailCss=(own,next,deg)=>`linear-gradient(${deg}deg,${css(own)} 0%,${css(mix(own,next,.5))} 12%,${css(next)} 28%,${css(next)} 100%)`;
    let h='';
    for(const k of ORDER){
      const x0=LX0[k],own=C[k],left=CONN[k]==='left',pre=close?'c':'';
      const glow=(c,attr)=>`<i class="ki-gl" ${attr} style="${box(x0-24,LY-34,LEN+48,68)};border-radius:${D(34)}px;background:${css(c)};filter:blur(${D(18)}px)"></i>`;
      h+=plugHtml(k,box,D)+glow(own,`data-${pre}gl="${k}"`)+(close?'':glow(RED,`data-glr="${k}"`));
      let inner=`<i class="ki-px" data-${pre}px="${k}" style="left:0;right:0;background:${css(own)};transform-origin:${left?'0%':'100%'} 50%"></i>`;
      if(!close&&NEXT[k]){
        // het einde loopt over in de volgende kleur. Hangt de ledline andersom, dan zit zijn staartje eerst links (verkeerd);
        // halverwege het omdraaien (als de strip op zijn kant staat) wisselt het naar rechts (data-tr).
        const tail=(attr,right,extra='')=>`<i class="ki-tl" ${attr} style="${right?'right:0':'left:0'};width:${D(TAILW)}px;background:${tailCss(own,C[NEXT[k]],right?90:270)};transform-origin:${right?'100%':'0%'} 50%${extra}"></i>`;
        inner+=tail(`data-tl="${k}"`,left);
        if(!left){const n=C[NEXT[k]],n0=`rgba(${n.join(',')},0)`;   // bij het omdraaien glijdt de overloop als een blok naar de andere kant
          inner+=tail(`data-tr="${k}"`,true,';transform:none')+`<i class="ki-tb" data-tb="${k}" style="left:0;width:${D(TAILW*1.25)}px;background:linear-gradient(90deg,${n0} 0%,${css(n)} 28%,${css(n)} 72%,${n0} 100%)"></i>`;}
      }
      // recht, zoals de echte ledline: de strip met aan boven- en onderkant een witte rand (flens), zonder zwarte omranding
      h+=`<i class="ki-dif" data-${pre}dif="${k}" style="${box(x0,LY-DH/2,LEN,DH)};border-radius:${D(1.5)}px">${inner}`+
        (close?'':`<i class="ki-wv" data-wv="${k}" style="left:${-WAVE_P}px;width:${LEN+2*WAVE_P}px;background:repeating-linear-gradient(90deg,${wave.join(',')})"></i>`+
          `<i class="ki-dim" data-dim="${k}" style="left:0;right:0"></i><i class="ki-red" data-red="${k}" style="left:0;right:0;background:${css(RED)}"></i>`+
          `<i class="ki-pl" data-pl="${k}" style="left:0;width:${BW}px"></i>`)+
        `<i class="ki-shade" style="left:0;right:0;background:${shade}"></i>`+
        `<i class="ki-rim" style="left:0;right:0;height:${D(RIM)}px"></i><i class="ki-rim b" style="left:0;right:0;top:auto;height:${D(RIM)}px"></i></i>`;
    }
    if(!close){
      // de drie aansluitingen: gloed in de kleur van de volgende ledline, gestippelde ring, kruisje (sprong) en vinkje (loopt door)
      JJ.forEach((x,i)=>{h+=`<i class="ki-match" data-match="${i}" style="${box(x-62,LY-40,124,80)};background:radial-gradient(closest-side,${css(C[ORDER[i+1]])},rgba(0,0,0,0))"></i>`+
        `<i class="ki-mark" data-mark="${i}" style="${box(x-30,LY-30,60,60)};border-width:${D(2.5)}px"></i><i class="ki-check" data-check="${i}" style="${box(x-16,LY-68,32,32)}">${ICON_CHECK}</i>`+
        `<i class="ki-cross" data-cross="${i}" style="${box(x-16,LY-68,32,32)}">${ICON_CROSS}</i>`;});
      h+='<i class="ki-comet" data-comet></i>';
    }
    return close?`<i class="ki-ren" data-cren style="left:0;top:0;right:0;bottom:0">${h}</i>`:h;   // het echte beeld komt na de lijntekening
  }
  // De telefoon: hetzelfde scherm als het echte menu (stappenbalk, zone, titel met afspeel-knopje, zin, overzicht, kaarten,
  // in stap 2 onderaan Testlicht en Klaar).
  function phoneHtml(L){
    const p=L.phone,st=L.step,ch=st-12,two=(cls,a,b)=>`<div class="ki-swap"><${cls[0]} class="${cls[1]}" data-s1>${a}</${cls[0]}><${cls[0]} class="${cls[1]}" data-s2 style="opacity:0">${b}</${cls[0]}></div>`;
    let h=`<div class="ki-phone" data-phone style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px"><div class="ki-screen" data-screen><div class="ki-pin">`+
      MOCK.mockHead()+MOCK.mockSteps(3,{done1:true,anim:4})+`<small class="ki-eyebrow">Zone Flex spi · 4 ledlines</small>`+
      two(['b','ki-title'],'Zet je ledlines in volgorde','Laat de kleuren doorlopen')+
      two(['span','ki-sentence'],'Kijk naar je stand: <b>sleep de kaarten in dezelfde volgorde.</b>','Kijk naar je stand: <b>draai om waar de kleuren niet doorlopen.</b>')+
      `<span class="ki-tut"><i>${ICON_PLAY}</i>Bekijk tutorial</span>`+
      two(['small','ki-ovlabel'],'Jouw volgorde','Zo moet het op je stand lopen')+'<div class="ki-ov">';
    for(const k of ORDER)h+=`<i class="ki-os" data-os="${k}" style="background:${css(C[k])}">${NEXT[k]?`<i class="ki-ot" data-ot="${k}" style="background:${tailBg(C[k],C[NEXT[k]],90)}"></i>`:''}<i class="ki-ored" data-ored="${k}"></i><i class="ki-och" data-och="${k}"></i></i>`;
    h+=`</div><div class="ki-cards" style="height:${4*st}px">`;
    ORDER.forEach((k,i)=>{h+=`<span class="ki-rank" style="top:${i*st}px;height:${ch}px"><b>${i+1}</b></span>`;});   // de plaatsen staan vast
    const blob=n=>`linear-gradient(90deg,rgba(${n.join(',')},0) 0%,${css(n)} 28%,${css(n)} 72%,rgba(${n.join(',')},0) 100%)`;
    ORDER.forEach((k,i)=>{const tb=a=>tailBg(C[k],C[NEXT[k]],a);
      h+=`<div class="ki-card" data-kc="${k}" style="top:${i*st}px;height:${ch}px;z-index:${k==='blauw'||k==='geel'?3:1}">`+
      `<span class="ki-name">${NAME[k]}</span>`+
      `<span class="ki-strip"><i class="ki-plug" aria-hidden="true">${ICON_PLUG}</i><span class="ki-bar" data-kb="${k}" style="background:${css(C[k])}">`+
        (NEXT[k]?`<i class="ki-ct" data-ct="${k}" style="background:${tb(90)}"></i>`+(CONN[k]==='right'?`<i class="ki-ct l" data-cl="${k}" style="background:${tb(270)};transform:none;opacity:0"></i><i class="ki-cblob" data-cb="${k}" style="background:${blob(C[NEXT[k]])}"></i>`:''):'')+
        `<i class="ki-cdim" data-cdim="${k}"></i><i class="ki-cred" data-cred="${k}"></i><i class="ki-cch" data-cch="${k}"></i><i class="ki-crim"></i></span></span>`+
      `<span class="ki-flip" data-kf="${k}">${CONN[k]==='right'?`<i class="ki-halo" data-halo="${k}-0"></i><i class="ki-halo" data-halo="${k}-1"></i>`:''}${ICON_FLIP}</span><span class="ki-grip" data-kg="${k}">${ICON_GRIP}</span></div>`;});
    return h+`<i class="ki-ring" data-ring style="top:${2*st-5}px;height:${ch+10}px"></i></div>`+
      `</div>`+
      `<div class="ki-foot"><span class="ki-next" data-knext>Volgende stap${ICON_NEXT}</span><span class="ki-back" data-kback>${ICON_BACK}Terug</span><span class="ki-test" data-ktest>${ICON_TEST}<b>Test</b></span><span class="ki-done" data-kdone>${ICON_CHECK}Klaar</span></div></div>`+
      `<i class="ki-tip" data-tip><b>Omdraaien</b></i></div>`;
  }
  // Afsluiter: het Aluvision-logo boven de stand; de kleuren van de ledlines stromen erdoor en daarna wordt het wit.
  function brandHtml(){const B=layoutName==='land'?{y:112,w:300}:{y:292,w:270};
    return `<div class="ki-brand" data-brand style="top:${B.y}px;width:${B.w}px;margin-left:${-B.w/2}px"><i class="ki-brand-flow"><i data-bband></i></i><img data-bimg src="${'assets/aluvision-logo.png'}" alt=""></div>`;}
  // Liggend of staand. Gemeten op beeld + ondertitel samen: die som verandert niet met de indeling. (De ondertitel is
  // staand 16 px hoger; kiezen op het beeld alleen kon op de grens blijven wisselen, en dan herbegon de animatie telkens.)
  function pickLayout(box){const subs=root.querySelector('.ki-subs'),h=box.clientHeight+(subs?subs.offsetHeight-104:0);return box.clientWidth/Math.max(1,h)>=1.05?'land':'port';}
  function build(){
    const box=root.querySelector('[data-ki-box]'),fit=root.querySelector('[data-ki-fit]'),bw=box.clientWidth,bh=box.clientHeight;
    layoutName=pickLayout(box);const L=LAYOUT[layoutName];
    root.dataset.layout=layoutName;fit.style.width=L.W+'px';fit.style.height=L.H+'px';fit.style.setProperty('--ki-scale',Math.min(bw/L.W,bh/L.H).toFixed(4));
    const CW=L.W*2,CH=L.H*2,ox=CW/2-FOCUS*L.z0,oy=CH/2-FY0*L.z0;
    fit.innerHTML=`<div class="ki-close" data-close style="width:${CW}px;height:${CH}px">${sceneHtml(L.z0,ox,oy,true)}${lineArt(L.z0,ox,oy,CW,CH)}</div>`+
      `<div class="ki-world" data-world style="left:${L.W/2-FW/2}px;top:${L.H/2-FH/2}px;width:${FW}px;height:${FH}px">${sceneHtml(1,0,0,false)}</div>`+phoneHtml(L)+brandHtml()+'<i class="ki-finger" data-finger></i>';
    return {L,fit};
  }
  function refit(){
    if(!root||root.hidden)return;
    const box=root.querySelector('[data-ki-box]'),bw=box.clientWidth,bh=box.clientHeight,want=pickLayout(box);
    if(want!==layoutName){start((anims[0]?.currentTime??0)/SLOW-LEAD);return;}
    const L=LAYOUT[layoutName];root.querySelector('[data-ki-fit]').style.setProperty('--ki-scale',Math.min(bw/L.W,bh/L.H).toFixed(4));
  }

  // ---------- de tijdlijn ----------
  function zoomAt(t,L){ // camera: de eerste ledline met zijn connector (zacht naar achteren) → alle ledlines (logaritmisch)
    if(t<=2600)return L.z0*(1.05-.05*(t+LEAD)/(2600+LEAD));
    const u=Math.min(1,(t-2600)/2200),e=u*u*u*(u*(u*6-15)+10);
    return Math.exp(Math.log(L.z0)+(Math.log(L.restS)-Math.log(L.z0))*e);
  }
  // Tot het beginbeeld helemaal weg is, blijft de camera op de blauwe ledline; daarna glijdt hij naar het midden.
  function worldAt(z,L){const s=Math.min(z,L.zclip),f=smooth((L.zin-s)/(L.zin-L.restS)),fx=FOCUS+(FW/2-FOCUS)*f,fy=FY0+(FH/2-FY0)*f;
    return `translate(${(-(fx-FW/2)*s).toFixed(2)}px,${(-(fy-FH/2)*s).toFixed(2)}px) scale(${s.toFixed(4)})`;}
  const camTo=(L,[fx,px,py,s])=>`translate(${(px-L.W/2-(fx-FW/2)*s).toFixed(1)}px,${(py-L.H/2-(LY-FH/2)*s).toFixed(1)}px) scale(${s})`;
  const seen=(z,L)=>z>=L.zclip?0:z<=L.zin?1:(L.zclip-z)/(L.zclip-L.zin);
  // pulseren: tussen 'base' en 'peak' heen en weer, elke 170 ms
  const wobble=(a,b,base,peak)=>{const p=[[a,base,'ease']];let u=a,on=true;while(u<b){u+=170;p.push([Math.min(u,b),on?peak:base,'ease']);on=!on;}p.push([b+160,base]);return p;};
  function timeline(L,fit){
    anims.forEach(a=>a.cancel());anims=[];
    const q=s=>fit.querySelector(s),qa=s=>[...fit.querySelectorAll(s)],sc=parseFloat(fit.style.getPropertyValue('--ki-scale'))||1,fr=fit.getBoundingClientRect();
    const pos=el=>{const r=el.getBoundingClientRect();return [(r.left+r.width/2-fr.left)/sc,(r.top+r.height/2-fr.top)/sc];};
    const Pb=pos(q('[data-kg="blauw"]')),Pg=pos(q('[data-kg="geel"]')),Pn=pos(q('[data-knext]')),Pf=pos(q('[data-kf="paars"]')),Pfg=pos(q('[data-kf="geel"]')),Pfb=pos(q('[data-kf="blauw"]')),Pt=pos(q('[data-ktest]')),Pk=pos(q('[data-kdone]'));
    const os=qa('[data-os]'),seg=os[1].offsetLeft-os[0].offsetLeft,st=L.step;
    const rest=`translate(0px,0px) scale(${L.restS})`,side=camTo(L,L.side),tails=camTo(L,L.tails),focus=camTo(L,L.focus);
    // inzoomen in de app (scène 5): het scherm schaalt rond een punt op de rechterrand, zodat het omdraai-knopje van paars
    // groot in beeld komt en de kaart naar het midden schuift. Pz = waar het knopje dan staat (daar tikt de vinger).
    const scr=q('[data-screen]'),sr=scr.getBoundingClientRect(),s0=[(sr.left-fr.left)/sc,(sr.top-fr.top)/sc],sw=sr.width/sc,sh=sr.height/sc,zs=L.zoom;
    const fx=Pf[0]-s0[0],fy=Pf[1]-s0[1],zo=[sw,Math.max(0,Math.min(sh,(sh/2-zs*fy)/(1-zs)))],zd=[zo[0]+(fx-zo[0])*zs,zo[1]+(fy-zo[1])*zs],Pz=[s0[0]+zd[0],s0[1]+zd[1]];
    scr.style.transformOrigin=`${zo[0].toFixed(1)}px ${zo[1].toFixed(1)}px`;
    const tip=q('[data-tip]');tip.style.left=zd[0].toFixed(1)+'px';tip.style.top=(zd[1]-16*zs-5).toFixed(1)+'px';

    // 1-2. de eerste ledline → uitzoomen naar alle ledlines (bemonsterd, zodat beginbeeld en rij precies samenvallen)
    const cam=[],camOp=[],cls=[],clsOp=[],ts=[-LEAD,0,1300,2600];for(let t=2655;t<=4800;t+=55)ts.push(t);
    for(const t of ts){const z=zoomAt(t,L);cam.push([t,worldAt(z,L)]);camOp.push([t,seen(z,L)]);
      if(t<=4100){cls.push([t,`translate(-50%,-50%) scale(${(z/L.z0).toFixed(4)})`]);clsOp.push([t,1-seen(z,L)]);}}
    // camera: opzij voor de telefoon, dichterbij als de staartjes verschijnen (alle drie de aansluitingen in beeld), naar paars
    // voor het eerste omdraaien, terug voor geel en blauw, en voor de afsluiter naar het midden
    tr(q('[data-world]'),'transform',[...cam,[4800,rest],[5000,rest,EASE],[5700,side],[9600,side,INOUT],[10400,tails],[12500,tails,INOUT],[13150,focus],[15000,focus,INOUT],[15700,tails],[18000,tails,INOUT],[18800,side],[25950,side,INOUT],[26750,rest]]);
    tr(q('[data-world]'),'opacity',camOp);
    tr(q('[data-close]'),'transform',cls);tr(q('[data-close]'),'opacity',clsOp);
    // de lijntekening (zoals op de doos) wordt de echte ledline: profiel en strip verschijnen, het licht loopt vanaf de connector
    tr(q('[data-cla]'),'opacity',[[-LEAD,0],[-1100,0,OUT],[-700,1],[650,1,'ease'],[1250,0]]);
    tr(q('[data-cren]'),'opacity',[[-LEAD,0],[300,0,'ease'],[800,1]]);
    tr(q('[data-cpx="blauw"]'),'transform',[[0,'scaleX(0)'],[650,'scaleX(0)',OUT],[1350,'scaleX(1)']]);
    tr(q('[data-cgl="blauw"]'),'opacity',[[0,0],[900,0,OUT],[1700,.8]]);
    // Per ledline: aangaan vanaf de connector; pulseren in de eigen kleur bij het vastpakken (donkere laag + gloed, geen wit);
    // de gloed dooft even bij het omdraaien; bij het testlicht rustig naar rood met één brede witte band die met vaste
    // snelheid door alle ledlines loopt (ook over de openingen heen); bij de afsluiter de kleurgolf.
    const ON={blauw:-1,geel:3550,paars:3800,groen:4050},RED_ON=[[TEST.red,0,'ease'],[TEST.go,1],[TEST.stop,1,'ease'],[TEST.back,0]];
    for(const k of ORDER){
      const t=ON[k],g=[[0,t<0?.75:0]],f=FLIPAT[k];
      tr(q(`[data-px="${k}"]`),'transform',t<0?[[0,'scaleX(1)']]:[[0,'scaleX(0)'],[t,'scaleX(0)',OUT],[t+650,'scaleX(1)']]);
      if(t>=0)g.push([t+100,0,'ease'],[t+750,.75]);
      if(GRAB[k]){const [a,b]=GRAB[k];g.push(...wobble(a,b,.75,.22));tr(q(`[data-dim="${k}"]`),'opacity',[[0,0],...wobble(a,b,0,.62)]);}
      g.push([TEST.red,.75,'ease'],[TEST.go,0],[TEST.stop,0,'ease'],[TEST.back,.75],[WAVE_T0,.75,'ease'],[WAVE_T0+400,.95],[WAVE_T0+WAVE_D-400,.95,'ease'],[WAVE_T0+WAVE_D,.75]);
      tr(q(`[data-gl="${k}"]`),'opacity',g);
      tr(q(`[data-red="${k}"]`),'opacity',[[0,0],...RED_ON]);
      tr(q(`[data-glr="${k}"]`),'opacity',[[0,0],...RED_ON.map(([u,v,e])=>[u,v*.7,e])]);
      const b0=(XS-LX0[k]-BW/2).toFixed(1),b1=(XE-LX0[k]-BW/2).toFixed(1);
      tr(q(`[data-pl="${k}"]`),'transform',[[0,`translateX(${b0}px)`],[TEST.go,`translateX(${b0}px)`],[TEST.stop,`translateX(${b1}px)`]]);
      tr(q(`[data-pl="${k}"]`),'opacity',[[0,0],[TEST.go-1,0],[TEST.go,1],[TEST.stop,1],[TEST.stop+1,0]]);
    }
    const comet=q('[data-comet]');
    tr(comet,'transform',[[0,`translate(${XS}px,${LY}px)`],[TEST.go,`translate(${XS}px,${LY}px)`],[TEST.stop,`translate(${XE}px,${LY}px)`]]);
    tr(comet,'opacity',[[0,0],[TEST.go,0,'ease'],[TEST.go+500,.5],[TEST.stop-500,.5,'ease'],[TEST.stop,0]]);
    // 3. stap 1 in de app: een vinger sleept de kaarten in de volgorde van de stand en tikt op "Volgende stap"
    tr(q('[data-phone]'),'opacity',[[0,0],[5200,0,OUT],[6000,1],[25950,1,'ease'],[26550,0]]);
    tr(q('[data-phone]'),'transform',[[0,L.enter],[5200,L.enter,OUT],[6000,'translate(0px,0px)'],[25950,'translate(0px,0px)',INOUT],[26650,L.enter]]);
    const ty=(n,s=1)=>`translateY(${n*st}px) scale(${s})`,lift=1.035;
    tr(q('[data-kc="blauw"]'),'transform',[[0,ty(1)],[6550,ty(1),'ease'],[6650,ty(1,lift),EASE],[7250,ty(0,lift),'ease'],[7370,ty(0)]]);
    tr(q('[data-kc="paars"]'),'transform',[[0,ty(-2)],[6800,ty(-2),EASE],[7250,ty(-1)],[8300,ty(-1),EASE],[8750,ty(0)]]);
    tr(q('[data-kc="groen"]'),'transform',[[0,ty(-1)],[8050,ty(-1),EASE],[8500,ty(0)]]);
    tr(q('[data-kc="geel"]'),'transform',[[0,ty(2)],[7800,ty(2),'ease'],[7900,ty(2,lift),EASE],[8750,ty(0,lift),'ease'],[8870,ty(0)]]);
    const tx=n=>`translateX(${n*seg}px)`;
    tr(q('[data-os="blauw"]'),'transform',[[0,tx(1)],[6650,tx(1),EASE],[7250,tx(0)]]);
    tr(q('[data-os="paars"]'),'transform',[[0,tx(-2)],[6800,tx(-2),EASE],[7250,tx(-1)],[8300,tx(-1),EASE],[8750,tx(0)]]);
    tr(q('[data-os="groen"]'),'transform',[[0,tx(-1)],[8050,tx(-1),EASE],[8500,tx(0)]]);
    tr(q('[data-os="geel"]'),'transform',[[0,tx(2)],[7900,tx(2),EASE],[8750,tx(0)]]);
    // wat je vastpakt, pulseert in zijn eigen kleur: ook de strip op de kaart (donkere laag), net als op de stand
    for(const k in GRAB){const [a,b]=GRAB[k];tr(q(`[data-cdim="${k}"]`),'opacity',[[0,0],...wobble(a,b,0,.5)]);}
    // stap 2: titel, zin, voortgang en knoppen schuiven over; de omdraai-knopjes verschijnen
    for(const el of qa('[data-s1]'))tr(el,'opacity',[[0,1],[SWITCH,1,'ease'],[SWITCH+300,0]]);
    for(const el of qa('[data-s2]'))tr(el,'opacity',[[0,0],[SWITCH+80,0,'ease'],[SWITCH+400,1]]);
    tr(q('[data-mseg="4"]'),'transform',[[0,'scaleX(0)'],[SWITCH,'scaleX(0)',EASE],[SWITCH+500,'scaleX(1)']]);   // stap 2: van volgorde naar kanten
    tr(q('[data-knext]'),'opacity',[[0,1],[SWITCH+60,1,'ease'],[SWITCH+300,0]]);
    tr(q('[data-ktest]'),'opacity',[[0,0],[SWITCH+150,0,OUT],[SWITCH+450,1]]);
    tr(q('[data-kback]'),'opacity',[[0,0],[SWITCH+150,0,OUT],[SWITCH+450,1]]);
    qa('[data-kf]').forEach((f,i)=>{tr(f,'opacity',[[0,0],[SWITCH+200+i*60,0,OUT],[SWITCH+500+i*60,1]]);});
    const at=(p,dy=0,s=1)=>`translate(${p[0].toFixed(1)}px,${(p[1]+dy).toFixed(1)}px) scale(${s})`,fg=q('[data-finger]');
    const tap=(p,t0)=>[[t0,at(p,60,1.15),OUT],[t0+350,at(p,0,1),'ease'],[t0+400,at(p,0,1),'ease'],[t0+500,at(p,0,.84),OUT],[t0+620,at(p,0,1),'ease'],[t0+700,at(p,0,1),'ease'],[t0+1000,at(p,40,1)]];
    tr(fg,'transform',[[0,at(Pb,st+60,1.15)],[6150,at(Pb,st+60,1.15),OUT],[6500,at(Pb,st,1),'ease'],[6550,at(Pb,st,1),'ease'],[6650,at(Pb,st,.84),EASE],
      [7250,at(Pb,0,.84),'ease'],[7370,at(Pb,0,1),EASE],[7760,at(Pg,2*st,1),'ease'],[7800,at(Pg,2*st,1),'ease'],[7900,at(Pg,2*st,.84),EASE],
      [8750,at(Pg,0,.84),'ease'],[8870,at(Pg,0,1),EASE],[9250,at(Pn,0,1),'ease'],[9300,at(Pn,0,1),'ease'],[9400,at(Pn,0,.84),OUT],[9520,at(Pn,0,1),'ease'],[9600,at(Pn,0,1),'ease'],[9900,at(Pn,40,1)],
      ...tap(Pz,13450),
      [15550,at(Pfg,60,1.15),OUT],[15900,at(Pfg,0,1),'ease'],[15950,at(Pfg,0,1),'ease'],[16050,at(Pfg,0,.84),OUT],[16170,at(Pfg,0,1),'ease'],[16250,at(Pfg,0,1),EASE],
      [16650,at(Pfb,0,1),'ease'],[16700,at(Pfb,0,1),'ease'],[16800,at(Pfb,0,.84),OUT],[16920,at(Pfb,0,1),'ease'],[17000,at(Pfb,0,1),'ease'],[17300,at(Pfb,40,1)],
      ...tap(Pt,19250),...tap(Pk,25050)]);
    const show=(t0,t1)=>[[t0,0,OUT],[t0+350,.95],[t1-300,.95,'ease'],[t1,0]];
    tr(fg,'opacity',[[0,0],...show(6150,9900),...show(13450,14450),...show(15550,17300),...show(19250,20250),...show(25050,26050)]);
    tr(q('[data-knext]'),'transform',[[0,'scale(1)'],[9300,'scale(1)','ease'],[9400,'scale(0.96)',OUT],[9550,'scale(1)']]);
    // 4. de staartjes verschijnen aan de kant waar het licht de volgende ledline in moet (blauw, geel, paars: verkeerde kant);
    //    bij het omdraaien wisselt het staartje van kant op het moment dat de strip op zijn kant staat
    for(const [a,,t] of PAIRS){
      const f=FLIPAT[a];
      tr(q(`[data-tl="${a}"]`),'transform',[[0,'scaleX(0)'],[t,'scaleX(0)',OUT],[t+600,'scaleX(1)']]);
      tr(q(`[data-tl="${a}"]`),'opacity',[[0,0],[t,0,OUT],[t+300,1],...(f!=null?[[f,1,'ease'],[f+250,0]]:[])]);
      for(const s of [`[data-ot="${a}"]`,`[data-ct="${a}"]`])tr(q(s),'transform',[[0,'scaleX(0)'],[t,'scaleX(0)',OUT],[t+600,'scaleX(1)']]);
    }
    // 5. blauw, geel en paars hangen andersom: op elke aansluiting waar het niet doorloopt, komt een kruisje (een sprong).
    //    Paars eerst: de camera gaat erheen, de app zoomt in op het omdraai-knopje (rimpels, label "Omdraaien"), de vinger
    //    tikt, en de overloop vloeit mooi naar de andere kant van de ledline (de ledline zelf draait niet).
    //    Daarna, zonder inzoomen, geel en blauw. Na elke draai loopt één aansluiting weer door: gloed en een vinkje.
    tr(q('[data-ring]'),'opacity',[[0,0],[12400,0,'ease'],[12700,1],[15250,1,'ease'],[15550,0]]);
    tr(scr,'transform',[[0,'scale(1)'],[12650,'scale(1)',INOUT],[13250,`scale(${zs})`],[14550,`scale(${zs})`,INOUT],[15150,'scale(1)']]);
    for(const [k,times] of [['paars',[13300,13650]],['geel',[15600]],['blauw',[16350]]])times.forEach((t,i)=>{const r=q(`[data-halo="${k}-${i}"]`);
      tr(r,'opacity',[[0,0],[t,0],[t+60,.95,'ease'],[t+750,0]]);
      tr(r,'transform',[[0,'scale(1)'],[t,'scale(1)',OUT],[t+750,'scale(1.8)']]);});
    tr(tip,'opacity',[[0,0],[13150,0,OUT],[13350,1],[14300,1,'ease'],[14550,0]]);
    tr(tip,'transform',[[0,'translateY(8px) scale(0.8)'],[13150,'translateY(8px) scale(0.8)',POP],[13450,'translateY(0px) scale(1)']]);
    for(const [j,k,t] of FIX){
      // de overloop vloeit naar de andere kant: op de stand van links naar rechts, op de kaart naar de kant van de connector
      const x0=(-.3*TAILW).toFixed(1),x1=(LEN-.95*TAILW).toFixed(1),blobStand=q(`[data-tb="${k}"]`);
      tr(blobStand,'transform',[[0,`translateX(${x0}px)`],[t,`translateX(${x0}px)`,INOUT],[t+900,`translateX(${x1}px)`]]);
      tr(blobStand,'opacity',[[0,0],[t,0,'ease'],[t+150,1],[t+750,1,'ease'],[t+950,0]]);
      tr(q(`[data-tr="${k}"]`),'opacity',[[0,0],[t+700,0,'ease'],[t+950,1]]);
      const w=q(`[data-kb="${k}"]`).offsetWidth,ctw=w*.34,c0=(w-.95*ctw).toFixed(1),c1=(-.3*ctw).toFixed(1),blobCard=q(`[data-cb="${k}"]`);
      blobCard.style.width=(ctw*1.25).toFixed(1)+'px';
      tr(blobCard,'transform',[[0,`translateX(${c0}px)`],[t,`translateX(${c0}px)`,INOUT],[t+900,`translateX(${c1}px)`]]);
      tr(blobCard,'opacity',[[0,0],[t,0,'ease'],[t+150,1],[t+750,1,'ease'],[t+950,0]]);
      tr(q(`[data-ct="${k}"]`),'opacity',[[0,1],[t,1,'ease'],[t+250,0]]);
      tr(q(`[data-cl="${k}"]`),'opacity',[[0,0],[t+700,0,'ease'],[t+950,1]]);
      const a=11650+j*120,mk=[[0,0],[a,0,OUT],[a+300,.95]];
      for(let u=a+550,on=false;u<t+500;u+=250,on=!on)mk.push([u,on?.95:.4,'ease']);
      tr(q(`[data-mark="${j}"]`),'opacity',[...mk,[t+550,.9,'ease'],[t+850,0]]);
      tr(q(`[data-cross="${j}"]`),'opacity',[[0,0],[a,0,OUT],[a+250,1],[t+600,1,'ease'],[t+850,0]]);
      tr(q(`[data-cross="${j}"]`),'transform',[[0,'scale(0.3) rotate(0deg)'],[a,'scale(0.3) rotate(0deg)',POP],[a+350,'scale(1) rotate(0deg)'],[12260,'scale(1) rotate(0deg)','ease'],
        [12380,'scale(1) rotate(-12deg)','ease'],[12500,'scale(1) rotate(10deg)','ease'],[12620,'scale(1) rotate(0deg)'],[t+600,'scale(1) rotate(0deg)','ease'],[t+850,'scale(0.4) rotate(0deg)']]);
      tr(q(`[data-match="${j}"]`),'opacity',[[0,0],[t+850,0,OUT],[t+1200,1],[t+1650,.6,'ease'],[18900,.6,'ease'],[19300,0]]);
      tr(q(`[data-match="${j}"]`),'transform',[[0,'scale(0.5)'],[t+850,'scale(0.5)',OUT],[t+1200,'scale(1.12)','ease'],[t+1650,'scale(1)']]);
      tr(q(`[data-check="${j}"]`),'opacity',[[0,0],[t+950,0,OUT],[t+1200,1],[18900,1,'ease'],[19250,0]]);
      tr(q(`[data-check="${j}"]`),'transform',[[0,'scale(0.3)'],[t+950,'scale(0.3)',POP],[t+1350,'scale(1)']]);
    }
    const press=t0=>[[0,'scale(1)'],[t0,'scale(1)','ease'],[t0+100,'scale(0.86)',OUT],[t0+280,'scale(1)']];
    tr(q('[data-kf="paars"]'),'transform',press(13850));
    tr(q('[data-kf="geel"]'),'transform',press(15950));
    tr(q('[data-kf="blauw"]'),'transform',press(16700));
    tr(q('[data-ktest]'),'transform',press(19650));
    // 6. testlicht in de app: de overzichtsbalk en de kaartstrips worden ook rood en dezelfde witte band loopt erover,
    //    op de kaart van een ledline precies wanneer hij op de stand over die ledline loopt
    const ov0=os[0].offsetLeft,OVW=os[3].offsetLeft+os[3].offsetWidth-ov0,obw=os[0].offsetWidth*.7;
    os.forEach((o,i)=>{const k=ORDER[i],x=o.offsetLeft-ov0,band=q(`[data-och="${k}"]`);band.style.width=obw.toFixed(1)+'px';
      tr(q(`[data-ored="${k}"]`),'opacity',[[0,0],...RED_ON]);
      tr(band,'transform',[[0,`translateX(${(-obw-x).toFixed(1)}px)`],[TEST.go,`translateX(${(-obw-x).toFixed(1)}px)`],[TEST.stop,`translateX(${(OVW-x).toFixed(1)}px)`]]);});
    const tt=x=>TEST.go+(TEST.stop-TEST.go)*(x-XS)/(XE-XS);
    for(const k of ORDER){
      const bar=q(`[data-kb="${k}"]`),w=bar.offsetWidth,cb=w*BW/LEN,band=q(`[data-cch="${k}"]`);band.style.width=cb.toFixed(1)+'px';
      tr(q(`[data-cred="${k}"]`),'opacity',[[0,0],...RED_ON]);
      tr(band,'transform',[[0,`translateX(${(-cb).toFixed(1)}px)`],[tt(LX0[k]-BW/2),`translateX(${(-cb).toFixed(1)}px)`],[tt(LX0[k]+LEN+BW/2),`translateX(${w.toFixed(1)}px)`]]);
    }
    tr(q('[data-kdone]'),'opacity',[[0,0],[SWITCH+150,0,OUT],[SWITCH+450,.35],[24750,.35,OUT],[25050,1]]);
    tr(q('[data-kdone]'),'transform',[[0,'scale(1)'],[24750,'scale(1)',OUT],[25050,'scale(1.04)',INOUT],[25250,'scale(1)'],[25450,'scale(1)','ease'],[25550,'scale(0.95)',OUT],[25750,'scale(1)']]);
    // 7. afsluiter: de telefoon schuift weg en een kleurgolf loopt in één beweging over alle ledlines
    const v=WAVE_P/WAVE_D;
    for(const k of ORDER){
      const s=(LX0[k]-M)%WAVE_P;
      tr(q(`[data-wv="${k}"]`),'transform',[[0,`translateX(${-s}px)`],[WAVE_T0,`translateX(${-s}px)`],[WAVE_T0+WAVE_D,`translateX(${(-s+v*WAVE_D).toFixed(1)}px)`]]);
      tr(q(`[data-wv="${k}"]`),'opacity',[[0,0],[WAVE_T0,0,'ease'],[WAVE_T0+400,1],[WAVE_T0+WAVE_D-450,1,'ease'],[WAVE_T0+WAVE_D,0]]);
    }
    // 8. na het uitzoomen: het Aluvision-logo verschijnt boven de stand, de kleuren van de ledlines stromen erdoor, dan wordt het wit
    const brand=q('[data-brand]');
    tr(brand,'opacity',[[0,0],[26900,0,OUT],[27500,1]]);
    tr(brand,'transform',[[0,'translateY(12px) scale(0.94)'],[26900,'translateY(12px) scale(0.94)',OUT],[27700,'translateY(0px) scale(1)']]);
    tr(q('[data-bband]'),'transform',[[0,'translateX(0%)'],[26900,'translateX(0%)'],[29200,'translateX(-50%)']]);
    tr(q('[data-bimg]'),'opacity',[[0,0],[28500,0,'ease'],[29200,1]]);
    // ondertitels en voortgang
    SUB_T.forEach(([a,b],i)=>{const el=root.querySelector(`[data-sub="${i}"]`),last=b>=END;
      tr(el,'opacity',[[-LEAD,0],[a,0,OUT],[a+350,1],...(last?[]:[[b-250,1,'ease'],[b,0]])]);
      tr(el,'transform',[[-LEAD,'translateY(8px)'],[a,'translateY(8px)',OUT],[a+350,'translateY(0px)'],...(last?[]:[[b-250,'translateY(0px)','ease'],[b,'translateY(-6px)']])]);});
    tr(root.querySelector('[data-ki-progress]>i'),'transform',[[-LEAD,'scaleX(0)'],[END,'scaleX(1)']]);
  }
  function say(i){const sr=root.querySelector('[data-ki-sr]');if(sr)sr.textContent=SUBS[i]||'';}
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
  function open({focus=null}={}){
    if(!root)root=shell();
    returnFocus=focus;staticMode=reduce();step=0;root.hidden=false;document.documentElement.classList.add('ki-open');
    const dialog=root.parentElement;if(dialog&&!dialog.open){try{dialog.showModal();}catch(_){dialog.setAttribute('open','');}}
    if(!ro&&typeof ResizeObserver==='function'){ro=new ResizeObserver(()=>refit());ro.observe(root.querySelector('[data-ki-box]'));}
    requestAnimationFrame(()=>{if(!root||root.hidden)return;start(-LEAD);root.querySelector('[data-ki="skip"]').focus({preventScroll:true});});
  }
  function close(){
    timers.forEach(clearTimeout);timers=[];anims.forEach(a=>a.cancel());anims=[];
    if(root){root.hidden=true;root.querySelector('[data-ki-fit]').innerHTML='';const dialog=root.parentElement;if(dialog?.open)dialog.close();}
    document.documentElement.classList.remove('ki-open');
    try{localStorage.setItem(KEY,'1');}catch(_){}
    const back=returnFocus;returnFocus=null;
    try{(back&&back.isConnected?back:$('dialog.kt-dialog [data-action=intro]'))?.focus({preventScroll:true});}catch(_){}
  }
  const isOpen=()=>!!root&&!root.hidden;
  return {open,close,isOpen,SLOW,LEAD,END,seenBefore:()=>{try{return localStorage.getItem(KEY)==='1';}catch(_){return false;}}};
})();

window.LightningLedlinesOrderTutorial=Object.freeze({open:Intro.open,close:Intro.close,isOpen:Intro.isOpen,seen:Intro.seenBefore});
})();
