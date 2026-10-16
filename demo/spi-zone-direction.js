(function(root,factory){'use strict';const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningSPIZoneDirection=api;}(typeof globalThis!=='undefined'?globalThis:this,function(host){
  'use strict';
  const languages=['nl','en','fr','de'],copy=value=>JSON.parse(JSON.stringify(value));let serial=0;
  const texts={
    title:['Kanten aanpassen','Adjust directions','Ajuster les sens','Richtungen anpassen'],
    added:['Laatste stap · kanten instellen','Last step · set directions','Dernière étape · ajuster les sens','Letzter Schritt · Richtungen einstellen'],
    intro:['Laat dezelfde eindkleuren bij elkaar aansluiten.','Match the colours where the ends meet.','Faites correspondre les couleurs aux extrémités qui se rejoignent.','Verbinde die Enden mit der gleichen Farbe.'],
    look:['Kijk naar je echte ledlines.','Look at your real LED lines.','Regardez vos lignes LED réelles.','Schau auf deine echten LED-Linien.'],
    preview:['Voorbeeld · geen echte verlichting verbonden','Preview · no real lighting connected','Aperçu · aucun éclairage réel connecté','Vorschau · keine echte Beleuchtung verbunden'],
    pendingChanged:['Je aansluitingen zijn gewijzigd. Controleer de richtingen opnieuw.','Your connections have changed. Check the directions again.','Vos branchements ont changé. Vérifiez à nouveau les sens.','Deine Anschlüsse wurden geändert. Prüfe die Richtungen erneut.'],
    new:['Nieuw','New','Nouveau','Neu'],existing:['In deze zone','In this zone','Dans cette zone','In dieser Zone'],
    port:['Poort {port}','Port {port}','Port {port}','Port {port}'],pixels:['{count} pixels','{count} pixels','{count} pixels','{count} Pixel'],
    flip:['Omkeren','Flip','Inverser','Umkehren'],focus:['{receiver}, poort {port}: deze ledline herkennen','{receiver}, port {port}: identify this LED line','{receiver}, port {port} : repérer cette ligne LED','{receiver}, Port {port}: diese LED-Linie erkennen'],
    flipAria:['{receiver}, poort {port}: richting omkeren. Groen staat {end}.','{receiver}, port {port}: flip direction. Green is {end}.','{receiver}, port {port} : inverser le sens. Le vert est {end}.','{receiver}, Port {port}: Richtung umkehren. Grün ist {end}.'],
    left:['links','on the left','à gauche','links'],right:['rechts','on the right','à droite','rechts'],
    one:['1 pixel · alleen groen zichtbaar','1 pixel · only green is visible','1 pixel · seul le vert est visible','1 Pixel · nur Grün sichtbar'],
    selectHint:['Tik op een ledline: alleen haar witte midden pulseert.','Tap an LED line: only its white centre pulses.','Touchez une ligne LED : seul son milieu blanc pulse.','Tippe auf eine LED-Linie: Nur ihre weiße Mitte pulsiert.'],
    selected:['Geselecteerd','Selected','Sélectionnée','Ausgewählt'],
    pulsing:['Midden pulseert','Centre pulsing','Milieu pulsant','Mitte pulsiert'],
    pending:['Eindkleuren instellen…','Setting the end colours…','Réglage des couleurs aux extrémités…','Endfarben einstellen…'],
    applied:['Controleer de eindkleuren op je echte ledlines.','Check the end colours on your real LED lines.','Vérifiez les couleurs aux extrémités de vos lignes LED réelles.','Prüfe die Endfarben deiner echten LED-Linien.'],
    unsupported:['Voorbeeld in de app · testlicht hier niet beschikbaar.','App preview · test light is unavailable here.','Aperçu dans l’app · lumière de test indisponible ici.','App-Vorschau · Testlicht hier nicht verfügbar.'],
    failed:['Testlicht niet bevestigd. Controleer de verbinding; je keuzes blijven staan.','Test light is not confirmed. Check the connection; your choices are kept.','Lumière de test non confirmée. Vérifiez la connexion ; vos choix sont conservés.','Testlicht nicht bestätigt. Prüfe die Verbindung; deine Auswahl bleibt erhalten.'],
    retry:['Testlicht opnieuw starten','Restart test light','Relancer la lumière de test','Testlicht neu starten'],
    stale:['De zone is gewijzigd. Sluit dit scherm en open het opnieuw; je wijzigingen blijven beschikbaar.','The zone has changed. Close this screen and reopen it; your changes remain available.','La zone a changé. Fermez puis rouvrez cet écran ; vos modifications restent disponibles.','Die Zone wurde geändert. Schließe und öffne diesen Bildschirm erneut; deine Änderungen bleiben verfügbar.'],
    stopping:['Testlicht stoppen…','Stopping the test light…','Arrêt de la lumière de test…','Testlicht stoppen…'],
    stopFailed:['Stoppen niet bevestigd. Je keuzes blijven staan; probeer opslaan opnieuw.','Stopping is not confirmed. Your choices are kept; try saving again.','Arrêt non confirmé. Vos choix sont conservés ; réessayez d’enregistrer.','Stopp nicht bestätigt. Deine Auswahl bleibt erhalten; versuche erneut zu speichern.'],
    saving:['Richtingen bewaren…','Saving directions…','Enregistrement des sens…','Richtungen speichern…'],
    partial:['Niet alles is bewaard. Je overige wijzigingen blijven klaarstaan.','Not everything was saved. Your remaining changes are kept.','Tout n’a pas été enregistré. Vos autres modifications sont conservées.','Nicht alles wurde gespeichert. Deine übrigen Änderungen bleiben erhalten.'],
    pendingSave:['Rond je vorige opslag af met Opslaan. De gekozen kanten blijven behouden.','Finish the previous save with Save. Your chosen directions are kept.','Terminez l’enregistrement précédent avec Enregistrer. Les sens choisis restent conservés.','Schließe den vorherigen Speichervorgang mit Speichern ab. Die gewählten Richtungen bleiben erhalten.'],
    saveFailed:['Bewaren niet bevestigd. Je wijzigingen blijven klaarstaan.','Saving is not confirmed. Your changes are kept.','Enregistrement non confirmé. Vos modifications sont conservées.','Speichern nicht bestätigt. Deine Änderungen bleiben erhalten.'],
    empty:['Er zijn geen actieve SPI-poorten in deze zone.','There are no active SPI ports in this zone.','Cette zone ne contient aucun port SPI actif.','Diese Zone hat keine aktiven SPI-Ports.'],
    back:['Terug','Back','Retour','Zurück'],save:['Opslaan en klaar','Save and finish','Enregistrer et terminer','Speichern und fertig'],add:['Opslaan en toevoegen','Save and add','Enregistrer et ajouter','Speichern und hinzufügen'],finish:['Opslaan en afronden','Save and finish','Enregistrer et terminer','Speichern und abschließen'],close:['Sluiten','Close','Fermer','Schließen'],
    closeAria:['Richtingen sluiten; niet-bewaarde keuzes behouden','Close directions; keep unsaved choices','Fermer les sens ; conserver les choix non enregistrés','Richtungen schließen; ungespeicherte Auswahl behalten']
  };
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function canonical(value){if(value===undefined)return 'undefined';if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';}
  function icon(kind){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${kind==='flip'?'<path d="m17 2 4 4-4 4M3 6h18M7 22l-4-4 4-4m14 4H3"/>':kind==='check'?'<path d="m5 12 4.5 4.5L19 7"/>':kind==='back'?'<path d="m10 5-7 7 7 7M3 12h18"/>':'<path d="m6 6 12 12M18 6 6 18"/>'}</svg>`;}
  function validate(value){
    if(!value||!['standId','zoneId','zoneName'].every(key=>typeof value[key]==='string'&&value[key].length>0&&value[key].length<=240)||!Array.isArray(value.receivers)||value.receivers.length>128)throw Error('SPI_ZONE_CONTEXT_INVALID');
    const ids=new Set();for(const receiver of value.receivers){if(!receiver||typeof receiver.id!=='string'||!receiver.id||ids.has(receiver.id)||typeof receiver.name!=='string'||!Array.isArray(receiver.outputs)||receiver.outputs.length!==4)throw Error('SPI_ZONE_RECEIVER_INVALID');ids.add(receiver.id);for(const [index,output] of receiver.outputs.entries())if(!output||output.port!==index+1||typeof output.enabled!=='boolean'||typeof output.reversed!=='boolean'||!Number.isInteger(output.pixels)||output.pixels<(output.enabled?1:0)||output.pixels>1024)throw Error('SPI_ZONE_OUTPUTS_INVALID');}
    if(value.newReceiverId!==undefined&&!ids.has(value.newReceiverId))throw Error('SPI_ZONE_NEW_RECEIVER_INVALID');if(value.previewOnly!==undefined&&typeof value.previewOnly!=='boolean'||value.pendingChanged!==undefined&&typeof value.pendingChanged!=='boolean'||value.pairFirst!==undefined&&typeof value.pairFirst!=='boolean')throw Error('SPI_ZONE_MODE_INVALID');
  }
  function applyPending(data){
    if(data.pendingChanges===undefined)return;
    if(!Array.isArray(data.pendingChanges))throw Error('SPI_ZONE_PENDING_INVALID');const seen=new Set();
    for(const change of data.pendingChanges){const receiver=data.receivers.find(item=>item.id===change?.receiverId);if(!receiver||seen.has(receiver.id)||!Array.isArray(change.outputs)||change.outputs.length!==4||change.requiresReconcile!==undefined&&typeof change.requiresReconcile!=='boolean')throw Error('SPI_ZONE_PENDING_GEOMETRY_CHANGED');seen.add(receiver.id);
      for(const [index,output] of change.outputs.entries()){const original=receiver.outputs[index];if(typeof output?.reversed!=='boolean'||canonical({...output,reversed:false})!==canonical({...original,reversed:false})||!original.enabled&&output.reversed!==original.reversed)throw Error('SPI_ZONE_PENDING_GEOMETRY_CHANGED');}
    }
    for(const change of data.pendingChanges){const receiver=data.receivers.find(item=>item.id===change.receiverId);for(const [index,output] of change.outputs.entries())if(receiver.outputs[index].enabled)receiver.outputs[index].reversed=output.reversed;}
  }
  function create({onPreview=null,onObserve=null,onStop=null,onSave,onClose=()=>{},getCurrentZoneSignature}={}){
    if(typeof onSave!=='function'||typeof onClose!=='function'||typeof getCurrentZoneSignature!=='function'||onPreview!==null&&typeof onPreview!=='function'||onObserve!==null&&typeof onObserve!=='function'||onPreview&&typeof onStop!=='function')throw Error('SPI_ZONE_CALLBACKS_REQUIRED');
    const doc=host.document,win=doc?.defaultView||host;let active=null,generation=0;
    const current=state=>active===state&&!state.closed&&state.generation===generation&&state.dialog.isConnected;
    function t(state,key,params={}){return texts[key][state.language].replace(/\{([a-z]+)\}/gi,(all,key)=>String(params[key]??all));}
    const context=state=>({standId:state.data.standId,zoneId:state.data.zoneId,sessionId:state.sessionId});
    function signature(state){return canonical(getCurrentZoneSignature({standId:state.data.standId,zoneId:state.data.zoneId}));}
    function status(state,key){if(!current(state))return;state.status=key;state.dialog.dataset.previewConfirmed=String(key==='applied');const node=state.dialog.querySelector('[data-spi-zone-status]');node.textContent=t(state,key);node.dataset.kind=['failed','stale','stopFailed','partial','saveFailed'].includes(key)?'error':key;const retry=state.dialog.querySelector('[data-spi-zone-action="retry"]');if(retry)retry.hidden=!['failed','stopFailed'].includes(key);for(const badge of state.dialog.querySelectorAll('[data-spi-zone-focus-badge]'))badge.textContent=t(state,key==='applied'&&Number(badge.closest('[data-spi-zone-line]').dataset.pixels)>2?'pulsing':'selected');}
    function validContext(state){if(!current(state))return false;try{if(signature(state)===state.signature)return true;}catch(_){}status(state,'stale');state.stale=true;controls(state);return false;}
    function lines(state){return state.data.receivers.flatMap(receiver=>receiver.outputs.filter(output=>output.enabled).map(output=>({receiverId:receiver.id,port:output.port,reversed:output.reversed})));}
    function changes(state){return state.data.receivers.filter(receiver=>state.pendingSaveReceivers.has(receiver.id)||canonical(receiver.outputs)!==canonical(state.baseline.get(receiver.id))).map(receiver=>({receiverId:receiver.id,outputs:copy(receiver.outputs),...(state.pendingSaveReceivers.has(receiver.id)?{requiresReconcile:true}:{})}));}
    function request(state){return{...context(state),lines:lines(state),focus:state.focus?copy(state.focus):null};}
    function confirmed(answer,wanted){return answer?.status==='applied'&&answer.sessionId===wanted.sessionId&&canonical(answer.lines)===canonical(wanted.lines)&&canonical(answer.focus??null)===canonical(wanted.focus);}
    const now=()=>win.performance?.now?.()??Date.now();
    function clearObservation(state){win.clearTimeout(state.observeTimer);state.observeTimer=null;state.observeEpoch=(state.observeEpoch||0)+1;}
    function lease(answer){return Number.isInteger(answer?.previewTTLMS)&&answer.previewTTLMS>0&&answer.previewTTLMS<=15000;}
    function recordLease(state,wanted,answer,sentAt){
      state.confirmedRequest=copy(wanted);state.leaseUntil=sentAt+answer.previewTTLMS;win.clearTimeout(state.leaseTimer);
      // Independent watchdog: a hung local observation cannot keep a physical
      // confirmation alive. A pending write is already displayed as pending.
      state.leaseTimer=win.setTimeout(()=>{state.leaseTimer=null;if(current(state)&&!state.paused&&!state.inFlight&&!state.previewRetired&&now()>=state.leaseUntil){clearObservation(state);state.previewFailed=true;state.pending=null;status(state,'failed');}},Math.max(1,state.leaseUntil-now()));
    }
    function observeLater(state){
      if(!onObserve||!enabled(state)||state.previewFailed||state.previewRetired||!state.confirmedRequest||state.inFlight)return;
      win.clearTimeout(state.observeTimer);state.observeTimer=win.setTimeout(()=>{state.observeTimer=null;void observe(state);},Math.max(1,Math.min(1000,state.leaseUntil-now())));
    }
    async function observe(state){
      if(!enabled(state)||state.previewFailed||state.previewRetired||state.inFlight||!state.confirmedRequest)return;
      const epoch=state.observeEpoch,version=state.version,wanted=copy(state.confirmedRequest),sentAt=now();
      let answer;try{answer=await onObserve(copy(context(state)));}catch(_){}
      if(!current(state)||state.observeEpoch!==epoch||state.version!==version||!enabled(state)||state.inFlight||state.previewFailed)return;
      if(confirmed(answer,wanted)&&lease(answer)){
        // Native reports its existing finite lease. This read has no radio
        // writes and cannot itself renew it. Request time is conservative.
        if(sentAt+answer.previewTTLMS>now()){recordLease(state,wanted,answer,sentAt);status(state,'applied');observeLater(state);return;}
        state.previewFailed=true;state.pending=null;status(state,'failed');return;
      }else if(answer&&answer.status!=='busy'){
        state.previewFailed=true;state.pending=null;status(state,'failed');return;
      }
      if(now()>=state.leaseUntil){state.previewFailed=true;state.pending=null;status(state,'failed');return;}
      observeLater(state);
    }
    function enabled(state){return current(state)&&!state.saving&&!state.paused&&!state.stopJob&&!state.stale&&!doc.hidden&&state.dialog.open&&validContext(state);}
    function controls(state){if(!current(state))return;for(const button of state.dialog.querySelectorAll('[data-spi-zone-action="flip"],[data-spi-zone-action="select"],[data-spi-zone-action="save"],[data-spi-zone-action="retry"]'))button.disabled=state.saving||state.stale||!!state.stopJob||button.dataset.spiZoneAction==='flip'&&state.pendingSaveReceivers.has(button.closest('[data-spi-zone-line]')?.dataset.receiverId);}
    async function drain(state){
      if(state.inFlight||state.previewFailed||!state.pending||!enabled(state))return;const wanted=state.pending,version=state.version,sentAt=now();state.pending=null;state.inFlight=true;status(state,'pending');clearObservation(state);
      const job=Promise.resolve().then(()=>onPreview(copy(wanted)));state.previewJob=job;
      try{const answer=await job;if(current(state)&&!state.paused){if(!confirmed(answer,wanted)||onObserve&&(!lease(answer)||sentAt+answer.previewTTLMS<=now())){state.previewFailed=true;state.pending=null;status(state,answer?.status==='unsupported'?'unsupported':'failed');}else if(version===state.version&&enabled(state)){if(onObserve)recordLease(state,wanted,answer,sentAt);status(state,'applied');}}}
      catch(_){if(current(state)&&!state.paused){state.previewFailed=true;state.pending=null;status(state,'failed');}}
      finally{if(state.previewJob===job)state.previewJob=null;state.inFlight=false;if(current(state)){if(state.pending)void drain(state);else observeLater(state);}}
    }
    function queue(state){if(!enabled(state)||state.previewRetired)return;if(state.data.previewOnly||!onPreview){status(state,'unsupported');return;}state.version++;if(state.previewFailed)return;state.pending=request(state);void drain(state);}
    function setFocus(state,receiverId,port){state.focus={receiverId,port};for(const card of state.dialog.querySelectorAll('[data-spi-zone-line]')){const selected=card.dataset.receiverId===receiverId&&Number(card.dataset.port)===port;card.dataset.selected=String(selected);card.querySelector('[data-spi-zone-action="select"]').setAttribute('aria-pressed',String(selected));const badge=card.querySelector('[data-spi-zone-focus-badge]');if(badge){badge.hidden=!selected;badge.textContent=t(state,'selected');}}}
    function updateCard(state,receiver,output){const card=[...state.dialog.querySelectorAll('[data-spi-zone-line]')].find(node=>node.dataset.receiverId===receiver.id&&Number(node.dataset.port)===output.port);if(!card)return;card.dataset.reversed=String(output.reversed);const button=card.querySelector('[data-spi-zone-action="flip"]');button.setAttribute('aria-pressed',String(output.reversed));button.setAttribute('aria-label',t(state,'flipAria',{receiver:receiver.name,port:output.port,end:t(state,output.reversed?'right':'left')}));}
    function stop(state){
      state.paused=true;state.previewRetired=true;state.pending=null;state.version++;clearObservation(state);win.clearTimeout(state.leaseTimer);state.leaseTimer=null;state.confirmedRequest=null;state.leaseUntil=0;if(current(state))state.dialog.dataset.previewConfirmed='false';
      if(state.stopJob)return state.stopJob;
      if(state.data.previewOnly||!onPreview)return Promise.resolve({status:'stopped',sessionId:state.sessionId});
      const running=state.previewJob;
      state.stopJob=Promise.resolve(running).catch(()=>{}).then(()=>onStop(copy(context(state)))).finally(()=>{state.stopJob=null;if(current(state)&&!state.saving){state.paused=false;controls(state);}});controls(state);return state.stopJob;
    }
    function bounded(state,promise,ms){return new Promise((resolve,reject)=>{const timer=win.setTimeout(()=>{state.waitTimers.delete(timer);reject(Error('SPI_ZONE_STOP_TIMEOUT'));},ms);state.waitTimers.set(timer,reject);promise.then(value=>{win.clearTimeout(timer);state.waitTimers.delete(timer);resolve(value);},error=>{win.clearTimeout(timer);state.waitTimers.delete(timer);reject(error);});});}
    async function retry(state){
      if(!enabled(state))return;state.saving=true;controls(state);status(state,'stopping');
      try{
        const answer=await bounded(state,stop(state),18000);if(!current(state))return;
        if(answer?.status!=='stopped'||answer.sessionId!==state.sessionId){status(state,'stopFailed');return;}
        if(!validContext(state))return;
        // A new session is allowed only AFTER the previous exact session has
        // a confirmed/no-write STOP. Never replay a tombstoned START or erase
        // the customer's draft to recover a transport failure.
        state.sessionId='spi-zone-'+Date.now().toString(36)+'-'+(++serial);
        state.previewRetired=false;state.previewFailed=false;state.saving=false;state.paused=false;controls(state);queue(state);
      }catch(_){if(current(state))status(state,'stopFailed');}
      finally{if(current(state)){state.saving=false;state.paused=!!state.stopJob;controls(state);}}
    }
    function visibility(state){
      if(!current(state))return;
      const epoch=++state.visibilityEpoch;
      if(doc.hidden){state.visibilityStop=stop(state);void state.visibilityStop.catch(()=>{});return;}
      // STOP retires an exact native session even when it succeeds. Never
      // restart/update that retired ID after returning to the foreground.
      const stopped=state.visibilityStop;
      if(!stopped)return;
      void stopped.then(answer=>{
        if(!current(state)||doc.hidden||state.visibilityEpoch!==epoch||state.saving)return;
        state.visibilityStop=null;state.paused=false;
        if(answer?.status!=='stopped'||answer.sessionId!==state.sessionId){status(state,'stopFailed');controls(state);return;}
        if(!validContext(state))return;
        state.sessionId='spi-zone-'+Date.now().toString(36)+'-'+(++serial);
        state.previewRetired=false;state.previewFailed=false;controls(state);queue(state);
      },()=>{
        if(!current(state)||doc.hidden||state.visibilityEpoch!==epoch||state.saving)return;
        state.visibilityStop=null;state.paused=false;status(state,'stopFailed');controls(state);
      });
    }
    async function save(state){
      if(!enabled(state))return;const wanted=changes(state);state.saving=true;controls(state);status(state,'stopping');
      try{const answer=await bounded(state,stop(state),18000);if(!current(state))return;if(answer?.status!=='stopped'||answer.sessionId!==state.sessionId){status(state,'stopFailed');return;}if(!validContext(state))return;if(!wanted.length){close('done');return;}status(state,'saving');
        const result=await onSave({...context(state),changes:copy(wanted)});if(!current(state))return;
        const reports=result?.results,ids=wanted.map(item=>item.receiverId).sort();if(!Array.isArray(reports)||canonical(reports.map(row=>row.receiverId).sort())!==canonical(ids)||reports.some(row=>!['saved','pending','failed'].includes(row.status))||new Set(reports.map(row=>row.receiverId)).size!==reports.length){status(state,'saveFailed');return;}
        let now;try{now=signature(state);}catch(_){status(state,'stale');state.stale=true;return;}
        if(now!==state.signature&&canonical(result.zoneSignature)!==now){status(state,'stale');state.stale=true;return;}
        state.signature=now;for(const row of reports)if(row.status==='saved'){state.baseline.set(row.receiverId,copy(wanted.find(item=>item.receiverId===row.receiverId).outputs));state.pendingSaveReceivers.delete(row.receiverId);}else if(row.status==='pending')state.pendingSaveReceivers.add(row.receiverId);
        if(reports.every(row=>row.status==='saved')){close('saved');return;}status(state,'partial');
      }catch(_){if(current(state))status(state,state.status==='stopping'?'stopFailed':'saveFailed');}
      finally{if(current(state)){state.saving=false;state.paused=!!state.stopJob;controls(state);}}
    }
    function click(state,event){
      const button=event.target?.closest?.('[data-spi-zone-action]');
      if(!button){const card=event.target?.closest?.('[data-spi-zone-line]');if(card&&state.dialog.contains(card)&&enabled(state)){const receiver=state.data.receivers.find(item=>item.id===card.dataset.receiverId),output=receiver?.outputs.find(item=>item.port===Number(card.dataset.port)&&item.enabled);if(output){setFocus(state,receiver.id,output.port);queue(state);}}return;}
      if(!state.dialog.contains(button)||button.disabled)return;const action=button.dataset.spiZoneAction;
      if(action==='close'||action==='back'){event.preventDefault();close(action);return;}if(action==='save'){void save(state);return;}if(action==='retry'){void retry(state);return;}if(!['select','flip'].includes(action)||!enabled(state))return;
      const card=button.closest('[data-spi-zone-line]'),receiver=state.data.receivers.find(item=>item.id===card?.dataset.receiverId),output=receiver?.outputs.find(item=>item.port===Number(card?.dataset.port)&&item.enabled);if(!receiver||!output)return;
      setFocus(state,receiver.id,output.port);if(action==='flip'){output.reversed=!output.reversed;updateCard(state,receiver,output);}queue(state);
    }
    function close(reason='close'){
      const state=active;if(!state)return;const pendingChanges=changes(state),focused=state.dialog.contains(doc.activeElement)||doc.activeElement===doc.body;active=null;generation++;state.closed=true;state.pending=null;state.unbindTutorial?.();state.dialog.removeEventListener('click',state.click);state.dialog.removeEventListener('cancel',state.cancel);doc.removeEventListener('visibilitychange',state.visibility);for(const [timer,reject] of state.waitTimers){win.clearTimeout(timer);reject(Error('SPI_ZONE_CLOSED'));}state.waitTimers.clear();if(state.dialog.open)state.dialog.close();state.dialog.remove();
      void stop(state).catch(()=>{});try{onClose({reason,...context(state),...(state.data.newReceiverId?{newReceiverId:state.data.newReceiverId}:{}),pendingChanges:copy(pendingChanges)});}catch(_){}
      if(focused&&!doc.hidden&&state.focusBefore?.isConnected&&(!doc.hasFocus||doc.hasFocus()))state.focusBefore.focus?.({preventScroll:true});
    }
    function open(value){
      if(active)throw Error('SPI_ZONE_DIRECTION_ALREADY_OPEN');if(!doc?.createElement)throw Error('SPI_ZONE_DOM_REQUIRED');validate(value);
      const language=languages.indexOf(String(doc.documentElement.lang||'nl').toLowerCase().split('-')[0]),dialog=doc.createElement('dialog'),data=copy(value),state={generation:++generation,data,dialog,language:Math.max(0,language),sessionId:'spi-zone-'+Date.now().toString(36)+'-'+(++serial),baseline:new Map(data.receivers.map(receiver=>[receiver.id,copy(receiver.outputs)])),focus:null,focusBefore:doc.activeElement,pending:null,inFlight:false,previewJob:null,version:0,paused:false,saving:false,stale:false,closed:false,stopJob:null,waitTimers:new Map(),status:'pending'};
      state.pendingSaveReceivers=new Set();applyPending(data);for(const pending of data.pendingChanges||[])if(pending.requiresReconcile===true)state.pendingSaveReceivers.add(pending.receiverId);
      state.signature=signature(state);active=state;const headingId='spi-zone-direction-title-'+serial;dialog.className='spi-zone-direction-dialog';dialog.setAttribute('aria-labelledby',headingId);
      const tutorial=host.LightningSPIDirectionTutorial?.markup({language:languages[state.language]})||'';
      const groups=data.receivers.map(receiver=>{const outputs=receiver.outputs.filter(output=>output.enabled);if(!outputs.length)return '';return `<section class="spi-zone-receiver"><header><h3>${esc(receiver.name)}</h3><span>${esc(t(state,receiver.id===data.newReceiverId?'new':'existing'))}</span></header><div class="spi-zone-cards">${outputs.map(output=>`<article class="spi-zone-port-card" data-spi-zone-line data-receiver-id="${esc(receiver.id)}" data-port="${output.port}" data-pixels="${output.pixels}" data-reversed="${output.reversed}" data-selected="false"><header><b>${esc(t(state,'port',{port:output.port}))}</b><span>${esc(t(state,'pixels',{count:output.pixels}))}</span></header><div class="spi-zone-port-actions"><button type="button" class="spi-zone-select" data-spi-zone-action="select" aria-pressed="false" aria-label="${esc(t(state,'focus',{receiver:receiver.name,port:output.port}))}"><span class="spi-zone-strip" aria-hidden="true">${output.pixels>2?'<i class="spi-zone-strip-interior"></i>':''}<i class="spi-zone-cap spi-zone-green">G</i>${output.pixels===1?'':'<i class="spi-zone-cap spi-zone-red">R</i>'}</span></button><button type="button" class="spi-zone-flip" data-spi-zone-action="flip" aria-pressed="${output.reversed}" aria-label="${esc(t(state,'flipAria',{receiver:receiver.name,port:output.port,end:t(state,output.reversed?'right':'left')}))}">${icon('flip')}<span>${esc(t(state,'flip'))}</span></button></div>${output.pixels===1?`<small class="spi-zone-one">${esc(t(state,'one'))}</small>`:''}</article>`).join('')}</div></section>`;}).join('');
      dialog.innerHTML=`<div class="spi-zone-direction-shell"><header class="spi-zone-direction-header"><div><small>${esc(data.zoneName)}</small><h2 id="${headingId}">${esc(t(state,data.newReceiverId?'added':'title'))}</h2></div><button type="button" data-spi-zone-action="close" aria-label="${esc(t(state,'closeAria'))}">${icon('close')}</button></header><div class="spi-zone-direction-body">${data.previewOnly?`<p class="spi-zone-preview">${esc(t(state,'preview'))}</p>`:''}${data.pendingChanged?`<p class="spi-zone-change-notice" role="note">${esc(t(state,'pendingChanged'))}</p>`:''}${tutorial||`<h3 class="spi-zone-look">${esc(t(state,'look'))}</h3>`}<p class="spi-zone-select-hint">${esc(t(state,'selectHint'))}</p><p class="spi-zone-status" data-spi-zone-status role="status" aria-live="polite">${esc(t(state,'pending'))}</p>${groups||`<p>${esc(t(state,'empty'))}</p>`}</div><footer class="spi-zone-direction-footer"><button type="button" data-spi-zone-action="back">${icon('back')}<span>${esc(t(state,'back'))}</span></button><button type="button" data-spi-zone-action="save">${icon('check')}<span>${esc(t(state,'save'))}</span></button></footer></div>`;
      dialog.querySelector('[data-spi-zone-action="save"]').querySelector('span').textContent=t(state,data.newReceiverId?(data.pairFirst?'finish':'add'):'save');
      for(const card of dialog.querySelectorAll('[data-spi-zone-line]')){const badge=doc.createElement('span');badge.dataset.spiZoneFocusBadge='';badge.hidden=true;badge.textContent=t(state,'selected');card.querySelector('header').querySelector('b').append(badge);}
      const retryButton=doc.createElement('button');retryButton.type='button';retryButton.className='spi-zone-retry';retryButton.dataset.spiZoneAction='retry';retryButton.textContent=t(state,'retry');retryButton.hidden=true;dialog.querySelector('[data-spi-zone-status]').after(retryButton);
      if(state.pendingSaveReceivers.size){const hint=doc.createElement('p');hint.className='spi-zone-change-notice';hint.textContent=t(state,'pendingSave');dialog.querySelector('[data-spi-zone-status]').after(hint);}
      state.visibilityEpoch=0;state.visibilityStop=null;state.previewRetired=false;state.previewFailed=false;
      state.click=event=>click(state,event);state.cancel=event=>{event.preventDefault();close('escape');};state.visibility=()=>visibility(state);dialog.addEventListener('click',state.click);dialog.addEventListener('cancel',state.cancel);doc.addEventListener('visibilitychange',state.visibility);doc.body.append(dialog);
      try{dialog.showModal();}catch(error){active=null;dialog.removeEventListener('click',state.click);dialog.removeEventListener('cancel',state.cancel);doc.removeEventListener('visibilitychange',state.visibility);dialog.remove();throw error;}
      state.unbindTutorial=host.LightningSPIDirectionTutorial?.bind(dialog)||null;controls(state);queue(state);return context(state);
    }
    return Object.freeze({open,close,isOpen:()=>!!active});
  }
  return Object.freeze({create});
}));
