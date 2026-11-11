/* PREVIEWSYNC: one wall-clock preview time base (epoch seconds) for every
 * animation preview, so a saved previewStartedAt keeps its meaning after an app
 * reopen and on another phone; plus the dispatch lead used when sampling PHASEMS
 * (fast lane: receivers start the app's phase at the MAIN deadline, ~120 ms after
 * the request is built). Bench override: localStorage 'aluvision.previewLeadMs'. */
(function(root){'use strict';
  if(typeof root.AluvisionPreviewNowPS!=='function'){
    const p=root.performance,mono=p&&typeof p.now==='function';
    let origin=mono?Date.now()-p.now():0;
    root.AluvisionPreviewNowPS=()=>{
      const wall=Date.now();if(!mono)return wall/1000;
      const t=origin+p.now();
      // Sleep or a wall-clock correction: follow the wall clock again.
      if(Math.abs(wall-t)>250){origin=wall-p.now();return wall/1000;}
      return t/1000;
    };
  }
  if(typeof root.AluvisionPreviewLeadPS!=='function'){
    let lead=120;
    try{const raw=root.localStorage&&root.localStorage.getItem('aluvision.previewLeadMs');
      if(raw!==null&&raw!==undefined&&raw!==''){const v=Number(raw);if(Number.isFinite(v)&&v>=0&&v<=1000)lead=v;}}catch(_){}
    root.AluvisionPreviewLeadPS=()=>lead/1000;
  }
})(typeof globalThis==='object'?globalThis:this);
/* Explicitly mounted gradient editor. The caller owns authenticated Apply;
 * a chosen gradient auto-applies as edited; saving presets stays local.
 * No DOM observers/patching.
 */
