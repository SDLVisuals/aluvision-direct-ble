# Aluvision Lighting Control — 21.0.3

De volledige webinterface: https://sdlvisuals.github.io/aluvision-direct-ble/?release=21.0.3

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
21.0.3 en hun exacte grootte, SHA-256 en hardware-identiteit. Dit zijn
OTA-application images, geen volledige USB-flashbundels. De bestaande
V18-bestanden blijven beschikbaar voor reeds uitgegeven verwijzingen; de
actuele catalogus biedt alleen V21.0.3 aan.

De firmware is een release candidate. Lokale builds en regressietests zijn
geslaagd; volledige fysieke OTA-acceptatie, automatische gatewayovername en
verdere netwerkbeveiliging blijven afzonderlijke validatiepunten. Er wordt
geen volledig gevalideerde multihopmesh of productiegarantie geclaimd.

## Publicatiecontrole

- Alle shell-assets en beide OTA-images gecontroleerd op exacte inhoud.
- Volledige interface en navigatie gecontroleerd op mobiele en desktopbreedte.
- Nieuwe SPI-effecten, instellingen, sfeerkeuzes en Studio-overlayregressie getest.
- Versiegebonden service-worker-cache en offline heropenen gecontroleerd.
- Oorspronkelijke lokale werkbestanden niet overschreven bij publicatie.
