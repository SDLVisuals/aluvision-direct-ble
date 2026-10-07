/* Public factory instructions, never a user's chosen stand credential. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LightningSetupWifiGuide=api;
}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Exact case of AluvisionStandCodeV40::SetupPassword, both receiver models.
  const factoryPassword='aluvision';
  function markup(){return `<section class="onboarding-factory-access" aria-label="Wifi van een nieuwe receiver"><span class="onboarding-factory-icon" aria-hidden="true">⌁</span><div><small>Wachtwoord bij de eerste installatie</small><div class="onboarding-factory-code"><input type="text" value="${factoryPassword}" readonly aria-label="Fabriekswachtwoord" data-factory-password spellcheck="false" autocomplete="off"><button type="button" class="button secondary" data-onboarding-action="copy-factory-wifi" aria-label="Fabriekswachtwoord kopiëren">Kopieer</button></div><p>Daarna kies je je eigen wifi-PIN.</p><span role="status" data-factory-copy-status></span></div></section>`;}
  async function copy({clipboard,field,status,current=()=>true}={}){
    if(!field||field.value!==factoryPassword)return false;
    try{
      if(typeof clipboard?.writeText!=='function')throw Error('CLIPBOARD_UNAVAILABLE');
      await clipboard.writeText(factoryPassword);
      if(current()&&status)status.textContent='Gekopieerd';
      return true;
    }catch(_){
      if(current()){
        field.focus({preventScroll:true});field.select();
        if(status)status.textContent='Houd de selectie ingedrukt en kies Kopieer.';
      }
      return false;
    }
  }
  function canProbe({mounted,hidden,manualWifi,stage,busy,saving,pending,firstAccess,searching,identifying}={}){
    return mounted===true&&hidden===false&&manualWifi===true&&stage==='receiver'&&busy===false&&saving===false&&pending===false&&firstAccess===false&&searching===false&&identifying===false;
  }
  return Object.freeze({markup,copy,canProbe});
}));