(function (root) {
  'use strict';
  const G = root.LightningStaticGradient;
  // Deferred index order may load this factory before colour.js. Resolve the
  // existing colour implementation only when the editor is actually used.
  const C = {screenHex:(...args)=>root.LightningColour.screenHex(...args),hex:(...args)=>root.LightningColour.hex(...args)};
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const clone = value => JSON.parse(JSON.stringify(value));
  function gradientCSS(stops) {
    return 'linear-gradient(90deg,' + Array.from({ length: 33 }, (_, i) => `${C.screenHex(G.sample(stops, i / 32))} ${i / 32 * 100}%`).join(',') + ')';
  }
  function draw(canvas, stops, brightness = 100, reverse = false) {
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.width = 400; canvas.height = 72;
    context.fillStyle = '#111611'; context.fillRect(0, 0, 400, 72);
    const pixels = G.samplePixels(stops, 400, { brightness, reverse });
    pixels.forEach((pixel, index) => { context.fillStyle = C.screenHex(pixel); context.fillRect(index, 23, 1, 26); });
  }
  function create({ storage, scope = '', applyScope = () => String(scope), initialRecipe = () => null, initialMotion = () => null, palette = () => [], allowed = () => false, onMode = () => {}, onIdle = () => {}, chooseColor = () => false, onApply = null, text = key => key } = {}) {
    // Visible copy goes through the app's translations; Dutch is the key.
    const T = (key, params) => { let value = key; try { const out = text(key); if (typeof out === 'string' && out) value = out; } catch (_) {} return params ? value.replace(/\{(\w+)\}/g, (m, k) => Object.prototype.hasOwnProperty.call(params, k) ? String(params[k]) : m) : value; };
    const store = G.createStore(storage);
    const draftKey = 'aluvision.static-gradient.draft.v1:' + encodeURIComponent(String(scope).slice(0,96));
    let moreOpen = false, mode = 'solid', draft = clone(G.builtinPresets[0]), selected = 1, brightness = 100, reverse = false, transitionMs = 120, lastRecovered = null, notice = '', applyNotice = '', host = null, unmount = () => {}, applying = false, applySerial = 0, mountSerial = 0;
    draft.id = null;
    // C107: back from a plain colour or an animation the customer fills in
    // Kleur 1, 2 and 3 themselves; the examples sit below. These are the
    // slots that still have no colour. Nothing is sent before one is chosen.
    let unsetC107 = new Set();
    const PLACEHOLDER_C107 = '#7A7A7A';
    // SPIANIM: "Verloop in beweging". The same gradient plus how it moves:
    // type 1 slide, 2 sway, 3 breathe, 4 light head; flow right/left/bounce.
    // The receiver gets VARIANT 210..213 (+ MOTIONREVERSE/BOUNCE/SPEED/
    // SPREAD/TRAIL); the saved light keeps variant 210..217 (+4 = to the left).
    let motionArmPending = false, motionRequested = false, motionOn = false, motionType = 1, motionSpeed = 35, motionFlow = 'right', motionSoftness = 30, motionTrail = 40, motionStartedAt = 0;
    // C139ui-4: "Doorlopend verloop": the gradient runs round. The first colour comes back at the very end, so where
    // the last ledline meets the first there is no hard edge (also seamless while it slides). Only the stops sent
    // change: the customer's colours are scaled into the first part and colour 1 is added at the end (existing recipe
    // format, at most 8 stops, so 7 colours). The editor keeps showing the customer's own colours.
    let loopC139 = false;
    const loopStopsC139 = stops => {
      if (!loopC139 || !stops || stops.length < 2 || stops.length >= G.MAX_STOPS) return stops;
      const k = (stops.length - 1) / stops.length;
      return [...stops.map(stop => ({ ...stop, position: stop.position * k })), { ...stops[0], position: 1 }];
    };
    // An active gradient whose last stop repeats colour 1 at the very end was sent as "doorlopend": show the
    // customer's own colours again, with the switch on.
    const unloopC139 = stops => {
      const n = stops.length, first = stops[0], last = stops[n - 1];
      if (n < 3 || last.position < 1 - 1e-6 || last.color !== first.color || (last.white ?? 0) !== (first.white ?? 0)) return { stops, loop: false };
      const k = (n - 2) / (n - 1), own = stops.slice(0, -1).map(stop => ({ ...stop, position: Math.min(1, stop.position / k) }));
      return G.validateStops(own) ? { stops: own, loop: true } : { stops, loop: false };
    };
    const loopRowC139 = () => { const full = !loopC139 && draft.stops.length >= G.MAX_STOPS;
      return `<div class="gradient-reverse-row gradient-loop-row"><span class="gradient-reverse-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg></span><span class="gradient-reverse-copy"><b>${T('Doorlopend verloop')}</b><small>${T(full ? 'Kan met acht kleuren niet: haal er één weg.' : 'Het einde loopt over in het begin, voor ledlines die rondlopen.')}</small></span><button type="button" class="switch gradient-loop-switch" role="switch" data-gradient-loop-toggle aria-checked="${loopC139}" aria-label="${T('Doorlopend verloop')}"${full ? ' disabled' : ''}><span>${T(loopC139 ? 'v50On' : 'v50Off')}</span><i aria-hidden="true"></i></button></div>`; };
    const MOTION_TYPES = [[1, 'Schuiven'], [2, 'Golven'], [3, 'Ademen'], [4, 'Lichtkop']];
    const MOTION_FLOWS = [['left', 'Naar links'], ['right', 'Naar rechts'], ['bounce', 'Heen en weer']];
    const motionNow = () => globalThis.AluvisionPreviewNowPS(); // PREVIEWSYNC: same clock as the preview
    const percentValue = value => Number.isInteger(value) && value >= 0 && value <= 100;
    function motionPayload() {
      return motionOn ? { variant: 209 + motionType, reverse: motionFlow === 'left', bounce: motionFlow === 'bounce',
        speed: motionSpeed, spread: motionSoftness, trail: motionTrail } : null;
    }
    // A saved light (variant 210..217 with speed/bounce/spread/trailLength).
    function adoptMotion(state) {
      const variant = Number(state?.variant);
      if (!Number.isInteger(variant) || variant < 210 || variant > 217) { motionOn = false; return; }
      motionOn = true; motionType = (variant - 210) % 4 + 1;
      motionFlow = state.bounce === true ? 'bounce' : variant >= 214 ? 'left' : 'right';
      if (percentValue(state.speed)) motionSpeed = state.speed;
      if (percentValue(state.spread)) motionSoftness = state.spread;
      if (percentValue(state.trailLength)) motionTrail = state.trailLength;
      motionStartedAt = motionNow();
    }
    function blankDraftC107() {
      draft = { id: null, name: T('Nieuw verloop'), stops: [0, .5, 1].map(position => ({ color: PLACEHOLDER_C107, position })) };
      unsetC107 = new Set([0, 1, 2]); selected = 0;
    }
    const unsetC107At = index => unsetC107.has(index);
    const spreadC107 = () => draft.stops.forEach((stop, i) => { stop.position = i / (draft.stops.length - 1); });
    // The stops that count: chosen colours only, spread evenly while slots
    // are still empty. One colour lights the whole ledline in that colour.
    function liveStopsC107(stops = draft.stops, unset = unsetC107) {
      if (!unset.size) return stops;
      const set = stops.filter((_, i) => !unset.has(i));
      if (!set.length) return null;
      if (set.length === 1) return [{ ...set[0], position: 0 }, { ...set[0], position: 1 }];
      return set.map((stop, i) => ({ ...stop, position: i / (set.length - 1) }));
    }
    const railCSSC107 = () => { const live = liveStopsC107(); return live ? gradientCSS(live) : 'none'; };
    try {
      const saved = JSON.parse(storage?.getItem(draftKey) || 'null');
      if (saved?.version === 1 && ['solid','gradient'].includes(saved.mode) && G.validateStops(saved.draft?.stops) &&
          typeof saved.draft.name === 'string' && saved.draft.name.length <= 48 && Number.isInteger(saved.brightness) && saved.brightness >= 0 && saved.brightness <= 100) {
        mode = saved.mode; draft = clone(saved.draft); brightness = saved.brightness; selected = 0;
        loopC139 = saved.loop === true; /* C139ui-4 */ reverse = saved.reverse === true; transitionMs = Number.isInteger(saved.transitionMs) && saved.transitionMs >= 0 && saved.transitionMs <= 750 ? saved.transitionMs : 120;
        if (Array.isArray(saved.unset)) unsetC107 = new Set(saved.unset.filter(i => Number.isInteger(i) && i >= 0 && i < draft.stops.length));
        const m = saved.motion;
        if (m && typeof m.on === 'boolean' && [1, 2, 3, 4].includes(m.type) && percentValue(m.speed) && MOTION_FLOWS.some(([flow]) => flow === m.flow) &&
            percentValue(m.softness) && percentValue(m.trail)) {
          motionOn = m.on; motionType = m.type; motionSpeed = m.speed; motionFlow = m.flow; motionSoftness = m.softness; motionTrail = m.trail;
          motionStartedAt = motionNow();
        }
      }
    } catch (_) { notice = T('Je bewaarde ontwerp kon niet worden gelezen. Er is niets naar een receiver gestuurd.'); }
    function persistDraft() {
      try { storage?.setItem(draftKey,JSON.stringify({version:1,mode,draft,brightness,reverse,loop:loopC139,transitionMs,unset:[...unsetC107],
        motion:{on:motionOn,type:motionType,speed:motionSpeed,flow:motionFlow,softness:motionSoftness,trail:motionTrail}})); }
      catch (_) { notice = T('Je ontwerp blijft zichtbaar, maar lokaal bewaren lukt niet.'); }
    }
    // Match the core's 1% minimum gap / 1e-9 normalised tolerance before
    // quantising to whole percent; even distribution has fractional anchors.
    const bounds = () => ({ min: selected ? Math.ceil(draft.stops[selected - 1].position * 100 + 1 - 1e-7) : 0,
      max: selected < draft.stops.length - 1 ? Math.floor(draft.stops[selected + 1].position * 100 - 1 + 1e-7) : 100 });
    const current = () => !!host?.isConnected && allowed();
    function markup(solid) {
      if (!allowed()) return solid;
      const recovered=initialRecipe(),recoveryScope=scopeKey(),recoveryKey=JSON.stringify([recoveryScope,typeof recovered==='string'?recovered:null]);
      if(recoveryKey!==lastRecovered){
        // A selection change must recover its own intent, including a solid
        // or mixed selection. A current explicit edit stays the live draft.
        if(!autoArmed||chosenScope!==recoveryScope){
          choiceRequired=true;
          if(typeof recovered==='string')try{
            const decoded=G.decodeRecipe(recovered),live=loopStopsC139(liveStopsC107()),own=live?Array.from(G.recipe(live,{brightness,reverse,transitionMs}),x=>x.toString(16).padStart(2,'0')).join('').toUpperCase():null;
            if(own!==recovered){const unlooped=unloopC139(decoded.stops);loopC139=unlooped.loop;draft={id:null,name:T('Actief verloop'),stops:unlooped.stops};brightness=decoded.brightness;reverse=decoded.reverse;transitionMs=decoded.transitionMs;selected=0;}
            mode='gradient';choiceRequired=false;unsetC107=new Set();
            try{if(!motionRequested)adoptMotion(initialMotion());}catch(_){motionOn=false;}
          }catch(_){notice=T('Het actieve verloop kon niet volledig worden heropend. Er is niets verstuurd.');}
          if(choiceRequired)blankDraftC107();
        }
        lastRecovered=recoveryKey;
      }
      motionRequested=false;
      return `<section class="spi-colour-workspace" data-gradient-workspace data-gradient-mode="${mode}"><div class="spi-colour-modes" role="group" aria-label="${T('Soort vaste kleur')}"><button type="button" data-gradient-mode-choice="solid" aria-pressed="${mode === 'solid'}">${T('Effen kleur')}</button><button type="button" data-gradient-mode-choice="gradient" aria-pressed="${mode === 'gradient'}"><span class="gradient-mode-icon" aria-hidden="true"></span>${T('Verloop')} <small>SPI</small></button></div><div data-gradient-solid ${mode === 'solid' ? '' : 'hidden'}>${solid}</div><div data-gradient-panel ${mode === 'gradient' ? '' : 'hidden'}></div></section>`;
    }
    // The shared ledline preview at the top of the control screen shows the
    // draft (see previewRecipe); this panel holds the controls only and reuses
    // the app's card / slider / colour-row look.
    const pct = value => Math.round(value * 100);
    const pointLabel = index => T('Kleur {number}', { number: index + 1 });
    const transitionText = () => transitionMs === 0 ? T('Direct') : T('{seconds} s', { seconds: (transitionMs / 1000).toLocaleString(document.documentElement.lang || 'nl', { maximumFractionDigits: 2 }) });
    // C109: move a colour to another place; the places (positions) stay, the
    // colours change order. Empty slots move along with their colour.
    function moveColour(from, to) {
      if (from === to || !draft.stops[from] || !draft.stops[to]) return false;
      const positions = draft.stops.map(stop => stop.position), empty = draft.stops.map((_, i) => unsetC107At(i));
      const [stop] = draft.stops.splice(from, 1); draft.stops.splice(to, 0, stop);
      const [flag] = empty.splice(from, 1); empty.splice(to, 0, flag);
      draft.stops.forEach((item, i) => { item.position = positions[i]; });
      unsetC107 = new Set(empty.flatMap((value, i) => value ? [i] : []));
      if (draft.stops.some((_, i) => !unsetC107At(i))) chosen();
      selected = to; return true;
    }
    function body() {
      const state = store.load(), stop = draft.stops[selected], limit = draft.stops.length >= G.MAX_STOPS - (loopC139 ? 1 : 0);
      const custom = state.presets.map(preset => `<div class="gradient-saved-row"><button type="button" data-gradient-load="${esc(preset.id)}" aria-pressed="${draft.id === preset.id}"><i style="background:${gradientCSS(preset.stops)}" aria-hidden="true"></i><span>${esc(preset.name)}</span></button><button type="button" class="gradient-remove-preset" data-gradient-delete="${esc(preset.id)}" aria-label="Verwijder ${esc(preset.name)}">−</button></div>`).join('');
      // C109: the grip on the left moves a colour to another place (drag, or arrow keys).
      const grip = index => `<button type="button" class="gradient-point-drag" data-gradient-drag="${index}" aria-label="${T('Verplaats {point}', { point: pointLabel(index).toLowerCase() })}. ${T('Sleep, of gebruik pijl omhoog en omlaag.')}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button>`;
      const points = draft.stops.map((item, index) => `<div class="gradient-point${index === selected ? ' is-selected' : ''}${unsetC107At(index) ? ' is-unset' : ''}" data-gradient-point-row="${index}">${grip(index)}<button type="button" class="gradient-point-colour" data-gradient-color-open data-gradient-point="${index}" aria-pressed="${index === selected}" aria-haspopup="dialog" aria-label="${pointLabel(index)} ${unsetC107At(index) ? T('kiezen') : T('wijzigen')}">${unsetC107At(index) ? `<span class="gradient-point-swatch is-unset" aria-hidden="true">+</span><b>${pointLabel(index)}</b><small class="gradient-point-choose">${T('Kies een kleur')}</small>` : `<span class="gradient-point-swatch" style="--stop:${C.screenHex(G.stopRGB(item))}" aria-hidden="true"></span><b>${pointLabel(index)}</b><small data-gradient-point-position>${unsetC107.size ? '' : pct(item.position) + '%'}</small>`}</button><button type="button" class="gradient-point-remove" data-gradient-remove-at="${index}" aria-label="Verwijder ${pointLabel(index).toLowerCase()}" ${draft.stops.length <= 2 ? 'disabled' : ''}>−</button></div>`).join('');
      const colours = `<section class="card gradient-card static-gradient-editor" aria-labelledby="gradient-title"><div class="gradient-card-heading"><h3 id="gradient-title">${T('Verloopkleuren')}</h3><span class="gradient-count">${T('{count} van {max}', { count: draft.stops.length, max: G.MAX_STOPS - (loopC139 ? 1 : 0) })}</span></div><p class="gradient-help">${unsetC107.size ? T('Tik op Kleur 1, 2 en 3 en kies je kleuren. Het verloop verschijnt zodra je kiest.') : T('Tik op een kleur om te wijzigen. Sleep de punten op de balk om de overgang te verschuiven.')}</p><div class="gradient-rail-wrap"><div class="gradient-rail${liveStopsC107() ? '' : ' is-blank'}" data-gradient-rail style="background:${railCSSC107()}">${unsetC107.size ? '' : draft.stops.map((item, index) => `<button type="button" class="gradient-stop${index === selected ? ' is-selected' : ''}" data-gradient-stop="${index}" style="left:${item.position * 100}%;--stop:${C.screenHex(G.stopRGB(item))}" aria-label="${T('{point}, positie {percent} procent. Gebruik de pijltjestoetsen om te verplaatsen.', { point: pointLabel(index), percent: pct(item.position) })}" aria-pressed="${index === selected}"><i aria-hidden="true"></i></button>`).join('')}</div></div><div class="gradient-points">${points}</div><button type="button" class="gradient-point-add" data-gradient-add aria-label="${T('Kleur toevoegen')}" ${limit ? 'disabled' : ''}>${T('＋ Kleur')}</button>${limit ? `<p class="gradient-help">${T(loopC139 ? 'Bij een doorlopend verloop zijn zeven kleuren het maximum.' : 'Acht kleuren is het maximum.')}</p>` : ''}<div class="slider-row gradient-slider gradient-position-slider" ${unsetC107.size ? 'hidden' : ''}><label for="gradient-position"><span class="gradient-slider-name"><i class="gradient-position-dot" aria-hidden="true"></i>${T('Plaats van')} <span data-gradient-number>${pointLabel(selected).toLowerCase()}</span></span><output data-gradient-position-output>${pct(stop.position)}%</output></label><input type="range" id="gradient-position" data-gradient-position min="${bounds().min}" max="${bounds().max}" step="1" value="${pct(stop.position)}"></div><button type="button" class="gradient-even" data-gradient-even ${unsetC107.size ? 'hidden' : ''}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h16M4 7v10M12 9v6M20 7v10"/></svg>${T('Kleuren gelijk verdelen')}</button></section>`;
      // C109: brightness and direction together, always visible (the
      // transition time keeps its saved value; the slider was not useful)
      // (no "Meer opties"), each with its own look.
      const light = `<section class="card gradient-card gradient-apply-card" aria-label="${T('Verloop toepassen')}"><div class="slider-row gradient-slider gradient-light-slider"><label for="gradient-brightness"><span class="gradient-slider-name"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>${T('Helderheid')}</span><output data-gradient-brightness-output>${brightness}%</output></label><input type="range" id="gradient-brightness" data-gradient-brightness min="0" max="100" step="1" value="${brightness}"></div><label class="gradient-reverse-row"><span class="gradient-reverse-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/></svg></span><span class="gradient-reverse-copy"><b>${T('Richting omdraaien')}</b><small>${T('Het verloop begint aan de andere kant.')}</small></span><input type="checkbox" data-gradient-reverse ${reverse ? 'checked' : ''}></label>${loopRowC139()}<div class="gradient-apply-slot"></div></section>`;
      // C109: examples and saved gradients in one place; saving sits below them.
      const library = `<section class="card gradient-card gradient-library" aria-labelledby="gradient-library-title"><h3 id="gradient-library-title">${T('Mijn verlopen')}</h3><p class="gradient-help">${T('Tik op een verloop om het te gebruiken. Bewaar je eigen verloop om het later terug te halen.')}</p><h4 class="gradient-collection-title">${T('Voorbeelden')}</h4><div class="gradient-builtins">${G.builtinPresets.map(preset => `<button type="button" data-gradient-builtin="${preset.id}" aria-pressed="${!choiceRequired && JSON.stringify(draft.stops)===JSON.stringify(preset.stops)}"><i style="background:${gradientCSS(preset.stops)}" aria-hidden="true"></i><span>${esc(preset.name)}</span><b class="gradient-builtin-check" aria-hidden="true">✓</b></button>`).join('')}</div><h4 class="gradient-collection-title">${T('Eigen verlopen')}</h4><div class="gradient-customs">${custom || `<p class="gradient-empty">${T('Je bewaarde verlopen verschijnen hier.')}</p>`}</div><div class="gradient-save-box"><label class="gradient-name-label" for="gradient-name">${T('Naam')}<input type="text" id="gradient-name" data-gradient-name maxlength="48" autocomplete="off" value="${esc(draft.name)}" placeholder="${T('Bijvoorbeeld: Balie warm')}"></label><div class="gradient-save-actions"><button type="button" class="button" data-gradient-save>${draft.id ? T('Wijzigingen bewaren') : T('Verloop bewaren')}</button>${draft.id ? `<button type="button" class="button secondary" data-gradient-save-copy>${T('Bewaar als nieuw')}</button>` : ''}</div><p class="gradient-notice" data-gradient-notice role="status" aria-live="polite">${esc(state.error || notice)}</p></div></section>`;
      // C107: back from a plain colour or an animation the colour slots are
      // empty (see blankDraftC107); the gradients to start from sit below.
      // SPIANIM: the Beweging card. Off, the gradient stays still as before.
      const slider = (key, label, value) => `<div class="slider-row gradient-slider gradient-motion-slider"><label for="gradient-motion-${key}"><span class="gradient-slider-name">${T(label)}</span><output data-gradient-motion-${key}-output>${value}%</output></label><input id="gradient-motion-${key}" type="range" min="0" max="100" step="1" value="${value}" data-gradient-motion-${key} style="--fill:${value}%"></div>`;
      const motion = `<section class="card gradient-card gradient-motion-card" aria-labelledby="gradient-motion-title" data-gradient-motion-card><div class="gradient-card-heading"><h3 id="gradient-motion-title">${T('Beweging')}</h3><button type="button" class="switch gradient-motion-switch" role="switch" data-gradient-motion-toggle aria-checked="${motionOn}" aria-label="${T('Laat dit verloop bewegen')}"><span>${T(motionOn ? 'v50On' : 'v50Off')}</span><i aria-hidden="true"></i></button></div>` +
        `<p class="gradient-help">${motionOn ? T('Het verloop beweegt op alle gekozen ledlines tegelijk.') : T('Laat dit verloop bewegen: schuiven, golven, ademen of een lichtkop.')}</p>` +
        (motionOn ? `<div class="gradient-motion-choices" role="group" aria-label="${T('Soort beweging')}">${MOTION_TYPES.map(([type, label]) => `<button type="button" data-gradient-motion-type="${type}" aria-pressed="${motionType === type}">${T(label)}</button>`).join('')}</div>` +
          slider('speed', 'Snelheid', motionSpeed) +
          (motionType === 3 ? '' : `<div class="gradient-motion-choices" role="group" aria-label="${T('Richting van de overloop')}">${MOTION_FLOWS.map(([flow, label]) => `<button type="button" data-gradient-motion-flow="${flow}" aria-pressed="${motionFlow === flow}">${T(label)}</button>`).join('')}</div>`) +
          slider('softness', 'Zachtheid', motionSoftness) + (motionType === 4 ? slider('trail', 'Staart', motionTrail) : '') : '') + `</section>`;
      // C109bm: a still gradient stays still here; making it move is a choice in
      // the Animaties tab. Only a gradient that already runs as an animation
      // shows its Beweging card (to fine-tune or stop it).
      return colours + (motionOn ? motion : '') + light + library;
    }
    function officialBody() {
      const apply = `<div class="gradient-apply" ${applyNotice?'':'hidden'}><p data-gradient-apply-status role="status" aria-live="polite" ${applyNotice?'':'hidden'}>${esc(applyNotice)}</p></div>`;
      return body().replace('<div class="gradient-apply-slot"></div>', apply);
    }
    function paint() {
      if (!current()) return;
      persistDraft(); scheduleAuto();
      const panel = host.querySelector('[data-gradient-panel]'), stop = draft.stops[selected], range = panel.querySelector('[data-gradient-position]');
      const rail = panel.querySelector('[data-gradient-rail]');
      if (!rail) return;
      rail.style.background = railCSSC107(); rail.classList.toggle('is-blank', !liveStopsC107());
      rail.querySelectorAll('[data-gradient-stop]').forEach(button => {
        const index = Number(button.dataset.gradientStop); if (!draft.stops[index]) return;
        button.style.left = draft.stops[index].position * 100 + '%';
        button.style.setProperty('--stop', C.screenHex(G.stopRGB(draft.stops[index])));
        button.classList.toggle('is-selected', index === selected); button.setAttribute('aria-pressed', String(index === selected));
        button.setAttribute('aria-label', T('{point}, positie {percent} procent. Gebruik de pijltjestoetsen om te verplaatsen.', { point: pointLabel(index), percent: pct(draft.stops[index].position) }));
      });
      panel.querySelectorAll('[data-gradient-point-row]').forEach((row, index) => {
        const item = draft.stops[index]; if (!item) return;
        row.classList.toggle('is-selected', index === selected);
        row.querySelector('[data-gradient-point]')?.setAttribute('aria-pressed', String(index === selected));
        if (!unsetC107At(index)) row.querySelector('.gradient-point-swatch')?.style.setProperty('--stop', C.screenHex(G.stopRGB(item)));
        const position = row.querySelector('[data-gradient-point-position]'); if (position) position.textContent = unsetC107.size ? '' : pct(item.position) + '%';
      });
      if (range) { range.min = bounds().min; range.max = bounds().max; range.value = pct(stop.position); }
      panel.querySelector('[data-gradient-number]').textContent = pointLabel(selected).toLowerCase();
      panel.querySelector('[data-gradient-position-output]').textContent = pct(stop.position) + '%';
      panel.querySelector('[data-gradient-brightness-output]').textContent = brightness + '%';
      const transitionOutput = panel.querySelector('[data-gradient-transition-output]'); if (transitionOutput) transitionOutput.textContent = transitionText();
      // C109: each slider shows what it changes (see static-gradient.css).
      panel.querySelector('[data-gradient-brightness]')?.style.setProperty('--fill', brightness + '%');
      panel.querySelector('[data-gradient-transition]')?.style.setProperty('--fill', transitionMs / 7.5 + '%');
      const positionSlider = panel.querySelector('.gradient-position-slider');
      if (positionSlider && stop) positionSlider.style.setProperty('--stop', C.screenHex(G.stopRGB(stop)));
      panel.querySelectorAll('[data-gradient-builtin]').forEach(button => {
        const preset = G.builtinPresets.find(item => item.id === button.dataset.gradientBuiltin);
        button.setAttribute('aria-pressed', String(!choiceRequired && !!preset && JSON.stringify(draft.stops) === JSON.stringify(preset.stops)));
      });
    }
    // C98: the gradient follows every change, like colours. Changes settle
    // for a moment, one send at a time; the newest design always wins.
    const scopeKey = () => { try { const key = applyScope(); return typeof key === 'string' ? key : null; } catch (_) { return null; } };
    const designKey = () => { const live = loopStopsC139(liveStopsC107()); return JSON.stringify([scopeKey(), live ? G.definition(live,{brightness,reverse,transitionMs}) : null, motionPayload()]); };
    let autoTimer = null, autoTimerKey = null, sentKey = null, autoArmed = false, chosenScope = null;
    // Only an explicit choice in this still-visible physical selection counts.
    // Merely opening the gradient tab never holds a presentation repaint.
    const pending = () => autoArmed && chosenScope === scopeKey() && mode === 'gradient' && current() && (applying || autoTimer !== null);
    function notifyIdle() { if (!pending()) { try { onIdle(); } catch (_) {} } }
    // C98: back from plain colours, no gradient is active or highlighted: the
    // customer picks an example or builds one, and only that choice is sent.
    let choiceRequired = false;
    function chosen() {
      if (choiceRequired) sentKey = null;
      choiceRequired = false; chosenScope = scopeKey(); autoArmed = chosenScope !== null;
    }
    function scheduleAuto(delay = 60) {
      if (!autoArmed || chosenScope !== scopeKey() || mode !== 'gradient' || typeof onApply !== 'function' || !current()) { try { window.__c98log?.('GRADIENT_AUTO skip armed=' + autoArmed + ' mode=' + mode); } catch (_) {} return; }
      const key = designKey();
      if (key === sentKey || (autoTimer && autoTimerKey === key)) return;
      if (autoTimer) clearTimeout(autoTimer);
      autoTimerKey = key;
      autoTimer = setTimeout(() => { autoTimer = null; autoTimerKey = null; if (key === designKey()) sendNow(); }, delay);
    }
    function sendNow() {
      if (applying || !autoArmed || !current() || mode !== 'gradient' || chosenScope !== scopeKey()) return;
      const owner = host, mounted = mountSerial, targetScope = chosenScope, ticket = ++applySerial, key = designKey();
      const ownsView = () => ticket === applySerial && mounted === mountSerial && current() && owner === host &&
        mode === 'gradient' && autoArmed && chosenScope === targetScope && targetScope === scopeKey() && key === designKey();
      if (key === sentKey) return;
      const live = loopStopsC139(liveStopsC107());
      if (!live) { setStatus(T('Kies eerst een kleur.')); notifyIdle(); return; }
      const definition = G.definition(live,{brightness,reverse,transitionMs});
      applying = true; sentKey = key;
      let retryDelay = 60, retryNotice = false;
      Promise.resolve().then(() => {
        // Capture the same selection in the app's synchronous request setup.
        // A remount/selection change before this microtask must never retarget it.
        if (!ownsView()) throw Object.assign(Error(), { code: 'GRADIENT_CHANGED' });
        const motion = motionPayload();
        return onApply(motion ? { ...definition, motion } : definition);
      }).then(() => {
        // A retained native intent is not a confirmed physical light result.
        if (ownsView()) setStatus('');
      }, error => {
        try { window.__c98log?.('GRADIENT_FAIL ' + String(error?.code || error?.message || '-').slice(0, 60)); } catch (_) {}
        const unsupported = ['UNSUPPORTED','ACTION_UNSUPPORTED','GRADIENT_UNSUPPORTED'].includes(error?.code);
        // Keep an unsupported design's key: selecting it again or repainting
        // must not create a retry loop. A changed design is still allowed.
        if (!unsupported && sentKey === key) sentKey = null;
        retryDelay = unsupported ? null : 1200;
        if (!ownsView()) return;
        retryNotice = !unsupported;
        setStatus(unsupported ?
          T('Deze receiver kan nog geen verloop tonen. Werk eerst de receiver bij.') : T('Verloop nog niet bevestigd. Controleer de verbinding.'));
      }).finally(() => {
        if (ticket === applySerial) {
          applying = false;
          const changed = designKey() !== key;
          if (changed || retryDelay !== null) scheduleAuto(changed ? 60 : retryDelay);
          // Say retry only after the existing scheduler really armed one.
          if (retryNotice && autoTimer !== null && ownsView())
            setStatus(T('Verloop nog niet bevestigd. De app probeert opnieuw.'));
          notifyIdle();
        }
      });
    }
    function setStatus(text) {
      applyNotice = text;
      const status = host?.querySelector?.('[data-gradient-apply-status]'); if (status) status.textContent = text;
      if (status) { status.hidden = !text; const box = status.closest('.gradient-apply'); if (box) box.hidden = !text; }
    }
    let previewKey = '', previewHex = null;
    // C109: while the colour picker is open, the caller passes the colour being
    // picked; the preview shows the gradient with it, before Klaar. Preview only.
    let picking = null;
    function pickingStops(value) {
      if (!picking || picking.draft !== draft || !value || !/^#[0-9a-f]{6}$/i.test(value.color)) return null;
      const fields = { color: value.color.toUpperCase(), white: value.white ?? 0, brightness: value.brightness ?? 100, on: value.on !== false };
      const stops = draft.stops.map(stop => ({ ...stop }));
      let unset = new Set(unsetC107);
      if (picking.candidate) { stops.splice(picking.insertAt, 0, { position: picking.candidate.position, ...fields }); unset = new Set([...unset].map(i => i >= picking.insertAt ? i + 1 : i)); }
      else if (stops[picking.index]) { Object.assign(stops[picking.index], fields); unset.delete(picking.index); }
      return liveStopsC107(stops, unset);
    }
    function previewRecipe(pickerValue = null) {
      if (pickerValue && mode === 'gradient' && current()) {
        const live = loopStopsC139(pickingStops(pickerValue));
        if (live) return Array.from(G.recipe(live, { brightness, reverse, transitionMs }), x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
      }
      if (mode !== 'gradient' || !current() || !autoArmed || chosenScope !== scopeKey()) return null;
      const live = loopStopsC139(liveStopsC107()); if (!live) return null;
      const key = JSON.stringify([live, brightness, reverse, transitionMs]);
      if (key !== previewKey) { previewKey = key; previewHex = Array.from(G.recipe(live, { brightness, reverse, transitionMs }), x => x.toString(16).padStart(2, '0')).join('').toUpperCase(); }
      return previewHex;
    }
    function previewMotion() {
      if (!motionOn || mode !== 'gradient' || !current()) return null;
      return { variant: 209 + motionType + (motionFlow === 'left' ? 4 : 0), speed: motionSpeed, bounce: motionFlow === 'bounce',
        spread: motionSoftness, trailLength: motionTrail, previewStartedAt: motionStartedAt };
    }
    // Opened from the animation menu or the "Laat dit verloop bewegen" button.
    function openMotion() {
      mode = 'gradient'; motionRequested = true; if (!motionOn) { motionOn = true; motionStartedAt = motionNow(); }
      persistDraft();
      // "Start animatie" in the menu is an explicit choice: arm the design as
      // soon as the editor is on screen (still nothing is sent without colours).
      if (current()) { chosen(); renderPanel('[data-gradient-motion-toggle]'); } else motionArmPending = true;
    }
    function renderPanel(focus = null) {
      if (!current()) return;
      host.querySelector('[data-gradient-panel]').innerHTML = officialBody(); paint();
      if (focus) host.querySelector(focus)?.focus({ preventScroll: true });
    }
    function setPosition(percent) {
      chosen();
      const { min, max } = bounds();
      if (min > max) return; // A valid loaded preset need not fit a whole-percent move.
      draft.stops[selected].position = Math.max(min, Math.min(max, Math.round(percent))) / 100; paint();
    }
    function mount(element) {
      unmount(); host = element; mountSerial++;
      if (!current()) return () => {};
      const removers = [], on = (name, callback) => { host.addEventListener(name, callback); removers.push(() => element.removeEventListener(name, callback)); };
      let pointer = null, dragIndex = null, moved = false;
      const end = () => { pointer = null; dragIndex = null; };
      const selectStop = index => { selected = index; renderPanel(`[data-gradient-stop="${index}"]`); };
      function editPoint(button, candidate=null, insertAt=null) {
        const owner=host,editing=draft,index=selected,point=candidate||draft.stops[index],refs=[...draft.stops],snapshot=JSON.stringify(draft.stops);
        const selector=candidate?'[data-gradient-add]':'[data-gradient-color-open]';
        let consumed=false;
        picking={draft,index,candidate,insertAt};
        const samePoint=()=>!consumed&&current()&&host===owner&&mode==='gradient'&&draft===editing&&selected===index&&
          refs.length===draft.stops.length&&refs.every((stop,i)=>draft.stops[i]===stop)&&JSON.stringify(draft.stops)===snapshot&&
          button.isConnected&&!button.disabled&&button.matches(selector)&&host.contains(button);
        chooseColor({source:button,color:point.color,white:point.white??0,brightness:point.brightness??100,on:point.on??true,current:samePoint,commit:value=>{
          if(!samePoint()||!value||Object.keys(value).sort().join(',')!=='brightness,color,on,white'||!/^#[0-9a-f]{6}$/i.test(value.color)||
            !Number.isInteger(value.white)||value.white<0||value.white>255||!Number.isFinite(value.brightness)||value.brightness<0||value.brightness>100||typeof value.on!=='boolean')return;
          consumed=true;picking=null;chosen();
          const fields={color:value.color.toUpperCase(),white:value.white,brightness:value.brightness,on:value.on};
          if(candidate){draft.stops.splice(insertAt,0,{position:point.position,...fields});selected=insertAt;renderPanel(`[data-gradient-point="${insertAt}"]`);}
          else{Object.assign(point,fields);if(unsetC107.delete(index)&&!unsetC107.size)spreadC107();renderPanel(`[data-gradient-point="${index}"]`);}
        }});
      }
      on('click', event => {
        if (!current()) return;
        const button = event.target.closest('button'); if (!button || button.disabled) return;
        if (button.dataset.gradientModeChoice) {
          mode = button.dataset.gradientModeChoice;
          host.dataset.gradientMode = mode;
          host.querySelector('[data-gradient-solid]').hidden = mode !== 'solid'; host.querySelector('[data-gradient-panel]').hidden = mode !== 'gradient';
          host.querySelectorAll('[data-gradient-mode-choice]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.gradientModeChoice === mode)));
          onMode(mode);
          persistDraft();
          autoArmed = false; chosenScope = null;
          // C139ui-2: a fresh (empty) Verloop also starts still; an old motion no longer comes back with new colours.
          if (mode === 'gradient') { choiceRequired = true; blankDraftC107(); motionOn = false; motionArmPending = false; renderPanel(); setStatus(T('Kies je kleuren, of tik op een voorbeeld hieronder.')); }
          if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; autoTimerKey = null; }
          notifyIdle();
          return;
        }
        if (button.hasAttribute('data-gradient-loop-toggle')) { // C139ui-4
          if (!loopC139 && draft.stops.length >= G.MAX_STOPS) return;
          loopC139 = !loopC139; chosen(); renderPanel('[data-gradient-loop-toggle]'); return;
        }
        if (button.hasAttribute('data-gradient-motion-toggle')) {
          motionOn = !motionOn; if (motionOn) motionStartedAt = motionNow();
          chosen(); renderPanel('[data-gradient-motion-toggle]'); return;
        }
        if (button.dataset.gradientMotionType) {
          const type = Number(button.dataset.gradientMotionType); if (![1, 2, 3, 4].includes(type)) return;
          motionType = type; motionStartedAt = motionNow(); chosen(); renderPanel(`[data-gradient-motion-type="${type}"]`); return;
        }
        if (button.dataset.gradientMotionFlow) {
          const flow = button.dataset.gradientMotionFlow; if (!MOTION_FLOWS.some(([value]) => value === flow)) return;
          motionFlow = flow; chosen(); renderPanel(`[data-gradient-motion-flow="${flow}"]`); return;
        }
        if (button.dataset.gradientBuiltin || button.dataset.gradientLoad || button.dataset.gradientSwatch || button.hasAttribute('data-gradient-even') ||
            button.hasAttribute('data-gradient-remove') || button.dataset.gradientShift) chosen();
        if (button.hasAttribute('data-gradient-stop')) { if (!moved) selectStop(Number(button.dataset.gradientStop)); moved = false; return; }
        if (button.hasAttribute('data-gradient-color-open')) {
          if (button.dataset.gradientPoint !== undefined) { const index = Number(button.dataset.gradientPoint); if (!draft.stops[index]) return; selected = index; paint(); }
          editPoint(button);return;
        }
        if (button.dataset.gradientRemoveAt !== undefined) {
          const index = Number(button.dataset.gradientRemoveAt); if (draft.stops.length <= 2 || !draft.stops[index]) return;
          chosen(); draft.stops.splice(index, 1);
          unsetC107 = new Set([...unsetC107].filter(i => i !== index).map(i => i > index ? i - 1 : i)); if (unsetC107.size) spreadC107();
          selected = Math.min(index, draft.stops.length - 1); renderPanel(); return;
        }
        if (button.hasAttribute('data-gradient-add')) {
          if (draft.stops.length >= G.MAX_STOPS - (loopC139 ? 1 : 0)) return; // C139ui-4
          // While slots are still empty a new slot is empty too.
          if (unsetC107.size) { draft.stops.push({ color: PLACEHOLDER_C107, position: 1 }); spreadC107(); unsetC107.add(draft.stops.length - 1); renderPanel(`[data-gradient-point="${draft.stops.length - 1}"]`); return; }
          const points = [0, ...draft.stops.map(stop => stop.position), 1]; let best = -1, at = 0;
          for (let i = 1; i < points.length; i++) if (points[i] - points[i - 1] > best) { best = points[i] - points[i - 1]; at = i; }
          const position = Math.round((points[at - 1] + points[at]) * 50) / 100;
          const color = C.hex(G.sample(draft.stops, position));
          editPoint(button,{color,position},at-1);return;
        } else if (button.hasAttribute('data-gradient-remove')) { if (draft.stops.length <= 2) return; draft.stops.splice(selected, 1); selected = Math.min(selected, draft.stops.length - 1); }
        else if (button.hasAttribute('data-gradient-even')) draft.stops.forEach((stop, i) => { stop.position = i / (draft.stops.length - 1); });
        else if (button.dataset.gradientShift) { const other = selected + Number(button.dataset.gradientShift); if (!draft.stops[other]) return; const a=draft.stops[selected],b=draft.stops[other];draft.stops[selected]={...b,position:a.position};draft.stops[other]={...a,position:b.position};selected=other; }
        else if (button.dataset.gradientSwatch) Object.assign(draft.stops[selected],{color:button.dataset.gradientSwatch,white:0,brightness:100,on:true});
        else if (button.dataset.gradientBuiltin) { draft = clone(G.builtinPresets.find(preset => preset.id === button.dataset.gradientBuiltin)); draft.id = null; selected = 0; notice = ''; unsetC107 = new Set(); }
        else if (button.dataset.gradientLoad) { const preset = store.load().presets.find(item => item.id === button.dataset.gradientLoad); if (!preset) return; draft = clone(preset); unsetC107 = new Set(); brightness=preset.brightness??100;reverse=preset.reverse??false;transitionMs=preset.transitionMs??120;selected = 0; notice = T('Bewerk je kleuren of verdeling en bewaar de wijzigingen.'); }
        else if (button.dataset.gradientDelete) { const result = store.remove(button.dataset.gradientDelete); notice = result.error || T('Verloop verwijderd.'); if (draft.id === button.dataset.gradientDelete) draft.id = null; }
        else if (button.hasAttribute('data-gradient-save') || button.hasAttribute('data-gradient-save-copy')) {
          const result = store.save({ ...draft,brightness,reverse,transitionMs,id: button.hasAttribute('data-gradient-save-copy') ? undefined : draft.id || undefined });
          notice = result.error || T('Lokaal bewaard in Mijn verlopen.'); if (!result.error) draft.id = result.savedId;
        } else return;
        renderPanel(button.hasAttribute('data-gradient-add') ? `[data-gradient-point="${selected}"]` : null);
      });
      const toggled = event => { if (event.target?.matches?.('[data-gradient-more]')) moreOpen = event.target.open; };
      host.addEventListener('toggle', toggled, true); removers.push(() => element.removeEventListener('toggle', toggled, true));
      on('input', event => {
        if (!current()) return;
        const input = event.target;
        if (input.matches('[data-gradient-position],[data-gradient-brightness],[data-gradient-reverse],[data-gradient-transition]')) chosen();
        if (input.matches('[data-gradient-position]')) setPosition(Number(input.value));
        else if (input.matches('[data-gradient-name]')) { draft.name = input.value; persistDraft(); }
        else if (input.matches('[data-gradient-brightness]')) { brightness = Number(input.value); paint(); }
        else if (input.matches('[data-gradient-reverse]')) { reverse = input.checked; paint(); }
        else if (input.matches('[data-gradient-motion-speed],[data-gradient-motion-softness],[data-gradient-motion-trail]')) {
          const value = Number(input.value); if (!percentValue(value)) return;
          const key = input.matches('[data-gradient-motion-speed]') ? 'speed' : input.matches('[data-gradient-motion-softness]') ? 'softness' : 'trail';
          chosen();
          if (key === 'speed') motionSpeed = value; else if (key === 'softness') motionSoftness = value; else motionTrail = value;
          const out = host.querySelector(`[data-gradient-motion-${key}-output]`); if (out) out.textContent = value + '%';
          input.style.setProperty('--fill', value + '%');
          persistDraft(); scheduleAuto(160);
        }
        else if (input.matches('[data-gradient-transition]')) { const value=Number(input.value);if(Number.isInteger(value)&&value>=0&&value<=750){transitionMs=value;persistDraft();scheduleAuto();const out=host.querySelector('[data-gradient-transition-output]');if(out)out.textContent=transitionText();input.style.setProperty('--fill',value/7.5+'%');} }
      });
      on('keydown', event => {
        if (current() && event.target.matches('[data-gradient-name]') && event.key === 'Enter') {
          event.preventDefault(); host.querySelector('[data-gradient-save]').click(); return;
        }
        const button = event.target.closest('[data-gradient-stop]'); if (!current() || !button) return;
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); selected = Number(button.dataset.gradientStop);
        const delta = event.shiftKey ? 10 : 1;
        setPosition(event.key === 'Home' ? bounds().min : event.key === 'End' ? bounds().max : draft.stops[selected].position * 100 + (event.key === 'ArrowLeft' ? -delta : delta));
      });
      on('pointerdown', event => {
        const button = event.target.closest('[data-gradient-stop]'); if (!current() || !button || event.button !== 0 || pointer !== null) return;
        event.preventDefault(); selected = Number(button.dataset.gradientStop); pointer = event.pointerId; dragIndex = selected; moved = false;
        // Keep the captured node in place throughout a drag; rebuild only on release.
        button.setPointerCapture(pointer); paint();
      });
      on('pointermove', event => {
        if (!current() || event.pointerId !== pointer || dragIndex === null) return;
        const box = host.querySelector('[data-gradient-rail]').getBoundingClientRect();
        if (box.width > 0) { moved = true; selected = dragIndex; setPosition((event.clientX - box.left) / box.width * 100); }
      });
      on('pointerup', event => { if (event.pointerId === pointer) { end(); renderPanel(`[data-gradient-stop="${selected}"]`); } });
      on('pointercancel', end); on('lostpointercapture', end);
      // C109: drag a colour row by its grip; the other rows make room.
      let reorder = null;
      const clearReorder = () => { if (!reorder) return; reorder.rows.forEach(row => { row.style.transform = ''; row.classList.remove('is-dragging', 'is-making-room'); }); const done = reorder; reorder = null; return done; };
      on('pointerdown', event => {
        const grip = event.target.closest('[data-gradient-drag]'); if (!current() || !grip || event.button !== 0 || reorder) return;
        const rows = [...host.querySelectorAll('[data-gradient-point-row]')], from = Number(grip.dataset.gradientDrag); if (!rows[from] || rows.length < 2) return;
        event.preventDefault();
        const tops = rows.map(row => row.getBoundingClientRect().top);
        reorder = { id: event.pointerId, from, to: from, startY: event.clientY, rows, step: tops[1] - tops[0] || rows[0].offsetHeight + 8 };
        rows[from].classList.add('is-dragging'); try { grip.setPointerCapture(event.pointerId); } catch (_) {}
      });
      on('pointermove', event => {
        if (!reorder || event.pointerId !== reorder.id) return;
        const { from, rows, step } = reorder, dy = event.clientY - reorder.startY;
        const to = Math.max(0, Math.min(rows.length - 1, Math.round(from + dy / step)));
        if (to !== reorder.to) { reorder.to = to; try { navigator.vibrate?.(8); } catch (_) {} }
        rows[from].style.transform = `translateY(${dy}px)`;
        rows.forEach((row, i) => {
          if (i === from) return;
          const shift = from < to && i > from && i <= to ? -step : from > to && i < from && i >= to ? step : 0;
          row.style.transform = shift ? `translateY(${shift}px)` : ''; row.classList.toggle('is-making-room', !!shift);
        });
      });
      const dropReorder = event => {
        if (!reorder || event.pointerId !== reorder.id) return;
        const { from, to } = clearReorder();
        if (event.type === 'pointerup' && moveColour(from, to)) renderPanel(`[data-gradient-drag="${to}"]`);
      };
      on('pointerup', dropReorder); on('pointercancel', dropReorder);
      on('keydown', event => {
        const grip = event.target.closest?.('[data-gradient-drag]'); if (!current() || !grip || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault(); const from = Number(grip.dataset.gradientDrag), to = from + (event.key === 'ArrowUp' ? -1 : 1);
        if (moveColour(from, to)) renderPanel(`[data-gradient-drag="${to}"]`);
      });
      // Opening/repainting is not an Apply. Keep the real sent key and arm
      // only after an explicit edit/preset choice in this exact selection.
      autoArmed = false; chosenScope = null;
      if (motionArmPending) { motionArmPending = false; if (mode === 'gradient') chosen(); }
      if (mode === 'gradient') renderPanel();
      onMode(mode);
      unmount = () => { end(); mountSerial++; autoArmed = false; chosenScope = null; if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; autoTimerKey = null; } if (applyNotice === T('Verloop nog niet bevestigd. De app probeert opnieuw.')) setStatus(T('Verloop nog niet bevestigd. Controleer de verbinding.')); removers.splice(0).forEach(remove => remove()); host = null; };
      return unmount;
    }
    // C139ui-2: a colour or an animation replaced the gradient on the stand: let go of it. Verloop starts empty and
    // still next time, and nothing is sent again by itself.
    function resetC139() {
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; autoTimerKey = null; }
      if (!autoArmed && !motionOn && choiceRequired && lastRecovered === null) return;
      autoArmed = false; chosenScope = null; motionOn = false; motionRequested = false; motionArmPending = false;
      choiceRequired = true; blankDraftC107(); lastRecovered = null; persistDraft();
      setStatus(T('Kies je kleuren, of tik op een voorbeeld hieronder.')); // C139ui-2b: no stale send notice over an empty Verloop
    }
    // C139ui-2: a zone opens on its own light: Verloop with the active gradient (still or moving), or Kleur.
    function presentC139(kind) {
      if (kind === 'gradient') { mode = 'gradient'; lastRecovered = null; if (!applying) setStatus(''); } // C139ui-2b: the active gradient, no old notice
      else { mode = 'solid'; if (!applying) resetC139(); }
      persistDraft();
    }
    return Object.freeze({ markup, mount, previewRecipe, previewMotion, openMotion, reset: resetC139, present: presentC139, mountedOn: element => !!element && host === element && !!host.isConnected, get mode() { return mode; }, get applying() { return applying; }, get pending() { return pending(); } });
  }
  root.LightningStaticGradientUI = Object.freeze({ create, draw });
}(window));
