# Aluvision Lighting · V50

[Open de interactieve demo](https://sdlvisuals.github.io/aluvision-direct-ble/demo/) · [Android-testapp](https://sdlvisuals.github.io/aluvision-direct-ble/android/)

## Interactieve demo

De hoofdlink opent de V50-demo. Probeer zones, kleuren, RGBW/SPI-animaties, opgeslagen scènes en licht/donker in de telefooninterface.

De demo gebruikt uitsluitend fictieve receivers. Ze begint leeg en bewaart haar voorbeeldstand alleen tijdelijk; herladen begint opnieuw. Ze bestuurt geen fysieke verlichting, maakt geen echte wifi-verbinding en biedt geen browser-OTA. PIN en delen zijn in deze tijdelijke ééngebruikerversie uitgeschakeld.

De demo gebruikt de huidige gedeelde interface. Native functies blijven afhankelijk van expliciete appmogelijkheden; de browser krijgt geen receiver-, beveiligings- of firmwaretoegang.

## Android-testapp

De actuele download is **50.0.0-27, code 27**. Het pakket gebruikt dezelfde bestaande ondertekening en pakketnaam. De daadwerkelijk geïnstalleerde code 27 is byte-voor-byte gecontroleerd in de Android 36-testemulator; de bestaande pakketidentiteit en eerste installatiedatum bleven behouden. Startscherm, teruggaan en het opnieuw openen van een leeg standnaamformulier zijn getest. Afzonderlijke native softwaretests gebruiken versleutelde, nagebootste receivers; die testcode zit niet in de download. Bediening van fysieke receivers vanaf een echt Android-toestel is nog niet bevestigd.

De app controleert de ondersteunde receiversoftware vóór lichtopdrachten. Het instellen van SPI-poorten heeft een native uitvoeringsbudget van 75 seconden; wachttijd vóór uitvoering en Android-systeemvertragingen zijn daarmee niet gegarandeerd begrensd. Bij een ontbrekende bevestiging blijft het exacte instelverzoek bewaard voor expliciete controle, zonder een tweede afrondingsopdracht als de receiver al heeft opgeslagen. Een onbevestigd resultaat betekent niet dat de receiver niets heeft gewijzigd. Receiverupdates, verwijderen, PIN, gedeelde standtoegang en gezamenlijke standanimaties blijven niet beschikbaar op Android.

## Website en geïnstalleerde app

Een GitHub Pages-update installeert niets op een iPhone, Android-telefoon of receiver. De browserdemo en APK hebben afzonderlijke controlebewijzen in [demo/release-info.json](demo/release-info.json). Oude APK's en legacy-assets blijven bestaan voor reeds gedeelde verwijzingen, maar zijn niet de actuele startpagina.
