/* First blank MAIN only. Public presentation never receives a PIN, credential,
 * verifier or share payload. Native owns entry, storage, reveal and export. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningFirstPinV2=api;}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const rows={
    nameHint:['Deze naam wordt straks de naam van je wifi-netwerk.','This name will become your Wi-Fi network name.','Ce nom deviendra celui de votre réseau Wi-Fi.','Dieser Name wird später dein WLAN-Netzwerkname.'],
    first:['Je eerste receiver','Your first receiver','Votre premier récepteur','Dein erster Receiver'],
    choose:['Beveilig je standwifi','Secure your booth Wi-Fi','Sécurisez le Wi-Fi du stand','Stand-WLAN sichern'],
    chooseHint:['Eén eigen PIN om met je standwifi te verbinden.','One personal PIN to connect to your booth Wi-Fi.','Un seul code PIN pour vous connecter au Wi-Fi du stand.','Eine eigene PIN für die Verbindung mit deinem Stand-WLAN.'],
    digits:['8–12 cijfers · 12 aanbevolen','8–12 digits · 12 recommended','8 à 12 chiffres · 12 recommandés','8–12 Ziffern · 12 empfohlen'],
    network:['Je nieuwe wifi-netwerk','Your new Wi-Fi network','Votre nouveau réseau Wi-Fi','Dein neues WLAN-Netzwerk'],
    chooseButton:['Wifi-PIN instellen','Set Wi-Fi PIN','Définir le code PIN Wi-Fi','WLAN-PIN festlegen'],
    private:['Je voert je PIN beveiligd in de app in.','Enter your PIN securely in the app.','Saisissez votre code PIN en toute sécurité dans l’app.','Gib deine PIN sicher in der App ein.'],
    rejoin:['Verbind met je standwifi','Connect to your booth Wi-Fi','Connectez-vous au Wi-Fi du stand','Mit dem Stand-WLAN verbinden'],
    wifi:['Instellingen → Wifi','Settings → Wi-Fi','Réglages → Wi-Fi','Einstellungen → WLAN'],
    select:['Kies het netwerk hierboven en vul je gekozen PIN in.','Choose the network above and enter your chosen PIN.','Choisissez le réseau ci-dessus et saisissez votre code PIN.','Wähle das Netzwerk oben und gib deine gewählte PIN ein.'],
    return:['Kom terug naar de app','Return to the app','Revenez dans l’application','Zur App zurückkehren'],
    returnHint:['We controleren dezelfde receiver en gaan verder.','We will check the same receiver and continue.','Nous vérifierons le même récepteur pour continuer.','Wir prüfen denselben Receiver und machen weiter.'],
    show:['PIN bekijken of delen','View or share PIN','Voir ou partager le code PIN','PIN anzeigen oder teilen'],
    progress:['Je standwifi instellen','Set up your booth Wi-Fi','Configurer le Wi-Fi du stand','Stand-WLAN einrichten'],
    pinStep:['PIN kiezen','Choose PIN','Choisir le code PIN','PIN wählen'],
    wifiStep:['Wifi verbinden','Connect Wi-Fi','Connecter le Wi-Fi','WLAN verbinden'],
    handoffHint:['Na het instellen verbind je dit toestel één keer opnieuw met je gekozen PIN. Daarna kan je telefoon dit netwerk onthouden en automatisch verbinden.','After setup, reconnect this device once using your chosen PIN. Your phone can then remember this network for automatic connection.','Après la configuration, reconnectez cet appareil une fois avec votre code PIN. Il pourra ensuite mémoriser ce réseau pour s’y reconnecter automatiquement.','Verbinde dieses Gerät nach der Einrichtung einmal neu mit deiner gewählten PIN. Dein Telefon kann das Netzwerk danach für automatische Verbindungen speichern.'],
    preparingWifi:['Beveiligde installatie afronden','Complete secure setup','Terminer la configuration sécurisée','Sichere Einrichtung abschließen'],
    preparingHint:['Volg de PIN-stappen in de app. Daarna schakelt de receiver naar je standwifi.','Follow the PIN steps in the app. The receiver will then switch to your booth Wi-Fi.','Suivez les étapes du code PIN dans l’app. Le récepteur passera ensuite au Wi-Fi du stand.','Folge den PIN-Schritten in der App. Danach wechselt der Receiver zu deinem Stand-WLAN.'],
    switchingWifi:['Wacht op je nieuwe standwifi','Wait for your new booth Wi-Fi','Attendez le nouveau Wi-Fi du stand','Warte auf dein neues Stand-WLAN'],
    switchingHint:['Het nieuwe netwerk kan enkele seconden nodig hebben om te verschijnen. Open Wifi en verbind zodra je het ziet. We kunnen dit pas bevestigen nadat je verbonden bent.','The new network may take a few seconds to appear. Open Wi-Fi and connect when you see it. We can only confirm it after you connect.','Le nouveau réseau peut mettre quelques secondes à apparaître. Ouvrez le Wi-Fi et connectez-vous dès qu’il est visible. Nous ne pourrons le confirmer qu’après votre connexion.','Das neue Netzwerk kann einige Sekunden brauchen, bis es erscheint. Öffne WLAN und verbinde dich, sobald du es siehst. Wir können es erst nach deiner Verbindung bestätigen.'],
    manualWifi:['Open je wifi-instellingen','Open your Wi-Fi settings','Ouvrez les réglages Wi-Fi','Öffne deine WLAN-Einstellungen'],
    manualHint:['Kies je standnetwerk hieronder. Daarna controleren we de verbinding.','Choose your booth network below. We will then check the connection.','Choisissez le réseau du stand ci-dessous. Nous vérifierons ensuite la connexion.','Wähle unten dein Standnetzwerk. Danach prüfen wir die Verbindung.'],
    storedTitle:['Wifi en PIN bekijken','View Wi-Fi and PIN','Voir le Wi-Fi et le code PIN','WLAN und PIN anzeigen'],
    storedHint:['Bekijk of deel de wifi-gegevens die veilig op dit toestel zijn bewaard.','View or share Wi-Fi details stored securely on this device.','Consultez ou partagez les informations Wi-Fi conservées en sécurité sur cet appareil.','Sieh dir die sicher auf diesem Gerät gespeicherten WLAN-Daten an oder teile sie.'],
    storedUnavailable:['De bewaarde wifi-PIN kon op dit toestel niet worden geopend. Stel geen nieuwe PIN in.','The saved Wi-Fi PIN could not be opened on this device. Do not create a new PIN.','Impossible d’ouvrir le code PIN Wi-Fi enregistré sur cet appareil. Ne créez pas de nouveau code PIN.','Die gespeicherte WLAN-PIN konnte auf diesem Gerät nicht geöffnet werden. Lege keine neue PIN fest.'],
    storedBusy:['Er is al een handeling bezig. Probeer het zo opnieuw.','Another operation is in progress. Try again shortly.','Une opération est déjà en cours. Réessayez dans un instant.','Ein anderer Vorgang läuft bereits. Versuche es gleich erneut.'],
    shareHint:['Delen geeft toegang tot je wifi; niet tot de appbediening op een ander toestel.','Sharing grants Wi-Fi access, not app control on another device.','Le partage donne accès au Wi-Fi, pas au contrôle dans l’app sur un autre appareil.','Teilen gewährt WLAN-Zugang, keine App-Steuerung auf einem anderen Gerät.'],
    check:['Ik ben verbonden · controleren','I am connected · check','Je suis connecté · vérifier','Ich bin verbunden · prüfen'],
    checking:['Verbinding controleren…','Checking connection…','Vérification de la connexion…','Verbindung wird geprüft…'],
    preparing:['Je standwifi voorbereiden…','Preparing your booth Wi-Fi…','Préparation du Wi-Fi du stand…','Stand-WLAN wird vorbereitet…'],
    uncertain:['Nog niet bevestigd. Laat de receiver aan en controleer je standwifi. Kies geen tweede PIN.','Not confirmed yet. Leave the receiver on and check your booth Wi-Fi. Do not choose another PIN.','Pas encore confirmé. Laissez le récepteur allumé et vérifiez le Wi-Fi du stand. Ne choisissez pas un autre code PIN.','Noch nicht bestätigt. Lass den Receiver an und prüfe dein Stand-WLAN. Wähle keine zweite PIN.'],
    unavailable:['App en receiver konden de beveiligde eerste installatie nog niet bevestigen. Er is niets onbeveiligd gekoppeld; reset de receiver niet.','The app and receiver could not confirm secure first setup. Nothing was paired without protection; do not reset the receiver.','L’app et le récepteur n’ont pas confirmé l’installation initiale sécurisée. Aucune association non protégée ; ne réinitialisez pas le récepteur.','App und Receiver konnten die sichere Ersteinrichtung nicht bestätigen. Nichts wurde ungesichert gekoppelt; setze den Receiver nicht zurück.'],
    appUnavailable:['Deze app kon de PIN-stap nog niet openen. Werk de app bij; reset de receiver niet.','This app could not open the PIN step. Update the app; do not reset the receiver.','Cette app n’a pas pu ouvrir l’étape du code PIN. Mettez l’app à jour ; ne réinitialisez pas le récepteur.','Diese App konnte den PIN-Schritt nicht öffnen. Aktualisiere die App; setze den Receiver nicht zurück.'],
    failed:['Beveiligde installatie nog niet bevestigd. Je keuzes blijven bewaard. Controleer de verbinding en probeer opnieuw.','Secure setup is not confirmed yet. Your choices are retained. Check the connection and try again.','L’installation sécurisée n’est pas encore confirmée. Vos choix sont conservés. Vérifiez la connexion et réessayez.','Die sichere Einrichtung ist noch nicht bestätigt. Deine Auswahl bleibt erhalten. Prüfe die Verbindung und versuche es erneut.']
  };
  const languages=['nl','en','fr','de'],esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text=(key,language=globalThis.document?.documentElement?.lang||'nl')=>rows[key]?.[Math.max(0,languages.indexOf(language.split('-')[0]))]||'';
  // Diagnosis is a closed native enum, never a raw reply or retry authority.
  const diagnosisReasons=new Set(('ACTION_UNSUPPORTED PINV2_UNAVAILABLE PINV2_BINDING PINV2_TRANSACTION_MISMATCH PINV2_FIRST_CLAIM_ONLY PINV2_FIELDS PINV2_NOT_READY PINV2_FIRST_CLAIM_UNAVAILABLE ONBOARD_UNAVAILABLE ONBOARD_BINDING ONBOARD_TRANSACTION_MISMATCH ONBOARD_FIELDS ONBOARD_CONFIG_INVALID ONBOARD_CONFIG_LOCKED CONFIG_STORE_FAILED PINV2_IMMUTABLE_INTENT CLAIM_WORKING ONBOARD_PENDING PIN_MODE_PENDING PIN_ROTATION_PENDING AUTHORITY_WAITING_QUORUM AUTHORITY_COORDINATED_COMMIT_REQUIRED DETACH_STORAGE_UNAVAILABLE RECEIVER_DETACHED DELEGATED_SCOPE_ONLY REFUSED_OTHER REPLY_SHAPE BINDING_MISMATCH PROTOCOL_VERSION CAPABILITY REPLY_VALUES STATE_UNCONFIRMED TRANSPORT_UNCONFIRMED OWNER_REPLY_UNCONFIRMED IDENTITY_UNCONFIRMED BUSY').split(' '));
  const localFailureCodes=new Set(('MAIN_CONFIGURATION_INVALID MAIN_BUSY MAIN_CANCELLED MAIN_IDENTITY_UNCONFIRMED MAIN_CONNECTION_UNAVAILABLE MAIN_MANAGEMENT_REFUSED MAIN_WRONG_RECEIVER_NETWORK MAIN_STORAGE_UNCONFIRMED MAIN_ACTION_UNCERTAIN MAIN_CONFIGURATION_UNCONFIRMED MAIN_CLAIM_UNCONFIRMED MAIN_MANUAL_WIFI_REQUIRED MAIN_REGISTRATION_UNCONFIRMED MAIN_RECEIPT_INVALID MAIN_EXPLICIT_RETRY_REQUIRED DISCOVERY_EXPIRED MAIN_RECOVERY_UNAVAILABLE MAIN_RECOVERY_CONFLICT PIXEL_GUIDE_UPDATE_REQUIRED V30_BINDING_INVALID V30_CHECKPOINT_INVALID V30_CHECKPOINT_CONFLICT V30_CHECKPOINT_ROLLBACK V30_STORAGE_UNAVAILABLE V30_STORAGE_CORRUPT V30_STORAGE_UNCONFIRMED V30_STORAGE_FULL V30_CREDENTIAL_INVALID V30_CREDENTIAL_IMMUTABLE V30_PIN_FORMAT V30_RECEIPT_UNVERIFIED NATIVE_UNCONFIRMED').split(' '));
  const pinDiagnosticPhases=new Set(('PRECLAIM CLAIM CLAIM_POLL RECONCILE RECON_POLL REJOIN').split(' '));
  const pinDiagnosticStates=new Set(('ABSENT DERIVING PREPARED COMMITTED BLOCKED UNKNOWN').split(' '));
  const pinDiagnosticReasons=new Set(('PIN_MISMATCH STORAGE_UNAVAILABLE BLOCKED LEGACY_UNCONFIRMED CONTEXT_CHANGED ACTION_UNSUPPORTED PINV2_UNAVAILABLE PINV2_BINDING PINV2_TRANSACTION_MISMATCH PINV2_FIRST_CLAIM_ONLY PINV2_FIELDS PINV2_NOT_READY PINV2_FIRST_CLAIM_UNAVAILABLE PINV2_WORKER_UNAVAILABLE REFUSED_OTHER REPLY_SHAPE BINDING_MISMATCH PROTOCOL_VERSION CAPABILITY REPLY_VALUES STATE_UNCONFIRMED OWNER_REPLY_UNCONFIRMED TRANSPORT_UNCONFIRMED BUSY').split(' '));
  function pinDiagnostic(code){
    if(typeof code!=='string'||code.length>64)return false;
    const match=/^PIN_DIAG_(PRECLAIM|CLAIM_POLL|CLAIM|RECONCILE|RECON_POLL|REJOIN)_(ABSENT|DERIVING|PREPARED|COMMITTED|BLOCKED|UNKNOWN)_([A-Z0-9_]+)$/.exec(code);
    return !!match&&match[0]===code&&pinDiagnosticPhases.has(match[1])&&pinDiagnosticStates.has(match[2])&&pinDiagnosticReasons.has(match[3]);
  }
  function failure(code,{rejoin=false,language}={}){
    if(rejoin)return text('uncertain',language)+(pinDiagnostic(code)?' ['+code+']':'');
    if(pinDiagnostic(code))return text('failed',language)+' ['+code+']';
    if(['ACTION_UNSUPPORTED','FIRST_PIN_V2_UNSUPPORTED'].includes(code))return text('appUnavailable',language);
    if(['MAIN_PROTOCOL_UNSUPPORTED','PINV2_UNSUPPORTED'].includes(code))return text('unavailable',language);
    const match=typeof code==='string'?/^FIRST_MAIN_(CONFIG_STATUS|CONFIG|PIN_STATUS)_([A-Z0-9_]+)$/.exec(code):null;
    return text('failed',language)+(localFailureCodes.has(code)||match&&match[0]===code&&diagnosisReasons.has(match[2])?' ['+code+']':'');
  }
  function validSSID(ssid,type){
    const prefix=type==='SPI'?'SPI HQ ':type==='RGBW'?'RGBW HQ ':null;
    if(!prefix||typeof ssid!=='string'||ssid.length>32||!ssid.startsWith(prefix))return false;
    const suffix=ssid.slice(prefix.length);return /^[A-Za-z0-9 ._-]+$/.test(suffix)&&suffix.trim()===suffix&&!suffix.includes('  ');
  }
  function candidate(draft,model){
    return !!draft&&model?.demo===false&&draft.role==='main'&&draft.mainReceiverId===null&&!!draft.receiver&&
      ['SPI','RGBW'].includes(draft.receiver.type)&&['pin','security','zone','review'].includes(draft.stage)&&
      Array.isArray(model.receivers)&&!model.receivers.some(receiver=>receiver.standId===draft.stand?.id&&receiver.lifecycle==='added');
  }
  function markup({phase='pin',ssid,type,busy=false,language,handoff='manual'}={}){
    if(!validSSID(ssid,type))return '';
    const tr=key=>esc(text(key,language)),icon=key=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${key==='wifi'?'<path d="M3 8a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0M9 16a4 4 0 0 1 6 0"/><circle cx="12" cy="20" r="1"/>':key==='eye'?'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>':key==='arrow'?'<path d="M5 12h14m-6-6 6 6-6 6"/>':key==='check'?'<path d="m5 12 4 4L19 6"/>':'<path d="M7 10V7a5 5 0 0 1 10 0v3"/><rect x="4" y="10" width="16" height="12" rx="3"/><path d="M12 15v3"/>'}</svg>`,button=(action,key,secondary=false,symbol='arrow')=>`<button type="button" class="button full${secondary?' secondary':''}" data-onboarding-action="${action}" ${busy?'disabled':''}>${icon(symbol)}<span>${tr(key)}</span></button>`;
    const joined=phase==='rejoin';
    // Presentation only. The caller owns actual radio/rejoin verification.
    // An elapsed animation never changes this into a confirmed connection.
    const handoffState=['preparing','switching','checking'].includes(handoff)?handoff:'manual';
    const handoffLabels={preparing:['preparingWifi','preparingHint'],switching:['switchingWifi','switchingHint'],checking:['checking','returnHint'],manual:['manualWifi','manualHint']}[handoffState];
    const handoffStatus=joined?`<div class="first-pin-v2-handoff" data-first-pin-handoff="${handoffState}" role="status" aria-live="polite" aria-atomic="true"><span class="first-pin-v2-handoff-icon" aria-hidden="true">${icon('wifi')}</span><div><strong>${tr(handoffLabels[0])}</strong><small>${tr(handoffLabels[1])}</small></div></div>`:'';
    const progress=`<ol class="first-pin-v2-progress" aria-label="${tr('progress')}"><li ${!joined?'aria-current="step"':''}><b aria-hidden="true">1</b><span>${tr('pinStep')}</span></li><li ${joined?'aria-current="step"':''}><b aria-hidden="true">2</b><span>${tr('wifiStep')}</span></li></ol>`;
    return `<section class="card first-pin-v2" data-first-pin-v2="${joined?'rejoin':'pin'}" aria-busy="${busy}">${progress}<header class="first-pin-v2-heading"><span class="first-pin-v2-eyebrow">${tr('first')}</span><h2>${tr(joined?'rejoin':'choose')}</h2>${!joined?`<p>${tr('chooseHint')}</p>`:`<p>${tr('handoffHint')}</p>`}</header>${handoffStatus}<div class="first-pin-v2-network"><span class="first-pin-v2-network-icon">${icon('wifi')}</span><div><small>${tr('network')}</small><strong>${esc(ssid)}</strong></div><span class="first-pin-v2-lock">${icon('lock')}</span></div>${joined?`<ol class="first-pin-v2-steps"><li><b aria-hidden="true">1</b><span><strong>${tr('wifi')}</strong><small>${tr('select')}</small></span></li><li><b aria-hidden="true">2</b><span><strong>${tr('return')}</strong><small>${tr('returnHint')}</small></span></li></ol>${button('first-pin-show','show',true,'eye')}<small class="first-pin-v2-private">${tr('shareHint')}</small>`:`<div class="first-pin-v2-security"><div class="first-pin-v2-digits" aria-hidden="true">•••• <span>••••</span></div><p class="first-pin-v2-recommend">${tr('digits')}</p><small class="first-pin-v2-private">${tr('private')}</small></div>${button('first-pin-claim','chooseButton')}`}</section>${joined?`<div class="onboarding-actions onboarding-footer first-pin-v2-footer">${button('first-pin-check',busy?'checking':'check')}</div>`:''}`;
  }
  return Object.freeze({text,validSSID,candidate,markup,failure});
}));
