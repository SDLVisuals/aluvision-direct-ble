/* Shared SPI setup presentation. This module edits copies only. It does not
 * claim a receiver, change membership or persist. Optional bounded preview
 * commands are sent only through the supplied, acknowledged native service.
 * A composition root must explicitly supply onSave and verify hardware there.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningPixelSetup=api;}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MIN=0,MAX=163,STORAGE_MAX=1024,DEFAULT_PIXELS_PER_METER=26,copy=value=>JSON.parse(JSON.stringify(value));
  // Kept beside the shared renderers so all composition roots can translate
  // the same customer-facing wording. Missing dictionary entries use Dutch.
  const TEXTS=Object.freeze({
    pixelPort:'Poort {port}',pixelOn:'Aan',pixelOff:'Uit',pixelNow:'Nu',pixelReady:'Klaar',pixelLater:'Straks',pixelPreserved:'Behouden',
    pixelOutputs:'Uitgangen',pixelPixels:'Pixels',pixelStart:'Beginpunt',pixelReview:'Controleren',pixelSetupSteps:'LED Line instellen',
    pixelPortTask:'Poort {port} · {task}',pixelPortPosition:'{position} van {count} poorten',pixelPortProgress:'Voortgang per poort',
    pixelNextStart:'Verder · beginpunt →',pixelNextPort:'Verder naar poort {port} →',pixelNext:'Volgende →',pixelCheck:'Controleren →',
    pixelCount:'{count} pixels',pixelCountOne:'1 pixel',pixelSwipe:'Veeg rustig om aan te passen',pixelSwipeAria:'Aantal pixels op poort {port}; veeg links of rechts',
    pixelLastRed:'Laatste pixel {count} hoort rood te branden',pixelFirstCount:'Stel eerst het aantal pixels in',pixelCountAria:'Ingesteld: {count} pixels. Laatste pixel {count} hoort rood te branden.',pixelCountEmptyAria:'Geen pixels ingesteld; er is geen rode eindpixel.',pixelSchematic:'Schematisch voorbeeld.',
    pixelIllustration:'Voorbeeld · geen testlicht',pixelNoTest:'Testvoorbeeld · geen testlicht',pixelChooseOutputs:'Kies de aangesloten uitgangen.',pixelOutputSwitches:'Uitgangen aan of uit',pixelAllOff:'Alle uitgangen uit',pixelActiveSummary:'{ports} aan · {count} van 4 uitgangen',pixelAtLeastOne:'Minstens één poort moet actief zijn.',pixelSelectedRequired:'Zet minstens één gekozen poort aan om die aan te passen.',
    pixelBlue:'Blauw',pixelOrange:'Oranje',pixelPurple:'Paars',pixelTurquoise:'Turquoise',pixelPortColour:'Poort {port} · {colour}',pixelColourGuide:'Elke poort heeft een eigen herkenningskleur.',pixelPortPreviewUnavailable:'Herkenningskleuren zijn hier een voorbeeld. Testlicht op de LED Lines is nog niet beschikbaar.',
    pixelSetPixels:'Pixels instellen',pixelLessOne:'Eén pixel minder',pixelMoreOne:'Eén pixel meer',pixelExact:'pixels · exact',pixelLessStep:'{count} pixels minder',pixelMoreStep:'{count} pixels meer',pixelCountLabel:'Aantal pixels op poort {port}',pixelCountValue:'{count} pixels, handmatig ingesteld',pixelRangeError:'Kies een heel aantal van 0 tot 163 pixels.',pixelZero:'Stel het aantal pixels in om verder te gaan.',pixelSingleHint:'− / + wijzigt één pixel. Maximaal 163 pixels.',
    pixelChooseStart:'Beginpunt kiezen',pixelDirectionExplanation:'Volg de LED Line vanaf pixel 1. Controleer in je opstelling of die richting aansluit op de vorige LED Line; keer deze LED Line zo nodig om.',pixelFromFirst:'Vanaf pixel 1',pixelToFirst:'Naar pixel 1',pixelDirectionAria:'Richting langs deze LED Line, ongeacht waar de kabel zit',pixelDirectionForward:'Pixel 1 → laatste pixel',pixelDirectionReverse:'Laatste pixel → pixel 1',pixelKeepDirection:'Deze richting gebruiken',pixelReverseDirection:'Richting omkeren',pixelWhyStart:'Waarom dit beginpunt?',pixelWhyExplanation:'De richting hangt af van hoe elke LED Line in je opstelling staat. Twee kabels die naar elkaar wijzen zeggen niets over de doorlopende lichtrichting. Kies per LED Line dezelfde richting langs het lichtpad; de volgorde van de LED Lines stel je daarna in.',pixelDirectionUnavailable:'Dit is een voorbeeld van de richting. Controleer de werkelijke looprichting op je LED Line zodra testlicht beschikbaar is.',pixelDirectionLive:'Controleer de testbeweging op de echte LED Line en kies de gewenste richting.',
    pixelSelectSummary:'Je past {ports} aan. De andere poorten blijven behouden.',pixelCheckOutputs:'Controleer de gekozen uitgangen.',pixelSameZone:'De receiver blijft in dezelfde zone.',pixelReceiver:'SPI-receiver',pixelSettings:'Uitgangen en pixels',pixelCloseSettings:'Instellingen sluiten',pixelPreviewMode:'Voorbeeld · geen leds aangestuurd.',pixelNativeMode:'Wordt op de receiver opgeslagen.',pixelUnavailableMode:'Voorbeeld bekijken; opslaan en testlicht zijn niet beschikbaar.',pixelSave:'Opslaan',pixelSaving:'Bewaren…',pixelBack:'← Terug',pixelClose:'Sluiten',pixelSaveFailed:'Bewaren is nog niet gelukt. Je keuzes blijven staan.',pixelPendingConfig:'Je vorige wijziging wacht nog op bevestiging. Kies Opslaan om diezelfde wijziging af te ronden.',pixelDialogAria:'Pixels en beginpunt instellen',
    pixelStopping:'Testlicht stoppen…',pixelStoppingChoices:'Testlicht stoppen… Je keuzes blijven staan.',pixelPreviewPending:'Testlicht aanpassen…',pixelPreviewUnsupported:'Werk deze receiver bij om het gekozen testlicht te tonen. Je keuze blijft staan.',pixelPreviewFailed:'Testlicht niet bereikbaar. Controleer de receiververbinding; je keuze blijft staan.',pixelPreviewLength:'Testlicht verstuurd naar poort {port}. De laatste pixel ({count}) hoort rood te branden; de andere pixels wit.',pixelPreviewPower:'Testlicht verstuurd naar poort {port}. Controleer het groene referentiepunt op de LED Line.',pixelPreviewDirection:'Richtingstest verstuurd naar poort {port}. Controleer de beweging op de LED Line: {direction}.',pixelPreviewPorts:'Herkenningskleuren verstuurd. Controleer elke LED Line; uitgeschakelde poorten horen uit te blijven.',pixelPreviewZero:'0 pixels · testlicht uit.'
  });
  function t(key,params={}){const language=globalThis.document?.documentElement?.lang||'nl';let text=globalThis.LightningPixelTranslations?.t?.(key,language,params)||globalThis.LightningPreferences?.t?.(key,language,params);if(!text||text===key)text=TEXTS[key]||key;return text.replace(/\{([^}]+)\}/g,(_,name)=>String(params[name]??`{${name}}`));}
  const PORT_COLOURS=Object.freeze([{hex:'#2563eb',name:'pixelBlue'},{hex:'#ea580c',name:'pixelOrange'},{hex:'#9333ea',name:'pixelPurple'},{hex:'#0d9488',name:'pixelTurquoise'}]);
  function portColour(port){if(!Number.isInteger(port)||port<1||port>4)throw Error('PIXEL_PORT_INVALID');return Object.freeze({...PORT_COLOURS[port-1],label:t(PORT_COLOURS[port-1].name)});}
  let previewSerial=0;
  function previewId(){
    // A non-secret operation ID, also usable in non-secure local UI previews.
    const bytes=globalThis.crypto?.getRandomValues?.(new Uint8Array(16));
    return 'pixels-'+(bytes?Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''):Date.now().toString(36)+'-'+(++previewSerial));
  }
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validPixels=value=>Number.isInteger(value)&&value>=1&&value<=STORAGE_MAX;
  // Read legacy geometry without altering it. New edits are count-based and
  // bounded to 163 for every supported LED Line, independent of pixel density.
  function pixelLimits(){return Object.freeze({min:MIN,max:MAX});}
  function editablePixels(value,options){const limits=pixelLimits(options);return Number.isInteger(value)&&value>=MIN&&value<=limits.max;}
  function configuredPixels(value,options){return value>0&&editablePixels(value,options);}
  function stepPixels(value,delta,options){const limits=pixelLimits(options);if(!(value===0||validPixels(value))||!Number.isInteger(delta))throw Error('PIXEL_STEP_INVALID');const ceiling=value>limits.max?value:limits.max;return Math.max(limits.min,Math.min(ceiling,value+delta));}
  function stepMeters(value,delta,options){
    const limits=pixelLimits(options);if(!Number.isFinite(delta))throw Error('PIXEL_STEP_INVALID');
    // Round the distance once, then apply its sign: half-metre buttons remain
    // reversible even for an odd density. Only whole addressable pixels exist.
    return stepPixels(value,Math.sign(delta)*Math.round(Math.abs(delta)*DEFAULT_PIXELS_PER_METER),limits);
  }
  // Retained only as a legacy caller API; the V50 setup never displays metres.
  function meterLabel(value){return `≈ ${(value/DEFAULT_PIXELS_PER_METER).toLocaleString('nl-BE',{maximumFractionDigits:2,minimumFractionDigits:2})} m`;}
  let lastHaptic=-Infinity;
  function hapticStep(){
    const now=globalThis.performance?.now?.()??Date.now();if(now-lastHaptic<40)return;
    lastHaptic=now;
    try{if(globalThis.LightningNativeRuntime?.selectionFeedback?.()===true)return;}catch(_){/* Feedback is optional. */}
    try{globalThis.navigator?.vibrate?.(8);}catch(_){/* Feedback is optional. */}
  }
  const endpointLabel=output=>t(output.reversed?'pixelDirectionReverse':'pixelDirectionForward');
  // The supplied LED-line uses a round plug and a flexible lead into the end
  // of a broad diffuser profile, not a receiver box attached to exposed LEDs.
  const cableIcon='<svg viewBox="0 0 64 32" aria-hidden="true"><path class="pixel-lead-wire" d="M25 15C35 15 35 27 46 27S57 17 64 17"/><path class="pixel-lead-plug" d="M4 7H18L24 10V20L18 23H4Z"/><path d="M5 8V22M9 8V22M13 8V22M17 8V22M24 12H28V18H24"/></svg>';
  function outputsOf(receiver){
    if(!receiver||receiver.type!=='SPI'||typeof receiver.id!=='string'||!Array.isArray(receiver.outputs)||receiver.outputs.length!==4)throw Error('SPI_RECEIVER_REQUIRED');
    const outputs=receiver.outputs.map(output=>({port:output.port,enabled:output.enabled,pixels:output.pixels,reversed:output.reversed})).sort((a,b)=>a.port-b.port);
    if(outputs.some((output,i)=>output.port!==i+1||typeof output.enabled!=='boolean'||typeof output.reversed!=='boolean'||!validPixels(output.pixels)))throw Error('SPI_OUTPUTS_INVALID');
    return outputs;
  }
  function selectedPortSet(ports){if(ports==null)return null;if(!Array.isArray(ports)||!ports.length||ports.some(port=>!Number.isInteger(port)||port<1||port>4)||new Set(ports).size!==ports.length)throw Error('PIXEL_SELECTED_PORTS_INVALID');return new Set(ports);}
  function editableOutputs(outputs,ports){const selected=ports instanceof Set?ports:selectedPortSet(ports);return outputs.filter(output=>output.enabled&&(!selected||selected.has(output.port)));}
  function sequence(outputs,{selectedPorts=null}={}){const ports=editableOutputs(outputs,selectedPorts).map(output=>output.port);return [{stage:'outputs',port:null},...ports.flatMap(port=>[{stage:'pixels',port},{stage:'connection',port}]),{stage:'review',port:null}];}
  function renderProgress(stage){const position={outputs:0,pixels:1,connection:2,review:3}[stage];return `<ol class="pixel-setup-steps" aria-label="${esc(t('pixelSetupSteps'))}">${['pixelOutputs','pixelPixels','pixelStart','pixelReview'].map((name,index)=>`<li ${index===position?'aria-current="step"':''}><span>${index<position?'✓':index+1}</span>${esc(t(name))}</li>`).join('')}</ol>`;}
  function renderPortContext(outputs,port,{stage='pixels',selectedPorts=null}={}){
    const selected=selectedPorts instanceof Set?selectedPorts:selectedPortSet(selectedPorts),active=editableOutputs(outputs,selected),position=active.findIndex(item=>item.port===port),task=t(stage==='connection'?'pixelStart':'pixelSetPixels'),colour=portColour(port);
    return `<section class="pixel-port-context" data-current-port="${port}" style="--port-colour:${colour.hex}" aria-label="${esc(t('pixelPortTask',{port,task}))}"><canvas data-pixel-port-visual role="img" aria-label="${esc(t('pixelPort',{port}))}" width="180" height="200"></canvas><div class="pixel-port-context-info"><h2>${esc(t('pixelPortTask',{port,task}))}</h2><p>${esc(t('pixelPortPosition',{position:position+1,count:active.length}))} · <span class="pixel-port-colour">${esc(colour.label)}</span></p><ol aria-label="${esc(t('pixelPortProgress'))}">${outputs.map(item=>{const state=selected&&!selected.has(item.port)?'preserved':!item.enabled?'off':item.port===port?'current':item.port<port?'complete':'pending',label=t({off:'pixelOff',current:'pixelNow',complete:'pixelReady',pending:'pixelLater',preserved:'pixelPreserved'}[state]);return `<li class="pixel-port-step" style="--port-colour:${portColour(item.port).hex}" data-port="${item.port}" data-state="${state}" ${state==='current'?'aria-current="step"':''} aria-label="${esc(t('pixelPort',{port:item.port}))}: ${esc(label)}"><b>${item.port}</b><span>${esc(label)}</span></li>`;}).join('')}</ol></div></section>`;
  }
  function nextPortLabel(outputs,port,{stage='pixels',last=null}={}){
    if(stage==='pixels')return t('pixelNextStart');
    const next=outputs.find(item=>item.enabled&&item.port>port);
    return next?t('pixelNextPort',{port:next.port}):last||t('pixelNext');
  }
  function strip(output,stage,options){
    const reversed=stage==='connection'&&output.reversed;
    if(stage==='pixels'){
      const limits=pixelLimits(options),progress=Math.max(0,Math.min(100,output.pixels/limits.max*100));
      const represented=output.pixels>24?23:Math.max(0,output.pixels-1),cells=Array.from({length:represented},()=>'<i></i>').join('');
      const endpoint=output.pixels>0?'<i class="end"></i>':'';
      const terminal=output.pixels>24?`<span class="pixel-count-more" aria-hidden="true">···</span><span class="pixel-count-terminal" aria-hidden="true"><i class="end"></i></span>`:'';
      const guide=output.pixels>0?`<span class="pixel-endpoint-guide"><i aria-hidden="true"></i><span>${esc(t('pixelLastRed',{count:output.pixels}))}</span></span>`:`<span class="pixel-endpoint-guide is-empty">${esc(t('pixelFirstCount'))}</span>`;
      const aria=t(output.pixels>0?'pixelCountAria':'pixelCountEmptyAria',{count:output.pixels});
      return `<div class="pixel-setup-visual pixel-count-preview" data-pixel-visual="pixels" data-preview-pixels="${output.pixels}" role="img" aria-label="${esc(aria)} ${esc(t('pixelSchematic'))}"><div class="pixel-count-preview-label"><b>${esc(t(output.pixels===1?'pixelCountOne':'pixelCount',{count:output.pixels}))}</b><span class="pixel-swipe-cue"><i aria-hidden="true">↔</i>${esc(t('pixelSwipe'))}</span></div><span class="pixel-length-rail" aria-hidden="true"><span class="pixel-setup-track" style="--pixel-length-progress:${progress}%"><span class="pixel-setup-strip">${cells}${output.pixels>0&&output.pixels<=24?endpoint:''}</span>${terminal}</span></span><small class="pixel-length-scale" aria-hidden="true"><span>0</span><span>163 ${esc(t('pixelPixels').toLowerCase())}</span></small>${guide}<small class="pixel-preview-notice">${esc(t('pixelNoTest'))}</small></div>`;
    }
    // Pixel 1 is a physical reference, not a guessed left/right position. The
    // arrow changes logical travel only; the diagram never moves the cable.
    return `<div class="pixel-setup-visual pixel-connection-preview pixel-direction-preview" data-pixel-visual="connection" data-direction="${reversed?'reverse':'forward'}" data-preview-pixels="${output.pixels}" role="img" aria-label="${esc(endpointLabel(output))}. ${esc(t('pixelSchematic'))}"><div class="pixel-setup-reference" aria-hidden="true"><span>1</span><span>${output.pixels}</span></div><div class="pixel-cable-line"><span class="pixel-setup-track"><span class="pixel-setup-strip pixel-ledline-profile"><i class="start" data-first-pixel="true" aria-hidden="true"></i><span class="pixel-direction-arrow" aria-hidden="true">${reversed?'←':'→'}</span></span></span></div><div class="pixel-setup-endpoint-labels"><span>${esc(t('pixelFromFirst'))}</span><span>${esc(t('pixelToFirst'))}</span></div></div>`;
  }
  function renderOutputs(outputs,{onboarding=false,initialPort=null,selectedPorts=null,live=false}={}){
    const attr=onboarding?'data-onboarding-action':'data-pixel-action';
    const selected=selectedPorts instanceof Set?selectedPorts:selectedPortSet(selectedPorts),active=outputs.filter(item=>item.enabled).map(item=>`P${item.port}`),summary=active.length?t('pixelActiveSummary',{ports:active.join(' + '),count:active.length}):t('pixelAllOff');
    return `<div class="pixel-output-picker"><canvas data-pixel-outputs-visual role="img" aria-label="${esc(t('pixelReceiver'))} · ${esc(summary)}" width="400" height="200"></canvas><p class="pixel-output-colour-guide">${esc(t('pixelColourGuide'))}</p><div class="pixel-setup-outputs" role="group" aria-label="${esc(t('pixelOutputSwitches'))}">${outputs.map(item=>{const colour=portColour(item.port),preserved=selected&&!selected.has(item.port);return `<button type="button" ${attr}="output" style="--port-colour:${colour.hex}" data-port="${item.port}" data-port-colour="${colour.hex}" role="switch" aria-checked="${item.enabled}" aria-label="${esc(t('pixelPortColour',{port:item.port,colour:colour.label}))}" ${item.port===initialPort?'data-requested-port="true"':''} ${preserved?'disabled data-preserved="true"':''}><b>P${item.port}</b><span class="pixel-port-colour">${esc(colour.label)}</span><span>${esc(t(preserved?'pixelPreserved':item.enabled?'pixelOn':'pixelOff'))}</span><i class="pixel-setup-switch" aria-hidden="true"><i></i></i></button>`;}).join('')}</div><p class="pixel-output-summary">${esc(summary)}</p><p class="pixel-setup-error" data-pixel-all-off role="alert" ${active.length?'hidden':''}>${esc(t('pixelAtLeastOne'))}</p><small class="pixel-preview-notice" data-ports-preview-status data-test-light="idle" role="status">${esc(t(live?'pixelIllustration':'pixelPortPreviewUnavailable'))}</small></div>`;
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
  function renderPixels(output,{inputId='pixel-setup-number',onboarding=false,combined=false}={}){
    const attr=onboarding?'data-onboarding-action':'data-pixel-action',limits=pixelLimits(),valid=editablePixels(output.pixels,limits);
    const steps=[-30,-15,15,30].map(delta=>`<button type="button" ${attr}="pixel-step" data-pixel-delta="${delta}" aria-label="${esc(t(delta<0?'pixelLessStep':'pixelMoreStep',{count:Math.abs(delta)}))}" ${delta<0?output.pixels===MIN?'disabled':'':output.pixels>=limits.max?'disabled':''}>${delta<0?'−':'+'}${Math.abs(delta)}</button>`).join('');
    return `<section class="pixel-setup-panel" data-pixel-panel="pixels" data-combined="${combined}"><h2>${esc(t('pixelSetPixels'))}</h2><div data-pixel-preview data-pixel-scrub role="slider" tabindex="0" aria-label="${esc(t('pixelSwipeAria',{port:output.port}))}" aria-valuemin="${limits.min}" aria-valuemax="${limits.max}" aria-valuenow="${output.pixels}" aria-valuetext="${esc(t('pixelCountValue',{count:output.pixels}))}">${strip(output,'pixels',limits)}</div><div class="pixel-setup-pixel-steps">${steps}</div><div class="pixel-setup-counter"><button type="button" ${attr}="pixel-less" aria-label="${esc(t('pixelLessOne'))}" ${output.pixels===MIN?'disabled':''}>−</button><label for="${esc(inputId)}"><input id="${esc(inputId)}" data-pixel-count type="number" inputmode="numeric" min="${limits.min}" max="${limits.max}" step="1" value="${output.pixels}" aria-invalid="${!valid}" aria-label="${esc(t('pixelCountLabel',{port:output.port}))}" aria-describedby="${esc(inputId)}-error"><span>${esc(t('pixelExact'))}</span></label><button type="button" ${attr}="pixel-more" aria-label="${esc(t('pixelMoreOne'))}" ${output.pixels>=limits.max?'disabled':''}>＋</button></div><p id="${esc(inputId)}-error" data-pixel-error class="pixel-setup-error" role="alert" ${valid?'hidden':''}>${esc(t('pixelRangeError'))}</p><p class="pixel-zero-hint" data-pixel-empty ${output.pixels===0?'':'hidden'}>${esc(t('pixelZero'))}</p><p class="pixel-segment-hint">${esc(t('pixelSingleHint'))}</p></section>`;
  }
  function renderSide(output,{onboarding=false,combined=false,live=false}={}){
    const attr=onboarding?'data-onboarding-action':'data-pixel-action';
    return `<section class="pixel-setup-panel" data-pixel-panel="connection"><h2>${esc(t('pixelChooseStart'))}</h2><p>${esc(t('pixelDirectionExplanation'))}</p>${strip(output,'connection')}<small class="pixel-preview-notice" data-power-preview-status data-test-light="idle" role="status" aria-live="polite">${esc(t(live?'pixelDirectionLive':'pixelDirectionUnavailable'))}</small><div class="pixel-setup-sides" role="group" aria-label="${esc(t('pixelDirectionAria'))}"><button type="button" ${attr}="side" data-side="forward" aria-pressed="${!output.reversed}"><span class="pixel-direction-choice" aria-hidden="true">1 → ${output.pixels}</span><span>${esc(t('pixelKeepDirection'))}</span></button><button type="button" ${attr}="side" data-side="reverse" aria-pressed="${output.reversed}"><span class="pixel-direction-choice" aria-hidden="true">${output.pixels} → 1</span><span>${esc(t('pixelReverseDirection'))}</span></button></div><details class="pixel-setup-more"><summary>${esc(t('pixelWhyStart'))}</summary><p>${esc(t('pixelWhyExplanation'))}</p></details></section>`;
  }
  function renderPort(output,options={}){return `<div class="pixel-combined-port">${renderPixels(output,{...options,combined:true})}${renderSide(output,{...options,combined:true})}</div>`;}
  function updatePixels(container,output,{source,pixelsPerMeter}={}){
    const panel=container.querySelector('[data-pixel-panel="pixels"]');if(!panel)return;
    const limits=pixelLimits({pixelsPerMeter:pixelsPerMeter??(Number(panel.dataset.pixelsPerMeter)||DEFAULT_PIXELS_PER_METER)});
    const input=panel.querySelector('[data-pixel-count]'),range=panel.querySelector('[data-pixel-range]');
    if(input!==source)input.value=String(output.pixels);if(range&&range!==source)range.value=String(output.pixels);
    input.setAttribute('aria-invalid',String(!editablePixels(output.pixels,limits)));panel.querySelector('[data-pixel-error]').hidden=editablePixels(output.pixels,limits);
    const preview=panel.querySelector('[data-pixel-preview]');
    preview.setAttribute('aria-valuenow',String(output.pixels));preview.setAttribute('aria-valuetext',t('pixelCountValue',{count:output.pixels}));
    preview.innerHTML=strip(output,'pixels',limits);
    panel.querySelector('[data-pixel-empty]').hidden=output.pixels!==0;
    panel.querySelector('[data-pixel-action="pixel-less"],[data-onboarding-action="pixel-less"]').disabled=output.pixels===MIN;panel.querySelector('[data-pixel-action="pixel-more"],[data-onboarding-action="pixel-more"]').disabled=output.pixels>=limits.max;
    panel.querySelectorAll('[data-pixel-delta]').forEach(button=>{button.disabled=Number(button.dataset.pixelDelta)<0?output.pixels===MIN:output.pixels>=limits.max;});
  }
  function validateInput(container,value,{pixelsPerMeter}={}){const panel=container.querySelector('[data-pixel-panel="pixels"]'),limits=pixelLimits({pixelsPerMeter:pixelsPerMeter??(Number(panel?.dataset.pixelsPerMeter)||DEFAULT_PIXELS_PER_METER)}),valid=editablePixels(Number(value),limits)&&String(value).trim()!=='';if(panel){panel.querySelector('[data-pixel-count]').setAttribute('aria-invalid',String(!valid));panel.querySelector('[data-pixel-error]').hidden=valid;}return valid;}
  // Relative scrubbing avoids a jump to an arbitrary absolute value on touch.
  // Capture the stable wrapper, not the preview children replaced on updates.
  // Vertical gestures stay native scrolling; edits remain owned by the host.
  function bindPixelScrub(container,{onChange,onCommit=()=>{},isEnabled=()=>true}={}){
    if(typeof onChange!=='function')throw Error('PIXEL_SCRUB_HANDLER_REQUIRED');
    let gesture=null;
    const target=event=>event.target.closest?.('[data-pixel-scrub]');
    const available=element=>element&&element.isConnected&&container.contains(element)&&isEnabled();
    function end({commit=false}={}){
      const previous=gesture;gesture=null;if(!previous)return;
      previous.element.removeAttribute('data-scrubbing');
      if(previous.element.hasPointerCapture?.(previous.id))previous.element.releasePointerCapture(previous.id);
      if(commit&&previous.dragging&&available(previous.element))onCommit(Number(previous.element.getAttribute('aria-valuenow')));
    }
    function change(element,value){
      const min=Number(element.getAttribute('aria-valuemin')),max=Number(element.getAttribute('aria-valuemax'));
      // A legacy value remains an invalid-but-preserved draft until deliberately
      // reduced. One swipe/key step must never turn 1024 into 163 implicitly.
      const previous=Number(element.getAttribute('aria-valuenow')),ceiling=previous>max?previous:max;
      const next=Math.max(min,Math.min(ceiling,Math.round(value)));
      if(Number.isFinite(next)&&next!==Number(element.getAttribute('aria-valuenow'))){onChange(next);hapticStep();}
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
      const proposed=gesture.value+Math.round(dx/12),next=change(gesture.element,proposed);
      // At an end stop, allow an immediate change back in the other direction.
      if(next!==proposed){gesture.x=event.clientX;gesture.value=next;}
    }
    function finish(event){
      if(gesture?.id!==event.pointerId)return;
      // A final pointerup can contain a newer coordinate than pointermove.
      // Cancellation commits the last selected value without using its origin.
      if(event.type==='pointerup'&&Number.isFinite(event.clientX)&&Number.isFinite(event.clientY))move(event);
      end({commit:true});
    }
    function keydown(event){
      const element=target(event);if(!available(element)||event.altKey||event.ctrlKey||event.metaKey)return;
      const value=Number(element.getAttribute('aria-valuenow'));
      const choices={ArrowRight:value+1,ArrowUp:value+1,ArrowLeft:value-1,ArrowDown:value-1,PageUp:value+10,PageDown:value-10,Home:Number(element.getAttribute('aria-valuemin')),End:Number(element.getAttribute('aria-valuemax'))};
      if(!Object.hasOwn(choices,event.key))return;event.preventDefault();end();change(element,choices[event.key]);onCommit(Number(element.getAttribute('aria-valuenow')));
    }
    const handlers={pointerdown:down,pointermove:move,pointerup:finish,pointercancel:finish,lostpointercapture:finish,keydown};
    for(const [name,handler] of Object.entries(handlers))container.addEventListener(name,handler);
    return ()=>{end();for(const [name,handler] of Object.entries(handlers))container.removeEventListener(name,handler);};
  }
  function guideRequest({context,outputs,output,stage,capabilities={}}){
    if(stage==='outputs'){
      if(capabilities.identifyPorts!==true)return null;
      // One complete output mask, including disabled ports, is required. This
      // seam deliberately cannot be mistaken for the old one-port preview.
      return {...copy(context),guide:'ports',port:null,pixels:0,previewTTLMS:12000,outputs:outputs.map(item=>({port:item.port,enabled:item.enabled,pixels:Math.min(MAX,item.pixels),reversed:item.reversed,colour:portColour(item.port).hex}))};
    }
    if(!output||!editablePixels(output.pixels))return null;
    if(stage==='connection')return capabilities.direction===true?{...copy(context),port:output.port,pixels:output.pixels,guide:'direction',reversed:output.reversed,previewTTLMS:12000}:null;
    if(stage==='pixels')return {...copy(context),port:output.port,pixels:output.pixels};
    return null;
  }
  function validPreview(request){
    if(request?.guide==='ports')return request.port===null&&request.pixels===0&&request.previewTTLMS===12000&&Array.isArray(request.outputs)&&request.outputs.length===4&&request.outputs.every((item,index)=>item.port===index+1&&typeof item.enabled==='boolean'&&typeof item.reversed==='boolean'&&editablePixels(item.pixels)&&item.colour===PORT_COLOURS[index].hex);
    return Number.isInteger(request?.port)&&request.port>=1&&request.port<=4&&editablePixels(request.pixels)&&['length','power','direction',undefined].includes(request.guide)&&(request.guide==='power'||request.guide==='direction'?request.pixels>0&&typeof request.reversed==='boolean':request.reversed===undefined)&&(request.guide!=='direction'||request.previewTTLMS===12000);
  }
  function previewConfirmed(answer,request){
    const lit=request.guide==='ports'?request.outputs.some(item=>item.enabled&&item.pixels>0):request.pixels>0;
    if(answer?.applied!==true||answer.port!==request.port||answer.pixels!==request.pixels||!Number.isInteger(answer.previewTTLMS)||answer.previewTTLMS<(lit?1:0)||answer.previewTTLMS>15000)return false;
    if(request.guide==='power'||request.guide==='direction')return answer.guide===request.guide&&answer.reversed===request.reversed;
    if(!lit&&answer.previewTTLMS!==0)return false;
    if(request.guide==='ports')return answer.guide==='ports'&&Array.isArray(answer.outputs)&&answer.outputs.length===4&&answer.outputs.every((item,index)=>['port','enabled','pixels','reversed','colour'].every(key=>item[key]===request.outputs[index][key]));
    return true;
  }
  // One bounded latest-wins test-light queue. There is never a CONFIG/SAVE
  // command here. A lost reply remains an error, not a physical-light claim.
  function createLivePreview({send,onState=()=>{},delay=170,setTimer=setTimeout,clearTimer=clearTimeout}={}){
    let queued=null,active=null,desired=null,running=null,timer=null,renew=null,version=0;
    const key=r=>JSON.stringify([r.standId,r.transactionId,r.receiver,r.role,r.mainReceiverId,r.port,r.guide||'length']);
    const report=(kind,request)=>onState({kind,port:request?.port,pixels:request?.pixels,guide:request?.guide||'length',reversed:request?.reversed});
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
            if(item.stop){const stopped=active;await stopActive();if(!desired)report('idle',stopped);continue;}
            const request=item.request;
            if(active&&key(active)!==key(request))await stopActive();
            const action=active?'update':'start';active=request;
            const answer=await send({...request,action});
            if(!previewConfirmed(answer,request))throw Error('PIXEL_PREVIEW_UNCONFIRMED');
            if(item.version===version&&desired){report('applied',request);clearTimer(renew);if(answer.previewTTLMS>0)renew=setTimer(()=>{renew=null;if(desired){queued={request:desired,version};void drain();}},Math.min(10000,Math.max(500,answer.previewTTLMS-3000)));}
          }catch(error){
            if(item.version===version){desired=null;clearTimer(renew);renew=null;report(error?.code==='PIXEL_GUIDE_UPDATE_REQUIRED'?'unsupported':'failed',active);}
          }
        }
      })().finally(()=>{running=null;if(queued)void drain();});
      return running;
    }
    function update(request){
      if(typeof send!=='function')return;
      if(!validPreview(request))throw Error('PIXEL_PREVIEW_INVALID');
      const next=copy(request);if(desired&&JSON.stringify(desired)===JSON.stringify(next))return;
      desired=next;version++;clearTimer(renew);renew=null;queued={request:next,version};report('pending',next);
      if(timer===null&&!running)timer=setTimer(()=>void drain(),delay);
    }
    function stop(){
      if(typeof send!=='function')return Promise.resolve();
      desired=null;version++;cancelTimers();queued={stop:true,version};return drain();
    }
    function flush(){
      if(typeof send!=='function')return Promise.resolve();
      clearTimer(timer);timer=null;return drain();
    }
    return Object.freeze({update,flush,stop});
  }
  function previewMessage(state){return t(state.kind==='unsupported'?'pixelPreviewUnsupported':state.kind==='failed'?'pixelPreviewFailed':state.kind==='pending'?'pixelPreviewPending':state.kind==='applied'?(state.guide==='ports'?'pixelPreviewPorts':state.guide==='direction'?'pixelPreviewDirection':state.guide==='power'?'pixelPreviewPower':state.pixels?'pixelPreviewLength':'pixelPreviewZero'):'pixelNoTest',{port:state.port,count:state.pixels,direction:t(state.reversed?'pixelDirectionReverse':'pixelDirectionForward')});}
  function showPreviewStatus(container,state){const label=container?.querySelector(state.guide==='ports'?'[data-ports-preview-status]':['power','direction'].includes(state.guide)?'[data-power-preview-status]':'[data-pixel-preview] .pixel-preview-notice');if(label){label.textContent=previewMessage(state);label.dataset.testLight=state.kind;}}
  // Show bounded cleanup without repainting: repaint would enqueue the same
  // test light again. Restore only these captured DOM nodes, never a new page.
  function showPreviewStopping(container){
    if(!container)return ()=>{};
    const controls=Array.from(container.querySelectorAll('button,input'),control=>({control,disabled:control.disabled}));
    const region=container.querySelector('[data-onboarding-stage]')||container,wasBusy=region.getAttribute('aria-busy');
    const footer=container.querySelector('.pixel-setup-footer,.onboarding-footer');
    const next=footer?.querySelector('[data-pixel-action="next"],[data-onboarding-action="next"]'),label=next?.textContent;
    controls.forEach(({control})=>{control.disabled=true;});region.setAttribute('aria-busy','true');
    if(next)next.textContent=t('pixelStopping');
    const status=container.ownerDocument.createElement('p');status.className='pixel-preview-notice';status.dataset.previewStopping='true';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent=t('pixelStoppingChoices');
    if(footer)footer.before(status);
    return ()=>{controls.forEach(({control,disabled})=>{control.disabled=disabled;});if(next)next.textContent=label;status.remove();if(wasBusy===null)region.removeAttribute('aria-busy');else region.setAttribute('aria-busy',wasBusy);};
  }
  function create({onSave,onClose=()=>{},onPreview,mode='preview',previewCapabilities={}}={}){
    if(typeof onSave!=='function')throw Error('PIXEL_SAVE_HANDLER_REQUIRED');
    const limits=pixelLimits();
    let dialog=null,receiver=null,outputs=[],index=0,busy=false,error='',focusBefore=null,initialPort=null,selectedPort=null,selectedPorts=null,unbindScrub=null,recovering=false,previewStopJob=null;
    const plugMotion=globalThis.LightningReceiverVisual.createPlugMotion();
    let previewTransaction=null,previewState={kind:'idle'};
    const livePreview=createLivePreview({send:mode==='native'?onPreview:null,onState:state=>{previewState=state;showPreviewStatus(dialog,state);}});
    const plan=()=>sequence(outputs,{selectedPorts}),current=()=>plan()[index],output=()=>outputs.find(item=>item.port===current().port),portsToEdit=()=>editableOutputs(outputs,selectedPorts);
    function syncPreview({commit=false}={}){
      if(busy)return;
      if(!dialog||document.hidden){void livePreview.stop();return;}
      const request=guideRequest({context:{standId:receiver.standId,transactionId:previewTransaction,
        receiver:{id:receiver.id,rid:receiver.rid,type:'SPI',deviceFingerprint:receiver.deviceFingerprint},role:receiver.role,
        mainReceiverId:receiver.mainReceiverId||null},outputs,output:output(),stage:current().stage,capabilities:previewCapabilities});
      if(!request){void livePreview.stop();return;}
      livePreview.update(request);if(commit)void livePreview.flush();showPreviewStatus(dialog,previewState);
    }
    function visibility(){syncPreview();}
    function paint(time){if(dialog?.open&&['outputs','pixels','connection'].includes(current().stage)){const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;paintOutputs(dialog,outputs,{time,reducedMotion,selectedPort:current().port||selectedPort,plugProgress:current().stage==='outputs'?plugMotion.sample(time,reducedMotion):{}});}}
    function close(){if(!dialog||busy&&!previewStopJob)return;previewStopJob=null;busy=false;void livePreview.stop();document.removeEventListener('visibilitychange',visibility);unbindScrub?.();unbindScrub=null;dialog.close();dialog.remove();dialog=null;plugMotion.clear();focusBefore?.focus?.({preventScroll:true});onClose();}
    function render(top=false){
      if(!dialog)return;const previousScroll=dialog.querySelector('.pixel-setup-body')?.scrollTop||0,step=current(),ports=portsToEdit(),active=output(),allOff=!outputs.some(item=>item.enabled);
      const focusedPort=dialog.contains(document.activeElement)&&document.activeElement.dataset.pixelAction==='output'?document.activeElement.dataset.port:null;
      let content='';
      if(step.stage==='outputs')content=`<p>${esc(t('pixelChooseOutputs'))}</p>${selectedPorts?`<p>${esc(t('pixelSelectSummary',{ports:[...selectedPorts].sort().map(port=>`P${port}`).join(' + ')}))}</p>`:''}${renderOutputs(outputs,{initialPort,selectedPorts,live:mode==='native'&&previewCapabilities.identifyPorts===true})}${!allOff&&!ports.length?`<p class="pixel-setup-error" role="alert">${esc(t('pixelSelectedRequired'))}</p>`:''}`;
      if(active)content=`${renderPortContext(outputs,active.port,{stage:step.stage,selectedPorts})}${step.stage==='connection'?renderSide(active,{live:mode==='native'&&typeof onPreview==='function'&&previewCapabilities.direction===true}):renderPixels(active,limits)}`;
      if(step.stage==='review')content=`<p>${esc(t('pixelCheckOutputs'))} ${esc(t('pixelSameZone'))}</p><div class="pixel-setup-review">${outputs.map(item=>`<div style="--port-colour:${portColour(item.port).hex}" ${selectedPorts&&!selectedPorts.has(item.port)?'data-preserved="true"':''}><b>P${item.port}</b><span>${esc(t('pixelCount',{count:item.pixels}))} · ${esc(t(item.enabled?'pixelOn':'pixelOff'))}<small>${esc(endpointLabel(item))}${selectedPorts&&!selectedPorts.has(item.port)?' · '+esc(t('pixelPreserved')):''}</small></span></div>`).join('')}</div>`;
      dialog.innerHTML=`<div class="pixel-setup-shell"><header class="pixel-setup-header"><div><small>${esc(receiver.name||t('pixelReceiver'))}</small><h1>${esc(t(step.stage==='connection'?'pixelChooseStart':'pixelSettings'))}</h1></div><button type="button" data-pixel-action="close" aria-label="${esc(t('pixelCloseSettings'))}" ${busy?'disabled':''}>×</button></header>${renderProgress(step.stage)}<div class="pixel-setup-body" data-stage="${step.stage}" data-port="${step.port||''}">${content}<p class="pixel-setup-mode" id="pixel-setup-mode" ${mode==='preview'&&step.stage!=='review'?'hidden':''}>${esc(t(mode==='preview'?'pixelPreviewMode':mode==='native'?'pixelNativeMode':'pixelUnavailableMode'))}</p><p class="pixel-setup-error" role="alert" ${error?'':'hidden'}>${esc(error)}</p></div><footer class="pixel-setup-footer"><button type="button" data-pixel-action="back" ${busy?'disabled':''}>${esc(t('pixelBack'))}</button><button type="button" data-pixel-action="${step.stage==='review'?'save':'next'}" ${busy||!ports.length||step.stage==='pixels'&&!configuredPixels(active.pixels,limits)||step.stage==='review'&&(!['preview','native'].includes(mode)||ports.some(item=>!configuredPixels(item.pixels,limits)))?'disabled aria-describedby="pixel-setup-mode"':''}>${esc(busy?t('pixelSaving'):step.stage==='review'?t('pixelSave'):active?nextPortLabel(ports,active.port,{stage:step.stage,last:t('pixelCheck')}):t('pixelNext'))}</button></footer></div>`;
      if(recovering){const back=dialog.querySelector('[data-pixel-action="back"]');if(back){back.dataset.pixelAction='close';back.textContent=t('pixelClose');}}
      dialog.querySelector('.pixel-setup-body').scrollTop=top?0:previousScroll;
      if(!top&&focusedPort)dialog.querySelector(`[data-pixel-action="output"][data-port="${focusedPort}"]`)?.focus({preventScroll:true});
      paint(performance.now()/1000);
      syncPreview();
    }
    function adjust(value,source,{commit=false,haptic=true}={}){if(!dialog||busy||current().stage!=='pixels')return;const previous=output().pixels,number=Number(value),legacyDecrease=previous>limits.max&&validPixels(number)&&number<=previous;if(!validateInput(dialog,value,limits)&&!legacyDecrease){dialog.querySelector('[data-pixel-action="next"]').disabled=true;return;}output().pixels=number;updatePixels(dialog,output(),{source});dialog.querySelector('[data-pixel-action="next"]').disabled=!configuredPixels(output().pixels,limits);if(haptic&&output().pixels!==previous)hapticStep();error='';syncPreview({commit});}
    function input(event){if(busy)return;if(event.target.matches('[data-pixel-count],[data-pixel-range]'))adjust(event.target.value,event.target,{commit:event.type==='change'});}
    function commitKey(event){if(['Enter','ArrowUp','ArrowDown'].includes(event.key)&&event.target.matches('[data-pixel-count]'))adjust(event.target.value,event.target,{commit:event.key==='Enter'});}
    async function click(event){
      const target=event.target.closest('[data-pixel-action]');if(!target||target.disabled||busy&&!(previewStopJob&&target.dataset.pixelAction==='close'))return;
      const action=target.dataset.pixelAction,step=current();
      if(['next','back','save'].includes(action)&&['outputs','pixels','connection'].includes(step.stage)){
        const stoppingDialog=dialog,job={dialog:stoppingDialog};previewStopJob=job;busy=true;const restore=showPreviewStopping(stoppingDialog);
        // Leaving the editor never waits for transport cleanup. Navigation
        // within it still waits; a late STOP cannot advance a newer dialog.
        stoppingDialog.querySelector('[data-pixel-action="close"]')?.removeAttribute('disabled');
        try{await livePreview.stop();}finally{restore();if(previewStopJob===job&&dialog===stoppingDialog)busy=false;}
        if(previewStopJob!==job||dialog!==stoppingDialog)return;
        previewStopJob=null;
      }
      if(action==='close')return close();
      if(action==='output'){const item=outputs.find(item=>item.port===Number(target.dataset.port));if(!item||selectedPorts&&!selectedPorts.has(item.port))return;item.enabled=!item.enabled;selectedPort=item.port;plugMotion.trigger(item.port,performance.now()/1000,item.enabled);error='';return render();}
      if(['pixel-less','pixel-more','pixel-step'].includes(action)){const delta=action==='pixel-step'?Number(target.dataset.pixelDelta):action==='pixel-less'?-1:1;if(![-30,-15,-1,1,15,30].includes(delta))return;return adjust(stepPixels(output().pixels,delta,limits),null,{commit:false});}
      if(action==='side'){if(!['forward','reverse','left','right'].includes(target.dataset.side))return;output().reversed=['reverse','right'].includes(target.dataset.side);error='';render();void livePreview.flush();return;}
      if(action==='next'){if(!outputs.some(item=>item.enabled)||!portsToEdit().length)return render();if(step.stage==='pixels'&&(!validateInput(dialog,dialog.querySelector('[data-pixel-count]').value,limits)||!configuredPixels(output().pixels,limits)))return;index++;error='';return render(true);}
      if(action==='back'){if(!index)return close();index--;error='';return render(true);}
      if(action==='save'){if(!['preview','native'].includes(mode)||!portsToEdit().length||portsToEdit().some(item=>!configuredPixels(item.pixels,limits)))return;busy=true;error='';render();try{await onSave({receiverId:receiver.id,outputs:outputs.map(item=>!item.enabled&&item.pixels===0?{...item,pixels:receiver.outputs.find(original=>original.port===item.port)?.pixels||1}:copy(item))});busy=false;close();}catch(failure){busy=false;error=typeof failure?.message==='string'?failure.message:t('pixelSaveFailed');render();}}
    }
    function open(value,{initialPort:port,resumePending=false,selectedPorts:requestedPorts=null}={}){
      if(dialog)throw Error('PIXEL_SETUP_ALREADY_OPEN');selectedPorts=selectedPortSet(resumePending?null:requestedPorts);outputs=outputsOf(value);receiver=copy(value);previewTransaction=previewId();previewState={kind:'idle'};document.addEventListener('visibilitychange',visibility);initialPort=Number.isInteger(port)&&port>=1&&port<=4?port:null;selectedPort=null;plugMotion.clear();index=0;error='';busy=false;focusBefore=document.activeElement;
      recovering=resumePending===true;
      if(recovering){index=plan().length-1;error=t('pixelPendingConfig');}
      dialog=document.createElement('dialog');dialog.className='pixel-setup-dialog';dialog.setAttribute('aria-label',t('pixelDialogAria'));dialog.addEventListener('click',click);dialog.addEventListener('input',input);dialog.addEventListener('change',input);dialog.addEventListener('keyup',commitKey);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});unbindScrub=bindPixelScrub(dialog,{isEnabled:()=>!busy&&current().stage==='pixels',onChange:value=>adjust(value,null,{haptic:false}),onCommit:()=>void livePreview.flush()});document.body.append(dialog);render(true);dialog.showModal();paint(performance.now()/1000);
    }
    return Object.freeze({open,close,paint,isOpen:()=>!!dialog});
  }
  return Object.freeze({TEXTS,PORT_COLOURS,portColour,guideRequest,create,createLivePreview,showPreviewStatus,showPreviewStopping,renderOutputs,paintOutputs,renderPixels,renderSide,renderPort,renderProgress,renderPortContext,nextPortLabel,bindPixelScrub,updatePixels,validateInput,outputsOf,sequence,validPixels,pixelLimits,editablePixels,configuredPixels,stepPixels,stepMeters,meterLabel,endpointLabel,hapticStep});
}));
