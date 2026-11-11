/* C106 motion: tells the stylesheet when something just happened, so
 * c106-motion.css can show it. Presentation only: it reads the DOM and adds
 * short-lived classes or data attributes; it never sends anything and never
 * claims that light on the stand has changed. */
(function(){
  'use strict';
  const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Confirming messages get a tick ---------- */
  // Exact authored sentences only; anything else (warnings, waits) stays plain.
  const SUCCESS=['Scène opgeslagen en actief.','Scène opgeslagen en actief in het voorbeeld.','Je bewaarde stand is geopend.',
    'Animatie bewaard in Mijn animaties.','Scènenaam gewijzigd. Je verlichting blijft hetzelfde.',
    'Taal en thema hersteld. Je installatie en opgeslagen licht blijven bewaard.','Backup hersteld na het controleren van de opslag.'];
  let successTexts=null;
  function successSet(){
    if(successTexts)return successTexts;
    const set=new Set(SUCCESS),copy=window.LightningUICopy;
    if(copy)for(const key of SUCCESS)if(copy.has(key))for(const language of copy.languages)set.add(copy.t(key,language));
    for(const text of ['Receiver toegevoegd','Receiver added','Récepteur ajouté','Receiver hinzugefügt'])set.add(text);
    return successTexts=set;
  }
  function markToast(toast){
    const ok=!toast.hidden&&successSet().has(toast.textContent.trim());
    if(ok)toast.dataset.c106Success='';else delete toast.dataset.c106Success;
  }

  /* ---------- New scenes, zones and receivers arrive gently ---------- */
  const KINDS=[
    {name:'zone',page:'[data-action="zone-new"]',item:'article.zone-entry',key:el=>el.querySelector('[data-action="zone"][data-id]')?.dataset.id},
    {name:'scene',page:'.scenes-page',item:'article.scene-card-row',key:el=>el.querySelector('[data-action="scene-open"][data-id]')?.dataset.id},
    {name:'receiver',page:'[data-receiver-detail]',item:'[data-receiver-detail]',key:el=>el.dataset.receiverDetail}
  ];
  const seen=new Map();
  function scan(){
    const main=document.getElementById('main');if(!main)return;
    for(const kind of KINDS){
      if(!main.querySelector(kind.page))continue;
      const items=[...main.querySelectorAll(kind.item)].map(el=>[el,kind.key(el)]).filter(([,key])=>key);
      const known=seen.get(kind.name);
      if(!known){seen.set(kind.name,new Set(items.map(([,key])=>key)));continue;}
      const fresh=items.filter(([,key])=>!known.has(key));
      items.forEach(([,key])=>known.add(key));
      // Many at once means another stand or a restore, not something you just made.
      if(!fresh.length||fresh.length>2||reduced())continue;
      for(const [el] of fresh){el.classList.add('c106-new');setTimeout(()=>el.classList.remove('c106-new'),2000);}
    }
  }
  let queued=false;
  function queueScan(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;scan();});}

  /* ---------- What you tapped answers back ---------- */
  // The app redraws the navigation, tabs and switches after a tap, so the
  // tapped control is found again by what it is, not by the element itself.
  const TAP='#navigation button[data-id],.switch[role="switch"],.section-tabs button[data-action]';
  const tapKey=el=>[el.dataset.action||'',el.dataset.id||'',el.getAttribute('aria-label')||''].join('|');
  let pendingTap=null;
  function applyTap(){
    if(!pendingTap||Date.now()>pendingTap.until)return;
    // C138ui-6: checkVisibility needs style only; getClientRects forced a full layout of the new page.
    const el=[...document.querySelectorAll(TAP)].find(item=>tapKey(item)===pendingTap.key&&(typeof item.checkVisibility==='function'?item.checkVisibility():item.getClientRects().length));
    if(!el||el.classList.contains('c106-tap'))return;
    el.classList.add('c106-tap');setTimeout(()=>el.classList.remove('c106-tap'),600);
  }
  document.addEventListener('click',event=>{
    const el=event.target instanceof Element&&event.target.closest(TAP);if(!el||reduced())return;
    pendingTap={key:tapKey(el),until:Date.now()+700};
    requestAnimationFrame(()=>requestAnimationFrame(applyTap));setTimeout(applyTap,160);
  },true);

  function start(){
    const toast=document.getElementById('toast');
    if(toast){new MutationObserver(()=>markToast(toast)).observe(toast,{attributes:true,attributeFilter:['hidden'],childList:true,characterData:true,subtree:true});markToast(toast);}
    const main=document.getElementById('main');
    if(main){
      new MutationObserver(queueScan).observe(main,{childList:true,subtree:true});queueScan();
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}());
