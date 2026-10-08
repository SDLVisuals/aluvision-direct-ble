/* Public factory instructions, never a user's chosen stand credential. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LightningSetupWifiGuide=api;
}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Exact case of AluvisionStandCodeV40::SetupPassword, both receiver models.
  const factoryPassword='aluvision';
  function stepsMarkup(){return '<ol class="onboarding-wifi-tiles onboarding-wifi-steps" data-setup-visual="wifi-instructions" aria-label="Verbinden met je eerste receiver"><li><span><b>Zet de receiver aan</b><small>RGBW of SPI</small></span></li><li><span><b>Instellingen → Wifi</b><small>Kies het ALUVISION-netwerk van je eerste receiver.</small></span></li><li><span><b>Terug naar de app</b><small>De app controleert je receiver.</small></span></li></ol>';}
  function markup({connection=false}={}){return `<section class="onboarding-factory-access" aria-label="Wifi van een nieuwe receiver"><span class="onboarding-factory-icon" aria-hidden="true">⌁</span><div><small>Wifiwachtwoord</small><div class="onboarding-factory-code"><input type="text" value="${factoryPassword}" readonly aria-label="Fabriekswachtwoord" data-factory-password spellcheck="false" autocomplete="off"><button type="button" class="button secondary" ${connection?'data-action="stand-copy-factory-wifi"':'data-onboarding-action="copy-factory-wifi"'} aria-label="Fabriekswachtwoord kopiëren">Kopieer</button></div><span role="status" aria-live="polite" data-factory-copy-status></span></div></section>`;}
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
  return Object.freeze({stepsMarkup,markup,copy,canProbe});
}));
