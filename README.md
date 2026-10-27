# Aluvision Lighting · V50

[Open de interactieve demo](https://sdlvisuals.github.io/aluvision-direct-ble/demo/) · [Android-testapp](https://sdlvisuals.github.io/aluvision-direct-ble/android/)

## Interactieve demo

De hoofdlink opent de V50-demo. Probeer zones, kleuren, RGBW/SPI-animaties, opgeslagen scènes en licht/donker in de telefooninterface.

De demo gebruikt uitsluitend fictieve receivers. Ze begint leeg en bewaart haar voorbeeldstand alleen tijdelijk; herladen begint opnieuw. Ze bestuurt geen fysieke verlichting, maakt geen echte wifi-verbinding en biedt geen browser-OTA. PIN en delen zijn in deze tijdelijke ééngebruikerversie uitgeschakeld.

De demo gebruikt de huidige gedeelde interface. Native functies blijven afhankelijk van expliciete appmogelijkheden; de browser krijgt geen receiver-, beveiligings- of firmwaretoegang.

In een SPI-zone kun je onder **Kleur → Verloop SPI** een stilstaand kleurverloop maken met twee tot acht kleuren. Verplaats de kleurpunten om de verdeling aan te passen en bewaar je eigen verloopideeën tijdens de demosessie. ‘Kleur toevoegen’ opent meteen hetzelfde kleurenwiel, de helderheid en de fijne RGBW-regelaars als de gewone kleurkeuze. Dit is alleen een browservoorbeeld; deze publicatie wijzigt geen receiverfirmware of geïnstalleerde telefoonapp.

## Android-testapp

De actuele download is **50.0.0-ui756-beta, code 32**. Deze interfacebèta bevat de gedeelde interface756 met toetsenbordaanpassingen, de vernieuwde receiverinstructies en de Tunnel/Wand-keuze. Het pakket behoudt de bestaande pakketnaam en ondertekening. Build, lint, alle gebundelde bestanden en de handtekening zijn gecontroleerd.

De Android-native basis is nog niet volledig: PIN instellen, OTA, receivers verwijderen en gedeelde standtoegang ontbreken. Werking met receiverfirmware77 en op een fysieke Galaxy S24 is nog niet bevestigd. Code32 is een interfacebèta en is nog niet op een Android-toestel geïnstalleerd of fysiek getest. Eerdere APK's blijven beschikbaar voor bestaande verwijzingen.

## Website en geïnstalleerde app

Een GitHub Pages-update installeert niets op een iPhone, Android-telefoon of receiver. De browserdemo en APK hebben afzonderlijke controlebewijzen in [demo/release-info.json](demo/release-info.json). Oude APK's en legacy-assets blijven bestaan voor reeds gedeelde verwijzingen, maar zijn niet de actuele startpagina.
