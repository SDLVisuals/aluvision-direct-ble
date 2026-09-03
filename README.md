# Aluvision Lighting Control — faithful static build

This directory is a static GitHub Pages port of the exact UI served by the
local Aluvision application on port 8841. It intentionally keeps the original
markup, styles, responsive layout, animation previews and interaction code.

`direct_ble_bridge.js` replaces the local `/api/*` calls with:

- local browser storage for locations, zones, groups, scenes and presets;
- Web Bluetooth pairing and receiver status;
- V18 LIVE, SAVE, CONFIG, identify and pixel-calibration commands;
- ESP-NOW target routing through the currently connected Bluetooth gateway.

`direct_ble_ota.js` adds the existing verified V18.18 direct-Bluetooth update
transport without changing any UI. The local firmware catalogue contains only
the matching SPI and RGBW application images. Before transfer, the app verifies
receiver type, model, board, capacity, file size, SHA-256 and the embedded
firmware identity. It then uses acknowledged 128-byte blocks, a protected
commit boundary and a reconnect/self-test check.

On iPhone, Safari can display the complete interface, but it does not expose
direct Web Bluetooth. Open the same GitHub Pages link in Bluefy to pair a
receiver or control the lights live. This static build needs neither a Mac nor
the local venue Wi-Fi network.

During an active firmware update, pairing, forgetting and light commands are
temporarily paused so the Bluetooth connection cannot switch underneath the
transfer. Normal live lighting resumes immediately after the OTA job reaches a
final state. Firmware binaries are never served from the offline cache.

The release is checked before publication with static contracts, simulated
acknowledged Bluetooth traffic, complete OTA transfers, cache-isolation tests
and mobile/desktop visual regression checks. Those private release tests are
kept outside this public repository.
