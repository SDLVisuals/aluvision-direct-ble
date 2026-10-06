# Demo V40 · rustigere bediening · 2 oktober 2026

Release: `v40-ux-refinement-20261002`.

Deze browserdemo gebruikt fictieve receivers. Er worden geen opdrachten naar echte verlichting verstuurd. De voorbeeldstand begint na herladen opnieuw.

## Wat is nieuw?

De navigatie heeft zachter gerookt glas en een rustige, duidelijk gemarkeerde actieve tab. Kleurwiel en helderheid staan vóór ledlinebeheer, zodat je meteen kunt bedienen. Herhaalde uitleg is korter, Instellingen heeft een duidelijkere titel en scène-acties zijn compacter. Warmwit blijft direct beschikbaar. RGBW, SPI, tunnel en wand behouden hun eigen bediening en voorbeelden. Verminderde beweging wordt gerespecteerd; deze demo-update wijzigt geen PIN-, herstel- of receiverlogica.

## Android-testapp downloaden

De Android-download is voorbereid voor `41.0.2`, code `14` (6 oktober 2026). Open **Meer → Android-testapp downloaden**, of de [Android-downloadpagina](../android/). De ondertekende APK is 16.845.968 bytes (ongeveer 16,1 MB) en vereist Android 8 of nieuwer. De downloadrij bestaat uitsluitend in deze GitHub-demo, niet in geïnstalleerde apps. De V40-demo en de eerdere interfacevoorbeelden blijven behouden; ze zijn geen screenshots of releasebewijs van deze APK.

De Android-testapp begint zonder voorbeeldstand. Verbind de telefoon zelf met de Wi-Fi van de stand en open een voorbereide stand met de standcode of een gedeelde QR/deellink. Een bestaande stand zonder standcode moet eerst met de oorspronkelijke gekoppelde app worden voorbereid. Een netwerkfout start geen nieuwe stand en geeft geen oude Owner-toegang. Camera-, QR-, link- en systeemdeelvenster-providers zijn geïmplementeerd; echte Android-camera en toestemmingsdialogen zijn niet fysiek getest.

Kleuren, animaties, centrale zones en presets hebben de getypeerde standverbinding. Tijdelijke herkenningskleuren, pixelinstellingen en receiverupdates hebben afzonderlijke getypeerde providers. Toevoegen en ontkoppelen na de standcode, resetten en backupbestanden zijn nog niet beschikbaar. De Mac-only STATIC_GESTURE-test is niet geactiveerd op Android. Mobiele snelheid, gelijktijdige bediening vanaf twee fysieke telefoons en receiverlicht op Android zijn niet bewezen.

Verwijderen van de app wist haar lokale koppelidentiteit. Een update met dezelfde ondertekening behoudt de appgegevens. Dit is een testversie; bediening en radio op een fysieke Android-telefoon zijn nog niet bevestigd.

APK SHA-256: `84d1e566b90c46116445e16413525bce0082c1e25f480c1098017eaf6565b424`.
Pakket: `com.aluvision.lighting.android.test`; ondertekening SHA-256: `b598fc6fa30b423517d6ca68e3bb1191248a32723174d4703baaede9125936ac`. Pakket en signer zijn gelijk aan de eerdere publieke testversie 8; code 14 is hoger. Eerdere gepubliceerde APK-versies blijven ongewijzigd behouden. Kies **Bijwerken**, niet verwijderen; een echte in-place installatie van code 14 is nog niet uitgevoerd.

## Controle en grenzen

De eerdere demo-update slaagde voor acht gerichte controles op de exacte publieke assets: navigatie, bediening vóór beheer, uitklappen, instellingen, contrast en cachetags bij 320, 390 en 430 pixels in licht/donker. Daarnaast slaagden een bestaande RGBW/SPI-demo-onboardingtest en twee nieuwe geïsoleerde licht/donker-doorlopen met screenshots. Deze Android-hotfix wijzigt die demobediening niet; alleen de APK-verwijzingen en release-informatie veranderen.

Code 14 is met de echte Android Release-SDK gebouwd. Pakket, versie, uitlijning, ondertekening, signer-continuïteit en de exacte gebundelde assets zijn gecontroleerd. De gecombineerde bronfreeze is `3e94908fba0ba146109996026d740a25acc5b997fbf6bf76a04eae25ef58d613`; APK-bouwbewijs SHA-256 `11e9ab7f80e818bf1e74bd3140da9966922a9d2adefd233aa9fcdc45cd4db876`. Gerichte native, getypeerde route-, wrapper- en browsercontroles zijn softwarebewijs, geen fysieke Android-acceptatie. `installedVerified:false`: deze code 14 is niet geïnstalleerd op een emulator of echte telefoon. Het eerdere emulatorbewijs voor testversie 8 wordt niet als code14-test hergebruikt.

Deze browserdemo bevat geen receiver-firmwarebestanden, OTA-downloads of softwarebestandimport. De APK is een app-installatiebestand; haar ingebouwde native receiverupdate-provider maakt van de browserdemo geen hardwaretool. Demo-/APK-bytes moeten lokaal en na een eventuele publicatie afzonderlijk worden gecontroleerd. De lokale voorbereiding zelf pusht, publiceert, installeert of flasht niets.
