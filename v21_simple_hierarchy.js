/* One presentation owner for Home → Zones → Groups. Reuses the existing
 * colour, effect, port and transport handlers; opening a page never sets light.
 * Invoked by the existing V21 refinement scheduler, not another observer. */
(() => {
  'use strict';
  const list = value => Array.isArray(value) ? value : [];
  const tr = (nl,en,fr,de) => ({nl,en,fr,de})[String(db?.settings?.language || 'nl').slice(0,2)] || nl;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => `<i aria-hidden="true">${name==='back'?'<svg class="alv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6M8 12h13"/></svg>':window.AluvisionIcons?.markup?.(name==='colour'?'colours':name) || ''}</i>`;
  const put = (node,value) => { if(node && node.textContent!==value) node.textContent=value; };
  const once = (parent,selector,html,position='afterbegin') => {
    if (!parent) return null;
    if(!parent.querySelector(selector)) parent.insertAdjacentHTML(position,html);
    return parent.querySelector(selector);
  };
  const count = selected => selected?.receiverType==='RGBW' && window.AluvisionV21
    ? AluvisionV21.logicalRgbwLines(selected).length
    : list(selected?.receivers).filter(line=>line?.active!==false).length;
  const groupCount = n => `${n} ${n===1?tr('groep','group','groupe','Gruppe'):tr('groepen','groups','groupes','Gruppen')}`;
  const lineCount = n => `${n} LED Line${n===1?'':'s'}`;
  const guard = () => { try {return Boolean(realGuide?.active);}catch(_){return false;} };
  const protectedSheet = () => {
    const host=document.querySelector('#modal:not([hidden]) #modalBody');
    return Boolean(host?.querySelector('.v20-commission,.v21-rgbw-pair,.calibration-shell,.v187-calibration,.recovery-shell,.v20-recovery,.v20-security-sheet,.native-pin-sheet,.academy-shell,.academy-hub,.academy-practice,[data-phase="length"],[data-phase="side"],[data-phase="assign"],[data-phase="review"]'));
  };
  let refining = false;
  let lastContext = '';

  function navigation(root,kind) {
    const parentName = kind==='group' ? zone?.name : tr('Alle zones','All zones','Toutes les zones','Alle Zonen');
    const action = kind==='group' ? 'showZonePage()' : 'showZonesOverview()';
    const old = root.querySelector('.customer-structure-route,.customer-breadcrumb');
    if(old) old.hidden=true;
    const key = [kind,install?.id,zone?.id,group?.id,db?.settings?.language].join(':');
    const bar = once(root,'[data-v22-back]',`<nav class="v22-backbar" data-v22-back aria-label="${esc(tr('Terugnavigatie','Back navigation','Navigation retour','Zurücknavigation'))}"></nav>`);
    if(bar && bar.dataset.key!==key) {
      bar.dataset.key=key;
      bar.innerHTML=`<button type="button" onclick="${action}" class="v22-back">${icon('back')}<span>${esc(parentName)}</span></button><span class="v22-parent-location">${icon('location')}${esc(install?.name)}</span>`;
    }
  }

  function quickControl(root,scope) {
    const all=scope==='all';
    const card=root.querySelector(all?'[data-ui="all-lighting"]':'.v18152-zone-scope-control');
    if(!card) return;
    card.classList.add('v22-quick-control'); card.dataset.v22Scope=scope;
    const gs=all?list(install?.zones).flatMap(z=>list(z.groups)):list(zone?.groups);
    const name=all?install?.name:zone?.name;
    const heading=once(card,'.v22-quick-heading','<header class="v22-quick-heading"><span><small></small><h2></h2><p></p></span></header>');
    put(heading.querySelector('small'),all?tr('SNELBEDIENING','QUICK CONTROL','COMMANDE RAPIDE','SCHNELLSTEUERUNG'):tr('HELE ZONE','ENTIRE ZONE','ZONE ENTIÈRE','GANZE ZONE'));
    put(heading.querySelector('h2'),`${tr('Alles in','Everything in','Tout dans','Alles in')} ${name}`);
    put(heading.querySelector('p'),all
      ? `${list(install?.zones).length} ${tr('zones','zones','zones','Zonen')} · ${groupCount(gs.length)} · ${lineCount(gs.reduce((n,g)=>n+count(g),0))}`
      : tr('Alleen deze zone. Andere zones veranderen niet.','Only this zone. Other zones stay unchanged.','Cette zone uniquement. Les autres ne changent pas.','Nur diese Zone. Andere Zonen bleiben unverändert.'));
    const power=card.querySelector('.v1816-power-toggle');
    if(power && power.parentElement!==heading) heading.append(power);
    power?.setAttribute('aria-label',`${tr('Alles in','Everything in','Tout dans','Alles in')} ${name} · ${power.classList.contains('is-on')?tr('Uitschakelen','Switch off','Éteindre','Ausschalten'):tr('Inschakelen','Switch on','Allumer','Einschalten')}`);
    const panel=card.querySelector(all?'#uxAllControlPanel':'#customerZoneControlPanel');
    const buttons=[...card.querySelectorAll('[data-mode]')];
    buttons.forEach(button=>{
      button.classList.add('v22-quick-tab');
      const mode=button.dataset.mode;
      const label=mode==='looks'?tr('Sfeer','Mood','Ambiance','Stimmung'):tr('Kleur','Colour','Couleur','Farbe');
      const b=button.querySelector('b');put(b,label);
      button.setAttribute('aria-label',`${label} · ${name}`);
    });
    // A tab switches a visible workbench; it is not a collapsible extra menu.
    if(panel?.hidden) {
      (all?window.toggleV1814HomeControl:window.toggleV18152ZoneControl)?.('color');
    }
  }

  function home(root) {
    root.dataset.v22View='home';
    quickControl(root,'all');
    const intro=root.querySelector('.customer-home-intro,.ux-page-intro');
    put(intro?.querySelector('h1'),tr('Je verlichting','Your lighting','Votre éclairage','Deine Beleuchtung'));
    const sceneStrip=root.querySelector('.ux-scene-strip');
    const sceneHead=sceneStrip?.previousElementSibling;
    if(sceneHead?.matches('.ux-section-head')) sceneHead.classList.add('v22-scenes-heading');
    if(sceneStrip) {
      sceneStrip.classList.add('v22-scenes');
      if(!list(install?.scenes).length) {
        if(!sceneStrip.querySelector('.v22-empty-scenes')) sceneStrip.innerHTML=`<button type="button" class="v22-empty-scenes" onclick="go('scenes')">${icon('scenes')}<span><b>${tr('Bewaar je favoriete licht','Save your favourite lighting','Gardez votre éclairage préféré','Lieblingslicht speichern')}</b><small>${tr('Met een scène zet je alles later terug.','A scene brings it all back later.','Une scène permet de tout retrouver.','Eine Szene stellt alles wieder her.')}</small></span><strong>＋</strong></button>`;
      }
    }
  }

  function overview(root) {
    root.dataset.v22View='zones';
    delete root.dataset.v22Scope;
    const intro=root.querySelector('.customer-zone-intro,.ux-page-intro');
    put(intro?.querySelector('h1'),tr('Jouw zones','Your zones','Vos zones','Deine Zonen'));
    put(intro?.querySelector('p.sub'),tr('Kies de plaats waar je het licht wilt aanpassen.','Choose the area whose lighting you want to change.','Choisissez l’espace à éclairer.','Wähle den Bereich, dessen Licht du ändern möchtest.'));
    const summary=root.querySelector('.customer-zone-overview-summary');
    if(summary)summary.hidden=true;
    const grid=root.querySelector('.customer-zone-explorer-grid,.customer-zone-grid');
    const guide=once(root,'.v22-hierarchy-guide',`<div class="v22-hierarchy-guide"><div class="v22-zone-diagram" aria-hidden="true"><small>${tr('ZONE','ZONE','ZONE','ZONE')}</small><span><i></i><i></i></span></div><div><b>${tr('Een zone is een plaats','A zone is an area','Une zone est un espace','Eine Zone ist ein Bereich')}</b><p>${tr('Bijvoorbeeld de inkom. Daarin groepeer je LED Lines, zoals Wand of Plafond.','For example the entrance. Inside it, group LED Lines as Wall or Ceiling.','Par exemple l’entrée. Regroupez ses LED Lines : Mur ou Plafond.','Zum Beispiel der Eingang. Darin gruppierst du LED Lines als Wand oder Decke.')}</p></div></div>`,'beforeend');
    if(grid && guide && grid.previousElementSibling!==guide)grid.before(guide);
    root.querySelectorAll('.customer-zone-explorer').forEach(card=>{
      card.classList.add('v22-zone-card');
      const scope=card.querySelector('.scope');put(scope,tr('ZONE','ZONE','ZONE','ZONE'));
      card.classList.remove('is-active');
      const title=card.querySelector('.customer-zone-explorer-head b,h2,h3');
      const opener=card.querySelector('.customer-zone-explorer-main');
      opener?.setAttribute('aria-label',`${tr('Zone openen','Open zone','Ouvrir la zone','Zone öffnen')}: ${title?.textContent || ''}`);
    });
  }

  function zonePage(root) {
    root.dataset.v22View='zone';
    delete root.dataset.v22Scope;
    navigation(root,'zone');
    const head=root.querySelector('.customer-zone-detail-head');
    put(head?.querySelector('.scope'),tr('ZONE','ZONE','ZONE','ZONE'));
    const n=list(zone?.groups).reduce((sum,g)=>sum+count(g),0);
    put(head?.querySelector('p'),`${groupCount(list(zone?.groups).length)} · ${lineCount(n)}`);
    const groupHeading=root.querySelector('.customer-zone-group-title');
    put(groupHeading?.querySelector('h2'),tr('Groepen in deze zone','Groups in this zone','Groupes de cette zone','Gruppen in dieser Zone'));
    const groupCopy=once(groupHeading?.querySelector('div')||groupHeading,'.v22-group-explainer','<p class="v22-group-explainer"></p>','beforeend');
    put(groupCopy,tr('Een groep bevat LED Lines die je samen of per lijn bedient.','A group contains LED Lines you control together or individually.','Un groupe contient des LED Lines à piloter ensemble ou séparément.','Eine Gruppe enthält LED Lines, die du gemeinsam oder einzeln steuerst.'));
    root.querySelectorAll('.customer-group-explorer').forEach(card=>{
      card.classList.add('v22-group-card'); card.classList.remove('is-active');
      put(card.querySelector('.scope'),tr('GROEP','GROUP','GROUPE','GRUPPE'));
      card.querySelector('.customer-group-open-surface')?.removeAttribute('aria-current');
      const selected=list(zone?.groups).find(g=>g.id===card.dataset.openGroup);
      if(selected)put(card.querySelector('.customer-group-explorer-copy p span'),lineCount(count(selected)));
    });
    quickControl(root,'zone');
  }

  function groupPage(root) {
    root.dataset.v22View='group'; root.dataset.v22Scope='group';
    const page=root.querySelector('.customer-group-page');
    const shell=page?.querySelector(':scope > .rgbw-group-ui') || page;
    if(!shell)return;
    navigation(root,'group');
    shell.classList.add('v22-group-editor');
    const empty=!list(group?.receivers).length;
    shell.classList.toggle('v22-empty-group',empty);
    const head=shell.querySelector('.v21-compact-group-heading,.rgbw-group-head,:scope > .row');
    if(head?.querySelector('h1')) {
      head.classList.add('v22-group-heading');
      const eyebrow=head.querySelector('.eyebrow,.scope:not(.offline)');
      put(eyebrow,tr('GROEP','GROUP','GROUPE','GRUPPE'));
      const meta=head.querySelector('p,.sub');
      put(meta,`${lineCount(count(group))} · ${tr('in zone','in zone','dans la zone','in Zone')} ${zone?.name}`);
      const mode=shell.querySelector(':scope > .v1811-mode-card');
      const originalPower=mode?.querySelector('.v1816-power-toggle');
      if(originalPower) {
        head.querySelector('.v1816-power-toggle')?.remove();
        head.append(originalPower);
      }
      const power=head.querySelector('.v1816-power-toggle');
      power?.setAttribute('aria-label',`${tr('Groep','Group','Groupe','Gruppe')} ${group?.name} · ${power.classList.contains('is-on')?tr('Uitschakelen','Switch off','Éteindre','Ausschalten'):tr('Inschakelen','Switch on','Allumer','Einschalten')}`);
    }
    const nav=shell.querySelector('.v1814-group-nav');
    if(nav) {
      nav.classList.add('v22-group-tabs');
      // Same section API; the old Light landing page duplicated these choices.
      const light=nav.querySelector('[data-v1814-group-tab="light"]');
      if(light) { light.hidden=true; light.tabIndex=-1; }
      const colors=nav.querySelector('[data-v1814-group-tab="colors"]');
      const settings=nav.querySelector('[data-v1814-group-tab="settings"]');
      if(colors && nav.firstElementChild!==colors)nav.prepend(colors);
      put(settings?.querySelector('b'),tr('Animatie','Animation','Animation','Animation'));
      put(colors?.querySelector('b'),tr('Kleuren','Colours','Couleurs','Farben'));
      const preview=shell.querySelector(':scope > .preview');
      if(preview && preview.previousElementSibling!==nav)preview.before(nav);
    }
    if(shell.dataset.v1814Section==='light') window.setV1814GroupSection('colors');
    if(empty) {
      const emptyCard=once(shell,'.v22-empty-group-card',`<section class="v22-empty-group-card"><div class="v22-empty-line" aria-hidden="true"><i></i><i></i><i></i></div><h2>${tr('Voeg je eerste LED Line toe','Add your first LED Line','Ajoutez votre première LED Line','Erste LED Line hinzufügen')}</h2><p>${tr('Koppel een receiver aan deze groep. Daarna kies je hier kleuren en animaties.','Pair a receiver to this group. Then choose colours and animations here.','Associez un récepteur à ce groupe. Choisissez ensuite couleurs et animations.','Kopple einen Receiver mit dieser Gruppe. Danach wählst du hier Farben und Animationen.')}</p><button type="button" class="button" data-v22-empty-add>${icon('receiverPlus')}${tr('Receiver toevoegen','Add receiver','Ajouter un récepteur','Receiver hinzufügen')}</button></section>`);
      const heading=shell.querySelector('.v22-group-heading');
      if(heading && heading.nextElementSibling!==emptyCard)heading.after(emptyCard);
      const add=emptyCard.querySelector('[data-v22-empty-add]');
      add.onclick=()=>window.openAddReceiverForCustomerGroup?.(zone.id,group.id);
    } else shell.querySelector('.v22-empty-group-card')?.remove();
    const settings=shell.querySelector('.v1811-settings-card');
    const choice=once(settings,'[data-v22-choose-effect]',`<button type="button" data-v22-choose-effect class="v22-choose-effect" onclick="animationBrowser()">${icon('animation')}<span><small>${tr('ANIMATIE','ANIMATION','ANIMATION','ANIMATION')}</small><b></b></span><strong>${tr('Kiezen','Choose','Choisir','Wählen')} ›</strong></button>`);
    put(choice?.querySelector('b'),group?.state?.animation==='Static Color'?tr('Nog geen animatie','No animation selected','Aucune animation','Keine Animation'):group?.state?.animation || '');
    const colors=shell.querySelector('.v1811-colour-card');
    const staticChoice=once(colors,'[data-v22-static]',`<button type="button" data-v22-static class="v22-static-choice" onclick="AluvisionSimpleHierarchy.solid()">${icon('colour')}<span>${tr('Alleen een vaste kleur gebruiken','Use a solid colour only','Utiliser une couleur fixe','Nur eine feste Farbe verwenden')}</span><strong>›</strong></button>`);
    if(staticChoice) staticChoice.hidden=['Static Color','All Off'].includes(group?.state?.animation);
    // Colour target selection and the original wheel stay untouched.
    shell.querySelectorAll('.v1811-mode-card').forEach(node=>node.hidden=true);
  }

  function refine() {
    if(refining || guard())return;
    const root=document.querySelector('.page.on');
    if(!root || !['home','zones'].includes(root.id)){delete document.body.dataset.v22View;return;}
    refining=true;
    try {
      if(root.id==='home')home(root);
      else if(root.querySelector('.customer-group-page'))groupPage(root);
      else if(root.querySelector('.customer-zone-detail'))zonePage(root);
      else overview(root);
      document.body.dataset.v22View=root.dataset.v22View;
    } finally { refining=false; }
  }

  function start() {
    const previousGo=window.go;
    window.go=function(page,...args){
      const previousPage=document.querySelector('.page.on')?.id;
      if(page!==previousPage && !guard() && !protectedSheet() && !document.getElementById('modal')?.hidden)window.closeModal?.();
      const result=previousGo.call(this,page,...args);refine();return result;
    };
    try { go=window.go; } catch(_) {}
    // These guards stop a second press from hiding the only visible workbench.
    for(const [name,selector] of [['toggleV1814HomeControl','#uxAllControlPanel'],['toggleV18152ZoneControl','#customerZoneControlPanel']]) {
      const original=window[name]; if(typeof original!=='function')continue;
      window[name]=function(mode,...rest){
        const panel=document.querySelector(selector);
        const selected=panel?.parentElement?.querySelector(`[data-mode="${mode==='looks'?'looks':'color'}"].on`);
        if(selected && !panel.hidden)return;
        const result=original.call(this,mode,...rest);refine();return result;
      };
    }
    const section=window.setV1814GroupSection;
    window.setV1814GroupSection=function(value,...args){
      const result=section.call(this,value==='light'?'colors':value,...args);refine();return result;
    };
    document.addEventListener('keydown',event=>{
      const button=event.target.closest?.('.v22-group-tabs [role="tab"]');
      if(!button || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      const tabs=[...button.closest('.v22-group-tabs').querySelectorAll('[role="tab"]')].filter(tab=>!tab.hidden);
      const at=tabs.indexOf(button);
      const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(at+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
      event.preventDefault();window.setV1814GroupSection(tabs[next].dataset.v1814GroupTab);tabs[next].focus({preventScroll:true});
    });
    for(const name of ['home','zones']) {
      const original=window[name];
      window[name]=function(...args){const value=original.apply(this,args);refine();return value;};
    }
    for(const name of ['openZone','openGroup','showZonePage','showZonesOverview','selectLocation']) {
      const original=window[name];if(typeof original!=='function')continue;
      window[name]=function(...args){
        // Let existing modal owners clean up, rather than hiding a sheet while
        // its toolbar/backdrop and private pending state remain mounted.
        if(!guard() && !protectedSheet() && !document.getElementById('modal')?.hidden)window.closeModal?.();
        const result=original.apply(this,args);
        const key=[install?.id,zone?.id,group?.id,document.querySelector('.page.on')?.id,name].join(':');
        if(key!==lastContext){lastContext=key;const app=document.querySelector('.app');if(app)app.scrollTop=0;}
        refine();return result;
      };
    }
    const createGroup=window.confirmNewGroup;
    if(typeof createGroup==='function')window.confirmNewGroup=function(...args){
      const previous=group?.id;const result=createGroup.apply(this,args);
      if(!guard() && group?.id && group.id!==previous)window.openGroup(group.id);
      return result;
    };
    refine();
  }
  window.AluvisionSimpleHierarchy={refine,solid(){
    const original=document.querySelector('.page.on [data-v1814-group-action="colour"]');
    original?.click();
  }};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
