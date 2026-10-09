/* Public factory instructions, never a user's chosen stand credential. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LightningSetupWifiGuide=api;
}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Exact case of AluvisionStandCodeV40::SetupPassword, both receiver models.
  const factoryPassword='aluvision';
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const t=(key,fallback)=>{const language=globalThis.document?.documentElement?.lang||'nl',value=globalThis.LightningSetupTranslations?.[language]?.[key]||globalThis.LightningPreferences?.t(key,language);return value&&value!==key?value:fallback;};
  function stepsMarkup(){return `<ol class="onboarding-wifi-tiles onboarding-wifi-steps" data-setup-visual="wifi-instructions" aria-label="${escape(t('wifiFirstReceiver','Verbinden met je eerste receiver'))}"><li><span><b>${escape(t('wifiTurnOn','Zet de receiver aan'))}</b><small>${escape(t('wifiReceiverTypes','RGBW of SPI'))}</small></span></li><li><span><b>${escape(t('wifiOpenSettings','Instellingen → Wifi'))}</b><small>${escape(t('wifiSelectFactory','Kies het ALUVISION-netwerk van je eerste receiver.'))}</small></span></li><li><span><b>${escape(t('wifiReturnApp','Terug naar de app'))}</b><small>${escape(t('wifiCheckReceiver','De app controleert je receiver.'))}</small></span></li></ol>`;}
  function markup({connection=false}={}){return `<section class="onboarding-factory-access" aria-label="${escape(t('wifiNewReceiver','Wifi van een nieuwe receiver'))}"><span class="onboarding-factory-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 16a5.5 5.5 0 0 1 7 0"/><circle cx="12" cy="20" r="1"/></svg></span><div><small>${escape(t('wifiPassword','Wifiwachtwoord'))}</small><div class="onboarding-factory-code"><input type="text" value="${factoryPassword}" readonly aria-label="${escape(t('wifiFactoryPassword','Fabriekswachtwoord'))}" data-factory-password spellcheck="false" autocomplete="off"><button type="button" class="button secondary" ${connection?'data-action="stand-copy-factory-wifi"':'data-onboarding-action="copy-factory-wifi"'} aria-label="${escape(t('wifiCopyFactory','Fabriekswachtwoord kopiëren'))}">${escape(t('copy','Kopieer'))}</button></div><span role="status" aria-live="polite" data-factory-copy-status></span></div></section>`;}
  async function copy({clipboard,field,status,current=()=>true}={}){
    if(!field||field.value!==factoryPassword)return false;
    try{
      if(typeof clipboard?.writeText!=='function')throw Error('CLIPBOARD_UNAVAILABLE');
      await clipboard.writeText(factoryPassword);
      if(current()&&status)status.textContent=t('copied','Gekopieerd');
      return true;
    }catch(_){
      if(current()){
        field.focus({preventScroll:true});field.select();
        if(status)status.textContent=t('wifiCopyFallback','Houd de selectie ingedrukt en kies Kopieer.');
      }
      return false;
    }
  }
  function canProbe({mounted,hidden,manualWifi,stage,busy,saving,pending,firstAccess,searching,identifying}={}){
    return mounted===true&&hidden===false&&manualWifi===true&&stage==='receiver'&&busy===false&&saving===false&&pending===false&&firstAccess===false&&searching===false&&identifying===false;
  }
  return Object.freeze({stepsMarkup,markup,copy,canProbe});
}));
