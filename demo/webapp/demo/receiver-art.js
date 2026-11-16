/* Aluvision receiver-tekening (SPI) — één bron voor alle tutorials en animaties in de app.
 *
 *   AluvisionReceiverArt.svg(opties)     → SVG-tekst
 *   AluvisionReceiverArt.mount(el, opties) → tekent in el, geeft de ankerpunten terug
 *   AluvisionReceiverArt.anchors(opties) → [{port, x, y, end:{x,y}}] in viewBox-coördinaten
 *
 * Opties (allemaal optioneel):
 *   view      'persp' (3/4, standaard) | 'top' (bovenaanzicht)
 *   style     'filled' (zwart, voor de app, standaard) | 'line' (dunne lijnen, zoals op de dozen)
 *   theme     'light' (standaard) | 'dark'
 *   outputs   4 items, één per uitgang (1 = achteraan / bovenaan):
 *               null = leeg · true = kabel aangesloten · 'blauw' of '#hex' = kabel met die ledline-kleur
 *               {color:'geel', on:true} = die ledline brandt in zijn kleur
 *   cable     lengte witte kabel buiten de behuizing in mm (standaard 28)
 *   ledline   0 = geen; anders lengte (mm) van een stukje ledline met ronde schroefconnector aan elke kabel
 *   power     true: stroomkabel tekenen (standaard) · powerCable: lengte in mm (standaard 22)
 *   caps      true: kapjes dicht (standaard) · false: open, je ziet de klemmen (alleen 'top')
 *   led       kleur van het statuslampje of null (uit)
 *   scale     px per mm voor width/height (standaard 3) · width: vaste breedte in px
 *   shadow    zachte schaduw (standaard true, alleen 'persp')
 *   bg        achtergrond waar de lijnstijl mee vult (standaard wit / bijna zwart)
 *
 * type 'spi' (standaard): 4 witte kabels. type 'rgbw': 1 zwarte kabel naar een splitter, daarna 4 witte kabeltjes
 *   (outputs = die 4 kabeltjes); extra optie lead (mm, standaard 16).
 *   RGBW stuurt één kleur tegelijk: alle aangesloten ledlines krijgen dezelfde kleur (optie color, anders de eerste
 *   gekozen kleur) en branden samen (optie on, anders: zodra er één brandt).
 * Maten volgen het 3D-ontwerp v0.7 (155 × 60 × 24 mm, kapjes 37,5 mm met kabelruimte) (spi-receiver-3d.html): 140 × 60 × 24 mm, kapjes van 20 mm.
 */
(function(root){
'use strict';
const LOGO='data:image/png;base64,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';
const COLORS={blauw:'#2F6BFF',geel:'#FFC61A',paars:'#9B4DFF',groen:'#1FC45B'};
const ORDER=['blauw','geel','paars','groen'];
const D={W:60,H:24,XB:40,XE:77.5,TX:45,GAP:.5,CH:[-18.75,-6.25,6.25,18.75],DCY:7.4,DR:3,DN:3.6,PZ:-13,PCY:8,PR:3.5,PN:4.3,FZ:10,RZ:22,RCY:8,RR:3.75,RN:4.3,RP:7.62};
const HC=D.H+.6;                                   // hoogte van de kapjes
const PAL={
  filled:{
    light:{top:'#232428',front:'#141517',bevel:'#1c1d20',capTop:'#27282c',capFront:'#17181b',capBevel:'#1f2023',capEnd:'#1d1e21',
      edge:'#3b3e43',print:'#f1f1ee',hole:'#060607',rubber:'#3a3d42',black:'#141416',blackEdge:'#3b3e43',cable:'#f7f7f4',cableEdge:'#aeb3b8',
      sleeve:'#eceef0',sleeveSide:'#cfd3d7',sleeveEdge:'#aeb3b8',conn:'#d3d6da',connEdge:'#8d939a',qrBg:'#ffffff',qrInk:'#0e0f10',
      floor:'#0f1012',term:'#43474d',termEdge:'#5a5f66',screw:'#c4c8ce',fuse:'#f2c230',reset:'#d23b2f',ledOff:'#2b2d31',shadow:'#000000',shadowA:.18},
    dark:{top:'#232428',front:'#141517',bevel:'#1c1d20',capTop:'#27282c',capFront:'#17181b',capBevel:'#1f2023',capEnd:'#1d1e21',
      edge:'#5a5f66',print:'#f1f1ee',hole:'#060607',rubber:'#3a3d42',black:'#141416',blackEdge:'#5a5f66',cable:'#f2f2ef',cableEdge:'#7d838a',
      sleeve:'#e4e6e9',sleeveSide:'#b9bec4',sleeveEdge:'#7d838a',conn:'#c9cdd2',connEdge:'#7d838a',qrBg:'#ffffff',qrInk:'#0e0f10',
      floor:'#0f1012',term:'#43474d',termEdge:'#5a5f66',screw:'#c4c8ce',fuse:'#f2c230',reset:'#d23b2f',ledOff:'#2b2d31',shadow:'#000000',shadowA:.45}
  },
  line:{light:{ink:'#14171a',bg:'#ffffff'},dark:{ink:'#e6e8eb',bg:'#0f1113'}}
};
function palette(o){
  if(o.style==='line'){const b=PAL.line[o.theme]||PAL.line.light,ink=b.ink,bg=o.bg||b.bg;
    return {line:true,ink,bg,top:bg,front:bg,bevel:bg,capTop:bg,capFront:bg,capBevel:bg,capEnd:bg,edge:ink,print:ink,hole:ink,rubber:bg,
      cable:bg,cableEdge:ink,black:ink,blackEdge:ink,sleeve:bg,sleeveSide:bg,sleeveEdge:ink,conn:bg,connEdge:ink,qrBg:bg,qrInk:ink,floor:bg,term:bg,termEdge:ink,
      screw:bg,fuse:bg,reset:bg,ledOff:bg,shadow:ink,shadowA:0};}
  return Object.assign({line:false},PAL.filled[o.theme]||PAL.filled.light);
}
function colorOf(c,i){if(!c||c===true)return COLORS[ORDER[i]];return COLORS[c]||c;}
function norm(o){
  o=o||{};
  const n=Object.assign({type:'spi',view:'persp',style:'filled',theme:'light',cable:28,lead:16,ledline:0,power:true,powerCable:22,
    caps:true,led:null,scale:3,shadow:true,bg:null,title:'Aluvision SPI-receiver'},o);
  const src=o.outputs||[];
  n.outputs=[0,1,2,3].map(i=>{let p=src[i];if(!p)return null;
    if(p===true||typeof p==='string')return {color:colorOf(p,i),on:false,tinted:typeof p==='string'};
    return {color:colorOf(p.color,i),on:!!p.on,tinted:!!p.color};});
  if(n.type==='rgbw'){                                 // één kleur voor alle ledlines aan de splitter
    const first=n.outputs.find(q=>q&&q.tinted)||n.outputs.find(q=>q);
    const col=colorOf(o.color||(first&&first.tinted?first.color:null)||'blauw',0),on=o.on!==undefined?!!o.on:n.outputs.some(q=>q&&q.on);
    n.outputs=n.outputs.map(q=>q?{color:col,on,tinted:true}:null);}
  if(n.view!=='top')n.caps=true;
  return n;
}
let uid=0;
const f=v=>(Math.round(v*100)/100).toString();
// splitter (RGBW), langs x vanaf het begin xs (naar links): [lengte, diameter] per deel; daarna de kabeltjes
const SPLIT=[[3,9.2,'b'],[7,11.8,'t'],[7.6,10.8,'b'],[2.4,13.2,'t'],[10,12.8,'b'],[3,11.4,'b'],[2.5,9,'b'],[1.5,7.2,'b']];
const SPLIT_LEN=SPLIT.reduce((a,q)=>a+q[0],0);
const bez=(p0,p1,p2,p3,n=14)=>Array.from({length:n+1},(_,k)=>{const t=k/n,u=1-t;
  return [u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0],u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]];});
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const FD="Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif",FM="'IBM Plex Mono',ui-monospace,Menlo,monospace";

