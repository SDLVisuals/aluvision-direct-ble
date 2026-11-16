/* C102 swipe rows: drag a scene card to the left to reveal its actions
 * (Details, Delete). Presentation only; the revealed buttons use the app's
 * existing data-action handlers, including the delete confirmation. */
(function(){
  'use strict';
  const ROW='[data-scene-swipe102]',ACTIONS='.scene-swipe-actions102';
  let drag=null,open=null,suppressClick=false;
  const width=row=>row.querySelector(ACTIONS)?.getBoundingClientRect().width||0;
  function setOffset(row,px){row.style.setProperty('--swipe102',px+'px');}
  function close(row=open){
    if(!row)return;row.classList.remove('is-open102');row.style.removeProperty('--swipe102');
    row.querySelectorAll(`${ACTIONS} button`).forEach(button=>button.tabIndex=-1);
    if(open===row)open=null;
  }
  function reveal(row){
    if(open&&open!==row)close(open);
    row.classList.add('is-open102');row.style.removeProperty('--swipe102');open=row;
    row.querySelectorAll(`${ACTIONS} button`).forEach(button=>button.tabIndex=0);
  }
  document.addEventListener('pointerdown',event=>{
    const row=event.target.closest?.(ROW);
    if(open&&(!row||row!==open)&&!event.target.closest?.(ACTIONS))close(open);
    if(!row||event.button!==0||event.target.closest(ACTIONS))return;
    drag={row,id:event.pointerId,x:event.clientX,y:event.clientY,base:row.classList.contains('is-open102')?-width(row):0,offset:0,moved:false};
  },true);
  document.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moved){
      if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){drag=null;return;}   // vertical scroll wins
      if(Math.abs(dx)<10)return;
      drag.moved=true;drag.row.classList.add('is-dragging102');
      try{drag.row.setPointerCapture(event.pointerId);}catch(_){}
    }
    const max=width(drag.row);
    // A little rubber band past the actions, none to the right.
    let offset=Math.min(0,drag.base+dx);if(offset<-max)offset=-max+(offset+max)*.25;
    drag.offset=offset;setOffset(drag.row,offset);event.preventDefault();
  },{passive:false});
  function end(event){
    if(!drag||event.pointerId!==drag.id)return;
    const {row,moved,offset}=drag;drag=null;row.classList.remove('is-dragging102');
    if(!moved)return;
    suppressClick=true;setTimeout(()=>{suppressClick=false;},0);
    if(offset<-width(row)/2)reveal(row);else close(row);
  }
  document.addEventListener('pointerup',end,true);
  document.addEventListener('pointercancel',event=>{if(drag&&event.pointerId===drag.id){close(drag.row);drag.row.classList.remove('is-dragging102');drag=null;}},true);
  // A drag must not also open the scene underneath.
  document.addEventListener('click',event=>{
    if(suppressClick){event.preventDefault();event.stopImmediatePropagation();suppressClick=false;return;}
    if(open&&event.target.closest?.(`${ACTIONS} button`))setTimeout(()=>close(open),0);
  },true);
  // Keyboard: focusing a revealed action keeps its row open.
  document.addEventListener('focusin',event=>{const row=event.target.closest?.(ROW);if(row&&event.target.closest(ACTIONS))reveal(row);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&open)close(open);});
}());
