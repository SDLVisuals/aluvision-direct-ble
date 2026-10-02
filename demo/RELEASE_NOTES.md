# Demo V40 · zichtbaar melkglas · 2 oktober 2026

Release: `v40-visible-uplift-20261002`.

Deze browserdemo gebruikt fictieve receivers. Er worden geen opdrachten naar echte verlichting verstuurd. De voorbeeldstand begint na herladen opnieuw.

## Wat is nieuw?

Een duidelijkere visuele update: een melkglazen welkom- en standoverzicht, warme neutrale diepte en donker blauwgrijs glas. Zonekaarten hebben herkenbare typebadges; de receiverlijst toont type, zone en aansluitingen. Instellingen zijn compacter en de navigatie zweeft boven de inhoud. De zone-menuknop heeft geen felle witte boog of dubbele rand meer. Warmwit blijft direct beschikbaar. RGBW, SPI, tunnel en wand behouden hun eigen bediening en voorbeelden; kleuren, presets en bestaande koppelingen worden niet omgezet.

## Android-testapp downloaden

Open **Meer → Android-testapp downloaden**. De ondertekende APK `0.1.0-test.5` is ongeveer 2,4 MB en vereist Android 8 of nieuwer. De downloadrij bestaat uitsluitend in deze GitHub-demo, niet in geïnstalleerde apps. Deze versie neemt de nieuwe V40-vormgeving over; native receiverfuncties en ondertekening zijn ongewijzigd.

De Android-testapp begint leeg. Verbind de telefoon zelf met de Wi-Fi van een nog niet gekoppelde hoofdreceiver. Daarna kun je RGBW- en SPI-receivers koppelen, kleuren en animaties bedienen en SPI-pixels en kanten instellen. PIN-herstel, OTA, ontkoppelen/resetten, backupimport en het aanpassen van een gepubliceerde zone-indeling zijn in deze APK nog niet beschikbaar; bijbehorende acties zijn verborgen. Een bestaande beveiligde iPhone- of Mac-installatie wordt niet automatisch overgenomen.

Verwijderen van de app wist haar lokale koppelidentiteit. Een update met dezelfde ondertekening behoudt de appgegevens. Dit is een testversie; bediening en radio op een fysieke Android-telefoon zijn nog niet bevestigd.

APK SHA-256: `bcb8b39b354387c14b17e9e86ddb740095c888bb012c9ade1c22d43b3118985d`.
Eerdere gepubliceerde APK-versies blijven als ongewijzigde bestanden behouden; de huidige downloadrij wijst naar testversie 5.

## Controle en grenzen

De nieuwe APK slaagt voor 22 gerichte browsercontroles: 11 in Chromium en 11 in WebKit, zonder fouten of overgeslagen tests. De demo krijgt afzonderlijke controles van navigatie, RGBW/SPI-context, kleuren, groepsvoorbeelden, menu's, licht/donker en de exacte downloadlink. Browsercontroles zijn geen bewijs van echte PIN-herstel-, radio-, synchronisatie- of lichtuitvoer op hardware.

De APK is daadwerkelijk gebouwd; pakket, volledige assetinventaris, uitlijning en ondertekening zijn onafhankelijk gecontroleerd. Deze nieuwe APK is nog niet op een Android-apparaat of emulator geïnstalleerd. De downloadmanifestclaim blijft daarom `installedVerified:false`. De overeenkomstige iPhone-update 40.0.2/build 243 is gebouwd en gecontroleerd, maar nog niet geïnstalleerd omdat de fysieke iPhone niet bereikbaar is. Er wordt geen actuele iPhone- of Mac-installatie geclaimd.

Deze demo bevat geen receiver-firmwarebestanden, OTA-downloads of softwarebestandimport. De APK is een app-installatiebestand, geen receiver-update. Gepubliceerde demo-/APK-bytes moeten na voorbereiding en na publicatie nog onafhankelijk worden gecontroleerd.
