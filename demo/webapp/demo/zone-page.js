/* Aluvision: de nieuwe zonepagina (C250; prototype prototypes/zone-facelift, goedgekeurd door de eigenaar 13-14 nov 2026:
 * "Graag alle nieuwe dingen nu echt in de app bouwen ... zone pagina tutorials etc").
 * Alleen in de tester (tester-preview.js, onderdeel zone-page) tot de eigenaar het ook op toestellen wil.
 *
 * De pagina is een nieuwe indeling rond de échte onderdelen van de app. Alles wat licht verandert, gaat via de bestaande
 * acties van app.js (data-action: power, select, colour, animations, effect, set-layout, …) en dus via dezelfde weg naar de
 * receivers als de oude zonepagina. Dit bestand stuurt zelf niets naar een receiver.
 *  - bovenaan (blijft staan bij scrollen): terug, naam, badge SPI/RGBW, aan/uit, tandwiel;
 *    het voorbeeld met gladde lijnen (zone-lines.js); onderaan in het voorbeeld Horizontaal/Verticaal, Alle en volledig
 *    scherm, zonder tekst; daaronder de tabs Kleur · Animaties;
 *  - het tandwiel ("Ledlines in deze zone"): Looprichting, Licht (1 ledline of Apart), Weergave, Receivers in deze zone.
 * Horizontaal/Verticaal: bij Apart is dat de opstelling van de zone (stacked of vertical, zoals de oude app bewaarde).
 * Bij 1 ledline (continuous) is verticaal alleen hoe het voorbeeld eruitziet; dat onthoudt dit toestel (localStorage).
 */
