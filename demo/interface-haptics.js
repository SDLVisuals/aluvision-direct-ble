/* Optional, local feedback for deliberate interface actions. The composition
 * root supplies confirmed outcomes; this helper never judges receiver success,
 * changes state, observes rendering or adds pointer/scroll/slider listeners. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.LightningInterfaceHaptics=factory(root);
})(typeof window==='object'?window:globalThis,function(root){
  'use strict';
  const kinds=new Set(['selection','impact','success','warning']);
  const selectionActions=new Set([
    'select','scope-toggle-lines','swatch','brand-swatch','channel-toggle',
    'direction','effect-boolean','background-toggle','power','receiver-filter',
    'animation-category-tab','animation-category-choice','library','language',
    'theme','preview-size','brand-tone','scene-zone','scene-select-all',
    'scene-clear-selection','assignment-many-toggle','assignment-many-select-all',
    'assignment-many-type','assignment-zone','visual-port','settings-toggle',
    'onboarding:output','onboarding:receiver','onboarding:active-zone',
    'onboarding:side','onboarding:zone-picker-confirm'
  ]);
  const impactActions=new Set([
    'nav','back','zone','overview-zone','colour','animations','effects','effects-root',
    'animation-gallery','animations-gallery','animation-current-edit','family','family-back',
    'animation-categories','preview-fullscreen','help','close-help','effect-dialog-close',
    'layout','line-setup-open','layout-receiver-settings','order-tutorial-open',
    'order-tutorial-close','stand-controls','stand-zones-info','stand-receivers-info',
    'scene-open','scene-new','scene-edit','colours-manager','colours-manage',
    'palette-edit','background-edit','preset-save','brand-colour-edit','brand-colour-add',
    'onboarding:next','onboarding:back','onboarding:zone-picker-open',
    'onboarding:close','onboarding:zone-picker-cancel','onboarding:exit'
  ]);
  const handledEvents=new WeakMap(),recentKeys=new Map();
  let lastAt=-Infinity,destroyed=false;
  const now=()=>root.performance?.now?.()??Date.now();
  function visible(){return !destroyed&&root.document?.visibilityState!=='hidden'&&!root.document?.hidden;}
  function deliberate(options){
    const event=options?.event;
    return event?event.isTrusted===true&&['click','pointerdown','pointerup','keydown','keyup'].includes(event.type)&&
      !event.repeat&&(!('button' in event)||event.button===0)&&
      !event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey:options?.userInitiated===true;
  }
  function emit(kind,key,options={}){
    if(!visible()||!kinds.has(kind)||typeof key!=='string'||!key.length||key.length>96||
       !deliberate(options)||(['success','warning'].includes(kind)&&options.confirmed!==true))return false;
    const event=options.event,phase=['success','warning'].includes(kind)?kind:'activation';
    if(event&&handledEvents.get(event)?.has(phase))return false;
    const time=now(),interval=kind==='selection'?65:kind==='impact'?100:180;
    if(!Number.isFinite(time)||time-lastAt<interval)return false;
    // Completion keys identify an operation, never its typed name/credentials.
    // A repeated ACK is not a second user completion or a reason to vibrate.
    if(['success','warning'].includes(kind)&&time-(recentKeys.get(key)??-Infinity)<1200)return false;
    let sent=false;
    try{sent=root.LightningNativeRuntime?.interfaceFeedback?.(kind)===true;}
    catch(_){/* Unsupported feedback cannot fail the actual user action. */}
    if(!sent)return false; // Browser/demo and older hosts safely do nothing.
    lastAt=time;
    if(event){const handled=handledEvents.get(event)||new Set();handled.add(phase);handledEvents.set(event,handled);}
    if(['success','warning'].includes(kind)){
      recentKeys.set(key,time);
      for(const [saved,at] of recentKeys)if(time-at>=1200||recentKeys.size>24)recentKeys.delete(saved);
    }
    return true;
  }
  function activate(event,action){
    if(!visible()||typeof action!=='string')return false;
    const target=event?.target?.closest?.('button[data-action],button[data-onboarding-action]');
    if(!target||target.disabled||target.isConnected===false||target.getAttribute?.('aria-disabled')==='true'||
       target.closest?.('[inert]')||target.closest?.('[data-interface-haptics="off"]')||
       target.matches?.('input,[data-order-handle],.order-handle,.colour-drag-handle'))return false;
    // This is a touch/choice acknowledgment, never a save/start confirmation.
    if(selectionActions.has(action))return emit('selection','action:'+action,{event});
    if(impactActions.has(action))return emit('impact','action:'+action,{event});
    return false;
  }
  return Object.freeze({emit,activate,destroy(){destroyed=true;recentKeys.clear();}});
});
