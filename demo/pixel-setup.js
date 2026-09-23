/* Shared SPI setup presentation. This module edits copies only. It does not
 * send calibration commands, claim a receiver, change membership or persist.
 * A composition root must explicitly supply onSave and verify hardware there.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningPixelSetup=api;}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MIN=1,MAX=1024,DEFAULT_PIXELS_PER_METER=26,MAX_METERS=6.3,copy=value=>JSON.parse(JSON.stringify(value));
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validPixels=value=>Number.isInteger(value)&&value>=MIN&&value<=MAX;
  // The stored/protocol range remains 1..1024. Length limits apply only to this
  // product's editing flow: merely opening an older configuration changes none
  // of its geometry. Density is explicit so a different strip can use its own.
  function pixelLimits({pixelsPerMeter=DEFAULT_PIXELS_PER_METER}={}){
    if(!Number.isFinite(pixelsPerMeter)||pixelsPerMeter<1||pixelsPerMeter>MAX)throw Error('PIXEL_DENSITY_INVALID');
    return Object.freeze({min:MIN,max:Math.min(MAX,Math.floor(pixelsPerMeter*MAX_METERS)),pixelsPerMeter,maxMeters:MAX_METERS});
  }
  function editablePixels(value,options){const limits=pixelLimits(options);return validPixels(value)&&value<=limits.max;}
  function stepPixels(value,delta,options){const limits=pixelLimits(options);if(!validPixels(value)||!Number.isInteger(delta))throw Error('PIXEL_STEP_INVALID');return Math.max(limits.min,Math.min(limits.max,value+delta));}
  function meterLabel(value,options){const limits=pixelLimits(options);return `≈ ${(value/limits.pixelsPerMeter).toLocaleString('nl-BE',{maximumFractionDigits:2,minimumFractionDigits:2})} m`;}
  const endpointLabel=output=>output.reversed?'Begin aan het vrije uiteinde':'Begin bij de kabel';
  const cableIcon='<svg viewBox="0 0 38 24" aria-hidden="true"><rect x="1" y="3" width="23" height="18" rx="5"/><path d="M8 7h8M24 12h13"/></svg>';
  function outputsOf(receiver){
    if(!receiver||receiver.type!=='SPI'||typeof receiver.id!=='string'||!Array.isArray(receiver.outputs)||receiver.outputs.length!==4)throw Error('SPI_RECEIVER_REQUIRED');
    const outputs=receiver.outputs.map(output=>({port:output.port,enabled:output.enabled,pixels:output.pixels,reversed:output.reversed})).sort((a,b)=>a.port-b.port);
    if(outputs.some((output,i)=>output.port!==i+1||typeof output.enabled!=='boolean'||typeof output.reversed!=='boolean'||!validPixels(output.pixels)))throw Error('SPI_OUTPUTS_INVALID');
    return outputs;
  }
  function sequence(outputs){const ports=outputs.filter(output=>output.enabled).map(output=>output.port);return [{stage:'outputs',port:null},...ports.map(port=>({stage:'pixels',port})),...ports.map(port=>({stage:'connection',port})),{stage:'review',port:null}];}
  function renderProgress(stage){const position={outputs:0,pixels:1,connection:2,review:3}[stage];return `<ol class="pixel-setup-steps" aria-label="LED-line instellen">${['Uitgangen','Pixels','Beginpunt'].map((name,index)=>`<li ${index===position?'aria-current="step"':''}><span>${index<position?'✓':index+1}</span>${name}</li>`).join('')}</ol>`;}
  function strip(output,stage,options){
    const count=Math.min(24,output.pixels),reversed=stage==='connection'&&output.reversed;
    if(stage==='pixels')return `<div class="pixel-setup-visual pixel-count-preview" data-pixel-visual="pixels" data-preview-pixels="${output.pixels}" role="img" aria-label="Ingesteld: ${output.pixels} ${output.pixels===1?'pixel':'pixels'}. Schematisch aantal, geen gemeten striplengte."><div class="pixel-count-preview-label"><b>${output.pixels} ${output.pixels===1?'pixel':'pixels'}</b><span>Handmatig ingesteld</span></div><span class="pixel-setup-track"><span class="pixel-setup-strip">${Array.from({length:count},()=>'<i></i>').join('')}</span>${output.pixels>24?'<span class="pixel-count-more" aria-hidden="true">···</span>':''}</span><small class="pixel-preview-notice">Voorbeeld · geen testlicht</small></div>`;
    // Present both choices from logical start 1. Turning the complete drawing
    // moves the cable and its physical marker together, not the stored mapping.
    const cableLabel='<span class="pixel-cable-label"><i></i>Kabel</span>',freeLabel='<span>Vrij uiteinde</span>';
    return `<div class="pixel-setup-visual pixel-connection-preview" data-pixel-visual="connection" data-side="${reversed?'right':'left'}" data-preview-pixels="${output.pixels}" role="img" aria-label="${endpointLabel(output)}. Het voorbeeld draait mee met je keuze; start 1 staat steeds vooraan. De groene aansluiting is altijd bij de kabel. Schematisch, geen fysieke lichttest."><div class="pixel-setup-reference" aria-hidden="true"><span>Start 1</span><i>→</i><span>Einde</span></div><div class="pixel-cable-line"><span class="pixel-cable-source" aria-hidden="true">${cableIcon}</span><span class="pixel-setup-track"><span class="pixel-setup-strip">${Array.from({length:count},(_,i)=>`<i${i===0?' class="start"':''}></i>`).join('')}</span></span></div><div class="pixel-setup-endpoint-labels">${reversed?freeLabel+cableLabel:cableLabel+freeLabel}</div></div>`;
  }
  function renderOutputs(outputs,{onboarding=false,initialPort=null}={}){
    const attr=onboarding?'data-onboarding-action':'data-pixel-action';
    const active=outputs.filter(item=>item.enabled).map(item=>`P${item.port}`),summary=active.length?`${active.join(' + ')} aan · ${active.length} van 4 uitgangen`:'Alle uitgangen uit';
    return `<div class="pixel-output-picker"><canvas data-pixel-outputs-visual role="img" aria-label="SPI-receiver · ${summary}" width="400" height="200"></canvas><div class="pixel-setup-outputs" role="group" aria-label="Uitgangen aan of uit">${outputs.map(item=>`<button type="button" ${attr}="output" data-port="${item.port}" role="switch" aria-checked="${item.enabled}" aria-label="Uitgang ${item.port}" ${item.port===initialPort?'data-requested-port="true"':''}><b>P${item.port}</b><span>${item.enabled?'Aan':'Uit'}</span><i class="pixel-setup-switch" aria-hidden="true"><i></i></i></button>`).join('')}</div><p class="pixel-output-summary">${summary}</p><small class="pixel-preview-notice">Voorbeeld · geen testlicht</small></div>`;
  }
  function paintOutputs(container,outputs,{time=0,reducedMotion=false,entranceProgress=1,selectedPort=null,plugProgress={},visual=globalThis.LightningReceiverVisual}={}){
    if(!container||container.ownerDocument?.hidden||typeof visual?.draw!=='function')return;
    container.querySelectorAll('[data-pixel-outputs-visual]').forEach(canvas=>{
      const rect=canvas.getBoundingClientRect(),body=canvas.closest('.pixel-setup-body')?.getBoundingClientRect();
      if(!rect.width||!rect.height||rect.bottom<0||rect.top>innerHeight||body&&(rect.bottom<body.top||rect.top>body.bottom))return;
      const metadata=visual.draw(canvas,{type:'SPI',enabledPorts:outputs.filter(item=>item.enabled).map(item=>item.port),selectedPort,plugProgress,compact:false,time,reducedMotion,entranceProgress});
      canvas.dataset.activePorts=metadata.activePorts.join(',');canvas.dataset.portLabelsVisible=String(metadata.portLabelsVisible===true);
      canvas.dataset.selectedPort=String(metadata.selectedPort||'');canvas.dataset.plugProgress=JSON.stringify(plugProgress);
    });
  }
  function renderPixels(output,{inputId='pixel-setup-number',onboarding=false,pixelsPerMeter=DEFAULT_PIXELS_PER_METER}={}){
    const attr=onboarding?'data-onboarding-action':'data-pixel-action',limits=pixelLimits({pixelsPerMeter}),valid=editablePixels(output.pixels,limits);
    return `<section class="pixel-setup-panel" data-pixel-panel="pixels" data-pixels-per-meter="${pixelsPerMeter}"><h2>Hoeveel pixels heeft deze lijn?</h2><div data-pixel-preview>${strip(output,'pixels',limits)}</div><div class="pixel-setup-counter"><button type="button" ${attr}="pixel-less" aria-label="Eén pixel minder" ${output.pixels===MIN?'disabled':''}>−</button><label for="${esc(inputId)}"><input id="${esc(inputId)}" data-pixel-count type="number" inputmode="numeric" min="1" max="${limits.max}" step="1" value="${output.pixels}" aria-invalid="${!valid}" aria-label="Aantal pixels op uitgang ${output.port}" aria-describedby="${esc(inputId)}-error"><span>pixels</span></label><button type="button" ${attr}="pixel-more" aria-label="Eén pixel meer" ${output.pixels>=limits.max?'disabled':''}>＋</button></div><div class="pixel-setup-meter-counter"><button type="button" ${attr}="meter-less" aria-label="Eén meter minder" ${output.pixels===MIN?'disabled':''}>− 1 meter</button><output data-pixel-meters>${meterLabel(output.pixels,limits)}</output><button type="button" ${attr}="meter-more" aria-label="Eén meter meer" ${output.pixels>=limits.max?'disabled':''}>＋ 1 meter</button></div><input class="pixel-setup-range" data-pixel-range type="range" min="1" max="${limits.max}" step="1" value="${Math.min(output.pixels,limits.max)}" aria-label="Aantal pixels verschuiven"><p id="${esc(inputId)}-error" data-pixel-error class="pixel-setup-error" role="alert" ${valid?'hidden':''}>Maximaal 6,3 meter per strip. Kies 1 tot ${limits.max} pixels (${pixelsPerMeter} pixels/m).</p><div class="pixel-setup-range-label"><span>1 pixel</span><span>Max. 6,3 m · ${limits.max} pixels</span></div><details class="pixel-setup-more"><summary>Hoe bepaal ik het aantal?</summary><p>Neem het aantal van je LED-line over of tel de pixels. De app meet de lengte niet automatisch. De meterwaarde is een schatting op basis van ${pixelsPerMeter} pixels per meter; het voorbeeld is geen fysieke lichttest.</p></details></section>`;
  }
  function renderSide(output,{onboarding=false}={}){
    const attr=onboarding?'data-onboarding-action':'data-pixel-action';
    return `<section class="pixel-setup-panel" data-pixel-panel="connection"><h2>Waar begint jouw lijn?</h2><p>Het voorbeeld draait mee met je keuze.</p><small class="pixel-preview-notice">Voorbeeld · geen testlicht</small>${strip(output,'connection')}<div class="pixel-setup-sides" role="group" aria-label="Beginpunt van de opstelling"><button type="button" ${attr}="side" data-side="left" aria-pressed="${!output.reversed}"><span class="pixel-start-choice" aria-hidden="true">${cableIcon}<b>1</b><i>→</i></span><span>Bij de kabel</span></button><button type="button" ${attr}="side" data-side="right" aria-pressed="${output.reversed}"><span class="pixel-start-choice" aria-hidden="true"><b>1</b><i>→</i>${cableIcon}</span><span>Aan het vrije uiteinde</span></button></div><details class="pixel-setup-more"><summary>Waarom dit kiezen?</summary><p>Gebruik voor je opstelling hetzelfde startpunt voor iedere lijn, ook als de kabel aan de andere kant zit. Alleen het voorbeeld draait: je hoeft niets om te steken. Groen duidt hier alleen de fysieke aansluiting aan; het is geen gemeten of aangestuurd testlicht. De animatierichting kies je later.</p></details></section>`;
  }
  function updatePixels(container,output,{source,pixelsPerMeter}={}){
    const panel=container.querySelector('[data-pixel-panel="pixels"]');if(!panel)return;
    const limits=pixelLimits({pixelsPerMeter:pixelsPerMeter??(Number(panel.dataset.pixelsPerMeter)||DEFAULT_PIXELS_PER_METER)});
    const input=panel.querySelector('[data-pixel-count]'),range=panel.querySelector('[data-pixel-range]');
    if(input!==source)input.value=String(output.pixels);if(range!==source)range.value=String(output.pixels);
    input.setAttribute('aria-invalid',String(!editablePixels(output.pixels,limits)));panel.querySelector('[data-pixel-error]').hidden=editablePixels(output.pixels,limits);
    panel.querySelector('[data-pixel-preview]').innerHTML=strip(output,'pixels',limits);
    panel.querySelector('[data-pixel-meters]').textContent=meterLabel(output.pixels,limits);
    panel.querySelector('[aria-label="Eén pixel minder"]').disabled=output.pixels===MIN;panel.querySelector('[aria-label="Eén pixel meer"]').disabled=output.pixels>=limits.max;
    panel.querySelector('[aria-label="Eén meter minder"]').disabled=output.pixels===MIN;panel.querySelector('[aria-label="Eén meter meer"]').disabled=output.pixels>=limits.max;
  }
  function validateInput(container,value,{pixelsPerMeter}={}){const panel=container.querySelector('[data-pixel-panel="pixels"]'),limits=pixelLimits({pixelsPerMeter:pixelsPerMeter??(Number(panel?.dataset.pixelsPerMeter)||DEFAULT_PIXELS_PER_METER)}),valid=editablePixels(Number(value),limits)&&String(value).trim()!=='';if(panel){panel.querySelector('[data-pixel-count]').setAttribute('aria-invalid',String(!valid));panel.querySelector('[data-pixel-error]').hidden=valid;}return valid;}
  function create({onSave,onClose=()=>{},mode='preview',pixelsPerMeter=DEFAULT_PIXELS_PER_METER}={}){
    if(typeof onSave!=='function')throw Error('PIXEL_SAVE_HANDLER_REQUIRED');
    const limits=pixelLimits({pixelsPerMeter});
    let dialog=null,receiver=null,outputs=[],index=0,busy=false,error='',focusBefore=null,initialPort=null,selectedPort=null;
    const plugMotion=globalThis.LightningReceiverVisual.createPlugMotion();
    const plan=()=>sequence(outputs),current=()=>plan()[index],output=()=>outputs.find(item=>item.port===current().port);
    function paint(time){if(dialog?.open&&current().stage==='outputs'){const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;paintOutputs(dialog,outputs,{time,reducedMotion,selectedPort,plugProgress:plugMotion.sample(time,reducedMotion)});}}
    function close(){if(!dialog||busy)return;dialog.close();dialog.remove();dialog=null;plugMotion.clear();focusBefore?.focus?.({preventScroll:true});onClose();}
    function render(top=false){
      if(!dialog)return;const previousScroll=dialog.querySelector('.pixel-setup-body')?.scrollTop||0,step=current(),ports=outputs.filter(item=>item.enabled),active=output();
      const focusedPort=dialog.contains(document.activeElement)&&document.activeElement.dataset.pixelAction==='output'?document.activeElement.dataset.port:null;
      let content='';
      if(step.stage==='outputs')content=`<p>Welke uitgangen gebruik je? Zet elke aangesloten uitgang aan.</p>${renderOutputs(outputs,{initialPort})}<small>Je kunt later een extra uitgang inschakelen. Je bestaande aantallen en beginpunten blijven bewaard.</small>`;
      if(active)content=`<div class="onboarding-port-label"><b>Uitgang ${active.port}</b><span>${ports.findIndex(item=>item.port===active.port)+1} van ${ports.length}</span></div>${step.stage==='pixels'?renderPixels(active,limits):renderSide(active)}`;
      if(step.stage==='review')content=`<p>Controleer je uitgangen. Je receiver blijft in dezelfde zone.</p><div class="pixel-setup-review">${ports.map(item=>`<div><b>P${item.port}</b><span>${item.pixels} pixels · ${meterLabel(item.pixels,limits)}<small>${endpointLabel(item)}</small></span></div>`).join('')}</div>`;
      dialog.innerHTML=`<div class="pixel-setup-shell"><header class="pixel-setup-header"><div><small>${esc(receiver.name||'SPI-receiver')}</small><h1>Pixels / beginpunt instellen</h1></div><button type="button" data-pixel-action="close" aria-label="Instellingen sluiten" ${busy?'disabled':''}>×</button></header>${renderProgress(step.stage)}<div class="pixel-setup-body" data-stage="${step.stage}" data-port="${step.port||''}">${content}<p class="pixel-setup-mode" id="pixel-setup-mode" ${mode==='preview'&&step.stage!=='review'?'hidden':''}>${mode==='preview'?'Voorbeeld aanpassen · dit stuurt nog geen signaal naar de LED-line.':'Je kunt de stappen bekijken. Opslaan en de echte LED-line testen zijn nog niet beschikbaar.'}</p><p class="pixel-setup-error" role="alert" ${error?'':'hidden'}>${esc(error)}</p></div><footer class="pixel-setup-footer"><button type="button" data-pixel-action="${index?'back':'close'}" ${busy?'disabled':''}>${index?'← Terug':'Annuleren'}</button><button type="button" data-pixel-action="${step.stage==='review'?'save':'next'}" ${busy||!ports.length||step.stage==='pixels'&&!editablePixels(active.pixels,limits)||step.stage==='review'&&(mode!=='preview'||ports.some(item=>!editablePixels(item.pixels,limits)))?'disabled aria-describedby="pixel-setup-mode"':''}>${busy?'Bewaren…':step.stage==='review'?'Instellingen bewaren':step.stage==='pixels'&&active.port===ports.at(-1).port?'Beginpunt kiezen':'Volgende →'}</button></footer></div>`;
      dialog.querySelector('.pixel-setup-body').scrollTop=top?0:previousScroll;
      if(!top&&focusedPort)dialog.querySelector(`[data-pixel-action="output"][data-port="${focusedPort}"]`)?.focus({preventScroll:true});
      paint(performance.now()/1000);
    }
    function adjust(value,source){if(!validateInput(dialog,value)){dialog.querySelector('[data-pixel-action="next"]').disabled=true;return;}output().pixels=Number(value);updatePixels(dialog,output(),{source});dialog.querySelector('[data-pixel-action="next"]').disabled=false;error='';}
    function input(event){if(busy)return;if(event.target.matches('[data-pixel-count],[data-pixel-range]'))adjust(event.target.value,event.target);}
    async function click(event){
      const target=event.target.closest('[data-pixel-action]');if(!target||target.disabled||busy)return;
      const action=target.dataset.pixelAction,step=current();
      if(action==='close')return close();
      if(action==='output'){const item=outputs.find(item=>item.port===Number(target.dataset.port));if(item.enabled&&outputs.filter(item=>item.enabled).length===1){error='Gebruik minstens één uitgang.';render();return;}item.enabled=!item.enabled;selectedPort=item.port;plugMotion.trigger(item.port,performance.now()/1000,item.enabled);error='';return render();}
      if(['pixel-less','pixel-more','meter-less','meter-more'].includes(action))return adjust(stepPixels(output().pixels,(action.endsWith('less')?-1:1)*(action.startsWith('meter')?Math.round(limits.pixelsPerMeter):1),limits));
      if(action==='side'){output().reversed=target.dataset.side==='right';error='';return render();}
      if(action==='next'){if(!outputs.some(item=>item.enabled)){error='Gebruik minstens één uitgang.';return render();}if(step.stage==='pixels'&&!validateInput(dialog,dialog.querySelector('[data-pixel-count]').value))return;index++;error='';return render(true);}
      if(action==='back'){index--;error='';return render(true);}
      if(action==='save'){if(mode!=='preview'||!outputs.some(item=>item.enabled)||outputs.some(item=>item.enabled&&!editablePixels(item.pixels,limits)))return;busy=true;error='';render();try{await onSave({receiverId:receiver.id,outputs:copy(outputs)});busy=false;close();}catch(failure){busy=false;error=typeof failure?.message==='string'?failure.message:'Bewaren is nog niet gelukt. Je keuzes blijven staan.';render();}}
    }
    function open(value,{initialPort:port}={}){
      if(dialog)throw Error('PIXEL_SETUP_ALREADY_OPEN');outputs=outputsOf(value);receiver={id:value.id,name:value.name};initialPort=Number.isInteger(port)&&port>=1&&port<=4?port:null;selectedPort=null;plugMotion.clear();index=0;error='';busy=false;focusBefore=document.activeElement;
      dialog=document.createElement('dialog');dialog.className='pixel-setup-dialog';dialog.setAttribute('aria-label','Pixels en beginpunt instellen');dialog.addEventListener('click',click);dialog.addEventListener('input',input);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});document.body.append(dialog);render(true);dialog.showModal();paint(performance.now()/1000);
    }
    return Object.freeze({open,close,paint,isOpen:()=>!!dialog});
  }
  return Object.freeze({create,renderOutputs,paintOutputs,renderPixels,renderSide,renderProgress,updatePixels,validateInput,outputsOf,sequence,validPixels,pixelLimits,editablePixels,stepPixels,meterLabel,endpointLabel});
}));
