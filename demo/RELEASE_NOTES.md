# Demo V40 · rustigere bediening · 2 oktober 2026

Release: `v40-ux-refinement-20261002`.

Deze browserdemo gebruikt fictieve receivers. Er worden geen opdrachten naar echte verlichting verstuurd. De voorbeeldstand begint na herladen opnieuw.

## Wat is nieuw?

De navigatie heeft zachter gerookt glas en een rustige, duidelijk gemarkeerde actieve tab. Kleurwiel en helderheid staan vóór ledlinebeheer, zodat je meteen kunt bedienen. Herhaalde uitleg is korter, Instellingen heeft een duidelijkere titel en scène-acties zijn compacter. Warmwit blijft direct beschikbaar. RGBW, SPI, tunnel en wand behouden hun eigen bediening en voorbeelden. Verminderde beweging wordt gerespecteerd; deze demo-update wijzigt geen PIN-, herstel- of receiverlogica.

## Android-testapp downloaden

Open **Meer → Android-testapp downloaden**, of de [Android-downloadpagina](../android/). De ondertekende APK `0.1.0-test.7` is ongeveer 2,4 MB en vereist Android 8 of nieuwer. De downloadrij bestaat uitsluitend in deze GitHub-demo, niet in geïnstalleerde apps. Deze demopublicatie vervangt de APK niet: testversie 7 behoudt haar eerder gebouwde interface en PIN-functies.

De Android-testapp begint leeg. Voor een nieuwe stand verbind je de telefoon zelf met de Wi-Fi van een nog niet gekoppelde hoofdreceiver. Daarna zijn RGBW/SPI-koppeling, kleuren, animaties en SPI-pixels en kanten beschikbaar. Voor een bestaande beveiligde stand verbind je met de Wi-Fi van die stand en log je in met de PIN. Testversie 7 kan de bestaande stand, zones, receivers, scènes, kleuren en animatiepresets ophalen; alle receivers moeten daarvoor online zijn.

OTA, ontkoppelen/resetten, backupimport, het aanpassen van een gepubliceerde zone-indeling en het terugdelen van nieuwe instellingen via receivers zijn in deze APK nog niet beschikbaar. Gelijktijdige bediening vanaf twee fysieke telefoons is niet bewezen. PIN-inlog en herstel zijn softwarematig gecontroleerd, niet met echte receivers op een Android-telefoon.

Verwijderen van de app wist haar lokale koppelidentiteit. Een update met dezelfde ondertekening behoudt de appgegevens. Dit is een testversie; bediening en radio op een fysieke Android-telefoon zijn nog niet bevestigd.

APK SHA-256: `c8d2b91b188015afd45260c780643ab772ebadfe0e36800d3c96845f9260563f`.
Eerdere gepubliceerde APK-versies blijven als ongewijzigde bestanden behouden; de huidige downloadrij wijst naar testversie 7.

## Controle en grenzen

Deze demo-update slaagt voor acht gerichte controles op de exacte publieke assets: navigatie, bediening vóór beheer, uitklappen, instellingen, contrast en cachetags bij 320, 390 en 430 pixels in licht/donker. Daarnaast slagen een bestaande RGBW/SPI-demo-onboardingtest en twee nieuwe geïsoleerde licht/donker-doorlopen met screenshots. Root-opslag blijft bewaard, de demo begint leeg na herladen en de Android-download blijft naar dezelfde testversie 7 wijzen.

De APK is gebouwd; pakket en ondertekening zijn gecontroleerd. Testversie 7 heeft afzonderlijk bewijs van 26 samengestelde PIN-browsergevallen en 56 controles in een geïsoleerde Android-opslagfixture. Dat is geen bewijs van fysieke PIN-, radio-, synchronisatie- of lichtuitvoer. De downloadmanifestclaim voor de testapp blijft `installedVerified:false`. Deze demopublicatie installeert niets op iPhone, Mac of Android en verandert de bestaande app-releasevelden niet.

Deze demo bevat geen receiver-firmwarebestanden, OTA-downloads of softwarebestandimport. De APK is een app-installatiebestand, geen receiver-update. Gepubliceerde demo-/APK-bytes moeten na voorbereiding en na publicatie nog onafhankelijk worden gecontroleerd.
