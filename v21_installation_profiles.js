/* Explicit local installation profiles. A factory-reset receiver is never
 * substituted for an old owner identity. Private bridge archives use the
 * native encrypted CAS journal; old trust/mesh journals are not changed. */
(function (root) {
  'use strict';
  const KEYS = Object.freeze({profiles:'aluvision.installation.profiles.v1',bridge:'aluvision.faithful.bridge.v1',app:'aluv12',core:'aluvision.v21.core.v1'});
  const clone = value => JSON.parse(JSON.stringify(value));
  const valid = (value,length) => typeof value==='string' && value.length===length && /^[0-9A-F]+$/.test(value) && !/^0+$/.test(value);
  const fail = message => Object.assign(new Error(message),{code:'INSTALLATION_PROFILE'});
  const forbidden = new Set(['__proto__','prototype','constructor','masterSecret','networkKey','compatibilityKey','installationSecret','privateJwk','privateKey','token','sessionToken','rawInfo','auth']);
  function publicValue(value,depth=0) {
    if(depth>28)throw fail('De inrichting is te groot om veilig te bewaren.');
    if(value===null||typeof value==='boolean'||typeof value==='string')return;
    if(typeof value==='number'&&Number.isFinite(value))return;
    if(!value||typeof value!=='object')throw fail('De inrichting is onvolledig.');
    for(const [key,item] of Object.entries(value)) {if(forbidden.has(key))throw fail('De inrichting bevat beveiligingsgegevens buiten de beveiligde opslag.');publicValue(item,depth+1);}
  }
  function state(value) {
    publicValue(value);
    if(!Array.isArray(value?.installations)||!value.installations.length||!Array.isArray(value.devices)||!Array.isArray(value.presets)||JSON.stringify(value).length>2*1024*1024)throw fail('De inrichting kon niet volledig worden bewaard.');
    return value;
  }
  function manifest(value) {
    if(!value)return {schema:1,activeId:null,profiles:[]};
    if(value.schema!==1||!Array.isArray(value.profiles)||value.profiles.length>8||value.activeId!==null&&!valid(value.activeId,8))throw fail('De bewaarde installaties zijn niet leesbaar. Er is niets vervangen.');
    const seen=new Set();
    for(const item of value.profiles){if(!valid(item.id,8)||seen.has(item.id)||!valid(item.transaction,16)||typeof item.name!=='string'||item.name.length>60)throw fail('Een bewaarde installatie is niet eenduidig.');seen.add(item.id);state(item.appState);if(item.coreState!==null)publicValue(item.coreState);}
    return value;
  }
  function parse(text){return text===null?null:JSON.parse(text);}
  function write(storage,key,value){if(value===null)storage.removeItem(key);else storage.setItem(key,value);if(storage.getItem(key)!==value)throw fail('Opslag is niet bevestigd. De vorige inrichting blijft bewaard.');}
  function bootstrap(storage) {
    let saved;
    try{saved=parse(storage.getItem(KEYS.bridge));}catch(error){if(storage.getItem(KEYS.profiles))throw error;return false;}
    const activation=saved?.profileActivation;
    if(!activation){
      const stored=storage.getItem(KEYS.profiles);
      if(stored){const index=manifest(parse(stored)),id=String(saved?.meshId||saved?.networkKey?.slice(0,8)||'').toUpperCase();
        if(index.pendingFrom){if(index.pendingFrom!==id)throw fail('De vorige installatieovergang moet eerst worden gecontroleerd.');index.activeId=id;delete index.pendingFrom;write(storage,KEYS.profiles,JSON.stringify(index));}}
      return false;
    }
    if(activation.schema!==1||!valid(activation.id,8)||!valid(activation.transaction,16)||saved.meshId!==activation.id)throw fail('De installatieovergang is onvolledig.');
    const index=manifest(parse(storage.getItem(KEYS.profiles))),target=index.profiles.find(item=>item.id===activation.id&&item.transaction===activation.transaction);
    if(!target||index.activeId!==target.id)throw fail('De bewaarde installatieovergang ontbreekt.');
    // The canonical bridge write is the commit marker. Repair both public
    // stores before any app/transport module loads, even after process death.
    write(storage,KEYS.app,JSON.stringify(state(target.appState)));
    write(storage,KEYS.core,target.coreState===null?null:JSON.stringify(target.coreState));
    delete index.pendingFrom;write(storage,KEYS.profiles,JSON.stringify(index));
    const next={...saved};delete next.profileActivation;
    write(storage,KEYS.bridge,JSON.stringify(next));
    return true;
  }
  function create({storage,journal,bridge,bindings,random,reload,isCurrent=()=>true}) {
    let busy=false;
    function index(){return manifest(parse(storage.getItem(KEYS.profiles)));}
    function check(){if(!isCurrent())throw fail('De keuze is geannuleerd. De vorige inrichting blijft bewaard.');}
    async function savePrivate(id,value){
      const key='profile:'+id,old=await journal.load(key);check();
      if(old&&(old.id!==id||old.installationId!==id||!valid(old.transaction,16)||!Number.isSafeInteger(old.journalRevision)||old.journalRevision<1))throw fail('De beveiligde installatiekopie is niet leesbaar.');
      const record={schema:1,id,installationId:id,transaction:old?.transaction||random(8),journalRevision:(old?.journalRevision||0)+1,bridge:clone(value)};
      if(JSON.stringify(record).length>250*1024)throw fail('De receivergegevens zijn te groot om veilig te bewaren.');
      if(await journal.save(key,record,old?.transaction||null)!==true)throw fail('De beveiligde kopie is intussen gewijzigd. Probeer niet opnieuw te koppelen.');
      if(JSON.stringify(await journal.load(key))!==JSON.stringify(record))throw fail('De beveiligde kopie is niet bevestigd.');
      check();return record;
    }
    async function switchProfile({name,targetId=null}) {
      if(busy)throw fail('Een installatie wordt al geopend.');
      if(journal?.storageClass!=='native-encrypted-owner-secrets-v1-cas')throw fail('Open hiervoor de geïnstalleerde app.');
      busy=true;let release,committed=false,indexBefore;
      try {
        check();release=await bridge.lock();check();
        const current=bridge.snapshot(),currentId=current.meshId;
        if(!valid(currentId,8))throw fail('De bestaande installatie-identiteit ontbreekt.');
        indexBefore=storage.getItem(KEYS.profiles);const canonicalBefore=storage.getItem(KEYS.bridge),next=clone(index());
        if(next.activeId&&next.activeId!==currentId)throw fail('De actieve installatie veranderde. Open de app opnieuw.');
        if(targetId===currentId)throw fail('Deze installatie staat al open.');
        const captured=bindings.snapshot(),appState=clone(state(captured.appState)),coreState=captured.coreState===null?null:clone(captured.coreState);
        if(coreState!==null)publicValue(coreState);
        const archived=await savePrivate(currentId,current.privateBridge);
        const previous={id:currentId,name:String(appState.installations.find(item=>item.id===appState.activeInstallationId)?.name||appState.installations[0].name||'Vorige installatie').slice(0,60),transaction:archived.transaction,appState,coreState};
        const oldIndex=next.profiles.findIndex(item=>item.id===currentId);
        if(oldIndex<0)next.profiles.push(previous);else next.profiles[oldIndex]=previous;
        let target,privateTarget;
        if(targetId){
          if(!valid(targetId,8))throw fail('Kies de bewaarde installatie opnieuw.');
          target=next.profiles.find(item=>item.id===targetId);
          if(!target)throw fail('Deze bewaarde installatie ontbreekt.');
          privateTarget=await journal.load('profile:'+targetId);check();
          if(privateTarget?.schema!==1||privateTarget.id!==targetId||privateTarget.installationId!==targetId||privateTarget.transaction!==target.transaction||privateTarget.bridge?.meshId!==targetId)throw fail('De beveiligde kopie hoort niet bij deze inrichting.');
        } else {
          const chosen=String(name||'').trim();if(!chosen||chosen.length>60)throw fail('Geef de nieuwe installatie een naam.');
          if(next.profiles.length>=8)throw fail('Er zijn al acht installaties bewaard. Er wordt niets verwijderd.');
          const id=random(4);if(!valid(id,8)||next.profiles.some(item=>item.id===id)||await journal.load('trust:'+id)||await journal.load('profile:'+id)||await journal.load('pending:'+id)||await journal.load(id))throw fail('Een nieuwe installatie kon niet veilig worden voorbereid. Probeer opnieuw.');check();
          const fresh=bridge.fresh(id),newState=clone(state(bindings.empty(chosen)));
          privateTarget=await savePrivate(id,fresh);
          target={id,name:chosen,transaction:privateTarget.transaction,appState:newState,coreState:null};next.profiles.push(target);
        }
        check();
        if(storage.getItem(KEYS.profiles)!==indexBefore||JSON.stringify(bindings.snapshot())!==JSON.stringify(captured))throw fail('De inrichting veranderde tijdens bewaren. Er is niets vervangen.');
        next.activeId=target.id;next.pendingFrom=currentId;manifest(next);
        // No awaits after the compare: archive manifest first, canonical
        // bridge last. A failed commit restores the prior manifest. A crash
        // after commit is completed by bootstrap, never guessed from a MAC.
        write(storage,KEYS.profiles,JSON.stringify(next));
        try{bridge.commit(privateTarget.bridge,{schema:1,id:target.id,transaction:target.transaction},target.appState);committed=true;}
        catch(error){
          if(storage.getItem(KEYS.bridge)===canonicalBefore)write(storage,KEYS.profiles,indexBefore);
          else committed=true; // uncertain commit: stay paused; bootstrap owns repair
          throw error;
        }
        try{reload();}catch(_){/* committed checkpoint remains recoverable on next launch */}
        return {ok:true,reloadRequired:true,installationId:target.id};
      } finally {if(!committed)release?.();busy=false;}
    }
    return Object.freeze({switchProfile,list:()=>clone(index().profiles.map(({id,name})=>({id,name}))),get busy(){return busy;}});
  }
  const api={KEYS,bootstrap,create};
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  let blocked=false,bindings=null,flow=0;
  try{bootstrap(root.localStorage);}catch(error){blocked=true;root.document.documentElement.dataset.profileStartup='blocked';root.document.body.innerHTML='<main style="max-width:520px;margin:10vh auto;padding:24px;font-family:system-ui"><h1>Installatie nog niet geopend</h1><p>De vorige en nieuwe inrichting blijven bewaard. Maak ruimte vrij op je telefoon en open de app opnieuw. Er wordt nu geen receiver verbonden.</p><button onclick="location.reload()">Opnieuw proberen</button></main>';}
  function engine(current){return create({storage:root.localStorage,journal:root.AluvisionNativeConnection?.secretJournal,bridge:root.AluvisionDirectBridge?.installationProfiles,bindings,random:n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase(),reload:()=>location.reload(),isCurrent:current});}
  function available(){return !!(bindings&&root.AluvisionNativeConnection?.secretJournal&&root.AluvisionDirectBridge?.installationProfiles);}
  function esc(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function show({targetId=null}={}) {
    if(!available())return root.toast?.('Open hiervoor de geïnstalleerde app.');
    const generation=++flow;let saved;
    try{saved=engine(()=>true).list();}catch(error){return root.toast?.(error.message);}
    const target=saved.find(item=>item.id===targetId);
    root.modal(`<section data-installation-profile-dialog><div class="eyebrow">${target?'BEWAARDE INSTALLATIE':'NIEUWE INSTALLATIE'}</div><h1>${target?'Open '+esc(target.name):'Als nieuwe installatie instellen'}</h1><p class="sub">${target?'Je huidige inrichting blijft bewaard. De app opent de gekozen installatie; receivers worden niet gewist of opnieuw gekoppeld.':'Alleen gebruiken voor een echt nieuwe of bewust naar fabrieksstaat teruggezette receiver. Je huidige inrichting blijft bewaard en is later terug te openen.'}</p>${target?'':`<label class="sub" for="installationProfileName">Naam van je nieuwe installatie</label><input id="installationProfileName" class="field" maxlength="60" value="Nieuwe installatie"><p class="sub">Daarna kies je de receiver, herken je de knipperende LED Line en maak je een nieuwe installatie-PIN. De app neemt geen oude receiver automatisch over.</p>`}<p role="status" data-profile-status></p><div class="row"><button class="button soft" data-profile-cancel>Annuleren</button><button class="button" data-profile-confirm>${target?'Installatie openen':'Bewaren en nieuw beginnen'}</button></div>${!target&&saved.length?`<hr><p class="sub">Bewaarde installaties</p>${saved.map(item=>`<button class="button soft" data-profile-open="${item.id}">${esc(item.name)}</button>`).join('')}`:''}</section>`);
    const form=document.querySelector('[data-installation-profile-dialog]'),current=()=>generation===flow&&form?.isConnected&&!document.getElementById('modal')?.hidden;
    form.querySelector('[data-profile-cancel]').onclick=()=>{flow++;root.closeModal?.();};
    form.querySelectorAll('[data-profile-open]').forEach(button=>button.onclick=()=>show({targetId:button.dataset.profileOpen}));
    form.querySelector('[data-profile-confirm]').onclick=async()=>{
      const button=form.querySelector('[data-profile-confirm]');if(button.disabled)return;button.disabled=true;
      form.querySelector('[data-profile-status]').textContent='Inrichting veilig bewaren…';
      try{await engine(current).switchProfile({targetId,name:form.querySelector('input')?.value});}
      catch(error){if(current()){form.querySelector('[data-profile-status]').textContent=error.message||'De inrichting kon niet worden bewaard. Er is niets vervangen.';button.disabled=false;}}
    };
  }
  function mount(){
    if(!available()||blocked)return;
    const pair=document.querySelector('.v20-private-pair,.v20-connection-choice');
    if(pair&&!pair.querySelector('[data-new-installation-profile]')&&(Object.keys(root.AluvisionDirectBridge.receivers||{}).length||localStorage.getItem(KEYS.profiles))){
      const button=document.createElement('button');button.type='button';button.className='button soft';button.dataset.newInstallationProfile='';button.textContent='Als nieuwe installatie instellen';button.onclick=()=>show();pair.append(button);
    }
    const settings=document.getElementById('settings');
    if(settings?.childElementCount&&!settings.querySelector('[data-installation-profile-settings]')){
      const card=document.createElement('div');card.className='card';card.dataset.installationProfileSettings='';card.innerHTML='<h2>Installaties op deze telefoon</h2><p class="sub">Bewaar je huidige inrichting en begin afzonderlijk met een nieuwe receiver, of open een bewaarde installatie.</p><button class="button soft">Installaties beheren</button>';card.querySelector('button').onclick=()=>show();settings.append(card);
    }
  }
  root.AluvisionInstallationProfiles=Object.freeze({...api,get startupBlocked(){return blocked;},bind(value){bindings=value;},open:show});
  if(!blocked)root.addEventListener('load',()=>{const observer=new MutationObserver(mount);observer.observe(document.body,{childList:true,subtree:true});mount();});
})(typeof window==='undefined'?globalThis:window);
