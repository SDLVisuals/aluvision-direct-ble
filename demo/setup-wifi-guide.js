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
  function stepsMarkup(){
    // Instructions only: these drawings do not represent a detected receiver,
    // a successful Wi-Fi connection, or permission to probe a device.
    const receiver='<svg viewBox="0 0 80 72" focusable="false"><path class="wifi-guide-cable674" d="M5 42h12m0-5v10m-6-11v12"/><rect class="wifi-guide-body674" x="20" y="24" width="50" height="31" rx="8"/><path d="M28 33v12m7-12v12m7-12v12m7-12v12"/><path class="wifi-guide-accent674" d="M60 32v7m-4-4a6 6 0 1 0 8 0"/><path d="M29 55v5m32-5v5"/></svg>';
    const network='<svg viewBox="0 0 80 72" focusable="false"><rect class="wifi-guide-body674" x="22" y="6" width="37" height="60" rx="9"/><path d="M34 12h13m-9 48h7"/><path class="wifi-guide-accent674" d="M29 27a18 18 0 0 1 23 0m-18 6a10 10 0 0 1 13 0m-8 6a3 3 0 0 1 3 0"/><path d="M29 48h23m-23 5h16"/></svg>';
    const app='<svg viewBox="0 0 80 72" focusable="false"><rect class="wifi-guide-body674" x="22" y="6" width="37" height="60" rx="9"/><path d="M34 12h13m-9 48h7"/><rect class="wifi-guide-accent674" x="30" y="24" width="21" height="22" rx="5"/><path class="wifi-guide-accent674" d="M36 39v-8m5 8V28m5 11v-8"/><path class="wifi-guide-return674" d="M8 25h8m-4-4 4 4-4 4"/></svg>';
    const rows=[
      [receiver,'wifi674PowerTitle','Zet de receiver aan','wifi674PowerHint','Laat hem aan tijdens het instellen.'],
      [network,'wifi674NetworkTitle','Open Instellingen → Wifi','wifi674NetworkHint','Kies het ALUVISION-netwerk van je receiver.'],
      [app,'wifi674ReturnTitle','Ga terug naar de app','wifi674ReturnHint','Controleer hier de verbinding.']
    ];
    return `<ol class="onboarding-wifi-tiles onboarding-wifi-steps wifi-guide674" data-setup-visual="wifi-instructions" aria-label="${escape(t('wifi674FlowLabel','Zo verbind je een receiver'))}">${rows.map(([svg,title,fallback,hint,hintFallback],index)=>`<li><span class="wifi-guide-art674" aria-hidden="true">${svg}${index===1?'<span class="wifi-guide-network674">ALUVISION</span>':''}</span><span class="wifi-guide-copy674"><b><i class="wifi-guide-step674" aria-hidden="true">${index+1}</i>${escape(t(title,fallback))}</b><small>${escape(t(hint,hintFallback))}</small></span></li>`).join('')}</ol>`;
  }
  // Retain the API for older callers, but never render a generic password or
  // copy action. Existing authenticated network/PIN flows remain separate.
  function markup(){return '';}
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
