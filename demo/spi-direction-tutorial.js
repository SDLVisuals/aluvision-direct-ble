(function(root,factory){
  'use strict';
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LightningSPIDirectionTutorial=api;
}(typeof globalThis!=='undefined'?globalThis:this,function(host){
  'use strict';
  const languages=Object.freeze(['nl','en','fr','de']);
  const copy=Object.freeze({
    eyebrow:['EERST KIJKEN','LOOK FIRST','REGARDEZ D’ABORD','ZUERST ANSEHEN'],
    title:['Kijk naar je echte ledlines.','Look at your real LED lines.','Regardez vos lignes LED réelles.','Schau auf deine echten LED-Linien.'],
    intro:['Laat dezelfde eindkleuren bij elkaar aansluiten.','Match the colours where the ends meet.','Faites correspondre les couleurs aux extrémités qui se rejoignent.','Verbinde die Enden mit der gleichen Farbe.'],
    accessible:['Interactief uitlegvoorbeeld; verandert geen instellingen en bedient geen verlichting.','Interactive guide only; it changes no settings and does not control any lighting.','Guide interactif uniquement ; aucun réglage ni éclairage n’est modifié.','Nur eine interaktive Anleitung; sie ändert keine Einstellungen und steuert keine Beleuchtung.'],
    figure:['Twee ledlines · voorbeeld','Two LED lines · example','Deux lignes LED · exemple','Zwei LED-Linien · Beispiel'],
    wrong:['Niet goed','Not matched','Ne correspondent pas','Nicht passend'],
    correct:['Goed','Matched','Correspondent','Passend'],
    resultWrong:['Rood tegen groen: de uiteinden verschillen.','Red meets green: the end colours differ.','Rouge contre vert : les couleurs diffèrent.','Rot trifft Grün: Die Endfarben unterscheiden sich.'],
    resultCorrect:['Rood tegen rood. Zo sluiten ze aan.','Red meets red. The ends match.','Rouge contre rouge. Les extrémités correspondent.','Rot trifft Rot. Die Enden passen zusammen.'],
    moving:['Kijk: de uiteinden van ledline 2 wisselen.','Watch the ends of LED line 2 swap.','Les extrémités de la ligne LED 2 s’inversent.','Die Enden von LED-Linie 2 tauschen.'],
    action:['Bekijk omdraaien','See the flip','Voir l’inversion','Umdrehen ansehen'],
    replay:['Bekijk het verschil opnieuw','See the difference again','Revoir la différence','Unterschied erneut ansehen'],
    concept:['Uitlegvoorbeeld · verandert je instellingen niet.','Example only · your settings stay unchanged.','Exemple uniquement · vos réglages restent inchangés.','Nur ein Beispiel · deine Einstellungen bleiben unverändert.'],
    app:['DAARNA IN DE APP','THEN IN THE APP','ENSUITE DANS L’APP','DANACH IN DER APP'],
    wrongAria:['Voorbeeld: twee horizontale ledlines liggen eind aan eind. Beide hebben groen links en rood rechts. In het midden raakt rood van ledline 1 aan groen van ledline 2. Alleen de richting van ledline 2 verandert in dit voorbeeld.','Example: two horizontal LED lines meet end to end. Both have green on the left and red on the right. Red on LED line 1 meets green on LED line 2 in the middle. Only LED line 2 changes direction in this example.','Exemple : deux lignes LED horizontales se rejoignent bout à bout. Toutes deux ont le vert à gauche et le rouge à droite. Au centre, le rouge de la ligne 1 touche le vert de la ligne 2. Seul le sens de la ligne 2 change dans cet exemple.','Beispiel: Zwei waagerechte LED-Linien liegen Ende an Ende. Beide haben links Grün und rechts Rot. In der Mitte trifft Rot von LED-Linie 1 auf Grün von LED-Linie 2. Nur die Richtung von LED-Linie 2 ändert sich in diesem Beispiel.'],
    correctAria:['Voorbeeld: de linker ledline blijft groen links en rood rechts. De rechter ledline heeft nu rood links en groen rechts. In het midden sluiten twee rode uiteinden op elkaar aan.','Example: the left LED line stays green on the left and red on the right. The right LED line is now red on the left and green on the right. Two red ends meet in the middle.','Exemple : la ligne de gauche garde le vert à gauche et le rouge à droite. La ligne de droite a maintenant le rouge à gauche et le vert à droite. Les deux extrémités rouges se rejoignent au centre.','Beispiel: Die linke LED-Linie bleibt links grün und rechts rot. Die rechte LED-Linie hat jetzt links Rot und rechts Grün. In der Mitte treffen zwei rote Enden aufeinander.']
  });
  let serial=0;
  const bindings=new WeakMap();
  // Retain only ownership of our temporary ARIA flag across a same-DOM
  // rebind. External disabled/aria-busy authority is never cleared.
  const ownedBusyButtons=new WeakSet();
  function languageOf(value){
    const key=String(value||host.document?.documentElement?.lang||'nl').toLowerCase().split('-')[0];
    return languages.includes(key)?key:'nl';
  }
  function text(key,language){return copy[key][languages.indexOf(language)];}
  function esc(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function icon(name){
    const paths={
      eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
      x:'<path d="m6 6 12 12M18 6 6 18"/>',
      check:'<path d="m5 12 4.5 4.5L19 7"/>',
      repeat:'<path d="m17 2 4 4-4 4M3 6h18M7 22l-4-4 4-4m14 4H3"/>',
      app:'<rect x="6.5" y="2" width="11" height="20" rx="2"/><path d="M10 18.5h4"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
  }
  function markup({language}={}){
    const lang=languageOf(language),id='spi-direction-tutorial-'+(++serial),t=key=>esc(text(key,lang));
    const strip=second=>`<div class="spi-tutorial-line spi-tutorial-line-${second?'two':'one'}" aria-hidden="true"><span class="spi-tutorial-number">${second?2:1}</span><div class="spi-tutorial-strip"${second?' data-spi-tutorial-second data-reversed="false"':''}><span class="spi-tutorial-core"></span><span class="spi-tutorial-cap spi-tutorial-green">G</span><span class="spi-tutorial-cap spi-tutorial-red">R</span></div></div>`;
    return `<section class="spi-direction-tutorial" data-spi-tutorial-root data-spi-tutorial-language="${lang}" aria-label="${t('accessible')}" aria-labelledby="${id}-title"><header class="spi-tutorial-heading"><span class="spi-tutorial-eye" aria-hidden="true">${icon('eye')}</span><div><span class="spi-tutorial-eyebrow">${t('eyebrow')}</span><h3 id="${id}-title">${t('title')}</h3></div></header><p class="spi-tutorial-intro">${t('intro')}</p><figure class="spi-tutorial-example" data-spi-tutorial-example data-state="wrong"><figcaption><span>${t('figure')}</span><span class="spi-tutorial-verdict" data-spi-tutorial-verdict>${icon('x')}<span>${t('wrong')}</span></span></figcaption><div class="spi-tutorial-assembly" role="img" data-spi-tutorial-assembly aria-label="${t('wrongAria')}" aria-busy="false"><div class="spi-tutorial-coupling" aria-hidden="true"></div><span class="spi-tutorial-join" data-spi-tutorial-join aria-hidden="true">${icon('x')}</span>${strip(false)}<svg class="spi-tutorial-curves" data-spi-tutorial-curves viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs><marker id="${id}-red-tip" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 Z" class="spi-tutorial-red-fill"/></marker><marker id="${id}-green-tip" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 Z" class="spi-tutorial-green-fill"/></marker></defs><path data-spi-tutorial-red-curve class="spi-tutorial-red-curve" d="M 940 102 Q 750 30 560 102" marker-end="url(#${id}-red-tip)"/><path data-spi-tutorial-green-curve class="spi-tutorial-green-curve" d="M 560 102 Q 750 174 940 102" marker-end="url(#${id}-green-tip)"/></svg>${strip(true)}</div><p class="spi-tutorial-result" role="status" aria-live="polite" data-spi-tutorial-result>${t('resultWrong')}</p></figure><button type="button" class="spi-tutorial-action" data-spi-tutorial-action="flip" aria-pressed="false" aria-disabled="false">${icon('repeat')}<span data-spi-tutorial-action-label>${t('action')}</span></button><p class="spi-tutorial-concept">${t('concept')}</p><div class="spi-tutorial-app-label">${icon('app')}<span>${t('app')}</span></div></section>`;
  }
  function bind(container){
    if(!container||typeof container.querySelectorAll!=='function'||typeof container.addEventListener!=='function')return ()=>{};
    bindings.get(container)?.();
    const doc=container.ownerDocument||host.document,win=doc?.defaultView||host;
    const roots=[...(container.matches?.('[data-spi-tutorial-root]')?[container]:[]),...container.querySelectorAll('[data-spi-tutorial-root]')];
    const states=new Map();let alive=true;
    for(const root of roots){
      const query=selector=>root.querySelector(selector),state={root,language:languageOf(root.getAttribute('data-spi-tutorial-language')),button:query('[data-spi-tutorial-action="flip"]'),example:query('[data-spi-tutorial-example]'),assembly:query('[data-spi-tutorial-assembly]'),second:query('[data-spi-tutorial-second]'),curves:query('[data-spi-tutorial-curves]'),join:query('[data-spi-tutorial-join]'),verdict:query('[data-spi-tutorial-verdict]'),result:query('[data-spi-tutorial-result]'),label:query('[data-spi-tutorial-action-label]'),redCurve:query('[data-spi-tutorial-red-curve]'),greenCurve:query('[data-spi-tutorial-green-curve]'),correct:false,busy:false,stale:true,ariaBusyOwned:false,timer:null};
      if(['button','example','assembly','second','curves','join','verdict','result','label','redCurve','greenCurve'].every(key=>state[key])){state.ariaBusyOwned=ownedBusyButtons.has(state.button);states.set(root,state);}
    }
    if(!states.size)return ()=>{};
    function available(state){
      const {root,button}=state;
      if(!alive||!root.isConnected||doc?.hidden||root.hidden||root.closest('[hidden]')||button.disabled||button.hasAttribute('disabled')||button.closest('[inert]')||button.closest('fieldset[disabled]')||button.closest('[aria-busy="true"]'))return false;
      if(button.getAttribute('aria-disabled')==='true'&&!state.ariaBusyOwned)return false;
      const dialog=root.closest('dialog');
      return !dialog||(typeof dialog.open==='boolean'?dialog.open:dialog.hasAttribute('open'));
    }
    function drawArrows(state){
      if(!available(state))return;
      const width=state.curves.getBoundingClientRect().width,cap=state.second.querySelector('.spi-tutorial-cap')?.getBoundingClientRect().width;
      if(!Number.isFinite(width)||width<=0||!Number.isFinite(cap)||cap<=0)return;
      const start=width/2+2+cap/2,end=width-2-cap/2,mid=(start+end)/2;
      state.curves.setAttribute('viewBox','0 0 '+width+' 220');
      state.redCurve.setAttribute('d','M '+end+' 102 Q '+mid+' 30 '+start+' 102');
      state.greenCurve.setAttribute('d','M '+start+' 102 Q '+mid+' 174 '+end+' 102');
    }
    function render(state){
      if(!available(state))return;
      state.example.dataset.state=state.correct?'correct':'wrong';state.second.dataset.reversed=String(state.correct);
      state.button.setAttribute('aria-pressed',String(state.correct));state.button.setAttribute('aria-disabled','false');state.ariaBusyOwned=false;ownedBusyButtons.delete(state.button);
      state.assembly.setAttribute('aria-busy','false');state.assembly.setAttribute('aria-label',text(state.correct?'correctAria':'wrongAria',state.language));
      state.label.textContent=text(state.correct?'replay':'action',state.language);
      state.verdict.innerHTML=icon(state.correct?'check':'x')+'<span>'+esc(text(state.correct?'correct':'wrong',state.language))+'</span>';
      state.join.innerHTML=icon(state.correct?'check':'x');state.result.textContent=text(state.correct?'resultCorrect':'resultWrong',state.language);
      state.stale=false;drawArrows(state);
    }
    function stopTimer(state){if(state.timer!==null){win.clearTimeout(state.timer);state.timer=null;}}
    function abandon(state){stopTimer(state);state.busy=false;state.correct=false;state.stale=true;}
    function click(event){
      if(event.defaultPrevented)return;
      const button=event.target?.closest?.('[data-spi-tutorial-action="flip"]'),root=button?.closest('[data-spi-tutorial-root]'),state=states.get(root);
      if(!state||button!==state.button||state.busy||!available(state))return;
      if(state.stale)render(state);
      if(state.correct){state.correct=false;render(state);return;}
      const reduced=!!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if(reduced){state.correct=true;render(state);return;}
      drawArrows(state);state.busy=true;state.ariaBusyOwned=true;ownedBusyButtons.add(state.button);state.button.setAttribute('aria-disabled','true');state.assembly.setAttribute('aria-busy','true');state.example.dataset.state='moving';state.second.dataset.reversed='true';state.result.textContent=text('moving',state.language);
      state.timer=win.setTimeout(()=>{
        state.timer=null;
        if(!available(state)){abandon(state);return;}
        state.correct=true;state.busy=false;render(state);
      },1350);
    }
    function resize(){for(const state of states.values())drawArrows(state);}
    function visibility(){
      if(doc?.hidden){for(const state of states.values())if(state.busy)abandon(state);return;}
      for(const state of states.values())if(state.stale)render(state);
    }
    container.addEventListener('click',click);win.addEventListener?.('resize',resize);doc?.addEventListener?.('visibilitychange',visibility);
    for(const state of states.values())render(state);
    function cleanup(){
      if(!alive)return;alive=false;
      for(const state of states.values())stopTimer(state);
      container.removeEventListener('click',click);win.removeEventListener?.('resize',resize);doc?.removeEventListener?.('visibilitychange',visibility);
      if(bindings.get(container)===cleanup)bindings.delete(container);
    }
    bindings.set(container,cleanup);return cleanup;
  }
  return Object.freeze({markup,bind});
}));
