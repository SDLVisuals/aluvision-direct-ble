/* Aluvision: Instellingen › Verbinding: Bluetooth / Wifi (tester; onderdeel "connection-choice", 13 nov 2026).
 * de eigenaar: "focus vooral op bluetooth, laat de wifi er ook nog inzitten, gewoon een switch: bluetooth of wifi".
 * Ontwerp: docs/mesh-netwerk-ontwerp.md ("Bluetooth of wifi: één schakelaar in de app"); berichtvorm: docs/bluetooth-berichtvorm.md.
 *  - Twee knoppen zoals Taal en Thema: Bluetooth of Wifi. Geen uitleg: het icoon zegt het.
 *  - In de app: de keuze staat in de app zelf (diensten connectionChoice / setConnectionChoice). Bluetooth: de app verbindt met
 *    de dichtste receiver van de eigen stand; wifi: zoals altijd. Standaard wifi tot de receivers bluetooth aan hebben.
 *  - In de tester (demo): de keuze blijft alleen in deze browser.
 * Nooit een foutmelding: lukt bewaren niet, dan springt de knop gewoon terug.
 *   const cc=LightningConnectionChoice.create({services:()=>runtime?.services,t});
 *   cc.cardHtml() → de kaart voor Instellingen (luistert zelf naar tikken) */
