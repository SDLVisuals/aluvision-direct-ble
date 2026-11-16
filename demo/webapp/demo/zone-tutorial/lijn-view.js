/* C147p: de gewone weergave (Samen en Apart) met gladde ledlines, in dezelfde stijl als de wand.
 *  - Apart:  de ledlines onder elkaar, elk zo lang als ze echt is. Een gekozen ledline blijft fel (sinds 13 nov zonder wit kader: "die omranding moet niet");
 *            wat niet gekozen is, dimt.
 *  - Samen:  één grote, doorlopende ledline, zonder streepjes of randen (12 nov, de eigenaar).
 *            (Het totaal aantal pixels staat klein onder de naam van de zone.)
 * Elke ledline is één vloeiende lijn (één kleurverloop over de hele lengte): geen blokjes en geen naden.
 * Het licht komt uit de tekenaar van de app (LightningPreview.rows). Voor de selectie van de app schrijft de tekenaar
 * canvas.dataset.lineHitRegions en lineTargetBadges (zelfde vorm als de tekenaar van de app).
 *  - Verticaal (13 nov, de eigenaar: "de klant kan kiezen verticaal of horizontaal"): dezelfde lijnen, maar rechtop naast
 *            elkaar; elke ledline begint onderaan en is zo lang als ze echt is. Samen en Apart zien er dan hetzelfde uit
 *            (het licht loopt in Samen gewoon door van de ene ledline naar de volgende).
 *  - pixels:true (13 nov, de eigenaar: "een badge van hoeveel pixels er zijn"): een klein label met de pixels van elke
 *            ledline (aan het einde van de lijn; verticaal erboven); bij één doorlopende ledline het totaal.
 *   ZLijn.draw(canvas, {lines, ids, dim, picked, badges, layout:'stacked'|'continuous', vertical:true|false, pixels:true|false})
 */
