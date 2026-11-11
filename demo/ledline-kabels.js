/* Aluvision tutorials: de kabels zoals op de stand (C146p, 11 nov). Kopie van prototypes/ledlines-instellen/kabels.js.
 * - Elke uitgang van een SPI-receiver heeft een vaste kabel. Ze zijn allemaal even lang en hebben een witte
 *   schroefconnector. Bij RGBW gaat er één zwarte kabel naar de witte splitter, met 4 even lange kabeltjes.
 * - Elke ledline heeft zijn eigen vaste kabeltje met een connector; die zijn ook allemaal even lang.
 * - Daartussen zit een verlengkabel met een connector aan elke kant. Die lengte verschilt, al naar gelang de afstand.
 * Niets ligt kaarsrecht. Een kabel loopt eerst rechtdoor en buigt dan zacht af; even lange kabeltjes die uitwaaieren,
 * eindigen daardoor elk op een andere plaats. De connectors liggen in het verlengde van hun kabel.
 * Connectors: wit en rond (trekontlasting, huls, rode O-ring, gekartelde wartel), zoals op de foto's van de echte
 * connectors, uit dezelfde ki-*-delen als ketting.css (liggend: kb-hz). Kabels: SVG-paden met een rand (kb-e), het wit (kb-c) en een
 * glans (kb-h). De RGBW-splitter wordt hier getekend (splitter). Alles in wereld-px.
 */
(function(){
'use strict';
// [klasse, halve breedte, plaats langs de connector, lengte, afronding]; de plaats loopt van 19 (kant van de
// ledline of de verlengkabel: de huls met schroefdraad) tot 53 (de mannelijke kant met de wartel)
const PLUG=[['ki-rib',3.2,19,5.5,1],['ki-cyl',4,24.5,7,1.5],['ki-oring',4.3,31.5,1.6,.8],['ki-nut',5.5,33,9,2],['ki-cyl',4,42,6,1.5],['ki-rib',3.2,48,5,1]];
// een los kabeleinde: alleen de mannelijke kant (pin met rode O-ring, wartel, huls, trekontlasting)
const MALE=[['ki-cyl',2.8,25.6,6.2,1.2],['ki-oring',3.3,30.2,1.5,.7],['ki-nut',5.5,33,9,2],['ki-cyl',4,42,6,1.5],['ki-rib',3.2,48,5,1]];
// wat er bijkomt als een verlengkabel op een los kabeleinde klikt
const FEMALE=PLUG.filter(q=>q[2]<33);
const CL=34;   // lengte van een connector
const f=v=>(+v).toFixed(1),f3=v=>(+v).toFixed(3),box=(x,y,w,h)=>`left:${f(x)}px;top:${f(y)}px;width:${f(w)}px;height:${f(h)}px`;
// ---------- meetkunde: punten {x, y}, richtingen als eenheidsvector, hoeken in graden (+ = met de klok mee op het scherm)
const V=(x,y)=>({x,y}),add=(a,b,k)=>V(a.x+b.x*(k===undefined?1:k),a.y+b.y*(k===undefined?1:k)),sub=(a,b)=>V(a.x-b.x,a.y-b.y);
const dot=(a,b)=>a.x*b.x+a.y*b.y,rot=(d,deg)=>{const r=deg*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return V(d.x*c-d.y*s,d.x*s+d.y*c);};
const dirOf=deg=>V(Math.cos(deg*Math.PI/180),Math.sin(deg*Math.PI/180)),angOf=d=>Math.atan2(d.y,d.x)*180/Math.PI,P=p=>`${f(p.x)} ${f(p.y)}`;
// een kabel vanaf p in richting d: l1 rechtdoor, dan een boog van l2 die phi graden afbuigt. Lengte altijd l1 + l2.
function bend(p,d,l1,l2,phi){const m=add(p,d,l1);
  if(Math.abs(phi)<.05){const e=add(m,d,l2);return {d:`M${P(p)}L${P(e)}`,rev:`M${P(e)}L${P(p)}`,end:e,dir:d};}
  const sg=Math.sign(phi),r=l2/(Math.abs(phi)*Math.PI/180),n=rot(d,90*sg),c=add(m,n,r),e=add(c,rot(n,phi),-r);
  return {d:`M${P(p)}L${P(m)}A${f(r)} ${f(r)} 0 0 ${sg>0?1:0} ${P(e)}`,rev:`M${P(e)}A${f(r)} ${f(r)} 0 0 ${sg>0?0:1} ${P(m)}L${P(p)}`,end:e,dir:rot(d,phi)};}
// verlengkabel: vertrekt in a in richting da, komt aan in b in richting db (de richting waarin hij b binnenloopt)
function link(a,da,b,db){const v=sub(b,a),k1=Math.min(210,Math.max(10,Math.abs(dot(v,da))*.58)),k2=Math.min(210,Math.max(10,Math.abs(dot(v,db))*.62));
  const c1=add(a,da,k1),c2=add(b,db,-k2);return {d:`M${P(a)}C${P(c1)} ${P(c2)} ${P(b)}`,rev:`M${P(b)}C${P(c2)} ${P(c1)} ${P(a)}`};}
// ---------- tekenen
// een kabel als buis: rand, wit, glans; cls = extra klasse (thin, blk), attrs = extra attributen (op de drie paden)
function tube(d,cls,attrs){cls=cls?' '+cls:'';attrs=attrs||'';return ['e','c','h'].map(k=>`<path class="kb-${k}${cls}" d="${d}"${attrs}/>`).join('');}
// staand: de verlengkabel of de ledline boven, de vaste kabel onder; de bovenkant op y0 (met MALE: een los kabeleinde
// dat van onder komt, de pin naar boven)
function plugV(cx,y0,k,list){k=k||1;return (list||PLUG).map(([c,hw,s,l,r])=>`<i class="${c}" style="${box(cx-hw*k,y0+(s-19)*k,2*hw*k,l*k)};border-radius:${f(r*k)}px"></i>`).join('');}
// liggend: de verlengkabel links, de vaste kabel rechts; de linkerkant op xL
function plugH(xL,cy,k,list){k=k||1;return (list||PLUG).map(([c,hw,s,l,r])=>`<i class="${c} kb-hz" style="${box(xL+(s-19)*k,cy-hw*k,l*k,2*hw*k)};border-radius:${f(r*k)}px"></i>`).join('');}
// een connector op het einde e van een vaste kabel die in richting d loopt: de kabelkant op e, de punt in richting d.
// Geeft de html en de punt (waar de verlengkabel begint). k = schaal.
function plugAt(e,d,list,k,attrs){k=k||1;const a=angOf(d)-180;
  return {html:`<div class="kb-rot"${attrs||''} style="left:${f(e.x)}px;top:${f(e.y)}px;transform:rotate(${a.toFixed(2)}deg)">${plugH(-CL*k,0,k,list)}</div>`,tip:add(e,d,CL*k)};}
// ---------- de witte, gegoten RGBW-splitter, zoals in de Aluvision-video "Constru RGBW LED line": de zwarte kabel gaat
// in een witte kraag (4 mm), dan een hals (8 mm) en een platte waaier (26 mm, 14,6 mm breed) waar de 4 kabeltjes strak
// naast elkaar uitkomen. In mm: x = 0 waar de zwarte kabel binnenkomt, de splitter loopt naar -x; z dwars.
const SPLIT={LEN:38,PITCH:3.3};
const bez=(p0,p1,p2,p3,n)=>Array.from({length:n+1},(_,i)=>{const t=i/n,u=1-t;return [u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0],u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]];});
function splitOutline(){const b=-4,c=-12,d=-SPLIT.LEN,up=bez([c,-3.6],[c-10,-3.7],[d+9,-7.3],[d+2.4,-7.3],12);
  return [[b+.3,-3.95],[c+2,-3.65],...up,[d+.6,-6.8],[d,-5.4],[d,5.4],[d+.6,6.8],...up.slice().reverse().map(([x,z])=>[x,-z]),[c+2,3.65],[b+.3,3.95]];}
