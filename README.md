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

## Veilige firmware-update via Bluetooth

Onder **Receivers** toont de app per rechtstreeks verbonden receiver of versie
18.18.0 beschikbaar is. De app kiest het bestand zelf: SPI en RGBW hebben elk
een eigen, vast vertrouwd profiel en kunnen nooit met elkaars bestand worden
bijgewerkt. De update wordt alleen aangeboden wanneer type, model, bord,
firmwarevariant en beschikbare updateruimte exact bevestigd zijn.

Tijdens de update:

- blijft de updatepagina open en blijft de receiver dichtbij en onder spanning;
- controleert de app eerst bestandsgrootte, SHA-256 en ingebouwde
  firmware-identiteit;
- wordt ieder klein datapakket apart door de receiver bevestigd;
- kan veilig worden geannuleerd totdat de definitieve installatie begint;
- herstart de receiver automatisch en controleert de app daarna opnieuw het
  receiver-ID, profiel, versienummer en de geldige opstartstatus.

Een onbekende updateruimte, een ouder receiverprofiel of een onverwachte
receiver blokkeert de draadloze update. In dat geval blijft de bestaande
firmware onaangeroerd en meldt de app dat eerst een update via USB nodig is.
Na een onderbroken overdracht kun je opnieuw verbinden en de update opnieuw
starten; na **Installeren** mag de receiver niet handmatig worden uitgeschakeld.

De gepubliceerde catalogus bevat uitsluitend de twee volledige
applicatiebestanden voor **SPI 18.18.0 NFC_ONLY** en **RGBW 18.18.0 NFC_ONLY**.
Bootloader-, partitietabel- en samengevoegde bestanden worden niet gebruikt.

## Publiceren

GitHub Pages publiceert rechtstreeks vanuit deze map/repository. Alle paden zijn
relatief en de service worker gebruikt uitsluitend caches met het voorvoegsel
`aluvision-direct-`.
