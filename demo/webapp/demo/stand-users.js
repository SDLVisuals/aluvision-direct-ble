/* Aluvision: Delen en gebruikers, een menu in Instellingen (alleen in de tester; onderdeel "stand-users").
 * de eigenaar, 13 nov 2026: "maak het een mooi menu binnen settings". Afspraak: docs/overzicht-en-stappenplan.md, stap 6.1
 * (goedgekeurd 13 nov avond) en 6.6; prototypes/delen-en-gebruikers/VOORSTEL.md.
 *  - Twee soorten mensen: de hoofdgebruiker (mag alles) en een gebruiker die hij per persoon samenstelt met vakjes.
 *    Achteraf aanpassen kan in de lijst, zonder opnieuw te delen.
 *  - Altijd: licht aan/uit, helderheid, kleur, animatie, scène kiezen. Nooit als vakje (alleen de hoofdgebruiker):
 *    receivers verwijderen/ontkoppelen/wissen, standwifi (PIN), software-updates, gebruikers beheren.
 *  - Twee snelle keuzes: Gast (licht + scènes opslaan) en Opbouwer (alle vakjes).
 *  - Delen = een bestandje ("Demo 3.aluvision") via AirDrop, WhatsApp of mail.
 * Dit scherm werkt met demodata in deze browser: geen sleutel, geen bestand, geen netwerk, geen receiver. De
 * hoofdreceiver gaat later zelf controleren wat iemand mag (stap 6.3, mesh-sessie); de namen van de vakjes (id) zijn
 * met de mesh-sessie afgesproken.
 *   const su=LightningStandUsers.create({standName:()=>'Demo 3',toast:text=>…});
 *   su.cardHtml()  → de kaart voor Instellingen;  su.open() → de pagina */
