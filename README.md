# Aluvision Lighting · V50

[Open de interactieve demo](https://sdlvisuals.github.io/aluvision-direct-ble/demo/) · [Android-testapp](https://sdlvisuals.github.io/aluvision-direct-ble/android/)

## Interactieve demo

De hoofdlink opent de V50-demo. Probeer zones, kleuren, RGBW/SPI-animaties, opgeslagen scènes en licht/donker in de telefooninterface.

De demo gebruikt uitsluitend fictieve receivers. Ze begint leeg en bewaart haar voorbeeldstand alleen tijdelijk; herladen begint opnieuw. Ze bestuurt geen fysieke verlichting, maakt geen echte wifi-verbinding en biedt geen browser-OTA. PIN en delen zijn in deze tijdelijke ééngebruikerversie uitgeschakeld.

De demo gebruikt de huidige gedeelde interface. Native functies blijven afhankelijk van expliciete appmogelijkheden; de browser krijgt geen receiver-, beveiligings- of firmwaretoegang.

## Android-testapp

De actuele download is **50.0.0, code 23**. Het pakket is ondertekend met dezelfde bestaande identiteit en zonder gegevens te wissen gecontroleerd in een Android 36-emulator. De echte appschermen, opnieuw openen en herstel van keuzes zijn getest; de extra native test gebruikt een aparte test-APK met nagebootste receivers. Die testcode zit niet in de download. Bediening van fysieke receivers vanaf een echt Android-toestel is nog niet bevestigd.

## Website en geïnstalleerde app

Een GitHub Pages-update installeert niets op een iPhone, Android-telefoon of receiver. De browserdemo en APK hebben afzonderlijke controlebewijzen in [demo/release-info.json](demo/release-info.json). Oude APK's en legacy-assets blijven bestaan voor reeds gedeelde verwijzingen, maar zijn niet de actuele startpagina.
