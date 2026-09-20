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
  const endpointLabel=output=>output.reversed?'Rood bij het begin':'Groen bij het begin';
  function outputsOf(receiver){
    if(!receiver||receiver.type!=='SPI'||typeof receiver.id!=='string'||!Array.isArray(receiver.outputs)||receiver.outputs.length!==4)throw Error('SPI_RECEIVER_REQUIRED');
    const outputs=receiver.outputs.map(output=>({port:output.port,enabled:output.enabled,pixels:output.pixels,reversed:output.reversed})).sort((a,b)=>a.port-b.port);
    if(outputs.some((output,i)=>output.port!==i+1||typeof output.enabled!=='boolean'||typeof output.reversed!=='boolean'||!validPixels(output.pixels)))throw Error('SPI_OUTPUTS_INVALID');
    return outputs;
  }
  function sequence(outputs){const ports=outputs.filter(output=>output.enabled).map(output=>output.port);return [{stage:'outputs',port:null},...ports.map(port=>({stage:'pixels',port})),...ports.map(port=>({stage:'connection',port})),{stage:'review',port:null}];}
  function renderProgress(stage){const position={outputs:0,pixels:1,connection:2,review:3}[stage];return `<ol class="pixel-setup-steps" aria-label="LED-line instellen">${['Uitgangen','Pixels','Beginpunt'].map((name,index)=>`<li ${index===position?'aria-current="step"':''}><span>${index<position?'✓':index+1}</span>${name}</li>`).join('')}</ol>`;}
  function strip(output,stage,options){
    const ratio=stage==='pixels'?Math.min(1,output.pixels/pixelLimits(options).max):1;
    const count=stage==='pixels'?Math.min(output.pixels,Math.max(2,Math.round(24*ratio))):Math.min(24,output.pixels),right=stage==='connection'&&output.reversed;
    const length=(ratio*100).toFixed(3);
    return `<div class="pixel-setup-visual" data-pixel-visual="${stage}" data-side="${right?'right':'left'}" style="--pixel-length:${length}%" data-preview-pixels="${output.pixels}" role="img" aria-label="${stage==='pixels'?`${output.pixels===1?'Eén rode pixel':`${output.pixels-1} witte pixels en één rode eindpixel`}`:`${endpointLabel(output)} van de opstelling; groen is de eerste pixel bij de kabel, rood de laatste pixel`} (schematisch)">${stage==='pixels'?'<small class="pixel-preview-notice">Voorbeeld · geen testlicht</small>':''}<span class="pixel-setup-track"><span class="pixel-setup-strip">${Array.from({length:count},(_,i)=>`<i class="${stage==='pixels'&&i===count-1?'end':stage==='connection'&&i===(right?count-1:0)?'start':stage==='connection'&&i===(right?0:count-1)?'end':''}"></i>`).join('')}</span></span></div>`;
  }
  function renderOutputs(outputs,{onboarding=false,initialPort=null}={}){
    const attr=onboarding?'data-onboarding-action':'data-pixel-action';
    const active=outputs.filter(item=>item.enabled).map(item=>`P${item.port}`),summary=active.length?`${active.join(' + ')} aan · ${active.length} van 4 uitgangen`:'Alle uitgangen uit';
    return `<div class="pixel-output-picker"><canvas data-pixel-outputs-visual role="img" aria-label="SPI-receiver · ${summary}" width="400" height="200"></canvas><div class="pixel-setup-outputs" role="group" aria-label="Uitgangen aan of uit">${outputs.map(item=>`<button type="button" ${attr}="output" data-port="${item.port}" role="switch" aria-checked="${item.enabled}" aria-label="Uitgang ${item.port}" ${item.port===initialPort?'data-requested-port="true"':''}><b>P${item.port}</b><span>${item.enabled?'Aan':'Uit'}</span><i class="pixel-setup-switch" aria-hidden="true"><i></i></i></button>`).join('')}</div><p class="pixel-output-summary">${summary}</p><small class="pixel-preview-notice">Voorbeeld · geen testlicht</small></div>`;
  }
  function paintOutputs(container,outputs,{time=0,reducedMotion=false,entranceProgress=1,visual=globalThis.LightningReceiverVisual}={}){
    if(!container||container.ownerDocument?.hidden||typeof visual?.draw!=='function')return;
    container.querySelectorAll('[data-pixel-outputs-visual]').forEach(canvas=>{
      const rect=canvas.getBoundingClientRect(),body=canvas.closest('.pixel-setup-body')?.getBoundingClientRect();
      if(!rect.width||!rect.height||rect.bottom<0||rect.top>innerHeight||body&&(rect.bottom<body.top||rect.top>body.bottom))return;
      const metadata=visual.draw(canvas,{type:'SPI',enabledPorts:outputs.filter(item=>item.enabled).map(item=>item.port),selectedPort:null,compact:false,time,reducedMotion,entranceProgress});
      canvas.dataset.activePorts=metadata.activePorts.join(',');canvas.dataset.portLabelsVisible=String(metadata.portLabelsVisible===true);
    });
  }
  function renderPixels(output,{inputId='pixel-setup-number',onboarding=false,pixelsPerMeter=DEFAULT_PIXELS_PER_METER}={}){
    const attr=onboarding?'data-onboarding-action':'data-pixel-action',limits=pixelLimits({pixelsPerMeter}),valid=editablePixels(output.pixels,limits);
    return `<section class="pixel-setup-panel" data-pixel-panel="pixels" data-pixels-per-meter="${pixelsPerMeter}"><h2>Zoek de laatste pixel</h2><div class="pixel-setup-colour-key"><span><b class="white"></b>Wit · je lijn</span><span><b class="red"></b>Rood · eindpixel</span></div><div data-pixel-preview>${strip(output,'pixels',limits)}</div><div class="pixel-setup-counter"><button type="button" ${attr}="pixel-less" aria-label="Eén pixel minder" ${output.pixels===MIN?'disabled':''}>−</button><label for="${esc(inputId)}"><input id="${esc(inputId)}" data-pixel-count type="number" inputmode="numeric" min="1" max="${limits.max}" step="1" value="${output.pixels}" aria-invalid="${!valid}" aria-label="Aantal pixels op uitgang ${output.port}" aria-describedby="${esc(inputId)}-error"><span>pixels</span></label><button type="button" ${attr}="pixel-more" aria-label="Eén pixel meer" ${output.pixels>=limits.max?'disabled':''}>＋</button></div><div class="pixel-setup-meter-counter"><button type="button" ${attr}="meter-less" aria-label="Eén meter minder" ${output.pixels===MIN?'disabled':''}>− 1 meter</button><output data-pixel-meters>${meterLabel(output.pixels,limits)}</output><button type="button" ${attr}="meter-more" aria-label="Eén meter meer" ${output.pixels>=limits.max?'disabled':''}>＋ 1 meter</button></div><input class="pixel-setup-range" data-pixel-range type="range" min="1" max="${limits.max}" step="1" value="${Math.min(output.pixels,limits.max)}" aria-label="Aantal pixels verschuiven"><p id="${esc(inputId)}-error" data-pixel-error class="pixel-setup-error" role="alert" ${valid?'hidden':''}>Maximaal 6,3 meter per strip. Kies 1 tot ${limits.max} pixels (${pixelsPerMeter} pixels/m).</p><div class="pixel-setup-range-label"><span>1 pixel</span><span>Max. 6,3 m · ${limits.max} pixels</span></div><details class="pixel-setup-more"><summary>Meer uitleg</summary><p>Het voorbeeld is schematisch. Bij een fysieke lichttest: geen rood zichtbaar? Verlaag het aantal pixels. Rood te vroeg? Verhoog het aantal tot rood op het einde staat.</p></details></section>`;
  }
  function renderSide(output,{onboarding=false}={}){
    const attr=onboarding?'data-onboarding-action':'data-pixel-action';
    return `<section class="pixel-setup-panel" data-pixel-panel="connection"><h2>Welk uiteinde is het begin?</h2><p>Kies hetzelfde begin voor alle lijnen.</p><div class="pixel-setup-reference" aria-label="Leesrichting van je opstelling"><span><b>1</b> Begin</span><i aria-hidden="true">→</i><span>Eind <b>2</b></span></div>${strip(output,'connection')}<div class="pixel-setup-endpoint-labels"><span>${output.reversed?'Rood · laatste pixel':'Groen · kabel'}</span><span>${output.reversed?'Groen · kabel':'Rood · laatste pixel'}</span></div><div class="pixel-setup-sides" role="group" aria-label="Beginpunt van de opstelling"><button type="button" ${attr}="side" data-side="left" aria-pressed="${!output.reversed}"><span class="pixel-setup-endpoint-icon" aria-hidden="true"><i class="green"></i><b>→</b><i class="red"></i></span>Groen bij het begin</button><button type="button" ${attr}="side" data-side="right" aria-pressed="${output.reversed}"><span class="pixel-setup-endpoint-icon" aria-hidden="true"><i class="red"></i><b>→</b><i class="green"></i></span>Rood bij het begin</button></div><small class="pixel-preview-notice">Voorbeeld · geen testlicht</small><details class="pixel-setup-more"><summary>Meer uitleg</summary><p>De pijl volgt je opstelling, niet de plek van de receiver. Groen is de eerste pixel bij de kabel, rood de laatste pixel. De animatierichting kies je later.</p></details></section>`;
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
    let dialog=null,receiver=null,outputs=[],index=0,busy=false,error='',focusBefore=null,initialPort=null;
    const plan=()=>sequence(outputs),current=()=>plan()[index],output=()=>outputs.find(item=>item.port===current().port);
    function paint(time){if(dialog?.open&&current().stage==='outputs')paintOutputs(dialog,outputs,{time,reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches});}
    function close(){if(!dialog||busy)return;dialog.close();dialog.remove();dialog=null;focusBefore?.focus?.({preventScroll:true});onClose();}
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
      if(action==='output'){const item=outputs.find(item=>item.port===Number(target.dataset.port));if(item.enabled&&outputs.filter(item=>item.enabled).length===1){error='Gebruik minstens één uitgang.';render();return;}item.enabled=!item.enabled;error='';return render();}
      if(['pixel-less','pixel-more','meter-less','meter-more'].includes(action))return adjust(stepPixels(output().pixels,(action.endsWith('less')?-1:1)*(action.startsWith('meter')?Math.round(limits.pixelsPerMeter):1),limits));
      if(action==='side'){output().reversed=target.dataset.side==='right';error='';return render();}
      if(action==='next'){if(!outputs.some(item=>item.enabled)){error='Gebruik minstens één uitgang.';return render();}if(step.stage==='pixels'&&!validateInput(dialog,dialog.querySelector('[data-pixel-count]').value))return;index++;error='';return render(true);}
      if(action==='back'){index--;error='';return render(true);}
      if(action==='save'){if(mode!=='preview'||!outputs.some(item=>item.enabled)||outputs.some(item=>item.enabled&&!editablePixels(item.pixels,limits)))return;busy=true;error='';render();try{await onSave({receiverId:receiver.id,outputs:copy(outputs)});busy=false;close();}catch(failure){busy=false;error=typeof failure?.message==='string'?failure.message:'Bewaren is nog niet gelukt. Je keuzes blijven staan.';render();}}
    }
    function open(value,{initialPort:port}={}){
      if(dialog)throw Error('PIXEL_SETUP_ALREADY_OPEN');outputs=outputsOf(value);receiver={id:value.id,name:value.name};initialPort=Number.isInteger(port)&&port>=1&&port<=4?port:null;index=0;error='';busy=false;focusBefore=document.activeElement;
      dialog=document.createElement('dialog');dialog.className='pixel-setup-dialog';dialog.setAttribute('aria-label','Pixels en beginpunt instellen');dialog.addEventListener('click',click);dialog.addEventListener('input',input);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});document.body.append(dialog);render(true);dialog.showModal();paint(performance.now()/1000);
    }
    return Object.freeze({open,close,paint,isOpen:()=>!!dialog});
  }
  return Object.freeze({create,renderOutputs,paintOutputs,renderPixels,renderSide,renderProgress,updatePixels,validateInput,outputsOf,sequence,validPixels,pixelLimits,editablePixels,stepPixels,meterLabel,endpointLabel});
}));
