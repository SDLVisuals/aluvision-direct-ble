/* Aluvision: van "verbinden" tot "toegevoegd" in één schermvullend beeld (C226; tester-ronde 12 nov, opmerking 4 en 8).
 * de eigenaar: "deze pagina moet meer visueel zijn, het moet met een animatie duidelijk maken wat er aan het gebeuren is,
 * verbinding"; voor het gelukt-moment: "full screen", "iets premiumer", "soort van animatie dat hij zo inzoomt erop",
 * "de verhouding van de receiver en de kabel", "de splitter moet echt veel beter" (met een foto van de echte splitter).
 * - De receiver van boven, in zijn echte verhoudingen (receiver-art.js, alleen tot aan zijn kap), met zijn vaste kabels
 *   uit ledline-kabels.js. RGBW: een zwarte kabel naar de zwarte splitter, 4 witte kabeltjes met elk hun connector.
 *   SPI: 4 witte kabels, elk met hun connector.
 * - Verbinden: de telefoon onderaan, de receiver erboven; blauwe stippen lopen van de telefoon naar de receiver.
 * - PIN opslaan (C231, eerste receiver): zelfde beeld, met een slotje onder de receiver en een ring die rondloopt.
 * - Toegevoegd: de telefoon gaat weg, het beeld zoomt in op de receiver, blauw wordt groen.
 * Dit bestand tekent alleen het beeld (stage, still) en rekent de camerastanden uit (fit). De teksten en de knoppen
 * komen van onboarding-ui.js. Het leest niets van een receiver en verandert niets aan het koppelen.
 */
