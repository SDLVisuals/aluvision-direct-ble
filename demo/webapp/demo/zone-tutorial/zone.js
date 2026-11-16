/* C147p prototype (versie 2): de zonepagina, een facelift in de stijl van de app.
 * Gebouwd op de echte onderdelen van de app: het voorbeeld (preview.js, dezelfde pixels, wand en tunnel), de
 * animatiebibliotheek (dezelfde animaties en namen, zonder merkanimaties), het kleurwiel (colour.js), de schuifjes,
 * Fijn instellen en de schakelaars. Nieuw is de indeling (afspraak 11 november "SPI-zonepagina eenvoudiger"):
 * - bovenaan altijd het live voorbeeld van de echte ledlines van de zone, in hun volgorde en weergave;
 * - twee tabs: Kleur · Animaties. 1 kleur = vaste kleur, + maakt er een verloop van;
 * - Kleur: kleurwiel, helderheid, Fijn instellen direct eronder, Laten bewegen (verloop), bewaarde kleuren als
 *   bolletjes (lang indrukken = wijzigen), warmwit en richting achter Meer;
 * - Animaties: bewegende tegels in jouw kleuren, daarna Samen · Apart, snelheid en helderheid; Alle animaties;
 * - Apart: tik een ledline (of receiver) aan en geef ze een eigen kleur of animatie;
 * - tandwiel = "Ledlines in deze zone": looprichting, licht, weergave, receivers;
 * - RGBW: één kleur per receiver, geen verloop of pixelanimaties, 1 receiver = 1 ledline, onder elkaar.
 * Geen echte receivers: alles blijft in dit prototype (sessionStorage).
 */