(function(root){
  'use strict';
  // ---------- de vakjes (id = de naam die de hoofdreceiver ook gebruikt) ----------
  const VAKJES=Object.freeze([
    {id:'scenes-save',name:'Scènes en presets opslaan',icon:'star'},
    {id:'scenes-delete',name:'Scènes en presets wissen',icon:'trash'},
    {id:'zones-edit',name:'Zones maken en wijzigen',sub:'Ook looprichting, pixels en kanten',icon:'zones'},
    {id:'receivers-add',name:'Receivers toevoegen en verplaatsen',sub:'Met de QR-code op de receiver',icon:'receiver'},
    {id:'stand-share',name:'De stand delen',sub:'Met dezelfde of minder vakjes',icon:'share'}]);
  const ALL=VAKJES.map(v=>v.id);
  const PRESETS=Object.freeze({gast:['scenes-save'],opbouwer:ALL});
  const ROLES=[['gast','Gast','Licht en scènes opslaan','person'],['opbouwer','Opbouwer','Alles behalve verwijderen','tools'],['eigen','Zelf kiezen','Jij kiest de vakjes','sliders']];
  const ALWAYS=[['power','Aan en uit'],['sun','Helderheid'],['drop','Kleur'],['wave','Animatie'],['scene','Scène']];
  // ---------- icoontjes (lijntekeningen zoals de icoontjes van de app) ----------
  const P=d=>`<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const IC={
    back:P('<path d="M19 12H5M11 6l-6 6 6 6"/>'),chev:P('<path d="m9.5 6 6 6-6 6"/>'),
    people:P('<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.6"/><path d="M15.5 14.6a4.6 4.6 0 0 1 5.5 4.9"/>'),
    share:P('<circle cx="18" cy="5.5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="18.5" r="2.6"/><path d="m8.4 10.7 7.2-4m-7.2 6.6 7.2 4"/>'),
    star:P('<path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z"/>'),
    trash:P('<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l1 12.5h9l1-12.5M10.3 10.5v6M13.7 10.5v6"/>'),
    zones:P('<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>'),
    receiver:P('<rect x="3" y="7.5" width="18" height="9" rx="2.2"/><path d="M7 12h.01M10.5 12h4"/><path d="M12 3.5v4M12 16.5v4"/>'),
    power:P('<path d="M12 3.5v8"/><path d="M7.2 6.6a7.5 7.5 0 1 0 9.6 0"/>'),
    sun:P('<circle cx="12" cy="12" r="3.6"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7"/>'),
    drop:P('<path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z"/>'),
    wave:P('<path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10.5v3M21 12h0"/>'),
    scene:P('<path d="M6.5 3.5h11v17l-5.5-3.8-5.5 3.8Z"/>'),
    crown:P('<path d="m3.5 8 4.2 3.6L12 5l4.3 6.6L20.5 8l-1.8 10H5.3Z"/>'),
    person:P('<circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>'),
    tools:P('<path d="M14.6 6.2a4 4 0 0 0 5.2 5.2l-8.6 8.6a2.1 2.1 0 0 1-3-3Z"/><path d="m4 4 4.5 4.5M3.5 7.5l4-4"/>'),
    sliders:P('<path d="M5 6h9M18 6h1M5 12h3M12 12h7M5 18h11M20 18h-1"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
    file:P('<path d="M7 3.5h7l4.5 4.5v12.5H7Z"/><path d="M13.5 3.5V8.5h5"/>'),
    lock:P('<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
    airdrop:P('<path d="M7.8 16.2a6 6 0 1 1 8.4 0"/><path d="M4.9 19a10 10 0 1 1 14.2 0"/><path d="M12 13.5 8.6 20.5h6.8Z"/>'),
    chat:P('<path d="M4.5 19.5 6 15.6A8 8 0 1 1 9 18.6Z"/><path d="M9.3 9.3c.4 2.4 2.2 4.5 4.9 5.4"/>'),
    mail:P('<rect x="3" y="5.5" width="18" height="13" rx="2.2"/><path d="m3.5 7 8.5 6.2L20.5 7"/>'),
    more:P('<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>'),
    check:P('<path d="m5.5 12.5 4.2 4.2 8.8-8.9"/>')};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const reduce=()=>root.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  const iconOf=id=>IC[VAKJES.find(v=>v.id===id)?.icon]||'';
  // ---------- demodata: de gebruikers van deze stand, alleen in deze browser ----------
  const KEY='aluvision.standUsers.demo.v2';
  const START={seq:3,users:[{id:'u1',name:'Collega',vakjes:[...ALL]},{id:'u2',name:'Tablet balie',vakjes:['scenes-save']}]};
  // de voorbeeldgebruikers alleen in de tester; op een toestel begin je met alleen jezelf (de eigenaar 14 nov: aan op toestellen)
  const tester=()=>root.LightningTesterPreview?.active?.()===true;
  function load(){try{const v=JSON.parse(root.localStorage.getItem(KEY));if(v&&Array.isArray(v.users))return v;}catch(_){}return tester()?JSON.parse(JSON.stringify(START)):{seq:1,users:[]};}
  let S=null;   // pas laden in create(): de demo-dienst (wie in de tester zit) laadt na dit bestand
  const save=()=>{try{root.localStorage.setItem(KEY,JSON.stringify(S));}catch(_){}};
  const clean=list=>ALL.filter(id=>list.includes(id));
  const roleOf=list=>{const v=clean(list).join();return v===PRESETS.gast.join()?'gast':v===ALL.join()?'opbouwer':'eigen';};
  const roleName=list=>({gast:'Gast',opbouwer:'Opbouwer',eigen:'Eigen keuze'})[roleOf(list)];

  function create({standName=()=>'',toast=()=>{}}={}){
    if(!S)S=load();
    const stack=[];
    const say=text=>{try{toast(text);}catch(_){}};
    // ---------- een pagina over het hele scherm (onder het logo), met een terugpijl ----------
    function page(title,under,body,cls=''){
      const el=document.createElement('dialog');el.className='su-page '+cls;
      el.innerHTML=`<div class="su-panel"><header class="su-top"><button type="button" class="su-back" data-su-close aria-label="Terug" title="Terug">${IC.back}</button>`+
        `<div><h2>${esc(title)}</h2><small class="su-under">${esc(under)}</small></div></header><div class="su-body">${body}</div></div>`;
      document.body.append(el);try{el.showModal();}catch(_){el.setAttribute('open','');}
      stack.push(el);requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('is-in')));
      el.addEventListener('cancel',e=>{e.preventDefault();if(stack[stack.length-1]===el)closeTop();});
      el.addEventListener('click',e=>{if(e.target.closest('[data-su-close]')&&stack[stack.length-1]===el)closeTop();});
      return el;}
    function closeTop(){const el=stack.pop();if(!el)return;el.classList.remove('is-in');el.classList.add('is-out');
      const done=()=>{try{el.close();}catch(_){}el.remove();};if(reduce())done();else setTimeout(done,230);}
    // ---------- de onderdelen ----------
    const initial=u=>esc((u.name||'?').trim().charAt(0).toUpperCase());
    const avatar=(u,big=false)=>`<span class="su-av${big?' is-big':''}" data-role="${roleOf(u.vakjes)}" aria-hidden="true">${initial(u)}</span>`;
    const pill=list=>`<span class="su-pill" data-role="${roleOf(list)}">${roleName(list)}</span>`;
    // hoeveel van de vijf vakjes: vijf streepjes, de aangevinkte in de kleur van de rol
    const meter=list=>`<span class="su-meter" data-role="${roleOf(list)}" role="img" aria-label="${clean(list).length} van ${ALL.length} vakjes">${ALL.map(id=>`<i${list.includes(id)?' class="on"':''}></i>`).join('')}</span>`;
    const mini=list=>`<span class="su-mini" aria-hidden="true">${clean(list).map(iconOf).join('')}</span>`;
    const always=()=>`<div class="su-always"><b>Altijd</b><span>${ALWAYS.map(([k,t])=>`<i title="${t}">${IC[k]}<em>${t}</em></i>`).join('')}</span></div>`;
    const roleCards=cur=>`<div class="su-roles" role="radiogroup" aria-label="Wat mag deze persoon?">${ROLES.map(([k,t,s,ic])=>
      `<button type="button" role="radio" class="su-role" data-su-role="${k}" aria-checked="${cur===k}"><span class="su-role-ic">${IC[ic]}</span><b>${t}</b><small>${s}</small></button>`).join('')}</div>`;
    const switches=list=>`<div class="su-vakjes">${VAKJES.map(v=>{const on=list.includes(v.id);
      return `<div class="su-vak"><span class="su-vak-ic">${IC[v.icon]}</span><span class="su-vak-t"><b>${v.name}</b>${v.sub?`<small>${v.sub}</small>`:''}</span>`+
        `<button type="button" class="switch" role="switch" data-su-vak="${v.id}" aria-checked="${on}" aria-label="${v.name}"><span>${on?'Aan':'Uit'}</span><i aria-hidden="true"></i></button></div>`;}).join('')}</div>`;
    // de vakjes en de snelle keuzes houden elkaar bij (zonder alles opnieuw te tekenen)
    function bindChoice(el,list,onChange){
      const sync=()=>{const r=roleOf(list);el.querySelectorAll('[data-su-role]').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.suRole===r||(r==='eigen'&&b.dataset.suRole==='eigen'))));
        el.querySelectorAll('[data-su-vak]').forEach(b=>{const on=list.includes(b.dataset.suVak);b.setAttribute('aria-checked',String(on));b.querySelector('span').textContent=on?'Aan':'Uit';});onChange?.(list);};
      el.addEventListener('click',e=>{
        const r=e.target.closest('[data-su-role]');
        if(r){if(r.dataset.suRole!=='eigen'){list.splice(0,list.length,...PRESETS[r.dataset.suRole]);sync();}
          else{el.querySelectorAll('[data-su-role]').forEach(b=>b.setAttribute('aria-checked',String(b===r)));el.querySelector('.su-vakjes')?.scrollIntoView({block:'nearest',behavior:reduce()?'auto':'smooth'});}return;}
        const v=e.target.closest('[data-su-vak]');
        if(v){const id=v.dataset.suVak,i=list.indexOf(id);if(i<0)list.push(id);else list.splice(i,1);const keep=clean(list);list.splice(0,list.length,...keep);sync();}});
      return sync;}
    // ---------- de pagina Delen en gebruikers ----------
    let mainEl=null;
    // bovenaan: je stand in het midden, jij en de anderen eromheen (een tik op een rondje opent die persoon), en de knop
    // Stand delen in dezelfde kaart
    function hero(){const others=S.users.slice(0,5),more=S.users.length-others.length;
      const spots=others.map((u,i)=>{const a=(i+.5)/Math.max(1,others.length)*Math.PI*.9+Math.PI*.05;   // een boog aan de rechterkant
        return `<button type="button" class="su-orb" data-su-user="${esc(u.id)}" data-role="${roleOf(u.vakjes)}" style="--x:${(50+34*Math.sin(a)).toFixed(1)}%;--y:${(50-38*Math.cos(a)).toFixed(1)}%" aria-label="${esc(u.name)}">${initial(u)}</button>`;}).join('');
      return `<section class="su-hero"><div class="su-orbit" aria-hidden="false"><svg class="su-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${others.map((u,i)=>{const a=(i+.5)/Math.max(1,others.length)*Math.PI*.9+Math.PI*.05;
          return `<line x1="50" y1="50" x2="${(50+34*Math.sin(a)).toFixed(1)}" y2="${(50-38*Math.cos(a)).toFixed(1)}" style="--d:${i*.35}s"/>`;}).join('')}<line class="me" x1="50" y1="50" x2="16" y2="50"/></svg>`+
        `<span class="su-orb is-me" style="--x:16%;--y:50%" title="Jij">${IC.crown}</span><span class="su-stand"><span class="su-stand-ic">${IC.zones}</span><b>${esc(standName()||'Je stand')}</b></span>${spots}`+
        (more>0?`<span class="su-more">+${more}</span>`:'')+`</div>`+
        `<button type="button" class="su-primary su-share-big" data-su="share">${IC.share}<b>Stand delen</b></button></section>`;}
    function mainBody(fresh=''){
      return hero()+`<h3 class="su-h">Wie heeft toegang <span class="su-count">${S.users.length+1}</span></h3><div class="su-users">`+
        `<div class="su-user is-main"><span class="su-av is-main" aria-hidden="true">${IC.crown}</span><span class="su-user-t"><b>Jij</b><small>Deze telefoon</small></span><span class="su-pill is-main">Hoofdgebruiker</span></div>`+
        S.users.map(u=>`<button type="button" class="su-user${u.id===fresh?' is-new':''}" data-su-user="${esc(u.id)}">${avatar(u)}<span class="su-user-t"><b>${esc(u.name)}</b>${meter(u.vakjes)}</span>${pill(u.vakjes)}${IC.chev}</button>`).join('')+
        `</div>`+(S.users.length?'':`<p class="su-empty">${IC.people}<span>Nog met niemand gedeeld.</span></p>`)+
        `<p class="su-note">${IC.lock}<span>Alleen jij kan gebruikers aanpassen of hun toegang intrekken.</span></p>`+
        `<button type="button" class="ls-tut su-tut" data-su="tutorial"><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg></i><span>Bekijk tutorial</span></button>`;}
    function open(){
      mainEl=page('Delen en gebruikers',standName(),mainBody(),'su-main');
      // een tutorial start nooit vanzelf: de eerste keer vraagt de app het (tutorial-ask.js), daarna is er de knop
      setTimeout(()=>{if(mainEl?.isConnected)root.LightningTutorialAsk?.ask('stand-users',{onYes:openTutorial});},700);
      mainEl.addEventListener('click',e=>{
        if(e.target.closest('[data-su="tutorial"]')){openTutorial();return;}
        if(e.target.closest('[data-su="share"]')){openShare();return;}
        const u=e.target.closest('[data-su-user]');if(u)openUser(u.dataset.suUser);});}
    const refreshMain=fresh=>{const b=mainEl?.isConnected&&mainEl.querySelector('.su-body');if(b)b.innerHTML=mainBody(fresh);syncCards();};
    // ---------- Stand delen in drie korte stappen ----------
    // 1. Voor wie en wat mag die persoon: een bewegend beeld (je stand gaat van jouw telefoon naar de zijne), een naam
    //    (of een snelle keuze), en drie grote kaarten met icoontjes van wat die rol mag; de vakjes pas bij Zelf kiezen.
    // 2. Delen via: het bestandje groot in beeld en AirDrop / WhatsApp / Mail / Meer.
    // 3. Gedeeld: een vinkje; de persoon staat in de lijst.
    const NAMES=['Collega','Tablet','Klant'];   // snelle namen; geen persoonsnamen
    const shareAnim=()=>`<div class="su-anim" aria-hidden="true"><span class="su-ph su-ph-a"><i></i><i></i><i></i></span><span class="su-fly">${IC.file}</span><span class="su-ph su-ph-b"><i></i><i></i><i></i></span></div>`;
    const bigRoles=(cur)=>`<div class="su-bigroles" role="radiogroup" aria-label="Wat mag die persoon?">${ROLES.map(([k,t,,ic])=>{
      const may=k==='eigen'?`<span class="su-may is-own">${IC.sliders}<em>Jij kiest</em></span>`:`<span class="su-may">${PRESETS[k].map(iconOf).join('')}</span>`;
      return `<button type="button" role="radio" class="su-bigrole" data-su-role="${k}" aria-checked="${cur===k}"><span class="su-role-ic">${IC[ic]}</span><b>${t}</b>${may}</button>`;}).join('')}</div>`;
    const mayList=list=>`<ul class="su-maylist">${VAKJES.filter(v=>list.includes(v.id)).map(v=>`<li>${IC[v.icon]}<span>${v.name}</span></li>`).join('')}</ul>`;
    function openShare(){
      const list=[...PRESETS.gast];let name='',step=1;
      const el=page('Stand delen',standName(),'','su-sharepage');
      const body=el.querySelector('.su-body'),under=el.querySelector('.su-under');
      const who=()=>name||'die persoon';
      function stepOne(){step=1;under.textContent=standName();
        body.innerHTML=shareAnim()+
          `<label class="su-field"><span>Voor wie?</span><input type="text" maxlength="40" autocomplete="off" autocapitalize="words" enterkeyhint="done" placeholder="Naam" value="${esc(name)}" data-su-name></label>`+
          `<div class="su-chips" role="group" aria-label="Snel kiezen">${NAMES.map(n=>`<button type="button" class="su-chip" data-su-quick="${n}" aria-pressed="${name===n}">${n}</button>`).join('')}</div>`+
          `<h3 class="su-h" data-su-whohead>Wat mag ${esc(who())}?</h3>${bigRoles(roleOf(list))}`+
          `<div class="su-own"${roleOf(list)==='eigen'||el.dataset.suOwn?'':' hidden'}>${switches(list)}</div>`+
          `<div class="su-mayshow"${roleOf(list)==='eigen'||el.dataset.suOwn?' hidden':''}>${mayList(list)}</div>${always()}`+
          `<button type="button" class="su-primary" data-su="next"><span>Verder</span>${IC.chev}</button>`;
        sync();}
      // één keer gebonden (stap 1 kan opnieuw getekend worden na Terug)
      const sync=bindChoice(body,list,()=>{const own=roleOf(list)==='eigen'||!!el.dataset.suOwn,o=body.querySelector('.su-own'),m=body.querySelector('.su-mayshow');
        if(o)o.hidden=!own;if(m){m.hidden=own;m.innerHTML=mayList(list);}});
      function stepTwo(){step=2;const file=`${standName()||'Stand'}.aluvision`;under.textContent=`Voor ${name||'iemand'}`;
        body.innerHTML=`<div class="su-file is-big"><span class="su-file-ic">${IC.file}</span><b>${esc(file)}</b><small>${esc(name||'Nieuwe gebruiker')} · ${roleName(list)}</small>${mini(list)}</div>`+
          `<h3 class="su-h">Delen via</h3><div class="su-targets">${[['airdrop','AirDrop'],['chat','WhatsApp'],['mail','Mail'],['more','Meer']].map(([k,t])=>
            `<button type="button" class="su-target" data-su-send="${t}"><span>${IC[k]}</span><b>${t}</b></button>`).join('')}</div>`+
          `<p class="su-note">${IC.lock}<span>Het bestandje is een sleutel tot je stand: deel het alleen met wie je vertrouwt.</span></p>`+
          `<button type="button" class="su-textbtn" data-su="back1">${IC.back}<span>Terug</span></button>`;}
      function stepThree(user){step=3;under.textContent=standName();
        body.innerHTML=`<div class="su-done"><span class="su-done-ic">${IC.check}</span><b>Gedeeld met ${esc(user.name)}</b>`+
          `<small>${esc(user.name)} opent het bestandje en heeft je stand meteen in de app.</small></div>`+
          `<button type="button" class="su-primary" data-su="done"><span>Klaar</span></button>`;}
      stepOne();
      el.addEventListener('input',e=>{if(!e.target.matches('[data-su-name]'))return;name=e.target.value.replace(/[<>\u0000-\u001f\u007f]/g,'').trim();
        body.querySelectorAll('[data-su-quick]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.suQuick===name)));
        const h=body.querySelector('[data-su-whohead]');if(h)h.textContent=`Wat mag ${who()}?`;});
      el.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-su-name]')){e.preventDefault();e.target.blur();}});
      el.addEventListener('click',e=>{
        const q=e.target.closest('[data-su-quick]');
        if(q){name=q.dataset.suQuick;const i=body.querySelector('[data-su-name]');if(i)i.value=name;body.querySelectorAll('[data-su-quick]').forEach(b=>b.setAttribute('aria-pressed',String(b===q)));
          const h=body.querySelector('[data-su-whohead]');if(h)h.textContent=`Wat mag ${who()}?`;return;}
        const r=e.target.closest('[data-su-role]');if(r&&step===1){if(r.dataset.suRole==='eigen')el.dataset.suOwn='1';else delete el.dataset.suOwn;
          const own=!!el.dataset.suOwn||roleOf(list)==='eigen';body.querySelector('.su-own').hidden=!own;body.querySelector('.su-mayshow').hidden=own;}
        if(e.target.closest('[data-su="next"]')){if(!name)name=`Gebruiker ${S.seq}`;stepTwo();el.querySelector('.su-panel').scrollTop=0;return;}
        if(e.target.closest('[data-su="back1"]')){stepOne();return;}
        const send=e.target.closest('[data-su-send]');
        if(send&&step===2){const user={id:'u'+(S.seq++),name,vakjes:clean(list)};S.users.push(user);save();refreshMain(user.id);
          say(`Gedeeld met ${user.name}.`);stepThree(user);el.querySelector('.su-panel').scrollTop=0;return;}
        if(e.target.closest('[data-su="done"]'))closeTop();});}
    // ---------- één gebruiker: zijn vakjes aanpassen of zijn toegang intrekken ----------
    function openUser(id){
      const u=S.users.find(x=>x.id===id);if(!u)return;
      const el=page(u.name,standName(),
        `<div class="su-whohero">${avatar(u,true)}<b>${esc(u.name)}</b><span class="su-whometa">${pill(u.vakjes)}${meter(u.vakjes)}</span><span class="su-sync" role="status" aria-live="polite" hidden></span></div>`+
        `<h3 class="su-h">Wat mag ${esc(u.name)}?</h3>${roleCards(roleOf(u.vakjes))}${switches(u.vakjes)}${always()}`+
        `<button type="button" class="su-second" data-su="resend">${IC.file}<span>Bestandje opnieuw sturen</span></button>`+
        `<button type="button" class="su-revoke" data-su="revoke">${IC.lock}<span>Toegang intrekken</span></button>`,'su-userpage');
      // een wijziging is meteen bewaard: de kop (kleur, labeltje, balkje) en de lijst eronder volgen
      // de eigenaar 13 nov: wat de hoofdgebruiker aanpast, geldt ook meteen op de telefoon van die persoon (de hoofdreceiver stuurt
      // het door; stap 6.3/6.4, mesh-sessie). Hier toont een statusregel dat het doorgestuurd wordt (demo: na 1,2 s klaar).
      let syncT=0;const synced=()=>{const st=el.querySelector('.su-sync');if(!st)return;st.hidden=false;st.className='su-sync is-busy';st.innerHTML=`<i></i><span>Doorsturen naar ${esc(u.name)}…</span>`;
        clearTimeout(syncT);syncT=setTimeout(()=>{st.className='su-sync is-done';st.innerHTML=`${IC.check}<span>Ook aangepast op de telefoon van ${esc(u.name)}</span>`;},reduce()?0:1200);};
      bindChoice(el,u.vakjes,()=>{save();synced();const m=el.querySelector('.su-whometa');if(m)m.innerHTML=pill(u.vakjes)+meter(u.vakjes);
        el.querySelector('.su-whohero .su-av')?.setAttribute('data-role',roleOf(u.vakjes));refreshMain();});
      let armed=0;
      el.addEventListener('click',e=>{
        if(e.target.closest('[data-su="resend"]')){openResend(u);return;}
        const b=e.target.closest('[data-su="revoke"]');if(!b)return;
        if(!b.classList.contains('is-armed')){b.classList.add('is-armed');b.querySelector('span').textContent=`Tik nog eens: ${u.name} kan je stand dan niet meer bedienen`;clearTimeout(armed);
          armed=setTimeout(()=>{b.classList.remove('is-armed');b.querySelector('span').textContent='Toegang intrekken';},4000);return;}
        clearTimeout(armed);S.users=S.users.filter(x=>x.id!==u.id);save();say(`${u.name} heeft geen toegang meer.`);closeTop();refreshMain();});}
    // het bestandje opnieuw sturen (bv. als iemand het kwijt is): dezelfde vakjes, geen nieuwe gebruiker
    function openResend(u){
      const el=page('Opnieuw sturen',`Voor ${u.name}`,
        `<div class="su-file is-big"><span class="su-file-ic">${IC.file}</span><b>${esc((standName()||'Stand')+'.aluvision')}</b><small>${esc(u.name)} · ${roleName(u.vakjes)}</small>${meter(u.vakjes)}</div>`+
        `<h3 class="su-h">Delen via</h3><div class="su-targets">${[['airdrop','AirDrop'],['chat','WhatsApp'],['mail','Mail'],['more','Meer']].map(([k,t])=>
          `<button type="button" class="su-target" data-su-send="${t}"><span>${IC[k]}</span><b>${t}</b></button>`).join('')}</div>`,'su-resend');
      el.addEventListener('click',e=>{if(!e.target.closest('[data-su-send]')||el.dataset.suSent)return;el.dataset.suSent='1';say(`Opnieuw gestuurd naar ${u.name}.`);closeTop();});}
    // ---------- de tutorial: een kort verhaal met twee telefoons (jij en een collega) ----------
    // De telefoons tonen de echte onderdelen van dit scherm (zelfde klassen en opbouw), verkleind. Een vinger tikt.
    // Stappen: Stand delen · wat mag je collega · delen via WhatsApp · je collega opent het bestandje · later iets
    // aanpassen (het gaat meteen naar zijn telefoon) · toegang intrekken (hij kan niets meer). Bij "beweging beperken"
    // stap voor stap met ‹ en ›.
    const TSTEPS=[
      'Tik op Stand delen.',
      'Kies wat je collega mag: Gast, Opbouwer of zelf kiezen.',
      'Deel het bestandje, bijvoorbeeld met WhatsApp.',
      'Je collega opent het bestandje en heeft je stand meteen.',
      'Pas later aan wat hij mag. Het gaat meteen naar zijn telefoon.',
      'Toegang intrekken: hij kan je stand dan niet meer bedienen.'];
    const PLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>',PAUSE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5.5h3.2v13H7.5zM13.3 5.5h3.2v13h-3.2z"/></svg>',
      REPLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5"/></svg>';
    const PW=300,PH=610,SW=390;   // telefoon (in het beeld) en de breedte van de pagina erin
    let tut=null;
    const screenPage=(title,under,body)=>`<dialog class="su-page sut-static is-in" open><div class="su-panel"><header class="su-top"><span class="su-back" aria-hidden="true">${IC.back}</span>`+
      `<div><h2>${esc(title)}</h2><small class="su-under">${esc(under)}</small></div></header><div class="su-body">${body}</div></div></dialog>`;
    const phone=(cls,label)=>`<div class="sut-phone ${cls}"><b class="sut-label">${label}</b><div class="sut-glass"><div class="sut-screen" data-sut-screen></div></div></div>`;
    // wat de telefoon van je collega toont
    const other={
      home:()=>`<div class="sut-other"><span class="sut-time">9:41</span><div class="sut-chat"><small>WhatsApp</small><div class="sut-bubble" data-sut-file>${IC.file}<span><b>${esc((standName()||'Stand')+'.aluvision')}</b><em>Tik om te openen</em></span></div></div></div>`,
      empty:()=>`<div class="sut-other"><span class="sut-time">9:41</span></div>`,
      stand:(list,extra='')=>`<div class="sut-other is-app"><span class="sut-time">9:41</span><div class="sut-appcard"><span class="su-stand-ic">${IC.zones}</span><b>${esc(standName()||'Je stand')}</b>`+
        `<small>Je hebt de stand · ${roleName(list)}</small>${meter(list)}</div><div class="sut-lights">${ALWAYS.map(([k,t])=>`<i>${IC[k]}<em>${t}</em></i>`).join('')}</div>${extra}</div>`,
      locked:()=>`<div class="sut-other is-locked"><span class="sut-time">9:41</span><span class="sut-lock">${IC.lock}</span><b>Geen toegang meer</b><small>${esc(standName()||'Je stand')}</small></div>`};
    function openTutorial(){
      if(tut)return;
      const reduceNow=reduce(),el=document.createElement('div');el.className='ki sut';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Tutorial: je stand delen');
      el.innerHTML=`<div class="ki-top"><b>Tutorial</b><button type="button" class="ki-btn" data-ki="skip">Overslaan</button></div>`+
        `<div class="ki-box" data-ki-box><div class="ki-fit sut-fit" data-ki-fit>${phone('is-me','Jij')}${phone('is-other','Je collega')}<span class="sut-fly" data-sut-fly>${IC.file}</span><i class="ki-finger sut-finger" data-sut-finger></i></div></div>`+
        `<div class="ki-subs" aria-hidden="true">${TSTEPS.map((t,i)=>`<p class="ki-sub" data-sub="${i}">${t}</p>`).join('')}<p class="ki-sub final" data-sub="final">Zo deel je je stand.<span>Tik op Stand delen om te beginnen.</span></p></div><p class="ki-sr" data-ki-sr aria-live="polite"></p>`+
        `<div class="ki-bottom"><button type="button" class="ki-btn" data-ki="pause" aria-label="Pauzeren">${PAUSE}</button><div class="ki-progress" data-ki-progress><i></i></div>`+
        `<div class="ki-steps" data-ki-steps hidden><button type="button" class="ki-btn" data-ki="prev" aria-label="Vorige stap">‹</button><span class="ki-dots">${'<i></i>'.repeat(TSTEPS.length)}</span><button type="button" class="ki-btn" data-ki="next" aria-label="Volgende stap">›</button></div>`+
        `<div class="ki-end" data-ki-end hidden><button type="button" class="ki-btn" data-ki="replay">${REPLAY}Opnieuw</button><button type="button" class="ki-btn primary" data-ki="close">Aan de slag</button></div></div>`;
      // in een eigen venster bovenop alles (ook bovenop de pagina Delen en gebruikers), zoals de andere tutorials van de app
      const dlg=document.createElement('dialog');dlg.className='ki-dialog sut-dialog';dlg.setAttribute('aria-label','Tutorial: je stand delen');dlg.append(el);document.body.append(dlg);
      try{dlg.showModal();}catch(_){dlg.setAttribute('open','');}
      dlg.addEventListener('cancel',e=>{e.preventDefault();close();});
      document.documentElement.classList.add('ki-open');
      const fit=el.querySelector('[data-ki-fit]'),box=el.querySelector('[data-ki-box]'),me=fit.querySelector('.is-me [data-sut-screen]'),them=fit.querySelector('.is-other [data-sut-screen]'),
        finger=fit.querySelector('[data-sut-finger]'),fly=fit.querySelector('[data-sut-fly]');
      const W=PW*2+90,H=PH+40;fit.style.width=W+'px';fit.style.height=H+'px';
      const scale=()=>fit.style.setProperty('--ki-scale',Math.min(box.clientWidth/W,box.clientHeight/H).toFixed(4));scale();
      const ro=typeof ResizeObserver==='function'?new ResizeObserver(scale):null;ro?.observe(box);
      let run=0,paused=false,step=0;const STOP=Symbol('stop');
      const wait=async(my,ms)=>{let left=reduceNow?0:ms;while(left>0){if(my!==run)throw STOP;await new Promise(r=>setTimeout(r,Math.min(60,left)));if(!paused)left-=60;}if(my!==run)throw STOP;};
      // een plek in een telefoon → een plek in het beeld (zonder de schaal)
      const at=node=>{const f=fit.getBoundingClientRect(),r=node.getBoundingClientRect(),k=f.width/W;return [(r.left+r.width/2-f.left)/k,(r.top+r.height/2-f.top)/k];};
      const move=async(my,node,ms=650)=>{if(!node)return;const [x,y]=at(node);finger.style.transitionDuration=(reduceNow?0:ms)+'ms';finger.style.left=x+'px';finger.style.top=y+'px';finger.style.opacity='1';await wait(my,ms);};
      const tap=async(my,node)=>{await move(my,node);finger.classList.add('is-press');await wait(my,170);finger.classList.remove('is-press');await wait(my,200);};
      const say=i=>{el.querySelectorAll('.ki-sub').forEach(p=>p.classList.toggle('is-on',p.dataset.sub===String(i)));el.querySelector('[data-ki-sr]').textContent=i==='final'?'Zo deel je je stand.':TSTEPS[i];};
      const prog=f=>{const i=el.querySelector('[data-ki-progress]>i');if(i)i.style.transform=`scaleX(${Math.max(0,Math.min(1,f))})`;};
      // de schermen van jouw telefoon (de echte onderdelen van deze pagina)
      const demoUser={name:'Collega',vakjes:[...PRESETS.gast]};
      const scr={
        main:()=>screenPage('Delen en gebruikers',standName(),hero()+`<h3 class="su-h">Wie heeft toegang</h3><div class="su-users"><div class="su-user is-main"><span class="su-av is-main" aria-hidden="true">${IC.crown}</span><span class="su-user-t"><b>Jij</b><small>Deze telefoon</small></span><span class="su-pill is-main">Hoofdgebruiker</span></div></div>`),
        who:list=>screenPage('Stand delen',standName(),`<label class="su-field"><span>Voor wie?</span><input type="text" value="Collega" tabindex="-1" readonly></label><h3 class="su-h">Wat mag Collega?</h3>${bigRoles(roleOf(list))}<div class="su-mayshow">${mayList(list)}</div>`),
        via:list=>screenPage('Stand delen','Voor Collega',`<div class="su-file is-big"><span class="su-file-ic">${IC.file}</span><b>${esc((standName()||'Stand')+'.aluvision')}</b><small>Collega · ${roleName(list)}</small>${meter(list)}</div>`+
          `<h3 class="su-h">Delen via</h3><div class="su-targets">${[['airdrop','AirDrop'],['chat','WhatsApp'],['mail','Mail'],['more','Meer']].map(([k,t])=>`<span class="su-target" data-sut-target="${t}"><span>${IC[k]}</span><b>${t}</b></span>`).join('')}</div>`),
        user:(list,sync='')=>screenPage('Collega',standName(),`<div class="su-whohero">${avatar({name:'Collega',vakjes:list},true)}<b>Collega</b><span class="su-whometa">${pill(list)}${meter(list)}</span>${sync}</div>${switches(list)}`),
        revoke:(list,armed)=>screenPage('Collega',standName(),`<div class="su-whohero">${avatar({name:'Collega',vakjes:list},true)}<b>Collega</b><span class="su-whometa">${pill(list)}${meter(list)}</span></div>`+
          `<button type="button" class="su-second" tabindex="-1">${IC.file}<span>Bestandje opnieuw sturen</span></button><button type="button" class="su-revoke${armed?' is-armed':''}" data-sut-revoke tabindex="-1">${IC.lock}<span>${armed?'Tik nog eens: Collega kan je stand dan niet meer bedienen':'Toegang intrekken'}</span></button>`)};
      const show=(node,html)=>{node.innerHTML=html;node.querySelectorAll('button,input').forEach(b=>b.tabIndex=-1);};
      // per stap: de eindtoestand (now) en het spel met de vinger (play)
      const S6=[
        {now(){show(me,scr.main());show(them,other.empty());},
         async play(my){show(me,scr.main());show(them,other.empty());await wait(my,700);await tap(my,me.querySelector('[data-su=share]'));}},
        {now(){const l=[...PRESETS.opbouwer];show(me,scr.who(l));},
         async play(my){let l=[...PRESETS.gast];show(me,scr.who(l));await wait(my,900);await tap(my,me.querySelector('[data-su-role=opbouwer]'));l=[...PRESETS.opbouwer];show(me,scr.who(l));await wait(my,1500);}},
        {now(){show(me,scr.via(PRESETS.opbouwer));show(them,other.home());},
         async play(my){show(me,scr.via(PRESETS.opbouwer));await wait(my,800);const t=me.querySelector('[data-sut-target=WhatsApp]');await tap(my,t);
           const [x0,y0]=at(t),[x1,y1]=at(them);fly.style.transitionDuration='0ms';fly.style.left=x0+'px';fly.style.top=y0+'px';fly.style.opacity='1';await wait(my,60);
           fly.style.transitionDuration=(reduceNow?0:1100)+'ms';fly.style.left=x1+'px';fly.style.top=y1+'px';await wait(my,1150);fly.style.opacity='0';show(them,other.home());await wait(my,900);}},
        {now(){show(them,other.stand(PRESETS.opbouwer));},
         async play(my){await tap(my,them.querySelector('[data-sut-file]'));show(them,other.stand(PRESETS.opbouwer));await wait(my,1800);}},
        {now(){const l=[...PRESETS.gast,'zones-edit'];show(me,scr.user(l,`<span class="su-sync is-done">${IC.check}<span>Ook aangepast op de telefoon van Collega</span></span>`));
           show(them,other.stand(l,`<div class="sut-toast">${IC.check}<span>Je mag nu ook: zones maken en wijzigen</span></div>`));},
         async play(my){let l=[...PRESETS.gast];show(me,scr.user(l));show(them,other.stand(l));await wait(my,900);await tap(my,me.querySelector('[data-su-vak=zones-edit]'));
           l=[...PRESETS.gast,'zones-edit'];show(me,scr.user(l,`<span class="su-sync is-busy"><i></i><span>Doorsturen naar Collega…</span></span>`));await wait(my,1200);
           show(me,scr.user(l,`<span class="su-sync is-done">${IC.check}<span>Ook aangepast op de telefoon van Collega</span></span>`));
           show(them,other.stand(l,`<div class="sut-toast">${IC.check}<span>Je mag nu ook: zones maken en wijzigen</span></div>`));await wait(my,2000);}},
        {now(){show(me,scr.revoke([...PRESETS.gast,'zones-edit'],true));show(them,other.locked());},
         async play(my){const l=[...PRESETS.gast,'zones-edit'];show(me,scr.revoke(l,false));await wait(my,800);await tap(my,me.querySelector('[data-sut-revoke]'));
           show(me,scr.revoke(l,true));await wait(my,1000);await tap(my,me.querySelector('[data-sut-revoke]'));show(them,other.locked());await wait(my,2000);}}];
      const setEnd=on=>{el.querySelector('[data-ki-end]').hidden=!on;el.querySelector('[data-ki="skip"]').hidden=on;el.querySelector('[data-ki-progress]').hidden=on||reduceNow;el.querySelector('[data-ki="pause"]').hidden=on||reduceNow;
        if(on)el.querySelector('[data-ki="close"]').focus({preventScroll:true});};
      async function play(){const my=++run;paused=false;setEnd(false);finger.style.opacity='0';
        try{for(let k=0;k<S6.length;k++){step=k;say(k);prog(k/S6.length);await S6[k].play(my);await wait(my,400);}
          finger.style.opacity='0';prog(1);say('final');setEnd(true);}catch(e){if(e!==STOP)console.warn('stand-users tutorial',e);}}
      function go(i){run++;step=Math.max(0,Math.min(S6.length-1,i));show(me,scr.main());show(them,other.empty());for(let k=0;k<=step;k++)S6[k].now();say(step);
        el.querySelectorAll('.ki-dots i').forEach((d,j)=>d.classList.toggle('on',j===step));el.querySelector('[data-ki="prev"]').disabled=step===0;
        const last=step===S6.length-1;el.querySelector('[data-ki-steps]').hidden=last;setEnd(last);}
      function close(){run++;ro?.disconnect();try{dlg.close();}catch(_){}dlg.remove();document.documentElement.classList.remove('ki-open');tut=null;try{root.localStorage.setItem('aluvision.standUsers.tutorialSeen','1');}catch(_){}}
      el.addEventListener('click',e=>{const b=e.target.closest('[data-ki]');
        if(!b){if(e.target.closest('[data-ki-box]')&&!reduceNow&&el.querySelector('[data-ki-end]').hidden){paused=!paused;const pb=el.querySelector('[data-ki="pause"]');pb.innerHTML=paused?PLAY:PAUSE;el.classList.toggle('is-paused',paused);}return;}
        ({skip:close,close,replay:()=>reduceNow?go(0):play(),prev:()=>go(step-1),next:()=>go(step+1),
          pause:()=>{paused=!paused;b.innerHTML=paused?PLAY:PAUSE;b.setAttribute('aria-label',paused?'Verder afspelen':'Pauzeren');el.classList.toggle('is-paused',paused);}})[b.dataset.ki]?.();});
      el.addEventListener('keydown',e=>{if(e.key==='Escape')close();else if(reduceNow&&e.key==='ArrowRight')go(step+1);else if(reduceNow&&e.key==='ArrowLeft')go(step-1);});
      tut={close};el.querySelector('[data-ki-steps]').hidden=!reduceNow;
      requestAnimationFrame(()=>{scale();el.querySelector('[data-ki="skip"]').focus({preventScroll:true});if(reduceNow)go(0);else play();});}
    // ---------- de kaart in Instellingen ----------
    const count=()=>S.users.length+1;
    const cardSmall=()=>`${count()} ${count()===1?'persoon heeft':'mensen hebben'} toegang`;
    function cardHtml(){return `<button type="button" class="menu-card su-entry" data-su="open"><span class="menu-icon" aria-hidden="true">${IC.people}</span><span><b>Delen en gebruikers</b><small>${cardSmall()}</small></span><span class="su-entry-chev" aria-hidden="true">${IC.chev}</span></button>`;}
    function syncCards(){document.querySelectorAll('.su-entry small').forEach(s=>{s.textContent=cardSmall();});}
    document.addEventListener('click',e=>{const c=e.target.closest('.su-entry[data-su="open"]');if(c&&!stack.length)open();});
    return {cardHtml,open,openTutorial,closeAll:()=>{tut?.close();while(stack.length)closeTop();},isOpen:()=>stack.length>0};
  }
  // Flutter (Delen en gebruikers, U9): dezelfde bewaarplaats lezen en schrijven; een geldige lijst vervangt ook wat dit scherm toont.
  const store=Object.freeze({
    load:()=>JSON.parse(JSON.stringify(S||load())),
    save:v=>{
      if(!v||!Array.isArray(v.users)||v.users.length>50||!Number.isSafeInteger(v.seq)||v.seq<1)return false;
      if(!v.users.every(u=>u&&/^u[0-9]{1,6}$/.test(u.id)&&typeof u.name==='string'))return false;
      const users=v.users.map(u=>({id:u.id,name:u.name.replace(/[<>\u0000-\u001f\u007f]/g,'').trim().slice(0,40)||'?',vakjes:clean(Array.isArray(u.vakjes)?u.vakjes:[])}));
      if(new Set(users.map(u=>u.id)).size!==users.length)return false;
      S={seq:Math.max(v.seq,...users.map(u=>Number(u.id.slice(1))+1),1),users};save();return true;
    }});
  root.LightningStandUsers=Object.freeze({create,vakjes:VAKJES.map(v=>({id:v.id,name:v.name})),presets:PRESETS,store});
}(window));