// ---------- vaste onderdelen ----------
function strokeAttr(c,w){return ` stroke="${c}" stroke-width="${w}" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"`;}
function qrPath(x0,y0,mod){let s=20261111;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const n=25,inF=(i,j)=>(i<8&&j<8)||(i>n-9&&j<8)||(i<8&&j>n-9);let d='';
  const sq=(x,y,w)=>`M${f(x)} ${f(y)}h${f(w)}v${f(w)}h${f(-w)}z`;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++)if(!inF(i,j)&&rnd()<.5)d+=sq(x0+i*mod,y0+j*mod,mod*1.02);
  let fin='';for(const [fi,fj] of [[0,0],[n-7,0],[0,n-7]]){const X=x0+fi*mod,Y=y0+fj*mod;
    fin+=sq(X,Y,7*mod)+`M${f(X+mod)} ${f(Y+mod)}v${f(5*mod)}h${f(5*mod)}v${f(-5*mod)}z`+sq(X+2*mod,Y+2*mod,3*mod);}
  return {d,fin};}
// opdruk bovenop het middenstuk, in (x, z) mm
function printTop(p,o,id){
  const c=p.print,led=o.led;let s='';
  if(led)s+=`<circle cx="-31" cy="-17" r="4.2" fill="${led}" opacity=".45" filter="url(#${id}-glow)"/>`;
  s+=`<circle cx="-31" cy="-17" r="2.7" fill="none" stroke="${c}" stroke-width=".3"/><circle cx="-31" cy="-17" r="1.8" fill="${led||p.ledOff}"${p.line&&!led?` stroke="${c}" stroke-width=".2"`:''}/>`;
  s+=`<text x="-27.4" y="-16.3" font-family="${FM}" font-size="2.1" font-weight="500" fill="${c}">STATUS</text>`;
  s+=`<image href="${LOGO}" x="-29" y="-12.5" width="36" height="11.95" preserveAspectRatio="xMidYMid meet" filter="url(#${id}-tint)"/>`;
  s+=`<text x="-11" y="3.8" text-anchor="middle" font-family="${FM}" font-size="2.1" font-weight="500" letter-spacing=".45" fill="${c}">${o.type==='rgbw'?'RGBW RECEIVER · 1 OUT':'SPI RECEIVER · 4 OUT'}</text>`;
  s+=`<rect x="-35" y="6.9" width="70" height=".2" fill="${c}" opacity=".45"/>`;
  [['IN   24 V DC  13,3 A  320 W',11.8],[o.type==='rgbw'?'OUT  RGBW 24 V DC  13,3 A':'OUT  4 × 24 V DC  max 5 A',16],['−20…+45 °C  IP20  binnen',20.2]].forEach(([t,y])=>
    s+=`<text x="-35" y="${y}" font-family="${FM}" font-size="2.1" font-weight="500" fill="${c}" xml:space="preserve">${esc(t)}</text>`);
  const arc=(cx,cy,r)=>{const a0=.3*Math.PI,a1=1.7*Math.PI;return `M${f(cx+r*Math.cos(a0))} ${f(cy+r*Math.sin(a0))}A${r} ${r} 0 1 1 ${f(cx+r*Math.cos(a1))} ${f(cy+r*Math.sin(a1))}`;};
  s+=`<path d="${arc(14,15.2,2.7)}${arc(21.3,15.2,2.7)}M18.6 15.2H21.85" fill="none" stroke="${c}" stroke-width=".8"/>`;
  const k=.065,bx=26.2,by=10.5,P=(x,y)=>`${f(bx+x*k)} ${f(by+y*k)}`;
  s+=`<path d="M${P(0,12)}L${P(70,12)}M${P(6,12)}L${P(12,90)}L${P(58,90)}L${P(64,12)}M${P(24,12)}L${P(28,4)}L${P(42,4)}L${P(46,12)}M${P(-6,0)}L${P(76,100)}M${P(76,0)}L${P(-6,100)}" fill="none" stroke="${c}" stroke-width=".3"/>`;
  s+=`<rect x="${f(bx)}" y="${f(by+106*k)}" width="${f(70*k)}" height=".6" fill="${c}"/>`;
  const q=qrPath(14.25,-21.75,.78);
  s+=`<rect x="13" y="-23" width="22" height="22" rx="1" fill="${p.qrBg}"${p.line?` stroke="${c}" stroke-width=".25"`:''}/><path d="${q.d}${q.fin}" fill="${p.qrInk}" fill-rule="evenodd"/>`;
  s+=`<text x="24" y="2" text-anchor="middle" font-family="${FM}" font-size="1.9" fill="${c}">${o.type==='rgbw'?'ALV-RGBW-1':'ALV-SPI-4'}</text><text x="24" y="5" text-anchor="middle" font-family="${FM}" font-size="1.9" fill="${c}">S/N 000123</text>`;
  return s;
}
// opdruk op de kapjes, in (x, z) mm
function printCaps(p,o){
  const c=p.print;let s='';
  if(o.type==='rgbw')s+=`<text transform="translate(-59 0) rotate(-90)" text-anchor="middle" y="1.2" font-family="${FD}" font-size="3.4" font-weight="800" letter-spacing=".5" fill="${c}">RGBW OUT</text>`;
  else{D.CH.forEach((z,i)=>s+=`<text x="-71.5" y="${f(z+1.3)}" text-anchor="middle" font-family="${FD}" font-size="3.6" font-weight="800" fill="${c}">${i+1}</text>`);
  s+=`<text transform="translate(-62.5 0) rotate(-90)" text-anchor="middle" y="1" font-family="${FD}" font-size="2.8" font-weight="800" letter-spacing=".4" fill="${c}">DATA</text>`;}
  s+=`<text transform="translate(59 0) rotate(-90)" text-anchor="middle" y="1" font-family="${FD}" font-size="2.8" font-weight="800" letter-spacing=".2" fill="${c}">24 V DC IN</text>`;
  return s;
}
function defs(id,p){
  return `<defs><filter id="${id}-tint" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB"><feFlood flood-color="${p.print}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`+
    `<filter id="${id}-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.2"/></filter>`+
    `<filter id="${id}-shadow" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="2.6"/></filter></defs>`;
}

