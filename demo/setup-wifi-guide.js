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
    // A generic enclosure illustration, not a model/port-count or live status
    // assertion. No invented power button, detected type or identify animation.
    const receiver='<svg viewBox="0 0 112 88" focusable="false"><ellipse class="wifi-guide-shadow728" cx="61" cy="74" rx="39" ry="5"/><path class="wifi-guide-wire728" d="M3 36h9q8 0 8 8"/><path class="wifi-guide-wire-core728" d="M3 36h9q8 0 8 8"/><path class="wifi-guide-enclosure-side728" d="M20 29v24q0 5 6 6l66-5q6-1 6-6V27Z"/><path class="wifi-guide-enclosure728" d="m25 20 65-3q7 0 9 7l2 17q0 6-6 7l-68 5q-7 0-8-6l-2-18q-1-8 8-9Z"/><path class="wifi-guide-cover728" d="m32 24 47-2q4 0 5 4l1 13-51 3-2-18Z"/><path class="wifi-guide-seam728" d="m28 21 3 31m56-34 3 31"/><g class="wifi-guide-screw728"><circle cx="23" cy="28" r="1.4"/><circle cx="26" cy="44" r="1.4"/><circle cx="93" cy="25" r="1.4"/><circle cx="95" cy="40" r="1.4"/></g><text class="wifi-guide-brand728" x="57" y="34" transform="rotate(-3 57 34)">ALUVISION</text><g class="wifi-guide-connector728"><path d="m32 52 1 13m17-14 1 13m17-14 1 13m17-14 1 13"/><ellipse cx="32" cy="53" rx="5.3" ry="4.1"/><ellipse cx="50" cy="52" rx="5.3" ry="4.1"/><ellipse cx="68" cy="51" rx="5.3" ry="4.1"/><ellipse cx="86" cy="50" rx="5.3" ry="4.1"/></g><g class="wifi-guide-socket728"><ellipse cx="32" cy="54" rx="2.7" ry="2"/><ellipse cx="50" cy="53" rx="2.7" ry="2"/><ellipse cx="68" cy="52" rx="2.7" ry="2"/><ellipse cx="86" cy="51" rx="2.7" ry="2"/></g></svg>';
    const network='<svg viewBox="0 0 112 88" focusable="false"><ellipse class="wifi-guide-shadow728" cx="58" cy="80" rx="28" ry="4"/><rect class="wifi-guide-phone728" x="35" y="6" width="42" height="73" rx="10"/><rect class="wifi-guide-screen728" x="40" y="18" width="32" height="49" rx="4"/><path class="wifi-guide-detail728" d="M49 12h14m-11 61h8"/><path class="wifi-guide-accent674" d="M46 31a16 16 0 0 1 20 0m-16 6a10 10 0 0 1 12 0m-8 6a3.5 3.5 0 0 1 4 0"/><rect class="wifi-guide-network-row728" x="14" y="49" width="84" height="22" rx="8"/><path class="wifi-guide-accent674" d="M21 57a8 8 0 0 1 10 0m-8 4a4 4 0 0 1 6 0"/><text class="wifi-guide-network-name728" x="37" y="63">ALUVISION</text></svg>';
    const app='<svg viewBox="0 0 112 88" focusable="false"><ellipse class="wifi-guide-shadow728" cx="58" cy="80" rx="28" ry="4"/><rect class="wifi-guide-phone728" x="35" y="6" width="42" height="73" rx="10"/><rect class="wifi-guide-screen728" x="40" y="18" width="32" height="49" rx="4"/><path class="wifi-guide-detail728" d="M49 12h14m-11 61h8"/><rect class="wifi-guide-app728" x="44" y="29" width="24" height="25" rx="7"/><path class="wifi-guide-app-lines728" d="M50 45v-7m6 10V35m6 10v-7"/><path class="wifi-guide-return674" d="M11 42h24m-7-7 7 7-7 7"/></svg>';
    const rows=[
      [receiver,'wifi674PowerTitle','Zet de receiver aan','wifi674PowerHint','Laat hem aan tijdens het instellen.'],
      [network,'wifi674NetworkTitle','Open Instellingen → Wifi','wifi674NetworkHint','Kies het ALUVISION-netwerk van je receiver.'],
      [app,'wifi674ReturnTitle','Ga terug naar de app','wifi674ReturnHint','Controleer hier de verbinding.']
    ];
    return `<ol class="onboarding-wifi-tiles onboarding-wifi-steps wifi-guide674" data-setup-visual="wifi-instructions" aria-label="${escape(t('wifi674FlowLabel','Zo verbind je een receiver'))}">${rows.map(([svg,title,fallback,hint,hintFallback],index)=>`<li><span class="wifi-guide-art674" aria-hidden="true">${svg}</span><span class="wifi-guide-copy674"><b><i class="wifi-guide-step674" aria-hidden="true">${index+1}</i><span>${escape(t(title,fallback))}</span></b><small>${escape(t(hint,hintFallback))}</small></span></li>`).join('')}</ol>`;
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