(function(root){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduce=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}};
const path=d=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const IC={
  back:path('m14 6-6 6 6 6M8 12h13'),chev:path('m9 5 7 7-7 7'),close:path('m6 6 12 12M6 18 18 6'),expand:path('M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5'),
  sun:path('M12 2v2M12 20v2M2 12h2M20 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0'),anim:path('M3 9v6M7 5v14M12 2v20M17 6v12M21 9v6'),
  plus:path('M12 5v14M5 12h14'),check:path('m5 12 4 4L19 6'),play:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>',
  selectAll:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 4.5h10a2 2 0 0 1 2 2v10"/><rect x="4.5" y="7.5" width="12" height="12" rx="2.6"/><path d="m7.6 13.6 2.2 2.2 4.1-4.6"/></svg>',
  gear:'<svg class="icon icon-gear" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.61 9.53L21.85 10.26L21.85 13.74L19.61 14.47L19.13 15.63L20.19 17.74L17.74 20.19L15.63 19.13L14.47 19.61L13.74 21.85L10.26 21.85L9.53 19.61L8.37 19.13L6.26 20.19L3.81 17.74L4.87 15.63L4.39 14.47L2.15 13.74L2.15 10.26L4.39 9.53L4.87 8.37L3.81 6.26L6.26 3.81L8.37 4.87L9.53 4.39L10.26 2.15L13.74 2.15L14.47 4.39L15.63 4.87L17.74 3.81L20.19 6.26L19.13 8.37Z"/><circle cx="12" cy="12" r="3.2"/></svg>',
  // Looprichting: het icoon van de app (drie blokjes waarvan de kleur doorloopt)
  direction:`<svg class="zf-oic" viewBox="0 0 48 24" aria-hidden="true"><defs><linearGradient id="zf-oic-g" x1="0" x2="48" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2F6BFF"/><stop offset=".26" stop-color="#2F6BFF"/><stop offset=".4" stop-color="#FFC61A"/><stop offset=".6" stop-color="#FFC61A"/><stop offset=".74" stop-color="#9B4DFF"/><stop offset="1" stop-color="#9B4DFF"/></linearGradient></defs><g fill="url(#zf-oic-g)"><rect x="1" y="7" width="13.5" height="10" rx="2.4"/><rect x="17.25" y="7" width="13.5" height="10" rx="2.4"/><rect x="33.5" y="7" width="13.5" height="10" rx="2.4"/></g><rect class="zf-oic-run" x="-10" y="7" width="8" height="10" rx="2.4" fill="#fff" opacity=".55"/></svg>`,
  receiver:path('M5.5 11h13a2.5 2.5 0 0 1 2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-3A2.5 2.5 0 0 1 5.5 11ZM7 15h.01M11 15h1.5M15 15h2M9.5 7.6a3.6 3.6 0 0 1 5 0M7.2 5.2a6.9 6.9 0 0 1 9.6 0'),
  link:path('M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1'),
  unlink:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 15.5 8 17a3.5 3.5 0 0 1-5-5l1.5-1.5M14.5 8.5 16 7a3.5 3.5 0 0 1 5 5l-1.5 1.5M8 3.5v2.5M3.5 8H6M16 20.5V18M20.5 16H18"/></svg>'};
const IC2={search:path('M11 4.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13ZM16 16l4.5 4.5'),star:path('m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8-4.3-4.1 5.9-.8z')};
const vic=d=>`<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const lit=d=>vic(`<g stroke-width="2.7">${d}</g>`);
// de icoontjes tonen ledlines zoals ze hangen (de eigenaar 13 nov: "een mooier icoontje")
const VICON={h:lit('<path d="M4.5 7h11M4.5 12h15M4.5 17h8"/>'),v:lit('<path d="M7 19.5v-11M12 19.5v-15M17 19.5v-8"/>'),
  samen:vic('<g stroke-width="2.4"><path d="M3 12h16.5"/><path d="m15.5 8 4 4-4 4"/></g>'),apart:lit('<path d="M3.5 12h3.5M10.25 12h3.5M17 12h3.5"/>')};
const GIC={licht:VICON.samen,weergave:path('M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12ZM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z'),
  receivers:IC.receiver,samenvoegen:IC.link};
const gh=(k,t)=>`<h3><i class="zf-gic" aria-hidden="true">${GIC[k]}</i>${t}</h3>`;
const kindBadge=type=>`<span class="zf-kind" data-kind="${type==='RGBW'?'rgbw':'spi'}">${type==='RGBW'?'RGBW':'SPI'}</span>`;
const lineWord=(rgbw,n)=>rgbw?(n===1?'receiver':'receivers'):(n===1?'ledline':'ledlines');
// het bewegende beeldje bij 1 ledline / Apart: drie ledlines; samen loopt één licht door, apart elk een eigen licht
const modePic=k=>`<span class="zp-modepic is-${k}" aria-hidden="true"><i><b></b></i><i><b></b></i><i><b></b></i></span>`;
const viewPic=k=>`<span class="zp-viewpic is-${k}" aria-hidden="true"><i></i><i></i><i></i></span>`;

// ---------- Animaties (de eigenaar 13 nov: "als je op Animaties duwt, wil ik dat je direct alle animaties ziet") ----------
// Looplicht (in de app nog de categorie 'tunnel'): het licht loopt van ledline naar ledline. Het woord "Tunnel" vooraan
// een naam valt weg. Kan een animatie hier nog niet (te weinig ledlines), dan staat ze grijs met "vanaf 2".
const GROUP={whole:'Kleur & sfeer',gradient:'Verloop',pixels:'Bewegend licht',tunnel:'Looplicht'};
const groupOf=c=>Object.hasOwn(GROUP,c)?c:'pixels';
const noTunnel=x=>String(x).replace(/^Tunnel\s+(\S)/i,(_,c)=>c.toUpperCase());
const LOOP='<i class="zf-loop" aria-hidden="true"><b></b><b></b><b></b></i>';
const loopHead=(rgbw,n)=>`<p class="zf-loophead">${LOOP}<span>Het licht loopt van ${rgbw?'receiver naar receiver':'ledline naar ledline'}.${n<2?`<small>Vanaf 2 ${rgbw?'receivers':'ledlines'}.</small>`:''}</span></p>`;
const lib={g:'alles',q:'',sort:'soort'};
const RECENT='aluvision.zonePage.recent';
const recent=()=>{try{return JSON.parse(root.localStorage.getItem(RECENT)||'[]').filter(x=>typeof x==='string');}catch(_){return [];}};
const remember=id=>{try{root.localStorage.setItem(RECENT,JSON.stringify([id,...recent().filter(x=>x!==id)].slice(0,12)));}catch(_){}};
// ---------- 15 nov: de animatiekiezer A1 en de volle pagina met instellingen (prototype ideeen-animaties-instellingen
// U4/U5, de eigenaar: "nu alles inwerken"). Tegels in een raster met filters bovenaan; wat speelt staat in de speler onderaan;
// tik op de speler (of op de tegel die speelt) en alle instellingen openen over het hele scherm, elk met een bewegend
// icoontje dat meedoet met de schuif. Alles gaat via de bestaande acties van app.js.
let a1Open=false,a1Zone=null,a1Adv=false;
const a1New=()=>!!root.LightningStandHome;
const SL='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>';
const CHEV='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
const BACK='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>';
const STAR='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/></svg>';
// een bewegend icoontje: een donker vakje met een lijntje, en daarop wat de instelling doet (--v = de schuif, 0..1)
const DOTS={objectCount:3,spacing:2,mirror:2,lineDelayMs:3,spread:3,randomness:3,colours:3};
const siIcon=(k,n)=>`<span class="alv-si" data-k="${k}" aria-hidden="true">${'<i></i>'.repeat(k==='objectCount'?Math.max(1,Math.min(8,n||1)):DOTS[k]||1)}</span>`;
// de tegels per soort onder een kopje, in de volgorde van GROUP (de eigenaar 15 nov, iPhone 978: "graag de animaties per
// soort groeperen, nu staat alles in 1 lijst")
function a1Grid(all,tile){
  const cats=Object.keys(GROUP).filter(k=>all.some(e=>groupOf(e.category)===k));
  return `<div class="zp-a1wrap" data-zp-a1 data-zp-list>${cats.map(k=>`<section class="zp-a1sec" data-zp-a1sec="${k}"><h4 class="zp-a1cat">${esc(GROUP[k])}<small>${all.filter(e=>groupOf(e.category)===k).length}</small></h4>`+
    `<div class="zp-a1grid">${all.filter(e=>groupOf(e.category)===k).map(tile).join('')}</div></section>`).join('')}</div>`;
}
function a1Html(d){
  const a=d.anim,n=d.lineCount,cur=a.current?.id,all=a.families.flatMap(f=>f.effects);
  if(a1Zone!==d.id){a1Zone=d.id;a1Open=false;}
  if(!cur)a1Open=false;
  const cats=['alles',...Object.keys(GROUP).filter(k=>all.some(e=>groupOf(e.category)===k)),'bewaard'];
  if(!cats.includes(lib.g))lib.g='alles';
  const tile=e=>{const name=noTunnel(e.name),on=cur===e.id,later=n<e.need;
    return `<button type="button" class="zp-a1tile${on?' is-on':''}" ${later?'disabled':on?'data-zp="a1settings"':`data-action="effect" data-id="${esc(e.id)}"`} data-zp-tile="${esc(e.id)}" data-zp-cat="${groupOf(e.category)}" data-zp-name="${esc(name.toLowerCase())}" aria-pressed="${on}">`+
      `<span class="zp-a1tv">${e.preview}${later?`<em class="zf-from">vanaf ${e.need}</em>`:''}${on?'<i class="zp-a1on">Speelt</i>':''}</span><b>${esc(name)}</b></button>`;};
  let h=`<div class="zp-a1chips" data-zp-groups>${cats.map(k=>`<button type="button" data-zp-g="${k}" aria-pressed="${lib.g===k}">${k==='alles'?'Alles':k==='bewaard'?'★ Bewaard':esc(GROUP[k])}</button>`).join('')}</div>`+
    a1Grid(all,tile)+
    `<div class="zp-saved zp-a1saved" data-zp-saved hidden>${a.savedCount?a.saved:'<p class="zf-none">Nog niets bewaard. Tik op de ster bij een animatie die speelt.</p>'}</div>`;
  if(a.current){const e=all.find(x=>x.id===cur);
    h+=`<button type="button" class="zp-player" data-zp="a1settings" aria-label="Instellingen van ${esc(noTunnel(a.current.name))}"><span class="zp-pv">${e?e.preview:''}</span><span class="zp-pt"><small>Speelt nu · ${esc(d.name)}</small><b>${esc(noTunnel(a.current.name))}</b></span><span class="zp-pbtn" aria-hidden="true">${SL}</span></button>`;
    if(a1Open&&a.settings)h+=a1Settings(d,e);}
  return h;
}
function a1Row(k,n){const v=(k.value-k.min)/((k.max-k.min)||1);
  return `<div class="slider-row zp-set" data-zp-set="${k.key}" style="--v:${v.toFixed(3)}">${siIcon(k.key,k.key==='objectCount'?k.value:0)}<div class="zp-setb"><label for="zp-a1-${k.key}"><b>${esc(k.label)}</b><output data-value-for="${k.key}">${k.value}${esc(k.unit)}</output></label>`+
    `<input id="zp-a1-${k.key}" type="range" min="${k.min}" max="${k.max}" step="1" value="${k.value}" data-setting="${k.key}" data-unit="${esc(k.unit)}" style="--fill:${(v*100).toFixed(1)}%"></div></div>`;}
function a1Toggle(k,label,on){return `<div class="zp-set is-row${on?' is-on':''}">${siIcon(k)}<div class="zp-setb is-row"><b>${esc(label)}</b><button type="button" class="switch zp-sw" role="switch" data-action="effect-boolean" data-id="${k}" aria-pressed="${on}" aria-checked="${on}"><b hidden>${on?'Aan':'Uit'}</b><i aria-hidden="true"></i></button></div></div>`;}
function a1Settings(d,e){
  const a=d.anim,s=a.settings,name=noTunnel(a.current.name),g=x=>s.keys.filter(k=>k.group===x);
  const meer=g('meer'),vorm=g('vorm');
  return `<div class="zp-a1set" role="dialog" aria-modal="true" aria-label="Instellingen van ${esc(name)}">`+
    `<div class="zp-a1head"><button type="button" class="zp-k1back" data-zp="a1close" aria-label="Terug">${BACK}</button><div class="zf-title"><small class="zp-a1kick">${esc(d.name)} · speelt nu</small><b>${esc(name)}</b></div>`+
      `<button type="button" class="zp-a1star" data-action="preset-save" aria-label="Bewaar deze animatie">${STAR}</button></div>`+
    `<div class="zp-a1hero${d.canTap?' is-lines':''}">${d.preview||(e?e.preview:'')}</div>`+
    `<h3 class="zp-a1gh">Licht</h3><section class="zp-a1card">${g('licht').map(a1Row).join('')}</section>`+
    (s.palette.length||s.bg?`<h3 class="zp-a1gh">Kleuren</h3><section class="zp-a1card">`+
      (s.palette.length?`<div class="zp-set is-row" style="--c1:${s.palette[0]};--c2:${s.palette[1]||s.palette[0]};--c3:${s.palette[2]||s.palette[0]}">${siIcon('colours')}<div class="zp-setb is-row"><b>Kleuren</b><div class="zp-cols">${s.palette.map((c,i)=>`<button type="button" class="zp-col" data-action="palette-edit" data-id="${i}" style="--c:${c}" aria-label="Kleur ${i+1} wijzigen"></button>`).join('')}${s.canAdd?'<button type="button" class="zp-col is-add" data-action="palette-add" aria-label="Kleur toevoegen">+</button>':''}</div></div></div>`:'')+
      (s.bg?`<div class="zp-set is-row${s.bg.on?' is-on':''}">${siIcon('background')}<div class="zp-setb is-row"><b>Achtergrond</b><button type="button" class="zp-col is-bg" data-action="background-edit" style="--c:${s.bg.hex}" aria-label="Achtergrondkleur kiezen"></button><button type="button" class="switch zp-sw" role="switch" data-action="background-toggle" aria-checked="${s.bg.on}"><i aria-hidden="true"></i></button></div></div>`:'')+`</section>`:'')+
    (s.dirs.length||s.bounce||s.mirror?`<h3 class="zp-a1gh">Richting</h3><section class="zp-a1card">`+
      (s.dirs.length||s.bounce?`<div class="zp-dirs" role="group" aria-label="Richting">${s.dirs.map(x=>`<button type="button" data-action="direction" data-value="${esc(x.value)}" aria-pressed="${x.on&&!s.bounce?.on}"><span class="zp-dv" data-d="${esc(x.value)}" aria-hidden="true"><i></i><i></i></span><small>${esc(x.label)}</small></button>`).join('')}`+
        (s.bounce&&!s.dirs.some(x=>x.value==='bounce')?`<button type="button" data-action="effect-boolean" data-id="bounce" data-zp-bounce aria-pressed="${s.bounce.on}"><span class="zp-dv" data-d="bounce" aria-hidden="true"><i></i><i></i></span><small>Heen en weer</small><b hidden>${s.bounce.on?'Aan':'Uit'}</b></button>`:'')+`</div>`:'')+(s.mirror?a1Toggle('mirror','Van beide kanten',s.mirror.on):'')+`</section>`:'')+
    (d.zoneOrder?`<h3 class="zp-a1gh">Zo loopt het</h3><section class="zp-a1card">${d.zoneOrder}</section>`:'')+
    (vorm.length?`<h3 class="zp-a1gh">Vorm van het licht</h3><section class="zp-a1card">${vorm.map(a1Row).join('')}</section>`:'')+
    (meer.length||(s.tunnel&&s.lines>1)||d.seqCard?`<h3 class="zp-a1gh">Geavanceerd</h3><section class="zp-a1card zp-adv${a1Adv?' is-open':''}"><button type="button" class="zp-advhead" data-zp="a1adv" aria-expanded="${a1Adv}"><span class="zp-setb"><b>Meer instellingen</b><small>${esc([...meer.map(k=>k.label),...(s.lines>1?['Volgorde']:[]),...(d.seqCard?['Eigen timing']:[])].slice(0,3).join(' · '))}</small></span><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button><div class="zp-advbody">${meer.map(a1Row).join('')}`+
      (s.lines>1?`<button type="button" class="zp-a1row" data-zp="order">${siIcon('direction')}<span class="zp-setb"><b>Volgorde van de ledlines</b><small>Waar het licht begint en hoe het loopt</small></span>${CHEV}</button>`:'')+
      (d.seqCard||'')+`</div></section>`:'')+
    `<button type="button" class="zp-a1reset" data-zp="a1reset">↺ Alles terug zoals het was</button><div class="zp-a1spacer" aria-hidden="true"></div>`+
    `<div class="zp-a1done"><button type="button" data-zp="a1close">Klaar</button></div></div>`;
}
function standA1Html(d){
  const a=d.anim,cur=a.current?.id,all=(a.families||[]).flatMap(f=>f.effects);
  if(a1Zone!==d.id){a1Zone=d.id;a1Open=false;}
  if(!cur){a1Open=false;return '';}
  const e=all.find(x=>x.id===cur);
  return `<button type="button" class="zp-player" data-zp="a1settings" aria-label="Instellingen van ${esc(noTunnel(a.current.name))}"><span class="zp-pv">${e?e.preview:''}</span><span class="zp-pt"><small>Speelt nu · ${esc(d.name)}</small><b>${esc(noTunnel(a.current.name))}</b></span><span class="zp-pbtn" aria-hidden="true">${SL}</span></button>`+
    (a1Open&&a.settings?a1Settings(d,e):'');
}
function animHtml(d){
  if(a1New())return a1Html(d);
  const a=d.anim,rgbw=d.type==='RGBW',n=d.lineCount,cur=a.current?.id;
  let h='';
  if(a.current)h+=`<section class="card zf-card zf-playing zp-playing"><header class="zf-cardhead"><div><small class="zf-kicker">Speelt nu</small><h2>${esc(noTunnel(a.current.name))}</h2></div>`+
    `<button type="button" class="zf-round zf-star" data-action="preset-save" aria-label="Bewaar deze animatie">${IC2.star}</button></header>`+
    `<button type="button" class="zf-tochooser" data-zp="tochooser"><span class="zf-tochooser-ic">${IC2.search}</span><b>Andere animatie</b><small>Naar de kiezer</small>${IC.chev}</button></section>`+
    `<div class="zp-editor">${a.editor}</div>`+(a.current.category==='tunnel'&&d.seqCard?d.seqCard:'');
  return h+libHtml(a,n,rgbw);
}
// de animatiekiezer: tegels per familie, groepen, zoeken en sorteren (zonepagina en Alles bedienen)
function libHtml(a,n,rgbw){
  const cur=a.current?.id;let h='';
  const all=a.families.flatMap(f=>f.effects),ok=all.filter(e=>n>=e.need);
  const cats=['alles',...Object.keys(GROUP).filter(k=>all.some(e=>groupOf(e.category)===k)),'bewaard'];
  const count=k=>k==='alles'?ok.length:k==='bewaard'?a.savedCount:ok.filter(e=>groupOf(e.category)===k).length;
  const later=k=>k==='tunnel'&&!ok.some(e=>groupOf(e.category)===k);
  const tile=e=>{const name=noTunnel(e.name),on=cur===e.id,attrs=`data-zp-tile="${esc(e.id)}" data-zp-cat="${groupOf(e.category)}" data-zp-name="${esc(name.toLowerCase())}"`;
    return n<e.need?`<button type="button" class="zf-var is-later" disabled ${attrs} aria-label="${esc(name)}: vanaf ${e.need} ${lineWord(rgbw,2)}"><span class="zf-varcv">${e.preview}<em class="zf-from">vanaf ${e.need}</em></span><b>${esc(name)}</b></button>`
      :`<button type="button" class="zf-var${on?' is-on':''}" data-action="${on?'animation-current-edit':'effect'}" data-id="${esc(e.id)}" ${attrs} aria-pressed="${on}"><span class="zf-varcv">${e.preview}${on?`<i class="zf-tick">${IC.check}</i>`:''}</span><b>${esc(name)}</b></button>`;};
  h+=`<section class="zf-libinline" data-zp-lib><header class="zf-sechead"><h3>${a.current?'Andere animatie':'Kies een animatie'}</h3><small>Na het kiezen in jouw kleuren</small></header>`+
    `<label class="zf-search">${IC2.search}<input type="search" placeholder="Zoek een animatie" data-zp-q value="${esc(lib.q)}" autocomplete="off"></label>`+
    `<div class="zf-groups" data-zp-groups>${cats.map(k=>`<button type="button" data-zp-g="${k}" aria-pressed="${lib.g===k}"${later(k)?' class="is-later"':''}>${k==='alles'?'Alles':k==='bewaard'?'Bewaard':GROUP[k]}<small>${later(k)?'vanaf 2':count(k)}</small></button>`).join('')}</div>`+
    `<div class="zf-sortbar"><span>Sorteren</span><div class="zf-sort" role="group" aria-label="Sorteren">${[['soort','Per soort'],['az','A–Z'],['recent','Laatst gebruikt']].map(([k,t])=>`<button type="button" data-zp-sort="${k}" aria-pressed="${lib.sort===k}">${t}</button>`).join('')}</div></div>`+
    `<div class="zf-list" data-zp-list>`;
  let last='';
  for(const f of a.families){const cat=groupOf(f.effects[0].category);
    if(cat!==last){h+=`<h4 class="zf-cathead" data-zp-cathead="${cat}">${GROUP[cat]}</h4>`+(cat==='tunnel'?`<div data-zp-loophead="in">${loopHead(rgbw,n)}</div>`:'');last=cat;}
    h+=`<section class="zf-fam${f.effects.some(e=>e.id===cur)?' has-current':''}" data-zp-fam="${cat}"><header><b>${esc(noTunnel(f.title||'Animaties'))}</b><small>${f.effects.length===1?'1 animatie':f.effects.length+' varianten'}</small></header>`+
      `<div class="zf-famrow">${f.effects.map(tile).join('')}</div></section>`;}
  h+=`<div class="zf-famrow zp-flat" data-zp-flat hidden></div><div data-zp-loophead="top" hidden>${loopHead(rgbw,n)}</div>`+
    `<p class="zf-none" data-zp-none hidden>Niets gevonden.</p><div class="zp-saved" data-zp-saved hidden>${a.savedCount?a.saved:'<p class="zf-none">Nog niets bewaard. Tik op de ster bij een animatie die speelt.</p>'}</div></div></section>`;
  return h;
}
// zoeken, groep en sorteren gebeuren op de pagina zelf (de voorbeelden blijven dezelfde canvassen)
function applyLib(page){
  const a1=page.querySelector('[data-zp-a1]');
  if(a1){const saved=lib.g==='bewaard';
    page.querySelectorAll('[data-zp-g]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.zpG===lib.g)));
    a1.querySelectorAll('[data-zp-tile]').forEach(x=>{x.hidden=saved||(lib.g!=='alles'&&x.dataset.zpCat!==lib.g);});
    a1.querySelectorAll('[data-zp-a1sec]').forEach(s=>{s.hidden=saved||(lib.g!=='alles'&&s.dataset.zpA1sec!==lib.g);});
    a1.hidden=saved;const sv=page.querySelector('[data-zp-saved]');if(sv)sv.hidden=!saved;return;}
  const list=page.querySelector('[data-zp-list]');if(!list)return;
  page.querySelectorAll('[data-zp-g]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.zpG===lib.g)));
  page.querySelectorAll('[data-zp-sort]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.zpSort===lib.sort)));
  const saved=lib.g==='bewaard',q=lib.q.trim().toLowerCase(),flat=list.querySelector('[data-zp-flat]');
  const tiles=[...list.querySelectorAll('[data-zp-tile]')];
  // eerst alles terug naar zijn eigen familie
  tiles.forEach(t=>{const home=t.__zpHome;if(home&&t.parentElement!==home)home.append(t);});
  tiles.forEach(t=>{if(!t.__zpHome)t.__zpHome=t.parentElement;});
  tiles.forEach((t,i)=>{if(t.__zpIdx===undefined)t.__zpIdx=i;});
  tiles.sort((x,y)=>x.__zpIdx-y.__zpIdx).forEach(t=>t.__zpHome.append(t));
  const show=t=>!saved&&(lib.g==='alles'||t.dataset.zpCat===lib.g)&&(!q||t.dataset.zpName.includes(q)||(t.closest('[data-zp-fam]')?.querySelector('header b')?.textContent||'').toLowerCase().includes(q));
  tiles.forEach(t=>{t.hidden=!show(t);});
  const byName=(x,y)=>x.dataset.zpName.localeCompare(y.dataset.zpName,'nl');
  if(lib.sort!=='soort'&&!saved){const r=recent(),pos=t=>{const i=r.indexOf(t.dataset.zpTile);return i<0?99:i;};
    tiles.filter(t=>!t.hidden).sort(lib.sort==='recent'?(x,y)=>pos(x)-pos(y)||byName(x,y):byName).forEach(t=>flat.append(t));}
  flat.hidden=lib.sort==='soort'||saved;
  list.querySelectorAll('[data-zp-fam]').forEach(f=>{f.hidden=saved||lib.sort!=='soort'||![...f.querySelectorAll('[data-zp-tile]')].some(t=>!t.hidden);});
  list.querySelectorAll('[data-zp-cathead]').forEach(hd=>{hd.hidden=saved||lib.sort!=='soort'||lib.g!=='alles'||![...list.querySelectorAll(`[data-zp-fam="${hd.dataset.zpCathead}"]`)].some(f=>!f.hidden);});
  const inLoop=list.querySelector('[data-zp-loophead="in"]');if(inLoop)inLoop.hidden=list.querySelector('[data-zp-cathead="tunnel"]')?.hidden!==false;
  const topLoop=list.querySelector('[data-zp-loophead="top"]');if(topLoop){topLoop.hidden=!(lib.g==='tunnel'&&!q);list.prepend(topLoop);}
  list.querySelector('[data-zp-saved]').hidden=!saved;
  list.querySelector('[data-zp-none]').hidden=saved||tiles.some(t=>!t.hidden);
}
const t0Order=new Map();

function create(api){
  const KEY='aluvision.zonePage.vertical.';
  const prefVertical=id=>{try{const v=root.localStorage.getItem(KEY+id);return v==='1'?true:v==='0'?false:null;}catch(_){return null;}};
  const setPrefVertical=(id,on)=>{try{root.localStorage.setItem(KEY+id,on?'1':'0');}catch(_){}};
  let last=null;           // de gegevens van de laatste markup (voor het tandwiel)
  // Samenvoegen en Eigen timing: de receivers kunnen dit nog niet (mesh-sessie). Tot dan bewaart dit toestel het en
  // toont alleen het voorbeeld het; er gaat niets naar de receivers. Daarom alleen in de tester (onderdeel
  // zone-merge-timing in tester-preview.js); op een toestel zijn ze er helemaal niet, ook de gevorderde tutorial niet.
  const extras=()=>root.LightningTesterPreview?.has('zone-merge-timing')===true;
  const store={get:(k,f)=>{try{const v=JSON.parse(root.localStorage.getItem('aluvision.zonePage.'+k));return v??f;}catch(_){return f;}},
    set:(k,v)=>{try{root.localStorage.setItem('aluvision.zonePage.'+k,JSON.stringify(v));}catch(_){}}};
  function joinedOf(d){if(!extras())return [];const ids=new Set((d.lines||[]).map(l=>l.id));return store.get('joined.'+d.id,[]).filter(g=>Array.isArray(g)&&g.length>1&&g.every(id=>ids.has(id)));}
  // de ledlines zoals ze in het voorbeeld staan: een groep telt als één
  function unitsOf(d){const groups=joinedOf(d),seen=new Set(),out=[];for(const l of d.lines||[]){const g=groups.find(x=>x.includes(l.id));
    if(g){if(seen.has(g))continue;seen.add(g);const parts=(d.lines||[]).filter(x=>g.includes(x.id));out.push({ids:g,pixels:parts.reduce((a,x)=>a+x.pixels,0),joined:true});}
    else out.push({ids:[l.id],pixels:l.pixels,joined:false});}return out;}
  const isLoop=d=>d.effect?.category==='tunnel';
  function seqOf(d){const n=unitsOf(d).length;let q=store.get('timing.'+d.id,null);
    if(!q||!Array.isArray(q.t)||q.t.length!==n){const dur=q?.dur||Math.max(2,+(n*.4+.8).toFixed(1));q={on:!!q?.on,dur,hold:q?.hold||.35,in:q?.in,out:q?.out,t:Array.from({length:n},(_,i)=>+(i*(dur-.8)/Math.max(1,n-1)).toFixed(2))};}
    return q;}
  const saveSeq=(d,q)=>store.set('timing.'+d.id,q);
  function timing(d,colours){if(!extras()||!isLoop(d)||unitsOf(d).length<2)return null;const q=seqOf(d);return q.on?{...q,colours:Array.isArray(colours)?colours:[]}:null;}
  let stack=[];            // open vellen
  // ---------- de pagina ----------
  // 1 ledline (ook een zone met maar één ledline): Horizontaal/Verticaal is alleen hoe het voorbeeld eruitziet
  const previewOnly=d=>d.layout==='continuous'||d.lineCount<=1;
  function vertical(d){const p=previewOnly(d)?prefVertical(d.id):null;return p!==null?p:d.layout==='vertical';}
  function stageHtml(d){
    const n=d.lineCount,rgbw=d.type==='RGBW',up=vertical(d),one=d.layout==='continuous';
    const hgt=up?'clamp(160px,22dvh,200px)':one?'88px':`${Math.min(6,Math.max(1,n))*40+8}px`;
    const scroll=d.canTap?d.preview:`<div class="v50-preview-canvas-scroll"><div class="v50-preview-canvas-stage" data-preview-ui="571" data-preview-vertical="${up}">${d.preview}</div></div>`;
    // de balk onderaan zonder tekst (de eigenaar 13 nov): links Horizontaal · Verticaal, rechts Alle en volledig scherm
    // Horizontaal · Verticaal altijd in het voorbeeld, ook bij één ledline (de eigenaar 15 nov: "ik zie de verticaal en horizontaal optie niet bij spi")
    const views=true?`<div class="zf-seg zf-seg-view" role="group" aria-label="Hoe hangen je ledlines?">${[['h','Horizontaal'],['v','Verticaal']].map(([k,t])=>{const on=(k==='v')===up;
      return `<button type="button" ${viewAttr(d,k)} aria-pressed="${on}" aria-label="${t}" title="${t}">${VICON[k]}${on?`<span>${t}</span>`:''}</button>`;}).join('')}</div>`:'';
    return `<div class="preview-wrap v50-control-preview zf-stage${d.canTap?' preview-selectable':''}${d.power===false?' is-off':''}" data-preview-layout="${esc(d.layout)}" style="--stage-h:${hgt}">${scroll}`+
      `<div class="v50-preview-actions"><div class="v50-preview-toolbar">${views}`+
      (d.canTap?`<button class="v50-select-all" type="button" data-action="select" data-id="all" aria-pressed="${d.selectionAll}" aria-label="Alle ${rgbw?'receivers':'ledlines'}" title="Alle">${IC.selectAll}<span>Alle</span></button>`:'')+
      `<button class="v50-preview-expand" type="button" data-action="preview-fullscreen" aria-label="Volledig scherm" title="Volledig scherm">${IC.expand}</button></div></div></div>`;
  }
  // Horizontaal of Verticaal: bij Apart de opstelling van de zone (set-layout); bij 1 ledline alleen het voorbeeld
  function viewAttr(d,k){
    if(previewOnly(d))return `data-zp-view="${k}"`;
    return `data-action="set-layout" data-id="${k==='v'?'vertical':'stacked'}"`;
  }
  function markup(d){
    last=d;const rgbw=d.type==='RGBW',n=d.lineCount;
    if(extras()&&d.anim&&isLoop(d)&&unitsOf(d).length>1)d.seqCard=seqCardHtml(d);
    const sub=`${n} ${lineWord(rgbw,n)}${rgbw?'':` · ${d.pixels} px`}`;
    const power=d.power==='mixed'?'mixed':!!d.power;
    let h=`<div class="page zf-app zp-page" data-zone-page="c250" data-zone-id="${esc(d.id)}"><section class="zf-dock" data-zp-dock><div class="zf-top">`+
      // 15 nov (de eigenaar: "de bovenste balk opkuisen, minder druk"; prototype K1): een kleine pijl, de naam met SPI/RGBW en het
      // aantal eronder, het tandwiel en de ronde aan/uit-knop (dezelfde als op de standpagina). Geen logo op de zonepagina.
      `<button type="button" class="zf-back zp-k1back" data-action="stand" aria-label="Terug naar je stand">${IC.back}</button>`+
      `<div class="zf-title"><b>${esc(d.name)}</b><small>${kindBadge(d.type)}<span>${esc(sub)}</span></small></div>`+
      `<button type="button" class="zf-gear zp-k1gear" data-zp="gear" aria-label="Instellingen van de zone">${IC.gear}</button>`+
      powerBtn(power,46)+`</div>`;
    // bij het kiezen van een animatie staat er bovenaan geen voorbeeld; de tegels bewegen zelf (zoals in het prototype).
    // Staan de ledlines apart, dan blijft het staan om ze te kiezen.
    const choosing=!d.colour&&!d.anim?.current&&!d.canTap;
    if(!choosing)h+=stageHtml(d);
    h+=`<div class="zf-tabs" role="tablist"><button type="button" role="tab" data-action="colour" aria-selected="${d.colour}">${IC.sun}<span>Kleur</span></button>`+
      `<button type="button" role="tab" data-action="animations" aria-selected="${!d.colour}">${IC.anim}<span>Animaties</span></button></div>`+
      `<div class="zp-dockgrad" data-zp-gcolour data-zp-dockgrad></div>`+
      `<p class="live-confirmation" data-live-status="zone" role="status" aria-live="polite"></p></section>`;
    h+=`<div class="zf-body zp-body" data-zp-mode="${d.colour?'colour':'animations'}" data-control-mode="${d.colour?'colour':'animations'}">${d.anim?animHtml(d):d.body}</div>`;
    // het oude volgordepaneel blijft beschikbaar voor de app (het opent alleen als de app het zelf opent)
    if(d.lineTools)h+=`<div class="zp-linetools"${d.lineToolsOpen?'':' hidden'}>${d.lineTools}</div>`;
    return h+`</div>`;
  }
  // ---------- na het tekenen ----------
  // ---------- Kleur: + Verloop en de verloopkaart (de eigenaar 13 nov) ----------
  // De verloop-editor van de app (static-gradient-ui.js) blijft het werk doen: dezelfde kleuren, dezelfde weg naar de
  // receivers. De tegels hieronder tikken haar eigen knoppen aan; haar oude rijen (Richting omdraaien, Doorlopend,
  // de Beweging-kaart) staan verborgen. Een MutationObserver houdt de tegels gelijk met de editor.
  const ARROW={left:path('M20 12H5m5-5-5 5 5 5'),right:path('M4 12h15m-5-5 5 5-5 5'),bounce:path('M3.5 12h17M8 7.5 3.5 12 8 16.5M16 7.5l4.5 4.5-4.5 4.5')};
  const MOVES=[[0,'Stil','stil'],[1,'Schuiven','schuif'],[2,'Golven','golf'],[3,'Ademen','adem'],[4,'Lichtkop','kop']];
  let colourObserver=null,colourSig='';
  function gradientState(ws){
    const q=s=>ws.querySelector(s),motionCard=q('[data-gradient-motion-card]'),type=+(q('[data-gradient-motion-type][aria-pressed="true"]')?.dataset.gradientMotionType||0);
    const swatches=[...ws.querySelectorAll('.gradient-point-swatch:not(.is-unset)')].map(s=>s.style.getPropertyValue('--stop').trim()).filter(Boolean);
    return {mode:ws.dataset.gradientMode,reverse:!!q('[data-gradient-reverse]')?.checked,loop:q('[data-gradient-loop-toggle]')?.getAttribute('aria-checked')==='true',
      loopOff:!!q('[data-gradient-loop-toggle]')?.disabled,move:motionCard&&q('[data-gradient-motion-toggle]')?.getAttribute('aria-checked')==='true'?type:0,
      flow:q('[data-gradient-motion-flow][aria-pressed="true"]')?.dataset.gradientMotionFlow||'right',swatches};
  }
  function gradCardHtml(ws,s){
    const val=k=>+(ws.querySelector(`[data-gradient-motion-${k}]`)?.value??40);
    const hx=s.swatches.length>1?s.swatches:['#FF5E3A','#FF9F1C','#7B2FF7'];
    const g=`linear-gradient(90deg,${hx.join(',')})`,gr=`linear-gradient(90deg,${[...hx].reverse().join(',')})`,gl=`linear-gradient(90deg,${[...hx,hx[0]].join(',')})`;
    const tile=(attr,on,cls,label,dis='')=>`<button type="button" class="zf-gtile" ${attr} aria-pressed="${on}"${dis}><span class="zf-gprev ${cls}"><i></i></span><b>${label}</b></button>`;
    const slider=(k,label,icon)=>{const v=val(k);return `<div class="slider-row zf-slider"><label for="zp-g-${k}"><i class="zf-ai zf-ai-${icon}" aria-hidden="true"><b></b><b></b><b></b></i><span>${label}</span><output data-zpg-out="${k}">${v}%</output></label><input id="zp-g-${k}" type="range" min="0" max="100" step="1" value="${v}" data-zpg-range="${k}" style="--fill:${v}%"></div>`;};
    let h=`<section class="card zf-card zf-gradcard zf-gradcard2 zp-gradcard" data-zp-gradcard style="--g:${g};--g-rev:${gr};--g-loop:${gl}"><header class="zf-cardhead"><h3>Verloop</h3></header>`+
      `<div class="zf-gtiles is-two">${tile('data-zpg="reverse"',s.reverse,'is-rev','Omdraaien')}${tile('data-zpg="loop"',s.loop,'is-loop','Doorlopend',s.loopOff?' disabled':'')}</div>`+
      `<h4 class="zf-subhead">Maak er een animatie van</h4><div class="zf-gtiles is-five" role="radiogroup" aria-label="Maak er een animatie van">${MOVES.map(([k,t,c])=>tile(`data-zpg-move="${k}" role="radio" aria-checked="${s.move===k}"`,s.move===k,'is-'+c,t)).join('')}</div>`;
    if(s.move)h+=`<div class="zf-motion2">`+(s.move!==3?`<div class="zf-flows zf-flows2" role="group" aria-label="Richting">${[['left','Naar links'],['right','Naar rechts'],['bounce','Heen en weer']].map(([k,t])=>`<button type="button" data-zpg-flow="${k}" aria-pressed="${s.flow===k}">${ARROW[k]}<span>${t}</span></button>`).join('')}</div>`:'')+
      slider('speed','Snelheid','speed')+slider('softness','Zachtheid','smooth')+(s.move===4?slider('trail','Staart','trailLength'):'')+`</div>`;
    return h+`</section>`;
  }
  // ---------- Kleur zoals in het prototype (de eigenaar 14 nov: "Ik zie heel veel oude elementen") ----------
  // Effen: de kleurkaart van de app (wiel, Helderheid, Fijn instellen), met + Verloop; daaronder Warmwit en Bewaarde
  // kleuren als bolletjes. Verloop: één kleurkaart met de kleurpunten, de balk en hetzelfde wiel; dan de Verloop-kaart
  // en Bewaarde verlopen met de voorbeelden. Alles gaat via de bestaande acties van de app: de verloop-editor
  // (api.gradient(): static-gradient-ui.js), en voor effen de knoppen van de app (warm-white, swatch, colour-new,
  // colour-preset-remove667, colour-undo), die verborgen blijven staan.
  const Cl=()=>root.LightningColour,Gr=()=>root.LightningStaticGradient;
  const rgbOfHex=h=>[1,3,5].map(i=>parseInt(String(h).slice(i,i+2),16)||0);
  const screenOf=(hex,w=0)=>{try{return Cl().screenHex(rgbOfHex(hex),w);}catch(_){return hex;}};
  const nextColour=hex=>{try{const C=Cl(),v=C.toHsv(rgbOfHex(hex));return C.hex(C.hsv(v.h+55,Math.max(.6,v.s),1)).toUpperCase();}catch(_){return '#7B2FF7';}};
  const gApi=()=>{try{return api.gradient?.()||null;}catch(_){return null;}};
  let gDrag=false;   // tijdens slepen (wiel, balk) de kleurkaart niet opnieuw tekenen
  const chRow=(k,v,i)=>`<div class="channel-row" style="--channel:${['#c4473f','#258461','#3f69c7','#747670'][i]}"><button type="button" class="channel-toggle" data-zpc-chtoggle="${k}" aria-pressed="${v>0}" aria-label="${k.toUpperCase()} aan of uit">${k.toUpperCase()}</button>`+
    `<button type="button" data-zpc-chstep="${k}" data-d="-1" aria-label="${k.toUpperCase()} minder">−</button><input type="range" min="0" max="255" value="${v}" data-zpc-ch="${k}" aria-label="${k.toUpperCase()}" style="--fill:${(v/2.55).toFixed(1)}%"><button type="button" data-zpc-chstep="${k}" data-d="1" aria-label="${k.toUpperCase()} meer">+</button>`+
    `<input class="channel-number" type="number" inputmode="numeric" min="0" max="255" step="1" value="${v}" data-zpc-chnum="${k}" aria-label="${k.toUpperCase()} precies"></div>`;
  const railBg=stops=>`linear-gradient(90deg,${stops.map(x=>`${screenOf(x.color,x.white)} ${(x.position*100).toFixed(1)}%`).join(',')})`;
  // de ronde aan/uit-knop (stand-home.css .alv-power): dezelfde overal; gloed in de eerste kleur van de zone
  function powerBtn(pw,size){const g=(last?.colours||[]).find(c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c)&&c.toLowerCase()!=='#000000')||'#FF5E3A';
    return `<button type="button" class="alv-power zf-power${pw===true?' is-on':pw==='mixed'?' is-mixed':''}" style="--s:${size}px;--g:${g}" data-action="power" aria-pressed="${pw===true}" aria-label="${pw===true?'Zone uitzetten':'Zone aanzetten'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v8"/><path d="M6.7 6.6a7.5 7.5 0 1 0 10.6 0"/></svg></button>`;}
  function cardPower(){const pw=last?.power==='mixed'?'mixed':!!last?.power;if(root.LightningStandHome)return ''; /* 15 nov: de aan/uit-knop staat alleen nog in de balk */
    return `<button type="button" class="switch zf-cardpower" role="switch" aria-checked="${pw===true}" data-action="power" aria-label="Zone aan of uit"><span>${pw==='mixed'?'Deels':pw?'Aan':'Uit'}</span><i aria-hidden="true"></i></button>`;}
  // de bolletjes en de balk van een verloop: in de kaart, en (ingeklapt) in de kop zelf (de eigenaar 15 nov 12:34)
  function pointsRail(st,{foot=true}={}){
    const n=st.stops.length,p=Math.min(st.selected,n-1),even=st.stops.every((x,i)=>Math.abs(x.position-i/(n-1))<.006);
    return `<div class="zf-points">${st.stops.map((x,i)=>`<button type="button" class="zf-point${i===p?' is-on':''}" data-zpc-point="${i}" style="--k:${screenOf(x.color,x.white)}" aria-pressed="${i===p}" aria-label="Kleur ${i+1}"></button>`).join('')}`+
      (n<st.max?`<button type="button" class="zf-add" data-zpc="add" aria-label="Kleur toevoegen">${IC.plus}</button>`:'')+
      (n>2?`<button type="button" class="zf-del" data-zpc="del" aria-label="Kleur ${p+1} weghalen">${IC.close}</button>`:`<button type="button" class="zf-del" data-zp-gradient="off" aria-label="Kleur ${p+1} weghalen">${IC.close}</button>`)+`</div>`+
      `<div class="zf-rail" data-zpc-rail style="background:${railBg(st.stops)}">${st.stops.map((x,i)=>`<button type="button" class="zf-gstop${i===p?' is-on':''}" data-zpc-stop="${i}" style="left:${(x.position*100).toFixed(2)}%;--k:${screenOf(x.color,x.white)}" aria-label="Kleur ${i+1}, plaats ${Math.round(x.position*100)} procent"></button>`).join('')}</div>`+
      (foot?`<div class="zf-railfoot"><small>Sleep de puntjes om de overgang te verschuiven.</small>${even?'':`<button type="button" class="zf-textbtn" data-zpc="even">Gelijk verdelen</button>`}</div>`:'');
  }
  function gColourHtml(st){
    const n=st.stops.length,p=Math.min(st.selected,n-1),cur=st.stops[p],[r,g,b]=rgbOfHex(cur.color),w=cur.white||0;
    const even=st.stops.every((x,i)=>Math.abs(x.position-i/(n-1))<.006);
    return `<section class="card colour-card zf-card zp-gcolour" data-zp-gcolour><header class="zf-cardhead"><h2>Verloopkleuren</h2><span class="zf-count">${n} van ${st.max}</span>${cardPower()}</header>`+
      `<div class="zp-gpoints">${pointsRail(st)}</div>`+
      `<div class="colour-tools zf-tools"><div class="wheel-wrap"><canvas class="wheel" width="260" height="260" data-zpc-wheel role="img" aria-label="Kleurenwiel"></canvas><span class="wheel-cursor" data-zpc-cursor></span></div></div>`+
      `<div class="slider-row zf-slider"><label for="zp-gbri">${IC.sun}<span>Helderheid</span><output data-zpc-briout>${st.brightness}%</output></label><input id="zp-gbri" type="range" min="1" max="100" step="1" value="${st.brightness}" data-zpc-bri style="--fill:${st.brightness}%"></div>`+
      `<div class="fine-controls zf-fine"><h3>Fijn instellen</h3><div class="fine-controls-body">${[['r',r],['g',g],['b',b],['w',w]].map(([k,v],i)=>chRow(k,v,i)).join('')}</div></div></section>`;
  }
  let wheelPx=null;
  function paintWheel(card){
    const c=card?.querySelector('[data-zpc-wheel]');if(!c||c.dataset.zpDone)return;c.dataset.zpDone='1';const ctx=c.getContext('2d'),size=260,C=Cl();if(!ctx||!C)return;
    if(!wheelPx){wheelPx=ctx.createImageData(size,size);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,rgb=C.screenRGB(C.fromPoint(x+.5,y+.5,size)),inside=Math.hypot(x+.5-size/2,y+.5-size/2)<=size/2;
      wheelPx.data[i]=rgb[0];wheelPx.data[i+1]=rgb[1];wheelPx.data[i+2]=rgb[2];wheelPx.data[i+3]=inside?255:0;}}
    ctx.putImageData(wheelPx,0,0);placeCursor(card);
  }
  function placeCursor(card){const st=gApi()?.state();const cur=card?.querySelector('[data-zpc-cursor]');if(!st||!cur)return;const x=st.stops[Math.min(st.selected,st.stops.length-1)];
    try{const pt=Cl().position(rgbOfHex(x.color));cur.style.left=pt.x+'%';cur.style.top=pt.y+'%';cur.style.setProperty('--cursor',screenOf(x.color,x.white));}catch(_){}}
  // tijdens slepen: alleen bijwerken wat verandert (geen nieuwe kaart, zodat het slepen niet onderbreekt)
  function liveColour(card){const st=gApi()?.state();if(!st||!card)return;const p=Math.min(st.selected,st.stops.length-1),x=st.stops[p],[r,g,b]=rgbOfHex(x.color);
    card.querySelector(`[data-zpc-point="${p}"]`)?.style.setProperty('--k',screenOf(x.color,x.white));
    const rail=card.querySelector('[data-zpc-rail]');if(rail){rail.style.background=railBg(st.stops);rail.querySelectorAll('[data-zpc-stop]').forEach((el,i)=>{const y=st.stops[i];if(!y)return;el.style.left=(y.position*100).toFixed(2)+'%';el.style.setProperty('--k',screenOf(y.color,y.white));});}
    for(const [k,v] of [['r',r],['g',g],['b',b],['w',x.white||0]]){const rg=card.querySelector(`[data-zpc-ch="${k}"]`),nm=card.querySelector(`[data-zpc-chnum="${k}"]`);if(rg&&document.activeElement!==rg){rg.value=v;rg.style.setProperty('--fill',(v/2.55).toFixed(1)+'%');}if(nm&&document.activeElement!==nm)nm.value=v;}
    placeCursor(card);}
  function setFromChannels(card){const G2=gApi(),st=G2?.state();if(!st)return;const v=k=>Math.max(0,Math.min(255,Math.round(+card.querySelector(`[data-zpc-ch="${k}"]`)?.value||0)));
    G2.setColour(st.selected,Cl().hex([v('r'),v('g'),v('b')]),v('w'));liveColour(card);}
  // Warmwit en Bewaarde kleuren (effen); de knoppen van de app staan verborgen in de kleurkaart
  function warmHtml(pk){const btn=pk.querySelector('[data-action="warm-white"]'),inp=pk.querySelector('input[data-warmth]');if(!btn)return '';const on=btn.getAttribute('aria-pressed')==='true',v=+(inp?.value||50);
    return `<section class="card zf-card zf-warmcard zp-warm" data-zp-warm><div class="zf-row"><span class="zf-warmsw"><i></i><span><b>Warmwit</b><small>RGB + W: een warmere witmix</small></span></span>`+
      `<button type="button" class="switch" role="switch" aria-checked="${on}" data-zpw="toggle" aria-label="Warmwit"><span>${on?'Aan':'Uit'}</span><i aria-hidden="true"></i></button></div>`+
      (on?`<div class="slider-row warmth-row zf-slider"><label for="zp-warmth"><span>Warmte</span><output data-zpw-out>${v}%</output></label><input id="zp-warmth" type="range" min="1" max="100" step="1" value="${v}" data-zpw-warmth style="--fill:${v}%"><div class="warmth-scale"><span>Neutraler</span><span>Warmer</span></div></div>`:'')+`</section>`;}
  // Bewaarde kleuren zoals in het prototype (15 nov): één kaart met je kleuren én je verlopen, daaronder de voorbeelden van
  // verlopen; in beide standen. Altijd een kruisje, even vasthouden om te verslepen (kleuren onder elkaar, verlopen onder
  // elkaar: ze staan in twee lijsten). Een kleur in de verloopstand kleurt het gekozen puntje; een verloop in de kleurstand
  // maakt er eerst een verloop van.
  function savedHtml(pk,ws,grad){
    const list=pk?[...pk.querySelectorAll('.saved-colour[data-action="swatch"][data-id]')].map(b=>({id:b.dataset.id,name:(b.querySelector('.colour-preset-name667')?.childNodes[0]?.textContent||'').trim(),sw:b.style.getPropertyValue('--swatch').trim(),rgb:b.dataset.rgb||'',w:b.dataset.white||'0'})):[];
    const own=ws?[...ws.querySelectorAll('[data-gradient-load]')].map(b=>({id:b.dataset.gradientLoad,name:b.querySelector('span')?.textContent||'',bg:b.querySelector('i')?.style.background||''})):[];
    const ex=ws?(Gr()?.builtinPresets||[]).map(pr=>({id:pr.id,name:pr.name,bg:`linear-gradient(135deg,${pr.stops.map(x=>x.color).join(',')})`})):[];
    const cUndo=!!pk?.querySelector('.my-colours [data-action="colour-undo"]'),gUndo=!!gApi()?.canUndoPreset;
    const x_=(attr,id,name)=>`<button type="button" class="zf-x" ${attr}="${esc(id)}" aria-label="${esc(name)} wissen">${IC.close}</button>`;
    return `<section class="card zf-card zf-saved zp-saved" data-zp-saved><header class="zf-cardhead"><h3>Bewaarde kleuren</h3></header>`+
      (list.length+own.length>1?`<p class="zf-hint">Houd vast om te verslepen.</p>`:'')+
      `<div class="zf-bubbles" data-zp-sort="colour"><button type="button" class="zf-bub is-add" data-zps="${grad?'gsave':'save'}"><i>${IC.plus}</i><span>Bewaar</span></button>`+
      list.map(x=>`<div class="zf-bub is-item" data-zps-item="${esc(x.id)}"><button type="button" class="zf-bubsw" ${grad?`data-zps-pick="${esc(x.rgb)},${esc(x.w)}"`:`data-zps-use="${esc(x.id)}"`} style="--k:${esc(x.sw)}"><i></i><span>${esc(x.name)}</span></button>${x_('data-zps-del',x.id,x.name)}</div>`).join('')+`</div>`+
      (own.length?`<div class="zf-bubbles zp-gsavedrow" data-zp-sort="gradient">`+own.map(x=>`<div class="zf-bub is-item" data-zps-item="${esc(x.id)}"><button type="button" class="zf-bubsw" data-zps-gload="${esc(x.id)}" style="--k:${esc(x.bg)}"><i></i><span>${esc(x.name)}</span></button>${x_('data-zps-gdel',x.id,x.name)}</div>`).join('')+`</div>`:'')+
      (cUndo?`<button type="button" class="zf-textbtn" data-zps="undo">Ongedaan maken</button>`:gUndo?`<button type="button" class="zf-textbtn" data-zps="gundo">Ongedaan maken</button>`:'')+
      (ex.length?`<h4 class="zf-subhead">Voorbeelden van verlopen</h4><div class="zf-bubbles">${ex.map(x=>`<button type="button" class="zf-bub" data-zps-gex="${esc(x.id)}" style="--k:${esc(x.bg)}"><i></i><span>${esc(x.name)}</span></button>`).join('')}</div>`:'')+`</section>`;}
  let slotSig={};
  function fill(box,key,html){if(slotSig[key]===html)return false;slotSig[key]=html;const el=box.querySelector(`[data-zp-slot="${key}"]`);if(el)el.innerHTML=html;return true;}
  // de kleur die nu brandt (de effen kleurkaart staat ook bij een verloop in de pagina, verborgen)
  function currentHex(page){const pk=page.querySelector('[data-colour-picker="static"]'),ch=k=>Math.max(0,Math.min(255,+(pk?.querySelector(`input[data-channel="${k}"]`)?.value||0)));
    try{const a=Cl().hex([ch('r'),ch('g'),ch('b')]).toUpperCase();return a==='#000000'?'#FF5E3A':a;}catch(_){return '#FF5E3A';}}
  function syncColour(page){
    dockVar();
    const body=page.querySelector('.zp-body');if(!body)return;
    const ws=body.querySelector('[data-gradient-workspace]'),pk=body.querySelector('[data-colour-picker="static"]');
    // ingeklapt staan de bolletjes en de balk in de kop zelf (zelfde knoppen, zelfde editor)
    {const dg=page.querySelector('[data-zp-dockgrad]'),gs=ws?.dataset.gradientMode==='gradient'?gApi()?.state():null,html=gs?pointsRail(gs,{foot:false}):'';
      if(dg&&!gDrag&&!pDrag?.on&&dg.dataset.sig!==html){dg.dataset.sig=html;dg.innerHTML=html;dg.classList.toggle('has-grad',!!html);}}
    const solidHead=pk?.querySelector('.section-heading');
    if(pk&&solidHead){solidHead.classList.add('zp-oldhead');let sh=pk.querySelector('[data-zp-solidhead]');
      const html=`<header class="zf-cardhead"><h2>Kleur</h2>${cardPower()}</header><div class="zf-points"><span class="zf-point is-on" data-zp-solidpoint style="--k:${currentHex(page)}" aria-label="Je kleur"></span>`+
        (ws?`<button type="button" class="zf-add is-first" data-zp-gradient="on" aria-label="Verloop maken">${IC.plus}<span>Verloop</span></button>`:'')+`</div>`;
      if(!sh){solidHead.insertAdjacentHTML('beforebegin','<div class="zp-solidhead" data-zp-solidhead></div>');sh=pk.querySelector('[data-zp-solidhead]');}
      if(sh.dataset.sig!==html){sh.dataset.sig=html;sh.innerHTML=html;}}
    const grad=ws?.dataset.gradientMode==='gradient',st=grad?gApi()?.state():null;
    // effen: Warmwit en Bewaarde kleuren onder de kleurkaart
    let sbox=body.querySelector('[data-zp-scards]');
    if(pk&&!grad){if(!sbox||sbox.previousElementSibling!==pk){sbox?.remove();pk.insertAdjacentHTML('afterend','<div class="zp-cards" data-zp-scards><div data-zp-slot="warm"></div><div data-zp-slot="saved"></div></div>');sbox=pk.nextElementSibling;slotSig.warm=slotSig.saved=null;}
      fill(sbox,'warm',warmHtml(pk));fill(sbox,'saved',savedHtml(pk,ws,false));}
    else if(sbox){sbox.remove();slotSig.warm=slotSig.saved=null;}
    // verloop: kleurkaart, Verloop-kaart en Bewaarde verlopen, vóór het (verborgen) paneel van de editor
    let gbox=ws?.querySelector('[data-zp-gcards]');
    if(!grad||!st){if(gbox){gbox.remove();slotSig.gcolour=slotSig.grad=slotSig.gsaved=null;}colourSig='';return;}
    if(!gbox){ws.querySelector('[data-gradient-panel]')?.insertAdjacentHTML('beforebegin','<div class="zp-cards" data-zp-gcards><div data-zp-slot="gcolour"></div><div data-zp-slot="grad"></div><div data-zp-slot="gsaved"></div></div>');gbox=ws.querySelector('[data-zp-gcards]');slotSig.gcolour=slotSig.grad=slotSig.gsaved=null;}
    if(!gbox)return;
    // een leeg verloop (bv. na "Verloop in beweging" bij Animaties) meteen vullen met je kleur en een tweede, zoals + Verloop
    if(st.stops.length&&st.stops.every(x=>x.unset)&&gApi()?.fill){const a=currentHex(page);if(gApi().fill([a,nextColour(a)]))return syncColour(page);}
    // de eigenaar 15 nov (11:12): het kleurenwiel meteen onder de bolletjes; de instellingen van het verloop ("Maak er een
    // animatie van") in een eigen kaart onder het kleurenpaneel
    if(!gDrag&&fill(gbox,'gcolour',gColourHtml(st)))paintWheel(gbox.querySelector('[data-zp-gcolour]'));
    fill(gbox,'grad',gradCardHtml(ws,gradientState(ws)));fill(gbox,'gsaved',savedHtml(pk,ws,true));
  }
  function watchColour(page){
    colourObserver?.disconnect();colourObserver=null;colourSig='';slotSig={};
    const body=page.querySelector('.zp-body');if(!body)return;
    let q=0;colourObserver=new MutationObserver(()=>{if(q)return;q=1;queueMicrotask(()=>{q=0;if(body.isConnected)syncColour(page);});});
    colourObserver.observe(body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-gradient-mode','aria-checked','aria-pressed','hidden','disabled','style']});
    syncColour(page);
  }
  function gradientAct(t){
    const page=t.closest('[data-zone-page="c250"]'),ws=page?.querySelector('[data-gradient-workspace]');if(!ws)return false;
    const q=s=>ws.querySelector(s);
    const g=t.closest('[data-zp-gradient]');
    if(g){const on=g.dataset.zpGradient==='on',G2=gApi();
      if(on&&G2){const a=currentHex(page);if(G2.start([a,nextColour(a)]))return true;}
      q(`[data-gradient-mode-choice="${on?'gradient':'solid'}"]`)?.click();return true;}
    const a=t.closest('[data-zpg]');
    if(a){if(a.dataset.zpg==='reverse'){const box=q('[data-gradient-reverse]');if(box){box.checked=!box.checked;box.dispatchEvent(new Event('input',{bubbles:true}));syncColour(page);}}
      else q('[data-gradient-loop-toggle]')?.click();return true;}
    const m=t.closest('[data-zpg-move]');
    if(m){const k=+m.dataset.zpgMove,on=q('[data-gradient-motion-toggle]')?.getAttribute('aria-checked')==='true';
      if(!k){if(on)q('[data-gradient-motion-toggle]').click();return true;}
      if(!on){if(q('[data-gradient-motion-toggle]'))q('[data-gradient-motion-toggle]').click();else root.dispatchEvent(new CustomEvent('aluvision:gradient-motion-c139'));}
      const pickType=(n=20)=>{const b=ws.querySelector(`[data-gradient-motion-type="${k}"]`);if(b){if(b.getAttribute('aria-pressed')!=='true')b.click();return;}if(n>0)requestAnimationFrame(()=>pickType(n-1));};
      pickType();return true;}
    const f=t.closest('[data-zpg-flow]');
    if(f){q(`[data-gradient-motion-flow="${f.dataset.zpgFlow}"]`)?.click();return true;}
    return false;
  }
  document.addEventListener('input',e=>{
    const r=e.target instanceof Element&&e.target.closest('[data-zpg-range]');if(!r)return;
    const k=r.dataset.zpgRange,ws=r.closest('[data-zone-page="c250"]')?.querySelector('[data-gradient-workspace]'),orig=ws?.querySelector(`[data-gradient-motion-${k}]`);
    r.style.setProperty('--fill',r.value+'%');const out=r.closest('.zf-slider')?.querySelector('[data-zpg-out]');if(out)out.textContent=r.value+'%';
    if(orig){orig.value=r.value;orig.dispatchEvent(new Event('input',{bubbles:true}));}
  });
  function bind(main){
    const page=main.querySelector('[data-zone-page="c250"]');if(!page){colourObserver?.disconnect();colourObserver=null;return;}
    brandH();dockCompact();
    shapeEditor(page);
    if(fullEl){if(fullEl.isConnected)placeStage();else fullEl=null;}
    t0Order.clear();applyLib(page);
    // samengevoegde ledlines: één nummer per lijn (1, 2, 3 …), de andere delen hebben geen eigen knopje
    if(last){const members=new Set(joinedOf(last).flatMap(g=>g.slice(1)));let k=0;
      page.querySelectorAll('.zf-dock .v50-preview-line-target').forEach(b=>{if(members.has(b.dataset.id)){b.classList.add('zp-member');return;}const num=b.querySelector('.v50-preview-line-badge b');if(num)num.textContent=String(++k);});}
    if(page.querySelector('[data-zp-mode="colour"]'))watchColour(page);else{colourObserver?.disconnect();colourObserver=null;}
    stack.filter(s=>s.isConnected&&s.dataset.zpRefresh==='gear').forEach(s=>refreshSheet(s));
    askTutorial(page);
  }
  // Animaties: de editor van de app in de vorm van het prototype (de eigenaar 14 nov: "alle oude elementen weg").
  // De knoppen en schuiven blijven die van de app (palette-edit, palette-add, background-toggle, direction,
  // data-setting speed/bri/width/smooth, settings-toggle); ze worden alleen anders gegroepeerd:
  // Speelt nu met de animatiekleuren als bolletjes, "Zo loopt het" (richting, snelheid, helderheid) en Geavanceerd.
  function shapeEditor(page){
    const ed=page.querySelector('.zp-editor .active-animation-workspace')||page.querySelector('[data-stand-control-sheet] .active-animation-workspace'),play=page.querySelector('.zp-playing');
    if(!ed||ed.dataset.zpShaped)return;ed.dataset.zpShaped='1';ed.classList.add('zp-shaped');
    const pal=ed.querySelector('.palette-section');if(pal){pal.classList.add('zp-pal');if(play)play.append(pal);}
    if(pal){const hint=pal.querySelector('.v569-palette-hint');if(hint){hint.textContent='Tik om te wijzigen. Sleep om te wisselen.';hint.classList.add('zp-palhint');}
      const add=pal.querySelector('.palette-add');if(add&&!add.querySelector('small'))add.insertAdjacentHTML('beforeend','<small>Kleur</small>');}
    const run=document.createElement('section');run.className='card zf-card zf-run zp-run';run.innerHTML='<header class="zf-cardhead"><h3>Zo loopt het</h3></header>';
    if(last&&last.type!=='RGBW'&&last.lineCount>1){const one=last.layout==='continuous',up=vertical(last);
      run.insertAdjacentHTML('beforeend',`<div class="zf-together zp-runmode" role="group" aria-label="1 ledline of apart">`+[['samen','1 ledline','Het licht loopt door','continuous'],['apart','Apart','Elke ledline voor zich',up?'vertical':'stacked']].map(([k,tt,s,layout])=>
        `<button type="button" data-action="set-layout" data-id="${layout}" data-zp-mode="${k}" aria-pressed="${(k==='samen')===one}">${modePic(k)}<b>${tt}</b><small>${s}</small></button>`).join('')+`</div>`);}
    const dir=ed.querySelector('.animation-direction-primary .compact-direction');if(dir){dir.classList.add('zf-flows','zf-dirs');run.append(dir);}
    ed.querySelectorAll('.v569-playback-panel .v569-primary-setting').forEach(x=>run.append(x));
    if(run.children.length>1){if(play)play.insertAdjacentElement('afterend',run);else (pal||ed.firstElementChild)?.insertAdjacentElement('afterend',run);}
    const adv=ed.querySelector('.settings-toggle');if(adv){adv.closest('div')?.classList.add('card','zf-card','zp-adv');const b=adv.querySelector('.advanced-settings-copy b');if(b)b.textContent='Geavanceerd';}
  }
  const brandH=()=>document.documentElement.style.setProperty('--zf-brand',(document.querySelector('.brand-bar')?.offsetHeight||56)+'px');
  // Inklappen bij scrollen, vloeiend (de eigenaar 14 nov: "de dicht klap animatie moet smoother"):
  // - alles schuift mee in dezelfde beweging (zone-page.css), niets verdwijnt in één klap;
  // - de inhoud eronder blijft staan: de dock houdt zijn plaats met een marge onderaan die de hoogte volgt;
  // - pas inklappen als de inhoud al zo ver onder de dock zit dat er bij het kleiner worden geen gat ontstaat.
  let dockM=null;            // {el, hExp, hC, T}: hoogte open en dicht, en vanaf welke scrollpositie dicht
  function dockMeasure(d){
    const was=d.classList.contains('is-compact');d.classList.add('zp-instant');d.style.marginBottom='0px';
    d.classList.remove('is-compact');const hExp=d.offsetHeight;d.classList.add('is-compact');const hC=d.offsetHeight;
    const page=d.closest('[data-zone-page]'),stickTop=parseFloat(getComputedStyle(d).top)||0;
    const s0=page?Math.max(0,page.getBoundingClientRect().top+root.scrollY+(parseFloat(getComputedStyle(page).paddingTop)||0)-stickTop):0;
    d.classList.toggle('is-compact',was);void d.offsetHeight;
    return {el:d,hExp,hC,T:s0+Math.max(0,hExp-hC)};
  }
  function dockSet(d,on,instant){
    if(instant)d.classList.add('zp-instant');d.classList.toggle('is-compact',on);document.documentElement.classList.toggle('zp-dock-compact',on);
    const fit=()=>{d.style.marginBottom=Math.max(0,dockM.hExp-d.offsetHeight)+'px';};
    if(instant){fit();requestAnimationFrame(()=>d.classList.remove('zp-instant'));return;}
    const end=performance.now()+520;const step=()=>{if(!d.isConnected||dockM?.el!==d)return;fit();if(performance.now()<end)requestAnimationFrame(step);};step();
  }
  function dockCompact(e){const d=document.querySelector('[data-zp-dock]');if(!d){document.documentElement.classList.remove('zp-dock-compact');return;}
    const fresh=!dockM||dockM.el!==d||!d.isConnected;if(fresh)dockM=dockMeasure(d);
    const on=d.classList.contains('is-compact'),y=root.scrollY,want=on?y>dockM.T-8:y>dockM.T+8;   // kleine marge: geen geflikker op de grens
    if(fresh)dockSet(d,want,true);else if(want!==on)dockSet(d,want,false);
  }
  root.addEventListener('scroll',dockCompact,{passive:true});root.addEventListener('resize',()=>{brandH();dockM=null;dockCompact();});
  // de tutorial start nooit vanzelf: de eerste keer vraagt de pagina het, één keer per soort zone (tutorial-ask.js)
  // Nakijkronde 17 nov § 2.1: onder een Flutter-gastheer staat deze pagina onder Flutter; de vraag zou onzichtbaar openen en
  // daarna Flutter-pagina's laten opzijgaan (open:true). Dan nooit vragen (zelfde controle als connection-choice.js).
  const flutterHostA7=()=>root.__lightningFlutterHost===true&&!!root.webkit?.messageHandlers?.lightningHost||typeof root.AluvisionFlutterHost?.postMessage==='function';
  function askTutorial(page){if(!last||!root.ZfIntro||!root.LightningTutorialAsk||flutterHostA7())return;const kind=last.type==='RGBW'?'rgbw':'spi';
    if(root.ZfIntro.seenBefore(kind)||document.querySelector('.ki:not([hidden])'))return;
    setTimeout(()=>{if(page.isConnected&&!stack.length&&!document.querySelector('dialog[open]'))root.LightningTutorialAsk.ask('zone-'+kind,{onYes:()=>root.ZfIntro.open(kind)});},700);}
  // ---------- vellen ----------
  function sheet(cls,html){
    const el=document.createElement('div');el.className='zf-app zf-sheet '+cls;el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
    el.innerHTML=`<div class="zf-sheet-back" data-zp-close></div><section class="zf-panel">${html}</section>`;
    document.body.append(el);stack.push(el);document.body.classList.add('zf-sheet-open');
    requestAnimationFrame(()=>el.classList.add('is-in'));return el;}
  function closeTop(){const el=stack.pop();if(!el)return;if(el===fullEl)restoreStage();el.classList.remove('is-in');el.classList.add('is-out');setTimeout(()=>el.remove(),reduce()?0:260);if(!stack.length)document.body.classList.remove('zf-sheet-open');}
  function closeAll(){while(stack.length)closeTop();}
  // Volledig scherm (zoals het prototype): een vel met de naam van de zone en hetzelfde voorbeeld, groter. Het voorbeeld
  // van de dock verhuist zolang naar het vel (zelfde canvas, zelfde knopjes per ledline) en gaat daarna terug.
  let fullEl=null;
  function openFull(){if(!last||fullEl)return;
    fullEl=sheet('zf-fullsheet zp-fullsheet',`<div class="zf-fullbox"><header class="zf-sh"><div><small class="zf-kicker">Volledig scherm</small><b>${esc(last.name)}</b></div><button type="button" class="zf-round" data-zp-close aria-label="Sluiten">${IC.close}</button></header><div class="zp-fullslot" data-zp-fullslot></div></div>`);
    placeStage();}
  function placeStage(){if(!fullEl)return;const slot=fullEl.querySelector('[data-zp-fullslot]'),st=document.querySelector('[data-zp-dock] .zf-stage');if(!slot||!st)return;
    const home=document.createElement('div');home.dataset.zpStagehome='';home.style.height=st.offsetHeight+'px';st.replaceWith(home);slot.replaceChildren(st);}
  function restoreStage(){const st=fullEl?.querySelector('[data-zp-fullslot] .zf-stage'),home=document.querySelector('[data-zp-stagehome]');fullEl=null;if(st&&home&&home.isConnected)home.replaceWith(st);}
  // ---------- tandwiel: Ledlines in deze zone ----------
  function gearHtml(d){
    const rgbw=d.type==='RGBW',n=d.lineCount,one=d.layout==='continuous',up=vertical(d);
    let h=root.LightningStandHome?`<header class="zp-a1head zp-gearhead"><button type="button" class="zp-k1back" data-zp-close aria-label="Terug">${IC.back}</button><div class="zf-title"><small class="zp-a1kick">Zone</small><b>${esc(d.name)}</b></div></header>`
      :`<header class="zf-sh"><div><small class="zf-kicker">${esc(d.name)}</small><b>Ledlines in deze zone</b></div><button type="button" class="zf-round" data-zp-close aria-label="Sluiten">${IC.close}</button></header>`;
    // alleen als er iets te ordenen valt (RGBW met één receiver niet); nooit het oude scherm
    if(api.orderReady?api.orderReady(d.id):true)h+=`<button type="button" class="zf-orderrow" data-zp="order"><span class="zf-orderic">${IC.direction}</span><span><b>${rgbw?'Volgorde':'Looprichting'}</b></span>${IC.chev}</button>`;
    if(n>1&&!rgbw)h+=`<section class="zf-gsec">${gh('licht','Licht')}<div class="zf-together" role="group" aria-label="1 ledline of apart">`+
      [['samen','1 ledline','Het licht loopt door','continuous'],['apart','Apart','Elke ledline voor zich',up?'vertical':'stacked']].map(([k,t,s,layout])=>
        `<button type="button" data-action="set-layout" data-id="${layout}" data-zp-mode="${k}" aria-pressed="${(k==='samen')===one}">${modePic(k)}<b>${t}</b><small>${s}</small></button>`).join('')+`</div></section>`;
    // Weergave ook bij 1 ledline (zoals in het prototype, de eigenaar 15 nov)
    h+=`<section class="zf-gsec">${gh('weergave','Weergave')}${rgbw?'':'<p class="zf-hint">Hoe hangen je ledlines?</p>'}<div class="zf-views">`+
      [['h','Horizontaal'],['v','Verticaal']].map(([k,t])=>`<button type="button" ${viewAttr(d,k)} aria-pressed="${(k==='v')===up}">${viewPic(k)}<b>${t}</b></button>`).join('')+`</div></section>`;
    h+=`<section class="zf-gsec">${gh('receivers','Receivers in deze zone')}<div class="zf-rcvs">`+
      d.receivers.map(r=>`<div class="zf-rcv"><span class="zf-rart">${receiverArt(r)}</span><b>${esc(r.name)}</b><button type="button" class="zf-chip" data-zp-move="${esc(r.id)}">Verplaatsen</button></div>`).join('')+
      `<button type="button" class="zf-addrcv" data-action="layout-new-receiver" data-zone="${esc(d.id)}">${IC.plus}<span>Receiver toevoegen</span></button></div></section>`;
    const units=unitsOf(d);
    if(extras()&&(units.length>1||units.some(u=>u.joined)))h+=joinHtml(d,units);
    // naam wijzigen en de zone verwijderen (de bestaande vensters van de app)
    if(root.LightningStandHome)h+=`<section class="zf-gsec zp-gearmore"><button type="button" class="zp-a1row" data-action="zone-rename" data-id="${esc(d.id)}"><span class="zp-gic"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg></span><span class="zp-setb"><b>Naam wijzigen</b></span>${IC.chev}</button>`+
      `<button type="button" class="zp-gdel" data-action="zone-delete" data-id="${esc(d.id)}">Zone verwijderen</button></section>`;
    h+=`<div class="zf-tutrow"><button type="button" class="zf-tutlink" data-zp="intro"><i>${IC.play}</i><span>Bekijk tutorial</span></button>`+
      (extras()?`<button type="button" class="zf-tutlink is-pro" data-zp="intropro"><i>${IC.play}</i><span>Gevorderd: looplicht en timing</span></button>`:'')+`</div>`;
    return h;
  }
  function receiverArt(r){const RA=root.AluvisionReceiverArt;if(!RA)return IC.receiver;
    try{return RA.svg({type:r.type==='RGBW'?'rgbw':'spi',view:'top',theme:document.body.dataset.theme==='dark'?'dark':'light',outputs:[true,true,true,true],cable:10,lead:4,led:'#1FC45B',shadow:false,width:64});}catch(_){return IC.receiver;}}
  // Ledlines samenvoegen (de eigenaar 13 nov): het beeld toont het; daaronder de ledlines om aan te tikken; een groep heeft Ontkoppel
  function joinHtml(d,units){const rgbw=d.type==='RGBW',max=Math.max(1,...units.map(u=>u.pixels||1)),words=rgbw?'receivers':'ledlines';
    const size=u=>rgbw?(u.joined?`${u.ids.length} ${words}`:''):`${u.pixels} px`;
    const bar=u=>`<span class="zf-cb${u.joined?' is-joined':''}" style="--w:${rgbw?(u.joined?100:60):((u.pixels||1)/max*100).toFixed(1)}%"><i></i></span>`;
    const row=(u,i)=>u.joined?`<div class="zf-jrow is-joined"><span class="zf-jtick" aria-hidden="true">${IC.link}</span><span class="zf-cnum">${i+1}</span>${bar(u)}<small>${size(u)}</small><button type="button" class="zf-unlink" data-zp-split="${i}">${IC.unlink}<span>Ontkoppel</span></button></div>`
      :`<button type="button" class="zf-jrow" data-zp-jpick="${i}" aria-pressed="false" aria-label="${rgbw?'Receiver':'Ledline'} ${i+1} kiezen"><span class="zf-jtick" aria-hidden="true">${IC.check}</span><span class="zf-cnum">${i+1}</span>${bar(u)}<small>${size(u)}</small></button>`;
    return `<section class="zf-gsec zf-joinsec2" data-joinsec>${gh('samenvoegen',rgbw?'Receivers samenvoegen':'Ledlines samenvoegen')}`+
      `<div class="zf-joinanim${rgbw?' is-rgbw':''}" aria-hidden="true"><span class="zf-ja-a"><b>1</b></span><span class="zf-ja-b"><b>2</b></span><i class="zf-ja-run"></i></div>`+
      `<p class="zf-hint">${rgbw?'Horen twee of meer receivers bij elkaar, bijvoorbeeld op één lange wand? Voeg ze samen. Ze werken dan als één, ook bij een looplicht.':'Is één ledline te kort, bijvoorbeeld voor een wand van 6,3 m? Voeg er twee of meer samen. Ze werken dan als één ledline, ook bij Apart en bij een looplicht.'}</p>`+
      `<div class="zf-jlist" role="group" aria-label="Kies wat samen moet">${units.map(row).join('')}</div>`+
      `<button type="button" class="zf-joingo" data-zp-joingo disabled>${IC.link}<span>Tik er 2 of meer aan</span></button></section>`;}
  function joinLabel(el){const on=[...el.querySelectorAll('[data-zp-jpick][aria-pressed=true]')].map(b=>+b.dataset.zpJpick+1),go=el.querySelector('[data-zp-joingo]');if(!go)return;
    go.disabled=on.length<2;const list=on.length>1?on.slice(0,-1).join(', ')+' en '+on[on.length-1]:'';
    go.querySelector('span').textContent=on.length<2?(on.length?'Tik er nog één aan':'Tik er 2 of meer aan'):`Voeg ${list} samen`;go.classList.toggle('is-ready',on.length>=2);}
  function joinPicked(el){if(!last)return;const units=unitsOf(last),pick=[...el.querySelectorAll('[data-zp-jpick][aria-pressed=true]')].map(b=>+b.dataset.zpJpick).sort((a,b)=>a-b);if(pick.length<2)return;
    const ids=pick.flatMap(i=>units[i].ids),groups=joinedOf(last).filter(g=>!g.some(id=>ids.includes(id)));groups.push((last.lines||[]).map(l=>l.id).filter(id=>ids.includes(id)));
    store.set('joined.'+last.id,groups);store.set('timing.'+last.id,null);api.render?.();}
  function splitAt(i){if(!last)return;const u=unitsOf(last)[i];if(!u?.joined)return;store.set('joined.'+last.id,joinedOf(last).filter(g=>g!==u.ids&&g.join()!==u.ids.join()));store.set('timing.'+last.id,null);api.render?.();}
  // ---------- Eigen timing (zoals bij een DMX-sturing): per ledline het moment waarop ze aangaat, binnen één ronde ----------
  function seqCardHtml(d){const q=seqOf(d),units=unitsOf(d);
    return `<section class="card zf-card zp-seqcard" data-zp-seqcard><div class="zf-row"><span><b>Eigen timing</b><small>Jij bepaalt wanneer elke ${d.type==='RGBW'?'receiver':'ledline'} aangaat.</small></span>`+
      `<button type="button" class="switch" role="switch" aria-checked="${q.on}" data-zp="seqon" aria-label="Eigen timing"><span>${q.on?'Aan':'Uit'}</span><i aria-hidden="true"></i></button></div>`+
      `<button type="button" class="zf-seqmini" data-zp="seq" aria-label="Tijdlijn openen"><span class="zf-seqbar">${q.t.map((t,i)=>`<i style="left:${(t/q.dur*100).toFixed(1)}%"><b>${i+1}</b></i>`).join('')}</span></button>`+
      `<button type="button" class="button full zf-go" data-zp="seq">${IC.expand}<span>Tijdlijn openen</span></button>`+(units.length?'':'')+`</section>`;}
  function openSeq(){const d=last;if(!d)return;const q=seqOf(d);if(!q.on){q.on=true;saveSeq(d,q);}
    const word=d.type==='RGBW'?'receiver':'ledline',n=q.t.length,fmt=v=>v.toFixed(2).replace('.',',')+' s';
    const el=sheet('zf-page zf-seqpage',`<div class="zf-pagehead">${document.querySelector('.brand-bar')?.outerHTML||''}`+
      `<header class="zf-pagebar"><button type="button" class="zf-backbtn" data-zp-close>${IC.back}<span>Terug</span></button><b>Eigen timing</b><button type="button" class="zf-round" data-zp-close aria-label="Sluiten">${IC.close}</button></header></div>`+
      `<div class="preview-wrap v50-control-preview zf-stage zf-seqstage"><canvas class="zf-stagecv" data-zp-seqcv role="img" aria-label="Voorbeeld van de eigen timing"></canvas></div>`+
      `<section class="card zf-card zf-seqtapcard"><button type="button" class="zf-seqtap" data-seqtap><b data-seqtaptitle>Tik het ritme</b><small data-seqtapsay></small><span class="zf-seqtapdots" data-seqtapdots>${q.t.map(()=>'<i></i>').join('')}</span></button></section>`+
      `<section class="card zf-card zf-seqcard"><header class="zf-cardhead"><h3>Bijstellen</h3><span class="zf-count">sleep, of tik − en +</span></header><div class="zf-seqrows" data-seqrows></div><div class="zf-seqscale" data-seqscale></div></section>`+
      `<section class="card zf-card"><div class="slider-row zf-slider"><label for="zp-seqdur"><span>Eén ronde duurt</span><output data-seqout="dur"></output></label><input id="zp-seqdur" type="range" min="1" max="10" step="0.1" value="${q.dur}" data-seq="dur"></div>`+
      `<div class="slider-row zf-slider"><label for="zp-seqhold"><span>Zo lang blijft het licht aan</span><output data-seqout="hold"></output></label><input id="zp-seqhold" type="range" min="0.05" max="2" step="0.05" value="${q.hold}" data-seq="hold"></div></section>`+
      `<section class="card zf-card"><h3 class="zf-seqh">Zacht of hard</h3>`+
      `<div class="slider-row zf-slider"><label for="zp-seqin"><span>Aangaan</span><output data-seqout="in"></output></label><input id="zp-seqin" type="range" min="0" max="1" step="0.05" value="${q.in??.04}" data-seq="in"></div>`+
      `<div class="slider-row zf-slider"><label for="zp-seqout"><span>Uitgaan</span><output data-seqout="out"></output></label><input id="zp-seqout" type="range" min="0" max="2" step="0.05" value="${q.out??Math.max(.12,q.hold*.6)}" data-seq="out"></div></section>`+
      `<section class="card zf-card"><h3 class="zf-seqh">Snel instellen</h3><div class="zf-seqpresets">${[['even','Gelijk verdeeld',[4,29,54,79]],['pause','Met een pauze',[4,18,32,82]],['pairs','Twee aan twee',[4,18,54,68]],['fast','Snel na elkaar',[4,13,22,31]]].map(([k,t,x])=>`<button type="button" data-seqpreset="${k}"><b>${t}</b><span class="zf-seqpat" aria-hidden="true">${x.map(v=>`<i style="left:${v}%"></i>`).join('')}</span></button>`).join('')}</div><button type="button" class="zf-textbtn" data-seqreverse>Volgorde omkeren (${n} → 1)</button></section>`+
      `<button type="button" class="button secondary full" data-seqoff>Terug naar de gewone animatie</button><button type="button" class="button full zf-go zf-pageback" data-zp-close>${IC.check}<span>Klaar</span></button>`);
    el.dataset.zpRefresh='seq';
    const rows=el.querySelector('[data-seqrows]'),scale=el.querySelector('[data-seqscale]'),save=()=>saveSeq(d,q);
    const fill=i=>i.style.setProperty('--fill',((+i.value-(+i.min||0))/((+i.max||100)-(+i.min||0)||1)*100)+'%');
    const draw=()=>{rows.innerHTML=q.t.map((t,i)=>`<div class="zf-seqrow"><div class="zf-seqtrack" data-seqtrack="${i}"><i class="zf-seqhold" style="left:${(t/q.dur*100).toFixed(2)}%;width:${(Math.min(q.hold,q.dur-t)/q.dur*100).toFixed(2)}%"></i><button type="button" class="zf-seqdot" data-seqdot="${i}" style="left:${(t/q.dur*100).toFixed(2)}%" aria-label="${word} ${i+1}, begint na ${fmt(t)}">${i+1}</button></div><span class="zf-seqnudge"><button type="button" data-seqnudge="${i}" data-by="-0.05" aria-label="Eerder">−</button><output>${fmt(t)}</output><button type="button" data-seqnudge="${i}" data-by="0.05" aria-label="Later">+</button></span></div>`).join('')+`<i class="zf-seqhead" data-seqhead aria-hidden="true"></i>`;
      const steps=Math.min(10,Math.max(2,Math.round(q.dur)));
      rows.insertAdjacentHTML('afterbegin',`<div class="zf-seqgrid" aria-hidden="true">${Array.from({length:steps+1},(_,k)=>`<i style="left:${(k/steps*100).toFixed(2)}%"></i>`).join('')}</div>`);
      const soft=v=>v<=.02?'meteen':fmt(v);el.querySelector('[data-seqout="in"]').textContent=soft(q.in??.04);el.querySelector('[data-seqout="out"]').textContent=soft(q.out??Math.max(.12,q.hold*.6));
      scale.innerHTML=Array.from({length:steps+1},(_,k)=>`<span style="left:${(k/steps*100).toFixed(2)}%">${(q.dur*k/steps).toFixed(q.dur<=3?1:0).replace('.',',')} s</span>`).join('');
      el.querySelector('[data-seqout="dur"]').textContent=fmt(q.dur);el.querySelector('[data-seqout="hold"]').textContent=fmt(q.hold);el.querySelectorAll('input[type=range]').forEach(fill);};
    draw();requestAnimationFrame(()=>el.querySelector('.zf-panel')?.style.setProperty('--zf-seqtop',(el.querySelector('.zf-pagehead')?.offsetHeight||118)+'px'));
    // het voorbeeld en de lijn die meeloopt met de tijd
    const cv=el.querySelector('[data-zp-seqcv]'),units=unitsOf(d),cols=['#FF5E3A','#FFB020','#2F6BFF','#9B4DFF','#1FC45B','#FF2D92'];
    const tick=()=>{if(!el.isConnected)return;const now=performance.now()/1000;
      try{root.LightningZoneLines?.draw(cv,{zoneRows:units.map((u,i)=>({lineId:u.ids[0],type:d.type,selected:true,pixels:Array.from({length:Math.max(8,Math.min(160,u.pixels||40))},()=>[255,255,255])})),
        zoneTiming:{...q,colours:last?.colours?.length?last.colours:cols},time:now,layout:'stacked',zoneVertical:vertical(d)&&d.layout!=='continuous'});}catch(_){}
      const hd=el.querySelector('[data-seqhead]'),tr=el.querySelector('.zf-seqtrack');if(hd&&tr){const r=tr.getBoundingClientRect(),b=rows.getBoundingClientRect(),tau=now%q.dur;hd.style.left=(r.left-b.left+r.width*tau/q.dur).toFixed(1)+'px';
        rows.querySelectorAll('.zf-seqdot').forEach((dot,i)=>dot.classList.toggle('is-on',(root.LightningZoneLines?.level(q,i,now)||0)>.45));}
      requestAnimationFrame(tick);};requestAnimationFrame(tick);
    let drag=null;
    const moveTo=(i,x)=>{const tr=el.querySelector(`[data-seqtrack="${i}"]`);if(!tr)return;const r=tr.getBoundingClientRect(),t=Math.max(0,Math.min(q.dur-.05,(x-r.left)/r.width*q.dur));q.t[i]=Math.round(t*20)/20;
      const dot=tr.querySelector('.zf-seqdot'),hold=tr.querySelector('.zf-seqhold');dot.style.left=hold.style.left=(q.t[i]/q.dur*100).toFixed(2)+'%';hold.style.width=(Math.min(q.hold,q.dur-q.t[i])/q.dur*100).toFixed(2)+'%';tr.parentElement.querySelector('output').textContent=fmt(q.t[i]);};
    let taps=[],idle=0;
    const tapUi=()=>{el.querySelector('[data-seqtap]').classList.toggle('is-rec',taps.length>0);el.querySelectorAll('[data-seqtapdots] i').forEach((x,k)=>x.classList.toggle('on',k<taps.length));
      const t=el.querySelector('[data-seqtaptitle]'),sy=el.querySelector('[data-seqtapsay]');
      if(!taps.length){t.textContent='Tik het ritme';sy.textContent=`Tik ${n} keer, in het ritme dat je wil. Eén tik per ${word}.`;}else{t.textContent=`Tik voor ${word} ${taps.length+1}`;sy.textContent=`${taps.length} van ${n} · blijf tikken`;}};
    tapUi();
    el.querySelector('[data-seqtap]').addEventListener('pointerdown',e=>{e.preventDefault();const now=performance.now()/1000;clearTimeout(idle);taps.push(now);
      if(taps.length<n){tapUi();idle=setTimeout(()=>{taps=[];tapUi();},4000);return;}
      const rel=taps.map(v=>v-taps[0]),gaps=rel.slice(1).map((v,k)=>v-rel[k]),avg=gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:.4;
      q.dur=Math.min(10,Math.max(1,+(rel[n-1]+Math.max(.6,avg)).toFixed(1)));q.t=rel.map(v=>Math.round(Math.min(q.dur-.05,v)*20)/20);q.on=true;taps=[];save();
      el.querySelector('#zp-seqdur').value=q.dur;draw();tapUi();el.querySelector('[data-seqtaptitle]').textContent='Staat erin ✓';setTimeout(()=>{if(el.isConnected&&!taps.length)tapUi();},1600);});
    rows.addEventListener('pointerdown',e=>{if(e.target.closest('[data-seqnudge]'))return;const tr=e.target.closest('[data-seqtrack]');if(!tr)return;drag={i:+tr.dataset.seqtrack,id:e.pointerId};try{rows.setPointerCapture(e.pointerId);}catch(_){}moveTo(drag.i,e.clientX);e.preventDefault();});
    rows.addEventListener('pointermove',e=>{if(drag&&e.pointerId===drag.id)moveTo(drag.i,e.clientX);});
    const end=e=>{if(drag&&e.pointerId===drag.id){drag=null;save();}};rows.addEventListener('pointerup',end);rows.addEventListener('pointercancel',end);
    el.addEventListener('input',e=>{const k=e.target.dataset?.seq;if(!k)return;const old=q.dur;q[k]=+e.target.value;if(k==='dur')q.t=q.t.map(t=>+(t*q.dur/old).toFixed(2));save();draw();});
    el.addEventListener('click',e=>{const pr=e.target.closest('[data-seqpreset]');
      if(pr){const D=q.dur,k=pr.dataset.seqpreset;q.t=k==='even'?q.t.map((_,i)=>i*D/n):k==='pause'?q.t.map((_,i)=>i<n-1?i*Math.min(.3,D*.5/n):D*.75):k==='pairs'?q.t.map((_,i)=>Math.floor(i/2)*(D/Math.ceil(n/2))+(i%2)*Math.min(.25,D*.4/n)):q.t.map((_,i)=>i*Math.min(.12,D*.4/n));
        q.t=q.t.map(t=>Math.round(Math.min(D-.05,t)*20)/20);save();draw();return;}
      if(e.target.closest('[data-seqreverse]')){q.t=q.t.slice().reverse();save();draw();return;}
      const ng=e.target.closest('[data-seqnudge]');if(ng){const i=+ng.dataset.seqnudge;q.t[i]=Math.max(0,Math.min(q.dur-.05,+(q.t[i]+(+ng.dataset.by)).toFixed(2)));save();draw();return;}
      if(e.target.closest('[data-seqoff]')){q.on=false;save();closeTop();api.render?.();return;}
      if(e.target.closest('[data-zp-close]'))setTimeout(()=>api.render?.(),0);});}
  // 15 nov (prototype UG): het tandwiel is een eigen pagina over het hele scherm, met een pijl terug
  function openGear(){if(!last)return;const el=sheet('zf-gearsheet'+(root.LightningStandHome?' zp-gearfull':''),gearHtml(last));el.dataset.zpRefresh='gear';}
  function refreshSheet(el){if(el.dataset.zpRefresh!=='gear'||!last)return;const panel=el.querySelector('.zf-panel'),top=panel.scrollTop;panel.innerHTML=gearHtml(last);panel.scrollTop=top;}
  // Het kleurvenster van de app (een animatiekleur of de achtergrond kiezen) vanuit de zonepagina: zoals het
  // kleurvenster van het prototype (wiel, Bewaarde kleuren als bolletjes, Fijn instellen, Klaar). De oude delen
  // (Kleurpresets, Kunstmatig warmwit, Merkkleuren, uitleg) staan verborgen (zone-page.css); hun knoppen doen het werk.
  let dlgObserver=null,dlgSig='';
  function syncDialog(force){
    const d=document.querySelector('#effect-dialog[open]'),page=document.querySelector('[data-zone-page="c250"]'),stand=d?.querySelector('[data-stand-control-sheet]');
    const pk=d&&page?d.querySelector('[data-colour-picker="animation"],[data-colour-picker="background"]'):stand?stand.querySelector('[data-colour-picker="static"],[data-colour-picker="animation"],[data-colour-picker="background"]'):null;
    if(!pk){if(d)delete d.dataset.zpDialog;dlgObserver?.disconnect();dlgObserver=null;dlgSig='';return;}
    d.dataset.zpDialog='1';
    let box=pk.nextElementSibling?.matches?.('[data-zp-scards]')?pk.nextElementSibling:null;
    const warm=pk.dataset.colourPicker==='static';
    if(!box){pk.insertAdjacentHTML('afterend',`<div class="zp-cards zp-dlgcards" data-zp-scards>${warm?'<div data-zp-slot="warm"></div>':''}<div data-zp-slot="saved"></div></div>`);box=pk.nextElementSibling;dlgSig='';}
    const html=(warm?warmHtml(pk):'')+'\u0000'+savedHtml(pk);if(force||html!==dlgSig){dlgSig=html;const w=box.querySelector('[data-zp-slot="warm"]');if(w)w.innerHTML=warmHtml(pk);box.querySelector('[data-zp-slot="saved"]').innerHTML=savedHtml(pk);}
    if(!dlgObserver){let q=0;dlgObserver=new MutationObserver(()=>{if(q)return;q=1;queueMicrotask(()=>{q=0;syncDialog();});});dlgObserver.observe(d,{subtree:true,childList:true,attributes:true,attributeFilter:['open','style']});}
  }
  document.addEventListener('click',e=>{const h=e.target instanceof Element&&e.target.closest('#effect-dialog[data-zp-dialog] [data-colour-fine]>h3');if(h)h.parentElement.classList.toggle('is-open');});
  document.addEventListener('click',e=>{const t=e.target instanceof Element?e.target:null;
    if(t?.closest('[data-zone-page="c250"] :is([data-action="palette-edit"],[data-action="background-edit"],[data-action="palette-add"])'))setTimeout(syncDialog,0);},false);
  // ---------- Kleur: tikken, schuiven en slepen in de nieuwe kaarten ----------
  function colourAct(t){
    const dlg=t.closest('dialog[data-zp-dialog]'),page=t.closest('[data-zone-page="c250"]')||(dlg?document.querySelector('[data-zone-page="c250"]'):null);if(!page&&!dlg)return false;
    const own=t.closest('[data-zp-scards]')?.previousElementSibling;
    const pk=own?.matches?.('[data-colour-picker]')?own:page?.querySelector('[data-colour-picker="static"]'),ws=page?.querySelector('[data-gradient-workspace]'),G2=page?gApi():null,st=G2?.state();
    const hidden=sel=>(ws||pk)?.querySelector(sel)||pk?.querySelector(sel);
    const card=t.closest('[data-zp-gcolour]');
    const pt=t.closest('[data-zpc-point]');if(pt&&G2){G2.select(+pt.dataset.zpcPoint);syncColour(page);setTimeout(()=>snapWheel(true),60);return true;}
    const z=t.closest('[data-zpc]');
    if(z&&G2&&st){const k=z.dataset.zpc;
      if(k==='add'){G2.add(nextColour(st.stops[st.stops.length-1].color));}
      else if(k==='del')G2.remove(st.selected);else if(k==='even')G2.even();
      syncColour(page);return true;}
    const cs=t.closest('[data-zpc-chstep]');if(cs&&card){const r=card.querySelector(`[data-zpc-ch="${cs.dataset.zpcChstep}"]`);if(r){r.value=Math.max(0,Math.min(255,+r.value+(+cs.dataset.d)));setFromChannels(card);}return true;}
    const ct=t.closest('[data-zpc-chtoggle]');if(ct&&card){const r=card.querySelector(`[data-zpc-ch="${ct.dataset.zpcChtoggle}"]`);if(r){r.value=+r.value>0?0:255;setFromChannels(card);syncColour(page);}return true;}
    const zs=t.closest('[data-zps],[data-zps-use],[data-zps-del],[data-zps-gload],[data-zps-gdel],[data-zps-gex],[data-zps-pick]');
    if(zs){const d=zs.dataset;
      // in de kleurstand: een verloop kiezen maakt er eerst een verloop van (zoals + Verloop)
      if((d.zpsGload||d.zpsGex)&&ws&&ws.dataset.gradientMode!=='gradient'){const on=page?.querySelector('[data-zp-solidhead] [data-zp-gradient="on"]');if(on){on.click();setTimeout(()=>{const w2=document.querySelector('[data-zone-page="c250"] [data-gradient-workspace]');(d.zpsGload?w2?.querySelector(`[data-gradient-load="${CSS.escape(d.zpsGload)}"]`):w2?.querySelector(`[data-gradient-builtin="${CSS.escape(d.zpsGex)}"]`))?.click();setTimeout(()=>{const pg=document.querySelector('[data-zone-page="c250"]');if(pg)syncColour(pg);},60);},120);return true;}}
      if(d.zpsPick){const [r,g,b,w]=d.zpsPick.split(',').map(Number),G2=gApi(),st=G2?.state();if(G2&&st&&[r,g,b].every(Number.isFinite)){G2.setColour(st.selected,Cl().hex([r,g,b]),Number.isFinite(w)?w:0);const pg=document.querySelector('[data-zone-page="c250"]');slotSig.gcolour=null;if(pg)syncColour(pg);}return true;}
      if(d.zps==='save')hidden('.my-colours [data-action="colour-new"]')?.click();
      else if(d.zps==='undo')hidden('.my-colours [data-action="colour-undo"]')?.click();
      else if(d.zps==='gsave')hidden('[data-gradient-save]')?.click();
      else if(d.zps==='gundo')gApi()?.undoRemovePreset?.();
      else if(d.zpsUse)pk?.querySelector(`.saved-colour[data-action="swatch"][data-id="${CSS.escape(d.zpsUse)}"]`)?.click();
      else if(d.zpsDel)pk?.querySelector(`[data-action="colour-preset-remove667"][data-id="${CSS.escape(d.zpsDel)}"]`)?.click();
      else if(d.zpsGload)ws?.querySelector(`[data-gradient-load="${CSS.escape(d.zpsGload)}"]`)?.click();
      else if(d.zpsGdel)gApi()?.removePreset?.(d.zpsGdel);
      else if(d.zpsGex)ws?.querySelector(`[data-gradient-builtin="${CSS.escape(d.zpsGex)}"]`)?.click();
      setTimeout(()=>{const pg=document.querySelector('[data-zone-page="c250"]');if(pg)syncColour(pg);syncDialog();},60);return true;}
    const w=t.closest('[data-zpw="toggle"]');
    if(w&&pk){const on=w.getAttribute('aria-checked')==='true';
      if(!on)pk.querySelector('[data-action="warm-white"]')?.click();
      else{const r=pk.querySelector('input[data-channel="w"]');if(r){r.value=0;r.dispatchEvent(new Event('input',{bubbles:true}));}}
      setTimeout(()=>{const pg=document.querySelector('[data-zone-page="c250"]');if(pg)syncColour(pg);syncDialog(true);},60);return true;}
    return false;
  }
  document.addEventListener('input',e=>{
    const t=e.target instanceof Element?e.target:null,page=t?.closest('[data-zone-page="c250"]');if(!page)return;
    if(t.matches('[data-zpc-ch]')){t.style.setProperty('--fill',(t.value/2.55).toFixed(1)+'%');setFromChannels(t.closest('[data-zp-gcolour]'));return;}
    if(t.matches('[data-zpc-chnum]')){const card=t.closest('[data-zp-gcolour]'),r=card?.querySelector(`[data-zpc-ch="${t.dataset.zpcChnum}"]`);const v=Math.round(+t.value);if(r&&Number.isFinite(v)&&v>=0&&v<=255){r.value=v;setFromChannels(card);}return;}
    if(t.matches('[data-zpc-bri]')){const o=page.querySelector('[data-gradient-brightness]');t.style.setProperty('--fill',t.value+'%');const out=page.querySelector('[data-zpc-briout]');if(out)out.textContent=t.value+'%';
      if(o){o.value=t.value;o.dispatchEvent(new Event('input',{bubbles:true}));}return;}
    if(t.matches('[data-zpw-warmth]')){const o=page.querySelector('[data-colour-picker="static"] input[data-warmth]');t.style.setProperty('--fill',t.value+'%');const out=page.querySelector('[data-zpw-out]');if(out)out.textContent=t.value+'%';
      if(o){o.value=t.value;o.dispatchEvent(new Event('input',{bubbles:true}));}return;}
  });
  // slepen in het kleurwiel en op de balk: live, en pas bij loslaten de kaart opnieuw
  document.addEventListener('pointerdown',e=>{
    const t=e.target instanceof Element?e.target:null,card=t?.closest('[data-zp-gcolour]');if(!card||e.button!==0)return;
    const G2=gApi();if(!G2)return;
    const wheel=t.closest('[data-zpc-wheel]'),stop=t.closest('[data-zpc-stop]');if(!wheel&&!stop)return;
    e.preventDefault();gDrag=true;const id=e.pointerId,el=wheel||stop;try{el.setPointerCapture(id);}catch(_){}
    const idx=stop?+stop.dataset.zpcStop:null;if(stop){G2.select(idx);card.querySelectorAll('[data-zpc-stop],[data-zpc-point]').forEach(b=>b.classList.toggle('is-on',+(b.dataset.zpcStop??b.dataset.zpcPoint)===idx));}
    let queued=null;
    const apply=ev=>{const st=G2.state();if(!st)return;
      if(wheel){const r=wheel.getBoundingClientRect();if(!(r.width>0))return;const rgb=Cl().fromPoint((ev.clientX-r.left)/r.width*260,(ev.clientY-r.top)/r.height*260,260);const x=st.stops[st.selected];G2.setColour(st.selected,Cl().hex(rgb),x?.white||0);}
      else{const rail=card.querySelector('[data-zpc-rail]').getBoundingClientRect();if(!(rail.width>0))return;G2.move(idx,(ev.clientX-rail.left)/rail.width*100);}
      liveColour(card);};
    const move=ev=>{if(ev.pointerId!==id)return;queued=ev;requestAnimationFrame(()=>{if(queued){const q=queued;queued=null;apply(q);}});};
    const end=ev=>{if(ev.pointerId!==id)return;el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);
      if(ev.type==='pointerup'&&wheel)apply(ev);gDrag=false;const pg=card.closest('[data-zone-page="c250"]');slotSig.gcolour=null;if(pg)syncColour(pg);};
    el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
    if(wheel)apply(e);
  },true);
  // de bolletjes van een verloop verslepen om de volgorde te veranderen (zoals in het prototype, de eigenaar 15 nov):
  // de andere kleuren schuiven opzij, de dichtste plaats wint; daarna weer gelijk verdeeld
  let pDrag=null,pDragDone=0;
  document.addEventListener('pointerdown',e=>{
    const t=e.target instanceof Element?e.target:null,el=t?.closest('[data-zp-gcolour] .zf-points [data-zpc-point]');if(!el||e.button!==0)return;
    const items=[...el.parentElement.querySelectorAll('[data-zpc-point]')];if(items.length<2)return;
    pDrag={el,items,from:items.indexOf(el),x:e.clientX,y:e.clientY,on:false,id:e.pointerId};
  },true);
  document.addEventListener('pointermove',e=>{const d=pDrag;if(!d||e.pointerId!==d.id)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(!d.on){if(Math.hypot(dx,dy)<6)return;d.on=true;gDrag=true;d.to=d.from;try{d.el.setPointerCapture(d.id);}catch(_){}
      d.slots=d.items.map(it=>{const r=it.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
      d.items.forEach(it=>it.classList.toggle('is-shifting',it!==d.el));d.el.classList.add('is-dragging');document.body.classList.add('zf-dragging');}
    e.preventDefault();d.el.style.transform=`translate(${dx}px,${dy}px) scale(1.14)`;
    const cx=d.slots[d.from].x+dx,cy=d.slots[d.from].y+dy;let best=d.from,bd=1e9;
    d.slots.forEach((p,k)=>{const q=Math.hypot(cx-p.x,cy-p.y);if(q<bd){bd=q;best=k;}});
    if(best===d.to)return;d.to=best;
    const order=d.items.map((_,k)=>k);order.splice(d.to,0,order.splice(d.from,1)[0]);
    order.forEach((k,n)=>{if(k===d.from)return;const a=d.slots[k],b=d.slots[n];d.items[k].style.transform=n===k?'':`translate(${b.x-a.x}px,${b.y-a.y}px)`;});
  },{passive:false,capture:true});
  const pDragEnd=e=>{const d=pDrag;if(!d||(e.pointerId!==undefined&&e.pointerId!==d.id))return;pDrag=null;if(!d.on)return;
    document.body.classList.remove('zf-dragging');pDragDone=performance.now();gDrag=false;
    d.items.forEach(it=>{it.style.transform='';it.classList.remove('is-shifting','is-dragging');});
    const card=d.el.closest('[data-zp-gcolour]'),pg=card?.closest('[data-zone-page="c250"]');
    if(d.to!==undefined&&d.to!==d.from)gApi()?.reorder?.(d.from,d.to);
    slotSig.gcolour=null;if(pg)syncColour(pg);};
  document.addEventListener('pointerup',pDragEnd,true);document.addEventListener('pointercancel',pDragEnd,true);
  document.addEventListener('click',e=>{if(performance.now()-pDragDone<350&&e.target instanceof Element&&e.target.closest('[data-zp-gcolour]')){e.stopPropagation();e.preventDefault();}},true);
  // Bewaarde kleuren en verlopen verslepen zonder knop Wijzigen (de eigenaar 15 nov): even vasthouden, dan slepen; vegen scrolt
  // gewoon. De dichtste plaats wint; de app bewaart de nieuwe volgorde.
  let sDrag=null,sDragDone=0;
  document.addEventListener('pointerdown',e=>{
    const t=e.target instanceof Element?e.target:null,el=t?.closest('[data-zp-sort] [data-zps-item]');if(!el||e.button!==0||t.closest('.zf-x'))return;
    const box=el.closest('[data-zp-sort]'),items=[...box.querySelectorAll('[data-zps-item]')];if(items.length<2)return;
    const d={el,box,items,from:items.indexOf(el),x:e.clientX,y:e.clientY,on:false,id:e.pointerId};sDrag=d;
    d.timer=setTimeout(()=>{if(sDrag!==d)return;d.on=true;d.to=d.from;try{el.setPointerCapture(d.id);}catch(_){}try{navigator.vibrate?.(8);}catch(_){}
      d.slots=items.map(it=>{const r=it.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
      items.forEach(it=>it.classList.toggle('is-shifting',it!==el));el.classList.add('is-dragging');el.style.transform='scale(1.14)';document.body.classList.add('zf-dragging');},260);
  },true);
  document.addEventListener('pointermove',e=>{const d=sDrag;if(!d||e.pointerId!==d.id)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(!d.on){if(Math.hypot(dx,dy)>8){clearTimeout(d.timer);sDrag=null;}return;}   // vegen voor het vasthouden: gewoon scrollen
    e.preventDefault();d.el.style.transform=`translate(${dx}px,${dy}px) scale(1.14)`;
    const cx=d.slots[d.from].x+dx,cy=d.slots[d.from].y+dy;let best=d.from,bd=1e9;
    d.slots.forEach((p,k)=>{const q=Math.hypot(cx-p.x,cy-p.y);if(q<bd){bd=q;best=k;}});
    if(best===d.to)return;d.to=best;
    const order=d.items.map((_,k)=>k);order.splice(d.to,0,order.splice(d.from,1)[0]);
    order.forEach((k,n)=>{if(k===d.from)return;const a=d.slots[k],b=d.slots[n];d.items[k].style.transform=n===k?'':`translate(${b.x-a.x}px,${b.y-a.y}px)`;});
  },{passive:false,capture:true});
  // tijdens het slepen mag de pagina niet scrollen (iPhone: alleen touchmove kan dat nog tegenhouden)
  document.addEventListener('touchmove',e=>{if(sDrag?.on&&e.cancelable)e.preventDefault();},{passive:false,capture:true});
  const sDragEnd=e=>{const d=sDrag;if(!d||(e.pointerId!==undefined&&e.pointerId!==d.id))return;sDrag=null;clearTimeout(d.timer);if(!d.on)return;
    document.body.classList.remove('zf-dragging');sDragDone=performance.now();
    d.items.forEach(it=>{it.style.transform='';it.classList.remove('is-shifting','is-dragging');});
    const id=d.el.dataset.zpsItem,kind=d.box.dataset.zpSort;
    if(d.to!==undefined&&d.to!==d.from){
      if(kind==='gradient')gApi()?.movePreset?.(id,d.to);
      else{const [moved]=d.items.splice(d.from,1);d.items.splice(d.to,0,moved);d.items.forEach(it=>d.box.appendChild(it));void api.colourMove?.(id,d.to);}}
    setTimeout(()=>{const pg=document.querySelector('[data-zone-page="c250"]');slotSig={};if(pg)syncColour(pg);syncDialog(true);},250);};
  document.addEventListener('pointerup',sDragEnd,true);document.addEventListener('pointercancel',sDragEnd,true);
  document.addEventListener('click',e=>{if(performance.now()-sDragDone<400&&e.target instanceof Element&&e.target.closest('[data-zp-sort]')){e.stopPropagation();e.preventDefault();}},true);
  // Het kleurenwiel staat altijd helemaal in beeld (de eigenaar 15 nov: "als je scrolt dat het in plaats snapt dat je altijd goed
  // zit"). Na het scrollen, als de vinger los is: staat het wiel half onder de kop of onder de onderbalk, dan schuift de
  // pagina zacht tot het er helemaal staat. Alleen als het grotendeels in beeld is (anders wil je verder scrollen) en past.
  let snapT=0,touching=false,snapUntil=0,scrolled=false,lastLift=0;   // scrolled: de klant heeft zelf gescrold (niet na een tik, een sleep of een scroll van de app)
  function wheelBox(){const ws=[...document.querySelectorAll('[data-zone-page="c250"] .zp-body .wheel-wrap')].filter(w=>w.offsetParent&&w.getBoundingClientRect().height>40);return ws[0]||null;}
  function snapWheel(force=false){
    if(touching||gDrag||pDrag?.on||sDrag?.on||stack.length||performance.now()<snapUntil)return;
    const w=wheelBox();if(!w)return;
    // bovenaan: de kop, en bij een verloop de bolletjes die eronder blijven staan
    const dots=null;   // ingeklapt staan de bolletjes in de kop: die rekent al mee
    const need=()=>{const dock=document.querySelector('[data-zp-dock]'),r=w.getBoundingClientRect(),dockB=dock?.getBoundingClientRect().bottom||0,top=dockB+(dots?dots.offsetHeight:0)+12,
      nav=document.querySelector('#navigation')?.getBoundingClientRect(),bottom=(nav&&nav.height>0&&nav.top<innerHeight?nav.top:innerHeight)-12;   // de onderbalk staat vast: geen offsetParent
      // past het nog niet omdat de kop open staat: naar beneden; de kop klapt dan in en de volgende stap zet het goed
      if(r.height>bottom-top)return r.bottom>bottom&&dock&&!dock.classList.contains('is-compact')?{seen:Math.max(0,bottom-r.top)/r.height,dy:r.bottom-bottom}:null;
      return {seen:Math.max(0,Math.min(r.bottom,bottom)-Math.max(r.top,top))/r.height,dy:r.top<top?r.top-top:r.bottom>bottom?r.bottom-bottom:0};};
    const first=need();if(!first||first.seen>.97||!force&&first.seen<.35||Math.abs(first.dy)<4)return;
    // de kop klapt mee in of uit en houdt daarbij de inhoud op zijn plaats: dan beweegt de pagina minder dan gevraagd.
    // Daarom een paar keer bijsturen tot het wiel echt helemaal in beeld staat.
    let n=0;const step=()=>{const m=need();if(!m||Math.abs(m.dy)<4||n++>4||touching){snapUntil=0;return;}
      snapUntil=performance.now()+600;root.scrollBy({top:m.dy,behavior:reduce()?'auto':'smooth'});setTimeout(step,reduce()?60:430);};
    step();
  }
  const queueSnap=()=>{clearTimeout(snapT);snapT=setTimeout(()=>snapWheel(false),180);};
  // een nieuwe aanraking stopt een lopende inklik meteen (de pagina blijft staan waar ze is)
  document.addEventListener('touchstart',()=>{touching=true;scrolled=false;clearTimeout(snapT);if(performance.now()<snapUntil){snapUntil=0;root.scrollTo({top:root.scrollY,behavior:'auto'});}},{passive:true,capture:true});
  const lift=()=>{touching=false;lastLift=performance.now();if(scrolled)queueSnap();};
  document.addEventListener('touchend',lift,{passive:true,capture:true});document.addEventListener('touchcancel',lift,{passive:true,capture:true});
  root.addEventListener('scroll',()=>{dockVar();if(performance.now()<snapUntil||gDrag||pDrag?.on||sDrag?.on||!document.querySelector('[data-zone-page="c250"] [data-zp-mode="colour"]'))return;if(touching){scrolled=true;return;}if(scrolled&&performance.now()-lastLift<3000)queueSnap();},{passive:true});   // ook het uitlopen na loslaten
  // de onderkant van de kop als maat voor wat eronder blijft staan (de bolletjes van een verloop)
  let dockRaf=0;function dockVar(){if(dockRaf)return;dockRaf=requestAnimationFrame(()=>{dockRaf=0;const d=document.querySelector('[data-zp-dock]');if(d)document.documentElement.style.setProperty('--zp-dock-bottom',Math.round(d.getBoundingClientRect().bottom)+'px');});}
  // ---------- klikken ----------
  document.addEventListener('click',e=>{const b=e.target instanceof Element&&e.target.closest('.zp-a1set .zp-dirs button');if(!b)return;
    const box=b.closest('.zp-dirs'),bounce=box.querySelector('[data-zp-bounce]');
    if(b.matches('[data-action="direction"]')&&bounce?.getAttribute('aria-pressed')==='true')setTimeout(()=>bounce.click(),0);
    setTimeout(()=>{const on=bounce?.getAttribute('aria-pressed')==='true';box.querySelectorAll('[data-action="direction"]').forEach(x=>{if(on)x.setAttribute('aria-pressed','false');});},30);},true);
  document.addEventListener('input',e=>{const r=e.target;if(!(r instanceof HTMLInputElement)||!r.dataset.setting)return;const row=r.closest('.zp-set');if(!row)return;
    const v=(r.value-r.min)/((r.max-r.min)||1);row.style.setProperty('--v',v.toFixed(3));r.style.setProperty('--fill',(v*100).toFixed(1)+'%');
    if(r.dataset.setting==='objectCount'){const ic=row.querySelector('.alv-si');if(ic)ic.innerHTML='<i></i>'.repeat(Math.max(1,Math.min(8,+r.value)));}});
  document.addEventListener('click',e=>{const b=e.target instanceof Element&&e.target.closest('.zp-a1set [data-action="effect-boolean"],.zp-a1set [data-action="background-toggle"]');if(!b)return;
    setTimeout(()=>{const on=b.getAttribute('aria-pressed')==='true'||b.getAttribute('aria-checked')==='true';const now=b.matches('[data-action="background-toggle"]')?!on:on;
      b.setAttribute('aria-checked',String(now));b.closest('.zp-set')?.classList.toggle('is-on',now);},0);});
  document.addEventListener('click',e=>{
    const t=e.target instanceof Element?e.target:null;if(!t)return;
    if(t.closest('[data-zp-close]')&&t.closest('.zf-sheet')){closeTop();return;}
    if(t.closest('[data-zone-page="c250"] [data-action="preview-fullscreen"]')){e.preventDefault();e.stopPropagation();openFull();return;}
    if(colourAct(t)){e.preventDefault();e.stopPropagation();return;}
    if(t.closest('[data-zp-gradcard],[data-zp-gradient]')&&gradientAct(t)){e.preventDefault();e.stopPropagation();return;}
    const z=t.closest('[data-zp]');
    if(z){const what=z.dataset.zp;
      if(what==='gear')return openGear();
      if(what==='a1settings'){a1Open=true;if(z.closest('#effect-dialog'))api.renderStand?.();else api.render?.();return;}
      if(what==='a1close'){a1Open=false;if(z.closest('#effect-dialog'))api.renderStand?.();else api.render?.();return;}
      if(what==='a1reset'){api.resetAnimation?.();return;}
      if(what==='a1adv'){a1Adv=!a1Adv;const c=z.closest('.zp-adv');c?.classList.toggle('is-open',a1Adv);z.setAttribute('aria-expanded',String(a1Adv));return;}
      if(what==='order'){closeAll();api.order?.();return;}
      if(what==='seq'){if(last&&extras())openSeq();return;}
      if(what==='seqon'&&last&&extras()){const q=seqOf(last);q.on=!q.on;saveSeq(last,q);api.render?.();return;}
      if((what==='intro'||what==='intropro'&&extras())&&last){const rg=last.type==='RGBW';closeAll();root.ZfIntro?.open(what==='intro'?(rg?'rgbw':'spi'):(rg?'prorgbw':'pro'));return;}
      if(what==='tochooser'){const L=document.querySelector('[data-zp-lib]');if(!L)return;const dock=document.querySelector('[data-zp-dock]')?.getBoundingClientRect().bottom||0;
        root.scrollTo({top:Math.max(0,root.scrollY+L.getBoundingClientRect().top-dock-12),behavior:reduce()?'auto':'smooth'});L.classList.remove('is-flash');void L.offsetWidth;L.classList.add('is-flash');return;}
      return;}
    const page=t.closest('[data-zone-page="c250"]'),host=page||t.closest('[data-zp-standlib]');
    const lg=t.closest('[data-zp-g]');if(lg&&host){lib.g=lg.dataset.zpG;applyLib(host);return;}
    const ls=t.closest('[data-zp-sort]');if(ls&&host){lib.sort=ls.dataset.zpSort;applyLib(host);return;}
    const ch=t.closest('[data-zp-tile][data-action="effect"]');if(ch)remember(ch.dataset.zpTile);
    const v=t.closest('[data-zp-view]');
    if(v&&last){setPrefVertical(last.id,v.dataset.zpView==='v');api.render?.();return;}
    const jp=t.closest('[data-zp-jpick]');if(jp){jp.setAttribute('aria-pressed',String(jp.getAttribute('aria-pressed')!=='true'));joinLabel(jp.closest('.zf-sheet'));return;}
    if(t.closest('[data-zp-joingo]')){joinPicked(t.closest('.zf-sheet'));return;}
    const sp=t.closest('[data-zp-split]');if(sp){splitAt(+sp.dataset.zpSplit);return;}
    // een samengevoegde ledline kiezen: de andere delen gaan mee
    const tg=t.closest('.zp-page .v50-preview-line-target');
    if(tg&&last){const g=joinedOf(last).find(x=>x[0]===tg.dataset.id);if(g)setTimeout(()=>{const b=document.querySelector(`.zp-page .v50-preview-line-target[data-id="${CSS.escape(g[0])}"]`);
      if(b?.getAttribute('aria-pressed')!=='true')return;const step=k=>{if(k>=g.length)return;const m=document.querySelector(`.zp-page .v50-preview-line-target[data-id="${CSS.escape(g[k])}"]`);if(m&&m.getAttribute('aria-pressed')!=='true'){m.click();setTimeout(()=>step(k+1),30);}else step(k+1);};step(1);},30);}
    const mv=t.closest('[data-zp-move]');
    if(mv){closeAll();api.moveReceiver?.(mv.dataset.zpMove);return;}
    // 1 ledline of Apart (gaat verder via set-layout van de app): onthoud of het voorbeeld verticaal stond
    const md=t.closest('[data-zp-mode]');
    if(md&&last&&md.dataset.zpMode==='samen'&&last.layout==='vertical')setPrefVertical(last.id,true);
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&stack.length){e.preventDefault();closeTop();}});
  document.addEventListener('input',e=>{const q=e.target instanceof Element&&e.target.closest('[data-zp-q]');if(!q)return;lib.q=q.value;const host=q.closest('[data-zone-page="c250"],[data-zp-standlib]');if(host)applyLib(host);});
  // Alles bedienen (app.js renderStandControls): dezelfde kiezer als de zonepagina, en na het tekenen dezelfde vorm
  function standLibrary(d){const a={families:d.families||[],saved:d.saved||'',savedCount:d.savedCount||0,current:d.current||null};
    if(a1New()){const all=a.families.flatMap(f=>f.effects),n=d.lineCount||1,cur=a.current?.id,cats=['alles',...Object.keys(GROUP).filter(k=>all.some(e=>groupOf(e.category)===k)),'bewaard'];if(!cats.includes(lib.g))lib.g='alles';
      const tile=e=>{const name=noTunnel(e.name),on=cur===e.id,later=n<e.need;return `<button type="button" class="zp-a1tile${on?' is-on':''}" ${later?'disabled':`data-action="${on?'animation-current-edit':'effect'}" data-id="${esc(e.id)}"`} data-zp-tile="${esc(e.id)}" data-zp-cat="${groupOf(e.category)}" data-zp-name="${esc(name.toLowerCase())}" aria-pressed="${on}"><span class="zp-a1tv">${e.preview}${later?`<em class="zf-from">vanaf ${e.need}</em>`:''}${on?'<i class="zp-a1on">Speelt</i>':''}</span><b>${esc(name)}</b></button>`;};
      return `<div class="zf-app zp-standlib" data-zp-standlib><div class="zp-a1chips" data-zp-groups>${cats.map(k=>`<button type="button" data-zp-g="${k}" aria-pressed="${lib.g===k}">${k==='alles'?'Alles':k==='bewaard'?'★ Bewaard':esc(GROUP[k])}</button>`).join('')}</div>`+
        a1Grid(all,tile)+`<div class="zp-saved zp-a1saved" data-zp-saved hidden>${a.savedCount?a.saved:'<p class="zf-none">Nog niets bewaard. Tik op de ster bij een animatie die speelt.</p>'}</div></div>`;}
    return `<div class="zf-app zp-standlib" data-zp-standlib>${libHtml(a,d.lineCount||1,false)}</div>`;}
  function standBind(dialog){if(!dialog)return;const host=dialog.querySelector('[data-zp-standlib]');if(host)applyLib(host);
    const ed=dialog.querySelector('.active-animation-workspace');if(ed)shapeEditor(dialog);syncDialog();}
  return Object.freeze({standA1:standA1Html,standLibrary,standBind,markup,bind,vertical:d=>vertical(d),joined:d=>joinedOf(d),timing,closeAll,isOpen:()=>stack.length>0,openGear});
}
root.LightningZonePage=Object.freeze({create});
}(window));
