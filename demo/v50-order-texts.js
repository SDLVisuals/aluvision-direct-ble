(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningV50OrderTexts=api;}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Explicit order-interface copy only. Customer names, physical IDs, layout
  // values, pixel counts and colour/RGB protocol values are never translated.
  const rows={
    orderPosition:['Plaats {position}','Position {position}','Position {position}','Position {position}'],
    orderDragAccessible:['{name} · {receiver}{port} verslepen','Drag {name} · {receiver}{port}','Déplacer {name} · {receiver}{port}','{name} · {receiver}{port} ziehen'],
    orderDragHint:['Sleep naar de juiste plaats','Drag to the correct position','Glissez jusqu’à la bonne position','An die richtige Position ziehen'],
    orderApplying:['Volgorde toepassen op de verlichting…','Applying order to the lighting…','Application de l’ordre à l’éclairage…','Reihenfolge wird auf die Beleuchtung angewendet…'],
    orderOpenStandHint:['Open je stand om de volgorde te wijzigen.','Open your stand to change the order.','Ouvrez votre stand pour modifier l’ordre.','Öffne deinen Stand, um die Reihenfolge zu ändern.'],
    orderOpenStand:['Stand openen','Open stand','Ouvrir le stand','Stand öffnen'],
    orderDropSaved:['{name}{port} · plaats {position}','{name}{port} · position {position}','{name}{port} · position {position}','{name}{port} · Position {position}'],
    orderLineFallback:['Ledline','LED line','Ligne LED','LED-Linie'],
    orderDragUnconfirmed:['De volgorde is nog niet bevestigd.','The order is not confirmed yet.','L’ordre n’est pas encore confirmé.','Die Reihenfolge ist noch nicht bestätigt.'],
    orderDragSubmitted:['Volgorde doorgegeven.','Order submitted.','Ordre transmis.','Reihenfolge übermittelt.'],
    orderDragUnchanged:['Volgorde niet gewijzigd.','Order unchanged.','Ordre inchangé.','Reihenfolge unverändert.'],
    orderDragCancelled:['Verplaatsen geannuleerd.','Move cancelled.','Déplacement annulé.','Verschieben abgebrochen.'],
    orderDragPicked:['Ledline opgepakt. Plaats {position} van {count}.','LED line picked up. Position {position} of {count}.','Ligne LED sélectionnée. Position {position} sur {count}.','LED-Linie aufgenommen. Position {position} von {count}.'],
    orderDragPosition:['Plaats {position} van {count}.','Position {position} of {count}.','Position {position} sur {count}.','Position {position} von {count}.'],
    orderPreviewStopped:['Voorbeeldherkenning gestopt','Preview identification stopped','Repérage d’exemple arrêté','Vorschauerkennung gestoppt'],
    orderRecognitionClosing:['Herkenning afsluiten…','Closing identification…','Fermeture du repérage…','Erkennung wird beendet…'],
    orderStopUnconfirmed:['Stoppen is nog niet bevestigd.','Stopping is not confirmed yet.','L’arrêt n’est pas encore confirmé.','Das Stoppen ist noch nicht bestätigt.'],
    orderRecognitionIdleStopped:['Herkenning automatisch gestopt.','Identification stopped automatically.','Repérage arrêté automatiquement.','Erkennung automatisch gestoppt.'],
    orderRecognitionStopped:['Herkenning gestopt','Identification stopped','Repérage arrêté','Erkennung gestoppt'],
    orderPreviewColours:['Voorbeeldkleuren · niet verbonden','Preview colours · not connected','Couleurs d’exemple · non connecté','Vorschaufarben · nicht verbunden'],
    orderColoursConfirmed:['Ledlines tonen hun herkenningskleur','LED lines show their identification colour','Les lignes LED affichent leur couleur de repérage','LED-Linien zeigen ihre Erkennungsfarbe'],
    orderColoursPending:['Herkenningskleuren instellen…','Setting identification colours…','Réglage des couleurs de repérage…','Erkennungsfarben werden eingestellt…'],
    orderColoursExpired:['Herkenningskleuren verlopen. Tik of sleep om opnieuw te herkennen.','Identification colours expired. Tap or drag to identify again.','Les couleurs de repérage ont expiré. Touchez ou glissez pour relancer le repérage.','Erkennungsfarben abgelaufen. Tippe oder ziehe, um erneut zu erkennen.'],
    orderColoursUnsupported:['Werk de receivers bij om herkenningskleuren te gebruiken.','Update the receivers to use identification colours.','Mettez les récepteurs à jour pour utiliser les couleurs de repérage.','Aktualisiere die Receiver, um Erkennungsfarben zu verwenden.'],
    orderColoursUnconfirmed:['Herkenningskleuren niet bevestigd','Identification colours not confirmed','Couleurs de repérage non confirmées','Erkennungsfarben nicht bestätigt'],
    orderColourBlue:['Blauw','Blue','Bleu','Blau'],orderColourGreen:['Groen','Green','Vert','Grün'],orderColourRed:['Rood','Red','Rouge','Rot'],
    orderColourOrange:['Oranje','Orange','Orange','Orange'],orderColourYellow:['Geel','Yellow','Jaune','Gelb'],orderColourPurple:['Paars','Purple','Violet','Violett'],
    orderColourCyan:['Cyaan','Cyan','Cyan','Cyan'],orderColourMagenta:['Magenta','Magenta','Magenta','Magenta'],orderColourMint:['Mint','Mint','Menthe','Mint'],
    orderColourPink:['Roze','Pink','Rose','Rosa'],orderColourLime:['Limoen','Lime','Vert citron','Limette'],orderColourWhite:['Wit','White','Blanc','Weiß'],
    // Origin-level keys for the composition root's other order error paths.
    // Consumers must choose these keys at the origin, never map error strings.
    orderIdentificationRetry:['Herkenning niet bevestigd. Open de volgorde opnieuw en controleer de verbinding.','Identification is not confirmed. Reopen the order and check the connection.','Le repérage n’est pas confirmé. Rouvrez l’ordre et vérifiez la connexion.','Erkennung nicht bestätigt. Öffne die Reihenfolge erneut und prüfe die Verbindung.'],
    orderResumeUnconfirmed:['Volgorde bewaard. Het hervatten van de verlichting is nog niet bevestigd.','Order saved. Resuming the lighting is not confirmed yet.','Ordre enregistré. La reprise de l’éclairage n’est pas encore confirmée.','Reihenfolge gespeichert. Das Fortsetzen der Beleuchtung ist noch nicht bestätigt.'],
    orderResumeCheck:['Volgorde bewaard. Het hervatten van de verlichting is nog niet bevestigd. Controleer de verbinding.','Order saved. Resuming the lighting is not confirmed yet. Check the connection.','Ordre enregistré. La reprise de l’éclairage n’est pas encore confirmée. Vérifiez la connexion.','Reihenfolge gespeichert. Das Fortsetzen der Beleuchtung ist noch nicht bestätigt. Prüfe die Verbindung.'],
    orderResumePartial:['Volgorde bewaard. Niet alle receivers hebben het hervatten van de verlichting bevestigd. Controleer de verbinding.','Order saved. Not all receivers confirmed resuming the lighting. Check the connection.','Ordre enregistré. Tous les récepteurs n’ont pas confirmé la reprise de l’éclairage. Vérifiez la connexion.','Reihenfolge gespeichert. Nicht alle Receiver haben das Fortsetzen der Beleuchtung bestätigt. Prüfe die Verbindung.'],
    orderResumeReopen:['Volgorde bewaard. De hervatting is nog niet bevestigd; open de volgorde opnieuw en controleer de verbinding.','Order saved. Resuming is not confirmed yet; reopen the order and check the connection.','Ordre enregistré. La reprise n’est pas encore confirmée ; rouvrez l’ordre et vérifiez la connexion.','Reihenfolge gespeichert. Das Fortsetzen ist noch nicht bestätigt; öffne die Reihenfolge erneut und prüfe die Verbindung.'],
    orderReceiverMoved:['{name} staat nu op plaats {position}.','{name} is now in position {position}.','{name} est maintenant en position {position}.','{name} steht jetzt auf Position {position}.'],
    v593OrderReady:['Sleep om twee ledlines te wisselen','Drag to swap two LED lines','Glissez pour échanger deux lignes','Ziehen, um zwei LED-Linien zu tauschen'],
    v593OrderPending:['Volgorde wordt verwerkt…','Updating the order…','Mise à jour de l’ordre…','Reihenfolge wird aktualisiert…'],
    v593OrderUnconfirmed:['Wijziging nog niet bevestigd','Change not confirmed yet','Modification non confirmée','Änderung noch nicht bestätigt'],
    v593OrderStandRequired:['Open je stand om te wijzigen','Open your stand to make changes','Ouvrez le stand pour modifier','Stand öffnen, um zu ändern'],
    v593OrderSaved:['Volgorde bewaard','Order saved','Ordre enregistré','Reihenfolge gespeichert'],
    v593OrderDetails:['Details','Details','Détails','Details'],
    v593OrderDetailsAccessible:['Volledige status en uitleg bekijken','View the full status and explanation','Voir l’état complet et l’explication','Vollständigen Status und Erklärung ansehen'],
    v593OrderDetailsTitle:['Status van je ledlines','Your LED-line status','État de vos lignes LED','Status deiner LED-Linien'],
    v593orderPreviewStopped:['Voorbeeldherkenning gestopt','Preview identification stopped','Repérage d’exemple arrêté','Vorschauerkennung gestoppt'],
    v593orderRecognitionClosing:['Herkenning afsluiten…','Closing identification…','Fermeture du repérage…','Erkennung wird beendet…'],
    v593orderStopUnconfirmed:['Stoppen niet bevestigd','Stop not confirmed','Arrêt non confirmé','Stoppen nicht bestätigt'],
    v593orderRecognitionIdleStopped:['Herkenning automatisch gestopt','Identification stopped automatically','Repérage arrêté automatiquement','Erkennung automatisch gestoppt'],
    v593orderRecognitionStopped:['Herkenning gestopt','Identification stopped','Repérage arrêté','Erkennung gestoppt'],
    v593orderPreviewColours:['Voorbeeld · niet verbonden','Preview · not connected','Exemple · non connecté','Vorschau · nicht verbunden'],
    v593orderColoursConfirmed:['Herkenningskleuren bevestigd','Identification colours confirmed','Couleurs de repérage confirmées','Erkennungsfarben bestätigt'],
    v593orderColoursPending:['Herkenningskleuren instellen…','Setting identification colours…','Réglage des couleurs de repérage…','Erkennungsfarben einstellen…'],
    v593orderColoursExpired:['Herkenning verlopen · tik of sleep','Identification expired · tap or drag','Repérage expiré · touchez ou glissez','Erkennung abgelaufen · tippen/ziehen'],
    v593orderColoursUnsupported:['Receiverupdate nodig','Receiver update needed','Mise à jour du récepteur requise','Receiverupdate erforderlich'],
    v593orderColoursUnconfirmed:['Herkenning niet bevestigd','Identification not confirmed','Repérage non confirmé','Erkennung nicht bestätigt']
  };
  const languages=Object.freeze(['nl','en','fr','de']);
  Object.values(rows).forEach(Object.freeze);Object.freeze(rows);
  const paletteKeys=Object.freeze({Blauw:'orderColourBlue',Groen:'orderColourGreen',Rood:'orderColourRed',Oranje:'orderColourOrange',Geel:'orderColourYellow',Paars:'orderColourPurple',Cyaan:'orderColourCyan',Magenta:'orderColourMagenta',Mint:'orderColourMint',Roze:'orderColourPink',Limoen:'orderColourLime',Wit:'orderColourWhite'});
  function has(key){return Object.prototype.hasOwnProperty.call(rows,key);}
  function t(key,language='nl',params={}){const text=has(key)?rows[key][Math.max(0,languages.indexOf(language))]:key;return text.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g,(match,name)=>['string','number'].includes(typeof params?.[name])?String(params[name]):match);}
  // The existing session exposes a closed Dutch palette label, not a colour
  // ID. Classify that label for display only; never mutate session/protocol data.
  function paletteLabel(label,language='nl'){
    if(typeof label!=='string')return '';
    const match=/^(Blauw|Groen|Rood|Oranje|Geel|Paars|Cyaan|Magenta|Mint|Roze|Limoen|Wit)(?: ([1-9][0-9]{0,2}))?$/.exec(label);
    if(!match||match[2]&&(+match[2]<13||+match[2]>128))return label;
    return t(paletteKeys[match[1]],language)+(match[2]?' '+match[2]:'');
  }
  return Object.freeze({has,t,paletteLabel,keys:Object.freeze(Object.keys(rows)),languages});
}));
