/* Aluvision: het voorbeeld van de nieuwe zonepagina (C250, uit prototypes/zone-facelift/lijn-view.js; de eigenaar 13-14 nov).
 * Elke ledline is één gladde, dunne lijn (één kleurverloop over de hele lengte): geen blokjes en geen naden.
 *  - onder elkaar (Apart, en RGBW): elke ledline zo lang als ze echt is; wat niet gekozen is, dimt;
 *  - 1 ledline (continuous): één grote doorlopende ledline met alle pixels achter elkaar;
 *  - verticaal: dezelfde lijnen rechtop naast elkaar, elke ledline begint onderaan; bij 1 ledline één staande lijn;
 *  - pixels: een klein label "48 px" bij elke ledline (bij 1 ledline het totaal). RGBW heeft geen pixels.
 * Het licht komt uit de tekenaar van de app (LightningPreview.rows): dezelfde pixels als het gewone voorbeeld, ook een
 * verloop in bewerking en de herkenningskleuren. Voor de knopjes 1, 2, 3 … schrijft dit canvas.dataset.lineHitRegions en
 * lineTargetBadges in dezelfde vorm als de tekenaar van de app (syncPreviewTargets leest ze).
 * Dit tekent alleen; het stuurt niets naar een receiver.
 *   LightningZoneLines.draw(canvas, opties van P.draw + {zoneVertical:true|false, zonePixels:true|false})
 */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// één ledline van x0 tot x1 op hoogte y, dikte T; px = de kleuren van haar pixels ([r,g,b], scherm), dim = 0..1
function bar(g,x0,x1,y,T,px,dim){
  const len=Math.max(1,x1-x0),n=Math.max(1,px.length),M=clamp(Math.round(len/3),2,160);
  const at=u=>{const p=clamp(u,0,1)*(n-1),i=Math.floor(p),f=p-i,a=px[i]||[0,0,0],b=px[Math.min(n-1,i+1)]||a;return [(a[0]+(b[0]-a[0])*f)*dim,(a[1]+(b[1]-a[1])*f)*dim,(a[2]+(b[2]-a[2])*f)*dim];};
  const col=g.createLinearGradient(x0,0,x1,0),core=g.createLinearGradient(x0,0,x1,0);let lit=false;
  for(let m=0;m<=M;m++){const k=at(m/M),mx=Math.max(k[0],k[1],k[2])/255,l=(k[0]*.2126+k[1]*.7152+k[2]*.0722)/255;if(mx>.02)lit=true;
    col.addColorStop(m/M,`rgba(${k[0]|0},${k[1]|0},${k[2]|0},${Math.min(1,mx*1.7).toFixed(3)})`);core.addColorStop(m/M,`rgba(255,255,255,${Math.min(.5,l*.6).toFixed(3)})`);}
  const line=()=>{g.beginPath();g.moveTo(x0+T/2,y);g.lineTo(x1-T/2,y);g.stroke();};
  g.lineCap='round';
  g.strokeStyle='#3a3e45';g.lineWidth=T;line();                       // de ledline zelf (uit: grijs)
  if(!lit)return;
  g.save();g.globalCompositeOperation='lighter';g.strokeStyle=col;     // de gloed: dezelfde lijn, breder en zachter
  for(let k=0;k<14;k++){g.globalAlpha=.045*(1-k/15);g.lineWidth=T*(1.15+k*.14);line();}
  g.restore();
  g.strokeStyle=col;g.lineWidth=T;line();                              // de kleur
  g.save();g.globalCompositeOperation='lighter';g.strokeStyle=core;g.lineWidth=T*.3;g.beginPath();g.moveTo(x0+T/2,y-T*.16);g.lineTo(x1-T/2,y-T*.16);g.stroke();g.restore();
}
// een klein label "48 px": x,y = het midden ('center'), de linkerkant ('left') of de rechterkant ('right')
function pxTag(g,text,x,y,align='center'){g.save();g.font='800 10.5px system-ui,-apple-system,sans-serif';g.textBaseline='middle';
  const w=Math.ceil(g.measureText(text).width)+12,h=17,x0=align==='left'?x:align==='right'?x-w:x-w/2;
  g.fillStyle='rgba(255,255,255,.12)';g.beginPath();if(g.roundRect)g.roundRect(x0,y-h/2,w,h,h/2);else g.rect(x0,y-h/2,w,h);g.fill();
  g.fillStyle='rgba(236,239,242,.82)';g.textAlign='center';g.fillText(text,x0+w/2,y+.5);g.restore();return w;}
