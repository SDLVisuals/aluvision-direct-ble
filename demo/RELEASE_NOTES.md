# Receiver-testkandidaat 32.0.9 · appbuild 207

Dit is een testkandidaat, geen volledig vrijgegeven productierelease. De browserdemo bedient alleen fictieve receivers en verstuurt geen opdrachten naar echte verlichting.

## Wat is verbeterd?

- Een gevonden RGBW- of SPI-receiver heeft één duidelijke koppelknop. De voortgang toont dezelfde heldere stappen met of zonder PIN-beveiliging.
- Stand, zones, scènes, animatiepresets en opgeslagen kleuren krijgen een gecontroleerde, duurzame herstelroute. Automatisch bewaren na toevoegen wacht op een echte receiverbevestiging.
- Receivergegevens en bewaarde lichtstanden gebruiken een gecontroleerde opslagmigratie, met behoud van bestaande identiteit en rollbackbescherming.
- Als de verbinding tijdens een PIN-wifiwissel wegvalt, blijft de wijziging onbevestigd. De app legt opnieuw verbinden uit en controleert daarna de bestaande transactie; ze verstuurt niet automatisch opnieuw dezelfde wijziging.

## OTA downloaden en importeren

Download in de demo bij **Meer → Instellingen** het bestand voor jouw receivertype. Bewaar het op je iPhone in Bestanden. Open daarna in de iPhone-app **Receivers → Software-updates → kies de receiver → Importeer OTA-bestand**.

De downloads zijn uitsluitend OTA-appbestanden voor 32.0.9, geen volledige flash- of fabrieksresetbestanden. De importfunctie zit in appbuild 207; de appversie is 32.0.0. Oude 32.0.7-downloads blijven beschikbaar.

| Receiver | Bytes | SHA256 |
| --- | ---: | --- |
| RGBW | 1.566.864 | `1b689a3bfcdb077cb49f982d0a9d3c1ec480da639426e120b977994bb5f06fa6` |
| SPI | 1.656.128 | `344b428b59a2754cbfe6fe670acd199b6981965daa022fa296afde6ce0480a96` |

## Wat is daadwerkelijk gecontroleerd?

OTA naar 32.0.9 en de daaropvolgende versiecontrole zijn op drie testreceivers uitgevoerd: twee RGBW-receivers en één SPI-receiver. De 24V-voeding stond daarbij uit. Dit bewijst de update- en communicatiecontrole, niet de zichtbare lichtuitvoer of alle elektrische eigenschappen.

De ondertekende officiële iPhone-build 207 bevat de actuele interface en OTA-bestanden en is ter plaatse opnieuw geïnstalleerd, zonder de app te verwijderen. Het openen van die nieuwe installatie is nog niet zichtbaar gecontroleerd: de iPhone was bij de startpoging vergrendeld. Bestaande appgegevens zijn niet door een afzonderlijke vergelijking geverifieerd.

Browser- en opslagtests vervangen geen volledige praktijktest: de brede testmatrix voor koppelen, verwijderen, hoofdreceiver wisselen, PIN-herstel en instellingen blijft afzonderlijk gecontroleerd worden. Deze kandidaat claimt niet dat alle mogelijke fouten zijn uitgesloten.
