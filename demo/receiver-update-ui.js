/* Consumer OTA sheet. Only typed native services may authorize firmware.
 * Closing a sheet stops local polling, not an in-flight receiver update. */
(function(root){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const phases={preflight:'Receiver controleren',authorizing:'Update voorbereiden',uploading:'Software versturen',committing:'Software installeren',reconnecting:'Receiver start opnieuw',verifying:'Nieuwe software controleren',verified:'Bijgewerkt',verification_required:'Herstart nog controleren',interrupted:'Update onderbroken',journal_unconfirmed:'Bewaren nog niet bevestigd',aborting:'Annuleren controleren',cancelled:'Update geannuleerd'};
  const terminal=new Set(['completed','failed','cancelled']);
  function create({services={}}={}){
    let dialog=null,receiver=null,plan=null,job=null,busy=false,error='',generation=0,timer=null,returnFocus=null;
    function close(){generation++;clearTimeout(timer);timer=null;dialog?.close();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});}
    function exactJob(value){
      if(!value||value.rid!==receiver.rid||value.receiverType!==receiver.type||typeof value.id!=='string'||!value.id||value.id.length>96||
        !['queued','running','completed','failed','cancelled'].includes(value.state)||!Number.isFinite(value.progress)||value.progress<0||value.progress>100||
        typeof value.phase!=='string'||typeof value.committed!=='boolean'||typeof value.cancelAllowed!=='boolean'||typeof value.toVersion!=='string'||
        (value.state==='completed'&&(value.phase!=='verified'||value.progress!==100||value.committed!==true)))throw Error('UNCONFIRMED');
      return value;
    }
    function paint(){
      if(!dialog?.open)return;
      const complete=job?.state==='completed'&&job.phase==='verified',running=job&&!terminal.has(job.state),resume=job?.committed&&!complete&&!running;
      const percent=complete?100:Math.min(99,job?.progress||0);
      let content=`<p>Verbind je telefoon met het wifi-netwerk van je hoofdreceiver. Je ${root.AluvisionSecurityMode?.pinRequired===false?'inrichting':'PIN en inrichting'} blijft bij een update bewaard.</p>`;
      if(job){
        content+=`<section class="card receiver-update-progress"><h3>${escape(complete?'Bijgewerkt':phases[job.phase]||'Update controleren')}</h3><p>${escape(receiver.type)} · versie ${escape(job.toVersion)}</p><progress max="100" value="${percent}" aria-label="Voortgang van de receiverupdate"></progress><b>${percent}%</b>${complete?'<p>De juiste receiver heeft de nieuwe software na de herstart bevestigd.</p>':'<p>Laat de receiver aan en blijf op zijn wifi. Sluiten stopt de update niet.</p>'}</section>`;
        if(resume)content+='<button class="button full" data-update="resume">Herstart controleren</button>';
        if(running&&job.cancelAllowed&&!job.committed)content+='<button class="button secondary full" data-update="cancel">Update annuleren</button>';
        if(running&&error)content+='<button class="button full" data-update="status">Voortgang opnieuw controleren</button>';
        if(!running&&!resume&&!complete)content+='<button class="button full" data-update="check">Opnieuw controleren</button>';
      }else if(plan?.status==='ready'){
        content+=`<section class="card"><span class="pill">Update beschikbaar</span><h3>${escape(plan.currentVersion)} → ${escape(plan.toVersion)}</h3><p>${(plan.size/1048576).toFixed(1)} MB · ${escape(receiver.type)}</p></section><button class="button full" data-update="start">Nu bijwerken</button>`;
      }else if(plan?.status==='up-to-date')content+=`<section class="card"><h3>Je receiver is bijgewerkt</h3><p>Gecontroleerde versie: ${escape(plan.currentVersion)}</p></section>`;
      else content+='<button class="button full" data-update="check">Controleren op updates</button>';
      dialog.innerHTML=`<header><div><h2>Receiver bijwerken</h2><p>${escape(receiver.name)}</p></div><button class="icon-button" data-update="close" aria-label="Updatevenster sluiten">×</button></header>${content}<p role="alert" ${error?'':'hidden'}>${escape(error)}</p><p role="status" ${busy?'':'hidden'}>Even controleren…</p><button class="button secondary full" data-update="close">${running?'Sluiten · update gaat verder':'Terug naar receivers'}</button>`;
      dialog.querySelectorAll('[data-update]:not([data-update="close"])').forEach(button=>{button.disabled=busy;});
    }
    function schedule(){
      clearTimeout(timer);timer=null;
      if(dialog?.open&&job&&!terminal.has(job.state))timer=setTimeout(()=>perform('status'),800);
    }
    async function perform(action){
      if(busy||!dialog?.open)return;
      const token=generation;busy=true;error='';paint();
      try{
        const request={standId:receiver.standId};let value;
        if(action==='check'){
          if(typeof services.otaPlan!=='function')throw Error('UNAVAILABLE');
          value=await services.otaPlan(request);if(token!==generation)return;
          if(value?.rid!==receiver.rid||value.type!==receiver.type)throw Error('UNCONFIRMED');
          if(value.status==='pending'){job=exactJob(value.job);plan=null;}
          else {
            if(!['ready','up-to-date'].includes(value.status)||typeof value.currentVersion!=='string')throw Error('UNCONFIRMED');
            if(value.status==='ready'&&(typeof value.artifactId!=='string'||typeof value.toVersion!=='string'||!Number.isInteger(value.size)||value.size<65536))throw Error('UNCONFIRMED');
            plan=value;job=null;
          }
        }else{
          const method={start:'otaStart',status:'otaStatus',resume:'otaResume',cancel:'otaCancel'}[action];
          if(typeof services[method]!=='function')throw Error('UNAVAILABLE');
          if(action==='start'){if(plan?.status!=='ready')throw Error('UNCONFIRMED');request.artifactId=plan.artifactId;}
          else {if(!job)throw Error('UNCONFIRMED');request.jobId=job.id;}
          value=await services[method](request);if(token!==generation)return;
          const next=exactJob(value);if(action!=='start'&&next.id!==job.id)throw Error('UNCONFIRMED');job=next;
        }
      }catch(_){
        if(token!==generation)return;
        error=job?.committed?'De herstart is nog niet bevestigd. Er wordt geen nieuwe update verstuurd. Blijf op de receiver-wifi en controleer opnieuw.':'De receiverupdate kon nog niet veilig worden bevestigd. Controleer je wifi en probeer opnieuw. Er wordt niets gewist.';
        if(action==='status')clearTimeout(timer);
      }finally{
        if(token===generation){busy=false;paint();if(!error)schedule();}
      }
    }
    function open(value){
      if(!value||value.lifecycle!=='added'||value.role!=='main')throw Error('MAIN_REQUIRED');
      generation++;clearTimeout(timer);timer=null;receiver={...value};plan=null;job=null;busy=false;error='';returnFocus=document.activeElement;
      if(!dialog){dialog=document.createElement('dialog');dialog.className='receiver-update-sheet';dialog.setAttribute('aria-label','Receiver bijwerken');document.body.append(dialog);
        dialog.addEventListener('click',event=>{const button=event.target.closest('[data-update]');if(!button||button.disabled)return;button.dataset.update==='close'?close():perform(button.dataset.update);});
        dialog.addEventListener('cancel',event=>{event.preventDefault();close();});}
      dialog.showModal();paint();dialog.scrollTop=0;perform('check');
    }
    return Object.freeze({open,close});
  }
  root.LightningReceiverUpdateUI=Object.freeze({create});
})(window);
