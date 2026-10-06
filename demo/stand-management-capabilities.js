(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LightningStandManagementCapabilities=api;
}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Narrow providers do not authorize another operation or an old PIN route.
  const required=Object.freeze({
    'order-identify':'standSessionIdentification',
    'receiver-pixel-setup':'standSessionOutputs',
    'receiver-port-enabled':'standSessionOutputs',
    'receiver-update':'standSessionOTA',
    'receiver-update-all':'standSessionOTA',
    'receiver-add':'standSessionReceiverManagement',
    'layout-receiver-add':'standSessionReceiverManagement',
    'layout-new-receiver':'standSessionReceiverManagement',
    'assignment-add-receiver':'standSessionReceiverManagement',
    'receiver-remove':'standSessionReceiverManagement',
    // These legacy single-line blink actions are not the layout lease API.
    'visual-identify':'standSessionReceiverManagement',
    'port-identify':'standSessionReceiverManagement'
  });
  function blocked(action,caps){
    const key=required[action];
    return !!key&&caps?.standSessionReceiverManagement!==true&&caps?.[key]!==true;
  }
  function notice(caps){
    if(caps?.standSessionReceiverManagement===true)return '';
    const missing=['Receivers toevoegen en verwijderen'];
    if(caps?.standSessionOutputs!==true)missing.push('pixels en aansluitingen');
    if(caps?.standSessionIdentification!==true)missing.push('herkenningskleuren');
    if(caps?.standSessionOTA!==true)missing.push('software-updates');
    return missing.join(', ')+' via de standcode zijn nog niet beschikbaar. Kleuren, animaties, zones en presets blijven bedienbaar.';
  }
  return Object.freeze({blocked,notice});
}));
