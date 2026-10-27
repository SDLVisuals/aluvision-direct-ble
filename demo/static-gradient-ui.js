/* Explicitly mounted demo editor. Own DATA only: never calls apply(), native,
 * live-control, receiver state or a transport. No DOM observers / patching.
 */
(function (root) {
  'use strict';
  const G = root.LightningStaticGradient, C = root.LightningColour;
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const clone = value => JSON.parse(JSON.stringify(value));
  function gradientCSS(stops) {
    return 'linear-gradient(90deg,' + Array.from({ length: 33 }, (_, i) => `${C.screenHex(G.sample(stops, i / 32))} ${i / 32 * 100}%`).join(',') + ')';
  }
  function draw(canvas, stops, brightness = 100) {
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.width = 400; canvas.height = 72;
    context.fillStyle = '#111611'; context.fillRect(0, 0, 400, 72);
    const pixels = G.samplePixels(stops, 400, { brightness });
    pixels.forEach((pixel, index) => { context.fillStyle = C.screenHex(pixel); context.fillRect(index, 23, 1, 26); });
  }
  function create({ storage, palette = () => [], allowed = () => false, onMode = () => {}, chooseColor = () => false } = {}) {
    const store = G.createStore(storage);
    let mode = 'solid', draft = clone(G.builtinPresets[0]), selected = 1, brightness = 100, notice = '', host = null, unmount = () => {};
    draft.id = null;
    const bounds = () => ({ min: selected ? Math.round(draft.stops[selected - 1].position * 100) + 1 : 0,
      max: selected < draft.stops.length - 1 ? Math.round(draft.stops[selected + 1].position * 100) - 1 : 100 });
    const current = () => !!host?.isConnected && allowed();
    function markup(solid) {
      if (!allowed()) return solid;
      return `<section class="spi-colour-workspace" data-gradient-workspace data-gradient-mode="${mode}"><div class="spi-colour-modes" role="group" aria-label="Soort vaste kleur"><button type="button" data-gradient-mode-choice="solid" aria-pressed="${mode === 'solid'}">Effen kleur</button><button type="button" data-gradient-mode-choice="gradient" aria-pressed="${mode === 'gradient'}"><span class="gradient-mode-icon" aria-hidden="true"></span>Verloop <small>SPI</small></button></div><div data-gradient-solid ${mode === 'solid' ? '' : 'hidden'}>${solid}</div><div data-gradient-panel ${mode === 'gradient' ? '' : 'hidden'}></div></section>`;
    }
    function body() {
      const state = store.load(), stop = draft.stops[selected], limit = draft.stops.length === G.MAX_STOPS;
      const custom = state.presets.map(preset => `<div class="gradient-saved-row"><button type="button" data-gradient-load="${esc(preset.id)}" aria-pressed="${draft.id === preset.id}"><i style="background:${gradientCSS(preset.stops)}" aria-hidden="true"></i><span>${esc(preset.name)}</span><small>Bewerk</small></button><button type="button" class="gradient-remove-preset" data-gradient-delete="${esc(preset.id)}" aria-label="Verwijder ${esc(preset.name)}">×</button></div>`).join('');
      return `<section class="card static-gradient-editor" aria-labelledby="gradient-title"><header class="gradient-heading"><div><span class="gradient-eyebrow">VASTE PIXELKLEUR</span><h2 id="gradient-title">Kleuren die samenvloeien</h2><p>Één zacht verloop over de hele ledline. Het licht staat stil.</p></div></header><figure class="gradient-preview"><canvas data-gradient-preview width="400" height="72" role="img" aria-label="Stilstaand verloop over een volledige ledline van 400 pixels"></canvas><figcaption><span>Begin <b>1</b></span><span>Voorbeeld · 400 pixels</span><span><b>400</b> Einde</span></figcaption></figure><div class="gradient-rail-heading"><h3>Verdeel je kleuren</h3><span>${draft.stops.length} / 8 kleuren</span></div><p class="gradient-help">Sleep een kleurpunt. Meer ruimte tussen twee punten maakt de overgang langer.</p><div class="gradient-rail-wrap"><div class="gradient-rail" data-gradient-rail style="background:${gradientCSS(draft.stops)}">${draft.stops.map((item, index) => `<button type="button" class="gradient-stop${index === selected ? ' is-selected' : ''}" data-gradient-stop="${index}" style="left:${item.position * 100}%;--stop:${C.screenHex(G.stopRGB(item))}" aria-label="Kleur ${index + 1}, positie ${Math.round(item.position * 100)} procent. Gebruik de pijltjestoetsen om te verplaatsen." aria-pressed="${index === selected}"><i aria-hidden="true"></i><span>${index + 1}</span></button>`).join('')}</div></div><div class="gradient-stop-toolbar"><button type="button" data-gradient-add ${limit ? 'disabled' : ''}>＋ Kleur toevoegen</button><button type="button" data-gradient-even>Gelijk verdelen</button></div>${limit ? '<p class="gradient-help">Acht kleuren is het maximum. Je kunt elke kleur blijven aanpassen.</p>' : ''}<section class="gradient-selected" aria-label="Geselecteerde kleur"><div class="gradient-selected-heading"><button type="button" class="gradient-color-input" data-gradient-color-open aria-haspopup="dialog" aria-label="Kies kleur ${selected + 1}"><i style="--stop:${C.screenHex(G.stopRGB(stop))}" aria-hidden="true"></i><span>Kleur <b data-gradient-number>${selected + 1}</b><small>Kies kleur</small></span></button><div class="gradient-order-actions"><button type="button" data-gradient-shift="-1" aria-label="Wissel kleur met links" ${selected === 0 ? 'disabled' : ''}>←</button><button type="button" data-gradient-shift="1" aria-label="Wissel kleur met rechts" ${selected === draft.stops.length - 1 ? 'disabled' : ''}>→</button><button type="button" data-gradient-remove aria-label="Verwijder kleur ${selected + 1}" ${draft.stops.length <= 2 ? 'disabled' : ''}>×</button></div></div><div class="gradient-palette" role="group" aria-label="Snelle kleuren">${paletteColors().map(color => `<button type="button" data-gradient-swatch="${color}" style="--stop:${C.screenHex(hexRGB(color))}" aria-label="Gebruik ${color}"></button>`).join('')}</div><label class="gradient-position-label" for="gradient-position">Positie op de ledline <output data-gradient-position-output>${Math.round(stop.position * 100)}%</output></label><input type="range" id="gradient-position" data-gradient-position min="${bounds().min}" max="${bounds().max}" step="1" value="${Math.round(stop.position * 100)}"><p class="gradient-help">Schuif dit punt om de verhouding te veranderen. Voor het eerste en na het laatste punt blijft de eindkleur staan.</p></section><label class="gradient-position-label" for="gradient-brightness">Helderheid voorbeeld <output data-gradient-brightness-output>${brightness}%</output></label><input type="range" id="gradient-brightness" data-gradient-brightness min="0" max="100" step="1" value="${brightness}"><p class="gradient-demo-note"><b>Alleen demo</b> · Dit is een lokaal voorbeeld, geen opdracht aan een receiver. Ontvangersondersteuning is nog niet beschikbaar.</p></section><section class="card gradient-library"><div class="gradient-rail-heading"><h3>Verloopideeën</h3><span>Begin met een preset</span></div><div class="gradient-builtins">${G.builtinPresets.map(preset => `<button type="button" data-gradient-builtin="${preset.id}"><i style="background:${gradientCSS(preset.stops)}" aria-hidden="true"></i><span>${esc(preset.name)}</span></button>`).join('')}</div><h3>Mijn verlopen</h3><p class="gradient-help">Bewaar kleuren én hun verdeling. In deze demo blijven ze bewaard tot je de pagina herlaadt.</p><label class="gradient-name-label" for="gradient-name">Naam<input type="text" id="gradient-name" data-gradient-name maxlength="48" autocomplete="off" value="${esc(draft.name)}" placeholder="Bijvoorbeeld: Balie warm"></label><div class="gradient-save-actions"><button type="button" class="button" data-gradient-save>${draft.id ? 'Wijzigingen bewaren' : 'Verloop bewaren'}</button>${draft.id ? '<button type="button" class="button secondary" data-gradient-save-copy>Bewaar als nieuw</button>' : ''}</div><p class="gradient-notice" data-gradient-notice role="status" aria-live="polite">${esc(state.error || notice)}</p><div class="gradient-customs">${custom || '<p class="gradient-empty">Je eigen verlopen verschijnen hier.</p>'}</div></section>`;
    }
    const hexRGB = color => [1, 3, 5].map(at => parseInt(color.slice(at, at + 2), 16));
    function paletteColors() {
      const saved = palette().filter(color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color));
      return [...new Set([...saved.slice(0, 4), '#FF492C', '#FFB536', '#28C99A', '#2873E2', '#8E4DE2', '#FFFFFF'])].slice(0, 10);
    }
    function paint() {
      if (!current()) return;
      const panel = host.querySelector('[data-gradient-panel]'), stop = draft.stops[selected], range = panel.querySelector('[data-gradient-position]');
      const rail = panel.querySelector('[data-gradient-rail]');
      if (!rail) return;
      rail.style.background = gradientCSS(draft.stops);
      rail.querySelectorAll('[data-gradient-stop]').forEach((button, index) => {
        button.style.left = draft.stops[index].position * 100 + '%';
        button.style.setProperty('--stop', C.screenHex(G.stopRGB(draft.stops[index])));
        button.classList.toggle('is-selected', index === selected); button.setAttribute('aria-pressed', String(index === selected));
        button.setAttribute('aria-label', `Kleur ${index + 1}, positie ${Math.round(draft.stops[index].position * 100)} procent. Gebruik de pijltjestoetsen om te verplaatsen.`);
      });
      if (range) { range.min = bounds().min; range.max = bounds().max; range.value = Math.round(stop.position * 100); }
      panel.querySelector('[data-gradient-color-open] i').style.setProperty('--stop', C.screenHex(G.stopRGB(stop)));
      panel.querySelector('[data-gradient-color-open]').setAttribute('aria-label', `Kies kleur ${selected + 1}`);
      panel.querySelector('[data-gradient-number]').textContent = String(selected + 1);
      panel.querySelector('[data-gradient-shift="-1"]').disabled = selected === 0;
      panel.querySelector('[data-gradient-shift="1"]').disabled = selected === draft.stops.length - 1;
      panel.querySelector('[data-gradient-remove]').setAttribute('aria-label', `Verwijder kleur ${selected + 1}`);
      panel.querySelector('[data-gradient-position-output]').textContent = Math.round(stop.position * 100) + '%';
      panel.querySelector('[data-gradient-brightness-output]').textContent = brightness + '%';
      draw(panel.querySelector('[data-gradient-preview]'), draft.stops, brightness);
    }
    function renderPanel(focus = null) {
      if (!current()) return;
      host.querySelector('[data-gradient-panel]').innerHTML = body(); paint();
      if (focus) host.querySelector(focus)?.focus({ preventScroll: true });
    }
    function setPosition(percent) {
      const { min, max } = bounds(); draft.stops[selected].position = Math.max(min, Math.min(max, Math.round(percent))) / 100; paint();
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
          button.isConnected&&!button.disabled&&host.querySelector(selector)===button;
        chooseColor({source:button,color:point.color,white:point.white??0,brightness:point.brightness??100,on:point.on??true,current:samePoint,commit:value=>{
          if(!samePoint()||!value||Object.keys(value).sort().join(',')!=='brightness,color,on,white'||!/^#[0-9a-f]{6}$/i.test(value.color)||
            !Number.isInteger(value.white)||value.white<0||value.white>255||!Number.isFinite(value.brightness)||value.brightness<0||value.brightness>100||typeof value.on!=='boolean')return;
          consumed=true;
          const fields={color:value.color.toUpperCase(),white:value.white,brightness:value.brightness,on:value.on};
          if(candidate){draft.stops.splice(insertAt,0,{position:point.position,...fields});selected=insertAt;renderPanel('[data-gradient-color-open]');}
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
          if (mode === 'gradient') renderPanel();
          return;
        }
        if (button.hasAttribute('data-gradient-stop')) { if (!moved) selectStop(Number(button.dataset.gradientStop)); moved = false; return; }
        if (button.hasAttribute('data-gradient-color-open')) {
          editPoint(button);return;
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
        else if (button.dataset.gradientLoad) { const preset = store.load().presets.find(item => item.id === button.dataset.gradientLoad); if (!preset) return; draft = clone(preset); selected = 0; notice = 'Bewerk je kleuren of verdeling en bewaar de wijzigingen.'; }
        else if (button.dataset.gradientDelete) { const result = store.remove(button.dataset.gradientDelete); notice = result.error || 'Verloop verwijderd.'; if (draft.id === button.dataset.gradientDelete) draft.id = null; }
        else if (button.hasAttribute('data-gradient-save') || button.hasAttribute('data-gradient-save-copy')) {
          const result = store.save({ ...draft, id: button.hasAttribute('data-gradient-save-copy') ? undefined : draft.id || undefined });
          notice = result.error || 'Bewaard in deze demo.'; if (!result.error) draft.id = result.savedId;
        } else return;
        renderPanel(button.hasAttribute('data-gradient-add') ? '[data-gradient-color-open]' : null);
      });
      on('input', event => {
        if (!current()) return;
        const input = event.target;
        if (input.matches('[data-gradient-position]')) setPosition(Number(input.value));
        else if (input.matches('[data-gradient-name]')) draft.name = input.value;
        else if (input.matches('[data-gradient-brightness]')) { brightness = Number(input.value); paint(); }
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
    return Object.freeze({ markup, mount, get mode() { return mode; } });
  }
  root.LightningStaticGradientUI = Object.freeze({ create, draw });
}(window));
