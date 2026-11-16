/* Aluvision: stap 2 "Looprichting" (volgorde en kanten in één scherm; C229, tester-ronde 12 nov, opmerking 11).
 * De naam: de eigenaar, 13 nov: "graag volgorde en kanten een duidelijker naam geven aangezien dit nu 1 stap is geworden".
 * "Looprichting" is het woord dat de app al gebruikt voor de richting van een ledline; stepName() geeft de naam aan de
 * andere schermen (de kop van stap 1, de balk van de toevoeg-flow, de tutorials, de receiverpagina).
 * de eigenaar over de volgordestap: "dit is de oude versie"; en toen de oude stappen een nieuw jasje kregen: "we hebben
 * gisteren een nieuwe gebouwd ... zo als het in de tutorial is, met die overloop kleuren". Dit is dat scherm, uit het
 * goedgekeurde prototype prototypes/ketting-leggen (C141p), nu in de app:
 *   - deelstap 1 "Zet je ledlines in volgorde": elke ledline brandt effen in zijn eigen kleur; de klant kijkt naar zijn
 *     stand en sleept de kaarten in dezelfde volgorde. Onderaan "Volgende stap".
 *   - deelstap 2 "Laat de kleuren doorlopen": het einde van elke ledline (weg van de connector) loopt over in de kleur
 *     van de volgende; waar dat staartje aan de verkeerde kant zit, draait de klant de ledline om. De laatste loopt over
 *     in de kleur van de eerste. Terug, Testlicht en Klaar.
 *   - RGBW: alleen de volgorde van de receivers (geen kanten); bij Klaar loopt één keer het testlicht.
 *   - Tikken of vastpakken: die ledline pulseert in zijn eigen kleur (op de kaart, en via onIdentify op de stand).
 * Dit bestand is alleen het scherm. Het licht op de stand (onLight), het aanwijzen (onIdentify), het testlicht (onTest),
 * de tutorial (onTutorial) en het bewaren (onSave) vraagt het aan de app; zelf stuurt het niets naar een receiver.
 */
