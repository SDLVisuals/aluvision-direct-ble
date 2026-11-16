/* De standpagina (prototype ideeen-animaties-instellingen U1, goedgekeurd door de eigenaar op 15 nov: "nu alles inwerken").
 * Bovenaan je stand met de ronde aan/uit-knop, daaronder Alles bedienen en Opslaan als scène, en je zones: voorbeeld,
 * naam met badge SPI/RGBW en dezelfde ronde aan/uit-knop in de kleur van de zone.
 * Dit bestand tekent alleen. De gegevens en wat een knop doet komen van app.js (data-action: zone, zone-power,
 * stand-power, stand-controls, scene-new-current, zone-new, stand-switch-open). */
(function(root){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const I=d=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const PW='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v8"/><path d="M6.7 6.6a7.5 7.5 0 1 0 10.6 0"/></svg>';
// De ronde aan/uit-knop, overal dezelfde: aan = donker met een zachte gloed in de kleur van de zone, uit = licht en grijs.
// value: true, false of 'mixed' (een deel aan: halve gloed).
function power({value=false,size=44,label='',glow='#FF5E3A',action='',id='',disabled=false}={}){
  const on=value===true,mixed=value==='mixed';
  return `<button type="button" class="alv-power${on?' is-on':''}${mixed?' is-mixed':''}" style="--s:${size}px;--g:${esc(glow)}" data-action="${esc(action)}"${id?` data-id="${esc(id)}"`:''} aria-pressed="${on}" aria-label="${esc(label)}"${disabled?' disabled':''}>${PW}</button>`;
}
const iconAll=`<span class="sh-ic sh-wiel" aria-hidden="true"><i class="sh-ring"></i><span class="sh-v4">${'<i></i>'.repeat(4)}</span></span>`;
const iconScene=`<span class="sh-ic sh-mark" aria-hidden="true">${I('<path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1z"/>')}<b>+</b></span>`;
// d: {name, connected, statusText, meta, power:{value,label}, canControl, sceneReady, notices(html), zones:[{id,name,type,meta,preview(html),glow,power:{value,label,empty}}], t(key)}
function markup(d){
  const t=d.t||(k=>k);
  return `<div class="page stand-page sh-page" data-stand-home="1">`+
    `<section class="sh-stand"><div class="sh-standt"><small class="${d.connected?'is-ok':''}"><i></i>${esc(d.statusText)}</small><h1>${esc(d.name)}</h1><span>${esc(d.meta)}</span></div>`+
      power({value:d.power.value,size:58,label:d.power.label,glow:'#FF5E3A',action:'stand-power',disabled:d.power.disabled})+`</section>`+
    (d.notices||'')+
    (d.multiStand?`<button type="button" class="sh-switch" data-action="stand-switch-open">${esc(t('Andere stand openen'))}</button>`:'')+
    `<div class="sh-acts"><button type="button" class="sh-act" data-action="stand-controls"${d.canControl?'':' disabled'}>${iconAll}<b>${esc(t('Alles bedienen'))}</b></button>`+
      `<button type="button" class="sh-act" data-action="scene-new-current"${d.sceneReady?'':' disabled'}>${iconScene}<b>${esc(t('Opslaan als scène'))}</b></button></div>`+
    `<section class="zone-section sh-zones"><div class="sh-zhead"><h2>${esc(t('zones'))}</h2><button type="button" class="sh-new" data-action="zone-new">${I('<path d="M12 5v14M5 12h14"/>')}<span>${esc(t('Nieuwe zone'))}</span></button></div>`+
    `<div class="zone-grid sh-list">${d.zones.map(z=>`<article class="sh-zone${z.power.value===false?' is-off':''}" data-zone-card="${esc(z.id)}"><button type="button" class="sh-zopen" data-action="zone" data-id="${esc(z.id)}" aria-label="${esc(z.name)}"><span class="sh-zprev">${z.preview}</span>`+
      `<span class="sh-zt"><b>${esc(z.name)}</b><small>${z.type?`<span class="sh-badge">${esc(z.type)}</span>`:''}${esc(z.meta)}</small></span></button>`+
      (z.power.empty?'':`<button type="button" class="sh-find" data-action="zone-find" data-id="${esc(z.id)}" aria-pressed="false" aria-label="${esc(t('Waar is {name}?',{name:z.name}))}">${I('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>')}</button>`)+
      power({value:z.power.value,size:44,label:z.power.label,glow:z.glow,action:'zone-power',id:z.id,disabled:z.power.empty})+`</article>`).join('')}`+
    (d.zones.length?'':`<section class="card empty stand-empty-zones sh-empty"><h2>${esc(t('Maak je eerste zone'))}</h2><p>${esc(t('Maak een zone en voeg je verlichting toe.'))}</p></section>`)+`</div></section></div>`;
}
root.LightningStandHome=Object.freeze({markup,power,iconScene});
}(window));