// ---------- bovenaanzicht ----------
function topView(o,p,id){
  const B={x0:-D.XE-2,x1:D.XE+2,y0:-33,y1:33},grow=(x0,x1,y0,y1)=>{B.x0=Math.min(B.x0,x0);B.x1=Math.max(B.x1,x1);B.y0=Math.min(B.y0,y0);B.y1=Math.max(B.y1,y1);};
  const ew=p.line?1.1:.7,E=c=>strokeAttr(c,ew);
  let s='',glow='';const anchors=[];
  const cab=(x0,x1,z,d,col,on)=>{
    if(on)glow+=`<line x1="${f(x0)}" y1="${f(z)}" x2="${f(x1)}" y2="${f(z)}" stroke="${col}" stroke-width="${f(d+6)}" stroke-linecap="round" opacity=".6"/>`;
    s+=`<line x1="${f(x0)}" y1="${f(z)}" x2="${f(x1)}" y2="${f(z)}" stroke="${p.cableEdge}" stroke-width="${f(d+.5)}" stroke-linecap="round"/>`+
       `<line x1="${f(x0)}" y1="${f(z)}" x2="${f(x1)}" y2="${f(z)}" stroke="${p.cable}" stroke-width="${f(d-.5)}" stroke-linecap="round"/>`;};
  // stroomkabel
  if(o.power){const x1=D.XE+o.powerCable;cab(D.XE-6,x1,D.PZ,7,null,false);grow(0,x1+4,0,0);}
  // stukje ledline met ronde schroefconnector aan een kabeleinde (xe, z)
  const stub=(xe,z,q,a)=>{
    if(q.empty){const xc=xe-12;                         // splitter-kabeltje zonder ledline: alleen de connector
      s+=`<rect x="${f(xc)}" y="${f(z-3.6)}" width="12" height="7.2" rx="1.2" fill="${p.conn}"${E(p.connEdge)}/>`;grow(xc-3,0,z-6,z+6);return;}
    if(o.ledline){const xc=xe-12,xl=xc-o.ledline;
      if(q.on)glow+=`<rect x="${f(xl-3)}" y="${f(z-8)}" width="${f(o.ledline+6)}" height="16" rx="8" fill="${q.color}" opacity=".7"/>`;
      s+=`<rect x="${f(xl)}" y="${f(z-5)}" width="${f(o.ledline)}" height="10" rx="1.4" fill="${q.on?q.color:p.sleeve}"${E(q.on&&!p.line?q.color:p.sleeveEdge)}/>`;
      if(q.on&&!p.line)s+=`<rect x="${f(xl+1)}" y="${f(z-2.6)}" width="${f(o.ledline-2)}" height="2.2" rx="1" fill="#ffffff" opacity=".55"/>`;
      s+=`<rect x="${f(xc)}" y="${f(z-3.6)}" width="12" height="7.2" rx="1.2" fill="${p.conn}"${E(p.connEdge)}/>`+
         `<rect x="${f(xc+4.4)}" y="${f(z-4.3)}" width="3.6" height="8.6" rx=".6" fill="${p.conn}"${E(p.connEdge)}/>`+
         `<path d="M${f(xc+1.6)} ${f(z-3.6)}v7.2M${f(xc+2.8)} ${f(z-3.6)}v7.2M${f(xc+9.4)} ${f(z-3.6)}v7.2M${f(xc+10.6)} ${f(z-3.6)}v7.2" fill="none"${E(p.connEdge)}/>`;
      a.end={x:xl,y:z};grow(xl-4,0,z-9,z+9);}
    else{a.end={x:xe,y:z};grow(xe-5,0,z-6,z+6);}
    anchors.push(a);};
  if(o.type==='rgbw'){                                 // RGBW: zwarte kabel -> splitter -> 4 witte kabeltjes
    const xs=-D.XE-o.cable,xsp=xs-SPLIT_LEN,xf=xsp-20,xe=xf-o.lead,x0=o.caps?-D.XE+4:-(D.TX+20);
    s+=`<line x1="${f(x0)}" y1="0" x2="${f(xs)}" y2="0" stroke="${p.blackEdge}" stroke-width="8" stroke-linecap="round"/>`+
       `<line x1="${f(x0)}" y1="0" x2="${f(xs)}" y2="0" stroke="${p.black}" stroke-width="7" stroke-linecap="round"/>`;
    [0,1,2,3].forEach(i=>{const q=o.outputs[i]||{color:null,on:false,empty:true},z=D.CH[i],z0=(i-1.5)*1.7,
      d='M'+bez([xsp+1,z0],[xsp-8,z0*1.3],[xf+9,z],[xf,z]).map(r=>f(r[0])+' '+f(r[1])).join('L')+`L${f(xe)} ${f(z)}`;
      if(q.on&&!o.ledline)glow+=`<path d="${d}" fill="none" stroke="${q.color}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/>`;
      s+=`<path d="${d}" fill="none" stroke="${p.cableEdge}" stroke-width="4.3" stroke-linecap="round" stroke-linejoin="round"/>`+
         `<path d="${d}" fill="none" stroke="${p.cable}" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round"/>`;
      stub(xe,z,q,{port:i+1,x:xe,y:z,color:q.color,on:q.on});});
    {let x=xs;for(const [len,dia,kind] of SPLIT){const r=dia/2,x1=x-len;                     // splitter: doorvoer, schroefdraad, lijf, kraag, huis, punt
      s+=`<rect x="${f(x1)}" y="${f(-r)}" width="${f(len)}" height="${f(dia)}" rx="${kind==='t'?.6:Math.min(1.5,len/2)}" fill="${p.black}"${E(p.blackEdge)}/>`;
      if(kind==='t'&&len>4)for(let k=1;k<6;k++)s+=`<path d="M${f(x-k*len/6)} ${f(-r)}v${f(dia)}" fill="none"${E(p.blackEdge)}/>`;
      x=x1;}}
    grow(xe-5,0,-24,24);
  } else
  o.outputs.forEach((q,i)=>{if(!q)return;const z=D.CH[i],xe=-D.XE-o.cable,x0=o.caps?-D.XE+4:-(D.TX+20);
    const lit=q.on&&!o.ledline;cab(x0,xe,z,6,q.color,lit);
    stub(xe,z,q,{port:i+1,x:xe,y:z,color:q.color,on:q.on});});
  if(!o.caps){                                         // open: bodem, klemmen, rubber, zekering, reset
    for(const dir of [-1,1])s+=`<rect x="${dir<0?-D.XE:D.XB+D.GAP}" y="-28.3" width="${D.XE-D.XB-D.GAP}" height="56.6" fill="${p.floor}"${E(p.edge)}/>`;
    if(o.type==='rgbw'){const wc=['#c8302c','#2f9e44','#2f6bff','#f1f1ee','#202022'];
      s+=`<rect x="-50" y="${f(-2.5*D.RP)}" width="10" height="${f(5*D.RP)}" rx=".6" fill="${p.term}"${E(p.termEdge)}/>`;
      ['R','G','B','W','+'].forEach((t,k)=>{const zz=(k-2)*D.RP;
        s+=`<circle cx="-42.5" cy="${f(zz)}" r="1.8" fill="${p.screw}"${E(p.termEdge)}/><text x="-47.2" y="${f(zz+1.1)}" text-anchor="middle" font-family="${FD}" font-size="3" font-weight="800" fill="${p.line?p.ink:'#f1f1ee'}">${t}</text>`;
        s+=`<line x1="-65" y1="${f((k-2)*1.2)}" x2="-50" y2="${f(zz)}" stroke="${p.line?p.ink:wc[k]}" stroke-width="1.1" stroke-linecap="round"/>`;});
      s+=`<rect x="-77.8" y="${f(-D.RN)}" width="4.7" height="${f(2*D.RN)}" rx=".8" fill="${p.rubber}"${E(p.edge)}/><line x1="-77.8" y1="0" x2="-65" y2="0" stroke="${p.black}" stroke-width="6.5"/>`;
    } else
    D.CH.forEach((z,i)=>{const q=o.outputs[i];
      s+=`<rect x="-50" y="${f(z-5.25)}" width="10" height="10.5" rx=".6" fill="${p.term}"${E(p.termEdge)}/>`;
      ['+','D','−'].forEach((t,k)=>{const zz=z+(k-1)*3.5;
        s+=`<circle cx="-42.5" cy="${f(zz)}" r="1.2" fill="${p.screw}"${E(p.termEdge)}/><text x="-47.4" y="${f(zz+1)}" text-anchor="middle" font-family="${FD}" font-size="2.8" font-weight="800" fill="${p.line?p.ink:'#f1f1ee'}">${t}</text>`;
        if(q){const wc=p.line?p.ink:['#c8302c','#f1f1ee','#8a8f96'][k];s+=`<line x1="-65" y1="${f(z+(k-1)*.9)}" x2="-50" y2="${f(zz)}" stroke="${wc}" stroke-width=".9" stroke-linecap="round"/>`;}});
      s+=`<rect x="-77.8" y="${f(z-D.DN)}" width="4.7" height="${f(2*D.DN)}" rx=".8" fill="${p.rubber}"${E(p.edge)}/>`;
      if(q)s+=`<line x1="-77.8" y1="${f(z)}" x2="-65" y2="${f(z)}" stroke="${p.cable}" stroke-width="5.5"/>`;
      s+=`<text x="-55" y="${f(z+1.2)}" text-anchor="middle" font-family="${FD}" font-size="3" font-weight="800" fill="${p.line?p.ink:'#f1f1ee'}">${i+1}</text>`;});
    s+=`<rect x="40" y="${f(D.PZ-7.62)}" width="10" height="15.24" rx=".6" fill="${p.term}"${E(p.termEdge)}/>`;
    [-1,1].forEach(k=>{const zz=D.PZ+k*3.81;s+=`<circle cx="43" cy="${f(zz)}" r="1.8" fill="${p.screw}"${E(p.termEdge)}/><text x="52.6" y="${f(zz+1.4)}" text-anchor="middle" font-family="${FD}" font-size="4" font-weight="800" fill="${p.line?p.ink:'#f1f1ee'}">${k<0?'+':'−'}</text>`;});
    s+=`<rect x="73.1" y="${f(D.PZ-D.PN)}" width="4.7" height="${f(2*D.PN)}" rx=".8" fill="${p.rubber}"${E(p.edge)}/>`;
    s+=`<rect x="42.55" y="${f(D.FZ-1.8)}" width="10.9" height="3.6" rx=".5" fill="${p.fuse}"${E(p.line?p.ink:'#b48d17')}/><text x="48" y="${f(D.FZ+6)}" text-anchor="middle" font-family="${FM}" font-size="2" fill="${p.line?p.ink:'#f1f1ee'}">20 A</text>`;
    s+=`<rect x="45" y="${f(D.RZ-3)}" width="6" height="6" rx=".6" fill="${p.term}"${E(p.termEdge)}/><circle cx="48" cy="${D.RZ}" r="1.6" fill="${p.reset}"${E(p.line?p.ink:'#8e241c')}/>`+
       `<text x="53" y="${f(D.RZ+.8)}" font-family="${FM}" font-size="2" fill="${p.line?p.ink:'#f1f1ee'}">RESET</text>`;
  }
  // behuizing
  let h='';
  if(o.caps)for(const dir of [-1,1]){const x=dir<0?-D.XE:D.XB+D.GAP;
    h+=`<rect x="${x}" y="-30.5" width="${D.XE-D.XB-D.GAP}" height="61" rx="1.6" fill="${p.capFront}"${E(p.edge)}/>`+
       `<rect x="${x}" y="-26" width="${D.XE-D.XB-D.GAP}" height="52" fill="${p.capTop}"${p.line?E(p.edge):''}/>`;
    for(const side of [-1,1])for(const xo of [-2.6,0,2.6])h+=`<rect x="${f(dir*(D.XB+D.GAP+D.XE)/2+xo-.45)}" y="${side<0?-31:30.5}" width=".9" height=".5" fill="${p.capFront}"${E(p.edge)}/>`;}
  h+=`<rect x="${-D.XB}" y="-30" width="${2*D.XB}" height="60" rx="1" fill="${p.front}"${E(p.edge)}/><rect x="${-D.XB+1.2}" y="-25" width="${2*D.XB-2.4}" height="50" rx="1.2" fill="${p.top}"${p.line?E(p.edge):''}/>`;
  if(o.caps)h+=printCaps(p,o);
  h+=printTop(p,o,id);
  // rubber waar de kabels onder het kapje verdwijnen
  if(o.caps){if(o.type==='rgbw')h+=`<rect x="${-D.XE-1}" y="${f(-D.RN)}" width="1" height="${f(2*D.RN)}" rx=".4" fill="${p.rubber}"${E(p.edge)}/>`;
    else o.outputs.forEach((q,i)=>{const z=D.CH[i];h+=`<rect x="${-D.XE-1}" y="${f(z-D.DN)}" width="1" height="${f(2*D.DN)}" rx=".4" fill="${p.rubber}"${E(p.edge)}/>`;});
    if(o.power)h+=`<rect x="${D.XE}" y="${f(D.PZ-D.PN)}" width="1" height="${f(2*D.PN)}" rx=".4" fill="${p.rubber}"${E(p.edge)}/>`;}
  const g=glow?`<g filter="url(#${id}-glow)">${glow}</g>`:'';
  return {body:g+s+h,B,anchors};
}

