/* Closed sharing-interface copy only. Credentials, SSIDs, PINs, QR/link
 * payloads and native service arguments never enter this dictionary. Every
 * key is parameter-free; accepting raw/customer text as a parameter would
 * silently enlarge that boundary, so such calls are rejected. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LightningStandSharingCopy=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const languages=Object.freeze(['nl','en','fr','de']);
  const rows={
    sharingNotConfirmed:['De gedeelde stand is niet bevestigd.','The shared stand is not confirmed.','Le stand partagé n’est pas confirmé.','Der geteilte Stand ist nicht bestätigt.'],
    sharingErrorUnavailable:['Delen is niet beschikbaar in deze appversie.','Sharing is not available in this app version.','Le partage n’est pas disponible dans cette version de l’application.','Das Teilen ist in dieser Appversion nicht verfügbar.'],
    sharingErrorNotConnected:['Open eerst je stand voordat je haar deelt.','Open your stand before sharing it.','Ouvrez votre stand avant de le partager.','Öffne deinen Stand, bevor du ihn teilst.'],
    sharingErrorVersion:['Deze deellink gebruikt een andere versie. Vraag een nieuwe link.','This sharing link uses a different version. Ask for a new link.','Ce lien de partage utilise une autre version. Demandez un nouveau lien.','Dieser Freigabelink verwendet eine andere Version. Bitte um einen neuen Link.'],
    sharingErrorInvalid:['Deellink ongeldig. Vraag een nieuwe link of gebruik je standcode.','Invalid sharing link. Ask for a new link or use your stand code.','Lien de partage invalide. Demandez un nouveau lien ou utilisez votre code de stand.','Ungültiger Freigabelink. Bitte um einen neuen Link oder verwende deinen Standcode.'],
    sharingErrorIdentity:['Stand niet herkend. Er zijn geen gegevens overgenomen.','Stand not recognised. No data was imported.','Stand non reconnu. Aucune donnée n’a été importée.','Stand nicht erkannt. Es wurden keine Daten übernommen.'],
    sharingErrorCancelled:['Geannuleerd.','Cancelled.','Annulé.','Abgebrochen.'],
    sharingErrorScanUnavailable:['Scannen niet beschikbaar. Plak de link of gebruik je standcode.','Scanning is not available. Paste the link or use your stand code.','Le scan n’est pas disponible. Collez le lien ou utilisez votre code de stand.','Scannen ist nicht verfügbar. Füge den Link ein oder verwende deinen Standcode.'],
    sharingErrorCameraDenied:['Geef Aluvision cameratoegang via Instellingen of plak de link.','Allow Aluvision to access the camera in Settings, or paste the link.','Autorisez Aluvision à accéder à la caméra dans Réglages, ou collez le lien.','Erlaube Aluvision in den Einstellungen den Kamerazugriff oder füge den Link ein.'],
    sharingErrorLinkUnavailable:['Delen niet beschikbaar. Kopieer de link.','Sharing is not available. Copy the link.','Le partage n’est pas disponible. Copiez le lien.','Teilen ist nicht verfügbar. Kopiere den Link.'],
    sharingErrorBusy:['Er loopt nog een actie. Wacht tot die klaar is en probeer opnieuw.','An action is still in progress. Wait until it finishes and try again.','Une action est encore en cours. Attendez sa fin puis réessayez.','Eine Aktion läuft noch. Warte, bis sie beendet ist, und versuche es erneut.'],
    sharingErrorConnectCancelled:['Verbinden geannuleerd. Je eerdere stand blijft bewaard.','Connection cancelled. Your previous stand is preserved.','Connexion annulée. Votre stand précédent est conservé.','Verbindung abgebrochen. Dein bisheriger Stand bleibt erhalten.'],
    sharingErrorWifiUnsupported:['Kies het getoonde netwerk in Instellingen → Wifi. Kom daarna terug en open je stand.','Choose the displayed network in Settings → Wi-Fi. Then return and open your stand.','Choisissez le réseau affiché dans Réglages → Wi-Fi. Revenez ensuite et ouvrez votre stand.','Wähle das angezeigte Netzwerk unter Einstellungen → WLAN. Kehre danach zurück und öffne deinen Stand.'],
    sharingErrorWifiDenied:['Wifi verbinden is niet toegestaan. Kies het getoonde netwerk in Instellingen → Wifi en kom terug.','Joining Wi-Fi is not allowed. Choose the displayed network in Settings → Wi-Fi and return.','La connexion Wi-Fi n’est pas autorisée. Choisissez le réseau affiché dans Réglages → Wi-Fi puis revenez.','Die WLAN-Verbindung ist nicht erlaubt. Wähle das angezeigte Netzwerk unter Einstellungen → WLAN und kehre zurück.'],
    sharingErrorWifiTimeout:['Wifi verbinden duurde te lang. Kies het getoonde netwerk in Instellingen → Wifi en kom terug.','Joining Wi-Fi took too long. Choose the displayed network in Settings → Wi-Fi and return.','La connexion Wi-Fi a pris trop de temps. Choisissez le réseau affiché dans Réglages → Wi-Fi puis revenez.','Die WLAN-Verbindung hat zu lange gedauert. Wähle das angezeigte Netzwerk unter Einstellungen → WLAN und kehre zurück.'],
    sharingErrorWifiUnavailable:['Wifi is niet verbonden. Kies het getoonde netwerk in Instellingen → Wifi en kom terug.','Wi-Fi is not connected. Choose the displayed network in Settings → Wi-Fi and return.','Le Wi-Fi n’est pas connecté. Choisissez le réseau affiché dans Réglages → Wi-Fi puis revenez.','WLAN ist nicht verbunden. Wähle das angezeigte Netzwerk unter Einstellungen → WLAN und kehre zurück.'],
    sharingErrorLocalNetwork:['Geef Aluvision toegang tot het lokale netwerk via Instellingen en probeer opnieuw.','Allow Aluvision to access the local network in Settings and try again.','Autorisez Aluvision à accéder au réseau local dans Réglages puis réessayez.','Erlaube Aluvision in den Einstellungen den Zugriff auf das lokale Netzwerk und versuche es erneut.'],
    sharingErrorWrongWifi:['Verbind in Instellingen → Wifi met het getoonde standnetwerk en probeer opnieuw.','Connect to the displayed stand network in Settings → Wi-Fi and try again.','Connectez-vous au réseau du stand affiché dans Réglages → Wi-Fi puis réessayez.','Verbinde dich unter Einstellungen → WLAN mit dem angezeigten Standnetzwerk und versuche es erneut.'],
    sharingErrorAuth:['Standcode niet bevestigd. Vraag een nieuwe link als de code is gewijzigd.','Stand code not confirmed. Ask for a new link if the code has changed.','Code de stand non confirmé. Demandez un nouveau lien si le code a changé.','Standcode nicht bestätigt. Bitte um einen neuen Link, wenn der Code geändert wurde.'],
    sharingErrorCopyUnavailable:['Kopiëren niet beschikbaar. Selecteer de wifi-gegevens handmatig.','Copying is not available. Select the Wi-Fi details manually.','La copie n’est pas disponible. Sélectionnez les informations Wi-Fi manuellement.','Kopieren ist nicht verfügbar. Wähle die WLAN-Daten manuell aus.'],
    sharingErrorWifiCredential:['Stel je wifi-PIN opnieuw in om hem te delen.','Set your Wi-Fi PIN again to share it.','Définissez à nouveau votre code PIN Wi-Fi pour le partager.','Lege deine WLAN-PIN erneut fest, um sie zu teilen.'],
    sharingErrorInspection:['Kies eerst het wifi van je stand in Instellingen en kom terug.','Choose your stand’s Wi-Fi in Settings first, then return.','Choisissez d’abord le Wi-Fi de votre stand dans Réglages puis revenez.','Wähle zuerst das WLAN deines Stands in den Einstellungen und kehre zurück.'],
    sharingConnectFailed:['Verbinden mislukt. Controleer wifi en probeer opnieuw.','Connection failed. Check Wi-Fi and try again.','La connexion a échoué. Vérifiez le Wi-Fi puis réessayez.','Verbindung fehlgeschlagen. Prüfe das WLAN und versuche es erneut.'],
    sharingPrivacyHidden:['Je wifi-gegevens zijn weer verborgen. Toon ze opnieuw om verder te delen.','Your Wi-Fi details are hidden again. Show them again to continue sharing.','Vos informations Wi-Fi sont à nouveau masquées. Affichez-les à nouveau pour continuer le partage.','Deine WLAN-Daten sind wieder verborgen. Zeige sie erneut an, um sie weiterzugeben.'],
    sharingScanCancelled:['Scannen geannuleerd.','Scanning cancelled.','Scan annulé.','Scannen abgebrochen.'],
    sharingStandOpened:['Je actuele stand is geopend.','Your current stand is open.','Votre stand actuel est ouvert.','Dein aktueller Stand ist geöffnet.'],
    sharingSetupRequired:['Deze stand moet eerst worden ingesteld.','This stand must be set up first.','Ce stand doit d’abord être configuré.','Dieser Stand muss zuerst eingerichtet werden.'],
    sharingLinkCopied:['Deellink gekopieerd. Deel alleen met mensen die toegang mogen.','Sharing link copied. Share it only with people who may have access.','Lien de partage copié. Partagez-le uniquement avec les personnes autorisées.','Freigabelink kopiert. Teile ihn nur mit Personen, die Zugriff haben dürfen.'],
    sharingCodeCopied:['Standcode gekopieerd.','Stand code copied.','Code de stand copié.','Standcode kopiert.'],
    sharingWifiCopied:['Wifi-netwerk en PIN gekopieerd.','Wi-Fi network and PIN copied.','Réseau Wi-Fi et code PIN copiés.','WLAN-Netzwerk und PIN kopiert.'],
    sharingWifiOffered:['Wifi-gegevens aangeboden aan het deelvenster.','Wi-Fi details sent to the share sheet.','Informations Wi-Fi transmises à la feuille de partage.','WLAN-Daten an den Teilen-Dialog übergeben.'],
    sharingCancelled:['Delen geannuleerd.','Sharing cancelled.','Partage annulé.','Teilen abgebrochen.'],
    sharingLinkOffered:['Deellink aangeboden aan het deelvenster.','Sharing link sent to the share sheet.','Lien transmis à la feuille de partage.','Freigabelink an den Teilen-Dialog übergeben.'],
    sharingShareTitle:['Open mijn Aluvision-stand','Open my Aluvision stand','Ouvrir mon stand Aluvision','Meinen Aluvision-Stand öffnen'],
    sharingQrLabel:['QR-code om deze stand te openen','QR code to open this stand','Code QR pour ouvrir ce stand','QR-Code zum Öffnen dieses Stands'],
    sharingWifiTitle:['Je standwifi','Your booth Wi-Fi','Le Wi-Fi de votre stand','Dein Stand-WLAN'],
    sharingWifiIntro:['Deel het netwerk en je PIN. Verbinden gaat via Instellingen → Wifi.','Share the network and your PIN. Connect in Settings → Wi-Fi.','Partagez le réseau et votre code PIN. Connectez-vous dans Réglages → Wi-Fi.','Teile das Netzwerk und deine PIN. Verbinden über Einstellungen → WLAN.'],
    sharingHiddenHint:['Je wifi-gegevens blijven verborgen tot je ze zelf opent.','Your Wi-Fi details stay hidden until you open them.','Vos informations Wi-Fi restent masquées jusqu’à leur ouverture.','Deine WLAN-Daten bleiben verborgen, bis du sie öffnest.'],
    sharingPinHidden:['Wifi-PIN verborgen','Wi-Fi PIN hidden','Code PIN Wi-Fi masqué','WLAN-PIN verborgen'],
    sharingShowPin:['Toon PIN','Show PIN','Afficher','PIN zeigen'],
    sharingHidePin:['Verberg','Hide PIN','Masquer','Verbergen'],
    sharingWifiNetwork:['Wifi-netwerk','Wi-Fi network','Réseau Wi-Fi','WLAN-Netzwerk'],
    sharingWifiPin:['Wifi-PIN','Wi-Fi PIN','Code PIN Wi-Fi','WLAN-PIN'],
    sharingWifiShare:['Delen of opslaan','Share or save','Partager ou enregistrer','Teilen oder speichern'],
    sharingCopyDetails:['Gegevens kopiëren','Copy details','Copier les informations','Daten kopieren'],
    sharingAccessWarning:['Deel alleen met mensen die toegang mogen. Bij sluiten of inactiviteit worden je gegevens verborgen.','Share only with people who may have access. Closing or inactivity hides your details.','Partagez uniquement avec les personnes autorisées. La fermeture ou l’inactivité masque vos informations.','Teile nur mit Personen, die Zugriff haben dürfen. Beim Schließen oder bei Inaktivität werden deine Daten verborgen.'],
    sharingLoading:['Wifi-gegevens laden…','Loading Wi-Fi details…','Chargement des informations Wi-Fi…','WLAN-Daten werden geladen…'],
    sharingShowDetails:['Wifi-gegevens tonen','Show Wi-Fi details','Afficher les informations Wi-Fi','WLAN-Daten anzeigen'],
    sharingJoinIntro:['Verbind met je standwifi in Instellingen en kies Stand openen.','Connect to your stand’s Wi-Fi in Settings and choose Open stand.','Connectez-vous au Wi-Fi de votre stand dans Réglages puis choisissez Ouvrir le stand.','Verbinde dich in den Einstellungen mit dem WLAN deines Stands und wähle Stand öffnen.']
  };
  Object.values(rows).forEach(Object.freeze);Object.freeze(rows);
  const has=key=>typeof key==='string'&&Object.prototype.hasOwnProperty.call(rows,key);
  function t(key,language='nl',params={}){
    if(!has(key))throw new TypeError('Unknown stand-sharing copy key');
    if(!params||typeof params!=='object'||Array.isArray(params)||
      ![Object.prototype,null].includes(Object.getPrototypeOf(params))||Reflect.ownKeys(params).length)
      throw new TypeError('Stand-sharing copy does not accept parameters');
    return rows[key][Math.max(0,languages.indexOf(language))];
  }
  return Object.freeze({has,t,keys:Object.freeze(Object.keys(rows))});
});
