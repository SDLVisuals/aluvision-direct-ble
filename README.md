# Aluvision Lighting Control · directe webapp

Dit is de volledige statische Aluvision-app voor GitHub Pages. De app opent
meteen op Home; Bluetooth is een normale koppelactie onder **Receivers** en
NFC blijft zichtbaar als de geplande aanraakmethode.

## Wat lokaal op het toestel werkt

- Home en bediening van alle verlichting in de actieve locatie;
- locaties, zones en aparte groepspagina's;
- strikt gescheiden SPI- en RGBW-groepen;
- vaste kleur, RGB/W-kleurkeuze en live effectinstellingen;
- de volledige SPI-catalogus (86 gewone effecten), 24 tunnelpresets en 5
  whole-line effecten met vaste firmware-varianten 2–102;
- RGBW-effecten met eenvoudige volledige-lijnfades en pulses;
- horizontale en verticale tunnelpreviews;
- scènes met een vrije selectie van groepen;
- presets die opnieuw op een compatibele groep kunnen worden toegepast;
- receivers koppelen, herkennen, toewijzen, kalibreren en verwijderen;
- doorlopende LED Lines met cumulatieve pixeloffsets;
- parallelle LED Lines met gedeelde fase, lijnindex en instelbare lijntiming;
- dark mode en offline app-shell na de eerste succesvolle laadbeurt.

Instellingen, scènes en presets staan uitsluitend in de lokale browseropslag.
De installatiecode wordt op het toestel willekeurig aangemaakt. De repository
bevat geen receiver-ID, installatiesleutel, wifigegevens of gebruikersdata.

## iPhone

Safari biedt nog geen Web Bluetooth. Open daarom de gepubliceerde HTTPS-link in
**Bluefy** en kies in de app **Receivers → Receiver toevoegen → Bluetooth
koppelen**. Eén via Bluetooth verbonden receiver fungeert als toegang tot de
receivers met dezelfde installatiesleutel; de receiverfirmware verzorgt het
ESP-NOW-verkeer naar de andere doelen.

## Publiceren

GitHub Pages publiceert rechtstreeks vanuit deze map/repository. Alle paden zijn
relatief en de service worker gebruikt uitsluitend caches met het voorvoegsel
`aluvision-direct-`.
