/* De scènespagina (prototype prototypes/scenes, rustige versie; de eigenaar 15 nov: "ik keur alles goed, nu inbouwen").
 * Eén rij per scène, zoals de zones op de standpagina: het licht van de scène, de naam en dezelfde ronde aan/uit-knop.
 * Tik op de rij = details (de bestaande detailpagina), tik op de knop = de scène aan (of, als ze speelt, alles uit).
 * Dit bestand tekent alleen; de acties zijn die van app.js (scene-new, scene-open, scene-apply, stand-power). */
(function(root){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const PLUS='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
// d: {t, ready, error, active:{name}|null, scenes:[{id,name,preview,meta,state:'ok'|'update'|'off',offText,on,glow}]}
function markup(d){
  const t=d.t||(k=>k),SH=root.LightningStandHome;
  return `<div class="page scenes-page sc-page" data-scene-ui="640" data-scenes-home="1">`+
    `<div class="sc-top"><h1>${esc(t('scenes'))}</h1><button type="button" class="sc-add" data-action="scene-new" aria-label="${esc(t('newScene'))}"${d.ready?'':' disabled'}>${PLUS}</button></div>`+
    `<p class="sc-sub">${d.active?`<i class="sc-ok"></i><b>${esc(d.active.name)}</b> ${esc(t('speelt'))}`:esc(t(d.scenes.length?'Geen scène aan':'Bewaar je licht en haal je favoriete sfeer met één tik terug.'))}</p>`+
    (d.error?`<p class="card ui606-page-error" role="alert">${esc(d.error)}</p>`:'')+
    `<div class="sc-list">${d.scenes.map(s=>`<div class="sc-item${s.on?' is-on':''}${s.state==='off'?' is-off':''}">`+
      `<button type="button" class="sc-open" data-action="scene-open" data-id="${esc(s.id)}"><span class="sc-thumb">${s.preview}</span>`+
      `<span class="sc-it"><b>${esc(s.name)}${s.state==='update'?'<i class="sc-dotupd" aria-hidden="true"></i>':''}</b><small>${esc(s.state==='off'?s.offText:s.on?t('Speelt nu'):s.state==='update'?t('Nieuwe receiver erbij'):s.meta)}</small></span></button>`+
      (s.state==='off'?'':SH?SH.power({value:!!s.on,size:44,label:s.on?t('Alles uitzetten'):`${s.name} ${t('starten')}`,glow:s.glow,action:s.on?'stand-power':'scene-apply',id:s.on?'':s.id}):'')+`</div>`).join('')}</div>`+
    (d.scenes.length?'':`<section class="sc-empty"><b>${esc(t('v50SaveFirstScene'))}</b><small>${esc(t(d.ready?'v50SaveFirstSceneHint':'v50SceneAddLightsHint'))}</small></section>`)+
    `</div>`;
}
root.LightningScenesHome=Object.freeze({markup});
}(window));
