# Demo V32 · Android-testapp · 1 oktober 2026

Release: `v32-android-test-20261001`.

Dit is een browserdemo met fictieve receivers. Er worden geen opdrachten naar echte verlichting verstuurd. De voorbeeldstand begint na herladen opnieuw.

## Wat is verbeterd?

- Kortere aanwijzingen en overzichtelijkere instellingen voor je installatie en deze app.
- Rustiger melkglas, duidelijkere selecties en grotere aanraakvlakken voor de gecontroleerde bediening.
- Subtiele knopfeedback, vloeiend uitklappen en behoud van de voorkeur voor minder beweging.
- RGBW en SPI houden hun eigen bediening. Tunnel- en wandgroepen behouden hun ruimtelijke voorbeelden tijdens navigatie en kleurkeuze.
- Geen onbruikbare knop voor bestaande receivers in een lege zone. Niet-beschikbare scènes en gemengde animatiepresets hebben een zichtbare uitleg.
- Volledige standbediening met direct zichtbare fijne kleurinstellingen, warmwit en één bereikbare sluitknop.

## Android-testapp downloaden

Open **Meer → Android-testapp downloaden** op deze demo. De ondertekende APK `0.1.0-test.1` is ongeveer 2,2 MB en vereist Android 8 of nieuwer. Android kan vragen om installatie vanuit je browser toe te staan. De downloadknop staat alleen op deze GitHub-demo, niet in de geïnstalleerde apps.

De Android-app begint leeg en is bedoeld voor echte RGBW- en SPI-receivers. Je verbindt de telefoon eerst zelf met de Wi-Fi van een nog niet gekoppelde hoofdreceiver. Daarna kun je die toevoegen, andere receivers via de hoofdreceiver koppelen, kleuren en animaties bedienen en SPI-pixels en kanten instellen. Een bestaande beveiligde installatie van een iPhone of Mac kan deze eerste Android-versie nog niet overnemen.

Dit is een eerste testversie: PIN-inloggen en herstel, OTA en receivers verwijderen/resetten zijn nog niet beschikbaar. Ook backupimport en het aanpassen van een gepubliceerde zone-indeling zijn nog niet geporteerd. Die acties zijn verborgen in deze APK. Bewaar de app tijdens het testen: verwijderen wist de lokale koppelidentiteit; een update met dezelfde ondertekening behoudt die.

SHA-256 van de APK: `cf1a36ef7a96cb1fd3ef84e9f12db014932e82896dda4217867ed563ba4cf214`.

## Receiver-firmware

Downloaden en importeren van OTA-bestanden blijven verwijderd. Deze demo bevat geen receiver-firmwarebestanden en voert geen echte receiver-updates uit. De Android-download is een app-installatiebestand, geen receiver-update.

## Controle en grenzen

De brede interfacecontrole slaagt in Chromium en WebKit op 320, 390 en 430 pixels, in licht en donker: 54 van 54 controles. Navigatie, annuleren, gedeelde kleurkiezers, animatiegroepen en instellingen zijn daarbij getest met geïsoleerde voorbeeldgegevens.

De Android-app is gebouwd en de ondertekening en pakketinhoud zijn gecontroleerd. De APK is geïnstalleerd en gestart in een Android 16-emulator. De ingevoerde stand en zone blijven na heropenen bewaard; een niet-receiver-Wi-Fi wordt niet als succesvolle koppeling behandeld. De native koppel- en bedieningsroutes zijn daarnaast getest met onafhankelijke, ondertekende en versleutelde firmware-testendpoints, inclusief alle vier RGBW/SPI-hoofdreceiver/node-combinaties. Dit zijn geen radiotests met echte receivers.

De gepubliceerde bestanden en het daadwerkelijk gedownloade APK-bestand worden afzonderlijk met de release-inventaris vergeleken. Deze ronde verandert de iPhone-app en receiver-firmware niet. Koppeling en bediening op een fysieke Android-telefoon, radiobereik, synchronisatie en zichtbare lichtuitvoer moeten nog met echte hardware worden bevestigd. Browser- en emulatortests bewijzen die niet.
