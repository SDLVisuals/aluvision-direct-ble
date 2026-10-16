(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningV50OrderTexts=api;}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Explicit order-interface copy only. Customer names, physical IDs, layout
  // values, pixel counts and colour/RGB protocol values are never translated.
  const rows={
    orderAssignTitle:['Kleur per plaats','Colour for each position','Une couleur par position','Farbe pro Position'],
    orderAssignIntro:['Kijk naar je echte ledlines. Kies bij elke plaats de kleur die je daar ziet.','Look at your real LED lines. For each position, choose the colour you see there.','Regardez vos lignes LED réelles. Pour chaque position, choisissez la couleur que vous y voyez.','Schau auf deine echten LED-Linien. Wähle für jede Position die Farbe, die du dort siehst.'],
    orderAssignRule:['Elke kleur hoort bij één ledline en blijft gelijk.','Each colour belongs to one LED line and stays the same.','Chaque couleur correspond à une ligne LED et reste identique.','Jede Farbe gehört zu einer LED-Linie und bleibt gleich.'],
    orderChooseColour:['Kleur kiezen','Choose colour','Choisir la couleur','Farbe wählen'],
    orderChooseForPosition:['Welke kleur zie je op plaats {position}?','Which colour do you see at position {position}?','Quelle couleur voyez-vous à la position {position} ?','Welche Farbe siehst du an Position {position}?'],
    orderCurrentlyAt:['Nu op plaats {position}','Currently at position {position}','Actuellement à la position {position}','Derzeit an Position {position}'],
    orderAssigned:['{name} toegewezen aan plaats {position}.','{name} assigned to position {position}.','{name} attribué à la position {position}.','{name} der Position {position} zugeordnet.'],
    orderLineSettings:['Ledline-instellingen','LED-line settings','Réglages de la ligne LED','LED-Linien-Einstellungen'],
    orderDone:['Klaar','Done','Terminé','Fertig'],
    orderEmpty:['Er zijn nog geen ledlines in deze zone. Voeg eerst een receiver toe.','There are no LED lines in this zone yet. Add a receiver first.','Cette zone ne contient pas encore de lignes LED. Ajoutez d’abord un récepteur.','In dieser Zone gibt es noch keine LED-Linien. Füge zuerst einen Receiver hinzu.'],
    orderCurrentOrder:['Huidige volgorde','Current order','Ordre actuel','Aktuelle Reihenfolge'],
    orderFixedColours:['De herkenningskleuren blijven staan zolang dit menu open is.','Identification colours stay on while this menu is open.','Les couleurs de repérage restent allumées tant que ce menu est ouvert.','Die Erkennungsfarben bleiben an, solange dieses Menü geöffnet ist.'],
    orderAssignmentChanged:['Staat deze kleur al op een andere plaats? Alleen die twee plaatsen wisselen. De echte kleuren blijven gelijk.','Is this colour already at another position? Only those two positions swap. The real colours stay the same.','Cette couleur est déjà à une autre position ? Seules ces deux positions s’échangent. Les couleurs réelles restent identiques.','Ist diese Farbe bereits an einer anderen Position? Nur diese beiden Positionen tauschen. Die echten Farben bleiben gleich.'],
    orderPreviewAssignment:['Demo · geen echte verlichting verbonden','Demo · no real lighting connected','Démo · aucun éclairage réel connecté','Demo · keine echte Beleuchtung verbunden'],
    orderPulseUnavailable:['De herkenningskleur blijft vast branden.','The identification colour remains steady.','La couleur de repérage reste fixe.','Die Erkennungsfarbe leuchtet gleichmäßig weiter.'],
    orderPosition:['Plaats {position}','Position {position}','Position {position}','Position {position}'],
    orderDragAccessible:['{name} · {receiver}{port} verslepen','Drag {name} · {receiver}{port}','Déplacer {name} · {receiver}{port}','{name} · {receiver}{port} ziehen'],
    orderDragHint:['Plaats kiezen','Choose position','Choisir la position','Position wählen'],
    orderApplying:['Volgorde bewaren…','Saving the order…','Enregistrement de l’ordre…','Reihenfolge speichern…'],
    orderOpenStandHint:['Open je stand om de volgorde te wijzigen.','Open your stand to change the order.','Ouvrez votre stand pour modifier l’ordre.','Öffne deinen Stand, um die Reihenfolge zu ändern.'],
    orderOpenStand:['Stand openen','Open stand','Ouvrir le stand','Stand öffnen'],
    orderDropSaved:['{name}{port} · plaats {position}','{name}{port} · position {position}','{name}{port} · position {position}','{name}{port} · Position {position}'],
    orderLineFallback:['Ledline','LED line','Ligne LED','LED-Linie'],
    orderDragUnconfirmed:['Controleer de volgorde en verbinding.','Check the order and connection.','Vérifiez l’ordre et la connexion.','Prüfe die Reihenfolge und Verbindung.'],
    orderDragSubmitted:['Volgorde aangepast.','Order adjusted.','Ordre modifié.','Reihenfolge angepasst.'],
    orderDragUnchanged:['Volgorde niet gewijzigd.','Order unchanged.','Ordre inchangé.','Reihenfolge unverändert.'],
    orderDragCancelled:['Verplaatsen geannuleerd.','Move cancelled.','Déplacement annulé.','Verschieben abgebrochen.'],
    orderDragPicked:['Ledline opgepakt. Plaats {position} van {count}.','LED line picked up. Position {position} of {count}.','Ligne LED sélectionnée. Position {position} sur {count}.','LED-Linie aufgenommen. Position {position} von {count}.'],
    orderDragPosition:['Plaats {position} van {count}.','Position {position} of {count}.','Position {position} sur {count}.','Position {position} von {count}.'],
    orderPreviewStopped:['Demoherkenning gesloten','Demo identification closed','Repérage de démonstration fermé','Demo-Erkennung geschlossen'],
    orderRecognitionClosing:['Herkenning afsluiten…','Closing identification…','Fermeture du repérage…','Erkennung wird beendet…'],
    orderStopUnconfirmed:['Controleer de verbinding om de herkenning te stoppen.','Check the connection to stop identification.','Vérifiez la connexion pour arrêter le repérage.','Prüfe die Verbindung, um die Erkennung zu stoppen.'],
    orderRecognitionIdleStopped:['Herkenning automatisch gestopt.','Identification stopped automatically.','Repérage arrêté automatiquement.','Erkennung automatisch gestoppt.'],
    orderRecognitionStopped:['Herkenning gestopt','Identification stopped','Repérage arrêté','Erkennung gestoppt'],
    orderPreviewColours:['Demo · geen echte verlichting verbonden','Demo · no real lighting connected','Démo · aucun éclairage réel connecté','Demo · keine echte Beleuchtung verbunden'],
    orderColoursConfirmed:['Ledlines tonen hun herkenningskleur','LED lines show their identification colour','Les lignes LED affichent leur couleur de repérage','LED-Linien zeigen ihre Erkennungsfarbe'],
    orderColoursPending:['Herkenningskleuren instellen…','Setting identification colours…','Réglage des couleurs de repérage…','Erkennungsfarben werden eingestellt…'],
    orderColoursExpired:['Herkenningskleuren niet bevestigd. Controleer de verbinding.','Identification colours are not confirmed. Check the connection.','Les couleurs de repérage ne sont pas confirmées. Vérifiez la connexion.','Erkennungsfarben nicht bestätigt. Prüfe die Verbindung.'],
    orderColoursUnsupported:['Werk de receivers bij om herkenningskleuren te gebruiken.','Update the receivers to use identification colours.','Mettez les récepteurs à jour pour utiliser les couleurs de repérage.','Aktualisiere die Receiver, um Erkennungsfarben zu verwenden.'],
    orderColoursUnconfirmed:['Controleer de herkenningskleuren en verbinding','Check identification colours and connection','Vérifiez les couleurs de repérage et la connexion','Prüfe Erkennungsfarben und Verbindung'],
    orderColourBlue:['Blauw','Blue','Bleu','Blau'],orderColourGreen:['Groen','Green','Vert','Grün'],orderColourRed:['Rood','Red','Rouge','Rot'],
    orderColourOrange:['Oranje','Orange','Orange','Orange'],orderColourYellow:['Geel','Yellow','Jaune','Gelb'],orderColourPurple:['Paars','Purple','Violet','Violett'],
    orderColourCyan:['Cyaan','Cyan','Cyan','Cyan'],orderColourMagenta:['Magenta','Magenta','Magenta','Magenta'],orderColourMint:['Mint','Mint','Menthe','Mint'],
    orderColourPink:['Roze','Pink','Rose','Rosa'],orderColourLime:['Limoen','Lime','Vert citron','Limette'],orderColourWhite:['Wit','White','Blanc','Weiß'],
    // Origin-level keys for the composition root's other order error paths.
    // Consumers must choose these keys at the origin, never map error strings.
    orderIdentificationRetry:['Controleer de herkenningskleuren. Open de volgorde opnieuw en controleer de verbinding.','Check identification colours. Reopen the order and check the connection.','Vérifiez les couleurs de repérage. Rouvrez l’ordre et vérifiez la connexion.','Prüfe die Erkennungsfarben. Öffne die Reihenfolge erneut und prüfe die Verbindung.'],
    orderResumeUnconfirmed:['Volgorde bewaard. Controleer de verlichting en verbinding.','Order saved. Check the lighting and connection.','Ordre enregistré. Vérifiez l’éclairage et la connexion.','Reihenfolge gespeichert. Prüfe die Beleuchtung und Verbindung.'],
    orderResumeCheck:['Volgorde bewaard. Controleer de verlichting en verbinding.','Order saved. Check the lighting and connection.','Ordre enregistré. Vérifiez l’éclairage et la connexion.','Reihenfolge gespeichert. Prüfe die Beleuchtung und Verbindung.'],
    orderResumePartial:['Volgorde bewaard. Controleer de verlichting van alle receivers en de verbinding.','Order saved. Check every receiver’s lighting and the connection.','Ordre enregistré. Vérifiez l’éclairage de tous les récepteurs et la connexion.','Reihenfolge gespeichert. Prüfe die Beleuchtung aller Receiver und die Verbindung.'],
    orderResumeReopen:['Volgorde bewaard. Controleer de verlichting; open de volgorde opnieuw en controleer de verbinding.','Order saved. Check the lighting; reopen the order and check the connection.','Ordre enregistré. Vérifiez l’éclairage ; rouvrez l’ordre et vérifiez la connexion.','Reihenfolge gespeichert. Prüfe die Beleuchtung; öffne die Reihenfolge erneut und prüfe die Verbindung.'],
    orderReceiverMoved:['{name} staat nu op plaats {position}.','{name} is now in position {position}.','{name} est maintenant en position {position}.','{name} steht jetzt auf Position {position}.'],
    v593OrderReady:['Kies per plaats de kleur die je ziet','Choose the colour you see at each position','Choisissez la couleur vue à chaque position','Wähle die sichtbare Farbe pro Position'],
    v593OrderPending:['Volgorde wordt verwerkt…','Updating the order…','Mise à jour de l’ordre…','Reihenfolge wird aktualisiert…'],
    v593OrderUnconfirmed:['Controleer de volgorde en verbinding','Check order and connection','Vérifiez l’ordre et la connexion','Reihenfolge und Verbindung prüfen'],
    v593OrderStandRequired:['Open je stand om te wijzigen','Open your stand to make changes','Ouvrez le stand pour modifier','Stand öffnen, um zu ändern'],
    v593OrderSaved:['Volgorde bewaard','Order saved','Ordre enregistré','Reihenfolge gespeichert'],
    v593OrderDetails:['Details','Details','Détails','Details'],
    v593OrderDetailsAccessible:['Volledige status en uitleg bekijken','View the full status and explanation','Voir l’état complet et l’explication','Vollständigen Status und Erklärung ansehen'],
    v593OrderDetailsTitle:['Status van je ledlines','Your LED-line status','État de vos lignes LED','Status deiner LED-Linien'],
    v593orderPreviewStopped:['Demoherkenning gesloten','Demo identification closed','Repérage de démonstration fermé','Demo-Erkennung geschlossen'],
    v593orderRecognitionClosing:['Herkenning afsluiten…','Closing identification…','Fermeture du repérage…','Erkennung wird beendet…'],
    v593orderStopUnconfirmed:['Controleer de verbinding','Check connection','Vérifiez la connexion','Verbindung prüfen'],
    v593orderRecognitionIdleStopped:['Herkenning automatisch gestopt','Identification stopped automatically','Repérage arrêté automatiquement','Erkennung automatisch gestoppt'],
    v593orderRecognitionStopped:['Herkenning gestopt','Identification stopped','Repérage arrêté','Erkennung gestoppt'],
    v593orderPreviewColours:['Demo · niet verbonden','Demo · not connected','Démo · non connecté','Demo · nicht verbunden'],
    v593orderColoursConfirmed:['Herkenningskleuren actief','Identification colours active','Couleurs de repérage actives','Erkennungsfarben aktiv'],
    v593orderColoursPending:['Herkenningskleuren instellen…','Setting identification colours…','Réglage des couleurs de repérage…','Erkennungsfarben einstellen…'],
    v593orderColoursExpired:['Controleer de herkenningskleuren en verbinding','Check identification colours and connection','Vérifiez les couleurs de repérage et la connexion','Erkennungsfarben und Verbindung prüfen'],
    v593orderColoursUnsupported:['Receiverupdate nodig','Receiver update needed','Mise à jour du récepteur requise','Receiverupdate erforderlich'],
    v593orderColoursUnconfirmed:['Controleer de herkenning','Check identification','Vérifiez le repérage','Erkennung prüfen']
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
