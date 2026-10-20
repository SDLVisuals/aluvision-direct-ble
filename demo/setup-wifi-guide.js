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
    // A neutral product enclosure follows the existing receiver material and
    // proportions. Its closed face deliberately implies no detected type or
    // output count, power button, live signal or identification status.
    const receiver='<svg viewBox="0 0 144 104" focusable="false"><ellipse class="wifi-guide-shadow728" cx="77" cy="85" rx="53" ry="7"/><path class="wifi-guide-wire728" d="M2 58h8q10 0 16-5"/><path class="wifi-guide-wire-core728" d="M2 58h8q10 0 16-5"/><path class="wifi-guide-enclosure-side728" d="m22 42 107-7 3 27q1 8-8 10l-92 8q-8 1-9-7Z"/><path class="wifi-guide-enclosure728" d="m28 25 89-6q9-1 11 8l5 30q1 9-9 10l-91 8q-10 1-12-8l-4-29q-1-11 11-13Z"/><path class="wifi-guide-cover728" d="m43 29 61-4q6 0 7 6l4 26-68 5-4-33Z"/><path class="wifi-guide-seam728" d="m35 25 6 49m74-55 6 49"/><path class="wifi-guide-highlight756" d="m30 29 88-6q6 0 7 6M26 66q1 5 7 5l91-8"/><g class="wifi-guide-screw728"><circle cx="27" cy="36" r="2"/><circle cx="31" cy="63" r="2"/><circle cx="121" cy="29" r="2"/><circle cx="125" cy="56" r="2"/></g><text class="wifi-guide-brand728" x="78" y="43" transform="rotate(-4 78 43)">ALUVISION</text><path class="wifi-guide-label756" d="m62 49 32-2m-25 7 18-1"/><path class="wifi-guide-gland756" d="m20 49-6 1 1 11 7-2"/></svg>';
    const network='<svg viewBox="0 0 112 88" focusable="false"><ellipse class="wifi-guide-shadow728" cx="58" cy="80" rx="28" ry="4"/><rect class="wifi-guide-phone728" x="35" y="6" width="42" height="73" rx="10"/><rect class="wifi-guide-screen728" x="40" y="18" width="32" height="49" rx="4"/><path class="wifi-guide-detail728" d="M49 12h14m-11 61h8"/><path class="wifi-guide-accent674" d="M46 31a16 16 0 0 1 20 0m-16 6a10 10 0 0 1 12 0m-8 6a3.5 3.5 0 0 1 4 0"/><rect class="wifi-guide-network-row728" x="14" y="49" width="84" height="22" rx="8"/><path class="wifi-guide-accent674" d="M21 57a8 8 0 0 1 10 0m-8 4a4 4 0 0 1 6 0"/><text class="wifi-guide-network-name728" x="37" y="63">ALUVISION</text></svg>';
    const app='<svg viewBox="0 0 112 88" focusable="false"><ellipse class="wifi-guide-shadow728" cx="58" cy="80" rx="28" ry="4"/><rect class="wifi-guide-phone728" x="35" y="6" width="42" height="73" rx="10"/><rect class="wifi-guide-screen728" x="40" y="18" width="32" height="49" rx="4"/><path class="wifi-guide-detail728" d="M49 12h14m-11 61h8"/><rect class="wifi-guide-app728" x="44" y="29" width="24" height="25" rx="7"/><path class="wifi-guide-app-lines728" d="M50 45v-7m6 10V35m6 10v-7"/><path class="wifi-guide-return674" d="M11 42h24m-7-7 7 7-7 7"/></svg>';
    const rows=[
      [receiver,'wifi674PowerTitle','Zet de receiver aan','wifi674PowerHint','Laat hem aan tijdens het instellen.'],
      [network,'wifi674NetworkTitle','Open Instellingen → Wifi','wifi674NetworkHint','Kies het ALUVISION-netwerk van je receiver.'],
      [app,'wifi674ReturnTitle','Ga terug naar de app','wifi674ReturnHint','Controleer hier de verbinding.']
    ];
    return `<ol class="onboarding-wifi-tiles onboarding-wifi-steps wifi-guide674 wifi-guide756" data-setup-visual="wifi-instructions" aria-label="${escape(t('wifi674FlowLabel','Zo verbind je een receiver'))}">${rows.map(([svg,title,fallback,hint,hintFallback],index)=>`<li><span class="wifi-guide-art674" aria-hidden="true">${svg}</span><span class="wifi-guide-copy674"><b><i class="wifi-guide-step674" aria-hidden="true">${index+1}</i><span>${escape(t(title,fallback))}</span></b><small>${escape(t(hint,hintFallback))}</small></span></li>`).join('')}</ol>`;
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