(function(){
'use strict';
const RS=1.6;                                  // wereld-px per mm van de receiver, zoals in de tutorials
const KS=1.45;                                 // kabels, connectors en splitter op ware grootte naast de receiver (kabel 4 mm, zwarte
                                               // kabel 7,5 mm, connector 10 mm dik): de tutorials tekenen ze kleiner, dit beeld niet
const RL=125,RT=190,WW=502,WH=664;             // de linkerbovenhoek van de receivertekening; de maat van de wereld
const PHONE={w:72*RS,h:147*RS},GAP=118;        // een telefoon op ware grootte, een eind onder de receiver
const KMAX=1.9,RATIO=.77;                      // grootste zoom; het overzicht is zoveel kleiner dan het eindbeeld
const LOOP=4800;                               // alle lussen passen een geheel aantal keer in LOOP (zie lag)
const f=v=>(+v).toFixed(1),box=(x,y,w,h)=>`left:${f(x)}px;top:${f(y)}px;width:${f(w)}px;height:${f(h)}px`;
const cache=new Map();
function build(type){
  type=type==='RGBW'?'RGBW':'SPI';
  if(cache.has(type))return cache.get(type);
  const RA=window.AluvisionReceiverArt,K=window.AlvKabels;if(!RA||!K)return null;
  const rgbw=type==='RGBW';
  const art=RA.build({type:rgbw?'rgbw':'spi',view:'top',theme:'dark',outputs:[true,true,true,true],cable:0,lead:0,power:true,powerCable:10,led:null,shadow:false,scale:RS,title:`Aluvision ${type}-receiver`});
  // van de tekening alleen de receiver tot aan zijn kap; alles links ervan tekenen we zelf (zoals in de tutorials)
  const vb=art.viewBox,XE=RA.DIMENSIONS.XE,x0=-XE-1.3,wmm=vb.x+vb.w-x0,rw=wmm*RS,rh=art.height;
  const svg=art.svg.replace(/viewBox="[^"]*"/,`viewBox="${x0} ${vb.y} ${wmm} ${vb.h}"`).replace(/ width="[\d.]+"/,` width="${rw.toFixed(2)}"`);
  const W=(x,y)=>K.V(RL+(x-x0)*RS,RT+(y-vb.y)*RS),L=K.V(-1,0),C=W(0,0),HB=25*RS+4,HX=XE*RS;   // C: midden van de behuizing
  const b={x1:RL,y1:C.y-HB-4,x2:RL+rw+2,y2:C.y+HB+4},grow=(p,pad)=>{b.x1=Math.min(b.x1,p.x-pad);b.y1=Math.min(b.y1,p.y-pad);b.x2=Math.max(b.x2,p.x+pad);b.y2=Math.max(b.y2,p.y+pad);};
  let paths='',split='',plugs='';
  if(rgbw){
    // de zwarte kabel maakt een ruime bocht tot boven de receiver; daar ligt de splitter, de 4 kabeltjes waaieren uit
    // en lopen dan weer naast elkaar verder. Elk kabeltje is even lang en eindigt in zijn connector.
    const start=W(-XE-1,0),b1=K.bend(start,L,12,57*100*Math.PI/180,100),b2=K.bend(b1.end,b1.dir,0,69*80*Math.PI/180,80);
    const sp=K.splitter(b2.end,b2.dir,RS*KS);
    const tails=sp.exits.map((p,i)=>{const phi=[20,7,-7,-20][i],a=K.bend(p,sp.dir,14,70,phi),c=K.bend(a.end,a.dir,20,60,-phi*.75);return {d:a.d+c.d,end:c.end,dir:c.dir};});
    paths=K.tube(b1.d+b2.d,'blk')+tails.map(t=>K.tube(t.d)).join('');split=sp.svg;
    plugs=tails.map(t=>{const p=K.plugAt(t.end,t.dir,K.MALE,KS);grow(p.tip,11);grow(t.end,11);return p.html;}).join('');
    grow(K.V(start.x-12-57,start.y-57),8);grow(b2.end,18);
  }else{
    // 4 even lange kabels uit de uitgangen, licht uitwaaierend, elk met zijn connector
    const ends=art.anchors.map(a=>K.bend(W(a.x,a.y),L,14,44,(1.5-(a.port-1))*8));
    paths=ends.map(e=>K.tube(e.d)).join('');
    plugs=ends.map(e=>{const p=K.plugAt(e.end,e.dir,K.MALE,KS);grow(p.tip,11);grow(e.end,11);return p.html;}).join('');
  }
  const led=W(-31,-17),px=C.x-PHONE.w/2,py=C.y+HB+GAP,ly1=py-8,ly2=C.y+HB+9;
  const frame=box(C.x-HX-7,C.y-HB-5,2*HX+14,2*HB+10);
  const grad=(id,col)=>`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${f(ly1)}" x2="0" y2="${f(ly2)}"><stop offset="0" stop-color="${col}" stop-opacity="0"/><stop offset=".22" stop-color="${col}"/><stop offset=".82" stop-color="${col}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient>`;
  const line=`M${f(C.x)} ${f(ly1)}V${f(ly2)}`;
  const html=`<div class="ki-world pair-world" data-pair-world style="width:${WW}px;height:${WH}px">`+
    `<i class="pair-aura" style="${box(C.x-230,C.y-160,460,320)}"></i><i class="pair-aura ok" style="${box(C.x-230,C.y-160,460,320)}"></i>`+
    `<span class="pair-radar" style="${box(C.x-180,py-174,360,180)}"><i></i><i></i><i></i></span>`+
    `<div class="pair-kit"><svg class="hk-cables" width="${WW}" height="${WH}" viewBox="0 0 ${WW} ${WH}">${paths}</svg>`+
      (split?`<svg class="kb-layer" width="${WW}" height="${WH}" viewBox="0 0 ${WW} ${WH}">${split}</svg>`:'')+
      `<div class="hk-rart" style="${box(RL,RT,rw,rh)}">${svg}</div><div class="hk-free">${plugs}</div>`+
      `<i class="pair-led" style="${box(led.x-3.3,led.y-3.3,6.6,6.6)}"></i></div>`+
    `<i class="pair-ping" style="${frame}"></i><i class="pair-burst" style="${frame}"></i>`+
    // C231: "PIN opslaan": een slotje vlak onder de receiver, waar de stippen van de telefoon aankomen, met een ring die
    // rondloopt (alleen in die stap zichtbaar; boven de receiver liggen bij RGBW de kabels)
    `<i class="pair-lock" style="${box(C.x-18,C.y+HB+15,36,36)}"><svg viewBox="0 0 24 24"><path d="M7.5 10.5V7.5a4.5 4.5 0 0 1 9 0v3"/><rect x="5" y="10.5" width="14" height="10" rx="2.8"/></svg></i>`+
    `<svg class="pair-link" width="${WW}" height="${WH}" viewBox="0 0 ${WW} ${WH}"><defs>${grad('pair-lg-'+type,'#60a5fa')}${grad('pair-lgok-'+type,'#34d399')}</defs>`+
      `<path class="pair-dots" d="${line}" stroke="url(#pair-lg-${type})"/><path class="pair-dots ok" d="${line}" stroke="url(#pair-lgok-${type})"/><path class="pair-comet" d="${line}"/></svg>`+
    `<div class="pair-phone" style="${box(px,py,PHONE.w,PHONE.h)}"><i class="pair-notch"></i><span class="pair-screen"><svg class="pair-wifi" viewBox="0 0 48 48"><path d="M6 19a26 26 0 0 1 36 0"/><path d="M12.5 25.5a17 17 0 0 1 23 0"/><path d="M19 32a8 8 0 0 1 10 0"/><circle cx="24" cy="38" r="2.7"/></svg></span><i class="pair-home"></i></div>`+
    `</div>`;
  // twee camerastanden: het eindbeeld (de receiver met zijn kabels) en het overzicht (met de telefoon). Het overzicht
  // is voor RGBW en SPI even groot en ligt om het midden van de behuizing: telefoon en receiver staan dan voor beide
  // types op dezelfde plaats.
  const half=Math.max(C.x-2,WW-C.x-2),wy1=C.y-HB-140,wy2=py+PHONE.h+8;
  const geo={type,html,close:{cx:(b.x1+b.x2)/2,cy:(b.y1+b.y2)/2,w:b.x2-b.x1,h:b.y2-b.y1},wide:{cx:C.x,cy:(wy1+wy2)/2,w:2*half,h:wy2-wy1}};
  cache.set(type,geo);return geo;
}
// het beeld staat in het midden van zijn ruimte, iets naar de tekst toe als er veel ruimte over is
const cam=(b,r,k,lean=0)=>`translate(${(r.x+r.w/2-b.cx*k).toFixed(1)}px,${(r.y+r.h/2+Math.max(0,r.h-b.h*k)*lean-b.cy*k).toFixed(1)}px) scale(${k.toFixed(4)})`;
let lastWide=null;
// Zet de camerastanden op elk beeld binnen root. Het overzicht past in de ruimte boven de tekst van "verbinden", het
// eindbeeld in de ruimte boven de tekst van "toegevoegd". Bij "toegevoegd" begint de beweging waar het overzicht stond.
function fit(root){
  root=root||document;
  root.querySelectorAll('[data-pair-scene]').forEach(scene=>{
    const g=build(scene.dataset.pairType),stage=scene.querySelector('[data-pair-stage]'),copy=scene.querySelector('[data-pair-copy]');if(!g||!stage)return;
    const s=stage.getBoundingClientRect();if(!s.width||!s.height)return;
    const c=copy?copy.getBoundingClientRect():{left:s.left,top:s.bottom};
    const side=c.left-s.left>s.width*.3;   // liggend scherm: de tekst staat naast het beeld
    const r=side?{x:0,y:0,w:c.left-s.left,h:s.height}:{x:0,y:0,w:s.width,h:Math.max(150,c.top-s.top)};
    const kc=Math.min(r.w*.94/g.close.w,r.h*.9/g.close.h,KMAX),kw=Math.min(r.w*.96/g.wide.w,r.h*.96/g.wide.h,Math.min(r.w*.94/g.close.w,KMAX)*RATIO);
    const key=`${Math.round(s.width)}x${Math.round(s.height)}:${g.type}`;
    if(scene.dataset.pairState==='done'){
      scene.style.setProperty('--pair-close',cam(g.close,r,kc,side?0:.12));
      scene.style.setProperty('--pair-from',lastWide&&lastWide.key===key?lastWide.value:cam(g.wide,r,kw));
    }else{const wide=cam(g.wide,r,kw);lastWide={key,value:wide};scene.style.setProperty('--pair-wide',wide);}
  });
  root.querySelectorAll('[data-pair-still]').forEach(el=>{
    const g=build(el.dataset.pairType),s=el.getBoundingClientRect();if(!g||!s.width||!s.height)return;
    el.style.setProperty('--pair-close',cam(g.close,{x:0,y:0,w:s.width,h:s.height},Math.min(s.width*.92/g.close.w,s.height*.84/g.close.h,KMAX)));
  });
}
let queued=false;
window.addEventListener('resize',()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;fit(document);});});
window.LightningReceiverPairScene={
  ready:()=>!!(window.AluvisionReceiverArt&&window.AlvKabels),
  // het bewegende beeld: achter de tekst, schermvullend
  stage(type){const g=build(type);return g?`<div class="pair-stage" data-pair-stage aria-hidden="true">${g.html}</div>`:'';},
  // dezelfde tekening, stil en klein, voor in een kaart
  still(type){const g=build(type);return g?`<div class="pair-still" data-pair-still data-pair-type="${g.type}" aria-hidden="true">${g.html}</div>`:'';},
  fit,
  // De pagina wordt bij elke stap opnieuw getekend. Met deze vertraging lopen de lussen daarna gewoon door.
  lag:()=>-(Math.floor(performance.now())%LOOP)
};
})();
