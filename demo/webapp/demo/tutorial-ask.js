/* Aluvision: "Wil je een tutorial bekijken?" (C227; tester-ronde 12 nov, opmerking 9).
 * de eigenaar: "ook altijd vragen wil je een tutorial bekijken ja of nee (als de klant 1 receiver heeft toegevoegd van spi en
 * of rgbw krijgt hij die melding niet meer en moet er gewoon altijd ergens een knopje staan bekijk tutorial".
 * Een tutorial start dus nooit vanzelf. De eerste keer vraagt de app het, één keer per tutorial; daarna is er alleen
 * de vaste knop "Bekijk tutorial". Dit bestand toont de vraag en onthoudt "al gevraagd" (localStorage). Het stuurt
 * niets naar een receiver.
 */
(function(){
'use strict';
const KEY='aluvision.tutorialAsk.';
const WORDS={nl:['Wil je een tutorial bekijken?','Ja','Nee'],en:['Would you like to watch a tutorial?','Yes','No'],
  fr:['Voulez-vous regarder un tutoriel ?','Oui','Non'],de:['Möchtest du ein Tutorial ansehen?','Ja','Nein']};
// De openbare webdemo (/demo/, web-demo-service.js) deelt haar oorsprong met andere pagina's en bewaart niets: daar alleen in het
// geheugen, zoals de rest van de demo (herladen = opnieuw vragen).
const demo=new Map(),inDemo=()=>window.LightningWebDemo?.available===true;
const asked=id=>{if(inDemo())return demo.get(KEY+id)==='1';try{return localStorage.getItem(KEY+id)==='1';}catch(_){return false;}};
const remember=id=>{if(inDemo()){demo.set(KEY+id,'1');return;}try{localStorage.setItem(KEY+id,'1');}catch(_){}};
let open=null;
// Vraagt het één keer voor deze tutorial (id). Geeft false als de vraag al gesteld is of er al een vraag open staat.
// Ja → onYes(), Nee of wegtikken → onNo(). In beide gevallen wordt het daarna niet meer gevraagd.
function ask(id,{onYes,onNo}={}){
  if(open||asked(id))return false;
  const [title,yes,no]=WORDS[document.documentElement.lang]||WORDS.nl;
  const dialog=document.createElement('dialog');dialog.className='tutorial-ask';dialog.setAttribute('aria-labelledby','tutorial-ask-title');dialog.dataset.tutorialAsk=id;
  dialog.innerHTML=`<i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.500-6.5z"/></svg></i><h2 id="tutorial-ask-title">${title}</h2>`+
    `<div><button type="button" class="button secondary" data-ask="no">${no}</button><button type="button" class="button" data-ask="yes">${yes}</button></div>`;
  const done=answer=>{if(open!==dialog)return;open=null;remember(id);try{dialog.close();}catch(_){}dialog.remove();(answer==='yes'?onYes:onNo)?.();};
  dialog.addEventListener('click',event=>{const button=event.target.closest('[data-ask]');if(button)done(button.dataset.ask);});
  dialog.addEventListener('cancel',event=>{event.preventDefault();done('no');});
  document.body.append(dialog);open=dialog;
  try{dialog.showModal();}catch(_){dialog.setAttribute('open','');}
  dialog.querySelector('[data-ask="yes"]').focus({preventScroll:true});
  return true;
}
// De pagina eronder gaat weg (de klant verlaat de setup): de vraag gaat mee weg en komt een volgende keer terug.
function close(){if(!open)return;const dialog=open;open=null;try{dialog.close();}catch(_){}dialog.remove();}
window.LightningTutorialAsk=Object.freeze({ask,asked,remember,close});
})();