// ---------- 3/4-aanzicht ----------
const PX=(x,y,z)=>.95*x+.42*z, PY=(x,y,z)=>-.22*x+.36*z-.95*y;
function perspView(o,p,id){
  const B={x0:1e9,x1:-1e9,y0:1e9,y1:-1e9},grow=(X,Y,pad=0)=>{B.x0=Math.min(B.x0,X-pad);B.x1=Math.max(B.x1,X+pad);B.y0=Math.min(B.y0,Y-pad);B.y1=Math.max(B.y1,Y+pad);};
  const pt=(x,y,z,pad)=>{const X=PX(x,y,z),Y=PY(x,y,z);grow(X,Y,pad);return f(X)+' '+f(Y);};
  const poly=(pts,fill,extra='')=>`<path d="M${pts.map(q=>pt(...q)).join('L')}Z" fill="${fill}"${extra}/>`;
  const ew=p.line?1.1:.7,E=c=>strokeAttr(c,ew);
  const M=(a,b,c,d,e,g)=>`matrix(${[a,b,c,d,e,g].map(f).join(' ')})`;
  const topM=y=>M(.95,-.22,.42,.36,0,-.95*y);              // vlak y = const, lokaal (x, z)
  const frontM=z=>M(.95,-.22,0,.95,.42*z,.36*z);           // vlak z = const, lokaal (x, -y)
  const endM=x=>M(.42,.36,0,.95,.95*x,-.22*x);             // vlak x = const, lokaal (z, -y)
  let s='',glow='';const anchors=[];
  // schaduw
  if(o.shadow&&!p.line)s+=`<g filter="url(#${id}-shadow)" opacity="${p.shadowA}">`+poly([[-D.XE-1,0,-31],[D.XE+1,0,-31],[D.XE+1,0,33],[-D.XE-1,0,33]],p.shadow)+`</g>`;
  const cable3=(x0,x1,y,z,d,col,on)=>{const a=pt(x0,y,z,d),b=pt(x1,y,z,d);
    if(on)glow+=`<path d="M${a}L${b}" stroke="${col}" stroke-width="${f(d+6)}" stroke-linecap="round" opacity=".6"/>`;
    return `<path d="M${a}L${b}" stroke="${p.cableEdge}" stroke-width="${f(d+.5)}" stroke-linecap="round" fill="none"/><path d="M${a}L${b}" stroke="${p.cable}" stroke-width="${f(d-.5)}" stroke-linecap="round" fill="none"/>`;};
  // 1. stroomkabel (achter het rechterkapje)
  if(o.power)s+=cable3(D.XE-2,D.XE+o.powerCable,D.PCY,D.PZ,7,null,false);
  // 2. kapje rechts, 3. middenstuk, 4. kapje links
  const block=(x0,x1,h,zb,r,cols,front)=>{     // voorkant + afgeronde rand + bovenkant
    const zf=zb,y1=h-r,ys=[y1,h-r*.29,h],zs=[zf,zf-r*.29,zf-r];let t='';
    t+=poly([[x0,0,zf],[x1,0,zf],[x1,y1,zf],[x0,y1,zf]],cols.front,E(p.edge));
    if(front)t+=front;
    t+=poly([[x0,ys[0],zs[0]],[x1,ys[0],zs[0]],[x1,ys[1],zs[1]],[x0,ys[1],zs[1]]],cols.bevel,p.line?'':E(p.edge));
    t+=poly([[x0,ys[1],zs[1]],[x1,ys[1],zs[1]],[x1,ys[2],zs[2]],[x0,ys[2],zs[2]]],cols.bevel,p.line?'':E(p.edge));
    t+=poly([[x0,h,-zb+r],[x1,h,-zb+r],[x1,h,zs[2]],[x0,h,zs[2]]],cols.top,E(p.edge));
    t+=poly([[x0,h,-zb+r],[x1,h,-zb+r],[x1,h-r*.3,-zb],[x0,h-r*.3,-zb]],cols.bevel,p.line?'':E(p.edge));
    return t;};
  const capCols={front:p.capFront,bevel:p.capBevel,top:p.capTop};
  const grips=dir=>{let t='';for(const xo of [-2.6,0,2.6]){const x=dir*(D.XB+D.GAP+D.XE)/2+xo;t+=poly([[x-.45,8.5,30.75],[x+.45,8.5,30.75],[x+.45,16.5,30.75],[x-.45,16.5,30.75]],p.capBevel,E(p.edge));}return t;};
  s+=block(D.XB+D.GAP,D.XE,HC,30.5,4.5,capCols,grips(1));
  s+=`<g transform="${topM(HC)}">`+`<text transform="translate(59 0) rotate(-90)" text-anchor="middle" y="1" font-family="${FD}" font-size="2.8" font-weight="800" letter-spacing=".2" fill="${p.print}">24 V DC IN</text></g>`;
  // middenstuk met sleuven en opdruk
  let vents='';for(let x=-(D.XB-8.5);x<=D.XB-8.49;x+=4.5)vents+=`<rect x="${f(x-.8)}" y="-8" width="1.6" height="4" rx=".4"/><rect x="${f(x-.8)}" y="-19" width="1.6" height="4" rx=".4"/>`;
  const fr=`<g transform="${frontM(30)}"><g fill="${p.line?'none':p.hole}"${p.line?E(p.ink):''}>${vents}</g>`+
    `<text x="-35" y="-10.6" font-family="${FM}" font-size="2" font-weight="500" fill="${p.print}">${o.type==='rgbw'?'◂ RGBW OUT':'◂ SPI OUT 1–4'}</text>`+
    `<text x="35" y="-10.6" text-anchor="end" font-family="${FM}" font-size="2" font-weight="500" fill="${p.print}">24 V DC IN ▸</text></g>`;
  s+=block(-D.XB,D.XB,D.H,30,5,{front:p.front,bevel:p.bevel,top:p.top},fr);
  s+=`<g transform="${topM(D.H)}">${printTop(p,o,id)}</g>`;
  // kapje links: voorkant, rand, bovenkant, kopse kant met U-sleuven
  s+=block(-D.XE,-D.XB-D.GAP,HC,30.5,4.5,capCols,grips(-1));
  s+=`<g transform="${topM(HC)}">`+(o.type==='rgbw'?`<text transform="translate(-59 0) rotate(-90)" text-anchor="middle" y="1.2" font-family="${FD}" font-size="3.4" font-weight="800" letter-spacing=".5" fill="${p.print}">RGBW OUT</text>`:
     D.CH.map((z,i)=>`<text x="-71.5" y="${f(z+1.3)}" text-anchor="middle" font-family="${FD}" font-size="3.6" font-weight="800" fill="${p.print}">${i+1}</text>`).join('')+
     `<text transform="translate(-62.5 0) rotate(-90)" text-anchor="middle" y="1" font-family="${FD}" font-size="2.8" font-weight="800" letter-spacing=".4" fill="${p.print}">DATA</text>`)+`</g>`;
  {const r=4.5,w=30.5;let d=`M${-w} 0`;
    const NS=o.type==='rgbw'?[[0,D.RCY,D.RN]]:D.CH.map(z=>[z,D.DCY,D.DN]);
    for(const [z,cy,rn] of NS){d+=`L${f(z-rn)} 0L${f(z-rn)} ${f(-cy)}A${rn} ${rn} 0 0 1 ${f(z+rn)} ${f(-cy)}L${f(z+rn)} 0`;}
    d+=`L${w} 0L${w} ${f(-(HC-r))}A${r} ${r} 0 0 0 ${f(w-r)} ${f(-HC)}L${f(-w+r)} ${f(-HC)}A${r} ${r} 0 0 0 ${-w} ${f(-(HC-r))}Z`;
    let e=`<path d="${d}" fill="${p.capEnd}"${E(p.edge)}/>`;
    if(o.type==='rgbw'){const rn=D.RN,cy=D.RCY;
      e+=`<path d="M${f(-rn)} 0L${f(-rn)} ${f(-cy)}A${rn} ${rn} 0 0 1 ${f(rn)} ${f(-cy)}L${f(rn)} 0Z" fill="${p.line?p.bg:p.hole}"${p.line?E(p.ink):''}/>`+
         `<circle cx="0" cy="${f(-cy)}" r="${f(rn-.15)}" fill="${p.rubber}"${E(p.edge)}/>`+
         `<text x="0" y="${f(-cy-rn-2.2)}" text-anchor="middle" font-family="${FD}" font-size="3.4" font-weight="800" fill="${p.print}">RGBW</text>`;}
    else D.CH.forEach((z,i)=>{const q=o.outputs[i];
      e+=`<path d="M${f(z-D.DN)} 0L${f(z-D.DN)} ${f(-D.DCY)}A${D.DN} ${D.DN} 0 0 1 ${f(z+D.DN)} ${f(-D.DCY)}L${f(z+D.DN)} 0Z" fill="${p.line?p.bg:p.hole}"${p.line?E(p.ink):''}/>`;
      e+=`<circle cx="${f(z)}" cy="${f(-D.DCY)}" r="${f(D.DN-.15)}" fill="${p.rubber}"${E(p.edge)}/>`;
      if(!q)e+=`<path d="M${f(z-1.6)} ${f(-D.DCY)}H${f(z+1.6)}" fill="none"${E(p.line?p.ink:'#55595f')}/>`;   // leeg: dichte rubberen dop
      e+=`<text x="${f(z)}" y="${f(-D.DCY-D.DN-2.2)}" text-anchor="middle" font-family="${FD}" font-size="3.4" font-weight="800" fill="${p.print}">${i+1}</text>`;});
    e+=`<text x="0" y="-20.4" text-anchor="middle" font-family="${FM}" font-size="1.7" font-weight="500" fill="${p.print}" xml:space="preserve">${o.type==='rgbw'?'RGBW OUT   R · G · B · W · V+':'SPI OUT   V+ · DATA · GND'}</text>`;
    for(const z of [-30.5,30.5])grow(PX(-D.XE,0,z),PY(-D.XE,0,z));
    s+=`<g transform="${endM(-D.XE)}">${e}</g>`;}
  // 5. datakabels (van achter naar voor), met ledline-stukje
  const stub3=(xe,y,z,q,a)=>{
    if(q.empty){s+=`<path d="M${pt(xe,y,z,3.6)}L${pt(xe-12,y,z,3.6)}" stroke="${p.connEdge}" stroke-width="7.7" fill="none"/><path d="M${pt(xe,y,z)}L${pt(xe-12,y,z)}" stroke="${p.conn}" stroke-width="6.7" fill="none"/>`;return;}
    if(o.ledline){const xc=xe-12,xl=xc-o.ledline,t=1.3,hw=5;
      const cyl=(x0,x1,rad,fill)=>`<path d="M${pt(x0,y,z,rad)}L${pt(x1,y,z,rad)}" stroke="${p.connEdge}" stroke-width="${f(2*rad+.5)}" fill="none"/><path d="M${pt(x0,y,z)}L${pt(x1,y,z)}" stroke="${fill}" stroke-width="${f(2*rad-.5)}" fill="none"/>`;
      const sl=[[xl,y+t,z-hw],[xc,y+t,z-hw],[xc,y+t,z+hw],[xl,y+t,z+hw]],sf=[[xl,y-t,z+hw],[xc,y-t,z+hw],[xc,y+t,z+hw],[xl,y+t,z+hw]];
      if(q.on)glow+=poly([[xl-3,y,z-hw-3],[xc+2,y,z-hw-3],[xc+2,y,z+hw+3],[xl-3,y,z+hw+3]],q.color,' opacity=".75"');
      const on=q.on,edge=on&&!p.line?q.color:p.sleeveEdge;
      s+=poly(sl,on?q.color:p.sleeve,E(edge))+poly(sf,on?q.color:p.sleeveSide,E(edge));
      if(on&&!p.line)s+=poly([[xl+1,y+t,z-1.8],[xc-1,y+t,z-1.8],[xc-1,y+t,z+.4],[xl+1,y+t,z+.4]],'#ffffff',' opacity=".55"');
      s+=cyl(xc+12,xc,3.6,p.conn)+cyl(xc+8,xc+4.4,4.3,p.conn);
      a.end={x:PX(xl,y,z),y:PY(xl,y,z)};}
    else a.end={x:a.x,y:a.y};
    anchors.push(a);};
  if(o.type==='rgbw'){
    const y=D.RCY,xs=-D.XE-o.cable,xsp=xs-SPLIT_LEN,xf=xsp-20,xe=xf-o.lead;
    const tube=(pts,w,c1,c2)=>`<path d="M${pts.map(q=>pt(q[0],y,q[1],w/2)).join('L')}" stroke="${c1}" stroke-width="${f(w+.5)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`+
                              `<path d="M${pts.map(q=>pt(q[0],y,q[1])).join('L')}" stroke="${c2}" stroke-width="${f(w-.5)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    s+=tube([[-D.XE+.4,0],[xs,0]],7.5,p.blackEdge,p.black);
    {let x=xs;for(const [len,dia,kind] of SPLIT){const x1=x-len;s+=tube([[x-.01,0],[x1+.01,0]],dia,p.blackEdge,p.black);
      if(kind==='t'&&len>4)for(let k=1;k<6;k++)s+=`<path d="M${pt(x-k*len/6,y,0,0)}L${pt(x-k*len/6,y,0,0)}" stroke="${p.blackEdge}" stroke-width="${f(dia)}" stroke-linecap="butt" fill="none" opacity="0"/>`;
      x=x1;}}   // splitter
    [0,1,2,3].forEach(i=>{const q=o.outputs[i]||{color:null,on:false,empty:true},z=D.CH[i],z0=(i-1.5)*1.7,
      pts=bez([xsp+1,z0],[xsp-8,z0*1.3],[xf+9,z],[xf,z]).concat([[xe,z]]);
      if(q.on&&!o.ledline)glow+=`<path d="M${pts.map(r=>pt(r[0],y,r[1])).join('L')}" stroke="${q.color}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".6"/>`;
      s+=tube(pts,3.8,p.cableEdge,p.cable);
      stub3(xe,y,z,q,{port:i+1,x:PX(xe,y,z),y:PY(xe,y,z),color:q.color,on:q.on});});
  } else
  o.outputs.forEach((q,i)=>{if(!q)return;const z=D.CH[i],y=D.DCY,xe=-D.XE-o.cable;
    s+=cable3(-D.XE+.4,xe,y,z,6,q.color,q.on&&!o.ledline);
    stub3(xe,y,z,q,{port:i+1,x:PX(xe,y,z),y:PY(xe,y,z),color:q.color,on:q.on});});
  const g=glow?`<g filter="url(#${id}-glow)">${glow}</g>`:'';
  // gloed onder alles behalve de schaduw
  return {body:g+s,B,anchors};
}

function build(opts){
  const o=norm(opts),p=palette(o),id=o.id||('alvr'+(++uid)+(typeof document!=='undefined'?Math.random().toString(36).slice(2,6):''));
  const r=o.view==='top'?topView(o,p,id):perspView(o,p,id);
  const pad=3,x=r.B.x0-pad,y=r.B.y0-pad,w=r.B.x1-r.B.x0+2*pad,h=r.B.y1-r.B.y0+2*pad;
  const W=o.width||w*o.scale,H=W*h/w;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x)} ${f(y)} ${f(w)} ${f(h)}" width="${f(W)}" height="${f(H)}" role="img" aria-label="${esc(o.title)}">`+
    `<title>${esc(o.title)}</title>${defs(id,p)}${r.body}</svg>`;
  return {svg,anchors:r.anchors,viewBox:{x,y,w,h},width:W,height:H,options:o};
}
const API={
  version:'0.6',COLORS,ORDER,DIMENSIONS:D,
  svg:o=>build(o).svg,
  build,
  anchors:o=>build(o).anchors,
  mount(el,o){const r=build(o);el.innerHTML=r.svg;return r.anchors;}
};
root.AluvisionReceiverArt=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
