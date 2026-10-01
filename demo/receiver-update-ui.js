/* Receiver firmware updates. Plans are read first; installation updates run
 * one receiver at a time through the native, receiver-bound OTA services. */
(function(root){
  'use strict';
  const version=value=>typeof value==='string'&&/^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(value);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function create({services={},translate,pollIntervalMs=800}={}){
    let dialog=null,entries=[],allReceivers=false,busy=false,busyKey='',generation=0,returnFocus=null;
    let activeMonitorId=null,monitorEpoch=0,success=false;
    const t=(key,params)=>typeof translate==='function'?translate(key,params):key;
    function scopedKey(key){
      if(allReceivers)return key;
      return ({softwareUpdateSubtitle:"softwareReceiverSubtitle",
        softwareUpdateSequence:"softwareReceiverSequence",softwareMainRecoveryGuidance:"softwareReceiverRecoveryGuidance",
        softwarePreflight:"softwareReceiverPreflight",softwareAllCurrent:"softwareReceiverCurrent",
        softwareUpdateFinished:"softwareReceiverUpdateFinished"})[key]||key;
    }
    const current=token=>token===generation&&dialog?.open;
    const unconfirmed=()=>Object.assign(new Error('UNCONFIRMED'),{code:'OTA_INVALID_REPLY'});
    function normalize(list){
      if(!Array.isArray(list)||!list.length||list.length>60)return null;
      const standId=list[0]?.standId,ids=new Set(),rids=new Set();
      if(typeof standId!=='string'||!standId)return null;
      const normalized=[];
      for(const receiver of list){
        if(!receiver||typeof receiver!=='object'||receiver.standId!==standId||
          typeof receiver.id!=='string'||!receiver.id||receiver.id.length>96||
          typeof receiver.rid!=='string'||!/^[A-F0-9]{16}$/.test(receiver.rid)||
          !['RGBW','SPI'].includes(receiver.type)||!['main','node'].includes(receiver.role)||
          receiver.lifecycle!=='added'||ids.has(receiver.id)||rids.has(receiver.rid))return null;
        ids.add(receiver.id);rids.add(receiver.rid);
        normalized.push({receiver:{...receiver},status:'checking',plan:null,job:null,errorCode:'',message:''});
      }
      return normalized;
    }
    function exactJob(value,entry,expected){
      if(!value||value.rid!==entry.receiver.rid||value.receiverType!==entry.receiver.type||
        typeof value.id!=='string'||!value.id||value.id.length>96||
        !['queued','running','completed','failed','cancelled'].includes(value.state)||
        !Number.isInteger(value.progress)||value.progress<0||value.progress>100||
        typeof value.phase!=='string'||typeof value.committed!=='boolean'||
        typeof value.cancelAllowed!=='boolean'||typeof value.toVersion!=='string'||!version(value.toVersion)||
        value.error!==undefined&&(typeof value.error!=='string'||value.error.length>80)||
        value.state==='completed'&&(value.phase!=='verified'||value.progress!==100||value.committed!==true)||
        expected&&(value.id!==expected.id||value.toVersion!==expected.toVersion||expected.committed&&!value.committed))throw unconfirmed();
      return value;
    }
    function exactPlan(value,entry){
      if(!value||value.rid!==entry.receiver.rid||value.type!==entry.receiver.type||
        !['ready','up-to-date','pending'].includes(value.status))throw unconfirmed();
      if(value.status==='pending')return {status:value.status,job:exactJob(value.job,entry)};
      if(!version(value.currentVersion))throw unconfirmed();
      if(value.status==='ready'&&(typeof value.artifactId!=='string'||
        !version(value.toVersion)||value.artifactId!==`${entry.receiver.type.toLowerCase()}-${value.toVersion}-local-setup`||
        !Number.isInteger(value.size)||value.size<65536||value.size>2097152))throw unconfirmed();
      return value;
    }
    function errorKey(code){
      const map={
        OTA_DIRECT_WIFI_REQUIRED:'softwareErrorConnection',NATIVE_UNAVAILABLE:'softwareErrorConnection',
        OTA_ACK_TIMEOUT:'softwareErrorAck',OTA_RECEIVER_REJECTED:'softwareErrorRejected',
        OTA_RESTART_NOT_VERIFIED:'softwareErrorRestart',OTA_ROLLBACK:'softwareErrorRollback',
        OTA_TOPOLOGY_UNSUPPORTED:'softwareErrorTopology',OTA_TOPOLOGY_UNCONFIRMED:'softwareErrorTopologyUnconfirmed',
        OTA_PROFILE:'softwareErrorTopologyUnconfirmed',NATIVE_TIMEOUT:'softwareErrorTimeout',
        OTA_JOURNAL_UNCONFIRMED:'softwareErrorStorage',
        OTA_BUSY:'softwareErrorTimeout',OTA_UNEXPECTED_OFFSET:'softwareErrorAck'
      };
      return map[code]||'softwareErrorGeneric';
    }
    function messageFor(code){return t(errorKey(code));}
    function phaseKey(job){
      const map={preflight:'softwarePreparing',arming:'softwarePreparing',uploading:'softwareSending',
        verifying:'softwareVerifying',reconnecting:'softwareRestarting',verified:'softwareReceiverUpdateFinished',
        verification_required:'softwareRestarting',interrupted:'softwareFailed',error:'softwareFailed',
        cancelled:'softwareCancelled'};
      return map[job?.phase]||'softwareChecking';
    }
    function phaseLabel(job){return t(phaseKey(job));}
    function orderedTargets(){return entries.filter(entry=>entry.status==='ready'||entry.status==='up-to-date')
      .sort((a,b)=>Number(a.receiver.role==='main')-Number(b.receiver.role==='main'));}
    function safeTitle(){return t('softwareUpdates');}
    function rowMarkup(entry){
      const receiver=entry.receiver,name=escape(receiver.name||receiver.type+' receiver');
      let status='';
      if(entry.status==='checking')status=`<small>${escape(t('softwareChecking'))}</small>`;
      else if(entry.status==='ready')status=`<small>${escape(t('softwareUpdateAvailable',{current:entry.plan.currentVersion,version:entry.plan.toVersion}))}</small>`;
      else if(entry.status==='main-recovery-ready')status=`<small>${escape(t('softwareMainRecoveryExplanation'))}</small><small>${escape(t('softwareUpdateAvailable',{current:entry.plan.currentVersion,version:entry.plan.toVersion}))}</small>`;
      else if(entry.status==='up-to-date')status=`<small>${escape(t('softwareUpToDate',{version:entry.plan.currentVersion}))}</small>`;
      else if(entry.status==='running')status=['arming','preflight'].includes(entry.job.phase)
        ?`<small>${escape(phaseLabel(entry.job))}</small><span class="update-activity"><i aria-hidden="true"></i>${escape(t('softwareConnectionChecking'))}</span>`
        :`<small>${escape(phaseLabel(entry.job))} · ${entry.job.progress}%</small><progress max="100" value="${entry.job.progress}" aria-label="${escape(phaseLabel(entry.job))}"></progress>`;
      else if(entry.status==='waiting')status=`<small>${escape(t('softwareWaiting'))}</small>`;
      else if(entry.status==='recovery')status=`<small class="update-warning" role="alert">${escape(messageFor(entry.job?.error||'OTA_RESTART_NOT_VERIFIED'))}</small>`;
      else if(entry.status==='failed'||entry.status==='uncertain'||entry.status==='offline'){
        const code=entry.errorCode||entry.job?.error||'';
        status=`<small class="update-warning" role="alert">${escape(entry.message||messageFor(code))}</small>`;
      }else if(entry.status==='cancelled')status=`<small>${escape(t('softwareCancelled'))}</small>`;
      else if(entry.status==='complete')status=`<small>${escape(t('softwareUpToDate',{version:entry.job.toVersion}))}</small>`;
      let action='';
      if(!busy&&entry.status==='recovery')action=`<button class="text-button" data-update="resume" data-id="${escape(receiver.id)}">${escape(t('softwareResumeCheck'))}</button>`;
      else if(!busy&&entry.status==='main-recovery-ready')action=`<button class="button full" data-update="repair-start" data-id="${escape(receiver.id)}">${escape(t('softwareMainRecoveryStart'))}</button>`;
      else if(!busy&&entry.status==='offline'&&entry.errorCode==='OTA_TOPOLOGY_UNCONFIRMED'&&receiver.role==='main'&&typeof services.otaMainRecoveryPlan==='function')action=`<button class="button secondary full" data-update="repair-check" data-id="${escape(receiver.id)}">${escape(t('softwareMainRecoveryCheck'))}</button>`;
      else if(!busy&&!entry.cancelling&&entry.status==='running'&&entry.job?.cancelAllowed&&!entry.job?.committed)action=`<button class="text-button" data-update="cancel" data-id="${escape(receiver.id)}">${escape(t('softwareCancel'))}</button>`;
      return `<section class="card receiver-update-progress" data-update-row="${escape(receiver.id)}" data-state="${entry.status}"><div class="update-receiver-copy"><b>${name}</b><small>${escape(receiver.type)}</small>${status}</div>${action}</section>`;
    }
    function paint(){
      if(!dialog?.open)return;
      const allChecked=entries.length>0&&entries.every(entry=>['ready','up-to-date'].includes(entry.status));
      const readyCount=entries.filter(entry=>entry.status==='ready').length;
      const needsCheck=entries.some(entry=>['failed','uncertain','offline','cancelled'].includes(entry.status));
      const hasRecovery=entries.some(entry=>entry.status==='recovery');
      const hasRunning=entries.some(entry=>entry.status==='running');
      let controls='';
      if(!busy&&allChecked&&readyCount>0){
        controls=`<button class="button full" data-update="all">${escape(allReceivers?t('softwareUpdateMany',{count:readyCount}):t('softwareUpdateOne'))}</button>`;
      }else if(!busy&&allChecked&&readyCount===0){
        controls=`<p class="update-all-current" role="status">${escape(t(scopedKey(success?'softwareUpdateFinished':'softwareAllCurrent')))}</p>`;
      }else if(!busy&&!hasRecovery&&!hasRunning&&needsCheck){
        controls=`<button class="button full" data-update="check">${escape(t('softwareCheckAgain'))}</button>`;
      }
      // Keep the dialog shell and scroll container mounted while polling.
      // Replacing the entire dialog every 800 ms loses focus and list position.
      if(!dialog.firstElementChild)dialog.innerHTML=`<header><div><h2>${escape(safeTitle())}</h2><p>${escape(t(scopedKey('softwareUpdateSubtitle')))}</p></div><button class="icon-button" data-update="close" aria-label="${escape(t('close'))}">×</button></header><p class="update-guidance">${escape(t('softwareUpdateKeepOpen'))} ${escape(t(scopedKey('softwareUpdateSequence')))}</p><div class="update-receiver-list"></div><div class="update-controls"></div><p class="update-run-status" role="status" aria-live="polite" hidden></p><button class="button secondary full" data-update="close">${escape(t('close'))}</button>`;
      const list=dialog.querySelector('.update-receiver-list'),footer=dialog.querySelector('.update-controls');
      dialog.querySelector('.update-guidance').textContent=t('softwareUpdateKeepOpen')+' '+t(scopedKey(entries.some(entry=>entry.mainRecovery)?'softwareMainRecoveryGuidance':'softwareUpdateSequence'));
      const focused=document.activeElement,focusAction=focused?.dataset?.update,focusId=focused?.dataset?.id;
      const listTop=list.scrollTop,dialogTop=dialog.scrollTop;
      const rows=entries.map(rowMarkup).join('');
      if(list.innerHTML!==rows)list.innerHTML=rows;
      if(footer.innerHTML!==controls)footer.innerHTML=controls;
      if(focusAction&&!focused.isConnected){
        const replacement=[...dialog.querySelectorAll('[data-update]')].find(button=>button.dataset.update===focusAction&&button.dataset.id===focusId);
        (replacement||dialog.querySelector('[data-update="close"]'))?.focus({preventScroll:true});
      }
      list.scrollTop=listTop;dialog.scrollTop=dialogTop;
      const statusLine=dialog.querySelector('.update-run-status');
      statusLine.hidden=!busy;
      const statusText=busy?t(scopedKey(busyKey||'softwarePreflight')):'';
      if(statusLine.textContent!==statusText)statusLine.textContent=statusText;
      dialog.querySelectorAll('[data-update]:not([data-update="close"])').forEach(button=>{button.disabled=busy;});
    }
    function close(){generation++;monitorEpoch++;activeMonitorId=null;dialog?.close();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});}
    async function refreshPlans(token){
      success=false;
      for(const entry of entries){entry.plan=null;entry.job=null;entry.cancelling=false;entry.mainRecovery=false;entry.errorCode='';entry.message='';entry.status='checking';}
      paint();
      const order=[...entries].sort((a,b)=>Number(a.receiver.role==='main')-Number(b.receiver.role==='main'));
      for(let index=0;index<order.length;index++){
        const entry=order[index];if(token!==generation)return;
        try{
          if(typeof services.otaPlan!=='function')throw Object.assign(new Error('UNAVAILABLE'),{code:'NATIVE_UNAVAILABLE'});
          const reply=await services.otaPlan({standId:entry.receiver.standId,receiverId:entry.receiver.id});
          if(!current(token))return;
          const result=exactPlan(reply,entry);
          entry.plan=result;
          if(result.status==='pending'){
            entry.job=result.job;
            if(result.job.state==='running'||result.job.state==='queued')entry.status='running';
            else if(result.job.committed&&result.job.state!=='completed')entry.status='recovery';
            else entry.status='failed';
          }else entry.status=result.status;
        }catch(error){if(!current(token))return;entry.status='offline';entry.errorCode=error?.code||'NATIVE_UNAVAILABLE';entry.message=messageFor(entry.errorCode);}
        if(['running','recovery','failed'].includes(entry.status)){
          for(const remaining of order.slice(index+1))remaining.status='waiting';
          paint();return;
        }
        paint();
      }
    }
    function pause(){return new Promise(resolve=>setTimeout(resolve,Math.max(0,pollIntervalMs)));}
    function terminalState(entry,job){
      entry.job=job;
      if(job.state==='completed'&&job.phase==='verified'&&job.progress===100){entry.status='complete';entry.errorCode='';entry.message='';return true;}
      if(job.state==='cancelled'){entry.status='cancelled';entry.errorCode='';entry.message='';return false;}
      if(job.state==='failed'){
        entry.status=job.committed?'recovery':'failed';entry.errorCode=job.error||'';
        entry.message=messageFor(job.error||'OTA_RECEIVER_REJECTED');return false;
      }
      entry.status='running';return null;
    }
    async function monitorJob(entry,token,{batchOwned=false}={}){
      if(!entry.job)return false;
      const epoch=++monitorEpoch;
      const monitoring=()=>current(token)&&epoch===monitorEpoch;
      let job=entry.job;
      while(monitoring()){
        const finished=terminalState(entry,job);if(batchOwned)busyKey=phaseKey(job);paint();
        if(finished!==null)return finished;
        if(!batchOwned){busyKey='softwareSending';paint();}
        await pause();if(!monitoring())return false;
        try{
          const reply=await services.otaStatus({standId:entry.receiver.standId,receiverId:entry.receiver.id,jobId:job.id});
          if(!monitoring())return false;
          job=exactJob(reply,entry,job);
        }catch(error){
          if(!monitoring())return false;
          entry.status=job.committed?'recovery':'uncertain';entry.errorCode=error?.code||'NATIVE_TIMEOUT';
          entry.message=job.committed?messageFor('OTA_RESTART_NOT_VERIFIED'):messageFor(entry.errorCode);
          paint();return false;
        }
        if(batchOwned)busyKey='softwareSending';
      }
      return false;
    }
    async function monitorPending(entry,token){
      if(activeMonitorId||entry.status!=='running'||!entry.job)return;
      activeMonitorId=entry.receiver.id;busy=false;busyKey='';paint();
      const promise=monitorJob(entry,token,{batchOwned:false}),epoch=monitorEpoch;
      const completed=await promise;
      if(!current(token)||epoch!==monitorEpoch)return;
      activeMonitorId=null;
      if(completed){
        busy=true;busyKey='softwarePreflight';paint();
        await refreshPlans(token);
        if(token!==generation)return;
        busy=false;busyKey='';paint();
        const another=entries.find(item=>item.status==='running');if(another)void monitorPending(another,token);
      }else{busy=false;busyKey='';paint();}
    }
    async function check(){
      if(busy)return;const token=generation;busy=true;busyKey='softwarePreflight';paint();
      await refreshPlans(token);if(token!==generation)return;
      busy=false;busyKey='';paint();
      const pending=entries.find(entry=>entry.status==='running');if(pending)void monitorPending(pending,token);
    }
    async function updateAll(){
      if(busy)return;const token=generation;busy=true;busyKey='softwarePreflight';paint();
      await refreshPlans(token);if(token!==generation)return;
      const allReady=entries.length&&entries.every(entry=>['ready','up-to-date'].includes(entry.status));
      if(!allReady){busy=false;busyKey='';paint();const pending=entries.find(entry=>entry.status==='running');if(pending)void monitorPending(pending,token);return;}
      const queue=orderedTargets().filter(entry=>entry.status==='ready');
      if(!queue.length){busy=false;busyKey='';success=true;paint();return;}
      for(let index=0;index<queue.length;index++){
        if(token!==generation||!dialog?.open)return;
        const entry=queue[index];busyKey='softwarePreparing';entry.status='running';entry.job={id:'',rid:entry.receiver.rid,receiverType:entry.receiver.type,toVersion:entry.plan.toVersion,state:'queued',phase:'arming',progress:1,committed:false,cancelAllowed:false};
        busyKey='softwarePreflight';paint();
        try{
          if(typeof services.otaStart!=='function')throw Object.assign(new Error('UNAVAILABLE'),{code:'NATIVE_UNAVAILABLE'});
          const reply=await services.otaStart({standId:entry.receiver.standId,receiverId:entry.receiver.id,artifactId:entry.plan.artifactId});
          if(!current(token))return;
          entry.job=exactJob(reply,entry);
          if(entry.job.toVersion!==entry.plan.toVersion)throw unconfirmed();
        }catch(error){if(!current(token))return;entry.status='uncertain';entry.errorCode=error?.code||'NATIVE_TIMEOUT';entry.message=messageFor(entry.errorCode);paint();break;}
        busyKey='softwareSending';paint();
        const completed=await monitorJob(entry,token,{batchOwned:true});
        if(token!==generation||!dialog?.open)return;
        if(!completed)break;
      }
      if(token!==generation||!dialog?.open)return;
      const stopped=entries.some(entry=>['failed','uncertain','recovery','cancelled'].includes(entry.status));
      if(!stopped){busyKey='softwarePreflight';paint();await refreshPlans(token);if(token!==generation)return;success=entries.length>0&&entries.every(entry=>entry.status==='up-to-date');}
      busy=false;busyKey='';paint();
    }
    async function resume(receiverId){
      if(busy)return;const entry=entries.find(item=>item.receiver.id===receiverId);if(!entry?.job||entry.status!=='recovery')return;
      const token=generation;busy=true;busyKey='softwareRestarting';paint();
      try{
        const reply=await services.otaResume({standId:entry.receiver.standId,receiverId:entry.receiver.id,jobId:entry.job.id});
        if(!current(token))return;
        entry.job=exactJob(reply,entry,entry.job);
        if(entry.job.state==='completed')entry.status='complete';else entry.status='running';
        paint();const complete=await monitorJob(entry,token,{batchOwned:true});
        if(token!==generation)return;
        if(complete){busyKey='softwarePreflight';await refreshPlans(token);if(!current(token))return;success=entries.every(item=>item.status==='up-to-date');}
      }catch(error){if(!current(token))return;entry.status='recovery';entry.errorCode=error?.code||'OTA_RESTART_NOT_VERIFIED';entry.message=messageFor(entry.errorCode);}
      if(token!==generation)return;busy=false;busyKey='';paint();
    }
    async function recoverMain(receiverId,start=false){
      if(busy||activeMonitorId)return;
      const entry=entries.find(item=>item.receiver.id===receiverId);
      if(!entry||entry.receiver.role!=='main'||
        (start?entry.status!=='main-recovery-ready':entry.status!=='offline'||entry.errorCode!=='OTA_TOPOLOGY_UNCONFIRMED'))return;
      const token=generation,previous=entry.plan;
      busy=true;busyKey='softwarePreflight';entry.mainRecovery=true;paint();
      try{
        // This is a distinct native read-only recovery plan, not a fallback
        // to arbitrary firmware or an assumption that the mesh is healthy.
        const plan=exactPlan(await services.otaMainRecoveryPlan({standId:entry.receiver.standId,receiverId}),entry);
        if(!current(token))return;
        if(plan.mode!=='main-recovery'||plan.status!=='ready'||start&&
          (plan.artifactId!==previous?.artifactId||plan.toVersion!==previous?.toVersion))throw unconfirmed();
        entry.plan=plan;entry.status='main-recovery-ready';entry.errorCode='';entry.message='';
        if(start){
          if(typeof services.otaMainRecoveryStart!=='function')throw unconfirmed();
          entry.job=exactJob(await services.otaMainRecoveryStart({standId:entry.receiver.standId,receiverId,artifactId:plan.artifactId}),entry);
          if(!current(token))return;
          if(entry.job.toVersion!==plan.toVersion)throw unconfirmed();
          entry.status='running';busyKey='softwareSending';paint();
          const complete=await monitorJob(entry,token,{batchOwned:true});
          if(!current(token))return;
          // Re-check the network; never automatically continue to a NODE.
          if(complete){busyKey='softwarePreflight';await refreshPlans(token);}
        }
      }catch(error){
        if(!current(token))return;
        entry.status=entry.job?.committed?'recovery':'uncertain';entry.errorCode=error?.code||'OTA_INVALID_REPLY';entry.message=messageFor(entry.errorCode);
      }
      if(!current(token))return;busy=false;busyKey='';paint();
    }
    async function cancel(receiverId){
      if(busy)return;const entry=entries.find(item=>item.receiver.id===receiverId);if(!entry?.job||!entry.job.cancelAllowed||entry.job.committed)return;
      const token=generation;monitorEpoch++;activeMonitorId=null;entry.cancelling=true;busy=true;busyKey='softwareCancelling';paint();
      try{
        const reply=await services.otaCancel({standId:entry.receiver.standId,receiverId:entry.receiver.id,jobId:entry.job.id});
        if(!current(token))return;
        entry.job=exactJob(reply,entry,entry.job);terminalState(entry,entry.job);
      }catch(error){if(!current(token))return;entry.status='uncertain';entry.errorCode=error?.code||'NATIVE_TIMEOUT';entry.message=messageFor(entry.errorCode);}
      if(token!==generation)return;busy=false;busyKey='';paint();
      if(entry.status==='running')void monitorPending(entry,token);
    }
    function openList(value,scopeAll){
      const normalized=normalize(Array.isArray(value)?value:[value]);if(!normalized)return false;
      generation++;monitorEpoch++;activeMonitorId=null;entries=normalized;allReceivers=scopeAll;
      busy=true;busyKey='softwarePreflight';success=false;returnFocus=document.activeElement;
      if(!dialog){dialog=document.createElement('dialog');dialog.className='receiver-update-sheet';dialog.setAttribute('aria-label',t('softwareUpdates'));
        document.body.append(dialog);
        dialog.addEventListener('click',event=>{
          const button=event.target.closest('[data-update]');if(!button||button.disabled)return;
          const action=button.dataset.update;
          if(action==='close')close();else if(action==='all')void updateAll();else if(action==='check')void check();
          else if(action==='repair-check')void recoverMain(button.dataset.id);else if(action==='repair-start')void recoverMain(button.dataset.id,true);
          else if(action==='resume')void resume(button.dataset.id);else if(action==='cancel')void cancel(button.dataset.id);
        });
        dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
      }
      dialog.replaceChildren();dialog.showModal();paint();dialog.scrollTop=0;
      const token=generation;
      void refreshPlans(token).then(()=>{
        if(token!==generation||!dialog?.open)return;
        busy=false;busyKey='';paint();
        const pending=entries.find(entry=>entry.status==='running');if(pending)void monitorPending(pending,token);
      });
      return true;
    }
    return Object.freeze({open:receiver=>openList(receiver,false),openAll:receivers=>openList(receivers,true),close});
  }
  root.LightningReceiverUpdateUI=Object.freeze({create});
})(window);
