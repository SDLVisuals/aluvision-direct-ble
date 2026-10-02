# Demo V40 · rustigere bediening · 2 oktober 2026

Release: `v40-ux-refinement-20261002`.

Deze browserdemo gebruikt fictieve receivers. Er worden geen opdrachten naar echte verlichting verstuurd. De voorbeeldstand begint na herladen opnieuw.

## Wat is nieuw?

De navigatie heeft zachter gerookt glas en een rustige, duidelijk gemarkeerde actieve tab. Kleurwiel en helderheid staan vóór ledlinebeheer, zodat je meteen kunt bedienen. Herhaalde uitleg is korter, Instellingen heeft een duidelijkere titel en scène-acties zijn compacter. Warmwit blijft direct beschikbaar. RGBW, SPI, tunnel en wand behouden hun eigen bediening en voorbeelden. Verminderde beweging wordt gerespecteerd; deze demo-update wijzigt geen PIN-, herstel- of receiverlogica.

## Android-testapp downloaden

Open **Meer → Android-testapp downloaden**, of de [Android-downloadpagina](../android/). De ondertekende APK `0.1.0-test.8` is ongeveer 2,4 MB en vereist Android 8 of nieuwer. De downloadrij bestaat uitsluitend in deze GitHub-demo, niet in geïnstalleerde apps. Testversie 8 herstelt een fout bij het terugkeren naar een lege app: een ontbrekende PIN-status veroorzaakte dan een JavaScript-fout. De bestaande PIN-functies en ondertekening blijven behouden; deze hotfix importeert niet alle latere wijzigingen van de gedeelde interface of SPI-preview.

De Android-testapp begint leeg. Voor een nieuwe stand verbind je de telefoon zelf met de Wi-Fi van een nog niet gekoppelde hoofdreceiver. Daarna zijn RGBW/SPI-koppeling, kleuren, animaties en SPI-pixels en kanten beschikbaar. Voor een bestaande beveiligde stand verbind je met de Wi-Fi van die stand en log je in met de PIN. Testversie 8 behoudt het ophalen van de bestaande stand, zones, receivers, scènes, kleuren en animatiepresets; alle receivers moeten daarvoor online zijn.

OTA, ontkoppelen/resetten, backupimport, het aanpassen van een gepubliceerde zone-indeling en het terugdelen van nieuwe instellingen via receivers zijn in deze APK nog niet beschikbaar. Gelijktijdige bediening vanaf twee fysieke telefoons is niet bewezen. PIN-inlog en herstel zijn softwarematig gecontroleerd, niet met echte receivers op een Android-telefoon.

Verwijderen van de app wist haar lokale koppelidentiteit. Een update met dezelfde ondertekening behoudt de appgegevens. Dit is een testversie; bediening en radio op een fysieke Android-telefoon zijn nog niet bevestigd.

APK SHA-256: `2b9267c34bb6bde97708f98eef0d83a5c7678c958b24a150deffb5a7a58319bc`.
Eerdere gepubliceerde APK-versies blijven als ongewijzigde bestanden behouden; de huidige downloadrij wijst naar testversie 8. Kies **Bijwerken**, niet verwijderen.

## Controle en grenzen

De eerdere demo-update slaagde voor acht gerichte controles op de exacte publieke assets: navigatie, bediening vóór beheer, uitklappen, instellingen, contrast en cachetags bij 320, 390 en 430 pixels in licht/donker. Daarnaast slaagden een bestaande RGBW/SPI-demo-onboardingtest en twee nieuwe geïsoleerde licht/donker-doorlopen met screenshots. Deze Android-hotfix wijzigt die demobediening niet; alleen de APK-verwijzingen en release-informatie veranderen.

De APK is gebouwd; pakket en ondertekening zijn gecontroleerd. Dezelfde lifecycle-regressie faalt viermaal op de echte test.7 APK en slaagt viermaal op test.8. Alle 26 samengestelde PIN-browsergevallen en 111 pure hersteltests slagen opnieuw. Op een aparte Android API36-emulator is de daadwerkelijke update van 7 naar 8 geïnstalleerd, zijn de geïnstalleerde APK-bytes gecontroleerd en slaagt driemaal achtergrond/terugkeer zonder de oude fout. `installedVerified:true` verwijst uitsluitend naar dat emulatorbewijs, niet naar een fysieke telefoon. De native/security-bronnen blijven identiek aan de eerder afzonderlijk gecontroleerde opslagfixture; de 56 oudere opslagcontroles worden niet als een nieuwe fysieke test geclaimd. Geen bewijs van fysieke PIN-, radio-, synchronisatie- of lichtuitvoer, en geen installatie op de iPhone of receivers.

Deze demo bevat geen receiver-firmwarebestanden, OTA-downloads of softwarebestandimport. De APK is een app-installatiebestand, geen receiver-update. Gepubliceerde demo-/APK-bytes moeten na voorbereiding en na publicatie nog onafhankelijk worden gecontroleerd.
