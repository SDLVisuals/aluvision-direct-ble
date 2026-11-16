# Aluvision Lighting · V50

[Open de interactieve demo](https://sdlvisuals.github.io/aluvision-direct-ble/demo/) · [Android-testapp](https://sdlvisuals.github.io/aluvision-direct-ble/android/)

## Interactieve demo

De hoofdlink opent de app zoals op de telefoon: de schermen in Flutter (welkom, nieuwe stand, standpagina, zones, scènes, receivers, instellingen), met eronder de vorige interface voor de stap die nog niet in Flutter staat (een receiver koppelen). Deze demo is gebouwd uit dezelfde code als iPhone-build 1052 (16 november 2026).

De demo gebruikt uitsluitend fictieve receivers. Ze bestuurt geen fysieke verlichting, maakt geen echte wifi- of bluetoothverbinding en bewaart niets in de browser: herladen begint opnieuw. Ze werkt op elke breedte, maar is gemaakt voor een telefoon (390 px).

## Android-testapp

De actuele download is **50.0.0-c100-adaptive, code 36**, voor Android 8 of nieuwer. Deze testversie bevat de aangepaste telefoon- en tabletindeling, een compacte kleurkiezer voor liggend gebruik en hetzelfde kleurenwiel met fijne RGBW-instellingen voor effen kleuren en Verloop. De schermafbeeldingen op de downloadpagina komen uit de webdemo met fictieve receivers.

Het pakket behoudt dezelfde pakketnaam en handtekening als code 35: kies **Bijwerken**, zonder de app eerst te verwijderen. Build, lint, gebundelde bestanden en ondertekening zijn gecontroleerd. Op een API 36-emulator zijn bijwerken van code 35 naar 36 met behoud van de stand, invoer met het Android-toetsenbord, draaien en donkere modus getest. De onopgeslagen invoer en het appproces bleven daarbij behouden.

De Android-versie blijft een testversie. Receiverupdates, receivers verwijderen, fabrieksreset en backupbestanden zijn nog niet beschikbaar. De getimede verbindingstest en het automatisch ophalen van gewijzigde uitgangen van reeds bekende receivers zijn nog niet gelijk aan de Mac-versie. Werking op een fysieke Android-telefoon of tablet en met echte receivers is nog niet bevestigd. Er zit geen receiverfirmware in de APK. Eerdere APK's blijven beschikbaar voor bestaande verwijzingen.

## Website en geïnstalleerde app

Een GitHub Pages-update installeert niets op een iPhone, Android-telefoon of receiver. De browserdemo en APK hebben afzonderlijke controlebewijzen in [demo/release-info.json](demo/release-info.json). Oude APK's en legacy-assets blijven bestaan voor reeds gedeelde verwijzingen, maar zijn niet de actuele startpagina.
