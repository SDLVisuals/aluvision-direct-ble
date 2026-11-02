# Aluvision Lighting · V50

[Open de interactieve demo](https://sdlvisuals.github.io/aluvision-direct-ble/demo/) · [Android-testapp](https://sdlvisuals.github.io/aluvision-direct-ble/android/)

## Interactieve demo

De hoofdlink opent de huidige C100-interface. Probeer zones, kleuren, RGBW/SPI-animaties, scènes en licht/donker op een telefoon of tablet, staand of liggend. De indeling is in de browser gecontroleerd van 320 tot 1600 CSS-pixels; op brede schermen krijgen voorbeeld en bediening elk hun eigen ruimte.

De demo gebruikt uitsluitend fictieve receivers. Ze begint leeg en bewaart haar voorbeeldstand alleen tijdelijk; herladen begint opnieuw. Ze bestuurt geen fysieke verlichting, maakt geen echte wifi-verbinding en biedt geen browser-OTA. PIN en delen zijn in deze tijdelijke ééngebruikerversie uitgeschakeld.

De demo gebruikt de huidige gedeelde interface. Native functies blijven afhankelijk van expliciete appmogelijkheden; de browser krijgt geen receiver-, beveiligings- of firmwaretoegang.

In een SPI-zone kun je onder **Kleur → Verloop SPI** een stilstaand kleurverloop maken met twee tot acht kleuren. Verplaats de kleurpunten om de verdeling aan te passen en bewaar je eigen verloopideeën tijdens de demosessie. ‘Kleur toevoegen’ opent meteen hetzelfde kleurenwiel, de helderheid en de fijne RGBW-regelaars als de gewone kleurkeuze. Dit is alleen een browservoorbeeld; deze publicatie wijzigt geen receiverfirmware of geïnstalleerde telefoonapp.

## Android-testapp

De actuele download is **50.0.0-c100-adaptive, code 36**, voor Android 8 of nieuwer. Deze testversie bevat de aangepaste telefoon- en tabletindeling, een compacte kleurkiezer voor liggend gebruik en hetzelfde kleurenwiel met fijne RGBW-instellingen voor effen kleuren en Verloop. De schermafbeeldingen op de downloadpagina komen uit de webdemo met fictieve receivers.

Het pakket behoudt dezelfde pakketnaam en handtekening als code 35: kies **Bijwerken**, zonder de app eerst te verwijderen. Build, lint, gebundelde bestanden en ondertekening zijn gecontroleerd. Op een API 36-emulator zijn bijwerken van code 35 naar 36 met behoud van de stand, invoer met het Android-toetsenbord, draaien en donkere modus getest. De onopgeslagen invoer en het appproces bleven daarbij behouden.

De Android-versie blijft een testversie. Receiverupdates, receivers verwijderen, fabrieksreset en backupbestanden zijn nog niet beschikbaar. De getimede verbindingstest en het automatisch ophalen van gewijzigde uitgangen van reeds bekende receivers zijn nog niet gelijk aan de Mac-versie. Werking op een fysieke Android-telefoon of tablet en met echte receivers is nog niet bevestigd. Er zit geen receiverfirmware in de APK. Eerdere APK's blijven beschikbaar voor bestaande verwijzingen.

## Website en geïnstalleerde app

Een GitHub Pages-update installeert niets op een iPhone, Android-telefoon of receiver. De browserdemo en APK hebben afzonderlijke controlebewijzen in [demo/release-info.json](demo/release-info.json). Oude APK's en legacy-assets blijven bestaan voor reeds gedeelde verwijzingen, maar zijn niet de actuele startpagina.
