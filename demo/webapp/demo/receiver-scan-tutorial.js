/* Tutorial "Zo scan je een receiver" (12 nov 2026, de eigenaar: "graag ergens bekijk hoe het moet met dan een animatie die de
 * qr code scant met een iphone"). Drie korte zinnen: de QR-code staat op de receiver, je houdt je telefoon erboven,
 * de app verbindt zelf. Zelfde raamwerk en stijl als de tutorial van de ledlines (klassen ki-*, ledlines-tutorial.css);
 * de receiver is de echte tekening (receiver-art.js). Alleen uitleg: geen camera, geen receiver, niets wordt bewaard.
 *
 *   LightningReceiverScanTutorial.open({type:'RGBW'|'SPI', onWifiHelp:null|function})
 *   LightningReceiverScanTutorial.close()
 *
 * onWifiHelp: alleen bij de eerste receiver, zolang "Verbinding controleren" nog bestaat. Dan staat op het einde de
 * knop "Scannen lukt niet?"; die sluit de tutorial en roept onWifiHelp aan (de app toont dan de wifi-stappen).
 */
(function(){
'use strict';
const reduce=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}};
const TOTAL=9200,STILL=4900,W=360,H=440,RW=336,RX=(W-RW)/2,RY=176;
// een telefoon is 72 × 147 mm; hij wordt getekend op de schaal van de receiver-tekening (155 mm lang), zodat de verhouding klopt
const PHONE_W=72,PHONE_H=147;
const OUT='cubic-bezier(.2,.8,.2,1)',INOUT='cubic-bezier(.65,0,.35,1)',SPRING='cubic-bezier(.34,1.56,.64,1)';
const SUBS=['De QR-code staat op je receiver.','Houd je telefoon erboven.','Gescand. De app verbindt zelf.'];
const SUB_T=[[0,1700],[1700,4500],[4500,TOTAL]];
const ICON_PAUSE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5.5h3.2v13H7.5zM13.3 5.5h3.2v13h-3.2z"/></svg>';
const ICON_PLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
const ICON_REPLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5"/></svg>';
let root=null,anims=[],paused=false,ro=null,options={},still=false;

