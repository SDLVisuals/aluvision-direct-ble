(function(root,factory){
  'use strict';
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LightningSPIDirectionTutorial=api;
}(typeof globalThis!=='undefined'?globalThis:this,function(host){
  'use strict';
  // Illustration only. This widget has no receiver, direction or save callbacks.
  const languages=Object.freeze(['nl','en','fr','de']);
  const copy=Object.freeze({
    title:['Kijk naar je echte ledlines.','Look at your real LED lines.','Regardez vos vraies lignes LED.','Schau auf deine echten LED-Linien.'],
    intro:['De kleuren die elkaar raken, moeten gelijk zijn.','The colours at the touching ends must match.','Les couleurs des extrémités qui se touchent doivent être identiques.','Die Farben an den aneinanderliegenden Enden müssen gleich sein.'],
    figure:['Voorbeeld','Example','Exemple','Beispiel'],
    wrong:['Niet goed','Not matched','Incorrect','Nicht passend'],
    flipping:['Ledline 2 omkeren','Flip LED line 2','Inverser la ligne LED 2','LED-Linie 2 umkehren'],
    correct:['Zo is het goed','Now matched','C’est correct','So passt es'],
    redGreen:['Rood tegen groen','Red meets green','Rouge contre vert','Rot an Grün'],
    redRed:['Rood tegen rood','Red meets red','Rouge contre rouge','Rot an Rot'],
    greenGreen:['Groen tegen groen','Green meets green','Vert contre vert','Grün an Grün'],
    bothGood:['Allebei goed','Both are correct','Les deux sont corrects','Beides ist richtig'],
    note:['Alleen uitleg · je instellingen blijven gelijk.','Explanation only · your settings stay unchanged.','Explication uniquement · vos réglages restent inchangés.','Nur eine Erklärung · deine Einstellungen bleiben unverändert.'],
    replay:['Nog eens bekijken','Watch again','Revoir','Erneut ansehen'],
    showWrong:['Toon fout voorbeeld','Show incorrect example','Voir l’exemple incorrect','Falsches Beispiel zeigen'],
    showCorrect:['Toon goed voorbeeld','Show correct example','Voir l’exemple correct','Richtiges Beispiel zeigen'],
    understood:['Begrepen','Got it','Compris','Verstanden'],
    reopen:['Uitleg bekijken','Show explanation','Voir l’explication','Erklärung ansehen'],
    wrongAria:['Voorbeeld, niet goed: twee horizontale ledlines raken elkaar in het midden met rood tegen groen. Vergelijk de rakende uiteinden van je echte ledlines.','Incorrect example: two horizontal LED lines meet in the middle, red to green. Compare the touching ends of your real LED lines.','Exemple incorrect : deux lignes LED horizontales se touchent au centre, rouge contre vert. Comparez les extrémités de vos vraies lignes LED.','Falsches Beispiel: Zwei waagerechte LED-Linien treffen sich in der Mitte, Rot an Grün. Vergleiche die aneinanderliegenden Enden deiner echten LED-Linien.'],
    flippingAria:['Uitlegvoorbeeld: alleen de kleuren aan de uiteinden van ledline 2 wisselen horizontaal van plaats. Dit verandert je echte ledlines niet.','Illustration: only LED line 2’s end colours swap horizontally. This does not change your real LED lines.','Illustration : seules les couleurs aux extrémités de la ligne LED 2 échangent leur place horizontalement. Vos vraies lignes LED ne changent pas.','Erklärungsbeispiel: Nur die Endfarben von LED-Linie 2 tauschen waagerecht die Plätze. Deine echten LED-Linien ändern sich nicht.'],
    redAria:['Goed voorbeeld: de linker ledline is gelijk gebleven; de rechter is omgekeerd. In het midden raken de twee rode uiteinden elkaar. Groen tegen groen is ook goed.','Correct example: the left LED line stayed unchanged; the right was flipped. The two red ends now meet in the middle. Green to green is also correct.','Exemple correct : la ligne LED de gauche est restée identique ; celle de droite est inversée. Les deux extrémités rouges se touchent au centre. Vert contre vert est correct aussi.','Richtiges Beispiel: Die linke LED-Linie blieb unverändert; die rechte wurde umgekehrt. In der Mitte treffen sich die beiden roten Enden. Grün an Grün ist ebenfalls richtig.']
  });
  let serial=0;
  const bindings=new WeakMap();
  function languageOf(value){const key=String(value||host.document?.documentElement?.lang||'nl').toLowerCase().split('-')[0];return languages.includes(key)?key:'nl';}
  const text=(key,language)=>copy[key][languages.indexOf(language)];
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function icon(name){
    const paths={eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',x:'<path d="m6 6 12 12M18 6 6 18"/>',check:'<path d="m5 12 4.5 4.5L19 7"/>',swap:'<path d="M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4"/>',replay:'<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>'};
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+paths[name]+'</svg>';
  }
  function markup({language}={}){
    const lang=languageOf(language),id='spi-direction-tutorial-'+(++serial),t=key=>esc(text(key,lang));
    const strip=second=>'<div class="spi-tutorial-line spi-tutorial-line-'+(second?'two':'one')+'" aria-hidden="true"><div class="spi-tutorial-strip" data-spi-tutorial-'+(second?'second':'first')+' data-reversed="false"><span class="spi-tutorial-core"></span><i class="spi-tutorial-end spi-tutorial-green">G</i><i class="spi-tutorial-end spi-tutorial-red">R</i>'+(second?'<span class="spi-tutorial-flip-cue">'+icon('swap')+'</span>':'')+'</div><span class="spi-tutorial-number">'+(second?2:1)+'</span></div>';
    const pair=colour=>'<span class="spi-tutorial-valid-pair" role="img" aria-label="'+t(colour==='red'?'redRed':'greenGreen')+'"><i class="spi-tutorial-'+colour+'">'+(colour==='red'?'R':'G')+'</i><i class="spi-tutorial-'+colour+'">'+(colour==='red'?'R':'G')+'</i>'+icon('check')+'</span>';
    return '<section class="spi-direction-tutorial" data-spi-tutorial-root data-spi-tutorial-language="'+lang+'" data-collapsed="false" aria-label="'+t('title')+'">'+
      '<button type="button" class="spi-tutorial-reopen" data-spi-tutorial-action="open" aria-expanded="true" aria-controls="'+id+'-content" hidden>'+icon('eye')+'<span>'+t('reopen')+'</span></button>'+
      '<div id="'+id+'-content" data-spi-tutorial-content><header class="spi-tutorial-heading">'+icon('eye')+'<h3 data-spi-tutorial-title tabindex="-1">'+t('title')+'</h3></header><p class="spi-tutorial-intro">'+t('intro')+'</p>'+
      '<figure class="spi-tutorial-example" data-spi-tutorial-example data-case="red-green" data-state="wrong" data-changing="false"><figcaption><span>'+t('figure')+'</span><span class="spi-tutorial-verdict" data-spi-tutorial-verdict>'+t('wrong')+'</span></figcaption>'+
      '<div class="spi-tutorial-assembly" role="img" data-spi-tutorial-assembly aria-label="'+t('wrongAria')+'" aria-busy="false"><span class="spi-tutorial-joint-mark" data-spi-tutorial-joint aria-hidden="true">'+icon('x')+'</span><span class="spi-tutorial-joint-ring" aria-hidden="true"></span>'+strip(false)+strip(true)+'</div>'+
      '<p class="spi-tutorial-result" data-spi-tutorial-result aria-live="off">'+t('redGreen')+'</p></figure>'+
      '<div class="spi-tutorial-valid"><span>'+t('bothGood')+'</span><span class="spi-tutorial-valid-pairs">'+pair('red')+pair('green')+'</span></div>'+
      '<p class="spi-tutorial-note">'+t('note')+'</p><div class="spi-tutorial-actions"><button type="button" class="spi-tutorial-replay" data-spi-tutorial-action="replay">'+icon('replay')+'<span data-spi-tutorial-replay-label>'+t('replay')+'</span></button><button type="button" class="spi-tutorial-understood" data-spi-tutorial-action="close">'+icon('check')+'<span>'+t('understood')+'</span></button></div></div></section>';
  }
  function bind(container){
    if(!container||typeof container.querySelectorAll!=='function'||typeof container.addEventListener!=='function')return ()=>{};
    bindings.get(container)?.();
    const doc=container.ownerDocument||host.document,win=doc?.defaultView||host;
    const roots=[...(container.matches?.('[data-spi-tutorial-root]')?[container]:[]),...container.querySelectorAll('[data-spi-tutorial-root]')],states=new Map();let alive=true;
    for(const root of roots){
      const query=selector=>root.querySelector(selector),state={root,language:languageOf(root.getAttribute('data-spi-tutorial-language')),content:query('[data-spi-tutorial-content]'),reopen:query('[data-spi-tutorial-action="open"]'),title:query('[data-spi-tutorial-title]'),example:query('[data-spi-tutorial-example]'),assembly:query('[data-spi-tutorial-assembly]'),first:query('[data-spi-tutorial-first]'),second:query('[data-spi-tutorial-second]'),verdict:query('[data-spi-tutorial-verdict]'),joint:query('[data-spi-tutorial-joint]'),result:query('[data-spi-tutorial-result]'),replayLabel:query('[data-spi-tutorial-replay-label]'),phase:'wrong',collapsed:root.dataset.collapsed==='true',outOfView:false,timer:null};
      if(['content','reopen','title','example','assembly','first','second','verdict','joint','result','replayLabel'].every(key=>state[key]))states.set(root,state);
    }
    if(!states.size)return ()=>{};
    function mounted(state){const root=state.root;if(!alive||!root.isConnected||doc?.hidden||root.hidden||root.closest('[hidden],[inert]'))return false;const dialog=root.closest('dialog');return !dialog||(typeof dialog.open==='boolean'?dialog.open:dialog.hasAttribute('open'));}
    const available=state=>mounted(state)&&!state.collapsed&&!state.outOfView;
    const reduced=()=>!!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    function stopTimer(state){if(state.timer!==null){win.clearTimeout(state.timer);state.timer=null;}}
    function render(state){
      if(!available(state))return;
      const correct=state.phase==='correct',flipping=state.phase==='flipping';
      state.example.dataset.case=correct?'red-red':'red-green';
      state.example.dataset.state=state.phase;
      state.example.dataset.changing=String(flipping&&!reduced());
      state.first.dataset.reversed='false';
      state.second.dataset.reversed=String(correct||flipping);
      state.assembly.setAttribute('aria-busy',String(flipping&&!reduced()));
      state.assembly.setAttribute('aria-label',text(correct?'redAria':flipping?'flippingAria':'wrongAria',state.language));
      state.joint.innerHTML=icon(correct?'check':flipping?'swap':'x');
      state.verdict.textContent=text(correct?'correct':flipping?'flipping':'wrong',state.language);
      state.result.textContent=text(correct?'redRed':flipping?'flipping':'redGreen',state.language);
      state.replayLabel.textContent=text(reduced()?(correct?'showWrong':'showCorrect'):'replay',state.language);
    }
    function schedule(state,job,ms){stopTimer(state);if(!available(state)||reduced())return;state.timer=win.setTimeout(()=>{state.timer=null;if(available(state))job();},ms);}
    function advance(state){
      const ms=state.phase==='wrong'?2700:state.phase==='flipping'?900:4200;
      schedule(state,()=>{state.phase=state.phase==='wrong'?'flipping':state.phase==='flipping'?'correct':'wrong';render(state);advance(state);},ms);
    }
    function restart(state,{initial=false}={}){
      stopTimer(state);if(!available(state))return;
      // Never resume halfway through an explanatory movement after hiding.
      if(reduced()&&(initial||state.phase==='flipping'))state.phase='correct';
      else if(state.phase==='flipping')state.phase='wrong';
      render(state);advance(state);
    }
    function collapse(state,value){
      stopTimer(state);state.collapsed=value;state.root.dataset.collapsed=String(value);state.content.hidden=value;state.reopen.hidden=!value;state.reopen.setAttribute('aria-expanded',String(!value));
      if(value){state.assembly.setAttribute('aria-busy','false');state.example.dataset.changing='false';state.reopen.focus?.({preventScroll:true});}
      else {restart(state);state.title.focus?.({preventScroll:true});}
    }
    function click(event){
      const button=event.target?.closest?.('[data-spi-tutorial-action]'),root=button?.closest?.('[data-spi-tutorial-root]'),state=states.get(root);if(!state||!container.contains(button)||!mounted(state)||button.disabled)return;
      const action=button.dataset.spiTutorialAction;if(!['open','close','replay'].includes(action))return;event.preventDefault();event.stopPropagation();
      if(action==='open'){collapse(state,false);return;}if(action==='close'){collapse(state,true);return;}
      if(state.collapsed)return;
      state.phase=reduced()&&state.phase!=='correct'?'correct':'wrong';restart(state);
    }
    function visibility(){for(const state of states.values())if(doc?.hidden)stopTimer(state);else restart(state);}
    container.addEventListener('click',click);doc?.addEventListener?.('visibilitychange',visibility);
    const motion=win.matchMedia?.('(prefers-reduced-motion: reduce)'),motionChanged=()=>{for(const state of states.values())restart(state,{initial:true});};
    motion?.addEventListener?.('change',motionChanged);
    const observer=typeof win.IntersectionObserver==='function'?new win.IntersectionObserver(entries=>{for(const entry of entries){const state=states.get(entry.target);if(!state)continue;state.outOfView=!entry.isIntersecting;if(state.outOfView)stopTimer(state);else restart(state);}}):null;
    for(const state of states.values()){state.content.hidden=state.collapsed;state.reopen.hidden=!state.collapsed;state.reopen.setAttribute('aria-expanded',String(!state.collapsed));restart(state,{initial:true});observer?.observe(state.root);}
    function cleanup(){if(!alive)return;alive=false;for(const state of states.values())stopTimer(state);observer?.disconnect();motion?.removeEventListener?.('change',motionChanged);container.removeEventListener('click',click);doc?.removeEventListener?.('visibilitychange',visibility);if(bindings.get(container)===cleanup)bindings.delete(container);}
    bindings.set(container,cleanup);return cleanup;
  }
  return Object.freeze({markup,bind});
}));
