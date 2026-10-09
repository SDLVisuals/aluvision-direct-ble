/* Authenticated, journalled resets: MAIN last, exact target binding, no local
 * delete shortcut. PIN lives only in its single explicit native request. */
(function(root){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=value=>JSON.parse(JSON.stringify(value));
  const key=value=>Array.isArray(value)?'['+value.map(key).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+key(value[k])).join(',')+'}':JSON.stringify(value);
  const validPin=value=>typeof value==='string'&&/^[0-9]{8,12}$/.test(value);
  const pinRequired=()=>root.AluvisionSecurityMode?.pinRequired!==false;
  const statuses=new Set(['checking','ready','blocked','in-progress','pin-required','verification-required','removed']);
  function removalErrorMessage(action,failure){
    const code=failure?.code;
    // Preserve the existing bounded internal UNCONFIRMED classification only.
    // No raw receiver exception/message is displayed or newly classified.
    const messageKey=action==='check'&&code==='VIEW_NOT_LOADED'?'removalViewNotLoaded':action==='check'&&code===undefined&&failure?.message==='UNCONFIRMED'?'removalDataUnconfirmed':action==='check'&&['STAND_NOT_CONNECTED','STAND_SESSION_EXPIRED','STAND_CONNECTION_CANCELLED','STAND_CANCELLED'].includes(code)?'removalStandRequired':code==='REMOVAL_PIN_INVALID'?'removalPinInvalid':code==='REMOVAL_RATE_LIMITED'?'removalRateLimited':code==='REMOVAL_PLAN_STALE'?'removalPlanStale':code==='REMOVAL_SETUP_PENDING'?'removalSetupPending':code==='REMOVAL_OFFLINE'?'removalOffline':code==='REMOVAL_MEMBERSHIP_UNVERIFIED'?'removalMembershipUnverified':code==='REMOVAL_BLOCKED'?'removalBlocked':code==='REMOVAL_PIN_REQUIRED'?'removalPinRequired':action==='start'?'removalStartUnconfirmed':action==='check'?'removalCheckFailed':'removalResumeUnconfirmed';
    const fallback={
      removalViewNotLoaded:'Je standgegevens zijn nog niet geladen. Open je stand en controleer daarna opnieuw.',
      removalDataUnconfirmed:'De receivergegevens konden niet veilig worden bevestigd. Open je stand opnieuw en controleer daarna opnieuw.',
      removalStandRequired:'Open eerst je stand om de receivers te controleren. Controleer daarna opnieuw voordat je verwijdert.',
      removalPinInvalid:'Deze PIN klopt niet. Er is geen nieuwe reset gestart.',
      removalRateLimited:'Te veel PIN-pogingen. Wacht even en probeer opnieuw.',
      removalPlanStale:'De lijst met receivers is veranderd. Controleer opnieuw voordat je wist.',
      removalSetupPending:'Rond de open receiverinstelling eerst af. Er is niets gewist.',
      removalOffline:'Een receiver is niet bereikbaar. Zet alle receivers aan en controleer dezelfde verwijdering opnieuw.',
      removalMembershipUnverified:'Een gekoppelde receiver kon nog niet veilig worden herkend. Er is geen nieuwe reset gestart.',
      removalBlocked:'Wissen kan nog niet veilig worden gestart. Laat alle receivers aan en wacht tot eventuele updates klaar zijn.',
      removalPinRequired:'Voer je installatie-PIN opnieuw in om verder te gaan.',
      removalStartUnconfirmed:'Het wissen is nog niet bevestigd. Controleer eerst de bestaande verwijderopdracht.',
      removalCheckFailed:'De controle is niet gelukt. Controleer de verbinding en probeer opnieuw.',
      removalResumeUnconfirmed:'Verwijderen is nog niet bevestigd. Controleer de verbinding; onbevestigde receivers blijven behouden.'
    };
    return root.LightningV50ErrorTexts?.t(messageKey,root.document?.documentElement?.lang||'nl')||fallback[messageKey];
  }
  function create({services={},getModel,onRemoved=()=>{},standCodeAccess=()=>false}={}){
    let dialog,receiver,result,baseline,targets=[],busy=false,error='',generation=0,returnFocus,timer=null,autoContinue=false;
    const installation=()=>receiver?.role==='main',scope=()=>installation()?'installation':'receiver';
    const requiresPin=()=>installation()&&result?.requiresPin===true;
    const legacyPinCopy=()=>!standCodeAccess()&&pinRequired();
    const clearTimer=()=>{if(timer!==null)root.clearTimeout(timer);timer=null;};
    function clearPin(){const input=dialog?.querySelector('[data-removal-pin]');if(input)input.value='';}
    function close(){if(busy)return;clearPin();clearTimer();generation++;autoContinue=false;dialog?.close();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});}
    function consentReady(){
      const pinNeeded=requiresPin()&&(result?.status==='ready'||result?.status==='pin-required');
      return (!pinNeeded||validPin(dialog?.querySelector('[data-removal-pin]')?.value))&&(!installation()||dialog?.querySelector('[data-removal-consent]')?.checked===true);
    }
    function controls(){
      const button=dialog?.querySelector('[data-removal="start"],[data-removal="resume"]');
      if(button)button.disabled=busy||(['ready','pin-required'].includes(result?.status)&&!consentReady());
      const input=dialog?.querySelector('[data-removal-pin]'),hint=dialog?.querySelector('[data-removal-pin-hint]');
      if(input&&hint){const invalid=input.value!==''&&!validPin(input.value);hint.hidden=!invalid;input.setAttribute('aria-invalid',String(invalid));}
    }
    function pinFields(){return `${requiresPin()?'<label class="removal-pin-label" for="removal-installation-pin">Voer je installatie-PIN in<input id="removal-installation-pin" data-removal-pin type="password" inputmode="numeric" autocomplete="off" maxlength="12" minlength="8" autocapitalize="off" spellcheck="false" aria-describedby="removal-pin-help"></label><p id="removal-pin-help" class="removal-help">De bestaande PIN van deze installatie · 8–12 cijfers.</p><p data-removal-pin-hint class="removal-pin-hint" hidden>Gebruik je volledige PIN van 8–12 cijfers.</p>':''}<label class="removal-consent"><input type="checkbox" data-removal-consent><span>Ik begrijp dat alle receivers uit deze installatie worden gewist.</span></label>`;}
    function warning(){
      if(!installation())return `<section class="card removal-warning"><h3>Deze receiver ontkoppelen</h3><p><strong>${escape(receiver.name)}</strong> wordt losgekoppeld en start opnieuw. Voeg hem daarna opnieuw toe.</p><p>${legacyPinCopy()?'Je andere receivers en PIN blijven behouden.':'De rest van je stand blijft behouden.'}</p></section>`;
      const count=Number.isSafeInteger(result?.count)?result.count:targets.length;
      const targetSummary=count===1?'Er is één receiver in deze installatie.':count>1?`Je ontkoppelt alle ${count} receivers uit deze installatie.`:'Je ontkoppelt alle receivers uit deze installatie.';
      return `<section class="card removal-warning"><h3>Alle receivers ontkoppelen</h3><p>${targetSummary}</p><p>De koppeling${legacyPinCopy()?' en installatie-PIN':''} wordt gewist. Voeg daarna alle receivers opnieuw toe. Andere stands blijven behouden.</p><p class="removal-help">Laat alle receivers aan tot de reset is bevestigd.</p></section>`;
    }
    function progress(){
      const value=result?.progress;if(!value||!Number.isSafeInteger(value.completed)||!Number.isSafeInteger(value.total))return '';
      return `<div class="removal-progress" role="status"><b>${value.completed} van ${value.total} bevestigd</b><progress max="${Math.max(1,value.total)}" value="${value.completed}"></progress><span>${installation()?'Verbonden tot de laatste stap.':'Wacht op bevestiging.'}</span></div>`;
    }
    function paint(){
      if(!dialog?.open)return;
      const status=result?.status,removed=status==='removed';let content='';
      if(removed)content=`<section class="card"><h3>${installation()?'Alle receivers ontkoppeld':'Deze receiver ontkoppeld'}</h3><p>${installation()?`Reset bevestigd. Alle receivers starten opnieuw.${legacyPinCopy()?' De oude PIN is verwijderd.':''}`:`Reset bevestigd. De receiver start opnieuw; je andere receivers${legacyPinCopy()?' en PIN':''} blijven behouden.`}</p><p>Daarna kun je ${installation()?'ze':'hem'} opnieuw toevoegen.</p></section>`;
      else if(['verification-required','in-progress','pin-required'].includes(status)){
        content=warning()+progress();
        if(status==='pin-required'&&requiresPin())content+=`<section class="card"><h3>Verdergaan met wissen</h3><p>Voer je PIN opnieuw in. Bevestigde resets worden niet herhaald.</p></section>${pinFields()}<button class="button full removal-confirm" data-removal="resume">PIN bevestigen en verdergaan</button>`;
        else if(status==='pin-required')content+='<section class="card"><h3>Verwijderen gepauzeerd</h3><p>Deze oudere installatie kan niet in deze versie zonder toegangscode worden gewist. Er is niets extra verwijderd.</p></section>';
        else if(status==='verification-required')content+=`<section class="card"><h3>Verwijdering nog niet bevestigd</h3><p>Laat de overige receivers aan en verbonden. Alleen bevestigde resets worden als voltooid getoond.</p></section><button class="button full" data-removal="resume">Opnieuw controleren</button>`;
        else content+=`<section class="card"><h3>Receivers worden gewist</h3><p>Houd dit scherm open tot de bevestiging.</p></section>${autoContinue?'':'<button class="button full" data-removal="resume">Verdergaan</button>'}`;
      }else{
        content=warning();
        if(status==='ready')content+=(installation()?pinFields():'')+`<button class="button full removal-confirm" data-removal="start">${installation()?'Alle receivers ontkoppelen':'Deze receiver ontkoppelen'}</button>`;
        else if(status==='checking')content+='<p class="removal-help" role="status">Gekoppelde receivers worden veilig gecontroleerd…</p>';
        else content+=`<button class="button full" data-removal="check">${status==='blocked'?'Bereikbaarheid opnieuw controleren':'Verbinding controleren'}</button>`;
        if(status==='blocked')content+='<p class="removal-help">Geen nieuwe reset gestart. Zet alle receivers aan en controleer opnieuw.</p>';
      }
      dialog.innerHTML=`<header><div><h2>${removed?'Ontkoppeld':installation()?'Alle receivers ontkoppelen':'Deze receiver ontkoppelen'}</h2><p>${installation()?escape(baseline?.stands.find(s=>s.id===receiver.standId)?.name||'Je stand')+' · ':''}${escape(receiver.name)} · ${escape(receiver.type)}</p></div><button class="icon-button" data-removal="close" aria-label="Verwijdervenster sluiten">×</button></header>${content}<p role="alert" ${error?'':'hidden'}>${escape(error)}</p><p role="status" ${busy?'':'hidden'}>${['start','resume'].includes(dialog.dataset.action)?'Resetopdracht controleren…':'Even controleren…'}</p><button class="button secondary full" data-removal="close">${removed?'Terug naar receivers':result?.jobId?'Sluiten · later verdergaan':'Niet verwijderen'}</button>`;
      dialog.querySelectorAll('[data-removal],input').forEach(element=>{element.disabled=busy;});controls();
    }
    function validate(next,action,previous){
      if(standCodeAccess()&&(next?.requiresPin!==false||next?.status==='pin-required'))throw Error('UNCONFIRMED');
      if(!next||next.standId!==receiver.standId||next.receiverId!==receiver.id||next.rid!==receiver.rid||next.type!==receiver.type||next.scope!==scope()||!statuses.has(next.status)||typeof next.requiresPin!=='boolean'||!installation()&&next.requiresPin||next.status==='pin-required'&&!next.requiresPin||action!=='check'&&next.requiresPin!==previous?.requiresPin)throw Error('UNCONFIRMED');
      const partialCheck=standCodeAccess()&&action==='check'&&next.status==='checking'&&next.jobId===undefined&&previous?.jobId===undefined&&typeof next.planId==='string'&&!!next.planId;
      if(!Array.isArray(next.targets)||!Number.isSafeInteger(next.count)||next.count<next.targets.length||!partialCheck&&next.count!==next.targets.length||next.count<1||next.count>60)throw Error('UNCONFIRMED');
      const ids=new Set(),rids=new Set();
      for(const target of next.targets){
        if(!target||typeof target.receiverId!=='string'||!target.receiverId||typeof target.rid!=='string'||!/^[A-F0-9]{16}$/.test(target.rid)||!['SPI','RGBW'].includes(target.type)||!['main','node'].includes(target.role)||ids.has(target.receiverId)||rids.has(target.rid))throw Error('UNCONFIRMED');
        ids.add(target.receiverId);rids.add(target.rid);
        const known=baseline?.receivers.find(r=>r.id===target.receiverId||r.rid===target.rid);
        if(known&&(known.id!==target.receiverId||known.rid!==target.rid||known.standId!==receiver.standId||known.type!==target.type||known.role!==target.role))throw Error('UNCONFIRMED');
      }
      const own=next.targets.find(t=>t.receiverId===receiver.id);
      const missingOwnAllowed=partialCheck&&!installation()&&next.targets.length===0;
      if(!own&&!missingOwnAllowed||own&&(own.rid!==receiver.rid||own.type!==receiver.type||own.role!==receiver.role)||(!installation()&&next.count!==1)||installation()&&next.targets.filter(t=>t.role==='main').length!==1)throw Error('UNCONFIRMED');
      if(next.status==='ready'&&(action!=='check'||typeof next.planId!=='string'||!next.planId))throw Error('UNCONFIRMED');
      if(['in-progress','pin-required','verification-required','removed'].includes(next.status)&&(typeof next.jobId!=='string'||!next.jobId))throw Error('UNCONFIRMED');
      if(action==='resume'&&next.jobId!==previous?.jobId)throw Error('UNCONFIRMED');
      if(action==='start'&&next.planId!==previous?.planId)throw Error('UNCONFIRMED');
      if(action==='start'&&key(next.targets)!==key(previous?.targets))throw Error('UNCONFIRMED');
      if(previous?.jobId&&next.jobId===previous.jobId&&key(next.targets)!==key(targets))throw Error('UNCONFIRMED');
      if(next.progress&&(!Number.isSafeInteger(next.progress.completed)||!Number.isSafeInteger(next.progress.total)||next.progress.total!==next.count||next.progress.completed<0||next.progress.completed>next.progress.total))throw Error('UNCONFIRMED');
      if(previous?.jobId&&next.jobId===previous.jobId&&next.progress&&previous.progress&&next.progress.completed<previous.progress.completed)throw Error('UNCONFIRMED');
      if(next.status==='removed'&&(!next.progress||next.progress.completed!==next.count))throw Error('UNCONFIRMED');
    }
    async function acceptModel(next){
      const nativeModel=next.view?.model;if(!nativeModel){if(next.status==='removed')throw Error('UNCONFIRMED');return;}
      if(!Array.isArray(nativeModel.receivers))throw Error('UNCONFIRMED');
      if(standCodeAccess()){
        // The central reply is authoritative, including another phone's new
        // colour/effect. Never restore our old preview after a real release.
        if(!next.view.central&&!next.view.centralClosed)throw Error('UNCONFIRMED');
        const Model=root.LightningModel,model=Model.assertValid(clone(nativeModel));
        if(next.status==='removed'&&model.receivers.some(r=>installation()?r.standId===receiver.standId:r.id===receiver.id||r.rid===receiver.rid))throw Error('UNCONFIRMED');
        for(const known of baseline?.receivers||[]){
          const retained=model.receivers.find(r=>r.id===known.id);
          if(retained&&['rid','type','role','standId','deviceFingerprint'].some(field=>key(retained[field])!==key(known[field])))throw Error('UNCONFIRMED');
        }
        await onRemoved(model,{status:next.status,central:next.view.central,centralClosed:next.view.centralClosed});baseline=clone(model);return;
      }
      // Native storage authorizes the exact membership change, but stores a
      // neutral light baseline. Keep the already visible colour/animation and
      // reachability of retained receivers. Never mutate the native reply or
      // project identity, outputs, zone, role or any other configuration field.
      const model=clone(nativeModel);
      if(baseline)for(const retained of model.receivers){
        const previous=baseline.receivers.find(receiver=>receiver.id===retained.id);
        if(previous)for(const field of ['state','connection']){
          if(Object.prototype.hasOwnProperty.call(previous,field))retained[field]=clone(previous[field]);
        }
      }
      if(['checking','ready','blocked'].includes(next.status)&&baseline&&key(model)!==key(baseline))throw Error('UNCONFIRMED');
      const allowed=new Set(next.targets.map(t=>t.receiverId));
      if(next.status==='removed'&&model.receivers.some(r=>installation()?r.standId===receiver.standId:r.id===receiver.id||r.rid===receiver.rid))throw Error('UNCONFIRMED');
      if(baseline){
        for(const old of baseline.receivers){const found=model.receivers.find(r=>r.id===old.id);if((!allowed.has(old.id)||found)&&key(found)!==key(old))throw Error('UNCONFIRMED');}
        if(model.receivers.some(r=>!baseline.receivers.some(old=>old.id===r.id)))throw Error('UNCONFIRMED');
        for(const field of ['schemaVersion','demo','scenes','presets'])if(key(model[field])!==key(baseline[field]))throw Error('UNCONFIRMED');
        const Model=root.LightningModel,remaining=new Set(model.receivers.map(r=>r.id));
        if(typeof Model?.assertValid!=='function'||typeof Model?.unassignReceiver!=='function')throw Error('UNCONFIRMED');
        // Native release preserves each surviving physical line's place and
        // trims only the released receiver's lines. Use the existing semantic
        // model operation, not an IDs-only approximation or the reply's order.
        let expected=Model.assertValid(clone(baseline));
        for(const old of baseline.receivers)if(allowed.has(old.id)&&!remaining.has(old.id))expected=Model.unassignReceiver(expected,old.id);
        if(key(model.stands)!==key(expected.stands))throw Error('UNCONFIRMED');
        Model.assertValid(model);
        if(installation()&&next.status!=='removed'&&!model.receivers.some(r=>r.id===receiver.id))throw Error('UNCONFIRMED');
      }
      await onRemoved(model,{status:next.status});baseline=clone(model);
    }
    function schedule(action){clearTimer();const token=generation;timer=root.setTimeout(()=>{timer=null;if(token===generation&&dialog?.open&&!busy)perform(action,true);},250);}
    async function perform(action,automatic=false){
      if(busy||!dialog?.open)return;
      if(action==='start'&&(result?.status!=='ready'||!consentReady()))return;
      if(action==='resume'&&(!result?.jobId||result.status==='pin-required'&&!consentReady()))return;
      const token=generation,previous=result,request={standId:receiver.standId,receiverId:receiver.id};
      if(action==='start')request.planId=result.planId;
      if(action==='resume')request.jobId=result.jobId;
      if(requiresPin()&&(action==='start'||result?.status==='pin-required'))request.pin=dialog.querySelector('[data-removal-pin]').value;
      clearPin();clearTimer();if(!automatic&&action!=='check')autoContinue=true;
      busy=true;error='';dialog.dataset.action=action;paint();
      try{
        const method={check:'removalPlan',start:'removalStart',resume:'removalResume'}[action];
        if(typeof services[method]!=='function')throw Error('UNAVAILABLE');
        const next=await services[method](request);delete request.pin;if(token!==generation)return;
        validate(next,action,previous);await acceptModel(next);targets=clone(next.targets);result=next;
        if(!standCodeAccess()&&installation()&&action==='check'&&next.status!=='checking'&&next.status!=='blocked')root.AluvisionSecurityMode?.updateFromNative?.({pinRequired:next.requiresPin});
        if(['verification-required','pin-required','blocked','removed'].includes(next.status))autoContinue=false;
      }catch(failure){
        delete request.pin;if(token!==generation)return;autoContinue=false;
        const code=failure?.code;
        error=removalErrorMessage(action,failure);
        // An uncertain start must not leave a second destructive start button.
        if(action==='start'&&!['REMOVAL_PIN_INVALID','REMOVAL_RATE_LIMITED'].includes(code))result=null;
        if(action==='check')result=null;
      }finally{
        delete request.pin;if(token===generation){busy=false;paint();if(result?.status==='checking')schedule('check');else if(result?.status==='in-progress'&&autoContinue)schedule('resume');}
      }
    }
    function open(value){
      if(busy)throw Error('REMOVAL_BUSY');
      if(!value||value.lifecycle!=='added'||!['main','node'].includes(value.role))throw Error('ADDED_RECEIVER_REQUIRED');
      clearTimer();generation++;receiver={...value};baseline=typeof getModel==='function'?clone(getModel()):null;targets=[];result=null;busy=false;autoContinue=false;error='';returnFocus=document.activeElement;
      if(!dialog){dialog=document.createElement('dialog');dialog.className='receiver-removal-sheet';dialog.setAttribute('aria-label','Receiver verwijderen');document.body.append(dialog);
        dialog.addEventListener('click',event=>{const button=event.target.closest('[data-removal]');if(!button||button.disabled)return;button.dataset.removal==='close'?close():perform(button.dataset.removal);});
        dialog.addEventListener('input',controls);dialog.addEventListener('change',controls);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});}
      dialog.showModal();paint();dialog.scrollTop=0;perform('check');
    }
    return Object.freeze({open,close});
  }
  root.LightningReceiverRemovalUI=Object.freeze({create});
})(window);
