# Static SPI gradient — demo handoff

Worktree: `codex/spi-static-gradient-20261027`, based on `6b57ba7`.

## Scope

Only `/demo/` changes. In an SPI zone, **Kleur → Verloop SPI** sits beside **Effen kleur**. RGBW and stand-wide controls retain their existing route. The gradient editor never calls `apply()`, changes a receiver's state, saves a scene, or sends a native/live-control message. It requires the existing browser-demo context, a non-native host, and an SPI zone; there is no firmware capability claim or uniform-STATIC fallback.

The editor previews a stationary gradient across a complete **400-pixel example**. It does not claim the configured receiver has 400 pixels. Two to eight points can be added, removed, recoloured, swapped, dragged, or moved using the position slider. **Kleur toevoegen opens the full ordinary app colour picker immediately**; the new point is inserted only after **Klaar**. Cancel adds nothing. Each point retains RGB, white, brightness and on/off. Arrow keys move a focused point by 1%, Shift+Arrow by 10%, and Home/End reach its permitted boundary. Points cannot cross; colour-swap buttons exchange the complete colour payload while retaining positions. The outer stop colours are held before/after their positions, so even a two-colour gradient has adjustable proportions.

Four built-in ideas and up to 24 named custom presets are available. Existing saved RGBW colours, including their brightness, can be chosen inside the full picker. Hex-only quick choices explicitly use white 0, brightness 100 and on true. Saving retains the complete point payload and positions, but not the independent whole-example brightness. Presets use **injected demo memory**, never origin localStorage; they survive switching screens during this walkthrough but reset on page reload, as the existing demo promises. Editing a preset updates it explicitly; “Bewaar als nieuw” makes a copy.

## Files

- `demo/static-gradient.js`: pure strict stop validation, linear RGB interpolation, full-line sample generation and injected preset store.
- `demo/static-gradient-ui.js`: explicitly mounted editor, pointer/keyboard/range controls and local canvas. No observers, timers or transport hooks. A caller-injected callback opens the **actual full app colour picker**; there is no system colour well or second wheel.
- `demo/static-gradient.css`: scoped mobile/dark/reduced-motion styles using existing tokens.
- `demo/app.js`: browser-demo/SPI admission and explicit render/unmount integration. When editing a gradient, its labelled sample replaces the contradictory old uniform preview; Solid restores the original preview. Colour editing reuses `colourPickerMarkup`, `paintWheel` and `syncColour`, including the large wheel, brightness, on/off and **Fijn instellen** RGBW toggles, minus/plus, sliders, exact values and warm-white mix. A distinct local `gradient` draft branch returns before any model/live write; power, brightness and preset selection are explicitly intercepted as local DATA. The selected-point/object/source/snapshot fence is checked again on Done. Existing preset718 code is restored byte-for-byte.
- `demo/index.html`: includes and cache versions.
- `tests/demo-spi-gradient.test.cjs` and `tests/demo-colour-dialog.test.cjs`: twenty Node test groups. Tests include literal actual app functions and gradient-handler closures with explicit minimal document/canvas providers (not browser acceptance), old/new markup and write-transcript equality against commit `6b57ba7`, unchanged wheel/sync functions, local RGBW/brightness/on/preset updates, add-before-commit refusal and current/context/cancel/Done guards. A unique brightness-slider ID keeps its label separate from the hidden solid picker. White-mix parity matches the ordinary shared preview. The parity test requires a Git checkout containing that base commit.

Each point uses the ordinary `LightningColour.mixWhite` math: first `round(255 - (255-rgb)*(1-white/255))`, then `round(mixed * pointBrightness/100)`, or black when off. Absent optional fields mean white 0, brightness 100 and on true. A dedicated parity test compares both paths. Those endpoints are interpolated as `round(left + (right-left)*t)`, with `t = pixel/(count-1)`, then the separate whole-example brightness is applied. A one-pixel line takes the first colour. Reverse flips physical address order once. The existing `LightningColour.screenHex` transfer is used only at the display boundary. Rails and point dots use the same resolved values. There are no animation frames, time parameter or hard colour segments in the model. This is a reviewable future firmware contract, **not** a claim of firmware, driver, ABI, calibrated colour or optical parity.

## Local review

From the repository root:

```sh
node --check demo/app.js
node --check demo/static-gradient.js
node --check demo/static-gradient-ui.js
node --test tests/demo-spi-gradient.test.cjs tests/demo-colour-dialog.test.cjs
git diff --check
python3 -m http.server 8789 --bind 127.0.0.1
```

Open `http://127.0.0.1:8789/demo/`. The demo starts empty: **Stand instellen → name stand/zone → add a fictitious Demo SPI receiver → finish its existing configuration → open its SPI zone → Kleur → Verloop SPI**. Any valid supported pixel count in setup is enough; the new sample is explicitly an independent 400-pixel example.

Suggested browser checks: add to 8/remove to 2; move points and endpoints; change colour; swap colours; equal distribution; save/rename/reload/delete custom preset; leave the zone and return; switch Solid/Gradient; confirm RGBW has no gradient mode; test narrow/mobile width, dark theme, keyboard and reduced motion. No receiver or Mac Tester is involved.

Root's local Node checks: **20/20 groups PASS**, syntax checks PASS, whitespace check PASS. Root's separate IAB review verified that Add immediately opens the full wheel/RGBW/brightness/warm-white picker; Cancel keeps three stops at three, Done adds a fourth, and reopening retains white 37 and brightness 62. Earlier edit-only Cancel/Done tests retained R=233 on Cancel and committed R=234 on Done. Browser observation and HOST providers remain separate evidence. Route/rebuild invalidation closes the local draft; stale gradient handlers never fall through to STATIC. GitHub publication is a separate delivery step; no installed app, receiver firmware or physical gradient acceptance is implied by this demo.