(function(){
'use strict';
const LANGS=['nl','en','fr','de'];
const T={
  head:['Ledlines instellen','Set up LED lines','Régler les lignes LED','LED-Linien einrichten'],why:['Bij SPI krijgt elke ledline eigen data.','With SPI every LED line gets its own data.','En SPI, chaque ligne LED reçoit ses propres données.','Bei SPI bekommt jede LED-Linie eigene Daten.'],
  headRgbw:['Volgorde van je receivers','Order of your receivers','Ordre de vos récepteurs','Reihenfolge deiner Receiver'],whyRgbw:['Voor tunneleffecten in deze zone.','For tunnel effects in this zone.','Pour les effets tunnel de cette zone.','Für Tunneleffekte in dieser Zone.'],
  zoneOne:['Zone {zone} · 1 ledline','Zone {zone} · 1 LED line','Zone {zone} · 1 ligne LED','Zone {zone} · 1 LED-Linie'],
  zone:['Zone {zone} · {n} ledlines','Zone {zone} · {n} LED lines','Zone {zone} · {n} lignes LED','Zone {zone} · {n} LED-Linien'],zoneRgbw:['Zone {zone} · {n} RGBW-receivers','Zone {zone} · {n} RGBW receivers','Zone {zone} · {n} récepteurs RGBW','Zone {zone} · {n} RGBW-Receiver'],
  title1:['Zet je ledlines in volgorde','Put your LED lines in order','Mettez vos lignes LED dans l’ordre','Bring deine LED-Linien in Reihenfolge'],
  sentence1:['Kijk naar je stand: <b>sleep de kaarten in dezelfde volgorde.</b>','Look at your stand: <b>drag the cards into the same order.</b>','Regardez votre stand : <b>glissez les cartes dans le même ordre.</b>','Schau auf deinen Stand: <b>zieh die Karten in dieselbe Reihenfolge.</b>'],
  title1Rgbw:['Zet je receivers in volgorde','Put your receivers in order','Mettez vos récepteurs dans l’ordre','Bring deine Receiver in Reihenfolge'],
  sentence1Rgbw:['Elke receiver brandt in een eigen kleur. Kijk naar je stand: <b>sleep de kaarten in dezelfde volgorde.</b>','Every receiver lights in its own colour. Look at your stand: <b>drag the cards into the same order.</b>','Chaque récepteur s’allume dans sa couleur. Regardez votre stand : <b>glissez les cartes dans le même ordre.</b>','Jeder Receiver leuchtet in seiner Farbe. Schau auf deinen Stand: <b>zieh die Karten in dieselbe Reihenfolge.</b>'],
  label1:['Jouw volgorde','Your order','Votre ordre','Deine Reihenfolge'],
  title2:['Laat de kleuren doorlopen','Make the colours run on','Faites continuer les couleurs','Lass die Farben durchlaufen'],
  sentence2:['Kijk naar je stand: <b>draai om waar de kleuren niet doorlopen.</b>','Look at your stand: <b>flip where the colours do not run on.</b>','Regardez votre stand : <b>inversez là où les couleurs ne continuent pas.</b>','Schau auf deinen Stand: <b>dreh um, wo die Farben nicht durchlaufen.</b>'],
  label2:['Zo moet het op je stand lopen','This is how it should run on your stand','Voici le résultat attendu sur votre stand','So soll es auf deinem Stand laufen'],
  tutorial:['Bekijk tutorial','View tutorial','Voir le tutoriel','Tutorial ansehen'],
  next:['Volgende stap','Next step','Étape suivante','Nächster Schritt'],back:['Terug','Back','Retour','Zurück'],test:['Test','Test','Test','Test'],testAria:['Testlicht','Test light','Lumière de test','Testlicht'],done:['Klaar','Done','Terminé','Fertig'],close:['Sluiten','Close','Fermer','Schließen'],
  list:['Volgorde van de ledlines','Order of the LED lines','Ordre des lignes LED','Reihenfolge der LED-Linien'],
  card:['{i}: {name}. Tik om deze ledline op je stand te laten pulseren.','{i}: {name}. Tap to make this LED line pulse on your stand.','{i} : {name}. Touchez pour faire pulser cette ligne LED sur votre stand.','{i}: {name}. Tippe, damit diese LED-Linie auf deinem Stand pulsiert.'],
  flip:['{name} omdraaien','Flip {name}','Inverser {name}','{name} umdrehen'],grip:['{name} verslepen. Pijltjes omhoog en omlaag verplaatsen.','Drag {name}. Arrow up and down move it.','Faire glisser {name}. Les flèches haut et bas déplacent.','{name} ziehen. Pfeile nach oben und unten verschieben.'],
  pulses:['{name} pulseert nu op je stand.','{name} is pulsing on your stand now.','{name} pulse maintenant sur votre stand.','{name} pulsiert jetzt auf deinem Stand.'],
  testRuns:['Het testlicht loopt nu over je stand. Kijk of het mooi doorloopt.','The test light is running over your stand. Check that it flows on.','La lumière de test parcourt votre stand. Vérifiez qu’elle continue bien.','Das Testlicht läuft über deinen Stand. Prüfe, ob es durchläuft.'],
  testRunsRgbw:['Het testlicht loopt nu van receiver naar receiver. Kijk of het mooi doorloopt.','The test light is running from receiver to receiver. Check that it flows on.','La lumière de test passe de récepteur en récepteur. Vérifiez qu’elle continue bien.','Das Testlicht läuft von Receiver zu Receiver. Prüfe, ob es durchläuft.'],
  saving:['Bewaren…','Saving…','Enregistrement…','Speichern…'],
  saveFailed:['Bewaren is nog niet gelukt. Probeer opnieuw; je keuzes blijven staan.','Saving did not work yet. Try again; your choices are kept.','L’enregistrement n’a pas encore abouti. Réessayez ; vos choix sont conservés.','Speichern hat noch nicht geklappt. Versuche es erneut; deine Auswahl bleibt.'],
  step1:['Ledlines en pixels','LED lines and pixels','Lignes et pixels','LED-Linien und Pixel'],step2:['Looprichting','Travel direction','Sens de déplacement','Laufrichtung'],stepNo:['Stap {n}','Step {n}','Étape {n}','Schritt {n}']
};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// ---------- kleur ----------
const hex=h=>/^#[0-9a-f]{6}$/i.test(h||'')?[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)):[138,147,160];
const css=c=>`rgb(${c.map(v=>Math.max(0,Math.min(255,Math.round(v)))).join(',')})`;
const lin=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);};
const unlin=v=>255*(v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055);
const mix=(a,b,t)=>a.map((v,i)=>unlin(lin(v)*(1-t)+lin(b[i])*t));
const reduce=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}};
// De overloop naar de volgende ledline moet heel duidelijk zijn: een kort verloop en dan een blok in de volgende kleur.
const tailBg=(own,next,deg)=>`linear-gradient(${deg}deg,${css(own)} 0%,${css(mix(own,next,.5))} 12%,${css(next)} 28%,${css(next)} 100%)`;
// ---------- iconen ----------
const ICON_FLIP='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17 3 4 4-4 4M3 7h18M7 21l-4-4 4-4m14 4H3"/></svg>';
const ICON_GRIP='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6.5" r="1.5"/><circle cx="15" cy="6.5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="17.5" r="1.5"/><circle cx="15" cy="17.5" r="1.5"/></svg>';
// Testlicht: zoals de test er op de stand uitziet: een rode ledline (met de twee witte randen) met een wit lichtje erop.
const ICON_TEST='<svg viewBox="0 0 28 14" aria-hidden="true"><rect x="1" y="3.5" width="26" height="7" rx="1.5" fill="#F0473D"/><rect x="1" y="3.5" width="26" height="1.5" fill="#fff" opacity=".9"/><rect x="1" y="9" width="26" height="1.5" fill="#fff" opacity=".9"/>'+
  '<g class="tl-dot"><circle cx="17" cy="7" r="4.8" fill="#fff" opacity=".4"/><circle cx="17" cy="7" r="2.6" fill="#fff"/></g></svg>';
