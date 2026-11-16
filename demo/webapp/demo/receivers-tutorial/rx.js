/* De Receivers-tab in de tutorial (receivers-tab-tutorial.js): dezelfde module als de app (receivers-tab.js) met
 * voorbeeldreceivers. Wat de app bij een knop doet (knipperen, een ledline aan of uit, een andere zone), doet deze pagina
 * hier na op de voorbeelden. Geen verbinding, geen opslag. window.__rx geeft de tutorial de toestand voor "Je stand".
 */
(function(){
'use strict';
const HEX={1:'#ff0000',2:'#2f6bff',3:'#ffc61a',4:'#ff7a1a'};
const line=(port,on,px)=>({port,on,px:on?px:0,hex:HEX[port],blinking:false});
const START=()=>({
  zones:[{id:'z1',name:'Balie',type:'spi'},{id:'z2',name:'Achterwand',type:'rgbw'}],
  receivers:[
    {id:'r1',name:'SPI balie',label:'SPI balie',type:'spi',zoneId:'z1',online:true,me:true,blinking:false,canOrder:true,
      lines:[line(1,true,120),line(2,true,120),line(3,true,96),line(4,false,0)],version:'C248',signal:'strong'},
    {id:'r2',name:'RGBW links',label:'RGBW links',type:'rgbw',zoneId:'z2',online:true,me:false,blinking:false,canOrder:true,lines:null,version:'C248',signal:'good'},
    {id:'r3',name:'RGBW rechts',label:'RGBW rechts',type:'rgbw',zoneId:'z2',online:true,me:false,blinking:false,canOrder:true,lines:null,version:'C248',signal:'good'}],
  canUpdate:true,extra:''});
let S=START();
const main=document.getElementById('main');
const tab=window.LightningReceiversTab.create({getState:()=>S,
  onOrder:()=>{},onTutorial:()=>{},
  onMove:(id,zoneId)=>{const r=S.receivers.find(x=>x.id===id);if(r){r.zoneId=zoneId;render();}},
  onNewZone:(id,name)=>{const zid='z'+(S.zones.length+1);S.zones.push({id:zid,name,type:S.receivers.find(x=>x.id===id)?.type||''});const r=S.receivers.find(x=>x.id===id);if(r)r.zoneId=zid;render();}});
function render(){main.innerHTML=tab.listHtml();tab.bind(main);tab.refresh();}
// wat de app bij deze knoppen doet, op de voorbeelden
document.addEventListener('click',event=>{
  const b=event.target.closest('button[data-action]');if(!b||b.disabled)return;
  const r=S.receivers.find(x=>x.id===(b.dataset.receiver||b.dataset.id));
  const a=b.dataset.action;
  if(a==='visual-identify'&&r){r.blinking=!r.blinking;render();}
  else if(a==='port-identify'&&r){const l=r.lines?.find(x=>x.port===+b.dataset.port);if(l){l.blinking=!l.blinking;render();}}
  else if(a==='receiver-port-enabled'&&r){const l=r.lines?.find(x=>x.port===+b.dataset.port);if(l){l.on=!l.on;l.px=l.on?120:0;render();}}
  else if(a==='receiver-pixels-only'&&r){const l=r.lines?.find(x=>String(x.port)===String(b.dataset.ports));if(l&&!l.on){setTimeout(()=>{l.on=true;l.px=120;render();},900);}}
});
render();
window.__rx={state:()=>S,reset:()=>{tab.closeAll();S=START();render();scrollTo(0,0);},render,tab,
  open:id=>tab.openReceiver(id),closeAll:()=>tab.closeAll()};
})();
