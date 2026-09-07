# Aluvision Lighting Control — 21.0.8, build 34

De volledige webinterface: https://sdlvisuals.github.io/aluvision-direct-ble/?release=21.0.8-build34

Build 34 bevat verdere verbeteringen aan live kleuren, het wisselen en annuleren
van verbindingen, grote groepen en RGBW-voorbeelden. Oude opdrachten volgen niet
meer naar een andere receiver. Een verwijderde groep krijgt geen wachtende
kleurwijziging meer. Veegbewegingen blijven beschermd tijdens setup en kleuren
kiezen. Lege presets/scènes leiden rechtstreeks naar het aanmaken van een groep.
De gebundelde SPI- en RGBW-receiverfirmware zijn beide 21.0.8. SPI annuleert oude
geplande opdrachten op uitgeschakelde poorten; RGBW bewaart de geplande starttijd
bij het aflopen van een herkenningstest. De eerdere fijnere fades en
pixelovergangen blijven behouden.

Deze publicatie bevat Home, zones, groepen, kleuren, SPI/RGBW-effecten,
receiverinstellingen en de bestaande Studio/Academy. De nieuwe SPI-effecten zijn
Colour Carriages, Ripple Cascade en Meteor Rain. Instellingen en previews delen
dezelfde effectbeschrijvingen als de bijbehorende receiverfirmware.

## Website en geïnstalleerde app

De interface wordt ook in de iPhone-app gebruikt, maar een website heeft niet
dezelfde toegang tot de hardware van een telefoon. De rechtstreekse Wi-Fi- en
Bluetooth-keuze van de geïnstalleerde iPhone-app gebruikt native functies die
Safari niet aanbiedt. Een GitHub-update installeert of flasht niets op een
telefoon of receiver. Bestaande lokale installatiegegevens worden niet gewist.

De optionele lokale netwerkbridge wordt niet automatisch op een privécomputer
gezocht. Deze is alleen actief op een lokale ontwikkelserver of wanneer een
beheerder expliciet een `wifiBridge`-URL meegeeft. Er staat geen persoonlijke
Tailscale-host of wifi-wachtwoord in deze configuratie.

## Receiverbestanden

`firmware/catalog.json` verwijst naar de SPI- en RGBW-application images van
21.0.8 en hun exacte grootte, SHA-256 en hardware-identiteit. Dit zijn
OTA-application images, geen volledige USB-flashbundels. De bestaande
V18-bestanden blijven beschikbaar voor reeds uitgegeven verwijzingen; de
actuele catalogus biedt alleen V21.0.8 aan.

De firmware is een release candidate. Lokale builds en regressietests zijn
geslaagd. Een geslaagde service-OTA naar één RGBW-receiver bewijst niet dat de
native iPhone-updateknop of iedere netwerksituatie werkt. Automatische
gatewayovername, ondertekende firmware, versleuteld/geauthenticeerd meshverkeer
en migratie van reeds botsende oude identiteiten blijven open releasepunten.
Er wordt geen volledig gevalideerde multihopmesh, 60-receivercapaciteit of
productiegarantie geclaimd. NFC blijft uitgeschakeld.

## Publicatiecontrole

- Alle shell-assets en beide OTA-images gecontroleerd op exacte inhoud.
- Volledige interface en navigatie gecontroleerd op mobiele en desktopbreedte.
- Nieuwe SPI-effecten, instellingen, sfeerkeuzes en Studio-overlayregressie getest.
- Versiegebonden service-worker-cache en offline heropenen gecontroleerd.
- Oorspronkelijke lokale werkbestanden niet overschreven bij publicatie.