function shell(){
  const el=document.createElement('div');el.className='ki rst';
  el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Tutorial: een receiver scannen');
  el.innerHTML=`<div class="ki-top"><img src="assets/aluvision-logo.png" alt="Aluvision"><b>Tutorial</b><button type="button" class="ki-btn" data-rst="close">Sluiten</button></div>`+
    `<div class="ki-box" data-rst-box><div class="ki-fit" data-rst-fit></div></div>`+
    `<div class="ki-subs" aria-hidden="true">${SUBS.map((text,i)=>`<p class="ki-sub${i===SUBS.length-1?' final':''}" data-rst-sub="${i}">${text}</p>`).join('')}</div>`+
    `<p class="ki-sr" data-rst-sr aria-live="polite"></p>`+
    `<div class="ki-bottom"><button type="button" class="ki-btn hk-pause" data-rst="pause" aria-label="Pauzeren">${ICON_PAUSE}</button><div class="ki-progress" data-rst-progress><i></i></div>`+
    `<div class="ki-end" data-rst-end hidden><button type="button" class="ki-btn" data-rst="replay">${ICON_REPLAY}Opnieuw</button><button type="button" class="ki-btn" data-rst="wifi" hidden>Scannen lukt niet?</button><button type="button" class="ki-btn primary" data-rst="close">Aan de slag</button></div></div>`;
  el.addEventListener('click',event=>{
    const button=event.target.closest('[data-rst]');
    if(button)return ({close,replay:()=>play(),pause:togglePause,wifi:()=>{const help=options.onWifiHelp;close();if(typeof help==='function')help();}})[button.dataset.rst]?.();
    if(event.target.closest('[data-rst-box]'))togglePause();   // tik op het beeld: pauze / verder
  });
  const dialog=document.createElement('dialog');dialog.className='ki-dialog';dialog.setAttribute('aria-label','Tutorial: een receiver scannen');
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',()=>{if(root&&!root.hidden)close();});   // ook van buitenaf gesloten (terugknop): netjes opruimen
  dialog.append(el);document.body.append(dialog);return el;
}
// de receiver van boven (de echte tekening) en een telefoon die erboven komt; in het scherm van de telefoon het beeld
// van zijn camera: dezelfde tekening, dichterbij, met de QR-code in het midden.
function scene(){
  const RA=window.AluvisionReceiverArt;let art='';
  try{
    // de receiver met een kort stuk kabel: bij RGBW loopt de tekening links nog door tot de splitter; dat stuk valt hier weg
    const built=RA.build({type:options.type==='SPI'?'spi':'rgbw',view:'top',theme:'dark',outputs:[true,true,true,true],cable:14,shadow:false,led:null,width:RW,title:`Aluvision ${options.type}-receiver`});
    const box=built.viewBox,x0=Math.max(box.x,-RA.DIMENSIONS.XE-22),w=box.x+box.w-x0;
    art=built.svg.replace(/viewBox="[^"]*"/,`viewBox="${x0} ${box.y} ${w} ${box.h}"`).replace(/ height="[\d.]+"/,'');
  }catch(_){art='';}
  return `<div class="rst-world" style="width:${W}px;height:${H}px"><i class="rst-glow" data-rst-glow></i><div class="rst-rcv" data-rst-rcv style="left:${RX}px;top:${RY}px;width:${RW}px">${art}</div><i class="rst-ring" data-rst-ring></i>`+
    `<div class="rst-phone" data-rst-phone><span class="rst-notch"></span><div class="rst-cam" data-rst-cam><div class="rst-view" data-rst-view style="width:${RW}px">${art}</div>`+
    `<i class="rst-find" data-rst-find><span></span><span></span><span></span><span></span></i><i class="rst-flash" data-rst-flash></i></div>`+
    `<span class="rst-ok" data-rst-ok><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5.5 12.5 4.2 4.2L18.5 7.8"/></svg></span><span class="rst-home"></span></div></div>`;
}
// waar de QR-code in de tekening staat (in px van de wereld, los van de schaal van het beeld)
function code(svg){
  const rect=svg?.querySelector('rect[width="22"][height="22"]'),box=svg?.viewBox?.baseVal;
  if(!rect||!box||!box.width)return {x:RW*.72,y:RW*.11,size:RW*.1,k:RW/220};
  const k=RW/box.width,x=+rect.getAttribute('x'),y=+rect.getAttribute('y');
  return {x:(x+11-box.x)*k,y:(y+11-box.y)*k,size:22*k,k};   // k = px per mm
}
function tr(el,frames){
  if(!el||typeof el.animate!=='function')return;
  const kf=frames.map(([t,props,easing])=>({...props,offset:Math.min(1,Math.max(0,t/TOTAL)),easing:easing||'linear'}));
  if(kf[0].offset>0)kf.unshift({...kf[0],offset:0,easing:'linear'});
  if(kf[kf.length-1].offset<1)kf.push({...kf[kf.length-1],offset:1});
  anims.push(el.animate(kf,{duration:TOTAL,fill:'both'}));
}
function refit(){
  const box=root?.querySelector('[data-rst-box]'),fit=root?.querySelector('[data-rst-fit]');if(!box||!fit)return;
  fit.style.setProperty('--ki-scale',Math.max(.3,Math.min(box.clientWidth/W,box.clientHeight/H,1.9)).toFixed(3));
}
function play(){
  anims.forEach(anim=>{try{anim.cancel();}catch(_){}});anims=[];paused=false;still=reduce();
  const q=sel=>root.querySelector(sel),fit=q('[data-rst-fit]');
  fit.style.width=W+'px';fit.style.height=H+'px';fit.innerHTML=scene();refit();
  const at=code(q('[data-rst-rcv] svg')),qx=RX+at.x,qy=RY+at.y;
  // de telefoon op de schaal van de tekening; zijn scherm toont het beeld van de camera
  const PW=PHONE_W*at.k,PH=PHONE_H*at.k,CX=PW*.065,CY=PH*.1,CW=PW-2*CX,CH=PH*.79,ZOOM=CW*.6/at.size;
  const phone=q('[data-rst-phone]'),cam=q('[data-rst-cam]');
  phone.style.width=PW.toFixed(1)+'px';phone.style.height=PH.toFixed(1)+'px';phone.style.borderRadius=(PW*.17).toFixed(1)+'px';
  cam.style.cssText=`left:${CX.toFixed(1)}px;top:${CY.toFixed(1)}px;width:${CW.toFixed(1)}px;height:${CH.toFixed(1)}px;border-radius:${(PW*.07).toFixed(1)}px`;
  // de telefoon hangt zo dat het midden van zijn camerabeeld boven de QR-code zit
  const px=Math.max(6,Math.min(W-PW-6,qx-PW/2)),py=qy-CY-CH/2+6;
  const ring=q('[data-rst-ring]'),size=at.size*1.9;
  ring.style.cssText=`left:${(qx-size/2).toFixed(1)}px;top:${(qy-size/2).toFixed(1)}px;width:${size.toFixed(1)}px;height:${size.toFixed(1)}px`;
  q('[data-rst-view]').style.transform=`translate(${(CW/2-at.x*ZOOM).toFixed(1)}px,${(CH/2-at.y*ZOOM).toFixed(1)}px) scale(${ZOOM})`;
  const find=q('[data-rst-find]'),fs=at.size*ZOOM*1.3;
  find.style.cssText=`left:${((CW-fs)/2).toFixed(1)}px;top:${((CH-fs)/2).toFixed(1)}px;width:${fs.toFixed(1)}px;height:${fs.toFixed(1)}px`;
  const glow=q('[data-rst-glow]');glow.style.cssText=`left:${(W/2-190).toFixed(1)}px;top:${(RY+at.y*.9-150).toFixed(1)}px;width:380px;height:300px`;
  const place=(x,y,deg)=>`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${deg}deg)`;
  tr(ring,[[0,{opacity:0,transform:'scale(.7)'}],[380,{opacity:1,transform:'scale(1)'},OUT],[950,{opacity:.5,transform:'scale(1.13)'},INOUT],[1550,{opacity:1,transform:'scale(1)'},INOUT],[2500,{opacity:1,transform:'scale(1)'}],[3000,{opacity:0,transform:'scale(1)'}]]);
  tr(q('[data-rst-phone]'),[[0,{opacity:0,transform:place(px+34,py+330,7)}],[1500,{opacity:0,transform:place(px+34,py+330,7)},OUT],[3100,{opacity:1,transform:place(px,py,0)}],[5900,{opacity:1,transform:place(px,py,0)},INOUT],[7100,{opacity:0,transform:place(px+46,py+340,6)}]]);
  tr(q('[data-rst-view]').parentElement,[[0,{opacity:.25}],[2500,{opacity:.25}],[3150,{opacity:1}]]);
  tr(find,[[0,{opacity:0,transform:'scale(1.5)'}],[3450,{opacity:0,transform:'scale(1.5)'},SPRING],[3900,{opacity:1,transform:'scale(1)'}]]);
  tr(q('[data-rst-flash]'),[[0,{opacity:0}],[4250,{opacity:0}],[4360,{opacity:.85}],[4750,{opacity:0}]]);
  tr(q('[data-rst-ok]'),[[0,{opacity:0,transform:'scale(.2)'}],[4350,{opacity:0,transform:'scale(.2)'},SPRING],[4800,{opacity:1,transform:'scale(1)'}]]);
  tr(glow,[[0,{opacity:0}],[5800,{opacity:0}],[7300,{opacity:1}]]);
  root.querySelectorAll('[data-rst-sub]').forEach((sub,i)=>{const [from,to]=SUB_T[i],last=i===SUBS.length-1;
    tr(sub,[[0,{opacity:i?0:1}],...(i?[[from,{opacity:0}],[from+320,{opacity:1}]]:[]),...(last?[]:[[to-260,{opacity:1}],[to,{opacity:0}]])]);});
  const bar=q('[data-rst-progress] i');tr(bar,[[0,{transform:'scaleX(0)'}],[TOTAL,{transform:'scaleX(1)'}]]);
  const end=q('[data-rst-end]'),pause=q('[data-rst="pause"]'),progress=q('[data-rst-progress]');
  const finish=()=>{end.hidden=false;pause.hidden=true;progress.hidden=true;q('[data-rst="wifi"]').hidden=typeof options.onWifiHelp!=='function';};
  end.hidden=true;pause.hidden=still;progress.hidden=still;pause.innerHTML=ICON_PAUSE;pause.setAttribute('aria-label','Pauzeren');
  q('[data-rst-sr]').textContent=SUBS.join(' ');
  if(still){
    // beweging beperken: één stilstaand beeld (de telefoon boven de QR-code) met de laatste zin
    anims.forEach(anim=>{anim.pause();anim.currentTime=STILL;});
    root.querySelectorAll('[data-rst-sub]').forEach((sub,i)=>{sub.getAnimations().forEach(anim=>anim.cancel());sub.style.opacity=i===SUBS.length-1?'1':'0';});
    q('[data-rst-sub="2"]').textContent='Houd je telefoon boven de QR-code op je receiver. De app verbindt zelf.';
    finish();return;
  }
  q('[data-rst-sub="2"]').textContent=SUBS[2];root.querySelectorAll('[data-rst-sub]').forEach(sub=>{sub.style.opacity='';});
  const last=anims[anims.length-1];if(last)last.onfinish=finish;else finish();
}
function togglePause(){
  if(still||!anims.length||!root.querySelector('[data-rst-end]').hidden)return;
  paused=!paused;anims.forEach(anim=>{try{paused?anim.pause():anim.play();}catch(_){}});
  const button=root.querySelector('[data-rst="pause"]');button.innerHTML=paused?ICON_PLAY:ICON_PAUSE;button.setAttribute('aria-label',paused?'Verder spelen':'Pauzeren');
}
function open(request={}){
  options={type:request.type==='SPI'?'SPI':'RGBW',onWifiHelp:typeof request.onWifiHelp==='function'?request.onWifiHelp:null};
  if(!root)root=shell();
  root.hidden=false;document.documentElement.classList.add('ki-open');
  const dialog=root.parentElement;if(dialog&&!dialog.open){try{dialog.showModal();}catch(_){dialog.setAttribute('open','');}}
  if(!ro&&typeof ResizeObserver==='function'){ro=new ResizeObserver(refit);ro.observe(root.querySelector('[data-rst-box]'));}
  requestAnimationFrame(()=>{if(!root||root.hidden)return;play();root.querySelector('.ki-top [data-rst="close"]').focus({preventScroll:true});});
}
function close(){
  if(!root||root.hidden)return;
  anims.forEach(anim=>{try{anim.cancel();}catch(_){}});anims=[];root.hidden=true;root.querySelector('[data-rst-fit]').innerHTML='';
  document.documentElement.classList.remove('ki-open');
  const dialog=root.parentElement;if(dialog?.open){try{dialog.close();}catch(_){dialog.removeAttribute('open');}}
}
window.LightningReceiverScanTutorial=Object.freeze({open,close});
})();
