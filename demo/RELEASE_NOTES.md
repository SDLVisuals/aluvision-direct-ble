# Demo V40 · rustigere bediening · 2 oktober 2026

Release: `v40-ux-refinement-20261002`.

Deze browserdemo gebruikt fictieve receivers. Er worden geen opdrachten naar echte verlichting verstuurd. De voorbeeldstand begint na herladen opnieuw.

## Wat is nieuw?

De navigatie heeft zachter gerookt glas en een rustige, duidelijk gemarkeerde actieve tab. Kleurwiel en helderheid staan vóór ledlinebeheer, zodat je meteen kunt bedienen. Herhaalde uitleg is korter, Instellingen heeft een duidelijkere titel en scène-acties zijn compacter. Warmwit blijft direct beschikbaar. RGBW, SPI, tunnel en wand behouden hun eigen bediening en voorbeelden. Verminderde beweging wordt gerespecteerd; deze demo-update wijzigt geen PIN-, herstel- of receiverlogica.

## Android-testapp downloaden

De Android-download is voorbereid voor `41.0.2`, code `14` (6 oktober 2026). Open **Meer → Android-testapp downloaden**, of de [Android-downloadpagina](../android/). De ondertekende APK is 16.845.968 bytes (ongeveer 16,1 MB) en vereist Android 8 of nieuwer. De downloadrij bestaat uitsluitend in deze GitHub-demo, niet in geïnstalleerde apps. De V40-demo en de eerdere interfacevoorbeelden blijven behouden. De Android-downloadpagina toont daarnaast één echte offline-emulatoropname van deze APK. Het QR-voorbeeld blijft expliciet een simulatie met fictieve testcode; de andere galerijbeelden zijn eerdere V40-voorbeelden. Geen van de beelden bewijst fysieke receiverbediening.

De Android-testapp begint zonder voorbeeldstand. Verbind de telefoon zelf met de Wi-Fi van de stand en open een voorbereide stand met de standcode of een gedeelde QR/deellink. Een bestaande stand zonder standcode moet eerst met de oorspronkelijke gekoppelde app worden voorbereid. Een netwerkfout start geen nieuwe stand en geeft geen oude Owner-toegang. Camera-, QR-, link- en systeemdeelvenster-providers zijn geïmplementeerd; echte Android-camera en toestemmingsdialogen zijn niet fysiek getest.

Kleuren, animaties, centrale zones en presets hebben de getypeerde standverbinding. Tijdelijke herkenningskleuren, pixelinstellingen en receiverupdates hebben afzonderlijke getypeerde providers. Toevoegen en ontkoppelen na de standcode, resetten en backupbestanden zijn nog niet beschikbaar. De Mac-only STATIC_GESTURE-test is niet geactiveerd op Android. Mobiele snelheid, gelijktijdige bediening vanaf twee fysieke telefoons en receiverlicht op Android zijn niet bewezen.

Verwijderen van de app wist haar lokale koppelidentiteit. Een update met dezelfde ondertekening behoudt de appgegevens. Dit is een testversie; bediening en radio op een fysieke Android-telefoon zijn nog niet bevestigd.

APK SHA-256: `84d1e566b90c46116445e16413525bce0082c1e25f480c1098017eaf6565b424`.
Pakket: `com.aluvision.lighting.android.test`; ondertekening SHA-256: `b598fc6fa30b423517d6ca68e3bb1191248a32723174d4703baaede9125936ac`. Pakket en signer zijn gelijk aan de eerdere publieke testversie 8; code 14 is hoger. Eerdere gepubliceerde APK-versies blijven ongewijzigd behouden. Kies **Bijwerken**, niet verwijderen; een echte in-place installatie van code 14 is nog niet uitgevoerd.

## Controle en grenzen

De eerdere demo-update slaagde voor acht gerichte controles op de exacte publieke assets: navigatie, bediening vóór beheer, uitklappen, instellingen, contrast en cachetags bij 320, 390 en 430 pixels in licht/donker. Daarnaast slaagden een bestaande RGBW/SPI-demo-onboardingtest en twee nieuwe geïsoleerde licht/donker-doorlopen met screenshots. Deze Android-hotfix wijzigt die demobediening niet; alleen de APK-verwijzingen en release-informatie veranderen.

Code 14 is met de echte Android Release-SDK gebouwd. Pakket, versie, uitlijning, ondertekening, signer-continuïteit en de exacte gebundelde assets zijn gecontroleerd. De gecombineerde bronfreeze is `3e94908fba0ba146109996026d740a25acc5b997fbf6bf76a04eae25ef58d613`; APK-bouwbewijs SHA-256 `11e9ab7f80e818bf1e74bd3140da9966922a9d2adefd233aa9fcdc45cd4db876`. Gerichte native, route-, wrapper- en browsercontroles zijn softwarebewijs, geen fysieke Android-acceptatie.

`installedVerified:true` betekent hier uitsluitend installatie in een nieuwe, geïsoleerde headless Android-emulator (API 36, arm64). Negen controles slaagden op de exacte code14-APK: de geïnstalleerde APK-bytes kwamen overeen met de ondertekende download, een koude start toonde **Stand openen** met verbinding niet bevestigd, en terugkeer uit de achtergrond slaagde met hetzelfde app-proces. Wifi stond uit, vliegtuigmodus aan en de emulator had geen netwerkroutes; extern netwerkverkeer was bovendien geblokkeerd. De bestaande AVD en APK bleven ongewijzigd; de testomgeving is afgesloten. Emulator-installbewijs SHA-256: `ddc9c41630afa316d3828413cad3973288d226970805b1dae5ddfd21f64369c3`; begrensde testtoelichting SHA-256: `c6e6a9510de095e0ca99d58dfee3b9eb1c0bdf0bbce19d2a24bd16063f6d2554`. Het eerdere test8-emulatorbewijs wordt niet hergebruikt.

De vastgelegde foutlogs omvatten alleen `AndroidRuntime:E`, `chromium:E` en `cr_WebView:E`, niet de volledige JavaScript-console. Er werd geen fatale crash waargenomen; er stonden wel drie Chromium-cachemeldingen over een ontbrekende wasm-map en indexopbouw. Dit bewijst niet dat alle runtimefouten zijn opgelost. Een fysieke Android-telefoon, camera/toestemmingen, Wifi, receivers, mobiele snelheid, twee-telefoon-bediening en een echte in-place update zijn niet getest.

Deze browserdemo bevat geen receiver-firmwarebestanden, OTA-downloads of softwarebestandimport. De APK is een app-installatiebestand; haar ingebouwde native receiverupdate-provider maakt van de browserdemo geen hardwaretool. Demo-/APK-bytes moeten lokaal en na een eventuele publicatie afzonderlijk worden gecontroleerd. Deze tekst- en beeldvoorbereiding pusht, publiceert, installeert of flasht niets; de beschreven installatie vond uitsluitend in de afgesloten emulator plaats.
