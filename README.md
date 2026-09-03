# Aluvision Direct BLE

Deze map is een zelfstandige, statische versie van de Aluvision-bediening. Er is
geen Python-server, Mac, wifi-netwerk of Tailscale nodig tijdens het bedienen.
De browser praat rechtstreeks via Bluetooth Low Energy met één V18.18 receiver.

## iPhone

Safari ondersteunt Web Bluetooth niet. Open de gepubliceerde HTTPS-link daarom
in **Bluefy**. Houd daarna de BOOT-knop van de receiver twee seconden ingedrukt
en kies **Receiver koppelen**.

De installatiecode wordt pas bij het eerste gebruik willekeurig op de iPhone
gemaakt en alleen in de lokale browseropslag bewaard. Er staat geen receiver-ID,
installatiesleutel, wifi-naam of wachtwoord in deze broncode.

## Functies in deze directe versie

- veilige fysieke koppeling via de 60-seconden BOOT/NFC-periode;
- automatische herkenning van SPI of RGBW;
- directe RGB- en witkanaalbediening;
- Static Color los van de animaties;
- live helderheid, snelheid, vloeiendheid, richting en SPI-pixelbreedte;
- passende basisanimaties voor SPI en volledige RGBW-LED Lines;
- receiver laten knipperen;
- offline app-shell na de eerste succesvolle paginalaad.

## Publiceren

Publiceer uitsluitend de inhoud van deze map via een HTTPS-host zoals GitHub
Pages. De bestaande Python-app is hiervoor niet nodig. Deze map bevat bewust
geen firmwarebestanden, gebruikersdata of geheime sleutels.