const ICON_CHECK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const ICON_BACK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
const ICON_NEXT='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const ICON_PLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
// De connector op de kaart, zoals op de stand: witte kabel, trekontlasting met ribbels, huls, gekartelde wartel, rode
// O-ring, huls, ribbels en dan de kabel naar het begin van de strip.
const ICON_PLUG='<svg viewBox="0 0 44 16" aria-hidden="true"><path class="co" d="M1 8H3.5M30.5 8H44"/><path class="ci" d="M1 8H3.5M30.5 8H44"/>'+
  '<rect class="w" x="3" y="5" width="4" height="6" rx="1"/><path class="l" d="M4.3 5.800v4.400M5.700 5.800v4.400"/><rect class="w" x="7" y="4" width="4" height="8" rx="1.2"/>'+
  '<rect class="w" x="11" y="2" width="8" height="12" rx="2"/><path class="l" d="M13 3.400v9.200M15 3.400v9.200M17 3.400v9.200"/><rect class="r" x="19" y="3.6" width="1.6" height="8.8" rx=".6"/>'+
  '<rect class="w" x="20.6" y="4" width="6" height="8" rx="1.2"/><rect class="w" x="26.6" y="5" width="4.4" height="6" rx="1"/><path class="l" d="M27.900 5.800v4.400M29.300 5.800v4.400"/></svg>';
// RGBW: een kleine receiver (zwart, met zijn ene uitgang) in plaats van de connector van een ledline
const ICON_RCV='<svg viewBox="0 0 44 16" aria-hidden="true"><path d="M1 8h6" stroke="#1c1c1e" stroke-width="2.4" stroke-linecap="round"/><rect x="7" y="2.5" width="30" height="11" rx="2.4" fill="#1c1c1e" stroke="#4a4c51" stroke-width=".8"/><rect x="7" y="2.5" width="6" height="11" rx="1.6" fill="#2a2b2f"/><circle cx="30" cy="6" r="1.3" fill="#1FC45B"/><path d="M37 8h6" stroke="#f4f4f1" stroke-width="2" stroke-linecap="round"/></svg>';

// De kleuren in de volgorde waarin de app ze uitdeelt (langs de startvolgorde). Buren verschillen sterk; rood en groen
// staan nooit naast elkaar. Meer dan acht ledlines: het palet begint opnieuw, met een volgnummer achter de naam.
const PALETTE=[[['Blauw','Blue','Bleu','Blau'],'#2F6BFF'],[['Geel','Yellow','Jaune','Gelb'],'#FFC61A'],[['Turkoois','Turquoise','Turquoise','Türkis'],'#19C9E6'],[['Rood','Red','Rouge','Rot'],'#F0473D'],
  [['Wit','White','Blanc','Weiß'],'#F1F0EC'],[['Groen','Green','Vert','Grün'],'#1FC45B'],[['Roze','Pink','Rose','Rosa'],'#FF4FB0'],[['Oranje','Orange','Orange','Orange'],'#FF7A1A']];
function palette(count,language='nl'){
  const li=Math.max(0,LANGS.indexOf(String(language||'nl').toLowerCase().split('-')[0]));
  return Array.from({length:Math.max(0,Math.floor(Number(count)||0))},(_,i)=>{const [names,colour]=PALETTE[i%PALETTE.length],round=Math.floor(i/PALETTE.length);
    return {name:names[li]+(round?' '+(round+1):''),hex:colour};});
}

// De naam van deze stap voor de andere schermen ("Looprichting").
function stepName(language){
  const li=Math.max(0,LANGS.indexOf(String(language||document.documentElement.lang||'nl').toLowerCase().split('-')[0]));
  return T.step2[li]||T.step2[0];
}

