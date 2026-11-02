/* C101 order explainer: "copy what you see on your stand into the app".
 * One looping CSS timeline in three steps (look, place, check). Local
 * illustration only: no model, receiver, bridge or storage access. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.LightningOrderMirror=factory();
}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const words={
    nl:{title:'Neem over wat je ziet',lead:'Elke ledline op je stand brandt nu in een eigen kleur. Zet in de app dezelfde kleur op dezelfde plaats.',
      stand:'Op je stand',app:'In de app',red:'Rood',green:'Groen',blue:'Blauw',
      step1:'Kijk naar je stand',step1Hint:'Elke ledline brandt in een eigen kleur.',
      step2:'Sleep dezelfde kleur naar dezelfde plaats',step2Hint:'Rood brandt op plaats 1, dus sleep Rood naar 1.',
      step3:'Alles gelijk? Tik op Klaar',step3Hint:'Je stand en de app tonen dezelfde volgorde.',
      note:'Voorbeeld · stuurt geen licht aan',pause:'Pauze',play:'Afspelen',replay:'Opnieuw',accessible:'Uitleg in drie stappen'},
    en:{title:'Copy what you see',lead:'Each LED line on your stand now glows in its own colour. Put the same colour in the same position in the app.',
      stand:'On your stand',app:'In the app',red:'Red',green:'Green',blue:'Blue',
      step1:'Look at your stand',step1Hint:'Each LED line glows in its own colour.',
      step2:'Drag the same colour to the same position',step2Hint:'Red glows in position 1, so drag Red to 1.',
      step3:'All matching? Tap Done',step3Hint:'Your stand and the app show the same order.',
      note:'Example · does not control any lights',pause:'Pause',play:'Play',replay:'Replay',accessible:'Explanation in three steps'},
    fr:{title:'Reproduisez ce que vous voyez',lead:'Chaque ligne LED de votre stand brille dans sa propre couleur. Placez la même couleur au même endroit dans l’app.',
      stand:'Sur votre stand',app:'Dans l’app',red:'Rouge',green:'Vert',blue:'Bleu',
      step1:'Regardez votre stand',step1Hint:'Chaque ligne LED a sa propre couleur.',
      step2:'Glissez la même couleur au même endroit',step2Hint:'Le rouge brille en position 1 : glissez Rouge sur 1.',
      step3:'Tout correspond ? Touchez Terminé',step3Hint:'Le stand et l’app affichent le même ordre.',
      note:'Exemple · ne commande aucun éclairage',pause:'Pause',play:'Lire',replay:'Rejouer',accessible:'Explication en trois étapes'},
    de:{title:'Übernimm, was du siehst',lead:'Jede LED-Linie an deinem Stand leuchtet jetzt in einer eigenen Farbe. Setze in der App dieselbe Farbe an dieselbe Stelle.',
      stand:'An deinem Stand',app:'In der App',red:'Rot',green:'Grün',blue:'Blau',
      step1:'Schau auf deinen Stand',step1Hint:'Jede LED-Linie leuchtet in einer eigenen Farbe.',
      step2:'Ziehe dieselbe Farbe an dieselbe Stelle',step2Hint:'Rot leuchtet auf Platz 1, also Rot auf 1 ziehen.',
      step3:'Alles gleich? Tippe auf Fertig',step3Hint:'Stand und App zeigen dieselbe Reihenfolge.',
      note:'Beispiel · steuert kein Licht',pause:'Pause',play:'Abspielen',replay:'Nochmal',accessible:'Erklärung in drei Schritten'}
  };
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text=(language,key)=>(words[language]||words.nl)[key];
  const grip='<svg viewBox="0 0 16 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="6" r="1.6"/><circle cx="11" cy="6" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="11" cy="12" r="1.6"/><circle cx="5" cy="18" r="1.6"/><circle cx="11" cy="18" r="1.6"/></svg>';
  const hand='<svg viewBox="0 0 32 36" aria-hidden="true"><path d="M10 19V6a3 3 0 0 1 6 0v11l3-1 9 5v7a6 6 0 0 1-6 6h-5a6 6 0 0 1-5-3L5 22a3 3 0 0 1 4-4l4 5"/></svg>';
  const eye='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const phone='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 18.5h3"/></svg>';

  // Stand: red, green, blue. App starts with blue and red swapped; the hand
  // drags red from place 3 to place 1 and blue slides down to 3.
  function markup({language='nl',compact=false}={}){
    const w=key=>esc(text(language,key));
    const wall=['red','green','blue'].map((c,i)=>`<li class="om-wall-line" data-om-colour="${c}" style="--om-i:${i}"><b>${i+1}</b><span class="om-led"><i></i></span><small>${w(c)}</small></li>`).join('');
    const cards=['blue','green','red'].map((c,i)=>`<li class="om-card" data-om-colour="${c}" data-om-slot="${i}"><span class="om-swatch"></span><b>${w(c)}</b><span class="om-grip">${grip}</span></li>`).join('');
    const links=[0,1,2].map(i=>`<span class="om-link" style="--om-i:${i}"><i></i><b>✓</b></span>`).join('');
    const steps=[1,2,3].map(n=>`<li class="om-step" data-om-step="${n}"><span class="om-step-number">${n}</span><span><b>${w('step'+n)}</b><small>${w('step'+n+'Hint')}</small></span></li>`).join('');
    return `<section class="order-mirror101" data-om-compact="${compact}" data-playing="true" aria-label="${w('accessible')}">
      ${compact?'':`<p class="om-lead">${w('lead')}</p>`}
      <div class="om-stage" aria-hidden="true">
        <div class="om-panel om-panel-stand"><p class="om-panel-title">${eye}${w('stand')}</p><ol class="om-wall">${wall}</ol></div>
        <div class="om-links">${links}</div>
        <div class="om-panel om-panel-app"><p class="om-panel-title">${phone}${w('app')}</p><div class="om-app"><ol class="om-slots"><li>1</li><li>2</li><li>3</li></ol><ol class="om-cards">${cards}</ol><span class="om-hand">${hand}</span></div></div>
      </div>
      <ol class="om-steps">${steps}</ol>
      ${compact?'':`<div class="om-controls"><button type="button" data-om-action="toggle" data-label-play="${w('play')}" data-label-pause="${w('pause')}"><span data-om-symbol>Ⅱ</span><span data-om-label>${w('pause')}</span></button><button type="button" data-om-action="replay"><span aria-hidden="true">↻</span>${w('replay')}</button></div><p class="om-note">${w('note')}</p>`}
    </section>`;
  }

  function mount(root){
    if(!root)return ()=>{};
    const doc=root.ownerDocument;
    const toggle=root.querySelector('[data-om-action="toggle"]');
    function setPlaying(playing){
      root.dataset.playing=String(playing);
      if(toggle){toggle.querySelector('[data-om-label]').textContent=playing?toggle.dataset.labelPause:toggle.dataset.labelPlay;toggle.querySelector('[data-om-symbol]').textContent=playing?'Ⅱ':'▶';}
    }
    function replay(){
      // Restart every CSS animation in the stage from the first frame.
      root.classList.add('om-restart');void root.offsetWidth;root.classList.remove('om-restart');setPlaying(true);
    }
    function click(event){
      const button=event.target.closest?.('[data-om-action]');if(!button||!root.contains(button))return;
      if(button.dataset.omAction==='toggle')setPlaying(root.dataset.playing!=='true');
      if(button.dataset.omAction==='replay')replay();
    }
    function visibility(){if(doc.hidden)setPlaying(false);}
    root.addEventListener('click',click);doc.addEventListener('visibilitychange',visibility);
    return function dispose(){root.removeEventListener('click',click);doc.removeEventListener('visibilitychange',visibility);};
  }
  return Object.freeze({markup,mount,words});
}));
