/* Explicitly mounted gradient editor. The caller owns authenticated Apply;
 * editing and saving never send receiver commands. No DOM observers/patching.
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
  function create({ storage, scope = '', initialRecipe = () => null, palette = () => [], allowed = () => false, onMode = () => {}, chooseColor = () => false, onApply = null } = {}) {
    const store = G.createStore(storage);
    const draftKey = 'aluvision.static-gradient.draft.v1:' + encodeURIComponent(String(scope).slice(0,96));
    let moreOpen = false, mode = 'solid', draft = clone(G.builtinPresets[0]), selected = 1, brightness = 100, reverse = false, transitionMs = 120, lastRecovered = null, notice = '', host = null, unmount = () => {}, applying = false, applySerial = 0;
    draft.id = null;
    try {
      const saved = JSON.parse(storage?.getItem(draftKey) || 'null');
      if (saved?.version === 1 && ['solid','gradient'].includes(saved.mode) && G.validateStops(saved.draft?.stops) &&
          typeof saved.draft.name === 'string' && saved.draft.name.length <= 48 && Number.isInteger(saved.brightness) && saved.brightness >= 0 && saved.brightness <= 100) {
        mode = saved.mode; draft = clone(saved.draft); brightness = saved.brightness; selected = 0;
        reverse = saved.reverse === true; transitionMs = Number.isInteger(saved.transitionMs) && saved.transitionMs >= 0 && saved.transitionMs <= 750 ? saved.transitionMs : 120;
      }
    } catch (_) { notice = 'Je bewaarde ontwerp kon niet worden gelezen. Er is niets naar een receiver gestuurd.'; }
    function persistDraft() {
      try { storage?.setItem(draftKey,JSON.stringify({version:1,mode,draft,brightness,reverse,transitionMs})); }
      catch (_) { notice = 'Je ontwerp blijft zichtbaar, maar lokaal bewaren lukt niet.'; }
    }
    // Match the core's 1% minimum gap / 1e-9 normalised tolerance before
    // quantising to whole percent; even distribution has fractional anchors.
    const bounds = () => ({ min: selected ? Math.ceil(draft.stops[selected - 1].position * 100 + 1 - 1e-7) : 0,
      max: selected < draft.stops.length - 1 ? Math.floor(draft.stops[selected + 1].position * 100 - 1 + 1e-7) : 100 });
    const current = () => !!host?.isConnected && allowed();
    function markup(solid) {
      if (!allowed()) return solid;
      const recovered=initialRecipe();
      if(typeof recovered==='string'&&recovered!==lastRecovered){
        try{
          const decoded=G.decodeRecipe(recovered),own=Array.from(G.recipe(draft.stops,{brightness,reverse,transitionMs}),x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
          if(own!==recovered){draft={id:null,name:'Actief verloop',stops:decoded.stops};brightness=decoded.brightness;reverse=decoded.reverse;transitionMs=decoded.transitionMs;selected=0;}
          mode='gradient';lastRecovered=recovered;
        }catch(_){notice='Het actieve verloop kon niet volledig worden heropend. Er is niets verstuurd.';}
      }
      return `<section class="spi-colour-workspace" data-gradient-workspace data-gradient-mode="${mode}"><div class="spi-colour-modes" role="group" aria-label="Soort vaste kleur"><button type="button" data-gradient-mode-choice="solid" aria-pressed="${mode === 'solid'}">Effen kleur</button><button type="button" data-gradient-mode-choice="gradient" aria-pressed="${mode === 'gradient'}"><span class="gradient-mode-icon" aria-hidden="true"></span>Verloop <small>SPI</small></button></div><div data-gradient-solid ${mode === 'solid' ? '' : 'hidden'}>${solid}</div><div data-gradient-panel ${mode === 'gradient' ? '' : 'hidden'}></div></section>`;
    }
    // The shared ledline preview at the top of the control screen shows the
    // draft (see previewRecipe); this panel holds the controls only and reuses
    // the app's card / slider / colour-row look.
    const pct = value => Math.round(value * 100);
    const pointLabel = index => `Kleur ${index + 1}`;
    function body() {
      const state = store.load(), stop = draft.stops[selected], limit = draft.stops.length === G.MAX_STOPS;
      const custom = state.presets.map(preset => `<div class="gradient-saved-row"><button type="button" data-gradient-load="${esc(preset.id)}" aria-pressed="${draft.id === preset.id}"><i style="background:${gradientCSS(preset.stops)}" aria-hidden="true"></i><span>${esc(preset.name)}</span></button><button type="button" class="gradient-remove-preset" data-gradient-delete="${esc(preset.id)}" aria-label="Verwijder ${esc(preset.name)}">−</button></div>`).join('');
      const ideas = `<section class="card gradient-card gradient-ideas" aria-labelledby="gradient-ideas-title"><h3 id="gradient-ideas-title">Voorbeelden</h3><p class="gradient-help">Tik om een voorbeeld als startpunt te gebruiken.</p><div class="gradient-builtins">${G.builtinPresets.map(preset => `<button type="button" data-gradient-builtin="${preset.id}" aria-pressed="${JSON.stringify(draft.stops)===JSON.stringify(preset.stops)}"><i style="background:${gradientCSS(preset.stops)}" aria-hidden="true"></i><span>${esc(preset.name)}</span><b class="gradient-builtin-check" aria-hidden="true">✓</b></button>`).join('')}</div></section>`;
      const points = draft.stops.map((item, index) => `<div class="gradient-point${index === selected ? ' is-selected' : ''}" data-gradient-point-row="${index}"><button type="button" class="gradient-point-colour" data-gradient-color-open data-gradient-point="${index}" aria-pressed="${index === selected}" aria-haspopup="dialog" aria-label="${pointLabel(index)} wijzigen"><span class="gradient-point-swatch" style="--stop:${C.screenHex(G.stopRGB(item))}" aria-hidden="true"></span><b>${pointLabel(index)}</b><small data-gradient-point-position>${pct(item.position)}%</small></button><button type="button" class="gradient-point-remove" data-gradient-remove-at="${index}" aria-label="Verwijder ${pointLabel(index).toLowerCase()}" ${draft.stops.length <= 2 ? 'disabled' : ''}>−</button></div>`).join('');
      const colours = `<section class="card gradient-card static-gradient-editor" aria-labelledby="gradient-title"><div class="gradient-card-heading"><h3 id="gradient-title">Verloopkleuren</h3><span class="gradient-count">${draft.stops.length} van ${G.MAX_STOPS}</span></div><p class="gradient-help">Tik op een kleur om te wijzigen. Sleep de punten op de balk om de overgang te verschuiven.</p><div class="gradient-rail-wrap"><div class="gradient-rail" data-gradient-rail style="background:${gradientCSS(draft.stops)}">${draft.stops.map((item, index) => `<button type="button" class="gradient-stop${index === selected ? ' is-selected' : ''}" data-gradient-stop="${index}" style="left:${item.position * 100}%;--stop:${C.screenHex(G.stopRGB(item))}" aria-label="${pointLabel(index)}, positie ${pct(item.position)} procent. Gebruik de pijltjestoetsen om te verplaatsen." aria-pressed="${index === selected}"><i aria-hidden="true"></i></button>`).join('')}</div></div><div class="gradient-points">${points}</div><button type="button" class="gradient-point-add" data-gradient-add aria-label="Kleur toevoegen" ${limit ? 'disabled' : ''}>＋ Kleur</button>${limit ? '<p class="gradient-help">Acht kleuren is het maximum.</p>' : ''}<div class="slider-row gradient-slider"><label for="gradient-position"><span>Plaats van <span data-gradient-number>${pointLabel(selected).toLowerCase()}</span></span><output data-gradient-position-output>${pct(stop.position)}%</output></label><input type="range" id="gradient-position" data-gradient-position min="${bounds().min}" max="${bounds().max}" step="1" value="${pct(stop.position)}"></div><button type="button" class="gradient-even" data-gradient-even><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h16M4 7v10M12 9v6M20 7v10"/></svg>Kleuren gelijk verdelen</button></section>`;
      const light = `<section class="card gradient-card gradient-apply-card" aria-label="Verloop toepassen"><div class="slider-row gradient-slider"><label for="gradient-brightness">Helderheid<output data-gradient-brightness-output>${brightness}%</output></label><input type="range" id="gradient-brightness" data-gradient-brightness min="0" max="100" step="1" value="${brightness}"></div><div class="gradient-apply-slot"></div></section>`;
      const library = `<section class="card gradient-card gradient-library" aria-labelledby="gradient-library-title"><h3 id="gradient-library-title">Mijn verlopen</h3><p class="gradient-help">Bewaar je verloop om het later met één tik terug te halen.</p><label class="gradient-name-label" for="gradient-name">Naam<input type="text" id="gradient-name" data-gradient-name maxlength="48" autocomplete="off" value="${esc(draft.name)}" placeholder="Bijvoorbeeld: Balie warm"></label><div class="gradient-save-actions"><button type="button" class="button" data-gradient-save>${draft.id ? 'Wijzigingen bewaren' : 'Verloop bewaren'}</button>${draft.id ? '<button type="button" class="button secondary" data-gradient-save-copy>Bewaar als nieuw</button>' : ''}</div><p class="gradient-notice" data-gradient-notice role="status" aria-live="polite">${esc(state.error || notice)}</p><div class="gradient-customs">${custom || '<p class="gradient-empty">Je bewaarde verlopen verschijnen hier.</p>'}</div></section>`;
      return colours + light + ideas + library;
    }
    function officialBody() {
      const apply = `<div class="gradient-apply"><button type="button" class="button" data-gradient-apply ${applying || typeof onApply !== 'function' ? 'disabled' : ''}>${applying ? 'Verloop versturen…' : 'Verloop toepassen'}</button><p data-gradient-apply-status role="status" aria-live="polite">${esc(notice || 'Je ledline verandert pas als je op Verloop toepassen tikt.')}</p><details class="gradient-more" data-gradient-more ${moreOpen?'open':''}><summary>Meer opties</summary><label class="gradient-check"><input type="checkbox" data-gradient-reverse ${reverse?'checked':''}> Richting omdraaien</label><label class="gradient-transition">Overgangstijd <span><input type="number" inputmode="numeric" data-gradient-transition min="0" max="750" step="1" value="${transitionMs}"> ms</span></label></details></div>`;
      return body().replace('<div class="gradient-apply-slot"></div>', apply);
    }
    function paint() {
      if (!current()) return;
      persistDraft();
      const panel = host.querySelector('[data-gradient-panel]'), stop = draft.stops[selected], range = panel.querySelector('[data-gradient-position]');
      const rail = panel.querySelector('[data-gradient-rail]');
      if (!rail) return;
      rail.style.background = gradientCSS(draft.stops);
      rail.querySelectorAll('[data-gradient-stop]').forEach((button, index) => {
        button.style.left = draft.stops[index].position * 100 + '%';
        button.style.setProperty('--stop', C.screenHex(G.stopRGB(draft.stops[index])));
        button.classList.toggle('is-selected', index === selected); button.setAttribute('aria-pressed', String(index === selected));
        button.setAttribute('aria-label', `${pointLabel(index)}, positie ${pct(draft.stops[index].position)} procent. Gebruik de pijltjestoetsen om te verplaatsen.`);
      });
      panel.querySelectorAll('[data-gradient-point-row]').forEach((row, index) => {
        const item = draft.stops[index]; if (!item) return;
        row.classList.toggle('is-selected', index === selected);
        row.querySelector('[data-gradient-point]')?.setAttribute('aria-pressed', String(index === selected));
        row.querySelector('.gradient-point-swatch')?.style.setProperty('--stop', C.screenHex(G.stopRGB(item)));
        const position = row.querySelector('[data-gradient-point-position]'); if (position) position.textContent = pct(item.position) + '%';
      });
      if (range) { range.min = bounds().min; range.max = bounds().max; range.value = pct(stop.position); }
      panel.querySelector('[data-gradient-number]').textContent = pointLabel(selected).toLowerCase();
      panel.querySelector('[data-gradient-position-output]').textContent = pct(stop.position) + '%';
      panel.querySelector('[data-gradient-brightness-output]').textContent = brightness + '%';
      panel.querySelectorAll('[data-gradient-builtin]').forEach(button => {
        const preset = G.builtinPresets.find(item => item.id === button.dataset.gradientBuiltin);
        button.setAttribute('aria-pressed', String(!!preset && JSON.stringify(draft.stops) === JSON.stringify(preset.stops)));
      });
    }
    let previewKey = '', previewHex = null;
    function previewRecipe() {
      if (mode !== 'gradient' || !current()) return null;
      const key = JSON.stringify([draft.stops, brightness, reverse, transitionMs]);
      if (key !== previewKey) { previewKey = key; previewHex = Array.from(G.recipe(draft.stops, { brightness, reverse, transitionMs }), x => x.toString(16).padStart(2, '0')).join('').toUpperCase(); }
      return previewHex;
    }
    function renderPanel(focus = null) {
      if (!current()) return;
      host.querySelector('[data-gradient-panel]').innerHTML = officialBody(); paint();
      if (focus) host.querySelector(focus)?.focus({ preventScroll: true });
    }
    function setPosition(percent) {
      const { min, max } = bounds();
      if (min > max) return; // A valid loaded preset need not fit a whole-percent move.
      draft.stops[selected].position = Math.max(min, Math.min(max, Math.round(percent))) / 100; paint();
    }
    function mount(element) {
      unmount(); host = element;
      if (!current()) return () => {};
      const removers = [], on = (name, callback) => { host.addEventListener(name, callback); removers.push(() => element.removeEventListener(name, callback)); };
      let pointer = null, dragIndex = null, moved = false;
      const end = () => { pointer = null; dragIndex = null; };
      const selectStop = index => { selected = index; renderPanel(`[data-gradient-stop="${index}"]`); };
      function editPoint(button, candidate=null, insertAt=null) {
        const owner=host,editing=draft,index=selected,point=candidate||draft.stops[index],refs=[...draft.stops],snapshot=JSON.stringify(draft.stops);
        const selector=candidate?'[data-gradient-add]':'[data-gradient-color-open]';
        let consumed=false;
        const samePoint=()=>!consumed&&current()&&host===owner&&mode==='gradient'&&draft===editing&&selected===index&&
          refs.length===draft.stops.length&&refs.every((stop,i)=>draft.stops[i]===stop)&&JSON.stringify(draft.stops)===snapshot&&
          button.isConnected&&!button.disabled&&button.matches(selector)&&host.contains(button);
        chooseColor({source:button,color:point.color,white:point.white??0,brightness:point.brightness??100,on:point.on??true,current:samePoint,commit:value=>{
          if(!samePoint()||!value||Object.keys(value).sort().join(',')!=='brightness,color,on,white'||!/^#[0-9a-f]{6}$/i.test(value.color)||
            !Number.isInteger(value.white)||value.white<0||value.white>255||!Number.isFinite(value.brightness)||value.brightness<0||value.brightness>100||typeof value.on!=='boolean')return;
          consumed=true;
          const fields={color:value.color.toUpperCase(),white:value.white,brightness:value.brightness,on:value.on};
          if(candidate){draft.stops.splice(insertAt,0,{position:point.position,...fields});selected=insertAt;renderPanel(`[data-gradient-point="${insertAt}"]`);}
          else{Object.assign(point,fields);paint();}
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
          if (mode === 'gradient') renderPanel();
          return;
        }
        if (button.hasAttribute('data-gradient-stop')) { if (!moved) selectStop(Number(button.dataset.gradientStop)); moved = false; return; }
        if (button.hasAttribute('data-gradient-apply')) {
          if (applying || typeof onApply !== 'function' || mode !== 'gradient') return;
          const owner = host, ticket = ++applySerial;
          const definition = G.definition(draft.stops,{brightness,reverse,transitionMs}),snapshot=JSON.stringify(definition);
          applying = true; notice = 'Verloop versturen…'; renderPanel();
          Promise.resolve().then(() => {
            if (!current() || mode !== 'gradient' || owner !== host || ticket !== applySerial || snapshot !== JSON.stringify(G.definition(draft.stops,{brightness,reverse,transitionMs}))) throw Error('GRADIENT_CHANGED');
            return onApply(definition);
          }).then(answer => {
            if (!current() || mode !== 'gradient' || owner !== host || ticket !== applySerial || snapshot !== JSON.stringify(G.definition(draft.stops,{brightness,reverse,transitionMs}))) return;
            notice = answer?.state === 'OBSERVED' ? 'De receivers hebben dit verloop bevestigd.' : 'Verstuurd. De bevestiging volgt.';
          }, error => {
            try { window.__c98log?.('GRADIENT_FAIL ' + String(error?.code || error?.message || '-').slice(0, 60)); } catch (_) {}
            if (!current() || owner !== host || ticket !== applySerial) return;
            notice = ['UNSUPPORTED','ACTION_UNSUPPORTED','GRADIENT_UNSUPPORTED'].includes(error?.code) ?
              'Deze receiver kan nog geen verloop tonen. Werk eerst de receiver bij.' :
              error?.code === 'GRADIENT_CHANGED' || error?.message === 'GRADIENT_CHANGED' ? 'Je verloop is intussen gewijzigd. Tik opnieuw op Verloop toepassen.' :
              'Het verloop is niet bevestigd. Controleer de verbinding en probeer opnieuw.';
          }).finally(() => { if (ticket === applySerial) { applying = false; if (current() && owner === host) renderPanel(); } });
          return;
        }
        if (button.hasAttribute('data-gradient-color-open')) {
          if (button.dataset.gradientPoint !== undefined) { const index = Number(button.dataset.gradientPoint); if (!draft.stops[index]) return; selected = index; paint(); }
          editPoint(button);return;
        }
        if (button.dataset.gradientRemoveAt !== undefined) {
          const index = Number(button.dataset.gradientRemoveAt); if (draft.stops.length <= 2 || !draft.stops[index]) return;
          draft.stops.splice(index, 1); selected = Math.min(index, draft.stops.length - 1); renderPanel(); return;
        }
        if (button.hasAttribute('data-gradient-add')) {
          if (draft.stops.length >= G.MAX_STOPS) return;
          const points = [0, ...draft.stops.map(stop => stop.position), 1]; let best = -1, at = 0;
          for (let i = 1; i < points.length; i++) if (points[i] - points[i - 1] > best) { best = points[i] - points[i - 1]; at = i; }
          const position = Math.round((points[at - 1] + points[at]) * 50) / 100;
          const color = C.hex(G.sample(draft.stops, position));
          editPoint(button,{color,position},at-1);return;
        } else if (button.hasAttribute('data-gradient-remove')) { if (draft.stops.length <= 2) return; draft.stops.splice(selected, 1); selected = Math.min(selected, draft.stops.length - 1); }
        else if (button.hasAttribute('data-gradient-even')) draft.stops.forEach((stop, i) => { stop.position = i / (draft.stops.length - 1); });
        else if (button.dataset.gradientShift) { const other = selected + Number(button.dataset.gradientShift); if (!draft.stops[other]) return; const a=draft.stops[selected],b=draft.stops[other];draft.stops[selected]={...b,position:a.position};draft.stops[other]={...a,position:b.position};selected=other; }
        else if (button.dataset.gradientSwatch) Object.assign(draft.stops[selected],{color:button.dataset.gradientSwatch,white:0,brightness:100,on:true});
        else if (button.dataset.gradientBuiltin) { draft = clone(G.builtinPresets.find(preset => preset.id === button.dataset.gradientBuiltin)); draft.id = null; selected = 0; notice = ''; }
        else if (button.dataset.gradientLoad) { const preset = store.load().presets.find(item => item.id === button.dataset.gradientLoad); if (!preset) return; draft = clone(preset); brightness=preset.brightness??100;reverse=preset.reverse??false;transitionMs=preset.transitionMs??120;selected = 0; notice = 'Bewerk je kleuren of verdeling en bewaar de wijzigingen.'; }
        else if (button.dataset.gradientDelete) { const result = store.remove(button.dataset.gradientDelete); notice = result.error || 'Verloop verwijderd.'; if (draft.id === button.dataset.gradientDelete) draft.id = null; }
        else if (button.hasAttribute('data-gradient-save') || button.hasAttribute('data-gradient-save-copy')) {
          const result = store.save({ ...draft,brightness,reverse,transitionMs,id: button.hasAttribute('data-gradient-save-copy') ? undefined : draft.id || undefined });
          notice = result.error || 'Lokaal bewaard in Mijn verlopen.'; if (!result.error) draft.id = result.savedId;
        } else return;
        renderPanel(button.hasAttribute('data-gradient-add') ? `[data-gradient-point="${selected}"]` : null);
      });
      const toggled = event => { if (event.target?.matches?.('[data-gradient-more]')) moreOpen = event.target.open; };
      host.addEventListener('toggle', toggled, true); removers.push(() => element.removeEventListener('toggle', toggled, true));
      on('input', event => {
        if (!current()) return;
        const input = event.target;
        if (input.matches('[data-gradient-position]')) setPosition(Number(input.value));
        else if (input.matches('[data-gradient-name]')) { draft.name = input.value; persistDraft(); }
        else if (input.matches('[data-gradient-brightness]')) { brightness = Number(input.value); paint(); }
        else if (input.matches('[data-gradient-reverse]')) { reverse = input.checked; paint(); }
        else if (input.matches('[data-gradient-transition]')) { const value=Number(input.value);if(Number.isInteger(value)&&value>=0&&value<=750){transitionMs=value;persistDraft();} }
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
      if (mode === 'gradient') renderPanel();
      onMode(mode);
      unmount = () => { end(); removers.splice(0).forEach(remove => remove()); host = null; };
      return unmount;
    }
    return Object.freeze({ markup, mount, previewRecipe, mountedOn: element => !!element && host === element && !!host.isConnected, get mode() { return mode; } });
  }
  root.LightningStaticGradientUI = Object.freeze({ create, draw });
}(window));
