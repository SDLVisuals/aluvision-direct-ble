/* Shared SPI setup presentation. This module edits copies only. It does not
 * send calibration commands, claim a receiver, change membership or persist.
 * A composition root must explicitly supply onSave and verify hardware there.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningPixelSetup=api;}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MIN=0,MAX=1024,DEFAULT_PIXELS_PER_METER=26,MAX_METERS=6.3,copy=value=>JSON.parse(JSON.stringify(value));
  let previewSerial=0;
  function previewId(){
    // A non-secret operation ID, also usable in non-secure local UI previews.
    const bytes=globalThis.crypto?.getRandomValues?.(new Uint8Array(16));
    return 'pixels-'+(bytes?Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''):Date.now().toString(36)+'-'+(++previewSerial));
  }
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validPixels=value=>Number.isInteger(value)&&value>=1&&value<=MAX;
  // The stored/protocol range remains 1..1024. Length limits apply only to this
  // product's editing flow: merely opening an older configuration changes none
  // of its geometry. Density is explicit so a different strip can use its own.
  function pixelLimits({pixelsPerMeter=DEFAULT_PIXELS_PER_METER}={}){
    if(!Number.isFinite(pixelsPerMeter)||pixelsPerMeter<1||pixelsPerMeter>MAX)throw Error('PIXEL_DENSITY_INVALID');
    return Object.freeze({min:MIN,max:Math.min(MAX,Math.floor(pixelsPerMeter*MAX_METERS)),pixelsPerMeter,maxMeters:MAX_METERS});
  }
  function editablePixels(value,options){const limits=pixelLimits(options);return Number.isInteger(value)&&value>=MIN&&value<=limits.max;}
  function configuredPixels(value,options){return value>0&&editablePixels(value,options);}
  function stepPixels(value,delta,options){const limits=pixelLimits(options);if(!(value===0||validPixels(value))||!Number.isInteger(delta))throw Error('PIXEL_STEP_INVALID');return Math.max(limits.min,Math.min(limits.max,value+delta));}
  function meterLabel(value,options){const limits=pixelLimits(options);return `≈ ${(value/limits.pixelsPerMeter).toLocaleString('nl-BE',{maximumFractionDigits:2,minimumFractionDigits:2})} m`;}
  const endpointLabel=output=>output.reversed?'Stroom komt rechts binnen':'Stroom komt links binnen';
  // The supplied LED-line uses a round plug and a flexible lead into the end
  // of a broad diffuser profile, not a receiver box attached to exposed LEDs.
  const cableIcon='<svg viewBox="0 0 64 32" aria-hidden="true"><path class="pixel-lead-wire" d="M25 15C35 15 35 27 46 27S57 17 64 17"/><path class="pixel-lead-plug" d="M4 7H18L24 10V20L18 23H4Z"/><path d="M5 8V22M9 8V22M13 8V22M17 8V22M24 12H28V18H24"/></svg>';
  function outputsOf(receiver){
    if(!receiver||receiver.type!=='SPI'||typeof receiver.id!=='string'||!Array.isArray(receiver.outputs)||receiver.outputs.length!==4)throw Error('SPI_RECEIVER_REQUIRED');
    const outputs=receiver.outputs.map(output=>({port:output.port,enabled:output.enabled,pixels:output.pixels,reversed:output.reversed})).sort((a,b)=>a.port-b.port);
    if(outputs.some((output,i)=>output.port!==i+1||typeof output.enabled!=='boolean'||typeof output.reversed!=='boolean'||!validPixels(output.pixels)))throw Error('SPI_OUTPUTS_INVALID');
    return outputs;
  }
  function sequence(outputs){const ports=outputs.filter(output=>output.enabled).map(output=>output.port);return [{stage:'outputs',port:null},...ports.flatMap(port=>[{stage:'pixels',port},{stage:'connection',port}]),{stage:'review',port:null}];}
  function renderProgress(stage){const position={outputs:0,pixels:1,connection:2,review:3}[stage];return `<ol class="pixel-setup-steps" aria-label="LED-line instellen">${['Uitgangen','Pixels','Stroomkant','Controleren'].map((name,index)=>`<li ${index===position?'aria-current="step"':''}><span>${index<position?'✓':index+1}</span>${name}</li>`).join('')}</ol>`;}
  function renderPortContext(outputs,port,{stage='pixels'}={}){
    const active=outputs.filter(item=>item.enabled),position=active.findIndex(item=>item.port===port),task=stage==='connection'?'stroomkant':'pixels instellen';
    return `<section class="pixel-port-context" data-current-port="${port}" aria-label="Poort ${port} · ${task}"><canvas data-pixel-port-visual role="img" aria-label="SPI-receiver · je stelt poort ${port} in, rood aangeduid" width="180" height="200"></canvas><div class="pixel-port-context-info"><h2>Poort ${port} · ${task}</h2><p>${position+1} van ${active.length} poorten</p><ol aria-label="Voortgang per poort">${outputs.map(item=>{const state=!item.enabled?'off':item.port===port?'current':item.port<port?'complete':'pending',label={off:'Uit',current:'Nu',complete:'Klaar',pending:'Straks'}[state];return `<li class="pixel-port-step" data-port="${item.port}" data-state="${state}" ${state==='current'?'aria-current="step"':''} aria-label="Poort ${item.port}: ${label}"><b>${item.port}</b><span>${label}</span></li>`;}).join('')}</ol></div></section>`;
  }
  function nextPortLabel(outputs,port,{stage='pixels',last='Volgende'}={}){
    if(stage==='pixels')return 'Verder · stroomkant →';
    const next=outputs.find(item=>item.enabled&&item.port>port);
    return next?`Verder naar poort ${next.port} →`:last;
  }
  function strip(output,stage,options){
    const count=Math.min(24,output.pixels),reversed=stage==='connection'&&output.reversed;
    if(stage==='pixels')return `<div class="pixel-setup-visual pixel-count-preview" data-pixel-visual="pixels" data-preview-pixels="${output.pixels}" role="img" aria-label="Ingesteld: ${output.pixels} ${output.pixels===1?'pixel':'pixels'}. Schematisch aantal, geen gemeten striplengte."><div class="pixel-count-preview-label"><b>${output.pixels} ${output.pixels===1?'pixel':'pixels'}</b><span>↔ Veeg om aan te passen</span></div><span class="pixel-setup-track"><span class="pixel-setup-strip">${Array.from({length:count},()=>'<i></i>').join('')}</span>${output.pixels>24?'<span class="pixel-count-more" aria-hidden="true">···</span>':''}</span><small class="pixel-preview-notice">Voorbeeld · geen testlicht</small></div>`;
    // The customer identifies the incoming cable in the installed view.
    // Right-side input reverses physical pixel order once; it is not a separate
    // animation-direction choice. Keep the cable and its marker together.
    const cableLabel='<span class="pixel-cable-label"><i></i>Stroom in</span>',otherEnd='<span></span>';
    return `<div class="pixel-setup-visual pixel-connection-preview" data-pixel-visual="connection" data-side="${reversed?'right':'left'}" data-preview-pixels="${output.pixels}" data-ledline-reference="supplied-spi-profile" role="img" aria-label="${endpointLabel(output)}. LED-line met breed profiel, diffuser en aansluitkabel. De groene aansluiting is altijd bij de kabel. Schematisch, geen fysieke lichttest."><div class="pixel-setup-reference" aria-hidden="true"><span>Links</span><span>Rechts</span></div><div class="pixel-cable-line"><span class="pixel-cable-source" aria-hidden="true">${cableIcon}</span><span class="pixel-setup-track"><span class="pixel-setup-strip pixel-ledline-profile"><i class="start"></i></span></span></div><div class="pixel-setup-endpoint-labels">${reversed?otherEnd+cableLabel:cableLabel+otherEnd}</div></div>`;
  }
  function renderOutputs(outputs,{onboarding=false,initialPort=null}={}){
    const attr=onboarding?'data-onboarding-action':'data-pixel-action';
    const active=outputs.filter(item=>item.enabled).map(item=>`P${item.port}`),summary=active.length?`${active.join(' + ')} aan · ${active.length} van 4 uitgangen`:'Alle uitgangen uit';
    return `<div class="pixel-output-picker"><canvas data-pixel-outputs-visual role="img" aria-label="SPI-receiver · ${summary}" width="400" height="200"></canvas><div class="pixel-setup-outputs" role="group" aria-label="Uitgangen aan of uit">${outputs.map(item=>`<button type="button" ${attr}="output" data-port="${item.port}" role="switch" aria-checked="${item.enabled}" aria-label="Uitgang ${item.port}" ${item.port===initialPort?'data-requested-port="true"':''}><b>P${item.port}</b><span>${item.enabled?'Aan':'Uit'}</span><i class="pixel-setup-switch" aria-hidden="true"><i></i></i></button>`).join('')}</div><p class="pixel-output-summary">${summary}</p><small class="pixel-preview-notice">Voorbeeld · geen testlicht</small></div>`;
  }
  function paintOutputs(container,outputs,{time=0,reducedMotion=false,entranceProgress=1,selectedPort=null,plugProgress={},visual=globalThis.LightningReceiverVisual}={}){
    if(!container||container.ownerDocument?.hidden||typeof visual?.draw!=='function')return;
    container.querySelectorAll('[data-pixel-outputs-visual],[data-pixel-port-visual]').forEach(canvas=>{
      const rect=canvas.getBoundingClientRect(),body=canvas.closest('.pixel-setup-body')?.getBoundingClientRect();
      if(!rect.width||!rect.height||rect.bottom<0||rect.top>innerHeight||body&&(rect.bottom<body.top||rect.top>body.bottom))return;
      const metadata=visual.draw(canvas,{type:'SPI',enabledPorts:outputs.filter(item=>item.enabled).map(item=>item.port),selectedPort,plugProgress,compact:false,time,reducedMotion,entranceProgress});
      canvas.dataset.activePorts=metadata.activePorts.join(',');canvas.dataset.portLabelsVisible=String(metadata.portLabelsVisible===true);
      canvas.dataset.selectedPort=String(metadata.selectedPort||'');canvas.dataset.plugProgress=JSON.stringify(plugProgress);
    });
  }
  function renderPixels(output,{inputId='pixel-setup-number',onboarding=false,pixelsPerMeter=DEFAULT_PIXELS_PER_METER,combined=false}={}){
    const attr=onboarding?'data-onboarding-action':'data-pixel-action',limits=pixelLimits({pixelsPerMeter}),valid=editablePixels(output.pixels,limits);
    return `<section class="pixel-setup-panel" data-pixel-panel="pixels" data-combined="${combined}" data-pixels-per-meter="${pixelsPerMeter}"><h2>Lengte van je ledline</h2><div data-pixel-preview data-pixel-scrub role="slider" tabindex="0" aria-label="Aantal pixels op poort ${output.port}; veeg links of rechts" aria-valuemin="${limits.min}" aria-valuemax="${limits.max}" aria-valuenow="${output.pixels}" aria-valuetext="${output.pixels} pixels, handmatig ingesteld">${strip(output,combined?'connection':'pixels',limits)}</div>${combined?'<small class="pixel-scrub-hint">↔ Veeg voor de lengte · voorbeeld, geen testlicht</small>':''}<div class="pixel-setup-meter-counter"><button type="button" ${attr}="meter-less" aria-label="Eén meter minder" ${output.pixels===MIN?'disabled':''}>− 1 meter</button><output data-pixel-meters>${meterLabel(output.pixels,limits)}</output><button type="button" ${attr}="meter-more" aria-label="Eén meter meer" ${output.pixels>=limits.max?'disabled':''}>＋ 1 meter</button></div><div class="pixel-setup-counter"><button type="button" ${attr}="pixel-less" aria-label="Eén pixel minder" ${output.pixels===MIN?'disabled':''}>−</button><label for="${esc(inputId)}"><input id="${esc(inputId)}" data-pixel-count type="number" inputmode="numeric" min="${limits.min}" max="${limits.max}" step="1" value="${output.pixels}" aria-invalid="${!valid}" aria-label="Aantal pixels op uitgang ${output.port}" aria-describedby="${esc(inputId)}-error"><span>pixels · exact aantal</span></label><button type="button" ${attr}="pixel-more" aria-label="Eén pixel meer" ${output.pixels>=limits.max?'disabled':''}>＋</button></div><p id="${esc(inputId)}-error" data-pixel-error class="pixel-setup-error" role="alert" ${valid?'hidden':''}>Maximaal 6,3 meter per strip. Kies 0 tot ${limits.max} pixels (${pixelsPerMeter} pixels/m).</p><p class="pixel-zero-hint" data-pixel-empty ${output.pixels===0?'':'hidden'}>Stel de lengte in om verder te gaan.</p><p class="pixel-meaning">Een pixel is één apart regelbaar stukje licht.</p><details class="pixel-setup-more"><summary>Lengte bepalen · max. 6,3 m</summary><p>Neem het aantal van je LED-line over of tel de pixels. De app meet de lengte niet automatisch. De meterwaarde is een schatting op basis van ${pixelsPerMeter} pixels per meter; het voorbeeld is geen fysieke lichttest.</p></details></section>`;
  }
  function renderSide(output,{onboarding=false,combined=false}={}){
    const attr=onboarding?'data-onboarding-action':'data-pixel-action';
    const choice=`${cableIcon}<span class="pixel-feed-mini-line"></span>`;
    return `<section class="pixel-setup-panel" data-pixel-panel="connection"><h2>Aan welke kant komt de stroom binnen?</h2>${combined?'':`<p>Kijk waar de kabel van deze receiver je LED-line ingaat.</p><small class="pixel-preview-notice">Voorbeeld · geen testlicht</small>${strip(output,'connection')}`}<div class="pixel-setup-sides" role="group" aria-label="Kant waar de stroom binnenkomt"><button type="button" ${attr}="side" data-side="left" aria-pressed="${!output.reversed}"><span class="pixel-feed-choice" aria-hidden="true">${choice}</span><span>Links</span></button><button type="button" ${attr}="side" data-side="right" aria-pressed="${output.reversed}"><span class="pixel-feed-choice" aria-hidden="true">${choice}</span><span>Rechts</span></button></div><details class="pixel-setup-more"><summary>Waarom dit kiezen?</summary><p>Bekijk de LED-line zoals ze in je opstelling ligt. Kies de kant waar de kabel van deze receiver binnenkomt. Zo houdt de app rekening met de aansluiting wanneer lijnen samen bewegen. Je hoeft niets om te steken. Groen toont alleen de aansluiting in het voorbeeld, geen testlicht. De animatierichting kies je later.</p></details></section>`;
  }
  function renderPort(output,options={}){return `<div class="pixel-combined-port">${renderPixels(output,{...options,combined:true})}${renderSide(output,{...options,combined:true})}</div>`;}
  function updatePixels(container,output,{source,pixelsPerMeter}={}){
    const panel=container.querySelector('[data-pixel-panel="pixels"]');if(!panel)return;
    const limits=pixelLimits({pixelsPerMeter:pixelsPerMeter??(Number(panel.dataset.pixelsPerMeter)||DEFAULT_PIXELS_PER_METER)});
    const input=panel.querySelector('[data-pixel-count]'),range=panel.querySelector('[data-pixel-range]');
    if(input!==source)input.value=String(output.pixels);if(range&&range!==source)range.value=String(output.pixels);
    input.setAttribute('aria-invalid',String(!editablePixels(output.pixels,limits)));panel.querySelector('[data-pixel-error]').hidden=editablePixels(output.pixels,limits);
    const preview=panel.querySelector('[data-pixel-preview]');
    preview.setAttribute('aria-valuenow',String(output.pixels));preview.setAttribute('aria-valuetext',`${output.pixels} pixels, handmatig ingesteld`);
    preview.innerHTML=strip(output,panel.dataset.combined==='true'?'connection':'pixels',limits);
    panel.querySelector('[data-pixel-meters]').textContent=meterLabel(output.pixels,limits);
    panel.querySelector('[data-pixel-empty]').hidden=output.pixels!==0;
    panel.querySelector('[aria-label="Eén pixel minder"]').disabled=output.pixels===MIN;panel.querySelector('[aria-label="Eén pixel meer"]').disabled=output.pixels>=limits.max;
    panel.querySelector('[aria-label="Eén meter minder"]').disabled=output.pixels===MIN;panel.querySelector('[aria-label="Eén meter meer"]').disabled=output.pixels>=limits.max;
  }
  function validateInput(container,value,{pixelsPerMeter}={}){const panel=container.querySelector('[data-pixel-panel="pixels"]'),limits=pixelLimits({pixelsPerMeter:pixelsPerMeter??(Number(panel?.dataset.pixelsPerMeter)||DEFAULT_PIXELS_PER_METER)}),valid=editablePixels(Number(value),limits)&&String(value).trim()!=='';if(panel){panel.querySelector('[data-pixel-count]').setAttribute('aria-invalid',String(!valid));panel.querySelector('[data-pixel-error]').hidden=valid;}return valid;}
  // Relative scrubbing avoids a jump to an arbitrary absolute value on touch.
  // Capture the stable wrapper, not the preview children replaced on updates.
  // Vertical gestures stay native scrolling; edits remain owned by the host.
  function bindPixelScrub(container,{onChange,isEnabled=()=>true}={}){
    if(typeof onChange!=='function')throw Error('PIXEL_SCRUB_HANDLER_REQUIRED');
    let gesture=null;
    const target=event=>event.target.closest?.('[data-pixel-scrub]');
    const available=element=>element&&element.isConnected&&container.contains(element)&&isEnabled();
    function end(){
      const previous=gesture;gesture=null;if(!previous)return;
      previous.element.removeAttribute('data-scrubbing');
      if(previous.element.hasPointerCapture?.(previous.id))previous.element.releasePointerCapture(previous.id);
    }
    function change(element,value){
      const min=Number(element.getAttribute('aria-valuemin')),max=Number(element.getAttribute('aria-valuemax'));
      const next=Math.max(min,Math.min(max,Math.round(value)));
      if(Number.isFinite(next)&&next!==Number(element.getAttribute('aria-valuenow')))onChange(next);
      return next;
    }
    function down(event){
      if(event.isPrimary===false||event.button!==0)return;
      const element=target(event);if(!available(element))return;end();
      gesture={element,id:event.pointerId,x:event.clientX,y:event.clientY,value:Number(element.getAttribute('aria-valuenow')),dragging:false};
      element.setPointerCapture?.(event.pointerId);
    }
    function move(event){
      if(!gesture||gesture.id!==event.pointerId)return;
      if(!available(gesture.element))return end();
      const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
      if(!gesture.dragging){
        if(Math.max(Math.abs(dx),Math.abs(dy))<6)return;
        if(Math.abs(dy)>=Math.abs(dx))return end();
        gesture.dragging=true;gesture.element.dataset.scrubbing='true';gesture.element.focus({preventScroll:true});
      }
      if(event.cancelable)event.preventDefault();
      const proposed=gesture.value+Math.round(dx/6),next=change(gesture.element,proposed);
      // At an end stop, allow an immediate change back in the other direction.
      if(next!==proposed){gesture.x=event.clientX;gesture.value=next;}
    }
    function finish(event){if(gesture?.id===event.pointerId)end();}
    function keydown(event){
      const element=target(event);if(!available(element)||event.altKey||event.ctrlKey||event.metaKey)return;
      const value=Number(element.getAttribute('aria-valuenow'));
      const choices={ArrowRight:value+1,ArrowUp:value+1,ArrowLeft:value-1,ArrowDown:value-1,PageUp:value+10,PageDown:value-10,Home:Number(element.getAttribute('aria-valuemin')),End:Number(element.getAttribute('aria-valuemax'))};
      if(!Object.hasOwn(choices,event.key))return;event.preventDefault();end();change(element,choices[event.key]);
    }
    const handlers={pointerdown:down,pointermove:move,pointerup:finish,pointercancel:finish,lostpointercapture:finish,keydown};
    for(const [name,handler] of Object.entries(handlers))container.addEventListener(name,handler);
    return ()=>{end();for(const [name,handler] of Object.entries(handlers))container.removeEventListener(name,handler);};
  }
  // One bounded latest-wins test-light queue. There is never a CONFIG/SAVE
  // command here. A lost reply remains an error, not a physical-light claim.
  function createLivePreview({send,onState=()=>{},delay=170,setTimer=setTimeout,clearTimer=clearTimeout}={}){
    let queued=null,active=null,desired=null,running=null,timer=null,renew=null,version=0;
    const key=r=>JSON.stringify([r.standId,r.transactionId,r.receiver,r.role,r.mainReceiverId,r.port]);
    const report=(kind,request)=>onState({kind,port:request?.port,pixels:request?.pixels});
    function cancelTimers(){clearTimer(timer);clearTimer(renew);timer=renew=null;}
    async function stopActive(){
      if(!active)return;const previous=active;
      const answer=await send({...previous,action:'stop'});
      if(answer?.applied!==true||answer.port!==previous.port||answer.previewTTLMS!==0)throw Error('PIXEL_STOP_UNCONFIRMED');
      active=null;
    }
    function drain(){
      if(running)return running;
      clearTimer(timer);timer=null;
      running=(async()=>{
        while(queued){
          const item=queued;queued=null;
          try{
            if(item.stop){await stopActive();if(!desired)report('idle');continue;}
            const request=item.request;
            if(active&&key(active)!==key(request))await stopActive();
            const action=active?'update':'start';active=request;
            const answer=await send({...request,action});
            if(answer?.applied!==true||answer.port!==request.port||answer.pixels!==request.pixels||!Number.isInteger(answer.previewTTLMS)||answer.previewTTLMS<1||answer.previewTTLMS>15000)throw Error('PIXEL_PREVIEW_UNCONFIRMED');
            if(item.version===version&&desired){report('applied',request);clearTimer(renew);renew=setTimer(()=>{renew=null;if(desired){queued={request:desired,version};void drain();}},Math.min(10000,Math.max(500,answer.previewTTLMS-3000)));}
          }catch(_){
            if(item.version===version||item.stop){desired=null;clearTimer(renew);renew=null;report('failed',active);}
          }
        }
      })().finally(()=>{running=null;if(queued)void drain();});
      return running;
    }
    function update(request){
      if(typeof send!=='function')return;
      const next=copy(request);if(desired&&JSON.stringify(desired)===JSON.stringify(next))return;
      desired=next;version++;clearTimer(renew);renew=null;queued={request:next,version};report('pending',next);
      if(timer===null&&!running)timer=setTimer(()=>void drain(),delay);
    }
    function stop(){
      if(typeof send!=='function')return Promise.resolve();
      desired=null;version++;cancelTimers();queued={stop:true,version};return drain();
    }
    return Object.freeze({update,stop});
  }
  function previewMessage(state){return state.kind==='failed'?'Testlicht niet bereikbaar. Controleer de receiververbinding; je aantal blijft bewaard.':state.kind==='applied'?(state.pixels?`Testlicht verstuurd naar poort ${state.port}. Controleer de echte ledline.`:'0 pixels · testlicht uit.'):state.kind==='pending'?'Testlicht aanpassen…':'Voorbeeld · geen testlicht';}
  function showPreviewStatus(container,state){const label=container?.querySelector('[data-pixel-preview] .pixel-preview-notice');if(label){label.textContent=previewMessage(state);label.dataset.testLight=state.kind;}}
  function create({onSave,onClose=()=>{},onPreview,mode='preview',pixelsPerMeter=DEFAULT_PIXELS_PER_METER}={}){
    if(typeof onSave!=='function')throw Error('PIXEL_SAVE_HANDLER_REQUIRED');
    const limits=pixelLimits({pixelsPerMeter});
    let dialog=null,receiver=null,outputs=[],index=0,busy=false,error='',focusBefore=null,initialPort=null,selectedPort=null,unbindScrub=null,recovering=false;
    const plugMotion=globalThis.LightningReceiverVisual.createPlugMotion();
    let previewTransaction=null,previewState={kind:'idle'};
    const livePreview=createLivePreview({send:mode==='native'?onPreview:null,onState:state=>{previewState=state;showPreviewStatus(dialog,state);}});
    const plan=()=>sequence(outputs),current=()=>plan()[index],output=()=>outputs.find(item=>item.port===current().port);
    function syncPreview(){
      if(!dialog||document.hidden||current().stage!=='pixels'){void livePreview.stop();return;}
      livePreview.update({standId:receiver.standId,transactionId:previewTransaction,
        receiver:{id:receiver.id,rid:receiver.rid,type:'SPI',deviceFingerprint:receiver.deviceFingerprint},role:receiver.role,
        mainReceiverId:receiver.mainReceiverId||null,port:output().port,pixels:output().pixels});showPreviewStatus(dialog,previewState);
    }
    function visibility(){syncPreview();}
    function paint(time){if(dialog?.open&&['outputs','pixels','connection'].includes(current().stage)){const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;paintOutputs(dialog,outputs,{time,reducedMotion,selectedPort:current().port||selectedPort,plugProgress:current().stage==='outputs'?plugMotion.sample(time,reducedMotion):{}});}}
    function close(){if(!dialog||busy)return;void livePreview.stop();document.removeEventListener('visibilitychange',visibility);unbindScrub?.();unbindScrub=null;dialog.close();dialog.remove();dialog=null;plugMotion.clear();focusBefore?.focus?.({preventScroll:true});onClose();}
    function render(top=false){
      if(!dialog)return;const previousScroll=dialog.querySelector('.pixel-setup-body')?.scrollTop||0,step=current(),ports=outputs.filter(item=>item.enabled),active=output();
      const focusedPort=dialog.contains(document.activeElement)&&document.activeElement.dataset.pixelAction==='output'?document.activeElement.dataset.port:null;
      let content='';
      if(step.stage==='outputs')content=`<p>Welke uitgangen gebruik je? Zet elke aangesloten uitgang aan.</p>${renderOutputs(outputs,{initialPort})}<small>Je kunt later een extra uitgang inschakelen. Je bestaande aantallen en aansluitingen blijven bewaard.</small>`;
      if(active)content=`${renderPortContext(outputs,active.port,{stage:step.stage})}${step.stage==='connection'?renderSide(active):renderPixels(active,limits)}`;
      if(step.stage==='review')content=`<p>Controleer je uitgangen. Je receiver blijft in dezelfde zone.</p><div class="pixel-setup-review">${ports.map(item=>`<div><b>P${item.port}</b><span>${item.pixels} pixels · ${meterLabel(item.pixels,limits)}<small>${endpointLabel(item)}</small></span></div>`).join('')}</div>`;
      dialog.innerHTML=`<div class="pixel-setup-shell"><header class="pixel-setup-header"><div><small>${esc(receiver.name||'SPI-receiver')}</small><h1>${step.stage==='connection'?'Waar komt de stroom binnen?':'Pixels / aansluiting instellen'}</h1></div><button type="button" data-pixel-action="close" aria-label="Instellingen sluiten" ${busy?'disabled':''}>×</button></header>${renderProgress(step.stage)}<div class="pixel-setup-body" data-stage="${step.stage}" data-port="${step.port||''}">${content}<p class="pixel-setup-mode" id="pixel-setup-mode" ${mode==='preview'&&step.stage!=='review'?'hidden':''}>${mode==='preview'?'Voorbeeld aanpassen · dit stuurt nog geen signaal naar de LED-line.':mode==='native'?'Instellingen worden op de receiver bewaard.':'Je kunt de stappen bekijken. Opslaan en de echte LED-line testen zijn nog niet beschikbaar.'}</p><p class="pixel-setup-error" role="alert" ${error?'':'hidden'}>${esc(error)}</p></div><footer class="pixel-setup-footer"><button type="button" data-pixel-action="${index?'back':'close'}" ${busy?'disabled':''}>${index?'← Terug':'Annuleren'}</button><button type="button" data-pixel-action="${step.stage==='review'?'save':'next'}" ${busy||!ports.length||step.stage==='pixels'&&!configuredPixels(active.pixels,limits)||step.stage==='review'&&(!['preview','native'].includes(mode)||ports.some(item=>!configuredPixels(item.pixels,limits)))?'disabled aria-describedby="pixel-setup-mode"':''}>${busy?'Bewaren…':step.stage==='review'?'Instellingen bewaren':active?nextPortLabel(outputs,active.port,{stage:step.stage,last:'Controleren →'}):'Volgende →'}</button></footer></div>`;
      if(recovering){const back=dialog.querySelector('[data-pixel-action="back"]');if(back){back.dataset.pixelAction='close';back.textContent='Sluiten';}}
      dialog.querySelector('.pixel-setup-body').scrollTop=top?0:previousScroll;
      if(!top&&focusedPort)dialog.querySelector(`[data-pixel-action="output"][data-port="${focusedPort}"]`)?.focus({preventScroll:true});
      paint(performance.now()/1000);
      syncPreview();
    }
    function adjust(value,source){if(!validateInput(dialog,value)){dialog.querySelector('[data-pixel-action="next"]').disabled=true;return;}output().pixels=Number(value);updatePixels(dialog,output(),{source});dialog.querySelector('[data-pixel-action="next"]').disabled=!configuredPixels(output().pixels,limits);error='';syncPreview();}
    function input(event){if(busy)return;if(event.target.matches('[data-pixel-count],[data-pixel-range]'))adjust(event.target.value,event.target);}
    async function click(event){
      const target=event.target.closest('[data-pixel-action]');if(!target||target.disabled||busy)return;
      const action=target.dataset.pixelAction,step=current();
      if(['next','back','save'].includes(action)&&step.stage==='pixels'){busy=true;try{await livePreview.stop();}finally{busy=false;}if(!dialog)return;}
      if(action==='close')return close();
      if(action==='output'){const item=outputs.find(item=>item.port===Number(target.dataset.port));if(item.enabled&&outputs.filter(item=>item.enabled).length===1){error='Gebruik minstens één uitgang.';render();return;}item.enabled=!item.enabled;selectedPort=item.port;plugMotion.trigger(item.port,performance.now()/1000,item.enabled);error='';return render();}
      if(['pixel-less','pixel-more','meter-less','meter-more'].includes(action))return adjust(stepPixels(output().pixels,(action.endsWith('less')?-1:1)*(action.startsWith('meter')?Math.round(limits.pixelsPerMeter):1),limits));
      if(action==='side'){output().reversed=target.dataset.side==='right';error='';return render();}
      if(action==='next'){if(!outputs.some(item=>item.enabled)){error='Gebruik minstens één uitgang.';return render();}if(step.stage==='pixels'&&(!validateInput(dialog,dialog.querySelector('[data-pixel-count]').value)||!configuredPixels(output().pixels,limits)))return;index++;error='';return render(true);}
      if(action==='back'){index--;error='';return render(true);}
      if(action==='save'){if(!['preview','native'].includes(mode)||!outputs.some(item=>item.enabled)||outputs.some(item=>item.enabled&&!configuredPixels(item.pixels,limits)))return;busy=true;error='';render();try{await onSave({receiverId:receiver.id,outputs:outputs.map(item=>!item.enabled&&item.pixels===0?{...item,pixels:1,reversed:false}:copy(item))});busy=false;close();}catch(failure){busy=false;error=typeof failure?.message==='string'?failure.message:'Bewaren is nog niet gelukt. Je keuzes blijven staan.';render();}}
    }
    function open(value,{initialPort:port,resumePending=false}={}){
      if(dialog)throw Error('PIXEL_SETUP_ALREADY_OPEN');outputs=outputsOf(value);receiver=copy(value);previewTransaction=previewId();previewState={kind:'idle'};document.addEventListener('visibilitychange',visibility);initialPort=Number.isInteger(port)&&port>=1&&port<=4?port:null;selectedPort=null;plugMotion.clear();index=0;error='';busy=false;focusBefore=document.activeElement;
      recovering=resumePending===true;
      if(recovering){index=plan().length-1;error='Je vorige wijziging wacht nog op bevestiging. Kies Instellingen bewaren om diezelfde wijziging af te ronden.';}
      dialog=document.createElement('dialog');dialog.className='pixel-setup-dialog';dialog.setAttribute('aria-label','Pixels en aansluiting instellen');dialog.addEventListener('click',click);dialog.addEventListener('input',input);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});unbindScrub=bindPixelScrub(dialog,{isEnabled:()=>!busy&&current().stage==='pixels',onChange:value=>adjust(value)});document.body.append(dialog);render(true);dialog.showModal();paint(performance.now()/1000);
    }
    return Object.freeze({open,close,paint,isOpen:()=>!!dialog});
  }
  return Object.freeze({create,createLivePreview,showPreviewStatus,renderOutputs,paintOutputs,renderPixels,renderSide,renderPort,renderProgress,renderPortContext,nextPortLabel,bindPixelScrub,updatePixels,validateInput,outputsOf,sequence,validPixels,pixelLimits,editablePixels,configuredPixels,stepPixels,meterLabel,endpointLabel});
}));