(function(root){
  'use strict';
  const CHOICES=['bluetooth','wifi'];
  const KEY='aluvision.connectionChoice.demo';
  const P=d=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const IC={
    bluetooth:P('<path d="m7 7 10 10-5 4.5V2.5L17 7 7 17"/>'),
    wifi:P('<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0M12 20h.01"/>'),
    range:P('<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>'),
    chev:P('<path d="m9 6 6 6-6 6"/>'),
    link:P('<path d="M9.5 14.5 14.5 9.5"/><path d="M11 6.5 12.6 5a4.2 4.2 0 0 1 6 6l-1.6 1.5M13 17.5 11.4 19a4.2 4.2 0 0 1-6-6L7 11.5"/>')};
  const LABEL={bluetooth:'Bluetooth',wifi:'Wifi'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // 15 nov (de eigenaar: "Ja, alles native"; docs/instellingen-nieuw.md): de keuze gaat nu ook echt naar de stand (dienst mainLink,
  // STAND_CONNECTION op de hoofdreceiver), en er is een kaart Kanaal (STAND_CHANNEL): Automatisch (aanbevolen) of zelf kiezen.
  // Een kanaalwissel: "Even geduld", de telefoon verbindt vanzelf opnieuw; daarna lezen we de stand tot STATE=IDLE.
  const CHANNELS_MAIN=[1,6,11],ALL=Array.from({length:13},(_,i)=>i+1);
  function create({services,t=text=>text,standId=()=>null}={}){
    const link=()=>{const s=services?.();return typeof s?.mainLink==='function'&&standId()?s:null;};
    let channel={mode:null,now:0,target:0,state:'IDLE',more:false,wait:false};
    const say=()=>{const box=root.document.querySelector('[data-channel-card]');if(box)box.outerHTML=channelHtml();};
    async function loadLink(){
      const s=link();if(!s)return;
      try{const c=await s.mainLink({standId:standId(),kind:'connection',op:'STATUS'});if(c?.status==='ok'&&['WIFI','BLUETOOTH'].includes(c.mode)){choice=c.mode==='BLUETOOTH'?'bluetooth':'wifi';paint();}}catch(_){}
      try{const k=await s.mainLink({standId:standId(),kind:'channel',op:'STATUS'});if(k?.status==='ok'){channel={...channel,mode:k.mode==='FIXED'?'FIXED':'AUTO',now:Number(k.channel)||0,target:Number(k.target)||0,state:k.state||'IDLE'};say();}}catch(_){}
    }
    async function waitChannel(){
      channel.wait=true;say();
      for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,i<2?4000:2000));
        try{const k=await link()?.mainLink({standId:standId(),kind:'channel',op:'STATUS'});if(k?.status==='ok'){channel.now=Number(k.channel)||channel.now;channel.state=k.state||'IDLE';if(channel.state==='IDLE')break;}}catch(_){/* de telefoon verbindt nog opnieuw */}}
      channel.wait=false;say();
    }
    async function chooseChannel(mode,ch){
      const s=link();if(!s||channel.wait)return;
      const before={...channel};channel.mode=mode;if(mode==='FIXED')channel.target=ch;say();
      try{const k=await s.mainLink(mode==='AUTO'?{standId:standId(),kind:'channel',op:'SET',mode:'AUTO'}:{standId:standId(),kind:'channel',op:'SET',mode:'FIXED',channel:ch});
        if(k?.status!=='ok')throw Error('CHANNEL');channel.now=Number(k.channel)||channel.now;channel.target=Number(k.target)||0;
        if(mode==='FIXED'&&ch!==channel.now||k.state==='MOVING')await waitChannel();else say();}
      catch(_){channel=before;say();}
    }
    function channelHtml(){
      if(!link())return '';
      const auto=channel.mode!=='FIXED',pick=channel.target||channel.now,list=channel.more?ALL:CHANNELS_MAIN;
      return `<section class="card settings-channel" data-channel-card><h2 class="settings-appearance-heading">${IC.wifi}<span>${esc(t('Kanaal'))}</span></h2>`+
        `<div class="preference-grid channel-mode-grid" role="group"><button type="button" data-channel-mode="AUTO" aria-pressed="${auto}"><b>${esc(t('Automatisch'))}</b><small>${esc(t('Aanbevolen'))}</small></button>`+
        `<button type="button" data-channel-mode="FIXED" aria-pressed="${!auto}"><b>${esc(t('Zelf kiezen'))}</b><small>${esc(t('Op vraag van de beurs'))}</small></button></div>`+
        (auto?'':`<div class="channel-grid">${list.map(c=>`<button type="button" data-channel="${c}" aria-pressed="${c===pick}">${c}</button>`).join('')}${channel.more?'':`<button type="button" data-channel-more>${esc(t('Meer'))}</button>`}</div>`)+
        `<p class="channel-now" role="status">${channel.wait?esc(t('Even geduld, je stand wisselt van kanaal…')):channel.now?esc(t('Nu kanaal {n}',{n:channel.now})):''}</p></section>`;
    }
    // Bereik (zendvermogen, C261 STAND_POWER): het scherm staat in Flutter (docs/instellingen-nieuw.md); hier alleen de ingang.
    const flutter=()=>root.__lightningFlutterHost===true&&!!root.webkit?.messageHandlers?.lightningHost||typeof root.AluvisionFlutterHost?.postMessage==='function';
    function rangeHtml(){
      if(!link()||!flutter())return '';
      return `<section class="card settings-range" data-range-card><button type="button" class="settings-range-open" data-range-open><span class="settings-range-ic">${IC.range}</span><b>${esc(t('Bereik'))}</b>${IC.chev}</button></section>`;
    }
    function openRange(){
      const m={open:'flutter',screen:'bereik'};
      try{if(root.webkit?.messageHandlers?.lightningHost)root.webkit.messageHandlers.lightningHost.postMessage(m);else root.AluvisionFlutterHost.postMessage(JSON.stringify(m));}catch(_){}
    }
    root.document.addEventListener('click',event=>{const tg=event.target;if(!(tg instanceof Element))return;
      if(tg.closest('[data-range-open]')){openRange();return;}
      const m=tg.closest('[data-channel-mode]');if(m){const mode=m.dataset.channelMode;if(mode==='AUTO')void chooseChannel('AUTO');else{channel.mode='FIXED';say();}return;}
      const c=tg.closest('[data-channel]');if(c){void chooseChannel('FIXED',Number(c.dataset.channel));return;}
      if(tg.closest('[data-channel-more]')){channel.more=true;say();}});
    const native=()=>{const s=services?.();return typeof s?.connectionChoice==='function'&&typeof s?.setConnectionChoice==='function'?s:null;};
    const readDemo=()=>{try{const v=root.localStorage.getItem(KEY);return CHOICES.includes(v)?v:'wifi';}catch(_){return 'wifi';}};
    let choice=native()?'wifi':readDemo(),loaded=false,busy=false;
    function paint(){
      for(const button of root.document.querySelectorAll('[data-connection-choice]'))button.setAttribute('aria-pressed',String(button.dataset.connectionChoice===choice));
    }
    async function load(){
      const s=native();if(!s||loaded)return;
      try{const result=await s.connectionChoice();if(CHOICES.includes(result?.choice)){choice=result.choice;loaded=true;paint();}}catch(_){/* blijft wifi tonen */}
    }
    async function choose(next){
      if(!CHOICES.includes(next)||next===choice||busy)return;
      const previous=choice;choice=next;paint();busy=true;
      try{
        const s=native();
        // eerst de stand zelf (hoofdreceiver), dan deze telefoon; zo bereikt het antwoord de telefoon nog via de oude weg
        const l=link();if(l){const r=await l.mainLink({standId:standId(),kind:'connection',op:'SET',mode:next==='bluetooth'?'BLUETOOTH':'WIFI'});if(r?.status!=='ok')throw Error('STAND_CONNECTION');}
        if(s){const result=await s.setConnectionChoice({choice:next});if(result?.choice!==next)throw Error('CONNECTION_CHOICE_UNCONFIRMED');}
        else{try{root.localStorage.setItem(KEY,next);}catch(_){}}
      }catch(_){choice=previous;paint();}
      finally{busy=false;}
    }
    root.document.addEventListener('click',event=>{
      const button=event.target?.closest?.('[data-connection-choice]');
      if(button)void choose(button.dataset.connectionChoice);
    });
    function cardHtml(){
      queueMicrotask(load);queueMicrotask(loadLink);
      const buttons=CHOICES.map(id=>`<button type="button" class="connection-choice-button" data-connection-choice="${id}" aria-pressed="${choice===id}">${IC[id]}<span>${esc(t(LABEL[id]))}</span></button>`).join('');
      return `<section class="card settings-connection" data-connection-choice-card aria-labelledby="connection-choice-title"><h2 id="connection-choice-title" class="settings-appearance-heading">${IC.link}<span>${esc(t('Verbinding'))}</span></h2><div class="preference-grid connection-choice-grid" role="group" aria-labelledby="connection-choice-title">${buttons}</div></section>`;
    }
    return Object.freeze({cardHtml,channelHtml,rangeHtml,current:()=>choice});
  }
  root.LightningConnectionChoice=Object.freeze({create,choices:CHOICES});
}(window));
