/* Destructive settings UI. Plans and progress are native observations, not
 * authority. PIN entry and verification remain exclusively in native UI.
 * A partial receiver reset never authorizes clearing browser/app storage. */
(function(root,factory){
  'use strict';const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningAppErase=api;
})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
  const keys=(value,names)=>plain(value)&&Object.keys(value).sort().join(',')===names.slice().sort().join(',');
  const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
  const count=value=>Number.isSafeInteger(value)&&value>=0&&value<=4096;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function fail(){throw Object.assign(Error('APP_ERASE_UNCONFIRMED'),{code:'APP_ERASE_UNCONFIRMED'});}
  function progress(value){if(!keys(value,['completed','total'])||!count(value.completed)||!count(value.total)||value.completed>value.total)fail();return clone(value);}
  function pending(value){
    if(!keys(value,['jobId','status','scope','progress'])||!id(value.jobId)||!['in-progress','verification-required'].includes(value.status)||!['local-only','receivers-and-local'].includes(value.scope))fail();
    return {...clone(value),progress:progress(value.progress)};
  }
  function validatePlan(value){
    if(!keys(value,['status','planId','scopes','receiverCount','recoveryWillBeLost','choices',...(plain(value)&&Object.hasOwn(value,'pendingReset')?['pendingReset']:[])])||value.status!=='ready'||!id(value.planId)||!count(value.receiverCount)||typeof value.recoveryWillBeLost!=='boolean'||
      !Array.isArray(value.scopes)||value.scopes.length>64||!Array.isArray(value.choices)||value.choices.length!==2||value.choices[0]!=='local-only'||value.choices[1]!=='receivers-and-local')fail();
    const seen=new Set();let total=0;
    for(const scope of value.scopes){if(!keys(scope,['standId','name','receiverCount','requiresPin'])||!id(scope.standId)||seen.has(scope.standId)||typeof scope.name!=='string'||scope.name.length>512||!count(scope.receiverCount)||typeof scope.requiresPin!=='boolean')fail();seen.add(scope.standId);total+=scope.receiverCount;}
    if(total!==value.receiverCount)fail();
    const result=clone(value);if(Object.hasOwn(value,'pendingReset'))result.pendingReset=pending(value.pendingReset);return result;
  }
  function validateLocal(value){if(!keys(value,['status'])||!['erased-local-only','cancelled'].includes(value.status))fail();return clone(value);}
  function validateReset(value,previous=null){
    if(keys(value,['status'])&&value.status==='cancelled')return clone(value);
    const modern=keys(value,['status','jobId','progress','mode','factoryResetConfirmed','localOnlyAvailable','needsReceiverNetwork']);
    if(!(modern||keys(value,['status','jobId','progress']))||!id(value.jobId)||!['in-progress','verification-required','pin-required','completed-local-erased'].includes(value.status))fail();
    if(modern&&(value.mode!=='authority-negative'||value.factoryResetConfirmed!==false||
       value.localOnlyAvailable!==true||value.needsReceiverNetwork!==true||value.status==='completed-local-erased'))fail();
    if(previous?.mode==='authority-negative'&&!modern&&value.status!=='completed-local-erased')fail();
    const p=progress(value.progress);
    if(previous&&(value.jobId!==previous.jobId||p.total!==previous.progress.total||p.completed<previous.progress.completed))fail();
    if(value.status==='completed-local-erased'&&p.completed!==p.total)fail();
    return {...clone(value),progress:p};
  }
  const COPY={
    title:['Gegevens wissen','Erase data','Effacer les données','Daten löschen'],
    settingsHint:['Kies wat je wist. Je bevestigt veilig met je bestaande PIN.','Choose what to erase. Confirm securely with your existing PIN.','Choisissez quoi effacer. Confirmez avec votre code PIN actuel.','Wähle, was gelöscht wird. Bestätige sicher mit deiner bisherigen PIN.'],
    checking:['Je opgeslagen installaties controleren…','Checking saved installations…','Vérification des installations enregistrées…','Gespeicherte Installationen prüfen…'],
    localTitle:['Alleen app wissen','Erase app only','Effacer uniquement l’application','Nur App löschen'],
    localHint:['Ook zonder wifi. Receivers blijven werken en gekoppeld.','Works offline. Receivers keep working and stay paired.','Même hors ligne. Les récepteurs restent actifs et associés.','Auch offline. Receiver laufen weiter und bleiben gekoppelt.'],
    localWarning:['Standen, zones, scènes en herstelgegevens verdwijnen van dit toestel. Receivers blijven aan hun huidige stand gekoppeld. Voor een andere stand is eerst een receiverreset nodig.','Booths, zones, scenes and recovery data are removed from this device. Receivers stay paired to their current booth. Reset the receivers before using them in another booth.','Les stands, zones, scènes et données de récupération disparaissent de cet appareil. Les récepteurs restent associés au stand actuel. Réinitialisez-les avant de les utiliser dans un autre stand.','Stände, Zonen, Szenen und Wiederherstellungsdaten werden auf diesem Gerät gelöscht. Receiver bleiben mit ihrem bisherigen Stand gekoppelt. Vor einem anderen Stand ist ein Receiver-Reset nötig.'],
    physicalTitle:['App en receivers wissen','Erase app and receivers','Effacer l’application et les récepteurs','App und Receiver löschen'],
    physicalHint:['Zet alle receivers aan. Fabrieksreset, daarna de app wissen.','Turn on all receivers. Factory reset, then erase the app.','Allumez tous les récepteurs. Réinitialisation d’usine, puis effacement de l’application.','Alle Receiver einschalten. Werksreset, danach App löschen.'],
    physicalWarning:['De app wordt pas gewist als elke receiver de reset heeft bevestigd.','The app is erased only after every receiver confirms its reset.','L’application n’est effacée qu’après confirmation de chaque récepteur.','Die App wird erst gelöscht, wenn jeder Receiver seinen Reset bestätigt hat.'],
    recovery:['Ook je bewaarde herstelgegevens worden gewist.','Your saved recovery data will also be erased.','Vos données de récupération seront aussi effacées.','Auch gespeicherte Wiederherstellungsdaten werden gelöscht.'],
    summary:['{count} receivers · {stands} installaties','{count} receivers · {stands} installations','{count} récepteurs · {stands} installations','{count} Receiver · {stands} Installationen'],
    summaryOne:['{count} receivers · 1 installatie','{count} receivers · 1 installation','{count} récepteurs · 1 installation','{count} Receiver · 1 Installation'],
    pin:['Je voert de PIN veilig in het volgende systeemvenster in.','Enter the PIN securely in the next system window.','Saisissez le code PIN dans la prochaine fenêtre système sécurisée.','Gib die PIN sicher im nächsten Systemfenster ein.'],
    choose:['Kies wat je wilt wissen','Choose what to erase','Choisissez quoi effacer','Wähle, was gelöscht wird'],
    confirmLocal:['Alleen app wissen · bevestigen','Erase app only · confirm','Effacer uniquement l’application · confirmer','Nur App löschen · bestätigen'],
    confirmPhysical:['App en receivers wissen · bevestigen','Erase app and receivers · confirm','Effacer l’application et les récepteurs · confirmer','App und Receiver löschen · bestätigen'],
    consent:['Ik begrijp dat dit niet ongedaan kan worden gemaakt.','I understand this cannot be undone.','Je comprends que cette action est irréversible.','Ich verstehe, dass dies nicht rückgängig gemacht werden kann.'],
    progressTitle:['Receivers veilig wissen','Safely erasing receivers','Effacement sécurisé des récepteurs','Receiver sicher löschen'],
    recoveryTitle:['Wissen verderzetten','Continue erasing','Continuer l’effacement','Löschen fortsetzen'],
    recoveryHint:['Een eerdere wisopdracht is nog niet afgerond. Controleer de opgeslagen status om veilig verder te gaan.','An earlier erase request is not finished. Check the saved status to continue safely.','Une demande d’effacement précédente n’est pas terminée. Vérifiez l’état enregistré pour continuer en sécurité.','Ein früherer Löschauftrag ist noch nicht abgeschlossen. Prüfe den gespeicherten Status, um sicher fortzufahren.'],
    progress:['{completed} van {total} resets bevestigd','{completed} of {total} resets confirmed','{completed} réinitialisations confirmées sur {total}','{completed} von {total} Resets bestätigt'],
    modernProgress:['{completed} van {total} resetcontroles bewaard','{completed} of {total} reset checks recorded','{completed} contrôles de réinitialisation enregistrés sur {total}','{completed} von {total} Reset-Prüfungen gespeichert'],
    modernPending:['Nog niet volledig bevestigd. Je kunt ook alleen de app wissen; onbereikbare receivers zijn daarmee niet gereset.','Not fully confirmed yet. You can erase only the app; that does not reset unreachable receivers.','Confirmation encore incomplète. Vous pouvez effacer uniquement l’application ; les récepteurs injoignables ne seront pas réinitialisés.','Noch nicht vollständig bestätigt. Du kannst nur die App löschen; unerreichbare Receiver werden dadurch nicht zurückgesetzt.'],
    retained:['Je appgegevens blijven bewaard tot alle resets bevestigd zijn.','Your app data is kept until every reset is confirmed.','Vos données restent conservées jusqu’à confirmation de toutes les réinitialisations.','Deine App-Daten bleiben erhalten, bis alle Resets bestätigt sind.'],
    paused:['Gepauzeerd · bevestiging nodig','Paused · confirmation needed','En pause · confirmation nécessaire','Pausiert · Bestätigung erforderlich'],
    reconnect:['Zet de overige receivers aan en verbind met je standwifi. Bevestigde resets worden niet herhaald.','Turn on the remaining receivers and connect to your booth Wi-Fi. Confirmed resets are not repeated.','Allumez les récepteurs restants et connectez-vous au Wi-Fi du stand. Les réinitialisations confirmées ne sont pas répétées.','Schalte die übrigen Receiver ein und verbinde dich mit dem Stand-WLAN. Bestätigte Resets werden nicht wiederholt.'],
    resume:['Controleren en verdergaan','Check and continue','Vérifier et continuer','Prüfen und fortsetzen'],
    resumeLocal:['Appwissen afronden','Finish erasing app data','Terminer l’effacement de l’application','Löschen der App abschließen'],
    localPending:['Appwissen nog niet afgerond · geen receiverreset','App erasure not finished · no receiver reset','Effacement de l’application inachevé · aucun récepteur réinitialisé','App noch nicht vollständig gelöscht · kein Receiver-Reset'],
    later:['Sluiten · later verdergaan','Close · continue later','Fermer · continuer plus tard','Schließen · später fortsetzen'],
    close:['Sluiten','Close','Fermer','Schließen'],
    back:['Terug','Back','Retour','Zurück'],
    cancel:['Annuleren','Cancel','Annuler','Abbrechen'],
    retry:['Opnieuw controleren','Check again','Vérifier à nouveau','Erneut prüfen'],
    busy:['Veilig controleren…','Checking securely…','Vérification sécurisée…','Sicher prüfen…'],
    error:['Nog niet bevestigd. Controleer de status opnieuw voordat je verdergaat.','Not yet confirmed. Check the status again before continuing.','Pas encore confirmé. Vérifiez à nouveau l’état avant de continuer.','Noch nicht bestätigt. Prüfe den Status erneut, bevor du fortfährst.'],
    pinError:['De PIN is niet bevestigd. Er is geen nieuwe reset gestart.','The PIN was not confirmed. No new reset was started.','Le code PIN n’a pas été confirmé. Aucune nouvelle réinitialisation n’a été lancée.','Die PIN wurde nicht bestätigt. Es wurde kein neuer Reset gestartet.'],
    pinUnavailable:['Je PIN kan op dit toestel niet offline worden gecontroleerd. Je gegevens blijven bewaard.','Your PIN cannot be verified offline on this device. Your data is kept.','Votre code PIN ne peut pas être vérifié hors ligne sur cet appareil. Vos données sont conservées.','Deine PIN kann auf diesem Gerät nicht offline geprüft werden. Deine Daten bleiben erhalten.'],
    setupPending:['De koppeling is nog niet afgerond. Kies alleen app wissen, of rond eerst de koppeling af. Pixels en kanten hoeven daarvoor niet klaar te zijn.','Pairing is not finished. Choose app-only erasure, or finish pairing first. Pixels and directions do not need to be completed.','L’association n’est pas terminée. Effacez uniquement l’application ou terminez d’abord l’association. Les pixels et les sens peuvent être réglés plus tard.','Die Kopplung ist noch nicht abgeschlossen. Lösche nur die App oder schließe erst die Kopplung ab. Pixel und Richtungen können später eingestellt werden.'],
    stale:['De opgeslagen installaties zijn veranderd. Controleer de lijst opnieuw; er is niets extra gewist.','The saved installations have changed. Check the list again; nothing more was erased.','Les installations enregistrées ont changé. Vérifiez à nouveau la liste ; rien de plus n’a été effacé.','Die gespeicherten Installationen haben sich geändert. Prüfe die Liste erneut; es wurde nichts zusätzlich gelöscht.'],
    unavailable:['Wissen is in deze versie niet veilig beschikbaar. Je gegevens blijven bewaard.','Erasing is not safely available in this version. Your data is kept.','L’effacement sécurisé n’est pas disponible dans cette version. Vos données sont conservées.','Sicheres Löschen ist in dieser Version nicht verfügbar. Deine Daten bleiben erhalten.'],
    demo:['Demo · geen echte receivers of PIN-controle','Demo · no real receivers or PIN verification','Démo · aucun récepteur réel ni contrôle du code PIN','Demo · keine echten Receiver oder PIN-Prüfung'],
    demoHint:['Alleen deze tijdelijke demopagina wordt leeggemaakt.','Only this temporary demo page is cleared.','Seule cette page de démonstration temporaire est effacée.','Nur diese temporäre Demoseite wird geleert.']
  };
  const languages=['nl','en','fr','de'];
  const icon=name=>name==='phone'?'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M10 5h4m-3 14h2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>':'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="5" width="20" height="12" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M6 17v3m4-3v3m4-3v3m4-3v3M6 9h6m-6 4h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="18" cy="11" r="1.5" fill="currentColor"/></svg>';
  function text(key,language='nl',params={}){const row=COPY[key==='summary'&&params.stands===1?'summaryOne':key];if(!row)return '';const index=Math.max(0,languages.indexOf(String(language).split('-')[0]));return row[index].replace(/\{([a-z]+)\}/gi,(match,name)=>Object.hasOwn(params,name)?String(params[name]):match);}
  function create({services={},language=()=>root.document?.documentElement?.lang||'nl',demo=false,onErased=()=>{},onRecovery=()=>{}}={}){
    let dialog,plan=null,result=null,choice=null,busy=false,error='',timer=null,generation=0,returnFocus=null,unavailable=false;
    const t=(key,params)=>text(key,language(),params);
    const clearTimer=()=>{if(timer!==null)root.clearTimeout(timer);timer=null;};
    function close(){if(busy)return;clearTimer();generation++;dialog?.close();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});}
    function pendingResult(){return result&&['in-progress','verification-required','pin-required'].includes(result.status);}
    function paint(){
      if(!dialog?.open)return;
      let body='';
      if(!plan)body=`<p role="status">${esc(t(busy?'checking':unavailable?'unavailable':'error'))}</p>${!busy&&!unavailable?`<button class="button full" data-erase="check">${esc(t('retry'))}</button>`:''}`;
      else if(pendingResult()&&!choice){
        const p=result.progress,local=result.scope==='local-only';
        body=`<section class="card"><h3>${esc(t(local?'resumeLocal':result.status==='in-progress'?'progressTitle':'paused'))}</h3>${local?`<p role="status">${esc(t('localPending'))}</p>`:`<div class="app-erase-progress" role="status"><b>${esc(t(result.mode==='authority-negative'?'modernProgress':'progress',p))}</b><progress max="${Math.max(1,p.total)}" value="${p.completed}"></progress></div>`}<p>${esc(t(local?'recovery':result.mode==='authority-negative'?'modernPending':'retained'))}</p>${result.status==='in-progress'?'':`<p>${esc(t(local?'pin':'reconnect'))}</p>`}</section>${!busy?`<button class="button full" data-erase="resume">${esc(t(local?'resumeLocal':'resume'))}</button>${!local?`<button class="text-button full" data-erase="choose-local">${esc(t('localTitle'))}</button>`:''}`:''}`;
      }else if(choice){
        const physical=choice==='receivers-and-local';
        body=`<section class="card app-erase-warning"><h3>${esc(t(physical?'physicalTitle':'localTitle'))}</h3><p>${esc(t(physical?'physicalWarning':'localWarning'))}</p>${physical?`<p>${esc(t('summary',{count:plan.receiverCount,stands:plan.scopes.length}))}</p>`:''}${plan.recoveryWillBeLost?`<p>${esc(t('recovery'))}</p>`:''}<p class="app-erase-hint">${esc(t(demo?'demoHint':'pin'))}</p></section><label class="app-erase-consent"><input type="checkbox" data-erase-consent><span>${esc(t('consent'))}</span></label><button class="button full app-erase-confirm" data-erase="confirm" disabled>${esc(t(physical?'confirmPhysical':'confirmLocal'))}</button><button class="button secondary full" data-erase="back">${esc(t('back'))}</button>`;
      }else{
        body=`<p>${esc(t('choose'))}</p><div class="app-erase-choices"><button type="button" class="menu-card" data-erase="local-only"><span class="app-erase-symbol">${icon('phone')}</span><span><b>${esc(t('localTitle'))}</b><small>${esc(t('localHint'))}</small></span><span aria-hidden="true">›</span></button><button type="button" class="menu-card" data-erase="receivers-and-local"><span class="app-erase-symbol">${icon('receiver')}</span><span><b>${esc(t('physicalTitle'))}</b><small>${esc(t('physicalHint'))}</small></span><span aria-hidden="true">›</span></button></div><p class="app-erase-hint">${esc(t('summary',{count:plan.receiverCount,stands:plan.scopes.length}))}</p>`;
      }
      dialog.innerHTML=`<header><h2>${esc(t('title'))}</h2><button type="button" class="icon-button" data-erase="close" aria-label="${esc(t('close'))}">×</button></header>${demo?`<p class="app-erase-demo" role="note">${esc(t('demo'))}</p>`:''}${body}<p role="alert" ${error?'':'hidden'}>${esc(error)}</p><p role="status" ${busy?'':'hidden'}>${esc(t('busy'))}</p><button type="button" class="button secondary full" data-erase="close">${esc(t(pendingResult()?'later':'cancel'))}</button>`;
      dialog.querySelectorAll('button,input').forEach(control=>{if(busy)control.disabled=true;});
      const consent=dialog.querySelector('[data-erase-consent]');if(consent)consent.addEventListener('change',()=>{const confirm=dialog.querySelector('[data-erase="confirm"]');if(confirm)confirm.disabled=busy||!consent.checked;});
    }
    function queue(){
      clearTimer();if(!dialog?.open||busy||result?.status!=='in-progress'||result?.scope==='local-only')return;
      const epoch=generation;timer=root.setTimeout(()=>{timer=null;if(epoch===generation&&dialog?.open)void perform('resume');},250);
    }
    async function check(){
      if(busy)return;clearTimer();busy=true;error='';unavailable=false;paint();
      try{if(typeof services.planAppErase!=='function'){unavailable=true;return;}plan=validatePlan(await services.planAppErase({}));choice=null;result=plan.pendingReset?clone(plan.pendingReset):null;onRecovery(!!result);}
      catch(_){plan=null;error=t('error');}
      finally{busy=false;paint();}
      // Reopening a partial job only observes it. The user explicitly resumes.
    }
    async function perform(action){
      if(busy||!plan)return;clearTimer();busy=true;error='';paint();
      try{
        if((action==='confirm'&&choice==='local-only')||(action==='resume'&&result?.scope==='local-only')){
          const answer=validateLocal(await services.eraseAppData({confirmation:'Alles verwijderen',scope:'local-only',planId:plan.planId}));
          if(answer.status==='erased-local-only'){clearTimer();generation++;dialog?.close();await onErased(answer);return;}
          // A native cancel is not an erase and does not discard the plan/job.
        }else{
          const previous=pendingResult()?result:null;
          const answer=validateReset(await (action==='confirm'
            ?services.beginAppReset({planId:plan.planId,confirmation:'Reset receivers en verwijder alles'})
            :services.continueAppReset({jobId:result.jobId})),previous);
          if(answer.status==='completed-local-erased'){clearTimer();generation++;dialog?.close();await onErased(answer);return;}
          if(answer.status!=='cancelled'){result={...answer,scope:'receivers-and-local'};onRecovery(true);}
          else if(result)result={...result,status:'verification-required'};
        }
      }catch(failure){
        // Never infer a reset/wipe from timeout or transport failure. Stop the
        // loop and re-read the native durable journal on explicit retry.
        const code=failure?.code;
        error=t(['REMOVAL_PIN_INVALID','APP_ERASE_PIN_INVALID','APP_RESET_PIN_INVALID'].includes(code)?'pinError':code==='APP_ERASE_PIN_UNAVAILABLE'?'pinUnavailable':code==='APP_ERASE_SETUP_PENDING'?'setupPending':['APP_ERASE_PLAN_STALE','APP_RESET_PLAN_STALE'].includes(code)?'stale':'error');
        if(result)result={...result,status:'verification-required'};else plan=null;
        if(code==='APP_ERASE_PENDING')onRecovery(true);
      }finally{busy=false;paint();}
      if(!error)queue();
    }
    function click(event){
      const button=event.target.closest?.('[data-erase]');if(!button||busy)return;
      const action=button.dataset.erase;if(action==='close')return close();if(action==='check')return void check();
      if(action==='back'){choice=null;error='';return paint();}
      if(action==='choose-local'&&pendingResult()&&result.scope==='receivers-and-local'){choice='local-only';error='';return paint();}
      if(['local-only','receivers-and-local'].includes(action)){if(!plan||pendingResult())return;choice=action;error='';return paint();}
      if(action==='confirm'&&!dialog.querySelector('[data-erase-consent]')?.checked)return;
      if(action==='confirm'||action==='resume')void perform(action);
    }
    async function open(){
      if(busy||dialog?.open)return;clearTimer();generation++;plan=null;result=null;choice=null;error='';unavailable=false;
      returnFocus=root.document.activeElement;
      if(!dialog){dialog=root.document.createElement('dialog');dialog.className='app-erase-sheet';dialog.addEventListener('click',click);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});root.document.body.append(dialog);}
      dialog.setAttribute('aria-label',t('title'));dialog.showModal();await check();
    }
    return Object.freeze({open,close,isOpen:()=>dialog?.open===true});
  }
  return Object.freeze({validatePlan,validateLocal,validateReset,progress,text,create});
});