let sid=0;
function splitBody(){const id='kbsp'+(++sid),b=-4,c=-12,d=-SPLIT.LEN,E=' stroke="#7d838a" stroke-width=".7" vector-effect="non-scaling-stroke" stroke-linejoin="round"';
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#f4f4f1"/><stop offset="1" stop-color="#cdd1d5"/></linearGradient></defs>`+
    `<path d="M${splitOutline().map(r=>r[0].toFixed(2)+' '+r[1].toFixed(2)).join('L')}Z" fill="url(#${id})"${E}/>`+
    `<rect x="${b}" y="-4.6" width="4" height="9.2" rx="1.2" fill="url(#${id})"${E}/><path d="M${b+2} -4.6V4.6" fill="none"${E}/>`+
    `<path d="M${c-1} -2.1C${c-11} -2.2 ${d+9} -5.1 ${d+2.8} -5.3" fill="none" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity=".9"/>`+
    `<path d="M${d+.9} -4.6V4.6" fill="none" stroke="#c4c8cc" stroke-width=".5" opacity=".8"/>`;}
// de splitter in de stand: de zwarte kabel komt binnen in p, as d (naar de kabeltjes toe), k px per mm. Geeft de svg
// (in een eigen laag tekenen: de kabelstijl mag hem niet raken) en de 4 plaatsen waar de kabeltjes uitkomen (0 = rechts
// van de as, gezien in de richting d; bij een splitter naar links is dat boven).
function splitter(p,d,k){const n=rot(d,-90),M=`matrix(${f3(-k*d.x)} ${f3(-k*d.y)} ${f3(k*n.x)} ${f3(k*n.y)} ${f(p.x)} ${f(p.y)})`,face=add(p,d,SPLIT.LEN*k);
  return {svg:`<g class="kb-split" transform="${M}">${splitBody()}</g>`,exits:[0,1,2,3].map(i=>add(face,n,(i-1.5)*SPLIT.PITCH*k)),dir:d,face};}
// 4 even lange kabeltjes uit de punten pts, allemaal eerst in richting d; ze waaieren zacht uit: kabeltje i buigt
// fan*(1.5-i)/3 graden af (0 buigt het meest met de klok mee). Elk 28 % rechtdoor, dan de boog.
function fan4(pts,d,len,fan){return pts.map((p,i)=>bend(p,d,len*.28,len*.72,fan*(1.5-i)/3));}
window.AlvKabels={PLUG,MALE,FEMALE,CL,V,add,sub,rot,dirOf,angOf,bend,link,tube,plugV,plugH,plugAt,splitter,fan4};
})();