function create({onLight=null,onIdentify=null,onTest=null,onSave=null,onClose=null,onTutorial=null}={}){
  let dialog=null,S=null,drag=null,press=null,suppressClick=false,testTimers=[],busy=false,unbind=[],lang=0,identifyTimer=0,toastTimer=0,finalTimer=0;
  const $=s=>dialog.querySelector(s),$$=s=>[...dialog.querySelectorAll(s)];
  const t=(key,params={})=>String((T[key]||[key])[lang]??(T[key]||[key])[0]).replace(/\{(\w+)\}/g,(m,name)=>name in params?String(params[name]):m);
  const line=id=>S.lines.find(L=>L.id===id),colourOf=L=>hex(L.hex),nameOf=L=>L.name;
  const safe=(fn,...args)=>{try{return typeof fn==='function'?fn(...args):undefined;}catch(_){return undefined;}};
  const snapshot=()=>({step:S.step,order:S.order.slice(),flips:S.order.filter(id=>S.flip.has(id))});
  const light=()=>{if(S)safe(onLight,snapshot());};
  // De laatste loopt altijd over in de kleur van de eerste: zo zie je ook bij de laatste ledline of hij goed staat.
  function nextLine(i,order=S.order){if(i<0)return null;if(i<order.length-1)return line(order[i+1]);return order.length>1?line(order[0]):null;}

  // ---------- tekenen ----------
  function itemHtml(id,i){
    const L=line(id),name=esc(nameOf(L));
    // de plaats (1, 2, 3 ...) staat vast in een eigen kolom; je sleept alleen de ledline naar de juiste plaats
    return `<li class="kt-rank" aria-hidden="true" style="grid-row:${i+1}"><b>${i+1}</b></li>`+
      `<li class="kt-item" data-id="${esc(id)}" style="grid-row:${i+1}"><div class="kt-card" data-card tabindex="0" style="--hl:${css(colourOf(L))}" aria-label="${esc(t('card',{i:i+1,name:nameOf(L)}))}">`+
      `<span class="kt-name">${name}</span>`+
      `<span class="kt-strip" aria-hidden="true"><i class="kt-plug${S.rgbw?' kt-rcv':''}">${S.rgbw?ICON_RCV:ICON_PLUG}</i><i class="kt-bar" data-bar><i class="kt-tail" style="--i:${i}"></i><i class="kt-rim"></i></i></span>`+
      (S.rgbw?'':`<button type="button" class="kt-flip" data-flip aria-pressed="${S.flip.has(id)}" aria-label="${esc(t('flip',{name:nameOf(L)}))}">${ICON_FLIP}</button>`)+
      `<button type="button" class="kt-grip" data-grip aria-label="${esc(t('grip',{name:nameOf(L)}))}">${ICON_GRIP}</button></div></li>`;
  }
  function renderList(){$('[data-list]').innerHTML=S.order.map(itemHtml).join('');paintApp();}
  // Kaartstrip, zoals de ledline zelf (connector links): effen eigen kleur. In deelstap 2 loopt het einde duidelijk over in
  // de kleur van de volgende ledline (kort verloop + blok). Omgedraaid = het staartje zit aan de andere kant.
  function paintBar(bar,L,order=S.order){
    const nx=nextLine(order.indexOf(L.id),order),own=colourOf(L),flip=S.flip.has(L.id),tail=bar.firstElementChild;
    bar.style.background=css(own);
    if(!nx||S.rgbw){tail.style.display='none';return;}
    tail.style.display='';tail.className='kt-tail '+(flip?'is-left':'is-right');tail.style.background=tailBg(own,colourOf(nx),flip?270:90);
  }
  function paintApp(order=S.order){
    for(const li of $$('[data-list]>.kt-item'))paintBar(li.querySelector('[data-bar]'),line(li.dataset.id),order);
    renderOverview(order);
  }
  // Overzichtsbalk: de ketting in volgorde; in deelstap 2 met de staartjes, zoals het op de stand moet lopen.
  function renderOverview(order=S.order){
    $('.kt-ov-bars').innerHTML=order.map((id,i)=>{const L=line(id),nx=nextLine(i,order),own=colourOf(L);
      return `<i style="background:${css(own)}">${nx&&!S.rgbw?`<i class="kt-tail is-right" style="--i:${i};background:${tailBg(own,colourOf(nx),90)}"></i>`:''}</i>`;}).join('');
  }
  function headHtml(){
    const LS=window.LightningLedlineSetup;
    if(S.rgbw||!LS)return `<div class="ls-head"><div class="ls-intro"><i aria-hidden="true">${LS?LS.icon():''}</i><span><b>${esc(t(S.rgbw?'headRgbw':'head'))}</b><small>${esc(t(S.rgbw?'whyRgbw':'why'))}</small></span></div></div>`;
    // dezelfde kop als stap 1 (ledlines-setup.js); in de wizard toont de balk bovenaan de twee stappen al
    return LS.head(S.step+2,{done1:true,steps:!S.wizard});
  }
  function setStep(n,{silent=false}={}){
    S.step=n;$('.kt-app').dataset.step=String(n);
    const rgbw=S.rgbw,title=t(n===2?'title2':rgbw?'title1Rgbw':'title1'),sentence=t(n===2?'sentence2':rgbw?'sentence1Rgbw':'sentence1');
    $('[data-title]').textContent=title;$('[data-sentence]').innerHTML=sentence;$('[data-ov-label]').textContent=t(n===2?'label2':'label1');
    if(!reduce()&&!silent)for(const el of [$('[data-title]'),$('[data-sentence]'),$('[data-ov-label]')])el.animate?.([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:280,easing:'cubic-bezier(.2,.8,.2,1)'});
    $('[data-sp-head]').innerHTML=headHtml();
    if(n!==2)stopTest();
    syncFooter();
    if(!silent)light();
  }
  function syncFooter(){
    for(const b of $$('.kt-footer button'))b.disabled=busy;
    const next=$('[data-action=next]');if(next){next.querySelector('span').textContent=t(S.rgbw?'done':'next');next.classList.toggle('is-done',S.rgbw);}
    const done=$('[data-action=done] span');if(done)done.textContent=t(busy?'saving':'done');
    $('[data-action=close]').disabled=busy;
  }
  function toast(text,ms=2600){const node=$('[data-toast]');if(!node)return;node.textContent=text;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{if(dialog)node.hidden=true;},ms);}
  const buzz=ms=>{try{navigator.vibrate?.(ms);}catch(_){}};

  // ---------- omdraaien, aanwijzen, testlicht ----------
  // Omdraaien: de strip zelf draait niet; de overloop vloeit mooi naar de andere kant. Een blok in de kleur van de
  // volgende ledline glijdt over de strip, het oude staartje vervaagt en aan de overkant komt het nieuwe.
  function flipLine(id){
    if(busy||S.rgbw)return;
    S.flip.has(id)?S.flip.delete(id):S.flip.add(id);
    const li=$(`.kt-item[data-id="${CSS.escape(id)}"]`);li?.querySelector('[data-flip]')?.setAttribute('aria-pressed',String(S.flip.has(id)));
    light();
    const bar=li?.querySelector('[data-bar]');if(!bar)return;
    const L=line(id),nx=nextLine(S.order.indexOf(id)),tail=bar.firstElementChild;
    bar.querySelectorAll('.kt-blob').forEach(b=>b.remove());tail.getAnimations?.().forEach(a=>a.cancel());
    if(reduce()||!nx||typeof bar.animate!=='function'){paintBar(bar,L);return;}
    const w=bar.offsetWidth,tw=w*.34,c=colourOf(nx),c0=`rgba(${c.join(',')},0)`,toLeft=S.flip.has(id);
    const blob=document.createElement('i');blob.className='kt-blob';blob.style.width=(tw*1.25).toFixed(1)+'px';
    blob.style.background=`linear-gradient(90deg,${c0} 0%,${css(c)} 28%,${css(c)} 72%,${c0} 100%)`;bar.insertBefore(blob,tail.nextSibling);
    const R=(w-.95*tw).toFixed(1),Lx=(-.3*tw).toFixed(1),from=toLeft?R:Lx,to=toLeft?Lx:R;
    tail.animate([{opacity:1},{opacity:0}],{duration:240,fill:'forwards'});
    const m=blob.animate([{transform:`translateX(${from}px)`,opacity:0},{opacity:1,offset:.16},{opacity:1,offset:.82},{transform:`translateX(${to}px)`,opacity:0}],{duration:900,easing:'cubic-bezier(.65,0,.35,1)'});
    setTimeout(()=>{if(!dialog||!bar.isConnected)return;paintBar(bar,L);tail.getAnimations().forEach(a=>a.cancel());tail.animate([{opacity:0},{opacity:1}],{duration:240});},680);
    m.onfinish=()=>blob.remove();
  }
  // Tikken (of ingedrukt houden): die ledline pulseert een paar keer in zijn eigen kleur op de stand ("deze is het").
  // De kaart licht op in dezelfde kleur en vervaagt daarna weer (twee pulsen, 1,2 s).
  function identify(id){
    const card=$(`.kt-item[data-id="${CSS.escape(id)}"] .kt-card`);if(!card)return;
    $$('.kt-card.is-identifying').forEach(c=>c.classList.remove('is-identifying'));
    card.classList.add('is-identifying');clearTimeout(identifyTimer);identifyTimer=setTimeout(()=>card.classList.remove('is-identifying'),1200);
    toast(t('pulses',{name:nameOf(line(id))}));
    safe(onIdentify,id,snapshot());
  }
  // Testlicht: op de stand gaan alle ledlines rustig naar rood en loopt er één brede, zachte witte band in één beweging
  // overheen. In de app gebeurt hetzelfde op de overzichtsbalk en op de kaartstrips: de band loopt over een kaart op het
  // moment dat hij over die ledline loopt.
  function stopTest(){
    testTimers.forEach(clearTimeout);testTimers=[];if(!dialog)return;
    $('.kt-app').classList.remove('is-testing');$('[data-action=test]')?.classList.remove('is-running');$$('.kt-chase').forEach(e=>e.remove());
  }
  function runTest(){
    stopTest();
    const btn=$('[data-action=test]'),segs=$$('.kt-ov-bars>i'),bars=$$('[data-list]>.kt-item [data-bar]'),n=segs.length,FADE=500,D=Math.max(3600,n*800);
    btn?.classList.add('is-running');$('.kt-app').classList.add('is-testing');
    toast(t(S.rgbw?'testRunsRgbw':'testRuns'),3400);
    safe(onTest,snapshot());
    if(!reduce()&&n&&typeof segs[0].animate==='function'){
      const x0=segs[0].offsetLeft,W=segs[n-1].offsetLeft+segs[n-1].offsetWidth-x0,BW=Math.max(56,W*.2);
      const band=(host,w)=>{const b=document.createElement('i');b.className='kt-chase';b.style.width=w.toFixed(1)+'px';host.append(b);return b;};
      segs.forEach((seg,i)=>{
        const x=seg.offsetLeft-x0,sw=seg.offsetWidth;
        band(seg,BW).animate([{transform:`translateX(${-BW-x}px)`},{transform:`translateX(${W-x}px)`}],{duration:D,delay:FADE,easing:'linear',fill:'both'});
        const bar=bars[i];if(!bar)return;
        const w=bar.offsetWidth,cb=BW*w/Math.max(1,sw),tin=D*x/(W+BW),tout=D*(x+sw+BW)/(W+BW);
        band(bar,cb).animate([{transform:`translateX(${-cb}px)`},{transform:`translateX(${w}px)`}],{duration:Math.max(1,tout-tin),delay:FADE+tin,easing:'linear',fill:'both'});
      });
    }
    const length=FADE+D+150;testTimers.push(setTimeout(stopTest,length));return length;
  }

  // ---------- bewaren ----------
  async function save(){
    if(busy||!S)return;busy=true;stopTest();syncFooter();
    const result=snapshot();let ok=false;
    try{await (typeof onSave==='function'?onSave(result):null);ok=true;}catch(_){ok=false;}
    if(!dialog)return;
    busy=false;syncFooter();
    if(ok)close('saved');else toast(t('saveFailed'),4200);
  }
  // RGBW: Klaar = één testlicht van receiver naar receiver, daarna bewaren
  function rgbwDone(){
    if(busy)return;const length=runTest(),wait=reduce()?900:length+550;$('.kt-app').classList.add('is-final-test');busy=true;syncFooter();
    // een eigen timer: stopTest() wist de timers van het testlicht
    clearTimeout(finalTimer);finalTimer=setTimeout(()=>{if(!dialog)return;$('.kt-app').classList.remove('is-final-test');busy=false;void save();},wait);
  }

  // ---------- slepen ----------
  const scroller=()=>$('.kt-main');
  function startDrag(li,y){
    if(!li||drag||busy)return;
    const list=$('[data-list]'),items=[...list.querySelectorAll(':scope>.kt-item')],from=items.indexOf(li);if(from<0)return;
    const lr=list.getBoundingClientRect(),rects=items.map(e=>{const r=e.getBoundingClientRect();return {top:r.top-lr.top,h:r.height};}),sc=scroller();
    drag={li,items,from,to:from,rects,y0:y,y,sc,s0:sc.scrollTop,gap:parseFloat(getComputedStyle(list).rowGap)||8,list,slot:document.createElement('div'),raf:0};
    drag.slot.className='kt-slot';drag.slot.setAttribute('aria-hidden','true');list.append(drag.slot);
    li.classList.add('is-dragging');document.documentElement.classList.add('kt-dragging');placeSlot();suppressClick=true;
    toast(t('pulses',{name:nameOf(line(li.dataset.id))}),1600);   // vastpakken = die ledline pulseert in zijn kleur op de stand
    safe(onIdentify,li.dataset.id,snapshot());
    buzz(8);
    drag.raf=requestAnimationFrame(autoScroll);
  }
  const slotTop=d=>d.to<=d.from?d.rects[d.to].top:d.rects[d.to].top+d.rects[d.to].h-d.rects[d.from].h;
  function placeSlot(){const d=drag;d.slot.style.top=slotTop(d)+'px';d.slot.style.height=d.rects[d.from].h+'px';}
  function tentative(d){const o=S.order.slice(),[id]=o.splice(d.from,1);o.splice(d.to,0,id);return o;}
  function moveDrag(y){
    const d=drag;if(!d)return;d.y=y;
    const r=d.rects,last=r[r.length-1],raw=y-d.y0+(d.sc.scrollTop-d.s0);
    const dy=Math.max(r[0].top-r[d.from].top-16,Math.min(last.top+last.h-r[d.from].top-r[d.from].h+16,raw));   // tussen de eerste en de laatste plaats
    d.li.style.transform=`translateY(${dy}px)`;
    const c=r[d.from].top+r[d.from].h/2+dy;let to=0;
    for(let j=0;j<r.length;j++)if(j!==d.from&&r[j].top+r[j].h/2<c)to++;
    if(to===d.to)return;
    d.to=to;placeSlot();const h=r[d.from].h+d.gap;
    d.items.forEach((e,j)=>{if(j!==d.from)e.style.transform=d.from<j&&j<=to?`translateY(${-h}px)`:to<=j&&j<d.from?`translateY(${h}px)`:'';});
    paintApp(tentative(d));   // live: in deelstap 2 veranderen de staartjes mee
  }
  function endDrag(){
    const d=drag;if(!d)return;cancelAnimationFrame(d.raf);
    d.li.classList.add('is-settling');d.li.classList.remove('is-dragging');d.li.style.transform=`translateY(${slotTop(d)-d.rects[d.from].top}px)`;d.slot.style.opacity='0';
    setTimeout(()=>{
      document.documentElement.classList.remove('kt-dragging');
      if(!dialog||drag!==d){drag=null;return;}
      const moved=d.to!==d.from;S.order=tentative(d);d.slot.remove();drag=null;renderList();setTimeout(()=>{suppressClick=false;},30);
      if(moved)light();
    },190);
  }
  function autoScroll(){
    const d=drag;if(!d||!dialog)return;
    const top=dialog.getBoundingClientRect().top+30,bottom=$('.kt-footer').getBoundingClientRect().top-24;
    const v=d.y<top?-Math.min(16,(top-d.y)/3):d.y>bottom?Math.min(16,(d.y-bottom)/3):0;
    if(v){const before=d.sc.scrollTop;d.sc.scrollTop=before+v;if(d.sc.scrollTop!==before)moveDrag(d.y);}
    d.raf=requestAnimationFrame(autoScroll);
  }
  function moveByKey(id,delta){
    const i=S.order.indexOf(id),j=i+delta;if(busy||j<0||j>=S.order.length)return;
    S.order.splice(i,1);S.order.splice(j,0,id);renderList();$(`.kt-item[data-id="${CSS.escape(id)}"] [data-grip]`)?.focus();light();
  }

  // ---------- bediening ----------
  function bind(){
    const on=(target,type,handler,options)=>{target.addEventListener(type,handler,options);unbind.push(()=>target.removeEventListener(type,handler,options));};
    on(dialog,'pointerdown',e=>{
      if(drag||e.button>0||e.isPrimary===false||!e.target.closest)return;
      const grip=e.target.closest('[data-grip]');
      if(grip){e.preventDefault();try{grip.setPointerCapture?.(e.pointerId);}catch(_){}startDrag(grip.closest('.kt-item'),e.clientY);return;}
      const card=e.target.closest('[data-card]');
      if(!card||e.target.closest('[data-flip]'))return;
      const li=card.closest('.kt-item');
      press={li,id:li.dataset.id,x:e.clientX,y:e.clientY,on:false,timer:setTimeout(()=>{if(!press)return;press.on=true;identify(press.id);buzz(10);},320)};
    });
    on(window,'pointermove',e=>{
      if(drag){moveDrag(e.clientY);return;}
      if(!press||Math.hypot(e.clientX-press.x,e.clientY-press.y)<=10)return;
      const p=press;press=null;clearTimeout(p.timer);
      if(p.on){startDrag(p.li,p.y);moveDrag(e.clientY);}   // ingedrukt gehouden en dan bewogen: slepen
    });
    // loslaten zonder te bewegen = een tik: die ledline wordt even actief
    const release=tap=>{if(drag)endDrag();if(press){clearTimeout(press.timer);if(tap&&!press.on)identify(press.id);press=null;}};
    on(window,'pointerup',()=>release(true));on(window,'pointercancel',()=>release(false));
    // Tikken op een knop: hij licht even op (actief) en een ring vervaagt naar buiten.
    on(dialog,'pointerdown',e=>{const c=e.target.closest?.('.kt-flip,.kt-back,.kt-test,.kt-done,.kt-tut');if(!c||c.disabled||reduce())return;
      const r=document.createElement('i');r.className='kt-tapring';r.setAttribute('aria-hidden','true');c.append(r);r.addEventListener('animationend',()=>r.remove());},true);
    on(dialog,'touchmove',e=>{if(drag||press?.on)e.preventDefault();},{passive:false});
    on(dialog,'contextmenu',e=>{if(e.target.closest?.('[data-card]'))e.preventDefault();});
    on(dialog,'keydown',e=>{
      const card=e.target.closest?.('[data-card]');
      if(card&&e.target===card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();identify(card.closest('.kt-item').dataset.id);return;}
      const g=e.target.closest?.('[data-grip]');if(!g||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();
      moveByKey(g.closest('.kt-item').dataset.id,e.key==='ArrowUp'?-1:1);
    });
    on(dialog,'click',e=>{
      if(suppressClick||!e.target.closest)return;
      const flip=e.target.closest('[data-flip]');if(flip)return flipLine(flip.closest('.kt-item').dataset.id);
      const b=e.target.closest('button[data-action]');if(!b||b.disabled)return;
      const top=()=>scroller().scrollTo({top:0,behavior:reduce()?'auto':'smooth'});
      switch(b.dataset.action){
        case 'next':if(S.rgbw)return rgbwDone();setStep(2);return top();
        case 'back':if(S.lines.length<2)return;setStep(1);return top();   // deelstap 2 → terug naar de volgorde
        case 'test':return void runTest();
        case 'done':return void save();
        case 'intro':return void safe(onTutorial,snapshot());
        case 'close':return close('close');
      }
    });
    on(dialog,'cancel',e=>{e.preventDefault();if(!busy)close('escape');});
  }
  function place(){
    // onder de logobalk; in de wizard ook onder de stappenbalk (zoals de andere stappen)
    if(!dialog)return;let top=0;try{const r=document.querySelector('header.brand-bar')?.getBoundingClientRect();if(r&&r.height&&r.bottom>4)top=Math.max(0,Math.round(r.bottom));}catch(_){}
    dialog.style.setProperty('--kt-top',(top+(document.documentElement.classList.contains('c137bp-wizard')?40:0))+'px');
  }
  // lines: [{id,name,hex,flip}] · order: ids in de huidige volgorde · rgbw: alleen volgorde · startStep 1 of 2
  // wizard: de stappenbalk van de toevoeg-flow staat erboven (de kop toont de twee stappen dan niet) · tutorial: knop tonen
  function open({zoneName='',lines=[],order=null,rgbw=false,wizard=false,startStep=1,tutorial=true}={}){
    if(dialog)throw Error('LEDLINES_ORDER_STEP_ALREADY_OPEN');
    const clean=lines.filter(L=>L&&typeof L.id==='string'&&L.id).map(L=>({id:L.id,name:String(L.name||''),hex:L.hex,flip:L.flip===true}));
    // één SPI-ledline (15 nov): geen volgorde, alleen de looprichting; zo valt de app nooit terug op het oude scherm
    const single=clean.length===1&&rgbw!==true;
    if(clean.length<2&&!single)throw Error('LEDLINES_ORDER_STEP_NEEDS_TWO');
    const ids=clean.map(L=>L.id),start=Array.isArray(order)&&order.length===ids.length&&order.every(id=>ids.includes(id))&&new Set(order).size===ids.length?order.slice():ids;
    lang=Math.max(0,LANGS.indexOf(String(document.documentElement.lang||'nl').toLowerCase().split('-')[0]));
    S={lines:clean,order:start,flip:new Set(clean.filter(L=>L.flip&&!rgbw).map(L=>L.id)),step:1,rgbw:rgbw===true,wizard:wizard===true,zoneName:String(zoneName||''),
      initial:JSON.stringify([start,clean.filter(L=>L.flip&&!rgbw).map(L=>L.id).sort()])};
    busy=false;drag=null;press=null;suppressClick=false;
    dialog=document.createElement('dialog');dialog.className='kt-dialog';dialog.setAttribute('aria-labelledby','kt-step-title');
    dialog.innerHTML=`<div class="kt-app" data-step="1"${S.rgbw?' data-rgbw':''}${single?' data-single':''}><div class="kt-main"><div class="kt-head">`+
      `<button type="button" class="kt-x" data-action="close" aria-label="${esc(t('close'))}">×</button><div data-sp-head></div>`+
      `<small class="ls-eyebrow" data-zone-label>${esc(t(S.rgbw?'zoneRgbw':single?'zoneOne':'zone',{zone:S.zoneName,n:clean.length}))}</small><h2 class="ls-title" id="kt-step-title" data-title></h2><p class="ls-say" data-sentence></p>`+
      `<button type="button" class="ls-tut kt-tut" data-action="intro"${typeof onTutorial==='function'&&tutorial!==false?'':' hidden'}><i aria-hidden="true">${ICON_PLAY}</i><span>${esc(t('tutorial'))}</span></button></div>`+
      `<div class="kt-overview" data-overview><small class="kt-ov-label" data-ov-label></small><div class="kt-ov-bars" aria-hidden="true"></div></div>`+
      `<ol class="kt-list" data-list aria-label="${esc(t('list'))}"></ol></div>`+
      `<footer class="kt-footer"><button type="button" class="kt-done kt-next" data-action="next" data-only="1"><span>${esc(t('next'))}</span>${ICON_NEXT}</button>`+
      `<button type="button" class="kt-back" data-action="back" data-only="2">${ICON_BACK}<span>${esc(t('back'))}</span></button>`+
      `<button type="button" class="kt-test" data-action="test" data-only="2" aria-label="${esc(t('testAria'))}">${ICON_TEST}<span>${esc(t('test'))}</span></button>`+
      `<button type="button" class="kt-done" data-action="done" data-only="2">${ICON_CHECK}<span>${esc(t('done'))}</span></button></footer>`+
      `<div class="kt-toast" data-toast hidden role="status" aria-live="polite"></div></div>`;
    document.body.append(dialog);place();
    try{dialog.showModal();}catch(error){dialog.remove();dialog=null;S=null;throw error;}
    bind();const resize=()=>place();window.addEventListener('resize',resize);unbind.push(()=>window.removeEventListener('resize',resize));
    renderList();setStep((startStep===2||single)&&!S.rgbw?2:1,{silent:true});light();
    $('[data-title]').setAttribute('tabindex','-1');$('[data-title]').focus({preventScroll:true});
    return snapshot();
  }
  function close(reason='close'){
    if(!dialog)return;
    const state=S,result=snapshot(),changed=JSON.stringify([result.order,result.flips.slice().sort()])!==state.initial;
    stopTest();clearTimeout(identifyTimer);clearTimeout(toastTimer);clearTimeout(finalTimer);if(drag){cancelAnimationFrame(drag.raf);drag=null;}
    if(press){clearTimeout(press.timer);press=null;}document.documentElement.classList.remove('kt-dragging');
    unbind.forEach(fn=>{try{fn();}catch(_){}});unbind=[];
    const node=dialog;dialog=null;S=null;busy=false;try{node.close();}catch(_){}node.remove();
    safe(onClose,{reason,...result,changed});
  }
  return Object.freeze({open,close,isOpen:()=>!!dialog,state:()=>S?snapshot():null});
}
window.LightningLedlinesOrderStep=Object.freeze({create,palette,stepName});
})();
