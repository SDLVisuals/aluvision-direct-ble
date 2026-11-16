/* Instellingen (prototype ideeen-animaties-instellingen I3, de eigenaar 15 nov: "nu alles inwerken").
 * Bovenaan wat je het vaakst doet (Stand delen, Wifi of bluetooth, Nu bewaren), dan zoeken, dan één korte lijst.
 * Elke rij opent een eigen pagina over het hele scherm.
 * Dit bestand verplaatst alleen de bestaande onderdelen van de instellingenpagina (app.js) naar die pagina's; hun knoppen
 * en wat ze doen blijven precies hetzelfde. Een onderdeel dat het niet kent, blijft gewoon op de startpagina staan,
 * zodat er nooit iets verdwijnt. */
(function(root){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const I=d=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC={wifi:I('<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.7 16a5 5 0 0 1 6.6 0"/><circle cx="12" cy="19.2" r=".8"/>'),
  users:I('<circle cx="9" cy="8" r="3.2"/><path d="M3 19a6 6 0 0 1 12 0M16 5.2a3.2 3.2 0 0 1 0 6M18 13.5a6 6 0 0 1 3 5.5"/>'),
  cloud:I('<path d="M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/>'),theme:I('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5z" fill="currentColor"/>'),
  stands:I('<path d="M4 20V9l8-5 8 5v11M9 20v-6h6v6"/>'),share:I('<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/>'),
  bt:I('<path d="m7 7 10 10-5 4V3l5 4L7 17"/>'),search:I('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),chev:I('<path d="m9 6 6 6-6 6"/>'),back:I('<path d="m15 6-6 6 6 6"/>'),
  palette:I('<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.6-.9 1.2-1.8-.5-1.1.2-2.2 1.4-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>'),
  info:I('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>'),qr:I('<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>'),
  more:I('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),lock:I('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>')};
// welke onderdelen van app.js op welke pagina horen; zoekwoorden voor het zoekveld
const PAGES=[
  {k:'verbinding',ic:'wifi',t:'Verbinding',words:'verbinding wifi bluetooth kanaal netwerk pin beveiliging',sel:['.settings-connection','[data-channel-card]','[data-range-card]','[data-pin-protection]','.first-pin-stored-entry721','[data-reserve-main]','.reserve-main97','.pin-login-entry']},
  {k:'delen',ic:'users',t:'Delen en gebruikers',words:'delen gebruikers rollen qr uitnodigen toegang',sel:['.su-entry','[data-action="stand-share-open"]'],direct:'.su-entry'},
  {k:'backup',ic:'cloud',t:'Backup',words:'backup bewaren herstellen terugzetten bestand',sel:['[data-backup-panel]','.backup-panel'],text:/^\s*Backup/},
  {k:'standen',ic:'stands',t:'Standen op deze telefoon',words:'standen stand openen telefoon',sel:['.c138-saved-stands']},
  {k:'taal',ic:'theme',t:'Taal en thema',words:'taal thema donker licht weergave nederlands english',sel:['.settings-appearance','[data-action="preferences-reset"]']},
  // twee pagina's die app.js zelf vult (d.colours, d.animations, d.about): ze bestonden nog niet op de oude pagina
  {k:'kleuren',ic:'palette',t:'Kleuren en animaties',words:'kleuren animaties bewaard favorieten presets',sel:[],make:'colours'},
  {k:'over',ic:'info',t:'Over de app',words:'over versie app receivers hulp',sel:[],make:'about'},
  {k:'meer',ic:'more',t:'Gegevens wissen',words:'wissen verlaten gegevens app wissen',sel:['.app-erase-section'],quiet:true}];
let open=null,query='';
function arrange(main,d={}){
  const page=main.querySelector('.page');if(!page||page.dataset.settingsHome)return;
  page.dataset.settingsHome='1';page.classList.add('sth-page');
  const t=d.t||(k=>k);
  // de onderdelen ophalen (ook binnen de groepen "Je installatie" en "Deze app")
  const found={};
  for(const p of PAGES){found[p.k]=[];
    for(const s of p.sel)page.querySelectorAll(s).forEach(n=>{if(!found[p.k].includes(n))found[p.k].push(n);});
    if(p.text)page.querySelectorAll('section.card').forEach(n=>{if(p.text.test(n.querySelector('h2,h3,b')?.textContent||'')&&!found[p.k].includes(n))found[p.k].push(n);});
  }
  const made={colours:()=>`<section class="sth-card"><h3>${esc(t('Mijn kleuren'))}</h3>${(d.colours||[]).length?`<div class="sth-sw">${d.colours.map(c=>`<i style="--c:${esc(c.hex)}" title="${esc(c.name)}"></i>`).join('')}</div>`:`<p class="sth-say">${esc(t('Nog geen kleuren bewaard.'))}</p>`}</section>`+
      `<section class="sth-card"><h3>${esc(t('Bewaarde animaties'))}</h3>${(d.animations||[]).length?`<div class="sth-anims">${d.animations.map(a=>`<div class="sth-anim"><span class="sth-ic">${IC.palette}</span><b>${esc(a)}</b></div>`).join('')}</div>`:`<p class="sth-say">${esc(t('Tik op de ster bij een animatie die speelt om ze hier te bewaren.'))}</p>`}</section>`,
    about:()=>`<section class="sth-card"><div class="sth-about"><img src="assets/aluvision-logo.png" alt="Aluvision"><b>Lighting V50</b></div>${(d.about||[]).map(([k,v])=>`<div class="sth-kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</section>`};
  for(const p of PAGES)if(p.make){const el=document.createElement('div');el.className='sth-made';el.innerHTML=made[p.make]();found[p.k]=[el];}
  const known=new Set(Object.values(found).flat());
  // de startpagina
  const head=page.querySelector('.page-heading');const tabs=page.querySelector('.demo-settings-tabs');
  const home=document.createElement('div');home.className='sth-home';
  const rows=PAGES.filter(p=>!p.quiet&&found[p.k].length);
  home.innerHTML=(d.name?`<section class="sth-stand"><div><b>${esc(d.name)}</b><small class="${d.connected?'is-ok':''}"><i></i>${esc(d.status||'')}</small></div>${found.delen.length?`<button type="button" class="sth-qr" data-sth-open="delen" aria-label="${esc(t('Stand delen'))}">${IC.qr}</button>`:''}</section>`:'')+
    // 15 nov (de eigenaar): de drie snelknoppen herhaalden de lijst eronder; alleen de lijst blijft

    `<label class="sth-search">${IC.search}<input type="search" placeholder="${esc(t('Zoek in instellingen'))}" value="${esc(query)}" data-sth-q autocomplete="off"></label>`+
    `<div class="sth-list" data-sth-list>${rows.map(p=>`<button type="button" class="sth-row" data-sth-open="${p.k}" data-sth-words="${esc((t(p.t)+' '+p.words).toLowerCase())}"><span class="sth-ic">${IC[p.ic]}</span><span class="sth-rt"><b>${esc(t(p.t))}</b></span>${IC.chev}</button>`).join('')}<p class="sth-none" hidden>${esc(t('Niets gevonden.'))}</p></div>`+
    ''; // 15 nov (de eigenaar): geen "Stand verlaten of alles wissen" meer onderaan
  // wat de pagina niet kent, blijft op de startpagina (onder de lijst), zodat er nooit iets verdwijnt
  const rest=document.createElement('div');rest.className='sth-rest';
  [...page.querySelectorAll(':scope>*, .settings-installation>*, .settings-app-tools>*')].forEach(n=>{
    if(n===head||n===tabs||known.has(n)||n.matches('.settings-installation,.settings-app-tools,.settings-group-title')||[...known].some(k=>n.contains(k)||k.contains(n)))return;
    if(n.matches('span:empty'))return;rest.append(n);});
  // de eigen pagina's
  const subs=PAGES.filter(p=>found[p.k].length).map(p=>{const el=document.createElement('section');el.className='sth-sub';el.dataset.sthSub=p.k;el.hidden=open!==p.k;
    el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label',t(p.t));
    el.innerHTML=`<header class="sth-subhead"><button type="button" class="sth-back" data-sth-close aria-label="${esc(t('Terug'))}">${IC.back}</button><div><small>${esc(t('Instellingen'))}</small><b>${esc(t(p.t))}</b></div></header><div class="sth-subbody"></div>`;
    const body=el.querySelector('.sth-subbody');found[p.k].forEach(n=>body.append(n));return el;});
  page.querySelectorAll('.settings-installation,.settings-app-tools').forEach(g=>{if(!g.querySelector('.card,button,section'))g.remove();});
  (tabs||head)?.after(home);home.after(rest);subs.forEach(s=>page.append(s));
  document.body.classList.toggle('sth-sub-open',!!open);
  filter(page);
}
function filter(page){const q=query.trim().toLowerCase(),list=page.querySelector('[data-sth-list]');if(!list)return;let n=0;
  list.querySelectorAll('[data-sth-words]').forEach(r=>{const ok=!q||r.dataset.sthWords.includes(q);r.hidden=!ok;if(ok)n++;});
  const none=list.querySelector('.sth-none');if(none)none.hidden=n>0;}
function show(k){open=k||null;document.querySelectorAll('[data-sth-sub]').forEach(s=>{s.hidden=s.dataset.sthSub!==open;if(!s.hidden)s.scrollTop=0;});document.body.classList.toggle('sth-sub-open',!!open);}
document.addEventListener('click',e=>{const t=e.target instanceof Element?e.target:null;if(!t)return;
  const o=t.closest('[data-sth-open]');if(o){const k=o.dataset.sthOpen,p=PAGES.find(x=>x.k===k);
    // Delen en gebruikers heeft al een eigen scherm: meteen dat openen
    const direct=p?.direct&&document.querySelector(`[data-sth-sub="${k}"] ${p.direct}`);if(direct){direct.click();return;}
    show(k);return;}
  if(t.closest('[data-sth-close]')){show(null);}
});
document.addEventListener('input',e=>{const q=e.target instanceof Element&&e.target.closest('[data-sth-q]');if(!q)return;query=q.value;const page=q.closest('.sth-page');if(page)filter(page);});
// buiten Instellingen is er nooit een open pagina
function reset(){open=null;document.body.classList.remove('sth-sub-open');}
root.LightningSettingsHome=Object.freeze({arrange,reset,isOpen:()=>!!open});
}(window));
