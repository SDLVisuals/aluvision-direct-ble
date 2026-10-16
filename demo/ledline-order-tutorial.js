(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.LightningLedlineOrderTutorial=factory();
}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Local explanatory playback. No model, receiver, bridge or storage access.
  const DURATIONS=Object.freeze([1800,1600,1800,800]);
  const mounts=new WeakMap();
  function mount(root){
    if(!root)return ()=>{};
    mounts.get(root)?.();
    const doc=root.ownerDocument,view=doc.defaultView;
    const media=view.matchMedia('(prefers-reduced-motion: reduce)');
    let phase=media.matches?4:0,remaining=DURATIONS[phase]||0;
    let playing=false,disposed=false,timer=null,startedAt=0,generation=0;
    const toggle=root.querySelector('[data-tutorial-action665="toggle"]');
    const now=()=>view.performance.now();
    function paint(){
      root.dataset.phase=String(phase);root.dataset.playing=String(playing);
      root.dataset.reducedMotion=String(media.matches);
      root.querySelectorAll('[data-story-caption665]').forEach(node=>{node.hidden=Number(node.dataset.storyCaption665)!==phase;});
      root.querySelectorAll('[data-tutorial-action665="step"]').forEach(node=>{
        const selected=Number(node.dataset.phase665)===(phase===0?0:phase===4?4:2);
        if(selected)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');
      });
      if(toggle){
        toggle.querySelector('[data-play-label665]').textContent=playing?toggle.dataset.labelPause:toggle.dataset.labelPlay;
        toggle.querySelector('[data-play-symbol665]').textContent=playing?'Ⅱ':'▶';
        toggle.disabled=phase===4;
      }
    }
    function pause(){
      generation++;
      if(timer!==null){view.clearTimeout(timer);timer=null;remaining=Math.max(0,remaining-(now()-startedAt));}
      playing=false;paint();
    }
    function schedule(){
      if(disposed||doc.hidden||phase===4)return;
      playing=true;paint();startedAt=now();
      const token=++generation;
      timer=view.setTimeout(()=>{
        if(disposed||token!==generation||!playing||doc.hidden||root.isConnected===false)return;
        timer=null;
        phase++;remaining=DURATIONS[phase]||0;
        if(phase===4){playing=false;paint();}else schedule();
      },remaining);
    }
    function seek(next,{play=false}={}){
      pause();phase=next;remaining=DURATIONS[phase]||0;paint();
      if(play&&!media.matches)schedule();
    }
    function click(event){
      const button=event.target.closest?.('[data-tutorial-action665]');
      if(!button||!root.contains(button)||button.disabled)return;
      const action=button.dataset.tutorialAction665;
      if(action==='toggle'){if(playing)pause();else schedule();}
      if(action==='replay')seek(0,{play:true});
      if(action==='step')seek(Number(button.dataset.phase665));
    }
    function visibility(){if(doc.hidden)pause();}
    function motion(){if(media.matches)seek(4);else paint();}
    root.addEventListener('click',click);doc.addEventListener('visibilitychange',visibility);
    media.addEventListener('change',motion);paint();
    mounts.set(root,dispose);
    if(!media.matches)schedule();
    function dispose(){
      if(disposed)return;pause();disposed=true;
      root.removeEventListener('click',click);doc.removeEventListener('visibilitychange',visibility);
      media.removeEventListener('change',motion);
      if(mounts.get(root)===dispose)mounts.delete(root);
    }
    return dispose;
  }
  return Object.freeze({mount,DURATIONS});
}));