// hoe fel ledline i brandt op tijdstip now (eigen timing): snel aan, zacht uit
function level(q,i,now){const dur=Math.max(.2,+q.dur||2),tau=((now%dur)+dur)%dur;let d=tau-(+q.t[i]||0);if(d<0)d+=dur;const a=Math.max(.02,q.in??.04),on=Math.max(a,+q.hold||.35),fade=Math.max(.02,q.out??Math.max(.12,(+q.hold||.35)*.6));
  if(d<a)return d/a;if(d<on)return 1;return d<on+fade?1-(d-on)/fade:0;}
const ident=row=>({receiverId:row.receiverId,...(row.lineId?{lineId:row.lineId}:{})});
function draw(c,o){
  const P=root.LightningPreview,C=root.LightningColour;if(!P||!C)return;
  const rect={width:c.clientWidth,height:c.clientHeight};if(!rect.width||!rect.height)return;
  const d=Math.min(2,root.devicePixelRatio||1),w=Math.round(rect.width*d),h=Math.round(rect.height*d);
  if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
  const g=c.getContext('2d'),W=rect.width,H=rect.height;g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,W,H);
  let rows=o.zoneRows||null;
  if(!rows){let frame;try{frame=P.rows(o);}catch(_){frame=null;}rows=frame?(frame.lineRows&&frame.lineRows.length?frame.lineRows:frame.rows):[];}
  c.dataset.spatialShape='';c.dataset.lineHitPaths='[]';
  let lines=rows.map(row=>(row.identificationPixels||row.pixels||[]).map(p=>C.screenRGB(p)));
  // samengevoegde ledlines (zone-page.js, voorlopig alleen in het voorbeeld): één lijn, één nummer, alle pixels
  if(Array.isArray(o.zoneJoined)&&o.zoneJoined.length){
    const groupOf=new Map();o.zoneJoined.forEach(g=>g.forEach(id=>groupOf.set(id,g)));const grp=row=>groupOf.get(row.lineId)||groupOf.get(row.receiverId),inG=(g,row)=>g.includes(row.lineId)||g.includes(row.receiverId);
    const keepRows=[],keepLines=[],done=new Set();
    rows.forEach((row,i)=>{const g=grp(row);if(!g){keepRows.push(row);keepLines.push(lines[i]);return;}if(done.has(g))return;done.add(g);
      const idx=rows.map((r,j)=>inG(g,r)?j:-1).filter(j=>j>=0);keepRows.push({...row,selected:idx.some(j=>rows[j].selected!==false)});keepLines.push([].concat(...idx.map(j=>lines[j])));});
    rows=keepRows;lines=keepLines;}
  // eigen timing (zone-page.js, voorlopig alleen in het voorbeeld): elke ledline in haar kleur, aan op haar eigen moment
  if(o.zoneTiming&&Array.isArray(o.zoneTiming.t)&&o.zoneTiming.t.length===lines.length){const q=o.zoneTiming,cols=(q.colours&&q.colours.length?q.colours:['#FFFFFF']).map(h=>C.screenRGB([1,3,5].map(k=>parseInt(String(h).slice(k,k+2),16)||0)));
    lines=lines.map((l,i)=>{const v=level(q,i,Number(o.time)||0),k=cols[i%cols.length];return l.map(()=>[k[0]*v,k[1]*v,k[2]*v]);});}
  const n=rows.length,regions=[],badges=[];
  if(!n){c.dataset.lineHitRegions='[]';c.dataset.lineTargetBadges='[]';return;}
  const spi=rows.every(row=>row.type==='SPI'),px=lines.map(l=>Math.max(1,l.length)),pixels=o.zonePixels===true&&spi;
  const some=o.selection&&o.selection.kind!=='all'&&rows.some(row=>row.selected===false);
  const dim=rows.map(row=>some&&row.selected===false?.3:row.offline?.45:1);
  const pick=o.interactiveLines===true,continuous=o.layout==='continuous'&&spi;
  if(o.zoneVertical===true&&continuous){
    // verticaal en 1 ledline: één lange staande ledline met alle pixels achter elkaar, het totaal erboven
    const head=pixels?30:14,foot=16,T=clamp(W*.045,12,20),all=[].concat(...lines),len=H-head-foot;
    g.save();g.translate(W/2,H-foot);g.rotate(-Math.PI/2);bar(g,0,len,0,T,all,1);g.restore();
    if(pixels)pxTag(g,`${all.length} px`,W/2,head/2+2);
    c.dataset.lineHitRegions='[]';c.dataset.lineTargetBadges='[]';return;}
  if(o.zoneVertical===true){
    // rechtop naast elkaar, dicht bij elkaar (hoogstens 58 px ertussen), samen in het midden; de knopjes eronder
    const foot=pick?50:16,head=pixels?28:12,col=Math.min(W/n,58),x0=(W-col*n)/2,maxPx=Math.max(...px),usable=H-foot-head,T=clamp(col*.16,6,11);
    for(let i=0;i<n;i++){const left=x0+col*i,cx=left+col/2,len=Math.max(T*2,spi?usable*px[i]/maxPx:usable),base=H-foot;
      g.save();g.translate(cx,base);g.rotate(-Math.PI/2);bar(g,0,len,0,T,lines[i],dim[i]);g.restore();
      if(pixels)pxTag(g,`${px[i]} px`,cx,Math.max(10,base-len-14));
      regions[i]={...ident(rows[i]),x:+(left/W).toFixed(4),y:0,width:+(col/W).toFixed(4),height:1};
      badges[i]={...ident(rows[i]),x:+(cx/W).toFixed(4),y:+((H-foot/2)/H).toFixed(4)};}
    if(!pick&&n>1){g.font='700 11px system-ui,-apple-system,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle='rgba(235,238,241,.6)';
      for(let i=0;i<n;i++)g.fillText(String(i+1),x0+col*(i+.5),H-foot/2);}
    c.dataset.lineHitRegions=JSON.stringify(regions);c.dataset.lineTargetBadges=JSON.stringify(pick?badges:[]);return;}
  if(continuous){
    // één grote doorlopende ledline: alle pixels achter elkaar
    const pad=Math.max(20,W*.06),T=clamp(H*.2,12,20),y=H*.52,all=[].concat(...lines);
    bar(g,pad,W-pad,y,T,all,1);
    if(pixels)pxTag(g,`${all.length} px`,W-pad,Math.max(10,y-T/2-14),'right');
    c.dataset.lineHitRegions='[]';c.dataset.lineTargetBadges='[]';return;}
  // onder elkaar: elke ledline zo lang als ze echt is (RGBW: allemaal even lang)
  const gutter=pick?50:14,padR=pixels?62:24,lane=(H-8)/n,maxPx=Math.max(...px),usable=W-gutter-padR,T=clamp(lane*.22,6,10);
  for(let i=0;i<n;i++){const top=4+lane*i,cy=top+lane/2,len=Math.max(T*2,spi?usable*px[i]/maxPx:usable);
    bar(g,gutter,gutter+len,cy,T,lines[i],dim[i]);
    if(pixels)pxTag(g,`${px[i]} px`,Math.min(gutter+len+8,W-56),cy,'left');
    regions[i]={...ident(rows[i]),x:0,y:+(top/H).toFixed(4),width:1,height:+(lane/H).toFixed(4)};
    badges[i]={...ident(rows[i]),x:+(26/W).toFixed(4),y:+(cy/H).toFixed(4)};}
  c.dataset.lineHitRegions=JSON.stringify(regions);c.dataset.lineTargetBadges=JSON.stringify(pick?badges:[]);
}
root.LightningZoneLines=Object.freeze({draw,level});
}(window));
