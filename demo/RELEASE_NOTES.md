# Demo V40 · Android-testapp 3 · 2 oktober 2026

Release: `v40-android-test3-20261002`.

Deze browserdemo gebruikt fictieve receivers. Er worden geen opdrachten naar echte verlichting verstuurd. De voorbeeldstand begint na herladen opnieuw.

## Wat is nieuw?

Rustiger melkglas en overzichtelijke kleur-, galerij- en animatie-instellingen. RGBW en SPI behouden hun eigen bediening; tunnel- en wandvoorbeelden blijven bij de juiste groep. De gedeelde kleurkiezer, vloeiende overgangen en minder-bewegingvoorkeur blijven beschikbaar. Een nieuw gekozen animatierecept start met zijn eigen standaardinstellingen; bestaande eigen scènes en presets worden daardoor niet herschreven.

## Android-testapp downloaden

Open **Meer → Android-testapp downloaden**. De ondertekende APK `0.1.0-test.3` is ongeveer 2,4 MB en vereist Android 8 of nieuwer. De downloadrij bestaat uitsluitend in deze GitHub-demo, niet in geïnstalleerde apps.

De Android-testapp begint leeg. Verbind de telefoon zelf met de Wi-Fi van een nog niet gekoppelde hoofdreceiver. Daarna kun je RGBW- en SPI-receivers koppelen, kleuren en animaties bedienen en SPI-pixels en kanten instellen. PIN-herstel, OTA, ontkoppelen/resetten, backupimport en het aanpassen van een gepubliceerde zone-indeling zijn in deze APK nog niet beschikbaar; bijbehorende acties zijn verborgen. Een bestaande beveiligde iPhone- of Mac-installatie wordt niet automatisch overgenomen.

Verwijderen van de app wist haar lokale koppelidentiteit. Een update met dezelfde ondertekening behoudt de appgegevens. Dit is een testversie; bediening en radio op een fysieke Android-telefoon zijn nog niet bevestigd.

APK SHA-256: `5c8921aa383cbfb8180e483ef8cb0fdc6f1b5d0bb7011a894de9e3032af7fed5`.
Eerdere APK-versies blijven als ongewijzigde bestanden behouden; de huidige downloadrij wijst naar testversie 3.

## Controle en grenzen

De nieuwe receptbron slaagt voor 194 gerichte controles: 97 in Chromium en 97 in WebKit, zonder fouten of overgeslagen tests. Deze controles omvatten PIN-statusinterfaces met nagebootste native antwoorden, kleurweergave, interfacehelderheid, Android-menu/servicegrenzen en vormgeving. Dit is geen bewijs van echte PIN-herstel-, radio-, synchronisatie- of lichtuitvoer op hardware.

De APK is daadwerkelijk gebouwd; pakket, broninventaris en ondertekening zijn gecontroleerd. Een emulatorinstallatie met dezelfde APK-bytes is afzonderlijk vastgelegd, maar GUI-start is voor deze versie niet geverifieerd. De downloadmanifestclaim blijft daarom `installedVerified:false`. Er wordt geen actuele iPhone- of Mac-installatie geclaimd.

Deze demo bevat geen receiver-firmwarebestanden, OTA-downloads of softwarebestandimport. De APK is een app-installatiebestand, geen receiver-update. Gepubliceerde demo-/APK-bytes moeten na voorbereiding en na publicatie nog onafhankelijk worden gecontroleerd.
