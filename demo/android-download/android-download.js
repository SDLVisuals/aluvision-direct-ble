/* Publication-only overlay. Never copied into the installed app's WebApp.
 * The ordinary link downloads bytes; it does not install, connect or update. */
(function(root,document){
  'use strict';
  const script=document.currentScript;
  if(!script)return;
  const location=new URL(root.location.href),path=location.pathname;
  const published=location.origin==='https://sdlvisuals.github.io'&&/^\/aluvision-direct-ble\/demo\/(?:index\.html)?$/.test(path);
  const staging=['http://127.0.0.1:8777','http://127.0.0.1:8778'].includes(location.origin)&&/^\/demo\/(?:index\.html)?$/.test(path);
  function eligible(){
    return (published||staging)&&root.LightningWebDemo?.available===true&&
      root.__lightningV30NativeHost!==true&&root.LightningNativeRuntime?.native!==true&&
      location.protocol!=='file:'&&!root.webkit?.messageHandlers?.lightningV30;
  }
  const data=script.dataset,size=Number(data.androidSize),mode=data.androidMode,minSdk=Number(data.androidMinSdk),code=Number(data.androidVersionCode);
  if(!eligible()||!['demo','receiver'].includes(mode)||!/^\d[a-zA-Z0-9.+_-]{0,63}$/.test(data.androidVersion||'')||
    !/^[a-f0-9]{64}$/.test(data.androidSha256||'')||!Number.isSafeInteger(size)||size<65536||size>67108864||!Number.isInteger(minSdk)||minSdk<26||minSdk>100||!Number.isInteger(code)||code<1||code>2147483647||
    !/^android\/aluvision-android-test-[a-zA-Z0-9.+_-]+-[1-9]\d*-[a-f0-9]{12}\.apk$/.test(data.androidApk||''))return;
  if(data.androidApk!==`android/aluvision-android-test-${data.androidVersion}-${code}-${data.androidSha256.slice(0,12)}.apk`)return;
  const directory=new URL('.',location),apk=new URL(data.androidApk,directory),downloadPage=new URL('../android/',directory);
  if(apk.origin!==location.origin||!apk.pathname.startsWith(directory.pathname+'android/'))return;
  const translations={
    nl:{group:'Android-testapp',title:'Android-testapp downloaden',test:'Testversie',demo:'Interface-demo · geen echte verlichting',receiver:'APK',minimum:'Android 8 of nieuwer',limits:'Voor je begint',setup:"Tijdelijke ééngebruikerstest: verbind zelf met het wifi van een voorbereide receiver en kies Stand instellen. PIN, standcode en QR/deellinks staan uit. Reset een bestaande installatie alleen volgens de testinstructies.",missing:"Receiverupdates, verwijderen, gezamenlijke standanimaties, wijzigen van opgeslagen zones en backupbestanden zijn niet beschikbaar op Android. Deze APK bevat geen receiverfirmware.",identity:'Verwijder de app niet tijdens je test: daarmee wis je de lokale koppelidentiteit. Deze APK behoudt dezelfde pakketnaam en ondertekening.',physical:"Build, ondertekening en pakketinhoud gecontroleerd. Code 19 is in een Android 36-emulator gestart tot de eerste instelstap. Echte Android-telefoon, wifi, receiverbediening en snelheid zijn nog niet fysiek bevestigd."},
    en:{group:'Android test app',title:'Download Android test app',test:'Test version',demo:'Interface demo · no real lighting',receiver:'APK',minimum:'Android 8 or later',limits:'Before you start',setup:"Temporary single-user test: manually join a prepared receiver’s Wi-Fi and choose Set up stand. PIN, stand code and QR/share links are disabled. Reset an existing installation only under the test instructions.",missing:"Receiver updates, removal, synchronised stand animations, editing saved zones and backup files are not available on Android. This APK contains no receiver firmware.",identity:'Do not uninstall during testing: it deletes the local pairing identity. This APK retains the same package name and signing certificate.',physical:"Build, signature and package content checked. Code 19 was started through the first setup step in an Android 36 emulator. Physical Android phone, Wi-Fi, receiver control and performance remain unverified."},
    fr:{group:'Application de test Android',title:'Télécharger l’application de test Android',test:'Version de test',demo:'Démo de l’interface · aucun éclairage réel',receiver:'APK',minimum:'Android 8 ou version ultérieure',limits:'Avant de commencer',setup:"Test temporaire avec un seul utilisateur : connectez-vous au Wi-Fi du receiver préparé et choisissez Configurer le stand. PIN, code du stand et partage QR/lien désactivés. Réinitialisez une installation existante uniquement selon les consignes de test.",missing:"Mises à jour et suppression des receivers, animations synchronisées du stand, modification des zones enregistrées et sauvegardes indisponibles sur Android. Cet APK ne contient aucun firmware receiver.",identity:'Ne désinstallez pas pendant le test : cela efface l’identité d’association locale. Cet APK conserve le même nom de paquet et le même certificat de signature.',physical:"Build, signature et contenu contrôlés. Le code 19 a été lancé jusqu’à la première étape de configuration dans un émulateur Android 36. Téléphone Android physique, Wi-Fi, receivers et performances non vérifiés."},
    de:{group:'Android-Testapp',title:'Android-Testapp herunterladen',test:'Testversion',demo:'Interface-Demo · keine echte Beleuchtung',receiver:'APK',minimum:'Android 8 oder neuer',limits:'Vor dem Start',setup:"Vorübergehender Einzelbenutzertest: Verbinde dich manuell mit dem WLAN eines vorbereiteten Receivers und wähle Stand einrichten. PIN, Standcode und QR/Freigabelinks sind deaktiviert. Bestehende Installationen nur nach Testanweisung zurücksetzen.",missing:"Receiver-Updates, Entfernen, synchronisierte Standanimationen, Bearbeiten gespeicherter Zonen und Sicherungsdateien sind auf Android nicht verfügbar. Dieses APK enthält keine Receiver-Firmware.",identity:'Während des Tests nicht deinstallieren: Das löscht die lokale Kopplungsidentität. Dieses APK behält denselben Paketnamen und dasselbe Signaturzertifikat.',physical:"Build, Signatur und Paketinhalt geprüft. Code 19 wurde im Android-36-Emulator bis zum ersten Einrichtungsschritt gestartet. Echtes Android-Telefon, WLAN, Receiver-Bedienung und Leistung sind noch nicht physisch bestätigt."}
  };
  const namespace='http://www.w3.org/2000/svg';
  function svg(paths,kind){
    const element=document.createElementNS(namespace,'svg');element.setAttribute('viewBox','0 0 24 24');
    element.setAttribute('fill','none');element.setAttribute('stroke','currentColor');element.setAttribute('stroke-width','1.7');
    element.setAttribute('stroke-linecap','round');element.setAttribute('stroke-linejoin','round');element.setAttribute('aria-hidden','true');element.dataset.icon=kind;
    for(const d of paths){const path=document.createElementNS(namespace,'path');path.setAttribute('d',d);element.append(path);}return element;
  }
  function render(){
    const main=document.getElementById('main');if(!main)return;
    const old=main.querySelector('[data-android-download-section]');
    if(!eligible()||root.LightningV30?.snapshot?.().route?.screen!=='settings'){old?.remove();return;}
    const page=main.querySelector('.settings-page');if(!page)return;
    const language=translations[document.documentElement.lang]?document.documentElement.lang:'nl',copy=translations[language];
    let section=old;
    if(!section){
      section=document.createElement('section');section.className='android-download-section';section.dataset.androidDownloadSection='';
      section.setAttribute('aria-labelledby','android-download-heading');
      const heading=document.createElement('h2');heading.id='android-download-heading';heading.className='settings-group-title';section.append(heading);
      const link=document.createElement('a');link.className='menu-card android-download-action';link.dataset.androidDownload='';
      link.href=apk.href;link.download=apk.pathname.split('/').pop();link.setAttribute('aria-describedby','android-download-metadata android-download-mode');
      const icon=document.createElement('span');icon.className='menu-icon';icon.setAttribute('aria-hidden','true');
      icon.append(svg(['M12 3v11','m7 9 5 5 5-5','M5 15v5h14v-5'],'android-download'));link.append(icon);
      const body=document.createElement('div'),title=document.createElement('b'),metadata=document.createElement('small'),description=document.createElement('small');
      title.dataset.androidDownloadTitle='';metadata.id='android-download-metadata';description.id='android-download-mode';
      body.append(title,metadata,description);link.append(body,svg(['m9 5 7 7-7 7'],'chevron'));section.append(link);
      const pageLink=document.createElement('a');pageLink.className='android-download-page';pageLink.dataset.androidDownloadPage='';pageLink.href=downloadPage.href;section.append(pageLink);
      if(mode==='receiver'){
        const note=document.createElement('details');note.className='android-download-note';
        const summary=document.createElement('summary');summary.dataset.androidLimit='limits';note.append(summary);
        for(const key of ['setup','missing','identity','physical']){const p=document.createElement('p');p.dataset.androidLimit=key;note.append(p);}section.append(note);
      }
      (page.querySelector('.settings-app-tools')||page).append(section);
    }
    const set=(selector,value)=>{const element=section.querySelector(selector);if(element.textContent!==value)element.textContent=value;};
    set('h2',copy.group);set('[data-android-download-title]',copy.title);
    set('[data-android-download-page]',({nl:'Screenshots & installeren ↗',en:'Screenshots & installation ↗',fr:'Captures & installation ↗',de:'Screenshots & Installation ↗'})[language]);
    set('#android-download-metadata',`v${data.androidVersion} · ${new Intl.NumberFormat(language,{minimumFractionDigits:1,maximumFractionDigits:1}).format(size/1048576)} MB · ${copy.test}`);
    set('#android-download-mode',copy[mode]+' · '+(minSdk===26?copy.minimum:`Android API ${minSdk}+`));section.querySelector('a').setAttribute('aria-label',copy.title+' ('+copy.test.toLowerCase()+')');
    for(const element of section.querySelectorAll('[data-android-limit]'))if(element.textContent!==copy[element.dataset.androidLimit])element.textContent=copy[element.dataset.androidLimit];
  }
  const main=document.getElementById('main');if(!main)return;
  // A single passive observer follows the app's replacement of #main; its own
  // unchanged row is a no-op. No timers, fetch, storage, app actions or bridge.
  new MutationObserver(render).observe(main,{childList:true,subtree:true});
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  render();
})(window,document);