window.ZLijn=(()=>{
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// één ledline van x0 tot x1 op hoogte y, dikte T; px = de kleuren van haar pixels ([r,g,b]), dim = 0..1
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
  for(let k=0;k<14;k++){g.globalAlpha=.045*(1-k/15);g.lineWidth=T*(1.15+k*.14);line();}   // veel dunne lagen: een zachte gloed zonder randen
  g.restore();
  g.strokeStyle=col;g.lineWidth=T;line();                              // de kleur
  g.save();g.globalCompositeOperation='lighter';g.strokeStyle=core;g.lineWidth=T*.3;g.beginPath();g.moveTo(x0+T/2,y-T*.16);g.lineTo(x1-T/2,y-T*.16);g.stroke();g.restore();   // een lichte kern
}
// een klein label "48 px": x,y = het midden (align 'center') of de linkerkant (align 'left') of de rechterkant ('right')
function pxTag(g,text,x,y,align='center'){g.save();g.font='800 10.5px system-ui,-apple-system,sans-serif';g.textBaseline='middle';
  const w=Math.ceil(g.measureText(text).width)+12,h=17,x0=align==='left'?x:align==='right'?x-w:x-w/2;
  g.fillStyle='rgba(255,255,255,.12)';g.beginPath();g.roundRect(x0,y-h/2,w,h,h/2);g.fill();
  g.fillStyle='rgba(236,239,242,.82)';g.textAlign='center';g.fillText(text,x0+w/2,y+.5);g.restore();return w;}
function draw(c,o){const rect=c.getBoundingClientRect();if(!rect.width||!rect.height)return;const d=Math.min(2,devicePixelRatio||1),w=Math.round(rect.width*d),h=Math.round(rect.height*d);
  if(c.width!==w||c.height!==h){c.width=w;c.height=h;}const g=c.getContext('2d'),W=rect.width,H=rect.height;g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,W,H);
  const lines=o.lines||[],n=lines.length,regions=[],badges=[];
  c.dataset.spatialShape='';c.dataset.lineHitPaths='[]';
  if(!n){c.dataset.lineHitRegions='[]';c.dataset.lineTargetBadges='[]';return;}
  const px=lines.map(l=>Math.max(1,l.length));
  if(o.vertical===true&&o.layout==='continuous'){
    // verticaal en "1 ledline": één lange staande ledline met alle pixels achter elkaar, het totaal erboven
    const head=o.pixels===true?30:14,foot=16,T=clamp(W*.045,12,20),all=[].concat(...lines),len=H-head-foot;
    g.save();g.translate(W/2,H-foot);g.rotate(-Math.PI/2);bar(g,0,len,0,T,all,o.dim?.every(Boolean)?.3:1);g.restore();
    if(o.pixels===true)pxTag(g,`${all.length} px`,W/2,head/2+2);
    c.dataset.lineHitRegions='[]';c.dataset.lineTargetBadges='[]';return;}
  if(o.vertical===true){
    // rechtop naast elkaar: elke ledline begint onderaan; de knopjes met het nummer staan eronder
    // dichter bij elkaar (de eigenaar 13 nov): hoogstens 58 px tussen twee ledlines, samen in het midden (bij veel ledlines minder)
    const pick=o.badges===true,foot=pick?50:16,head=o.pixels===true?28:12,col=Math.min(W/n,58),x0=(W-col*n)/2,maxPx=Math.max(...px),usable=H-foot-head,T=clamp(col*.16,6,11),some=!!o.picked&&o.picked.some(v=>!v);
    for(let i=0;i<n;i++){const left=x0+col*i,cx=left+col/2,len=Math.max(T*2,usable*px[i]/maxPx),base=H-foot,chosen=some&&o.picked[i];
      g.save();g.translate(cx,base);g.rotate(-Math.PI/2);bar(g,0,len,0,T,lines[i],o.dim?.[i]?.3:1);g.restore();
      if(o.pixels===true)pxTag(g,`${px[i]} px`,cx,Math.max(10,base-len-14));
      regions[i]={receiverId:o.ids?.[i],x:+(left/W).toFixed(4),y:0,width:+(col/W).toFixed(4),height:1};
      badges[i]={receiverId:o.ids?.[i],x:+(cx/W).toFixed(4),y:+((H-foot/2)/H).toFixed(4)};}
    // kleine nummers als er geen knopjes over het beeld liggen
    if(!pick&&o.numbers===true&&n>1){g.font='700 11px system-ui,-apple-system,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle='rgba(235,238,241,.6)';
      for(let i=0;i<n;i++)g.fillText(String(i+1),x0+col*(i+.5),H-foot/2);}
    c.dataset.lineHitRegions=JSON.stringify(o.ids?regions:[]);c.dataset.lineTargetBadges=JSON.stringify(o.ids&&pick?badges:[]);return;}
  if(o.layout==='continuous'){
    // één grote doorlopende ledline: alle pixels achter elkaar
    const pad=Math.max(20,W*.06),T=clamp(H*.2,12,20),y=H*.52,all=[].concat(...lines),total=all.length;
    bar(g,pad,W-pad,y,T,all,o.dim?.every(Boolean)?.3:1);
    if(o.pixels===true)pxTag(g,`${total} px`,W-pad,Math.max(10,y-T/2-14),'right');
    c.dataset.lineHitRegions='[]';c.dataset.lineTargetBadges='[]';return;}
  // onder elkaar: elke ledline zo lang als ze echt is
  const pick=o.badges===true,gutter=pick?50:14,padR=o.pixels===true?62:50,lane=(H-8)/n,maxPx=Math.max(...px),usable=W-gutter-padR,T=clamp(lane*.22,6,10),some=!!o.picked&&o.picked.some(v=>!v);
  for(let i=0;i<n;i++){const top=4+lane*i,cy=top+lane/2,len=Math.max(T*2,usable*px[i]/maxPx),chosen=some&&o.picked[i];
    bar(g,gutter,gutter+len,cy,T,lines[i],o.dim?.[i]?.3:1);
    if(o.pixels===true)pxTag(g,`${px[i]} px`,Math.min(gutter+len+8,W-56),cy,'left');
    regions[i]={receiverId:o.ids?.[i],x:0,y:+(top/H).toFixed(4),width:1,height:+(lane/H).toFixed(4)};
    badges[i]={receiverId:o.ids?.[i],x:+(26/W).toFixed(4),y:+(cy/H).toFixed(4)};}
  c.dataset.lineHitRegions=JSON.stringify(o.ids?regions:[]);c.dataset.lineTargetBadges=JSON.stringify(o.ids&&pick?badges:[]);}
return {draw};
})();