(function(){
'use strict';
const P=window.LightningPreview,Lib=window.LightningAnimationLibrary,C=window.LightningColour,G=window.LightningStaticGradient,V=window.LightningV50AnimationTexts,RA=window.AluvisionReceiverArt;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const tr=(key,params)=>V?V.t(key,'nl',params):key;
const copy=v=>JSON.parse(JSON.stringify(v));
// ---------- iconen (dezelfde lijnen als de app) ----------
const path=d=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const IC={unlink:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 15.5 8 17a3.5 3.5 0 0 1-5-5l1.5-1.5M14.5 8.5 16 7a3.5 3.5 0 0 1 5 5l-1.5 1.5M8 3.5v2.5M3.5 8H6M16 20.5V18M20.5 16H18"/></svg>',selectAll:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 4.5h10a2 2 0 0 1 2 2v10"/><rect x="4.5" y="7.5" width="12" height="12" rx="2.6"/><path d="m7.6 13.6 2.2 2.2 4.1-4.6"/></svg>',link:path('M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1'),back:path('m14 6-6 6 6 6M8 12h13'),chev:path('m9 5 7 7-7 7'),close:path('m6 6 12 12M6 18 18 6'),expand:path('M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5'),
  sun:path('M12 2v2M12 20v2M2 12h2M20 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0'),anim:path('M3 9v6M7 5v14M12 2v20M17 6v12M21 9v6'),
  plus:path('M12 5v14M5 12h14'),check:path('m5 12 4 4L19 6'),search:path('M11 4.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13ZM16 16l4.5 4.5'),
  star:path('m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8-4.3-4.1 5.9-.8z'),play:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>',
  stop:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2.2"/></svg>',
  gear:'<svg class="icon icon-gear" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.61 9.53L21.85 10.26L21.85 13.74L19.61 14.47L19.13 15.63L20.19 17.74L17.74 20.19L15.63 19.13L14.47 19.61L13.74 21.85L10.26 21.85L9.53 19.61L8.37 19.13L6.26 20.19L3.81 17.74L4.87 15.63L4.39 14.47L2.15 13.74L2.15 10.26L4.39 9.53L4.87 8.37L3.81 6.26L6.26 3.81L8.37 4.87L9.53 4.39L10.26 2.15L13.74 2.15L14.47 4.39L15.63 4.87L17.74 3.81L20.19 6.26L19.13 8.37Z"/><circle cx="12" cy="12" r="3.2"/></svg>',
  // Looprichting: het icoon van de app (receivers-tab.js, orderIcon): drie blokjes waarvan de kleur doorloopt
  direction:`<svg class="zf-oic" viewBox="0 0 48 24" aria-hidden="true"><defs><linearGradient id="zf-oic-g" x1="0" x2="48" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2F6BFF"/><stop offset=".26" stop-color="#2F6BFF"/><stop offset=".4" stop-color="#FFC61A"/><stop offset=".6" stop-color="#FFC61A"/><stop offset=".74" stop-color="#9B4DFF"/><stop offset="1" stop-color="#9B4DFF"/></linearGradient></defs><g fill="url(#zf-oic-g)"><rect x="1" y="7" width="13.5" height="10" rx="2.4"/><rect x="17.25" y="7" width="13.5" height="10" rx="2.4"/><rect x="33.5" y="7" width="13.5" height="10" rx="2.4"/></g><rect class="zf-oic-run" x="-10" y="7" width="8" height="10" rx="2.4" fill="#fff" opacity=".55"/></svg>`,
  order:'<svg class="icon" viewBox="0 0 40 40" aria-hidden="true"><circle cx="7" cy="9" r="1.5"/><circle cx="7" cy="19" r="1.5"/><circle cx="7" cy="29" r="1.5"/><path d="M12 9h13M12 19h13M12 29h13M32 15V5m0 0-3 3m3-3 3 3M32 25v10m0 0-3-3m3 3 3-3"/></svg>',
  tunnel:path('M4 21V10a8 8 0 0 1 16 0v11M8 21V10a4 4 0 0 1 8 0v11'),receiver:path('M5.5 11h13a2.5 2.5 0 0 1 2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-3A2.5 2.5 0 0 1 5.5 11ZM7 15h.01M11 15h1.5M15 15h2M9.5 7.6a3.6 3.6 0 0 1 5 0M7.2 5.2a6.9 6.9 0 0 1 9.6 0'),
  together:'<svg class="icon icon-together" viewBox="0 0 40 32" aria-hidden="true" focusable="false"><path class="together-link" d="M5 5.5H2v18h3M2 14.5h3"/><rect class="together-line" x="7" y="3" width="21" height="5" rx="2.5"/><rect class="together-line" x="7" y="12" width="21" height="5" rx="2.5"/><rect class="together-line" x="7" y="21" width="21" height="5" rx="2.5"/><path class="together-check" d="m30 24 3 3 5-7"/></svg>',
  reverse:path('M4 8h14l-3.5-3.5M20 16H6l3.5 3.5'),loop:path('M17 2.5 20.5 6 17 9.5M3.5 11V9a3 3 0 0 1 3-3h14M7 21.5 3.5 18 7 14.5M20.5 13v2a3 3 0 0 1-3 3h-14'),
  mirror:path('M12 4v16M9 8 5 12l4 4M15 8l4 4-4 4'),
  zones:path('M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'),light:path('M3 9h18v6H3zM6 11v2M10 11v2M14 11v2M18 11v2M1 12h2M21 12h2'),
  // de vier bewegingen van een verloop
  schuif:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h15m-4-4 4 4-4 4"/></svg>',golf:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c2.5-5 5-5 7.5 0s5 5 7.5 0 3.5-3 5-2"/></svg>',
  adem:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="8" opacity=".45"/></svg>',kop:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12h10" opacity=".45"/><circle cx="17" cy="12" r="3.5"/></svg>'};
// ---------- de animaties: dezelfde bibliotheek als de app, zonder merkanimaties ----------
const CATALOG={SPI:Lib.visibleCatalog(P.catalog('SPI')).filter(e=>e.category!=='brand'),RGBW:Lib.visibleCatalog(P.catalog('RGBW')).filter(e=>e.category!=='brand')};
// een SPI-zone kan ook een bij RGBW bewaarde animatie spelen (de eigenaar 13 nov); omgekeerd niet
const effect=(type,id)=>CATALOG[type].find(e=>e.id===id)||(type==='SPI'&&S?.savedFrom?.[id]==='RGBW'?CATALOG.RGBW.find(e=>e.id===id):null)||null;
// het woord "Tunnel" vooraan een naam valt weg: het staat al onder Looplicht en een tunnel is alleen de vorm van een stand
const noTunnel=x=>String(x).replace(/^Tunnel\s+(\S)/i,(_,c)=>c.toUpperCase());
const nameOf=e=>noTunnel(Lib.displayName(e,tr));
// de eigenaar 13 nov: "Tunnel & wand" heet Looplicht (in de lichtwereld: een chase): het licht loopt van ledline naar ledline.
// Tunnel en wand zijn geen soort animatie meer; een tunnel is alleen de vorm van een stand.
const GROUP={whole:'Kleur & sfeer',gradient:'Verloop',pixels:'Bewegend licht',tunnel:'Looplicht'};
const groupOf=e=>Object.hasOwn(GROUP,e.category)?e.category:'pixels';
const TYPE=z=>z.kind==='rgbw'?'RGBW':'SPI';
// bovenaan: een vaste keuze per soort zone, de laatst gebruikte (max. 2) vooraan
const TOP={SPI:['spi-chase-8','spi-wave-29','spi-line-flow-3','spi-breathe-99','v30-rgb-jumping','spi-sparkle-102'],RGBW:['rgbw-chase-8','rgbw-flow-3','rgbw-breathe-1','v30-rgb-jumping','rgbw-sparkle-4','v30-tunnel-travel']};   // de klassiekers eerst: chase, golf, overvloeien, ademen, kleurwissel, flits
const isTunnel=e=>e?.category==='tunnel';   // een looplicht (de categorie heet in de app nog 'tunnel')
const need=e=>Math.max(e?.minimumReceivers||1,isTunnel(e)?2:1);   // vanaf hoeveel ledlines (RGBW: receivers) het kan
const fits=(e,z)=>!!e&&z.lines.length>=need(e);
// het uitlegbeeldje van een looplicht: drie ledlines die na elkaar oplichten (geen uitleg in woorden nodig)
const LOOP='<i class="zf-loop" aria-hidden="true"><b></b><b></b><b></b></i>';
const loopSay=z=>`Het licht loopt van ${z.kind==='rgbw'?'receiver naar receiver':'ledline naar ledline'}.`;
// ---------- de stand (demo) ----------
const TUT=new URLSearchParams(location.search).get('tut')==='1';
const KEY=TUT?'alv-zone-c147p-tut':'alv-zone-c147p-v5';   // v5: de SPI-demozone heeft vijf gelijke ledlines (de eigenaar 13 nov)
const START={zones:[
    {id:'flex',name:'Flex spi',kind:'spi',on:true,view:'gewoon',mode:'samen',lines:[{px:48},{px:48},{px:48},{px:48},{px:48}],colours:['#2F6BFF'],whites:[0],pos:null,move:null,moveSpeed:40,flow:'right',soft:30,trail:40,anim:null,speed:50,bright:100,loop:false,dirRev:false,warm:false,warmth:50,per:{},rcv:['5CBC-0672','81A0-33F2'],ordered:true},
    {id:'tunnel',name:'Rgbw',kind:'rgbw',on:true,view:'stack',mode:'samen',lines:[{rcv:'7D10-55C8'},{rcv:'4E2B-9017'},{rcv:'C3F4-6A21'}],colours:['#9B4DFF'],whites:[0],pos:null,move:null,moveSpeed:40,flow:'right',soft:30,trail:40,anim:null,speed:50,bright:100,loop:false,dirRev:false,warm:false,warmth:50,per:{},ordered:true}],
  saved:[{name:'Rood',colours:['#FF2A1F']},{name:'Groen',colours:['#1FC45B']},{name:'Blauw',colours:['#2F6BFF']},{name:'Wit',colours:['#FFFFFF']},{name:'Zonsondergang',colours:['#FF5E3A','#FF9F1C','#7B2FF7']},{name:'Lagune',colours:['#00C2D1','#1F6FEB']}],
  savedAnims:[],savedFrom:{},recent:[]};
let S=TUT?copy(START):load();
function load(){try{const v=JSON.parse(sessionStorage.getItem(KEY));if(v&&v.zones){v.zones.forEach(z=>{if(z.view==='tunnel'||z.view==='wand')z.view='verticaal';delete z.tview;});return v;}}catch(_){}return copy(START);}
function save(){try{sessionStorage.setItem(KEY,JSON.stringify(S));}catch(_){}}
const zone=id=>S.zones.find(z=>z.id===id);
let curZ=null,tab='kleur',point=0,sel=[];   // open zone, tab, gekozen kleurpunt, gekozen ledlines (apart)
// ---------- wat je nu bewerkt: de gekozen ledlines (apart) of de hele zone ----------
const LIGHT=['colours','whites','pos','move','anim','params'];
function target(z){if(loose(z)&&sel.length){const k=sel[0];return z.per[k]||z;}return z;}
// wijzigen: alleen de gekozen ledlines; of alles (dan volgen ook de ledlines die al iets eigens hadden, zoals in de app)
function edit(z,fn){if(loose(z)&&sel.length){for(const k of sel){if(!z.per[k])z.per[k]=copy(Object.fromEntries(LIGHT.map(f=>[f,z[f]])));fn(z.per[k]);}}
  else{fn(z);if(loose(z))Object.values(z.per).forEach(fn);else z.per={};}save();}
const lineLight=(z,i)=>loose(z)&&z.per[i]?{...z,...z.per[i]}:z;
// de instellingen van een animatie (dezelfde als in de app); achtergrond apart
const PARAM_KEYS=['direction','bounce','mirror','widthPixels','objectCount','trailLength','spacing','smooth','spread','randomness','fadeAmount','width','lineDelayMs','delayMs'];
// ---------- het voorbeeld: de echte tekenaar van de app ----------
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
const rgbOf=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const MOVES=['schuif','golf','adem','kop'];
function stateFor(z,l,{forceAnim}={}){
  const cols=l.colours.length?l.colours:['#FFFFFF'],whites=cols.map((_,i)=>l.whites?.[i]||0),[r,g,b]=rgbOf(cols[0]);
  const base={...window.LightningModel.defaultState(),on:z.on!==false,power:z.on!==false,bri:z.bright,brightness:z.bright};
  const a=forceAnim!==undefined?forceAnim:(l.anim?effect(TYPE(z),l.anim):null);
  if(a){const st={...copy(a.state),category:a.category,v30Effect:a.state.v30Effect||null,previewFamily:a.state.previewFamily||null,legacySpi:a.state.legacySpi===true,bounce:a.state.bounce===true,mirror:a.state.mirror===true,on:z.on!==false,power:z.on!==false};
    if(a.controls.includes('smooth'))st.smooth=100;
    const max=a.colorCountRange?.max||1,pal=cols.slice(0,max);st.colors=pal;st.colorCount=pal.length;st.whiteChannels=pal.map((_,i)=>whites[i]);st.rgbEnabled=pal.map(()=>true);st.whiteEnabled=pal.map((_,i)=>whites[i]>0);
    st.r=r;st.g=g;st.b=b;st.w=whites[0];st.speed=Math.max(1,z.speed);st.bri=z.bright;st.brightness=z.bright;
    const pm=forceAnim!==undefined&&forceAnim?.id!==l.anim?{}:(l.params||{});for(const k of PARAM_KEYS)if(pm[k]!==undefined)st[k]=pm[k];
    if(pm.backgroundOn){st.backgroundOn=true;st.background=pm.background||'#FFFFFF';st.bgBrightness=pm.bgBrightness??12;st.backgroundRgbEnabled=true;}
    return st;}
  if(cols.length>1&&z.kind==='spi'){   // een verloop (eventueel bewegend): dezelfde recepten als de app
    const n=cols.length,at=posOf({colours:cols,pos:l.pos});let stops=cols.map((c,i)=>({position:at[i],color:c,white:whites[i]}));
    if(z.loop&&n<G.MAX_STOPS){stops=stops.map(s=>({...s,position:s.position*(n-1)/n}));stops.push({position:1,color:cols[0],white:whites[0]});}
    for(let i=1;i<stops.length;i++)if(stops[i].position<=stops[i-1].position)stops[i].position=Math.min(1,stops[i-1].position+.002);
    const st={...base,engine:'STATIC_GRADIENT',colors:[cols[0]],r,g,b,w:whites[0],staticGradientRecipe:hex(G.recipe(stops,{brightness:z.bright,reverse:!!z.dirRev}))};
    if(l.move){const flow=z.flow||'right';st.variant=210+MOVES.indexOf(l.move)+(flow==='left'?4:0);st.speed=z.moveSpeed??40;st.bounce=flow==='bounce';st.spread=z.soft??30;st.trailLength=z.trail??40;}
    return st;}
  return {...base,engine:'STATIC',colors:[cols[0]],r,g,b,w:whites[0],whiteChannels:[whites[0]],rgbEnabled:[true],whiteEnabled:[whites[0]>0]};}
function receiversOf(z,{lines=z.lines,sample}={}){
  return lines.map((ln,i)=>({id:`${z.id}-${i}`,name:`Ledline ${i+1}`,type:TYPE(z),outputs:z.kind==='spi'?[{port:1,enabled:true,pixels:ln.px||40,reversed:false}]:[],
    state:sample?sample(i):stateFor(z,lineLight(z,i))}));}
// de opties voor de tekenaar volgens weergave (horizontaal of verticaal) en licht (samen, apart).
// de eigenaar 13 nov: geen wand en geen tunnel meer; de klant kiest of zijn ledlines horizontaal of verticaal hangen.
// Verticaal tekent dezelfde gladde lijnen, rechtop naast elkaar (lijn-view.js); elke ledline is daar apart te kiezen.
const vertical=view=>view==='verticaal';
function drawOpts(z,{view=z.view,mode=z.mode,anim}={}){
  // losse ledlines; anders één doorlopende ledline, ook verticaal (de eigenaar 13 nov: "als je verticaal kiest en je ledline staat
  // als 1 ledline, moet hij ook 1 ledline tonen, maar verticaal")
  const up=vertical(view),los=z.kind==='rgbw'||mode==='apart'||isTunnel(anim);
  return {layout:los?'stacked':'continuous',...(up?{vertical:true}:{})};}
const live=new Map();let raf=0,t0=performance.now();
function paint(c,spec,time){const r=c.getBoundingClientRect();if(!r.width||!r.height||r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)return;   // alleen wat in beeld is
  const d=Math.min(2,devicePixelRatio||1),w=Math.round(r.width*d),h=Math.round(r.height*d);if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
  const o={time,labels:false,selection:{kind:'all'},...spec()};
  try{if(o.spatialShape==='wall'&&window.ZWand){   // de wand: eigen tekening met gladde ledlines; het licht komt uit de app. De tunnel is de originele tekening van de app.
      const f=P.rows(o),pick=o.interactiveLines===true;window.ZWand.draw(c,{lines:f.rows.map(row=>row.pixels.map(C.screenRGB)),ids:f.rows.map(row=>row.receiverId),dim:o.dim,picked:o.dim?o.dim.map(x=>!x):null,badges:pick,numbers:o.main===true&&!pick,compact:!!c.closest('.zf-dock.is-compact')});}
    else if(!o.spatialShape&&(o.main===true||o.vertical===true)&&window.ZLijn){   // gewoon (Samen of Apart) en verticaal: gladde, dunne ledlines met een duidelijke selectie
      const f=P.rows(o),pick=o.interactiveLines===true;window.ZLijn.draw(c,{lines:f.rows.map(row=>row.pixels.map(C.screenRGB)),ids:f.rows.map(row=>row.receiverId),dim:o.dim,picked:o.dim?o.dim.map(x=>!x):null,badges:pick,layout:o.layout,vertical:o.vertical===true,numbers:o.main===true,pixels:o.main===true&&o.receivers?.[0]?.type==='SPI'});}   // geen naadje bij samengevoegde ledlines (de eigenaar 13 nov: "wel niet zo een lijn ertussen zetten")
    else (o.spatialShape==='tunnel'&&o.main===true&&window.ZTunnelP||P).draw(c,o);}catch(e){console.warn('C147p voorbeeld',e.message);}
  if(c.hasAttribute('data-targets'))syncTargets(c);}
function loop(){const time=(performance.now()-t0)/1000;live.forEach((spec,c)=>{if(!c.isConnected){live.delete(c);return;}paint(c,spec,reduce()?1.5:time);});raf=live.size?requestAnimationFrame(loop):0;}
function play(c,spec){live.set(c,spec);if(!raf)raf=requestAnimationFrame(loop);}
// het grote voorbeeld van de open zone (apart: de gekozen ledlines blijven fel, de andere iets zachter)
const zoneAnim=z=>z.anim?effect(TYPE(z),z.anim):null;
const loose=z=>z.kind==='rgbw'||z.mode==='apart'||isTunnel(zoneAnim(z));   // RGBW: altijd losse receivers
// de weergaven per soort zone: hoe hangen de ledlines? (de eigenaar 13 nov: wand en tunnel zijn weg)
const VIEWS={spi:[['gewoon','Horizontaal'],['verticaal','Verticaal']],rgbw:[['stack','Horizontaal'],['verticaal','Verticaal']]};
const canPick=z=>z.lines.length>1&&loose(z);
const mainSpec=()=>{const z=zone(curZ);if(!z)return {receivers:[]};const list=seqActive(z)?seqReceivers(z):receiversOf(z),pick=canPick(z),some=pick&&sel.length>0,o=drawOpts(z,{anim:zoneAnim(z)});
  return {receivers:list,...o,...(o.spatialShape?{spatialFraming:'focus'}:{}),main:true,selectionFeedback:true,selectionOverlay:pick,interactiveLines:pick,lineNumbers:Object.fromEntries(list.map((r,i)=>[r.id,i+1])),
    dim:some?list.map((_,i)=>!sel.includes(i)):null,selection:some?{kind:'receivers',receiverIds:sel.map(i=>list[i]?.id).filter(Boolean)}:{kind:'all'},labels:false};};
// ---------- eigen timing (zoals bij een DMX-sturing): per ledline het moment waarop ze aangaat, binnen één ronde ----------
// z.seq = {on, dur (seconden per ronde), hold (seconden aan), t:[starttijd per ledline]}
function seqOf(z){const n=z.lines.length;let q=z.seq;if(!q||!Array.isArray(q.t)||q.t.length!==n){const dur=q?.dur||Math.max(2,+(n*.4+.8).toFixed(1));q={on:!!q?.on,dur,hold:q?.hold||.35,t:Array.from({length:n},(_,i)=>+(i*(dur-.8)/Math.max(1,n-1)).toFixed(2))};z.seq=q;}return q;}
const seqActive=z=>!!z&&z.lines.length>1&&isTunnel(zoneAnim(z))&&z.seq?.on===true;
// hoe fel ledline i brandt op tijdstip now: snel aan, zacht uit
function seqLevel(q,i,now){const tau=((now%q.dur)+q.dur)%q.dur;let d=tau-q.t[i];if(d<0)d+=q.dur;const a=Math.max(.02,q.in??.04),on=Math.max(a,q.hold),fade=Math.max(.02,q.out??Math.max(.12,q.hold*.6));
  if(d<a)return d/a;if(d<on)return 1;return d<on+fade?1-(d-on)/fade:0;}
function seqReceivers(z,now=performance.now()/1000){const q=seqOf(z),l=target(z),cols=l.colours.length?l.colours:['#FFFFFF'];
  return receiversOf(z,{sample:i=>{const v=seqLevel(q,i,now),[r,g,b]=rgbOf(cols[i%cols.length]);return stateFor(z,{...l,anim:null,move:null,pos:null,colours:[C.hex([r*v,g*v,b*v].map(Math.round))],whites:[Math.round((l.whites?.[i%cols.length]||0)*v)]});}});}
// de tijdlijn op een volledig scherm: het voorbeeld bovenaan, eronder een rij per ledline met een bolletje dat je versleept
function openSeq(){const z=zone(curZ);if(!z)return;const q=seqOf(z);if(!q.on){q.on=true;save();}
  const fmt=v=>v.toFixed(2).replace('.',',')+' s';
  const el=sheet('zf-page zf-seqpage',`<div class="zf-pagehead">${document.querySelector('.zf-app>.brand-bar')?.outerHTML||''}`+
    `<header class="zf-pagebar"><button type="button" class="zf-backbtn" data-close>${IC.back}<span>Terug</span></button><b>Eigen timing</b><button type="button" class="zf-round" data-close aria-label="Sluiten">${IC.close}</button></header></div>`+
    `<div class="preview-wrap v50-control-preview zf-stage zf-seqstage"><canvas data-seqcv role="img" aria-label="Voorbeeld van de eigen timing"></canvas></div>`+
    `<section class="card zf-card zf-seqtapcard"><button type="button" class="zf-seqtap" data-seqtap><b data-seqtaptitle>Tik het ritme</b><small data-seqtapsay>Tik ${z.lines.length} keer, in het ritme dat je wil. Eén tik per ${lineWord(z,1)}.</small><span class="zf-seqtapdots" data-seqtapdots>${z.lines.map(()=>'<i></i>').join('')}</span></button></section>`+
    `<section class="card zf-card zf-seqcard"><header class="zf-cardhead"><h3>Bijstellen</h3><span class="zf-count">sleep, of tik − en +</span></header><div class="zf-seqrows" data-seqrows></div><div class="zf-seqscale" data-seqscale></div></section>`+
    `<section class="card zf-card"><div class="slider-row zf-slider"><label for="zf-seqdur"><span>Eén ronde duurt</span><output data-seqout="dur"></output></label><input id="zf-seqdur" type="range" min="1" max="10" step="0.1" value="${q.dur}" data-seq="dur"></div>`+
    `<div class="slider-row zf-slider"><label for="zf-seqhold"><span>Zo lang blijft het licht aan</span><output data-seqout="hold"></output></label><input id="zf-seqhold" type="range" min="0.05" max="2" step="0.05" value="${q.hold}" data-seq="hold"></div></section>`+
    `<section class="card zf-card"><h3 class="zf-seqh">Zacht of hard</h3><p class="zf-hint">Meteen aan en uit geeft een strak ritme. Langer maakt het rustig en vloeiend.</p>`+
    `<div class="slider-row zf-slider"><label for="zf-seqin"><span>Aangaan</span><output data-seqout="in"></output></label><input id="zf-seqin" type="range" min="0" max="1" step="0.05" value="${q.in??.04}" data-seq="in"></div>`+
    `<div class="slider-row zf-slider"><label for="zf-seqout"><span>Uitgaan</span><output data-seqout="out"></output></label><input id="zf-seqout" type="range" min="0" max="2" step="0.05" value="${q.out??Math.max(.12,q.hold*.6)}" data-seq="out"></div></section>`+
    `<section class="card zf-card"><h3 class="zf-seqh">Snel instellen</h3><div class="zf-seqpresets">${[['even','Gelijk verdeeld',[4,29,54,79]],['pause','Met een pauze',[4,18,32,82]],['pairs','Twee aan twee',[4,18,54,68]],['fast','Snel na elkaar',[4,13,22,31]]].map(([k,t,x])=>`<button type="button" data-seqpreset="${k}"><b>${t}</b><span class="zf-seqpat" aria-hidden="true">${x.map(v=>`<i style="left:${v}%"></i>`).join('')}</span></button>`).join('')}</div><button type="button" class="zf-textbtn" data-seqreverse>Volgorde omkeren (${z.lines.length} → 1)</button></section>`+
    `<button type="button" class="button secondary full" data-seqoff>Terug naar de gewone animatie</button><button type="button" class="button full zf-go zf-pageback" data-close>${IC.check||''}<span>Klaar</span></button>`);
  const rows=el.querySelector('[data-seqrows]'),scale=el.querySelector('[data-seqscale]');
  const draw=()=>{const n=z.lines.length;
    rows.innerHTML=q.t.map((t,i)=>`<div class="zf-seqrow"><div class="zf-seqtrack" data-seqtrack="${i}"><i class="zf-seqhold" style="left:${(t/q.dur*100).toFixed(2)}%;width:${(Math.min(q.hold,q.dur-t)/q.dur*100).toFixed(2)}%"></i><button type="button" class="zf-seqdot" data-seqdot="${i}" style="left:${(t/q.dur*100).toFixed(2)}%" aria-label="${lineWord(z,1)} ${i+1}, begint na ${fmt(t)}">${i+1}</button></div><span class="zf-seqnudge"><button type="button" data-seqnudge="${i}" data-by="-0.05" aria-label="Eerder">−</button><output>${fmt(t)}</output><button type="button" data-seqnudge="${i}" data-by="0.05" aria-label="Later">+</button></span></div>`).join('')+`<i class="zf-seqhead" data-seqhead aria-hidden="true"></i>`;
    const steps=Math.min(10,Math.max(2,Math.round(q.dur)));
    rows.insertAdjacentHTML('afterbegin',`<div class="zf-seqgrid" aria-hidden="true">${Array.from({length:steps+1},(_,k)=>`<i style="left:${(k/steps*100).toFixed(2)}%"></i>`).join('')}</div>`);
    const soft=v=>v<=.02?'meteen':fmt(v);el.querySelector('[data-seqout="in"]').textContent=soft(q.in??.04);el.querySelector('[data-seqout="out"]').textContent=soft(q.out??Math.max(.12,q.hold*.6));
    scale.innerHTML=Array.from({length:steps+1},(_,k)=>`<span style="left:${(k/steps*100).toFixed(2)}%">${(q.dur*k/steps).toFixed(q.dur<=3?1:0).replace('.',',')} s</span>`).join('');
    el.querySelector('[data-seqout="dur"]').textContent=fmt(q.dur);el.querySelector('[data-seqout="hold"]').textContent=fmt(q.hold);
    el.querySelectorAll('input[type=range]').forEach(fill);};
  draw();
  requestAnimationFrame(()=>el.querySelector('.zf-panel')?.style.setProperty('--zf-seqtop',(el.querySelector('.zf-pagehead')?.offsetHeight||118)+'px'));
  // het voorbeeld: de wand of de tunnel, met de eigen timing
  play(el.querySelector('[data-seqcv]'),()=>{const zz=zone(curZ);return zz?{receivers:seqReceivers(zz),...drawOpts(zz,{anim:zoneAnim(zz)}),spatialFraming:'focus',main:true,labels:false,lineNumbers:Object.fromEntries(zz.lines.map((_,i)=>[`${zz.id}-${i}`,i+1]))}:{receivers:[]};});
  // de lijn die meeloopt met de tijd
  const tick=()=>{if(!el.isConnected)return;const hd=el.querySelector('[data-seqhead]'),tr=el.querySelector('.zf-seqtrack');if(hd&&tr){const r=tr.getBoundingClientRect(),b=rows.getBoundingClientRect(),tau=(performance.now()/1000)%q.dur;hd.style.left=(r.left-b.left+r.width*tau/q.dur).toFixed(1)+'px';const now=performance.now()/1000;rows.querySelectorAll('.zf-seqdot').forEach((d,i)=>d.classList.toggle('is-on',seqLevel(q,i,now)>.45));}requestAnimationFrame(tick);};requestAnimationFrame(tick);
  // slepen: op 0,05 s
  let drag=null;
  const moveTo=(i,clientX)=>{const tr=el.querySelector(`[data-seqtrack="${i}"]`);if(!tr)return;const r=tr.getBoundingClientRect(),t=Math.max(0,Math.min(q.dur-.05,(clientX-r.left)/r.width*q.dur));q.t[i]=Math.round(t*20)/20;
    const dot=tr.querySelector('.zf-seqdot'),hold=tr.querySelector('.zf-seqhold');dot.style.left=hold.style.left=(q.t[i]/q.dur*100).toFixed(2)+'%';hold.style.width=(Math.min(q.hold,q.dur-q.t[i])/q.dur*100).toFixed(2)+'%';tr.parentElement.querySelector('output').textContent=fmt(q.t[i]);};
  // tik het ritme: één tik per ledline; de tijd tussen je tikken wordt de tijd tussen de ledlines
  let taps=[],tapIdle=0;
  const tapUi=()=>{const n=q.t.length,t=el.querySelector('[data-seqtaptitle]'),sy=el.querySelector('[data-seqtapsay]');el.querySelector('[data-seqtap]').classList.toggle('is-rec',taps.length>0);
    el.querySelectorAll('[data-seqtapdots] i').forEach((d,k)=>d.classList.toggle('on',k<taps.length));
    if(!taps.length){t.textContent='Tik het ritme';sy.textContent=`Tik ${n} keer, in het ritme dat je wil. Eén tik per ${lineWord(z,1)}.`;}
    else{t.textContent=`Tik voor ${lineWord(z,1)} ${taps.length+1}`;sy.textContent=`${taps.length} van ${n} · blijf tikken`;}};
  el.querySelector('[data-seqtap]').addEventListener('pointerdown',e=>{e.preventDefault();const now=performance.now()/1000,n=q.t.length;clearTimeout(tapIdle);taps.push(now);
    if(taps.length<n){tapUi();tapIdle=setTimeout(()=>{taps=[];tapUi();},4000);return;}
    // klaar: de tikken worden de tijden; na de laatste volgt een pauze voor de ronde opnieuw begint
    const rel=taps.map(v=>v-taps[0]),gaps=rel.slice(1).map((v,k)=>v-rel[k]),avg=gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:.4;
    q.dur=Math.min(10,Math.max(1,+(rel[n-1]+Math.max(.6,avg)).toFixed(1)));q.t=rel.map(v=>Math.round(Math.min(q.dur-.05,v)*20)/20);q.on=true;taps=[];save();
    el.querySelector('#zf-seqdur').value=q.dur;draw();tapUi();const t=el.querySelector('[data-seqtaptitle]');t.textContent='Staat erin ✓';setTimeout(()=>{if(el.isConnected&&!taps.length)tapUi();},1600);});
  rows.addEventListener('pointerdown',e=>{if(e.target.closest('[data-seqnudge]'))return;const tr=e.target.closest('[data-seqtrack]');if(!tr)return;drag={i:+tr.dataset.seqtrack,id:e.pointerId};try{rows.setPointerCapture(e.pointerId);}catch(_){}moveTo(drag.i,e.clientX);e.preventDefault();});
  rows.addEventListener('pointermove',e=>{if(drag&&e.pointerId===drag.id)moveTo(drag.i,e.clientX);});
  const end=e=>{if(drag&&e.pointerId===drag.id){drag=null;save();}};rows.addEventListener('pointerup',end);rows.addEventListener('pointercancel',end);
  rows.addEventListener('keydown',e=>{const dt=e.target.closest('[data-seqdot]');if(!dt||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const i=+dt.dataset.seqdot;q.t[i]=Math.max(0,Math.min(q.dur-.05,+(q.t[i]+(e.key==='ArrowLeft'?-.05:.05)).toFixed(2)));save();draw();el.querySelector(`[data-seqdot="${i}"]`)?.focus();});
  el.addEventListener('input',e=>{const k=e.target.dataset?.seq;if(!k)return;const old=q.dur;q[k]=+e.target.value;if(k==='dur')q.t=q.t.map(t=>+(t*q.dur/old).toFixed(2));save();draw();});
  el.addEventListener('click',e=>{const pr=e.target.closest('[data-seqpreset]');
    if(pr){const n=q.t.length,D=q.dur,k=pr.dataset.seqpreset;
      q.t=k==='even'?q.t.map((_,i)=>i*D/n):k==='pause'?q.t.map((_,i)=>i<n-1?i*Math.min(.3,D*.5/n):D*.75):k==='pairs'?q.t.map((_,i)=>Math.floor(i/2)*(D/Math.ceil(n/2))+(i%2)*Math.min(.25,D*.4/n)):q.t.map((_,i)=>i*Math.min(.12,D*.4/n));
      q.t=q.t.map(t=>Math.round(Math.min(D-.05,t)*20)/20);save();draw();return;}
    if(e.target.closest('[data-seqreverse]')){q.t=q.t.slice().reverse();save();draw();return;}
    const ng=e.target.closest('[data-seqnudge]');if(ng){const i=+ng.dataset.seqnudge;q.t[i]=Math.max(0,Math.min(q.dur-.05,+(q.t[i]+(+ng.dataset.by)).toFixed(2)));save();draw();return;}
    if(e.target.closest('[data-seqoff]')){q.on=false;save();closeTop();renderZone();return;}
    if(e.target.closest('[data-close]'))setTimeout(renderZone,0);});}
// tik op een ledline in de wand of de tunnel: dezelfde test als de app (spatialPreviewHit), langs de lijn van elke ledline
function spatialHit(paths,x,y,width,height){if(!Array.isArray(paths)||x<0||x>1||y<0||y>1)return null;const px=x*width,py=y*height;let nearest=null,best=Infinity;
  for(const path of paths){if(!Array.isArray(path?.points)||path.points.length<2)continue;const tol=Math.max(1,Math.min(24,Number(path.tolerancePx)||12));let dist=Infinity;
    for(let i=1;i<path.points.length;i++){const ax=path.points[i-1][0]*width,ay=path.points[i-1][1]*height,bx=path.points[i][0]*width,by=path.points[i][1]*height,dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy,
      f=len?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len)):0;dist=Math.min(dist,(px-ax-f*dx)**2+(py-ay-f*dy)**2);}
    if(dist<=tol*tol&&dist<best){best=dist;nearest=path;}}
  return nearest;}
// de knopjes 1, 2, 3 … over de ledlines leggen, zoals syncPreviewTargets in de app (posities uit de tekenaar)
function syncTargets(c){const stage=c.closest('.v50-preview-canvas-stage');if(!stage)return;
  const key=c.dataset.lineHitRegions+'|'+c.dataset.lineHitPaths+'|'+c.dataset.lineTargetBadges+'|'+c.clientWidth+'|'+c.clientHeight;if(stage.dataset.positionKey===key)return;stage.dataset.positionKey=key;
  let regions=[],badges=[];try{regions=JSON.parse(c.dataset.lineHitRegions||'[]');badges=JSON.parse(c.dataset.lineTargetBadges||'[]');}catch(_){return;}
  const spatial=!!stage.dataset.previewSpatial;
  stage.querySelectorAll('.v50-preview-line-target').forEach(b=>{const id=b.dataset.rid;
    if(spatial){const badge=badges.find(g=>g.receiverId===id);b.hidden=!badge;if(!badge)return;
      const w=Math.min(1,44/Math.max(1,c.clientWidth)),h=Math.min(1,44/Math.max(1,c.clientHeight)),x=Math.max(0,Math.min(1-w,badge.x-w/2)),y=Math.max(0,Math.min(1-h,badge.y-h/2));
      Object.assign(b.style,{left:x*100+'%',top:y*100+'%',width:w*100+'%',height:h*100+'%'});b.style.setProperty('--badge-x',(badge.x-x)/w*100+'%');b.style.setProperty('--badge-y',(badge.y-y)/h*100+'%');
      b.dataset.spatial='true';b.dataset.positioned='true';return;}
    delete b.dataset.spatial;const r=regions.find(g=>g.receiverId===id);b.hidden=!r;if(!r)return;
    Object.assign(b.style,{left:r.x*100+'%',top:r.y*100+'%',width:r.width*100+'%',height:r.height*100+'%'});
    const badge=badges.find(g=>g.receiverId===id),pos=badge||{x:28/c.clientWidth,y:r.y+r.height/2};
    b.style.setProperty('--badge-x',(pos.x-r.x)/r.width*100+'%');b.style.setProperty('--badge-y',(pos.y-r.y)/r.height*100+'%');b.dataset.positioned='true';});}
// voorbeeld van een animatie op een tegel: de ledlines van de zone (tunnel) of één ledline (de rest), in jouw kleuren
// elk voorbeeld krijgt een eigen kleurenpalet, zodat de animaties er verschillend uitzien; wat nu speelt, toont jouw kleuren
const TILE_PALS=[['#FF3B30','#FF9500','#FFD60A'],['#0A84FF','#64D2FF','#5E5CE6'],['#30D158','#B6FF3B','#00C7BE'],['#FF2D92','#BF5AF2','#5E5CE6'],['#FFD60A','#FF9F0A','#FF375F'],
  ['#64D2FF','#0A84FF','#FFFFFF'],['#BF5AF2','#FF2D92','#FFD60A'],['#00E5A0','#FFE14D','#FF5E5E'],['#FF7A00','#FFB86B','#FFFFFF'],['#2F6BFF','#FF5E5E','#FFFFFF'],['#FF5E8A','#FFB86B','#B22FFF'],['#00C7BE','#30D158','#0A84FF']];
// n = de plaats van het voorbeeld op het scherm: buren krijgen zo altijd een ander palet
function tileSpec(z,a,n=0){const l0=target(z),l=a&&a.id!==l0.anim?{...l0,colours:TILE_PALS[n%TILE_PALS.length],whites:[],params:null}:l0;
  if(!a)return ()=>({receivers:receiversOf(z,{sample:i=>stateFor(z,{...lineLight(z,i),anim:null})}),...drawOpts(z)});
  if(isTunnel(a))return ()=>({receivers:receiversOf(zone(z.id)||z,{sample:()=>stateFor(z,{...l,anim:null},{forceAnim:a})}),...drawOpts(z,{anim:a})});
  return ()=>{const st=stateFor(z,{...l,anim:null},{forceAnim:a}),g=P.gallerySample(a,{state:st,pixels:32});
    return {receivers:[{id:'tile-'+a.id,type:TYPE(z),name:'Voorbeeld',outputs:z.kind==='spi'?[{port:1,enabled:true,pixels:g.pixels,reversed:false}]:[],state:g.state}],layout:'continuous'};};}
// ---------- teksten die vaak terugkomen ----------
const lineWord=(z,n=z.lines.length)=>z.kind==='rgbw'?(n===1?'receiver':'receivers'):(n===1?'ledline':'ledlines');
const nowLabel=z=>{const l=target(z),a=l.anim?effect(TYPE(z),l.anim):null;if(!z.on)return 'Uit';if(a)return nameOf(a);if(l.colours.length>1)return l.move?'Verloop · beweegt':'Verloop';return 'Vaste kleur';};
// ---------- de stand: zoals de app (dezelfde kaarten), met een live voorbeeld per zone ----------
function renderStand(){curZ=null;document.body.dataset.page='stand';
  $('[data-view]').innerHTML=`<div class="page stand-page zf-standpage"><header class="page-heading overview-heading stand-hero100"><div class="stand-hero-copy"><div class="eyebrow">JOUW STAND</div><h1>Demo stand</h1>`+
    `<p class="stand-hero-meta"><span>${IC.zones}${S.zones.length} zones</span><span>${IC.light}${S.zones.reduce((a,z)=>a+z.lines.length,0)} ledlines</span></p></div></header>`+
    `<section class="zone-section"><div class="section-heading"><h2>Zones</h2><button class="text-button" data-action="newzone">＋ Nieuwe zone</button></div><div class="zone-grid">${S.zones.map(z=>
      `<article class="zone-entry zone-entry-inline-power"><button type="button" class="zone-card" data-open="${z.id}"><canvas data-mini="${z.id}" aria-hidden="true"></canvas><div class="zone-copy"><div class="zone-card-heading"><b>${esc(z.name)}</b>`+
      `<span class="zone-meta">${kindBadge(z.kind)} · <span class="zone-line-count">${z.lines.length} ${lineWord(z)}</span></span></div><span class="open-label">Bedienen ${IC.chev}</span></div></button>`+
      `<div class="zone-card-actions"><div class="stand-zone-power"><button type="button" class="switch" role="switch" aria-checked="${z.on}" data-zon="${z.id}" aria-label="${esc(z.name)} aan of uit"><span>${z.on?'Aan':'Uit'}</span><i aria-hidden="true"></i></button></div></div></article>`).join('')}</div></section></div>`;
  $$('[data-mini]').forEach(c=>{const z=zone(c.dataset.mini);play(c,()=>{const zz=zone(z.id);return {receivers:receiversOf(zz),...drawOpts(zz,{view:zz.kind==='rgbw'?'stack':'gewoon'})};});});}
// ---------- de zonepagina ----------
function openZone(id,{keepTab=false}={}){curZ=id;if(!keepTab){tab='kleur';point=0;sel=[];}renderZone();scrollTo({top:0});}
// het voorbeeld: dezelfde kaart als de app, getekend door de app (ook wand en tunnel).
// Samen = één doorlopende ledline. Losse ledlines (Apart, of een tunneleffect) kies je zoals vroeger: met het knopje
// met het nummer, of door op de ledline zelf te tikken; "Alle" kiest ze weer allemaal.
// het soort zone als klein label: SPI (pixels in kleur) of RGBW (rood, groen, blauw, wit)
const kindBadge=k=>`<span class="zf-kind" data-kind="${k}">${k==='rgbw'?'RGBW':'SPI'}</span>`;
const vic=d=>`<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
// de icoontjes tonen ledlines zoals ze hangen: dikke, ronde lijnen van echte lengtes (de eigenaar 13 nov: "een mooier icoontje")
const lit=d=>vic(`<g stroke-width="2.7">${d}</g>`);
const VICON={gewoon:lit('<path d="M4.5 7h11M4.5 12h15M4.5 17h8"/>'),stack:lit('<path d="M4.5 7h11M4.5 12h15M4.5 17h8"/>'),verticaal:lit('<path d="M7 19.5v-11M12 19.5v-15M17 19.5v-8"/>'),
  // 1 ledline: één lijn met een pijl erdoor (het licht loopt door); apart: drie losse stukjes, elk voor zich
  samen:vic('<g stroke-width="2.4"><path d="M3 12h16.5"/><path d="m15.5 8 4 4-4 4"/></g>'),apart:lit('<path d="M3.5 12h3.5M10.25 12h3.5M17 12h3.5"/>')};
function stageHtml(z,{full=false}={}){const n=z.lines.length,rgbw=z.kind==='rgbw',pick=canPick(z),opts=drawOpts(z,{anim:zoneAnim(z)}),word=rgbw?'Receiver':'Ledline',words=rgbw?'receivers':'ledlines';
  const one=opts.layout==='continuous'&&!opts.spatialShape,tall=opts.spatialShape||opts.vertical;
  const scope=opts.layout==='continuous'?(n>1?`${n} ${words} · het licht loopt door`:`1 ${lineWord(z)}`):!pick||!sel.length?(n===1?`1 ${lineWord(z)}`:`Alle ${n} ${words}`):sel.length===1?`${word} ${sel[0]+1}`:`${rgbw?'Receivers':'Ledlines'} ${sel.map(i=>i+1).join(', ')}`;
  const hgt=full?(opts.vertical?'min(44dvh,340px)':tall?'min(54dvh,420px)':one?'120px':`${Math.min(8,n)*56+8}px`):(opts.vertical?'clamp(160px,22dvh,200px)':tall?'clamp(200px,30dvh,280px)':one?'88px':`${Math.min(6,n)*40+8}px`);
  return `<div class="preview-wrap v50-control-preview zf-stage${pick?' preview-selectable':''}${!z.on?' is-off':''}" data-preview-layout="${opts.layout}" style="--stage-h:${hgt};--zf-n:${Math.min(6,n)}"><div class="v50-preview-canvas-scroll">`+
    `<div class="v50-preview-canvas-stage" data-preview-ui="571"${opts.spatialShape&&pick?` data-spatial-ui="577" data-selection-mode="${sel.length?'subset':'all'}"`:''} data-preview-spatial="${opts.spatialShape||''}" data-preview-vertical="${opts.vertical?'true':'false'}">`+
    `<canvas data-stagecv${full?'':' data-prev'}${pick?' data-targets':''} role="img" aria-label="Voorbeeld van ${esc(z.name)}"></canvas>`+
    (pick?`<div class="v50-preview-line-targets" role="group" aria-label="${rgbw?'Receivers':'Ledlines'} kiezen">${z.lines.map((_,i)=>`<button type="button" class="v50-preview-line-target" data-select="${i}" data-rid="${z.id}-${i}" aria-label="${word} ${i+1}" aria-pressed="${!sel.length||sel.includes(i)}"><span class="v50-preview-line-badge"><b>${i+1}</b><span class="v50-preview-line-check" aria-hidden="true">✓</span></span></button>`).join('')}</div>`:'')+
    `</div></div><div class="v50-preview-actions"><div class="v50-preview-toolbar"><div class="v50-selection-summary" role="status" aria-live="polite"><span><small data-scope>${esc(scope)}</small><b data-now>${esc(nowLabel(z))}</b>${pick?`<em class="v50-preview-inline-hint">Tik om te kiezen</em>`:''}</span></div>`+
    viewBar(z)+(pick?`<button class="v50-select-all" type="button" data-select="all" aria-pressed="${!sel.length}">${IC.selectAll}Alle</button>`:'')+
    (full?'':`<button class="v50-preview-expand" type="button" data-action="full" aria-label="Volledig scherm" title="Volledig scherm">${IC.expand}<span>Volledig scherm</span></button>`)+`</div></div></div>`;}
// de weergave, onder het voorbeeld: twee kleine schakelaars met icoon en woord, altijd zichtbaar
// Horizontaal of Verticaal: in de onderste balk van het voorbeeld, naast Volledig scherm (de eigenaar 13 nov)
function viewBar(z){const n=z.lines.length,rgbw=z.kind==='rgbw';if(n<2&&!rgbw)return '';
  const seg=(label,items,cls='')=>`<div class="zf-seg${cls}" role="group" aria-label="${label}">${items.join('')}</div>`;
  // compact (de eigenaar 13 nov: "pakt te veel plaats in"): alleen de gekozen knop toont zijn woord. 1 ledline of Apart staat
  // niet hier maar in het tandwiel ("apart of 1 ledline mag in die instellingenpagina")
  const btn=(attr,k,t,on)=>`<button type="button" ${attr}="${k}" aria-pressed="${on}" aria-label="${t}" title="${t}">${VICON[k]}${on?`<span>${t}</span>`:''}</button>`;
  const views=seg('Hoe hangen je ledlines?',VIEWS[z.kind].map(([k,t])=>btn('data-viewto',k,t,z.view===k)),' zf-seg-view');
  return views;}
function bindStage(root,z){const c=root?.querySelector('canvas[data-stagecv]');if(!c)return;play(c,mainSpec);
  // de breedte die wand en tunnel nodig hebben (zoals in de app): bij veel ledlines schuif je opzij
  const st=c.closest('.v50-preview-canvas-stage'),shape=st.dataset.previewSpatial,n=z.lines.length;
  if(shape){const w=shape==='tunnel'?(n>8?n*46:0):n*44;st.style.setProperty('--v50-spatial-min-width',Math.round(w)+'px');}
  if(canPick(z))c.addEventListener('click',e=>{let paths=[],regions=[];try{paths=JSON.parse(c.dataset.lineHitPaths||'[]');regions=JSON.parse(c.dataset.lineHitRegions||'[]');}catch(_){return;}
    const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height,hit=paths.length?spatialHit(paths,x,y,r.width,r.height):regions.find(g=>x>=g.x&&x<=g.x+g.width&&y>=g.y&&y<=g.y+g.height);
    const i=hit?+String(hit.receiverId).split('-').pop():NaN;if(Number.isInteger(i)&&i<z.lines.length)toggleSel(i);});}
function renderZone(){const z=zone(curZ);if(!z)return renderStand();document.body.dataset.page='zone';
  const n=z.lines.length,rgbw=z.kind==='rgbw',l=target(z);
  let h=`<section class="zf-dock" data-dock><div class="zf-top"><button type="button" class="zf-round zf-back" data-action="back" aria-label="Terug naar je stand">${IC.back}</button>`+
    `<div class="zf-title"><b>${esc(z.name)}</b><small>${kindBadge(z.kind)}<span>${n} ${lineWord(z)}${rgbw?'':` · ${z.lines.reduce((a,l)=>a+(l.px||40),0)} px`}</span></small></div>`+
    `<button type="button" class="switch zf-power" role="switch" aria-checked="${z.on}" data-zon="${z.id}" aria-label="Zone aan of uit"><span>${z.on?'Aan':'Uit'}</span><i aria-hidden="true"></i></button>`+
    `<button type="button" class="zf-round zf-gear" data-action="gear" aria-label="Ledlines in deze zone">${IC.gear}</button></div>`;
  const chooser=tab==='anim'&&!l.anim&&!canPick(z);   // bij het kiezen van een animatie staat er geen voorbeeld; staan de ledlines apart, dan blijft het staan om ze te kiezen
  if(!chooser)h+=stageHtml(z);
  h+=`<div class="zf-tabs" role="tablist"><button type="button" role="tab" data-tab="kleur" aria-selected="${tab==='kleur'}">${IC.sun}<span>Kleur</span></button><button type="button" role="tab" data-tab="anim" aria-selected="${tab==='anim'}">${IC.anim}<span>Animaties</span></button></div></section>`;
  if(rgbw&&n>=2&&!z.ordered)h+=`<button type="button" class="zf-banner" data-action="order"><span class="zf-banner-ic">${IC.order}</span><span><b>Zet de volgorde</b><small>Dan loopt het licht van receiver naar receiver.</small></span>${IC.chev}</button>`;
  h+=`<div class="zf-body">${tab==='kleur'?kleurHtml(z):animHtml(z)}</div>`;
  const keepX=$('.zf-dock .v50-preview-canvas-scroll')?.scrollLeft||0;
  $('[data-view]').innerHTML=h;
  bindStage($('[data-view]'),z);if(keepX){const sc=$('.zf-dock .v50-preview-canvas-scroll');if(sc)sc.scrollLeft=keepX;}
  paintFull();
  if(tab==='kleur'){bindWheel();bindRail();}else bindModePreviews(document,z),mountLibrary(document.querySelector('[data-libinline]'),z,id=>chooseAnim(id)),$$('[data-tile]').forEach((b,n)=>{const id=b.dataset.tile,a=id==='-'?null:effect(TYPE(z),id);play(b.querySelector('canvas'),tileSpec(zone(curZ),a,n));});document.querySelectorAll('.zf-tile.is-later').forEach(b=>{const e=CATALOG[TYPE(z)].find(x=>b.getAttribute('aria-label').startsWith(nameOf(x)+':'));if(e)play(b.querySelector('canvas'),laterSpec(z,e));});
  fillAll(document);dockCompact();}
const fill=i=>i.style.setProperty('--fill',((+i.value-(+i.min||0))/((+i.max||100)-(+i.min||0)||1)*100)+'%');
const fillAll=root=>root.querySelectorAll('input[type=range]').forEach(fill);
let lastTap={i:null,at:0};
function toggleSel(i){const now=performance.now(),twice=lastTap.i===i&&now-lastTap.at<420;lastTap=twice?{i:null,at:0}:{i,at:now};
  if(twice||!sel.length)sel=[i];else if(sel.includes(i)){if(sel.length>1)sel=sel.filter(x=>x!==i);}else sel=[...sel,i].sort((a,b)=>a-b);
  point=0;const y=scrollY;renderZone();scrollTo({top:y});}
// het voorbeeld blijft bovenaan staan; bij scrollen wordt het kleiner (zoals in de app)
function dockCompact(){const d=$('[data-dock]');if(d)d.classList.toggle('is-compact',scrollY>60);}
addEventListener('scroll',dockCompact,{passive:true});
// de dock blijft net onder de merkbalk van de app staan
const brandH=()=>document.documentElement.style.setProperty('--zf-brand',(document.querySelector('.brand-bar')?.offsetHeight||56)+'px');
brandH();addEventListener('resize',brandH);
// ---------- Kleur ----------
const channelRow=(k,v,i)=>`<div class="channel-row" style="--channel:${['#c4473f','#258461','#3f69c7','#747670'][i]}"><button type="button" class="channel-toggle" data-chtoggle="${k}" aria-pressed="${v>0}" aria-label="${k.toUpperCase()} aan of uit">${k.toUpperCase()}</button>`+
  `<button type="button" data-chstep="${k}" data-d="-1" aria-label="${k.toUpperCase()} minder">−</button><input type="range" min="0" max="255" value="${v}" data-channel="${k}" aria-label="${k.toUpperCase()}"><button type="button" data-chstep="${k}" data-d="1" aria-label="${k.toUpperCase()} meer">+</button>`+
  `<input class="channel-number" type="number" inputmode="numeric" min="0" max="255" step="1" value="${v}" data-chnum="${k}" aria-label="${k.toUpperCase()} precies"></div>`;
// de plaats van de kleurpunten op de balk (0..1); zonder eigen plaatsen: gelijk verdeeld
const evenPos=n=>Array.from({length:n},(_,i)=>n<2?0:i/(n-1));
function posOf(l){const n=l.colours.length,p=l.pos;return Array.isArray(p)&&p.length===n&&p.every((v,i)=>v>=0&&v<=1&&(i===0||v>p[i-1]))?p:evenPos(n);}
const isEven=l=>posOf(l).every((v,i,a)=>Math.abs(v-(a.length<2?0:i/(a.length-1)))<.005);
const railCSS=l=>{const at=posOf(l);return `linear-gradient(90deg,${l.colours.map((k,i)=>`${C.screenHex(rgbOf(k),l.whites?.[i]||0)} ${(at[i]*100).toFixed(1)}%`).join(',')})`;};
const SW=(on,action,label)=>`<button type="button" class="switch" role="switch" aria-checked="${!!on}" data-action="${action}" aria-label="${label}"><span>${on?'Aan':'Uit'}</span><i aria-hidden="true"></i></button>`;
const ROW=(ic,title,sub,ctl)=>`<div class="zf-row zf-iconrow"><span class="zf-rowic" aria-hidden="true">${ic}</span><span class="zf-rowtxt"><b>${title}</b>${sub?`<small>${sub}</small>`:''}</span>${ctl}</div>`;
const SLIDER=(k,label,v,min=0,icon='')=>`<div class="slider-row zf-slider"><label for="zf-${k}">${icon?`<i class="zf-ai zf-ai-${icon}" aria-hidden="true"><b></b><b></b><b></b></i>`:''}<span>${label}</span><output data-out="${k}">${v}%</output></label><input id="zf-${k}" type="range" min="${min}" max="100" step="1" value="${v}" data-range="${k}"></div>`;
const swatchOf=s=>s.colours.length>1?`linear-gradient(135deg,${s.colours.join(',')})`:C.screenHex(rgbOf(s.colours[0]),s.whites?.[0]||0);
const maxCols=z=>z.loop?G.MAX_STOPS-1:G.MAX_STOPS;
function kleurHtml(z){const l=target(z),rgbw=z.kind==='rgbw',cols=l.colours,p=Math.min(point,cols.length-1),[r,g,b]=rgbOf(cols[p]),w=l.whites?.[p]||0,a=l.anim?effect(TYPE(z),l.anim):null,grad=cols.length>1;
  let h=`<section class="card colour-card zf-card" data-colour-picker="static"><header class="zf-cardhead"><h2>${grad?'Verloopkleuren':'Kleur'}</h2>${a?`<span class="zf-for">voor ${esc(nameOf(a))}</span>`:grad?`<span class="zf-count">${cols.length} van ${maxCols(z)}</span>`:''}<button type="button" class="switch zf-cardpower" role="switch" aria-checked="${z.on}" data-zon="${z.id}" aria-label="Zone aan of uit"><span>${z.on?'Aan':'Uit'}</span><i aria-hidden="true"></i></button></header>`;
  // de kleuren: 1 kleur = vaste kleur; + maakt er een verloop van (tot 8, doorlopend tot 7). RGBW: één kleur.
  h+=`<div class="zf-points">${cols.map((k,i)=>`<button type="button" class="zf-point${i===p?' is-on':''}" data-point="${i}" style="--k:${C.screenHex(rgbOf(k),l.whites?.[i]||0)}" aria-label="Kleur ${i+1}${i===p?' (gekozen)':''}"></button>`).join('')}`+
    (!rgbw&&cols.length<maxCols(z)&&!(a&&cols.length>=(a.colorCountRange?.max||1))?`<button type="button" class="zf-add${cols.length===1?' is-first':''}" data-action="addcol" aria-label="Kleur toevoegen">${IC.plus}${cols.length===1&&!a?'<span>Verloop</span>':''}</button>`:'')+
    (grad?`<button type="button" class="zf-del" data-action="delcol" aria-label="Kleur ${p+1} weghalen">${IC.close}</button>`:'')+`</div>`;
  // de balk van het verloop: sleep de puntjes om de overgang te verschuiven (zoals nu in de app)
  if(grad){const at=posOf(l);
    h+=`<div class="zf-rail" data-rail style="background:${railCSS(l)}">${cols.map((k,i)=>`<button type="button" class="zf-gstop${i===p?' is-on':''}" data-stop="${i}" style="left:${(at[i]*100).toFixed(2)}%;--k:${C.screenHex(rgbOf(k),l.whites?.[i]||0)}" aria-label="Kleur ${i+1}, plaats ${Math.round(at[i]*100)} procent"></button>`).join('')}</div>`+
      `<div class="zf-railfoot"><small>Sleep de puntjes om de overgang te verschuiven.</small>${isEven(l)?'':`<button type="button" class="zf-textbtn" data-action="even">Gelijk verdelen</button>`}</div>`;}
  h+=`<div class="colour-tools zf-tools"><div class="wheel-wrap"><canvas class="wheel" width="260" height="260" data-wheel role="img" aria-label="Kleurenwiel"></canvas><span class="wheel-cursor" data-cursor></span></div></div>`;
  h+=`<div class="slider-row zf-slider"><label for="zf-bri">${IC.sun}<span>Helderheid</span><output data-out="bright">${z.bright}%</output></label><input id="zf-bri" type="range" min="1" max="100" step="1" value="${z.bright}" data-range="bright" data-setting="bri"></div>`;
  // Fijn instellen (RGBW) direct onder het kleurwiel
  h+=`<div class="fine-controls zf-fine"><h3>Fijn instellen</h3><div class="fine-controls-body">${[['r',r],['g',g],['b',b],['w',w]].map(([k,v],i)=>channelRow(k,v,i)).join('')}</div></div>`;
  h+=`</section>`;
  // het verloop: dezelfde instellingen als nu in de app (richting, doorlopend, beweging met snelheid, richting, zachtheid, staart)
  if(!rgbw&&grad&&!a){const mv=l.move,flow=z.flow||'right';
    // de kleuren van jouw verloop: daarmee spelen de kleine voorbeelden op de knoppen
    const hexes=l.colours.map((k,i)=>C.screenHex(rgbOf(k),l.whites?.[i]||0)),gl=`linear-gradient(90deg,${hexes.join(',')})`,
      glr=`linear-gradient(90deg,${[...hexes].reverse().join(',')})`,gloop=`linear-gradient(90deg,${[...hexes,hexes[0]].join(',')})`;
    const tile=(attr,on,cls,label)=>`<button type="button" class="zf-gtile" ${attr} aria-pressed="${on}"><span class="zf-gprev ${cls}"><i></i></span><b>${label}</b></button>`;
    const ARROW={left:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H5m5-5-5 5 5 5"/></svg>',right:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-5-5 5 5-5 5"/></svg>',
      bounce:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12h17M8 7.5 3.5 12 8 16.5M16 7.5l4.5 4.5-4.5 4.5"/></svg>'};
    h+=`<section class="card zf-card zf-gradcard zf-gradcard2" style="--g:${gl};--g-rev:${glr};--g-loop:${gloop}"><header class="zf-cardhead"><h3>Verloop</h3></header>`+
      `<div class="zf-gtiles is-two">${tile('data-action="dir"',!!z.dirRev,'is-rev','Omdraaien')}${tile('data-action="loop"',!!z.loop,'is-loop','Doorlopend')}</div>`+
      `<h4 class="zf-subhead">Beweging</h4><div class="zf-gtiles is-five" role="radiogroup" aria-label="Beweging">${[['','Stil'],['schuif','Schuiven'],['golf','Golven'],['adem','Ademen'],['kop','Lichtkop']].map(([k,t])=>
        tile(`data-gmove="${k}" role="radio" aria-checked="${k===''?!mv:mv===k}"`,k===''?!mv:mv===k,'is-'+(k||'stil'),t)).join('')}</div>`+
      (mv?`<div class="zf-motion2">`+
        (mv!=='adem'?`<div class="zf-flows zf-flows2" role="group" aria-label="Richting">${[['left','Naar links'],['right','Naar rechts'],['bounce','Heen en weer']].map(([k,t])=>`<button type="button" data-flow="${k}" aria-pressed="${flow===k}">${ARROW[k]}<span>${t}</span></button>`).join('')}</div>`:'')+
        SLIDER('moveSpeed','Snelheid',z.moveSpeed??40,1,'speed')+SLIDER('soft','Zachtheid',z.soft??30,0,'smooth')+(mv==='kop'?SLIDER('trail','Staart',z.trail??40,0,'trailLength'):'')+`</div>`:'')+`</section>`;}
  // warmwit: een eigen kaart, boven de bewaarde kleuren
  const warm=z.warm;
  h+=`<section class="card zf-card zf-warmcard"><div class="zf-row"><span class="zf-warmsw"><i></i><span><b>Warmwit</b><small>RGB + W: een warmere witmix</small></span></span>${SW(warm,'warm','Warmwit')}</div>`+
    (warm?`<div class="slider-row warmth-row zf-slider"><label for="zf-warmth"><span>Warmte</span><output data-out="warmth">${z.warmth}%</output></label><input id="zf-warmth" type="range" min="1" max="100" step="1" value="${z.warmth}" data-range="warmth" data-warmth><div class="warmth-scale"><span>Neutraler</span><span>Warmer</span></div></div>`:'')+
    `</section>`;
  // bewaarde kleuren als bolletjes (ook verlopen). Wijzigen: een kruisje op elke kleur, één tik wist (met Ongedaan maken).
  const saved=S.saved.map((x,i)=>({...x,i})).filter(x=>!rgbw||x.colours.length===1),ed=zf.editSaved&&saved.length>0;
  h+=`<section class="card zf-card zf-saved${ed?' is-editing':''}"><header class="zf-cardhead"><h3>Bewaarde kleuren</h3>${saved.length?`<button type="button" class="zf-textbtn${ed?' is-done':''}" data-action="editsaved">${ed?'Klaar':'Wijzigen'}</button>`:''}</header>`+
    (ed?`<p class="zf-hint">Tik op het kruisje om te wissen. Sleep om de volgorde te veranderen.</p>`:'')+`<div class="zf-bubbles">`+
    (ed?'':`<button type="button" class="zf-bub is-add" data-action="savecol"><i>${IC.plus}</i><span>Bewaar</span></button>`)+
    saved.map(x=>ed?`<div class="zf-bub is-edit"><button type="button" class="zf-bubsw" data-savedit="${x.i}" style="--k:${swatchOf(x)}" aria-label="${esc(x.name)} wijzigen"><i></i><span>${esc(x.name)}</span></button><button type="button" class="zf-x" data-delsaved="${x.i}" aria-label="${esc(x.name)} wissen">${IC.close}</button></div>`
      :`<button type="button" class="zf-bub" data-saved="${x.i}" style="--k:${swatchOf(x)}"><i></i><span>${esc(x.name)}</span></button>`).join('')+`</div>`+
    (!rgbw&&!ed?`<h4 class="zf-subhead">Voorbeelden van verlopen</h4><div class="zf-bubbles">${G.builtinPresets.map(pr=>`<button type="button" class="zf-bub" data-gexample="${pr.id}" style="--k:linear-gradient(135deg,${pr.stops.map(x=>x.color).join(',')})"><i></i><span>${esc(pr.name)}</span></button>`).join('')}</div>`:'')+`</section>`;
  return h;}
const zf={moreOpen:false,editSaved:false,advOpen:false,joinOpen:false,advTab:'set',viewOpen:false};
// het kleurwiel van de app (colour.js): tikken of slepen kiest de kleur van het gekozen kleurpunt
let wheelImage=null;
function bindWheel(){const c=$('[data-wheel]');if(!c)return;const ctx=c.getContext('2d'),size=260;
  if(!wheelImage){wheelImage=ctx.createImageData(size,size);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,rgb=C.screenRGB(C.fromPoint(x+.5,y+.5,size)),inside=Math.hypot(x+.5-size/2,y+.5-size/2)<=size/2;
    wheelImage.data[i]=rgb[0];wheelImage.data[i+1]=rgb[1];wheelImage.data[i+2]=rgb[2];wheelImage.data[i+3]=inside?255:0;}}
  ctx.putImageData(wheelImage,0,0);placeCursor();let pointer=null;
  const pick=e=>{const r=c.getBoundingClientRect(),rgb=C.fromPoint((e.clientX-r.left)/r.width*size,(e.clientY-r.top)/r.height*size,size);setColour(C.hex(rgb));};
  c.addEventListener('pointerdown',e=>{pointer=e.pointerId;c.setPointerCapture(pointer);pick(e);});c.addEventListener('pointermove',e=>{if(e.pointerId===pointer)pick(e);});
  const done=()=>{pointer=null;if(stopped){stopped=false;const y=scrollY;renderZone();scrollTo({top:y});}};c.addEventListener('pointerup',done);c.addEventListener('pointercancel',done);}
function placeCursor(){const pt=C.position(rgbOf(curHex().hex)),cur=$('[data-cursor]');if(cur){cur.style.left=pt.x+'%';cur.style.top=pt.y+'%';}}
// de balk van het verloop: sleep een puntje tussen zijn buren; een tik kiest dat kleurpunt
function bindRail(){const rail=$('[data-rail]');if(!rail)return;let drag=null;
  rail.addEventListener('pointerdown',e=>{const st=e.target.closest('[data-stop]');if(!st)return;e.preventDefault();drag={i:+st.dataset.stop,id:e.pointerId,moved:false};rail.setPointerCapture(e.pointerId);});
  rail.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const r=rail.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));drag.moved=true;movePoint(drag.i,x);});
  const end=e=>{if(!drag||e.pointerId!==drag.id)return;const i=drag.i;drag=null;point=i;renderZone();};rail.addEventListener('pointerup',end);rail.addEventListener('pointercancel',end);
  rail.addEventListener('keydown',e=>{const st=e.target.closest('[data-stop]');if(!st||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const i=+st.dataset.stop,l=target(zone(curZ));movePoint(i,posOf(l)[i]+(e.key==='ArrowLeft'?-.01:.01));});}
function movePoint(i,x){edit(zone(curZ),l=>{const at=[...posOf(l)],lo=i>0?at[i-1]+.02:0,hi=i<at.length-1?at[i+1]-.02:1;at[i]=Math.max(lo,Math.min(hi,x));l.pos=at;});syncRail();}
function syncRail(){const z=zone(curZ),l=target(z),rail=$('[data-rail]');if(!rail)return;const at=posOf(l);rail.style.background=railCSS(l);
  rail.querySelectorAll('[data-stop]').forEach((el,i)=>{el.style.left=(at[i]*100).toFixed(2)+'%';el.style.setProperty('--k',C.screenHex(rgbOf(l.colours[i]),l.whites?.[i]||0));el.setAttribute('aria-label',`Kleur ${i+1}, plaats ${Math.round(at[i]*100)} procent`);});}
// het kleurvenster: hetzelfde kleurwiel en Fijn instellen, voor een kleur van de animatie of de achtergrond
let wheelFor=null;
function openColourSheet(kind,i=0){const z=zone(curZ),l=target(z);wheelFor=kind==='bg'?'bg':null;if(kind!=='bg')point=i;
  const hx=kind==='bg'?((l.params||{}).background||'#FFFFFF'):l.colours[i],w=kind==='bg'?0:(l.whites?.[i]||0),[r,g,b]=rgbOf(hx);
  const pre=S.saved.map((x,i)=>({...x,i})).filter(x=>x.colours.length===1);   // alleen losse kleuren: een verloop past niet in één kleur
  const el=sheet('zf-colsheet',`<header class="zf-sh"><div class="zf-heldhead"><i data-cs-sw style="--k:${C.screenHex([r,g,b],w)}"></i><b>${kind==='bg'?'Achtergrondkleur':'Kleur '+(i+1)}</b></div><button type="button" class="zf-round" data-close aria-label="Sluiten">${IC.close}</button></header>`+
    `<section class="card colour-card zf-card" data-colour-picker="static"><div class="colour-tools zf-tools"><div class="wheel-wrap"><canvas class="wheel" width="260" height="260" data-wheel role="img" aria-label="Kleurenwiel"></canvas><span class="wheel-cursor" data-cursor></span></div></div>`+
    (pre.length?`<div class="zf-cspre"><h3>Bewaarde kleuren</h3><div class="zf-csrow">${pre.map(x=>`<button type="button" class="zf-bub" data-cspreset="${x.i}" style="--k:${swatchOf(x)}"><i></i><span>${esc(x.name)}</span></button>`).join('')}</div></div>`:'')+
    `<div class="fine-controls zf-fine"><h3>Fijn instellen</h3><div class="fine-controls-body">${[['r',r],['g',g],['b',b],['w',w]].filter(([k])=>kind!=='bg'||k!=='w').map(([k,v],j)=>channelRow(k,v,j)).join('')}</div></div></section>`+
    `<button type="button" class="button full zf-go" data-close>Klaar</button>`);
  el.querySelectorAll('input[type=range]').forEach(fill);bindWheel();
  el.addEventListener('click',e=>{const ps=e.target.closest('[data-cspreset]');if(ps){const x=S.saved[+ps.dataset.cspreset];if(x)setColour(x.colours[0],kind==='bg'?undefined:(x.whites?.[0]||0));return;}if(e.target.closest('[data-close]'))setTimeout(()=>{wheelFor=null;renderZone();},0);});}
const curHex=()=>{const l=target(zone(curZ));if(wheelFor==='bg')return {hex:(l.params||{}).background||'#FFFFFF',w:0};const p=Math.min(point,l.colours.length-1);return {hex:l.colours[p],w:l.whites?.[p]||0};};
// één kleurpunt wijzigen zonder de hele pagina opnieuw te tekenen (vloeiend slepen)
let stopped=false;   // een kleur kiezen in de tab Kleur stopt de animatie: het wordt een vaste kleur (of je verloop)
const stopsAnim=()=>tab==='kleur'&&!wheelFor&&!document.querySelector('.zf-colsheet');
function setColour(hexc,white){const z=zone(curZ);if(stopsAnim()&&target(z).anim){edit(z,l=>{l.anim=null;});stopped=true;}if(wheelFor==='bg'){edit(z,l=>{l.params={...(l.params||{}),background:hexc.toUpperCase()};});syncColour();return;}edit(z,l=>{const p=Math.min(point,l.colours.length-1);l.colours[p]=hexc.toUpperCase();if(white!==undefined){l.whites=l.whites||l.colours.map(()=>0);l.whites[p]=white;}});syncColour();}
function syncColour(){const z=zone(curZ),l=target(z),cur=curHex(),[r,g,b]=rgbOf(cur.hex),w=cur.w;
  const sw=$('[data-cs-sw]');if(sw)sw.style.setProperty('--k',C.screenHex([r,g,b],w));
  $$('[data-palette]').forEach((el,j)=>el.querySelector('i')?.style.setProperty('--k',C.screenHex(rgbOf(l.colours[j]),l.whites?.[j]||0)));
  placeCursor();$$('[data-point]').forEach((el,i)=>el.style.setProperty('--k',C.screenHex(rgbOf(l.colours[i]),l.whites?.[i]||0)));
  syncRail();
  for(const [k,v] of [['r',r],['g',g],['b',b],['w',w]]){const s=$(`[data-channel="${k}"]`),n=$(`[data-chnum="${k}"]`),t=$(`[data-chtoggle="${k}"]`);if(s){s.value=v;fill(s);}if(n&&document.activeElement!==n)n.value=v;if(t)t.setAttribute('aria-pressed',String(v>0));}
  $$('[data-now]').forEach(now=>{now.textContent=nowLabel(z);});}
function channel(k,v){const was=stopped;channelNow(k,v);if(stopped&&!was&&!document.activeElement?.matches('input[type=range]')){stopped=false;const y=scrollY;renderZone();scrollTo({top:y});}}
function channelNow(k,v){const cur=curHex(),rgb=rgbOf(cur.hex);v=Math.max(0,Math.min(255,Math.round(v)));
  if(k==='w')return setColour(cur.hex,v);rgb['rgb'.indexOf(k)]=v;setColour(C.hex(rgb));}
// ---------- Animaties ----------
// de instellingen van een animatie: dezelfde als in de app, in drie blokken (kleuren · zo loopt het · achtergrond) en Geavanceerd
const ADV=[['widthPixels','Breedte',1,60,' px'],['objectCount','Aantal lichtpunten',1,8,''],['trailLength','Staart',0,100,'%'],['spacing','Afstand tussen lichtpunten',0,100,'%'],
  ['smooth','Vloeiendheid',0,100,'%'],['spread','Spreiding',0,100,'%'],['randomness','Variatie',0,100,'%'],['fadeAmount','Zacht aan en uit',0,100,'%'],['width','Breedte van het licht',0,100,'%'],
  ['lineDelayMs','Startverschil tussen ledlines',0,5000,' ms'],['delayMs','Minimale tijd tussen ledlines',0,10000,' ms']];
const PDEF={widthPixels:4,objectCount:1,trailLength:12,spacing:30,smooth:100,spread:30,randomness:20,fadeAmount:90,width:65,lineDelayMs:160,delayMs:300,bgBrightness:12};
const pval=(l,a,k)=>(l.params||{})[k]??(k==='bgBrightness'?PDEF[k]:a.state[k])??PDEF[k];
const pfmt=(v,u)=>u===' ms'?`${(v/1000).toLocaleString('nl-BE',{maximumFractionDigits:2})} s`:`${Math.round(v)}${u}`;
// een klein bewegend icoontje per instelling: het toont wat de instelling doet
const AICON=k=>`<i class="zf-ai zf-ai-${k}" aria-hidden="true"><b></b><b></b><b></b></i>`;
const PSLIDER=(a,l,[k,label,min,max,u],icon=false)=>{const v=pval(l,a,k);return `<div class="slider-row zf-slider"><label for="zf-p-${k}">${icon?AICON(k):''}<span>${label}</span><output data-pout="${k}" data-unit="${u}">${pfmt(v,u)}</output></label><input id="zf-p-${k}" type="range" min="${min}" max="${max}" step="${u===' ms'?10:1}" value="${v}" data-param="${k}"></div>`;};
const PSW=(a,l,k,label)=>{const on=!!((l.params||{})[k]??a.state[k]);return `<button type="button" class="switch" role="switch" aria-checked="${on}" data-ptoggle="${k}" aria-label="${label}"><span>${on?'Aan':'Uit'}</span><i aria-hidden="true"></i></button>`;};
const togetherHtml=z=>{const rgbw=z.kind==='rgbw';return `<div class="zf-together" role="group" aria-label="Samen of apart">${[['samen',rgbw?'Samen':'1 ledline',rgbw?'Van receiver naar receiver':'Het licht loopt door'],['apart','Apart',rgbw?'Elke receiver voor zich':'Elke ledline voor zich']].map(([k,t,x])=>
  `<button type="button" data-mode="${k}" aria-pressed="${z.mode===k}"><canvas data-modeprev="${k}" aria-hidden="true"></canvas><b>${t}</b><small>${x}</small></button>`).join('')}</div>`;};
function animHtml(z){const l=target(z),T=TYPE(z),n=z.lines.length,a=l.anim?effect(T,l.anim):null,rgbw=z.kind==='rgbw';
  const top=[...new Set([...S.recent.slice(0,2),...TOP[T]])].map(id=>effect(T,id)).filter(e=>e&&(fits(e,z)||isTunnel(e))).slice(0,6);
  let h='';
  if(a){const ctr=a.controls||[],max=a.colorCountRange?.max||1,min=a.colorCountRange?.min||1,pal=l.colours.slice(0,max),tun=isTunnel(a);
    const where=canPick(z)&&sel.length?` op ${sel.length===1?(rgbw?'receiver':'ledline')+' '+(sel[0]+1):sel.length+' '+lineWord(z,2)}`:'';
    // de achtergrondkleur hoort bij de kleuren: een zachte kleur waar de animatie niet brandt (zoals de app)
    let bgHtml='';if(a.backgroundEditable){const pm=l.params||{},on=!!pm.backgroundOn,bgc=pm.background||'#FFFFFF';
      bgHtml=`<div class="zf-bgcard">`+ROW(`<i class="zf-bgsw" style="--k:${on?C.screenHex(rgbOf(bgc),0):'transparent'}"></i>`,'Achtergrondkleur',on?'Brandt zacht waar de animatie niet is.':'Waar de animatie niet is, blijft het donker.',PSW(a,l,'backgroundOn','Achtergrondkleur'))+
        (on?`<button type="button" class="zf-bgpick" data-action="bgcolour"><i style="--k:${C.screenHex(rgbOf(bgc),0)}"></i><span>Kleur van de achtergrond</span>${IC.chev}</button>`+PSLIDER(a,l,['bgBrightness','Helderheid van de achtergrond',1,60,'%']):'')+`</div>`;}
    // 1) wat speelt, met de kleuren van de animatie (zoals de app: tik op een kleur om ze te wijzigen)
    h+=`<section class="card zf-card zf-playing"><header class="zf-cardhead"><div><small class="zf-kicker">Speelt nu${where}</small><h2>${esc(nameOf(a))}</h2></div>`+
      `<button type="button" class="zf-round zf-star${savedHere(z,a.id)?' is-on':''}" data-action="keepanim" aria-label="${savedHere(z,a.id)?'Bewaard':'Bewaar deze animatie'}">${IC.star}</button></header>`+
      // de eigenaar 13 nov: "als een animatie actief is, dat je makkelijk kan terugkeren naar de kiezer"
      `<button type="button" class="zf-tochooser" data-action="tochooser"><span class="zf-tochooser-ic">${IC.search}</span><b>Andere animatie</b><small>Naar de kiezer</small>${IC.chev}</button>`+
      (a.paletteEditable===false?'':`<div class="zf-palhead"><b>Animatiekleuren</b><small>Tik om te wijzigen. Sleep om de volgorde te veranderen.</small></div><div class="zf-palette">`+
        pal.map((k,i)=>`<div class="zf-palitem"><button type="button" class="zf-palcol" data-palette="${i}" aria-label="Kleur ${i+1} wijzigen"><i style="--k:${C.screenHex(rgbOf(k),l.whites?.[i]||0)}"></i><small>Kleur ${i+1}</small></button>`+
          (pal.length>min?`<button type="button" class="zf-x zf-paldel" data-paldel="${i}" aria-label="Kleur ${i+1} weghalen">${IC.close}</button>`:'')+`</div>`).join('')+
        (pal.length<max?`<button type="button" class="zf-paladd" data-action="paladd" aria-label="Kleur toevoegen"><i>${IC.plus}</i><small>Kleur</small></button>`:'')+`</div>`)+bgHtml+`</section>`;
    // 2) zo loopt het: samen of apart, richting, heen en weer, spiegelen, breedte, snelheid, helderheid
    const fwd=a.state.direction==='forward'?'forward':'right',back=fwd==='forward'?'reverse':'left',dir=(l.params||{}).direction??a.state.direction??fwd;
    const wspec=ctr.includes('widthPixels')?ADV[0]:ctr.includes('width')?ADV.find(x=>x[0]==='width'):null;
    h+=`<section class="card zf-card zf-run"><header class="zf-cardhead"><h3>Zo loopt het</h3></header>`+
      (n>1?(tun?`<p class="zf-note">${LOOP}${loopSay(z)}</p>`:rgbw?'':togetherHtml(z)):'')+
      (ctr.includes('direction')?`<div class="zf-flows zf-dirs" role="group" aria-label="Richting">${[[fwd,tun?`1 → ${n}`:'→ Vooruit'],[back,tun?`${n} → 1`:'← Achteruit']].map(([v,t])=>`<button type="button" data-dir="${v}" aria-pressed="${dir===v}">${t}</button>`).join('')}</div>`:'')+
      (ctr.includes('bounce')?ROW(IC.reverse,'Heen en weer','Het licht keert terug aan het einde.',PSW(a,l,'bounce','Heen en weer')):'')+
      (ctr.includes('mirror')?ROW(IC.mirror,'Spiegelen','Vanuit het midden naar beide kanten.',PSW(a,l,'mirror','Spiegelen')):'')+
      (wspec?PSLIDER(a,l,wspec):'')+
      `<div class="slider-row zf-slider"><label for="zf-speed"><span>Snelheid</span><output data-out="speed">${z.speed}%</output></label><input id="zf-speed" type="range" min="1" max="100" step="1" value="${z.speed}" data-range="speed"></div>`+
      `<div class="slider-row zf-slider"><label for="zf-bri2">${IC.sun}<span>Helderheid</span><output data-out="bright">${z.bright}%</output></label><input id="zf-bri2" type="range" min="1" max="100" step="1" value="${z.bright}" data-range="bright" data-setting="bri"></div></section>`;
    // 4) geavanceerd: alles wat deze animatie nog kan (dicht tot je het opent)
    const adv=ADV.filter(([k])=>ctr.includes(k)&&k!==wspec?.[0]);
    const canSeq=isTunnel(a)&&z.lines.length>1,sq=seqOf(z),seqTab=canSeq&&zf.advTab==='seq';
    if(adv.length||canSeq)h+=`<details class="card zf-card zf-more zf-adv"${zf.advOpen?' open':''}><summary><span class="zf-rowic" aria-hidden="true">${IC.gear}</span><span>Geavanceerd</span><small>${canSeq&&sq.on?'Eigen timing staat aan':adv.slice(0,2).map(x=>x[1]).join(' · ')+(adv.length>2?' · meer':'')}</small>${IC.chev}</summary>`+
      `<div class="zf-morebody">`+(canSeq?`<div class="zf-advtabs" role="group" aria-label="Geavanceerd"><button type="button" data-advtab="set" aria-pressed="${!seqTab}">${IC.gear}<span><b>Instellingen</b><small>Van deze animatie</small></span></button><button type="button" data-advtab="seq" aria-pressed="${seqTab}"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg><span><b>Eigen timing</b><small>${sq.on?'Staat aan':'Jouw eigen ritme'}</small></span></button></div>`:'')+
      (seqTab?`<div class="zf-row"><span><b>Eigen timing</b><small>Jij bepaalt wanneer elke ${lineWord(z,1)} aangaat.</small></span>${SW(sq.on,'seqon','Eigen timing')}</div>`+
        `<button type="button" class="zf-seqmini" data-action="seq" aria-label="Tijdlijn openen"><span class="zf-seqbar">${sq.t.map((t,i)=>`<i style="left:${(t/sq.dur*100).toFixed(1)}%"><b>${i+1}</b></i>`).join('')}</span></button>`+
        `<button type="button" class="button full zf-go" data-action="seq">${IC.expand}<span>Tijdlijn openen</span></button>`
        :adv.map(x=>PSLIDER(a,l,x,true)).join('')+(adv.length?`<button type="button" class="zf-textbtn" data-action="resetparams">Terug naar standaard</button>`:''))+`</div></details>`;
  }
  h+=`<section class="zf-libinline" data-libinline><header class="zf-sechead"><h3>${a?'Andere animatie':'Kies een animatie'}</h3><small>Na het kiezen in jouw kleuren</small></header>${libInner()}</section>`;
  return h;}
function chooseAnim(id){const z=zone(curZ),a=effect(TYPE(z),id);if(!a)return;if(isTunnel(a)){sel=[];z.per={};}
  edit(z,l=>{if(l.anim!==id)l.params={};l.anim=id;l.move=null;});S.recent=[id,...S.recent.filter(x=>x!==id)].slice(0,8);save();renderZone();}
// boven de groep Looplicht: het beeldje en één zin; kan het nog niet, dan zegt het vanaf hoeveel
const loopHead=z=>`<p class="zf-loophead">${LOOP}<span>${loopSay(z)}${z.lines.length<2?`<small>Vanaf 2 ${lineWord(z,2)}.</small>`:''}</span></p>`;
// het voorbeeld op een grijze tegel: hetzelfde looplicht op 3 voorbeeld-ledlines, zodat je ziet wat je krijgt
function laterSpec(z,a){const zz={...z,lines:z.kind==='rgbw'?[{},{},{}]:[{px:40},{px:40},{px:40}]};
  return ()=>({receivers:receiversOf(zz,{sample:()=>stateFor(zz,{...target(z),colours:['#9B4DFF','#FF2D92'],whites:[],anim:null},{forceAnim:a})}),...drawOpts(zz,{anim:a})});}
// de bibliotheek: dezelfde animaties als de app, met zoeken en groepen
let libQ='',libG='alles',libSort='soort';
const famTitle=g=>noTunnel(g.title||'Animaties');
// de lijst van alle animaties: zoeken, groepen, sorteren en de animaties zelf. Staat meteen in de tab Animaties
// (de eigenaar 13 nov: "als je op Animaties duwt, wil ik dat je direct alle animaties ziet") en in het volledige scherm.
function libInner(){return `<label class="zf-search">${IC.search}<input type="search" placeholder="Zoek een animatie" data-q value="${esc(libQ)}" autocomplete="off"></label><div class="zf-groups" data-groups></div>`+
    `<div class="zf-sortbar"><span>Sorteren</span><div class="zf-sort" role="group" aria-label="Sorteren">${[['soort','Per soort'],['az','A–Z'],['recent','Laatst gebruikt']].map(([k,t])=>`<button type="button" data-sort="${k}" aria-pressed="${libSort===k}">${t}</button>`).join('')}</div></div>`+
    `<div class="zf-list" data-list></div>`;}
function mountLibrary(el,z,onPick){if(!el||!z)return;const T=TYPE(z);
  const tile=(e,cur)=>!fits(e,z)?`<button type="button" class="zf-var is-later" disabled aria-label="${esc(nameOf(e))}: vanaf ${need(e)} ${lineWord(z,2)}"><span class="zf-varcv"><canvas aria-hidden="true"></canvas><em class="zf-from">vanaf ${need(e)}</em></span><b>${esc(nameOf(e))}</b></button>`:`<button type="button" class="zf-var${cur===e.id?' is-on':''}" data-choose="${e.id}" aria-pressed="${cur===e.id}"><span class="zf-varcv"><canvas aria-hidden="true"></canvas>${T==='SPI'&&!CATALOG.SPI.some(x=>x.id===e.id)?kindBadge('rgbw'):''}${cur===e.id?`<i class="zf-tick">${IC.check}</i>`:savedHere(z,e.id)?`<i class="zf-saved-star">${IC.star}</i>`:''}</span><b>${esc(nameOf(e))}</b></button>`;
  const row=(e,cur)=>!fits(e,z)?`<button type="button" class="zf-li is-later" disabled><span class="zf-licv"><canvas aria-hidden="true"></canvas></span><span class="zf-litxt"><b>${esc(nameOf(e))}</b><small>${GROUP[groupOf(e)]}</small></span><em class="zf-from">vanaf ${need(e)}</em></button>`:`<button type="button" class="zf-li${cur===e.id?' is-on':''}" data-choose="${e.id}"><span class="zf-licv"><canvas aria-hidden="true"></canvas></span><span class="zf-litxt"><b>${esc(nameOf(e))}</b><small>${GROUP[groupOf(e)]}</small></span>${cur===e.id?`<i class="zf-tick">${IC.check}</i>`:savedHere(z,e.id)?`<i class="zf-saved-star">${IC.star}</i>`:''}</button>`;
  const paintList=()=>{const pool=[...CATALOG[T].filter(e=>fits(e,z)||isTunnel(e)),...savedPool(z)],cats=['alles',...Object.keys(GROUP).filter(k=>pool.some(e=>groupOf(e)===k)),'bewaard'],cur=target(z).anim;
    const ok=pool.filter(e=>fits(e,z));
    el.querySelector('[data-groups]').innerHTML=cats.map(k=>{const later=k==='tunnel'&&!pool.some(e=>groupOf(e)===k&&fits(e,z));
      return `<button type="button" data-g="${k}" aria-pressed="${libG===k}"${later?' class="is-later"':''}>${k==='alles'?'Alles':k==='bewaard'?'Bewaard':GROUP[k]}<small>${later?'vanaf 2':k==='alles'?ok.length:k==='bewaard'?ok.filter(e=>savedHere(z,e.id)).length:ok.filter(e=>groupOf(e)===k).length}</small></button>`;}).join('');
    el.querySelectorAll('[data-sort]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.sort===libSort));
    let list=(libQ.trim()?Lib.search(pool,libQ,tr):pool).filter(e=>libG==='alles'||(libG==='bewaard'?savedHere(z,e.id):groupOf(e)===libG));
    let h=libG==='tunnel'&&!libQ.trim()?loopHead(z):'';
    if(!list.length)h=`<p class="zf-none">${libG==='bewaard'?'Nog niets bewaard. Tik op de ster bij een animatie die speelt.':'Niets gevonden.'}</p>`;
    else if(libSort==='soort'){   // per soort: de families van de app, varianten mooi samen op een rij
      let fams=[];try{fams=Lib.groups(list,'catalogue',tr);}catch(_){fams=[{key:'all',title:'Animaties',category:'',effects:list}];}
      let lastCat='';
      fams.forEach(g=>{const effs=(g.effects||[]).filter(e=>list.includes(e));if(!effs.length)return;const cat=groupOf(effs[0]);
        if(libG==='alles'&&cat!==lastCat){h+=`<h4 class="zf-cathead">${GROUP[cat]}</h4>`+(cat==='tunnel'?loopHead(z):'');lastCat=cat;}
        h+=`<section class="zf-fam${effs.some(e=>e.id===cur)?' has-current':''}"><header><b>${esc(famTitle(g))}</b><small>${effs.length===1?'1 animatie':effs.length+' varianten'}</small></header>`+
          `<div class="zf-famrow">${effs.map(e=>tile(e,cur)).join('')}</div></section>`;});}
    else{   // A–Z of laatst gebruikt (wat je onlangs koos eerst)
      const az=(a,b)=>nameOf(a).localeCompare(nameOf(b),'nl');list=[...list].sort(libSort==='recent'?(a,b)=>{const ia=S.recent.indexOf(a.id),ib=S.recent.indexOf(b.id);return (ia<0?99:ia)-(ib<0?99:ib)||az(a,b);}:az);
      if(libSort==='recent'&&!S.recent.some(id=>list.some(e=>e.id===id)))h+=`<p class="zf-hint">Je hebt nog geen animaties gekozen. Hieronder staan ze van A tot Z.</p>`;
      h+=list.map(e=>row(e,cur)).join('');}
    const box=el.querySelector('[data-list]');box.innerHTML=h;
    box.querySelectorAll('[data-choose]').forEach((b,n)=>play(b.querySelector('canvas'),tileSpec(zone(curZ),effect(T,b.dataset.choose),n)));
    box.querySelectorAll('.is-later[aria-label]').forEach((b,n)=>{const e=CATALOG[T].find(x=>b.getAttribute('aria-label').startsWith(nameOf(x)+':'));if(e)play(b.querySelector('canvas'),laterSpec(z,e));});};
  paintList();el.querySelector('[data-q]').addEventListener('input',e=>{libQ=e.target.value;paintList();});
  el.addEventListener('click',e=>{const g=e.target.closest('[data-g]');if(g){libG=g.dataset.g;paintList();return;}const so=e.target.closest('[data-sort]');if(so){libSort=so.dataset.sort;paintList();return;}
    const p=e.target.closest('[data-choose]');if(p)onPick(p.dataset.choose);});}
function openLibrary(){const z=zone(curZ);
  // een volledig scherm, met het logo bovenaan en een knop om terug te gaan
  const el=sheet('zf-lib zf-page',`<div class="zf-pagehead">${document.querySelector('.zf-app>.brand-bar')?.outerHTML||''}`+
    `<header class="zf-pagebar"><button type="button" class="zf-backbtn" data-close>${IC.back}<span>Terug</span></button><b>Alle animaties</b><button type="button" class="zf-round" data-close aria-label="Sluiten">${IC.close}</button></header></div>`+
    libInner()+`<button type="button" class="button secondary full zf-pageback" data-close>${IC.back}<span>Terug naar ${esc(z.name)}</span></button>`);
  mountLibrary(el,z,id=>{closeTop();tab='anim';chooseAnim(id);});}
// ---------- tandwiel: Ledlines in deze zone ----------
// een icoontje voor elk deel van het tandwiel (de eigenaar 13 nov: "graag meer icoontjes bij instellingen")
const GIC={licht:VICON.samen,weergave:path('M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12ZM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z'),
  receivers:IC.receiver,geavanceerd:IC.gear,samenvoegen:IC.link};
const gh=(k,t)=>`<h3><i class="zf-gic" aria-hidden="true">${GIC[k]}</i>${t}</h3>`;
// Ledlines samenvoegen (de eigenaar 13 nov): het beeld toont het (twee ledlines schuiven tegen elkaar, worden één, en een
// licht loopt er in één keer door); daaronder je ledlines als een ketting met een schakel tussen elke twee.
function joinSection(z){const rgbw=z.kind==='rgbw',max=Math.max(...z.lines.map(l=>l.px||40));
  const word=rgbw?'receiver':'ledline',words=rgbw?'receivers':'ledlines';
  const size=ln=>rgbw?(ln.parts?`${ln.parts.length} ${words}`:(ln.rcv||'')):`${ln.px||40} px`;
  const bar=ln=>`<span class="zf-cb${ln.parts?' is-joined':''}" style="--w:${rgbw?(ln.parts?100:100/Math.max(2,z.lines.length)*1.6):((ln.px||40)/max*100).toFixed(1)}%"><i></i></span>`;
  const row=(ln,i)=>ln.parts
    ?`<div class="zf-jrow is-joined"><span class="zf-jtick" aria-hidden="true">${IC.link}</span><span class="zf-cnum">${i+1}</span>${bar(ln)}<small>${size(ln)}</small>`+
      `<button type="button" class="zf-unlink" data-split="${i}">${IC.unlink}<span>Ontkoppel</span></button></div>`
    :`<button type="button" class="zf-jrow" data-jpick="${i}" aria-pressed="false" aria-label="${rgbw?'Receiver':'Ledline'} ${i+1} kiezen"><span class="zf-jtick" aria-hidden="true">${IC.check}</span><span class="zf-cnum">${i+1}</span>${bar(ln)}<small>${size(ln)}</small></button>`;
  return `<section class="zf-gsec zf-joinsec2" data-joinsec>${gh('samenvoegen',rgbw?'Receivers samenvoegen':'Ledlines samenvoegen')}`+
    `<div class="zf-joinanim${rgbw?' is-rgbw':''}" aria-hidden="true"><span class="zf-ja-a"><b>1</b></span><span class="zf-ja-b"><b>2</b></span><i class="zf-ja-run"></i></div>`+
    `<p class="zf-hint">${rgbw?'Horen twee of meer receivers bij elkaar, bijvoorbeeld op één lange wand? Voeg ze samen. Ze werken dan altijd als één, ook bij een looplicht.':'Is één ledline te kort, bijvoorbeeld voor een wand van 6,3 m? Voeg er twee of meer samen. Ze werken dan altijd als één ledline, ook bij Apart en bij een looplicht.'}</p>`+
    `<div class="zf-jlist" role="group" aria-label="Kies wat samen moet">${z.lines.map(row).join('')}</div>`+
    `<button type="button" class="zf-joingo" data-joinsel disabled>${IC.link}<span>Tik er 2 of meer aan</span></button></section>`;}
// de knop onder de lijst zegt wat er gebeurt: "Voeg 1, 2 en 3 samen"
function joinLabel(el){const z=zone(curZ),rgbw=z?.kind==='rgbw',on=[...el.querySelectorAll('[data-jpick][aria-pressed=true]')].map(b=>+b.dataset.jpick+1),go=el.querySelector('[data-joinsel]');if(!go)return;
  go.disabled=on.length<2;const list=on.length>1?on.slice(0,-1).join(', ')+' en '+on[on.length-1]:'';
  go.querySelector('span').textContent=on.length<2?(on.length?'Tik er nog één aan':'Tik er 2 of meer aan'):`Voeg ${list} samen`;
  go.classList.toggle('is-ready',on.length>=2);go.setAttribute('aria-label',on.length<2?'Kies eerst 2 of meer':`Voeg ${rgbw?'receivers':'ledlines'} ${list} samen`);}
// bewaarde animaties: SPI-gemaakt alleen bij SPI; RGBW-gemaakt bij RGBW én bij SPI (de eigenaar 13 nov)
const savedFrom=id=>S.savedFrom?.[id]||(CATALOG.SPI.some(e=>e.id===id)&&!CATALOG.RGBW.some(e=>e.id===id)?'SPI':CATALOG.RGBW.some(e=>e.id===id)&&!CATALOG.SPI.some(e=>e.id===id)?'RGBW':'SPI');
const savedHere=(z,id)=>S.savedAnims.includes(id)&&(TYPE(z)==='SPI'||savedFrom(id)==='RGBW');
const savedPool=z=>TYPE(z)==='SPI'?S.savedAnims.filter(id=>savedFrom(id)==='RGBW'&&!CATALOG.SPI.some(e=>e.id===id)).map(id=>CATALOG.RGBW.find(e=>e.id===id)).filter(Boolean):[];
function openGear(){const z=zone(curZ),rgbw=z.kind==='rgbw',n=z.lines.length;
  const views=VIEWS[z.kind];
  const rcvs=rgbw?z.lines.flatMap(l=>l.parts?l.parts.map(p=>p.rcv):[l.rcv]):z.rcv||[];   // een samengevoegde groep telt al haar receivers
  const el=sheet('zf-gearsheet',`<header class="zf-sh"><div><small class="zf-kicker">${esc(z.name)}</small><b>Ledlines in deze zone</b></div><button type="button" class="zf-round" data-close aria-label="Sluiten">${IC.close}</button></header>`+
    `<button type="button" class="zf-orderrow" data-action="order"><span class="zf-orderic">${IC.direction}</span><span><b>${rgbw?'Volgorde':'Looprichting'}</b></span>${IC.chev}</button>`+
    (n>1&&!rgbw?`<section class="zf-gsec">${gh('licht','Licht')}<div class="zf-together" role="group" aria-label="Samen of apart">${[['samen',rgbw?'Samen':'1 ledline',rgbw?'Van receiver naar receiver':'Het licht loopt door'],['apart','Apart',rgbw?'Elke receiver voor zich':'Elke ledline voor zich']].map(([k,t,s])=>
      `<button type="button" data-mode="${k}" aria-pressed="${z.mode===k}"><canvas data-modeprev="${k}" aria-hidden="true"></canvas><b>${t}</b><small>${s}</small></button>`).join('')}</div></section>`:'')+
    `<section class="zf-gsec">${gh('weergave','Weergave')}${rgbw?'':'<p class="zf-hint">Alleen hoe het voorbeeld eruitziet.</p>'}<div class="zf-views">${views.map(([k,t,sub])=>`<button type="button" data-viewto="${k}" aria-pressed="${z.view===k}"><canvas data-viewprev="${k}" aria-hidden="true"></canvas><b>${t}</b>${sub?`<small>${sub}</small>`:''}</button>`).join('')}</div></section>`+
    `<section class="zf-gsec">${gh('receivers','Receivers in deze zone')}<div class="zf-rcvs">${rcvs.map(id=>`<div class="zf-rcv"><span class="zf-rart">${RA?RA.svg({type:z.kind,view:'top',theme:document.body.dataset.theme==='dark'?'dark':'light',outputs:[true,true,true,true],cable:10,lead:4,led:'#1FC45B',shadow:false,width:64}):IC.receiver}</span><b>${id}</b><button type="button" class="zf-chip" data-action="moveRcv">Verplaatsen</button></div>`).join('')}`+
    `<a class="zf-addrcv" href="../receiver-toevoegen/index.html${rgbw?'?type=rgbw':''}">${IC.plus}<span>Receiver toevoegen</span></a></div></section>`+
    (n>1||z.lines.some(l=>l.parts)?joinSection(z):'')+
    `<div class="zf-tutrow"><button type="button" class="zf-tutlink" data-action="intro"><i>${IC.play}</i><span>Bekijk tutorial</span></button>`+
    `<button type="button" class="zf-tutlink is-pro" data-action="intropro"><i>${IC.play}</i><span>Gevorderd: looplicht en timing</span></button></div>`);
  el.addEventListener('click',e=>{
    const pk=e.target.closest('[data-jpick]');if(pk){pk.setAttribute('aria-pressed',String(pk.getAttribute('aria-pressed')!=='true'));joinLabel(el);return;}
    const go=e.target.closest('[data-joinsel]'),sp=e.target.closest('[data-split]');if(!go&&!sp)return;const zz=zone(curZ),rgbw=zz.kind==='rgbw',W=rgbw?'Receiver':'Ledline';
    if(go){const pick=[...el.querySelectorAll('[data-jpick][aria-pressed=true]')].map(b=>+b.dataset.jpick).sort((a,b)=>a-b);if(pick.length<2)return;
      const parts=pick.flatMap(i=>{const ln=zz.lines[i];return ln.parts||[rgbw?{rcv:ln.rcv}:{px:ln.px||40}];});
      const joined=rgbw?{rcv:parts[0].rcv,parts}:{px:parts.reduce((a,p)=>a+p.px,0),parts};
      const keep=zz.lines.filter((_,i)=>!pick.includes(i));keep.splice(pick[0]-pick.filter(i=>i<pick[0]).length,0,joined);zz.lines=keep;
      toast(`${W}s ${pick.map(i=>i+1).join(', ').replace(/, (\d+)$/,' en $1')} zijn nu één ${W.toLowerCase()}.`);}
    else{const i=+sp.dataset.split,a=zz.lines[i];if(!a?.parts)return;zz.lines.splice(i,1,...a.parts.map(p=>({...p})));toast(rgbw?'De receivers zijn weer los.':'De ledlines zijn weer los.');}
    zz.per={};sel=[];if(zz.lines.length<2)zz.mode='samen';save();closeTop();renderZone();openGear();
    setTimeout(()=>document.querySelector('.zf-gearsheet [data-joinsec] .zf-jlist')?.scrollIntoView({block:'center',behavior:'instant'}),380);});
  bindModePreviews(el,z);
  el.querySelectorAll('[data-viewprev]').forEach(c=>play(c,()=>{const zz=zone(curZ);return {receivers:receiversOf(zz),...drawOpts(zz,{view:c.dataset.viewprev})};}));}
// kleine voorbeelden bij Samen en Apart: dezelfde animatie, één keer samen en één keer apart
function bindModePreviews(root,z){root.querySelectorAll('[data-modeprev]').forEach(c=>play(c,()=>{const zz=zone(curZ),mode=c.dataset.modeprev,cur=target(zz).anim?effect(TYPE(zz),target(zz).anim):null;
  const a=cur&&!isTunnel(cur)?cur:effect(TYPE(zz),zz.kind==='rgbw'?'rgbw-breathe-1':'spi-comet-14');
  return {receivers:receiversOf(zz,{sample:i=>stateFor(zz,{...lineLight(zz,i),anim:null},{forceAnim:zz.kind==='rgbw'&&mode==='samen'?effect('RGBW','v30-tunnel-travel'):a})}),...drawOpts(zz,{view:zz.kind==='rgbw'?'stack':'gewoon',mode})};}));}
// ---------- een zone aanmaken: twee vragen met een bewegend voorbeeld ----------
function openNew(){let kind='spi',mode='samen',view='gewoon',name='',step=0;
  const el=sheet('zf-newsheet','<div class="zf-nw" data-nw></div>'),box=el.querySelector('[data-nw]');
  const demoZone=()=>({id:'new',kind,on:true,view,mode,lines:kind==='spi'?[{px:44},{px:44},{px:44}]:[{},{},{}],colours:['#FF5E3A','#FF9F1C','#7B2FF7'],whites:[0,0,0],speed:55,bright:100,per:{}});
  const paintNew=()=>{let h=`<header class="zf-sh"><div><small class="zf-kicker">Stap ${step+1} van ${kind==='rgbw'?2:3}</small><b>Nieuwe zone</b></div><button type="button" class="zf-round" data-close aria-label="Sluiten">${IC.close}</button></header>`;
    if(step===0)h+=`<label class="zf-field"><span>Naam</span><input data-name placeholder="Bijvoorbeeld Toog" value="${esc(name)}" autocomplete="off"></label>`+
      `<h2 class="zf-q">Welke ledlines?</h2><div class="zf-opts">${[['spi','Pixel LED · SPI','Bewegend licht per pixel'],['rgbw','RGBW','Eén kleur per receiver']].map(([k,t,s])=>`<button type="button" class="zf-opt" data-kind="${k}" aria-pressed="${kind===k}"><canvas data-kindprev="${k}" aria-hidden="true"></canvas><b>${t}</b><small>${s}</small></button>`).join('')}</div>`+
      `<button type="button" class="button full zf-go" data-nwnext>Verder</button>`;
    else if(step===1)h+=`<h2 class="zf-q">Hoe wil je het licht laten lopen?</h2><div class="zf-opts">${[['samen','1 ledline','Het licht loopt door van ledline naar ledline.'],['apart','Elke ledline apart','Elke ledline speelt voor zich.']].map(([k,t,s])=>
      `<button type="button" class="zf-opt" data-nmode="${k}" aria-pressed="${mode===k}"><canvas data-ex="${k}" aria-hidden="true"></canvas><b>${t}</b><small>${s}</small></button>`).join('')}</div><button type="button" class="button full zf-go" data-nwnext>Verder</button>`;
    else h+=`<h2 class="zf-q">Hoe hangen je ledlines?</h2><div class="zf-opts">${VIEWS[kind].map(([k,t,sub])=>
      `<button type="button" class="zf-opt" data-nview="${k}" aria-pressed="${view===k}"><canvas data-exv="${k}" aria-hidden="true"></canvas><b>${t}</b>${sub?`<small>${sub}</small>`:''}</button>`).join('')}</div><p class="zf-hint">${kind==='rgbw'?'Je kan het later aanpassen.':'Dit verandert alleen hoe het voorbeeld in de app eruitziet. Je kan het later aanpassen.'}</p><button type="button" class="button full zf-go" data-nwdone>Zone maken</button>`;
    box.innerHTML=h;
    const comet=effect('SPI','spi-comet-14'),wave=effect('RGBW','v30-tunnel-travel');
    box.querySelectorAll('[data-kindprev]').forEach(c=>play(c,()=>{const k=c.dataset.kindprev,zz={...demoZone(),kind:k,lines:k==='spi'?[{px:44},{px:44},{px:44}]:[{},{},{}]};return {receivers:receiversOf(zz,{sample:()=>stateFor(zz,zz,{forceAnim:k==='spi'?comet:effect('RGBW','v30-rgb-jumping')})}),...drawOpts(zz,{view:k==='spi'?'gewoon':'stack',mode:'samen'})};}));
    box.querySelectorAll('[data-ex]').forEach(c=>play(c,()=>{const zz=demoZone();return {receivers:receiversOf(zz,{sample:()=>stateFor(zz,zz,{forceAnim:comet})}),...drawOpts(zz,{view:'gewoon',mode:c.dataset.ex})};}));
    box.querySelectorAll('[data-exv]').forEach(c=>play(c,()=>{const zz=demoZone(),v=c.dataset.exv;return {receivers:receiversOf(zz,{sample:()=>stateFor(zz,zz,{forceAnim:kind==='spi'?comet:wave})}),...drawOpts(zz,{view:v,mode:kind==='rgbw'?'samen':mode})};}));};
  paintNew();
  box.addEventListener('input',e=>{if(e.target.matches('[data-name]'))name=e.target.value;});
  box.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;
    if(t.dataset.kind){kind=t.dataset.kind;view=kind==='rgbw'?'stack':'gewoon';paintNew();}
    else if(t.dataset.nmode){mode=t.dataset.nmode;paintNew();}else if(t.dataset.nview){view=t.dataset.nview;paintNew();}
    else if(t.hasAttribute('data-nwnext')){step=step===0&&kind==='rgbw'?2:step+1;paintNew();}
    else if(t.hasAttribute('data-nwdone')){const id='z'+Date.now().toString(36);
      S.zones.push({id,name:name.trim()||'Nieuwe zone',kind,on:true,view,mode:kind==='rgbw'?'samen':mode,lines:[],colours:['#FFFFFF'],whites:[0],move:null,moveSpeed:40,anim:null,speed:50,bright:100,loop:false,dirRev:false,warm:false,warmth:50,per:{},rcv:[],ordered:false});
      save();closeTop();openZone(id);toast('Zone gemaakt. Voeg nu een receiver toe.');}});}
// ---------- vellen ----------
let stack=[];
function sheet(cls,html){const el=document.createElement('div');el.className='zf-sheet '+cls;el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
  el.innerHTML=`<div class="zf-sheet-back" data-close></div><section class="zf-panel">${html}</section>`;document.body.append(el);stack.push(el);document.body.classList.add('zf-sheet-open');
  requestAnimationFrame(()=>el.classList.add('is-in'));el.addEventListener('click',e=>{if(e.target.closest('[data-close]'))closeTop();});return el;}
function closeTop(){const el=stack.pop();if(!el)return;el.classList.remove('is-in');el.classList.add('is-out');setTimeout(()=>el.remove(),reduce()?0:260);if(!stack.length)document.body.classList.remove('zf-sheet-open');}
function closeAll(){while(stack.length)closeTop();}
let undoT=0;
function undoToast(text,undo){let el=$('.zf-undo');if(!el){el=document.createElement('div');el.className='zf-undo';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.append(el);}
  el.innerHTML=`<span>${esc(text)}</span><button type="button">Ongedaan maken</button>`;el.hidden=false;requestAnimationFrame(()=>el.classList.add('is-in'));
  const hide=()=>{el.classList.remove('is-in');setTimeout(()=>{if(!el.classList.contains('is-in'))el.hidden=true;},250);};
  el.querySelector('button').onclick=()=>{clearTimeout(undoT);hide();undo();};clearTimeout(undoT);undoT=setTimeout(hide,5000);}
function removeSaved(i){const x=S.saved[i];if(!x)return;S.saved.splice(i,1);save();if(!S.saved.length)zf.editSaved=false;renderZone();
  undoToast(`${x.name} gewist`,()=>{S.saved.splice(Math.min(i,S.saved.length),0,x);save();renderZone();});}
function toast(t,ms=2600){const el=$('[data-toast]');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{el.hidden=true;},ms);}
// het voorbeeld groot (liggend of op een tablet nog groter)
let fullEl=null;
function openFull(){fullEl=sheet('zf-fullsheet','<div class="zf-fullbox" data-fullbox></div>');paintFull();}
function paintFull(){if(!fullEl)return;if(!fullEl.isConnected||!stack.includes(fullEl)){fullEl=null;return;}const z=zone(curZ);if(!z)return;
  fullEl.querySelector('[data-fullbox]').innerHTML=`<header class="zf-sh"><b>${esc(z.name)}</b><button type="button" class="zf-round" data-close aria-label="Sluiten">${IC.close}</button></header>`+stageHtml(z,{full:true});
  bindStage(fullEl,z);}
// ---------- klikken ----------
document.addEventListener('click',e=>{
  const sw=e.target.closest('[data-zon]');if(sw){e.stopPropagation();const z=zone(sw.dataset.zon);z.on=!z.on;save();document.querySelectorAll('[data-zon]').forEach(x=>{if(x.dataset.zon!==z.id)return;x.setAttribute('aria-checked',z.on);const t=x.querySelector('span');if(t)t.textContent=z.on?'Aan':'Uit';});
    if(curZ){$$('.zf-stage').forEach(st=>st.classList.toggle('is-off',!z.on));$$('[data-now]').forEach(now=>{now.textContent=nowLabel(z);});}return;}
  const op=e.target.closest('[data-open]');if(op){openZone(op.dataset.open);return;}
  const tb=e.target.closest('[data-tab]');if(tb){tab=tb.dataset.tab;renderZone();if(tb.classList.contains('zf-link'))scrollTo({top:0,behavior:reduce()?'auto':'smooth'});return;}
  const pk=e.target.closest('[data-select]');if(pk){if(pk.dataset.select==='all'){sel=[];point=0;const y=scrollY;renderZone();scrollTo({top:y});}else toggleSel(+pk.dataset.select);return;}
  const pt=e.target.closest('[data-point]');if(pt){point=+pt.dataset.point;renderZone();return;}
  const ct=e.target.closest('[data-chtoggle]');if(ct){const c0=curHex(),k=ct.dataset.chtoggle,cur=k==='w'?c0.w:rgbOf(c0.hex)['rgb'.indexOf(k)];channel(k,cur>0?0:255);return;}
  const cs=e.target.closest('[data-chstep]');if(cs){const c0=curHex(),k=cs.dataset.chstep,cur=k==='w'?c0.w:rgbOf(c0.hex)['rgb'.indexOf(k)];channel(k,cur+ +cs.dataset.d);return;}
  const pc=e.target.closest('[data-palette]');if(pc){openColourSheet('pal',+pc.dataset.palette);return;}
  const pd=e.target.closest('[data-paldel]');if(pd){const i=+pd.dataset.paldel;edit(zone(curZ),l=>{if(l.colours.length>1){l.colours.splice(i,1);l.whites?.splice(i,1);l.pos=null;}});point=0;renderZone();return;}
  const dr=e.target.closest('[data-dir]');if(dr){edit(zone(curZ),l=>{l.params={...(l.params||{}),direction:dr.dataset.dir};});renderZone();return;}
  const pt2=e.target.closest('[data-ptoggle]');if(pt2){const z=zone(curZ),a=effect(TYPE(z),target(z).anim),k=pt2.dataset.ptoggle;
    edit(z,l=>{const cur=!!((l.params||{})[k]??a?.state[k]);l.params={...(l.params||{}),[k]:!cur};if(k==='backgroundOn'&&!cur){if(!l.params.background)l.params.background=l.colours[1]||'#FFFFFF';if(l.params.bgBrightness===undefined)l.params.bgBrightness=PDEF.bgBrightness;}});renderZone();return;}
  const ti=e.target.closest('[data-tile]');if(ti){chooseAnim(ti.dataset.tile);return;}
  const md=e.target.closest('[data-mode]');if(md){const z=zone(curZ);z.mode=md.dataset.mode;if(z.mode==='samen')z.per={};sel=[];save();
    md.parentElement.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b===md));renderZone();return;}
  const mv=e.target.closest('[data-moveto]');if(mv){edit(zone(curZ),l=>{l.move=mv.dataset.moveto;});renderZone();return;}
  const gm=e.target.closest('[data-gmove]');if(gm){edit(zone(curZ),l=>{l.move=gm.dataset.gmove||null;});renderZone();return;}
  const at=e.target.closest('[data-advtab]');if(at){zf.advTab=at.dataset.advtab;zf.advOpen=true;const y=scrollY;renderZone();scrollTo({top:y});return;}
  const vw=e.target.closest('[data-viewto]');if(vw){const z=zone(curZ);z.view=vw.dataset.viewto;save();vw.parentElement.querySelectorAll('[data-viewto]').forEach(b=>b.setAttribute('aria-pressed',b===vw));renderZone();return;}
  const ds=e.target.closest('[data-delsaved]');if(ds){removeSaved(+ds.dataset.delsaved);return;}
  const se=e.target.closest('[data-savedit]');if(se){openSavedSheet(+se.dataset.savedit);return;}
  const sv=e.target.closest('[data-saved]');if(sv&&!sv.dataset.held){const s=S.saved[+sv.dataset.saved],z=zone(curZ);edit(z,l=>{l.colours=[...s.colours];l.whites=s.colours.map((_,i)=>s.whites?.[i]||0);l.pos=s.pos?[...s.pos]:null;if(s.colours.length<2)l.move=null;l.anim=null;});point=0;renderZone();return;}
  const gx=e.target.closest('[data-gexample]');if(gx){const pr=G.builtinPresets.find(x=>x.id===gx.dataset.gexample);if(pr){edit(zone(curZ),l=>{l.colours=pr.stops.map(x=>x.color.toUpperCase());l.whites=l.colours.map(()=>0);l.pos=pr.stops.map(x=>x.position);l.anim=null;});point=0;renderZone();}return;}
  const fl=e.target.closest('[data-flow]');if(fl){const z=zone(curZ);z.flow=fl.dataset.flow;save();fl.parentElement.querySelectorAll('[data-flow]').forEach(b=>b.setAttribute('aria-pressed',b===fl));return;}
  const stp=e.target.closest('[data-stop]');if(stp){point=+stp.dataset.stop;renderZone();return;}
  const a=e.target.closest('[data-action]');if(!a)return;const z=zone(curZ);
  ({back:()=>{closeAll();renderStand();scrollTo({top:0});},gear:openGear,full:openFull,library:openLibrary,viewopen:()=>{zf.viewOpen=true;const y=scrollY;renderZone();scrollTo({top:y});},seq:openSeq,seqon:()=>{const q=seqOf(z);q.on=!q.on;save();renderZone();},newzone:()=>{closeAll();openNew();},
    addcol:()=>{edit(z,l=>{const last=l.colours[l.colours.length-1],hsv=C.toHsv(rgbOf(last));l.colours.push(C.hex(C.hsv(hsv.h+55,Math.max(.6,hsv.s),1)));l.whites=[...(l.whites||[]),0].slice(0,l.colours.length);l.pos=null;});point=target(z).colours.length-1;renderZone();},
    delcol:()=>{edit(z,l=>{if(l.colours.length>1){const p=Math.min(point,l.colours.length-1);l.colours.splice(p,1);l.whites?.splice(p,1);l.pos=null;if(l.colours.length<2)l.move=null;}});point=0;renderZone();},
    move:()=>{edit(z,l=>{l.move=l.move?null:'schuif';});renderZone();},
    warm:()=>{z.warm=!z.warm;if(z.warm){edit(z,l=>{const p=Math.min(point,l.colours.length-1);l.colours[p]='#FFB46B';l.whites=l.whites||l.colours.map(()=>0);l.whites[p]=150;});}save();zf.moreOpen=true;renderZone();},
    dir:()=>{z.dirRev=!z.dirRev;save();renderZone();},loop:()=>{z.loop=!z.loop;if(z.loop)edit(z,l=>{if(l.colours.length>G.MAX_STOPS-1){l.colours=l.colours.slice(0,G.MAX_STOPS-1);l.whites=l.whites?.slice(0,G.MAX_STOPS-1);l.pos=null;}});save();renderZone();},
    even:()=>{edit(z,l=>{l.pos=null;});renderZone();},editsaved:()=>{zf.editSaved=!zf.editSaved;renderZone();},
    savecol:()=>{const l=target(z);S.saved.unshift({name:l.colours.length>1?'Mijn verloop':'Mijn kleur',colours:[...l.colours],whites:[...(l.whites||[])],...(l.colours.length>1&&!isEven(l)?{pos:[...posOf(l)]}:{})});save();renderZone();toast('Bewaard bij je kleuren.');},
    // naar de kiezer: de lijst van alle animaties net onder de balk bovenaan, met het zoekveld klaar
    tochooser:()=>{const L=document.querySelector('[data-libinline]');if(!L)return;const dock=document.querySelector('[data-dock]')?.getBoundingClientRect().bottom||0;
      scrollTo({top:Math.max(0,scrollY+L.getBoundingClientRect().top-dock-12),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      L.classList.remove('is-flash');void L.offsetWidth;L.classList.add('is-flash');},
    keepanim:()=>{const l=target(z);if(!l.anim)return;S.savedFrom=S.savedFrom||{};const on=savedHere(z,l.anim);
      if(on){S.savedAnims=S.savedAnims.filter(x=>x!==l.anim);delete S.savedFrom[l.anim];}else{S.savedAnims=[...S.savedAnims.filter(x=>x!==l.anim),l.anim];S.savedFrom[l.anim]=TYPE(z);}save();renderZone();if(S.savedAnims.includes(l.anim))toast('Bewaard. Je vindt hem bij Alle animaties.');},
    paladd:()=>{edit(z,l=>{const last=l.colours[l.colours.length-1],hsv=C.toHsv(rgbOf(last));l.colours.push(C.hex(C.hsv(hsv.h+55,Math.max(.6,hsv.s),1)));l.whites=[...(l.whites||[]),0].slice(0,l.colours.length);l.pos=null;});renderZone();openColourSheet('pal',target(z).colours.length-1);},
    bgcolour:()=>openColourSheet('bg'),
    resetparams:()=>{edit(z,l=>{const pm=l.params||{};l.params=Object.fromEntries(Object.entries(pm).filter(([k])=>!ADV.some(x=>x[0]===k)));});renderZone();},
    stopanim:()=>{edit(z,l=>{l.anim=null;});tab='kleur';renderZone();},
    order:()=>{S.orderFor=z.id;save();const q=new URLSearchParams({uitleg:'0',return:'zone',zone:z.name});if(z.kind==='rgbw')q.set('rgbw','1');location.href=`../ketting-leggen/index.html?${q}`;},
    moveRcv:()=>toast('Verplaatsen gaat via de Receivers-tab.'),
    intro:()=>{if(TUT)return;const kind=zone(curZ)?.kind==='rgbw'?'rgbw':'spi';closeAll();window.ZfIntro?.open(kind);},
    intropro:()=>{if(TUT)return;const rg=zone(curZ)?.kind==='rgbw';closeAll();window.ZfIntro?.open(rg?'prorgbw':'pro');},
    nav:()=>{if(a.dataset.id!=='stand')toast('In dit prototype werkt alleen de Stand-tab.');else{closeAll();renderStand();}}})[a.dataset.action]?.();});
// schuiven: helderheid, snelheid, warmte, en de kanalen R G B W
document.addEventListener('input',e=>{const t=e.target;if(t.matches('input[type=range]'))fill(t);if(!curZ)return;const z=zone(curZ);
  if(t.matches('[data-channel]'))return channel(t.dataset.channel,+t.value);
  if(t.matches('[data-param]')){const k=t.dataset.param,v=+t.value;edit(z,l=>{l.params={...(l.params||{}),[k]:v};});const o=$(`[data-pout="${k}"]`);if(o)o.textContent=pfmt(v,o.dataset.unit);return;}
  const r=t.closest('[data-range]');if(!r)return;const k=r.dataset.range;z[k]=+r.value;save();$$(`[data-out="${k}"]`).forEach(o=>o.textContent=`${z[k]}%`);});
document.addEventListener('change',e=>{if(stopped&&e.target.matches('[data-channel]')){stopped=false;const y=scrollY;renderZone();scrollTo({top:y});return;}if(e.target.matches('[data-chnum]'))channel(e.target.dataset.chnum,+e.target.value);});
document.addEventListener('toggle',e=>{if(e.target.matches?.('.zf-adv'))zf.advOpen=e.target.open;else if(e.target.matches?.('.zf-more'))zf.moreOpen=e.target.open;},true);
// lang indrukken op een bewaarde kleur: naam wijzigen, vooraan zetten of wissen
// kleuren verslepen naar een andere plaats: de kleuren van een verloop, de animatiekleuren en (bij Wijzigen) de bewaarde kleuren
const DRAGS=[['.zf-points','[data-point]',(from,to)=>{edit(zone(curZ),l=>{moveIn(l.colours,from,to);if(l.whites)moveIn(l.whites,from,to);l.pos=null;});point=to;}],
  ['.zf-palette','.zf-palitem',(from,to)=>{edit(zone(curZ),l=>{moveIn(l.colours,from,to);if(l.whites)moveIn(l.whites,from,to);l.pos=null;});}],
  ['.zf-saved.is-editing .zf-bubbles','.zf-bub.is-edit',(from,to,items)=>{const a=+items[from].querySelector('[data-savedit]').dataset.savedit,b=+items[to].querySelector('[data-savedit]').dataset.savedit;moveIn(S.saved,a,b);save();}]];
function moveIn(arr,from,to){if(!arr||from===to||from<0||to<0||from>=arr.length||to>=arr.length)return;arr.splice(to,0,arr.splice(from,1)[0]);}
let drag=null,dragDone=0;
document.addEventListener('pointerdown',e=>{if(e.button)return;for(const [box,item,apply] of DRAGS){const el=e.target.closest(item),host=el?.closest(box);if(!el||!host||e.target.closest('.zf-x'))continue;
  const items=[...host.querySelectorAll(item)];if(items.length<2)return;drag={el,items,from:items.indexOf(el),apply,x:e.clientX,y:e.clientY,on:false,id:e.pointerId};return;}});
document.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.on){if(Math.hypot(dx,dy)<6)return;drag.on=true;clearTimeout(pressT);drag.to=drag.from;
    // de plaatsen zoals ze nu staan: de andere kleuren schuiven straks naar deze plaatsen op
    drag.slots=drag.items.map(it=>{const r=it.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
    drag.items.forEach(it=>it.classList.toggle('is-shifting',it!==drag.el));drag.el.classList.add('is-dragging');document.body.classList.add('zf-dragging');}
  e.preventDefault();drag.el.style.transform=`translate(${dx}px,${dy}px) scale(1.14)`;
  // de dichtste plaats wint: je hoeft niet precies op een andere kleur te mikken
  const cx=drag.slots[drag.from].x+dx,cy=drag.slots[drag.from].y+dy;let best=drag.from,bd=1e9;
  drag.slots.forEach((p,k)=>{const d=Math.hypot(cx-p.x,cy-p.y);if(d<bd){bd=d;best=k;}});
  if(best===drag.to)return;drag.to=best;
  const order=drag.items.map((_,k)=>k);order.splice(drag.to,0,order.splice(drag.from,1)[0]);
  order.forEach((k,n)=>{if(k===drag.from)return;const a=drag.slots[k],b=drag.slots[n];drag.items[k].style.transform=n===k?'':`translate(${b.x-a.x}px,${b.y-a.y}px)`;});},{passive:false});
const endDrag=e=>{if(!drag||(e.pointerId!==undefined&&e.pointerId!==drag.id))return;const d=drag;drag=null;if(!d.on)return;document.body.classList.remove('zf-dragging');dragDone=performance.now();
  if(d.to!==undefined&&d.to!==d.from)d.apply(d.from,d.to,d.items);const y=scrollY;renderZone();scrollTo({top:y});};
document.addEventListener('pointerup',endDrag);document.addEventListener('pointercancel',endDrag);
document.addEventListener('click',e=>{if(performance.now()-dragDone<350){e.stopPropagation();e.preventDefault();}},true);
function openSavedSheet(i){const x=S.saved[i];if(!x)return;
  const el=sheet('zf-held',`<header class="zf-sh"><div class="zf-heldhead"><i style="--k:${swatchOf(x)}"></i><b>${esc(x.name)}</b></div><button type="button" class="zf-round" data-close aria-label="Sluiten">${IC.close}</button></header>`+
    `<label class="zf-field"><span>Naam</span><input data-rename value="${esc(x.name)}" autocomplete="off"></label><div class="zf-heldbtns"><button type="button" class="button secondary" data-first>Vooraan zetten</button><button type="button" class="button secondary" data-del>Wissen</button></div>`);
  el.querySelector('[data-rename]').addEventListener('change',ev=>{x.name=ev.target.value.trim()||x.name;save();renderZone();});
  el.querySelector('[data-first]').addEventListener('click',()=>{S.saved.splice(S.saved.indexOf(x),1);S.saved.unshift(x);save();closeTop();renderZone();});
  el.querySelector('[data-del]').addEventListener('click',()=>{closeTop();removeSaved(S.saved.indexOf(x));});}
let pressT=0;document.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-saved]');if(!b)return;clearTimeout(pressT);
  pressT=setTimeout(()=>{b.dataset.held='1';setTimeout(()=>delete b.dataset.held,450);openSavedSheet(+b.dataset.saved);},550);});
document.addEventListener('pointerup',()=>clearTimeout(pressT));document.addEventListener('pointercancel',()=>clearTimeout(pressT));
document.addEventListener('contextmenu',e=>{if(e.target.closest('[data-saved]'))e.preventDefault();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&stack.length)closeTop();});
// ---------- start ----------
document.body.classList.add('zf-app');
const darkQuery=matchMedia('(prefers-color-scheme: dark)');
function setTheme(){const d=darkQuery.matches;document.body.dataset.theme=d?'dark':'light';document.documentElement.classList.toggle('c109-dark',d);}
setTheme();darkQuery.addEventListener?.('change',setTheme);
const QS=new URLSearchParams(location.search);
if(QS.get('test')==='1')$('.zf-proto').hidden=false;
$('.zf-proto')?.addEventListener('click',e=>{const b=e.target.closest('[data-proto]');if(!b)return;closeAll();
  if(b.dataset.proto==='reset'){S=copy(START);save();sel=[];openZone('flex');toast('Opnieuw begonnen.');}
  if(b.dataset.proto==='spi')openZone('flex');
  if(b.dataset.proto==='rgbw')openZone('tunnel');
  if(b.dataset.proto==='new')openNew();
  if(b.dataset.proto==='rgbw2'){const z=zone('tunnel');if(z){z.lines=z.lines.slice(0,2);z.ordered=false;z.mode='samen';z.per={};save();openZone('tunnel');tunnelPopup();}}});
// C145p: na de 2e RGBW-receiver: "Nu kan je looplicht maken", dan de volgorde
function tunnelPopup(){const z=zone('tunnel');const el=sheet('zf-pop',`<div class="zf-popbody"><canvas data-popprev aria-hidden="true"></canvas><b class="zf-q">Nu kan je looplicht maken</b><p>Je zone heeft 2 RGBW-receivers. Zet de volgorde, dan loopt het licht van receiver naar receiver.</p>`+
  `<button type="button" class="button full zf-go" data-action="order">Volgorde zetten</button><button type="button" class="zf-later" data-close>Later</button></div>`);
  play(el.querySelector('[data-popprev]'),()=>({receivers:receiversOf(z,{sample:()=>stateFor(z,z,{forceAnim:effect('RGBW','v30-tunnel-travel')})}),...drawOpts(z,{view:'verticaal',mode:'samen'})}));}
const zq=QS.get('zone');
const back=(zq&&S.zones.find(z=>z.name===zq))||(QS.get('ordered')==='1'&&S.orderFor&&zone(S.orderFor))||null;
if(QS.get('ordered')==='1'){delete S.orderFor;save();}
if(back){if(QS.get('ordered')==='1'){back.ordered=true;save();}openZone(back.id);if(QS.get('ordered')==='1')toast(back.kind==='rgbw'?'Volgorde bewaard. Looplicht staat klaar.':'Looprichting bewaard.');}
else if(QS.get('start')==='stand')renderStand();else openZone('flex');
// de tutorial opent vanzelf de eerste keer dat je een zone opent (daarna via "Bekijk tutorial" in het tandwiel)
// Een tutorial start nooit vanzelf (afspraak 12 nov, tutorial-ask.js van de app): de eerste keer dat je een zone opent,
// vraagt de pagina het één keer per soort zone; daarna is er de knop in het tandwiel.
const askTutorial=()=>{const z=zone(curZ);if(!z||TUT||QS.get('uitleg')||!window.ZfIntro||document.querySelector('.ki:not([hidden])'))return;   // niet vragen als er al een tutorial speelt
  const kind=z.kind==='rgbw'?'rgbw':'spi';
  if(ZfIntro.seenBefore(kind))return;window.LightningTutorialAsk?.ask('zone-'+kind,{onYes:()=>ZfIntro.open(kind)});};
if(curZ)setTimeout(askTutorial,700);
document.addEventListener('click',e=>{if(e.target.closest('[data-open]'))setTimeout(askTutorial,600);});
if(QS.get('uitleg'))setTimeout(()=>{const k=QS.get('uitleg');if(window.ZfIntro?.kinds.includes(k))ZfIntro.open(k);},400);
window.__zf={reset:()=>{S=copy(START);save();sel=[];point=0;tab='kleur';zf.editSaved=false;zf.advOpen=false;zf.moreOpen=false;wheelFor=null;while(stack.length){const el=stack.pop();el.remove();}document.body.classList.remove('zf-sheet-open');openZone('flex');},
  setColour:hex=>{wheelFor=null;setColour(hex);},S:()=>S,openZone,renderStand,openGear,openLibrary,openNew,openFull,closeAll,tunnelPopup,setTab:t=>{tab=t;renderZone();},select:i=>{sel=Array.isArray(i)?i:[i];renderZone();},
  choose:chooseAnim,stateFor,receiversOf,drawOpts,effect,CATALOG,mainSpec,play};
})();
