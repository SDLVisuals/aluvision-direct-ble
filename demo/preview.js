/* V32 presentation adapter. No storage, timers, hardware calls or runtime patches.
 * The retained V21 engines include mirrored V32 smooth-motion/loop corrections.
 * W is neutral white; non-static speed 0 still moves.
 * This is a local preview, not a claim of calibrated light or firmware parity.
 */
(function (root, factory) {
  const canonical = typeof module === 'object' && module.exports
    ? require('./vendor/v21_animation_catalog.js') : root.AluvisionV21AnimationCatalog;
  const extension = typeof module === 'object' && module.exports
    ? require('./animation-engine.js') : root.LightningAnimationEngine;
  const references = typeof module === 'object' && module.exports ? require('./reference-animations.js') : root.LightningReferenceAnimations;
  const api = factory(canonical, extension, references);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningPreview = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (canonical, extension, references) {
  'use strict';
  if (!canonical) throw new Error('Load the V30 vendored animation catalog before preview.js');
  if (!extension) throw new Error('Load animation-engine.js before preview.js');
  const copy = value => JSON.parse(JSON.stringify(value));
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, low, high, fallback = low) => Math.min(high, Math.max(low, number(value, fallback)));
  const rgb = value => {
    let hex = String(value || '#000000').replace(/^#/, '');
    if (/^[\da-f]{3}$/i.test(hex)) hex = hex.split('').map(c => c + c).join('');
    return /^[\da-f]{6}$/i.test(hex) ? [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)) : [0, 0, 0];
  };
  const hex = channels => '#' + channels.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const types = type => {
    if (!['RGBW', 'SPI'].includes(type)) throw new Error('Unknown receiver type: ' + type);
    return type;
  };
  const family = effect => {
    if (effect.tunnel || effect.kind === 'tunnel-lines') return 'Tunnel';
    return ({ CHASE: 'Chase', COMET: 'Comet', WAVE: 'Wave', BREATHE: 'Pulse',
      FLOW: 'Flow', GRADIENT: 'Flow', SPARKLE: 'Sparkle', SCANNER: 'Scanner',
      MIRROR: 'Spiegel', DUAL: 'Chase', SEQUENCE: 'Sequence', CASCADE: 'Sequence',
      ALTERNATE: 'Afwisseling', MINIMAL: 'Accent', WARM: 'Warm wit' })[effect.engine] || 'Overige';
  };
  const controlAliases = { width: 'widthPixels', count: 'objectCount', trail: 'trailLength' };
  // These are complete, existing receiver recipes (SPI variants 47–49 and
  // 73–85), not look-alike demos. Keep their wire engines/variants intact but
  // surface the exhibition-friendly ones in the dedicated Brand collection.
  const BRAND_SPI_VARIANTS = new Set([47,48,49,73,74,75,76,77,78,79,80,81,82,84,85]);
  // Colour-only crossfades cover the full line continuously; a background
  // control would do nothing there. Pulses, chases and tunnel envelopes expose
  // the area/time outside the foreground and can blend a separate background.
  const wholeBackground = variant => ![2, 3, 9, 10, 19, 23].includes(Number(variant));
  const wholeColorLimit = variant => [0, 1, 4, 17].includes(Number(variant)) ? 1 : 4;
  function controls(effect) {
    const supported = effect.receiverType === 'SPI'
      ? Object.keys(effect.capabilities || {}).filter(key => effect.capabilities[key])
      : Object.keys(effect.defaults || {});
    return supported.map(key => controlAliases[key] || key).filter(key => [
      'speed', 'smooth', 'widthPixels', 'objectCount', 'trailLength', 'spacing',
      'direction', 'lineDelayMs', 'spread', 'randomness'
    ].includes(key));
  }
  function entry(effect, targetType, wholeLine = false) {
    const state = canonical.effectState(effect);
    state.on = true;
    state.bri = state.brightness == null ? 100 : state.brightness;
    if (wholeLine) state.previewFamily = 'RGBW';
    const wholeFormula = effect.receiverType === 'RGBW' || wholeLine;
    const sharedVariant = effect.sharedRgbwVariant;
    return {
      id: wholeLine ? 'spi-line-' + effect.engine.toLowerCase() + '-' + effect.variant
        : targetType.toLowerCase() + '-' + effect.engine.toLowerCase() + '-' + effect.variant,
      name: effect.name, family: family(effect), state,
      category: family(effect) === 'Tunnel' ? 'tunnel' : wholeLine || targetType === 'RGBW' ? 'whole'
        : BRAND_SPI_VARIANTS.has(Number(effect.variant)) ? 'brand' : 'pixels',
      description: effect.description.nl,
      controls: controls(effect),
      directions: controls(effect).includes('direction') ? ['right', 'left'] : [],
      paletteEditable: true,
      colorCountRange: { min: 1, max: wholeFormula ? wholeColorLimit(effect.variant)
        : sharedVariant != null ? wholeColorLimit(sharedVariant) : 4 },
      backgroundEditable: wholeFormula ? wholeBackground(effect.variant)
        : sharedVariant != null ? wholeBackground(sharedVariant) : true,
      spatialResolution: wholeLine || targetType === 'RGBW' ? 'receiver' : 'pixel',
      minimumReceivers: family(effect) === 'Tunnel' ? 2 : 1
    };
  }

  // The standalone V21 catalog replaced only variants 104 and later. Its
  // original app retained 0–103 in index.html, including scanners and the
  // original chases. Keep their wire variants and accepted physical formulas,
  // not look-alike aliases. The V32 preview mirrors current SPI scenePixel;
  // actual C++ extraction tests cover every legacy recipe and all 4 channels.
  const legacySpi = (() => {
    const effects = [
      ["Static Color","STATIC","Minimal",0],
      ["Dual Static","STATIC","Minimal",1],
      ["Soft Gradient","GRADIENT","Gradient",2],
      ["Multi Gradient","GRADIENT","Gradient",3],
      ["Gradient Drift","GRADIENT","Gradient",4],
      ["Corporate Flow","FLOW","Corporate",5],
      ["Slow Color Flow","FLOW","Flow",6],
      ["Elegant Chase","CHASE","Chase",7],
      ["Soft Chase","CHASE","Chase",8],
      ["Thin Chase","CHASE","Chase",9],
      ["Wide Chase","CHASE","Chase",10],
      ["Dual Chase","DUAL","Chase",11],
      ["Multi Chase","CHASE","Chase",12],
      ["Comet","COMET","Dynamic",13],
      ["Soft Comet","COMET","Dynamic",14],
      ["Moving Highlight","CHASE","Professional",15],
      ["Double Highlight","DUAL","Professional",16],
      ["Premium Shimmer","SPARKLE","Ambient",17],
      ["Subtle Sparkle","SPARKLE","Ambient",18],
      ["Slow Shimmer","SPARKLE","Ambient",19],
      ["Satin Glow","BREATHE","Ambient",20],
      ["Silk Flow","FLOW","Flow",21],
      ["Breathing","BREATHE","Pulse",22],
      ["Soft Breathing","BREATHE","Pulse",23],
      ["Dual Breathing","BREATHE","Pulse",24],
      ["Pulse","BREATHE","Pulse",25],
      ["Soft Pulse","BREATHE","Pulse",26],
      ["Traveling Pulse","CHASE","Pulse",27],
      ["Wave","WAVE","Flow",28],
      ["Soft Wave","WAVE","Flow",29],
      ["Sine Wave","WAVE","Flow",30],
      ["Dual Wave","WAVE","Flow",31],
      ["Light Sweep","SCANNER","Dynamic",32],
      ["Slow Sweep","SCANNER","Dynamic",33],
      ["Edge Sweep","SCANNER","Dynamic",34],
      ["Center Sweep","MIRROR","Dynamic",35],
      ["Center Out","MIRROR","Dynamic",36],
      ["Outside In","MIRROR","Dynamic",37],
      ["Edge-to-Edge Fade","GRADIENT","Gradient",38],
      ["Cross Fade","BREATHE","Gradient",39],
      ["Color Fade","BREATHE","Gradient",40],
      ["Slow Color Transition","BREATHE","Gradient",41],
      ["Aurora Flow","FLOW","Ambient",42],
      ["Ambient Drift","FLOW","Ambient",43],
      ["Gentle Motion","FLOW","Ambient",44],
      ["Minimal Accent","MINIMAL","Minimal",45],
      ["Moving Accent","MINIMAL","Minimal",46],
      ["Corporate Accent","FLOW","Corporate",47],
      ["White Accent Flow","FLOW","Corporate",48],
      ["Warm White Flow","WARM","Corporate",49],
      ["Gallery Light","STATIC","Professional",50],
      ["Architectural Flow","FLOW","Professional",51],
      ["Tunnel Flow","FLOW","Professional",52],
      ["Parallel Flow","FLOW","Professional",53],
      ["Synchronized Sweep","SCANNER","Professional",54],
      ["Alternating Lines","ALTERNATE","Professional",55],
      ["Cascading Lines","CASCADE","Professional",56],
      ["Mirror Flow","MIRROR","Professional",57],
      ["Symmetric Chase","DUAL","Chase",58],
      ["Asymmetric Chase","CHASE","Chase",59],
      ["Liquid Gradient","GRADIENT","Gradient",60],
      ["Soft Liquid","GRADIENT","Gradient",61],
      ["Glow Trail","COMET","Dynamic",62],
      ["Fade Trail","COMET","Dynamic",63],
      ["Comet Trail","COMET","Dynamic",64],
      ["Light Runner","CHASE","Dynamic",65],
      ["Slow Runner","CHASE","Dynamic",66],
      ["Spotlight Travel","CHASE","Professional",67],
      ["Soft Spotlight","CHASE","Professional",68],
      ["Gradient Pulse","BREATHE","Gradient",69],
      ["Gradient Wave","WAVE","Gradient",70],
      ["Gradient Chase","CHASE","Gradient",71],
      ["Gradient Sweep","SCANNER","Gradient",72],
      ["Brand Color Flow","FLOW","Corporate",73],
      ["Brand Color Pulse","BREATHE","Corporate",74],
      ["Brand Color Chase","CHASE","Corporate",75],
      ["Exhibition Mode","FLOW","Professional",76],
      ["Welcome Flow","FLOW","Professional",77],
      ["Presentation Mode","BREATHE","Professional",78],
      ["Evening Ambient","BREATHE","Ambient",79],
      ["Product Highlight","CHASE","Professional",80],
      ["Luxury Shimmer","SPARKLE","Ambient",81],
      ["Calm Motion","FLOW","Ambient",82],
      ["Minimal White","STATIC","Minimal",83],
      ["Dynamic White","BREATHE","Minimal",84],
      ["White Temperature Flow","WARM","Corporate",85],
      ["Soft Strobe","SPARKLE","Dynamic",86],
      ["Accent Flash","SPARKLE","Dynamic",87],
      ["Sequence Fade","SEQUENCE","Dynamic",88],
      ["Custom Timeline","SEQUENCE","Custom",89],
      ["Line Fade Down","CASCADE","Multi-line",90,{"spread":70,"spacing":68,"speed":12,"smooth":96}],
      ["Line Fade Up","CASCADE","Multi-line",91,{"spread":70,"spacing":68,"speed":12,"smooth":96}],
      ["LED Line Sequence Fade","SEQUENCE","Multi-line",92,{"spread":72,"speed":11,"smooth":98,"direction":"right"}],
      ["Panel Wave","WAVE","Multi-line",93,{"spread":64,"objectCount":1,"speed":14,"smooth":96}],
      ["Panel Chase","CHASE","Multi-line",94,{"spread":68,"objectCount":1,"widthPixels":3,"speed":16,"smooth":94}],
      ["Center Rows Out","MIRROR","Multi-line",95,{"spread":72,"speed":11,"smooth":98,"direction":"right"}],
      ["Alternating Directions","DUAL","Multi-line",96,{"spread":58,"objectCount":1,"widthPixels":3,"speed":15,"smooth":95}],
      ["Synchronized Rows","FLOW","Multi-line",97,{"spread":0,"objectCount":1,"widthPixels":3,"speed":14,"smooth":96}],
      ["Whole Line Pulse","BREATHE","Whole-line",98,{"speed":10,"smooth":96,"spacing":34,"lineDelayMs":240}],
      ["Whole Line Soft Fade","BREATHE","Whole-line",99,{"speed":8,"smooth":99,"spacing":24,"lineDelayMs":320}],
      ["Whole Line Color Fade","GRADIENT","Whole-line",100,{"speed":11,"smooth":98,"spread":64,"lineDelayMs":320}],
      ["Whole Line Smooth Transitions","FLOW","Whole-line",101,{"speed":10,"smooth":100,"spread":72,"lineDelayMs":360}],
      ["Whole Line Flash / Strobe","SPARKLE","Whole-line",102,{"speed":18,"smooth":24,"spacing":76,"lineDelayMs":160}],
      ["Warm Ribbon Chase","COMET","Professional",103,{"speed":68,"widthPixels":4,"smooth":92,"trailLength":78,"direction":"right","objectCount":1,"spacing":100,"bounce":false,"mirror":false}]
    ];
    const widthEngines = new Set(['CHASE','COMET','SCANNER','DUAL','MIRROR','MINIMAL','CASCADE','SEQUENCE','FLOW','WAVE','ALTERNATE','SPARKLE']);
    const movingFamilies = new Set(['GRADIENT','FLOW','CHASE','COMET','SCANNER','WAVE','SEQUENCE','MIRROR','ALTERNATE','CASCADE','DUAL','MINIMAL']);
    const clamp = (value, minimum = 0, maximum = 100, fallback = minimum) => Math.max(minimum, Math.min(maximum, Number.isFinite(Number(value)) ? Number(value) : fallback));
    const effectWireVariant = effect => Number(effect?.[3]);
    function effectColorCount(effect) {
      const variant = effectWireVariant(effect);
      if (variant === 85) return 2;
      if ([98,99,102].includes(variant)) return 1;
      if ([100,103].includes(variant)) return 2;
      if (variant === 101) return 3;
      const name = (effect?.[0] || '').toLowerCase(), engine = effect?.[1];
      if (/multi|aurora|sequence|timeline|cascade/.test(name)) return 3;
      return /dual/.test(name) || ['GRADIENT','FLOW','ALTERNATE'].includes(engine) ? 2 : 1;
    }

function animationDefaults(e){
  let name=(e?.[0]||'').toLowerCase(),engine=e?.[1]||'STATIC',d={speed:18,speedMode:'slow',widthPixels:3,smooth:90,spacing:58,objectCount:1,trailLength:45,spread:55,randomness:25,bounce:false,mirror:false};
  if(engine==='STATIC')Object.assign(d,{speed:0,widthPixels:1,smooth:100});
  if(engine==='GRADIENT')Object.assign(d,{speed:10,speedMode:'ultra',smooth:98,spread:72});
  if(engine==='FLOW')Object.assign(d,{speed:14,speedMode:'slow',widthPixels:Math.max(4,Math.round(25*.16)),smooth:96,objectCount:2,spacing:68,spread:62});
  if(engine==='CHASE')Object.assign(d,{speed:18,widthPixels:3,smooth:92,objectCount:1,spacing:62});
  if(engine==='COMET')Object.assign(d,{speed:16,widthPixels:3,smooth:94,trailLength:68,spacing:72});
  if(engine==='SCANNER')Object.assign(d,{speed:18,widthPixels:4,smooth:94,trailLength:28,bounce:true});
  if(engine==='SPARKLE')Object.assign(d,{speed:11,speedMode:'ultra',widthPixels:1,smooth:70,objectCount:4,randomness:32});
  if(engine==='WAVE')Object.assign(d,{speed:14,widthPixels:Math.max(3,Math.round(25*.12)),smooth:96,objectCount:2,spacing:74,spread:65});
  if(engine==='BREATHE'||engine==='ALL')Object.assign(d,{speed:12,speedMode:'ultra',smooth:98,spread:engine==='BREATHE'?18:50});
  if(engine==='DUAL'||engine==='MIRROR')Object.assign(d,{speed:16,widthPixels:3,smooth:95,objectCount:2,spread:76,mirror:true});
  if(engine==='ALTERNATE')Object.assign(d,{speed:14,widthPixels:2,smooth:84,objectCount:4,spacing:52});
  if(engine==='CASCADE'||engine==='SEQUENCE')Object.assign(d,{speed:15,widthPixels:3,smooth:88,objectCount:4,spacing:58});
  if(engine==='MINIMAL')Object.assign(d,{speed:12,speedMode:'ultra',widthPixels:1,smooth:96,objectCount:1,spacing:72});
  if(engine==='WARM')Object.assign(d,{speed:8,speedMode:'ultra',smooth:100});
  if(/slow|soft|gentle|calm|ambient|silk|satin/.test(name)){d.speed=Math.min(d.speed,10);d.speedMode='ultra';d.smooth=Math.max(d.smooth,96)}
  if(/thin|minimal accent/.test(name))d.widthPixels=1;
  if(/wide|spotlight/.test(name))d.widthPixels=Math.max(6,d.widthPixels);
  if(/dual|double|symmetric/.test(name))d.objectCount=Math.max(2,d.objectCount);
  if(/multi|cascade|sequence/.test(name))d.objectCount=Math.max(3,d.objectCount);
  if(/trail|comet/.test(name))d.trailLength=Math.max(68,d.trailLength);
  if(/center|mirror|symmetric/.test(name))d.mirror=true;
  if(/line cascade up/.test(name))d.direction='right';
  if(/line cascade down/.test(name))d.direction='right';
  if(e?.[2]==='Multi-line')Object.assign(d,{speed:12,speedMode:'ultra',smooth:96,spacing:70,spread:70});
  return d
 }

function effectCapabilities(e){
  let name=(e?.[0]||'').toLowerCase(),engine=e?.[1]||'STATIC',gradientMoves=engine==='GRADIENT'&&/(drift|liquid|fade|transition)/.test(name);
  return {
   speed:!['STATIC'].includes(engine)&&(engine!=='GRADIENT'||gradientMoves),
   width:widthEngines.has(engine),
   smooth:!['STATIC','SPARKLE'].includes(engine),
   direction:movingFamilies.has(engine)&&(engine!=='GRADIENT'||gradientMoves),
   background:!['STATIC','GRADIENT','WARM','ALL'].includes(engine),
   spacing:['CHASE','COMET','WAVE','FLOW','ALTERNATE','CASCADE','SEQUENCE','MINIMAL'].includes(engine),
   count:['CHASE','COMET','WAVE','FLOW','SPARKLE','ALTERNATE','CASCADE','SEQUENCE','MINIMAL','DUAL','MIRROR'].includes(engine),
   trail:['COMET','SCANNER'].includes(engine)||/(trail|runner|spotlight)/.test(name),
   spread:['GRADIENT','FLOW','WAVE','BREATHE','DUAL','MIRROR'].includes(engine),
   randomness:engine==='SPARKLE',
   bounce:['CHASE','COMET','SCANNER','MINIMAL'].includes(engine)||/(sweep|runner|bounce)/.test(name),
   mirror:['CHASE','COMET','SCANNER','WAVE','FLOW','MINIMAL'].includes(engine)
  }
 }

// Same finite, energy-preserving spatial edge as SPI softChaseAmount.
// No afterimage/time filter: a receiver joining later renders this exact phase.
function softChaseCoverage(distance,width,n,smooth){
  width=clamp(Math.round(width),1,n);if(width>=n)return 1;
  const d=Math.abs(distance)*n,half=width*.5;
  const crisp=clamp(half+.5-d,0,1)>=.999?1:0;
  const integral=p=>{const x=Math.abs(p),tail=1.5-x,v=x>=1.5?1:x<=.5?.5+x*(.75-x*x/3):1-tail*tail*tail/6;return p<0?1-v:v;};
  const band=delta=>integral(delta+half)-integral(delta-half);
  let soft=band(d);if(n-d<half+1.5)soft+=band(d-n);if(n+d<half+1.5)soft+=band(d+n);
  const s=clamp(smooth,0,100,100)/100,blend=s<.5?4*s*s*s:1-4*Math.pow(1-s,3);
  return crisp+(clamp(soft,0,1)-crisp)*blend;
}

    // V32: mirror the CURRENT SPI scenePixel implementation, not the archived
    // V21 HTML mock-up. In particular colour/envelope quantisation, comet tails,
    // sparkle clocks and real four-channel W must agree before screen clipping.
    // This does not send pixels or alter the receiver's accepted effect recipes.
    function sample(s,u,time,index,n) {
      const variant=Number(s.variant),engine=s.engine||'CHASE',smooth=clamp(s.smooth,0,100,100),sm=smooth/100;
      const curve=sm<.5?4*sm*sm*sm:1-4*Math.pow(1-sm,3),tau=Math.PI*2;
      const wrap=x=>x-Math.floor(x),ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
      const q16=x=>Math.round(clamp(x,0,1)*65535)/65535;
      const mix=(a,b,x)=>a.map((v,i)=>v+(b[i]-v)*q16(x));
      const animated=x=>{x=clamp(x,0,1);const step=x<.5?0:1;return step+(x-step)*curve;};
      const mixAnimated=(a,b,x)=>mix(a,b,animated(x));
      const blend=(a,b)=>{let delta=wrap(b)-wrap(a);if(delta>.5)delta--;if(delta<-.5)delta++;return wrap(a+delta*curve);};
      const phaseSteps=(x,steps=16)=>smooth>=100?wrap(x):blend(Math.floor(wrap(x)*steps)/steps,wrap(x));
      const motion=(x,width,pixels=n)=>{x=wrap(x);if(smooth>=100)return x;let pixel=x*pixels,nearest=Math.round(pixel);if(Math.abs(pixel-nearest)<.0001)pixel=nearest;return blend(wrap((Math.floor(pixel)+(Math.round(width)%2?.5:0))/pixels),x);};
      const distance=(a,b)=>Math.min(Math.abs(a-b),1-Math.abs(a-b));
      const thickness=(d,width,pixels=n)=>{if(width>=pixels)return 1;const coverage=clamp(width*.5+.5-d*pixels,0,1),step=coverage>=.999?1:0;return q16(step+(coverage-step)*curve);};
      const brightness=clamp(s.brightness,0,100,100)/100;
      // V30LiveScene.delivery scales only the sent foreground palette and
      // uses BRIGHT=100, so the user's background dimmer stays independent.
      // WARM alone keeps its real palette and uses the physical output dimmer.
      const count=clamp(Math.round(s.colorCount||1),1,4),palette=Array.from({length:count},(_,i)=>[
        ...(s.rgbEnabled?.[i]===false?[0,0,0]:rgb(s.colors?.[i])),s.whiteEnabled?.[i]===false?0:clamp(s.whiteChannels?.[i],0,255)]
        .map(x=>engine==='WARM'?x:Math.round(x*brightness)));
      const band=x=>palette[Math.min(count-1,Math.floor(wrap(x)*count))];
      const gradient=(x,eased=false)=>{const scaled=wrap(x)*count,i=Math.floor(scaled),fraction=scaled-i;return mixAnimated(palette[i],palette[(i+1)%count],eased?ease(fraction):fraction);};
      const elapsed=Math.max(0,time-(Number(s.previewStartedAt)||0)),speed=clamp(s.speed,.5,100,35),rate=.002+(speed/100)**2*.8;
      const raw=wrap(elapsed*rate+(Number(s.phaseMs)||0)/1000),triangle=1-Math.abs(2*raw-1),eased=.5-.5*Math.cos(raw*tau);
      const bounce=s.bounce?triangle+(eased-triangle)*curve:raw,left=s.direction==='left',phase=left?1-bounce:bounce,temporal=phaseSteps(phase);
      const width=Math.max(1,Number(s.widthPixels)||3),objects=clamp(Math.round(s.objectCount||1),1,8),spacing=clamp(s.spacing,0,100,50)/100,spread=clamp(s.spread,0,100,50)/100,trail=clamp(s.trailLength,0,100,45);
      const span=.18+spacing*.82,physical=Math.max(1,Number(s.physicalLeds)||n),offset=Number(s.receiverOffset)||0,local=(index-offset+.5)/physical;
      let lines=Math.max(1,Number(s.lineCount)||1),line=clamp(s.lineIndex,0,lines-1);
      // Ordinary whole-line effects are sent with one shared row/zero delay.
      if(variant>=98&&variant<=102){lines=1;line=0;}
      const slot=left?lines-1-line:line,delay=s.lineDelayMs!=null?Math.round(clamp(s.lineDelayMs,0,5080)/40)*.04*rate:spread*.65/Math.max(1,lines-1);
      const linePhase=left?wrap(1-phaseSteps(raw-slot*delay)):phaseSteps(raw-slot*delay);
      const backgroundValue=typeof s.background==='object'&&s.background?s.background:{rgb:s.background,white:s.backgroundWhite};
      const bg=s.backgroundOn?[
        ...(s.backgroundRgbEnabled===false?[0,0,0]:rgb(backgroundValue.rgb)),s.backgroundWhiteEnabled===false?0:clamp(backgroundValue.white,0,255)
      ].map(x=>Math.floor(x*clamp(s.bgBrightness??s.backgroundBrightness,0,100,10)/100)):[0,0,0,0];
      let foreground=palette[0],amount=1;
      const objectAmount=()=>{let best=0;for(let k=0;k<objects;k++){const p=motion(phase+(objects===1?0:k*span/objects),width);best=Math.max(best,q16(softChaseCoverage(distance(u,p),width,n,smooth)));if(s.mirror)best=Math.max(best,q16(softChaseCoverage(distance(u,wrap(1-p)),width,n,smooth)));}return best;};
      if(variant===103){
        const head=motion(left?1-raw:raw,width),behind=wrap(left?u-head:head-u)*n,ribbon=Math.max(width,Math.min(Math.max(1,n-.5),n*trail/100));
        const fade=Math.max(width*(.35+1.15*sm),ribbon*(.04+.08*sm)),warmZone=Math.min(ribbon,Math.max(fade*2,width*2));
        amount=q16(ease((ribbon-behind+.5)/Math.max(.5,fade))*ease((behind+.5)/(.45+sm)));
        foreground=mixAnimated(palette[0],palette[count>1?1:0],ease((behind-(ribbon-warmZone))/Math.max(.5,warmZone)));
      }else if(variant>=98&&variant<=102){
        foreground=band(linePhase);
        if(variant===98)amount=q16(.1+.9*(.5-.5*Math.cos(linePhase*tau)));
        else if(variant===99)amount=q16(ease(1-Math.abs(2*linePhase-1)));
        else if(variant===100)foreground=gradient(linePhase);
        else if(variant===101)foreground=gradient(linePhase,true);
        else amount=linePhase<.04+.22*sm?1:0;
      }else if(variant>=90&&variant<=97&&lines>1){
        const row=line/Math.max(1,lines-1),panelRaw=phaseSteps(raw-slot*delay,Math.max(16,lines)),panel=left?wrap(1-panelRaw):panelRaw;
        const rowWidth=Math.max(1,1+width/physical*lines);
        if(variant===90||variant===91){let sweep=variant===91?1-panel:panel;const feather=(rowWidth*.5+.5)/lines;sweep+=(sweep*2-1)*feather*curve;amount=thickness(Math.abs(row-sweep),rowWidth,lines);foreground=palette[line%count];}
        else if(variant===92){const active=Math.min(lines-1,Math.floor(panel*lines)),next=(active+1)%lines,fade=ease(panel*lines-active),old=line===active?1:0,continuous=line===active?1-fade:line===next?fade:0;amount=q16(old+(continuous-old)*curve);foreground=palette[line%count];}
        else if(variant===93){amount=q16(Math.pow(.5+.5*Math.sin((local-panel+row*spread)*tau*objects),.8));foreground=gradient(row+local);}
        else if(variant===94){const p=motion(panel-row*spacing/lines,width,physical);amount=thickness(distance(local,p),width,physical);foreground=palette[line%count];}
        else if(variant===95){const centre=(lines-1)*.5,d=Math.abs(line-centre)/Math.max(1,centre),feather=(rowWidth*.5+.5)/lines,sweep=panel+(panel*2-1)*feather*curve;amount=thickness(Math.abs(d-sweep),rowWidth,lines);foreground=band(Math.min(d,.999999));}
        else if(variant===96){const p=motion(line%2?1-panel:panel,width,physical);amount=thickness(distance(local,p),width,physical);foreground=palette[line%count];}
        else{const p=motion(panel,width,physical);amount=thickness(distance(local,p),width,physical);foreground=gradient(local);}
      }else if(engine==='STATIC')foreground=band(u);
      else if(engine==='GRADIENT')foreground=gradient(u*(1+spread*3)+temporal*(variant===60?-1:variant%6===0?0:1));
      else if(engine==='FLOW'||engine==='WAVE'){foreground=gradient(u*(1+spread*2)-temporal);amount=objectAmount();}
      else if(engine==='BREATHE'){
        foreground=gradient(u);const clock=phaseSteps(elapsed*(.35+speed/100*2.2)/tau+u*spread);
        // Match sinf's signed half-cycle boundary before the deliberate 0%
        // hard cut. Double precision rounds the exact pi crossing differently.
        const sine=Math.fround(Math.sin(Math.fround(clock*Math.fround(tau))));
        amount=q16(Math.fround(.5+Math.fround(.5*sine)));
      }
      else if(engine==='SPARKLE'){
        const tick=Math.floor(Math.fround(elapsed)*Math.fround(3+speed*.22)),seed=Math.max(0,Math.floor(index/width));
        const hash=(Math.imul(seed,1103515245)+Math.imul(tick,12345)+Math.imul(variant,7919))>>>0;
        foreground=band(seed/7);amount=hash%1000<Math.min(820,8+clamp(s.randomness,0,100,25)*2+objects*9)?1:0;
      }else if(engine==='SCANNER'){
        let p=left?1-(s.bounce?bounce:raw):(s.bounce?bounce:raw);const core=clamp(Math.round(width),1,n),travel=Math.max(1,n-core),step=Math.round(p*travel)/travel;p=step+(p-step)*curve;
        const coverage=position=>{if(core>=n)return 1;const c=clamp((core+1)*.5-Math.abs(Math.round(u*n-.5)-(clamp(position,0,1)*(n-core)+(core-1)*.5)),0,1),a=c>=.999?1:0;return q16(a+(c-a)*curve);};
        foreground=gradient(temporal);amount=coverage(p);if(s.mirror)amount=Math.max(amount,coverage(1-p));
        if(trail){const tail=wrap(left?u-p:p-u),a=q16(Math.max(0,1-tail*n/Math.max(1,width*(1+trail/12))));amount=Math.max(amount,Math.floor(a*65535*.72)/65535);}
      }else if(engine==='DUAL'||engine==='MIRROR'){
        foreground=gradient(u+temporal);amount=0;const copies=Math.max(2,objects);
        for(let k=0;k<copies;k++){const p=motion(phase+k*(.35+spread*.65)/copies,width);amount=Math.max(amount,thickness(distance(u,p),width),thickness(distance(u,wrap(1-p)),width));}
      }else if(engine==='COMET'){
        foreground=gradient(temporal);amount=0;
        for(let k=0;k<objects;k++){const p=motion(phase+(objects===1?0:k*span/objects),width),tail=wrap(left?u-p:p-u),a=q16(Math.max(0,1-tail*n/Math.max(1,width*(1.4+trail*.09))));amount=Math.max(amount,thickness(distance(u,p),width),Math.floor(a*65535*.88)/65535);}
      }else if(engine==='ALTERNATE'){
        const bandWidth=Math.max(1,Math.round(width)),gap=Math.max(1,Math.floor(Math.fround(bandWidth*Math.fround(.3+spacing*2.7)))),period=bandWidth+gap,p=motion(phase,width),centre=(bandWidth-1)*.5;
        const cyclicDistance=Math.max(period,Math.round(n/period)*period),continuous=phaseSteps(phase)*cyclicDistance,travel=p*n+(continuous-p*n)*curve;
        foreground=palette[Math.floor(Math.floor(u*n)/period)%count];let delta=u*n-.5+travel-centre;delta-=Math.floor(delta/period+.5)*period;
        const c=clamp((bandWidth+1)*.5-Math.abs(delta),0,1),a=c>=.999?1:0;amount=q16(a+(c-a)*curve);
      }else if(engine==='CASCADE'||engine==='SEQUENCE'){
        const q=wrap(u-temporal);foreground=mix(palette[Math.min(Math.floor(q*objects),objects-1)%count],gradient(q,true),curve);amount=objectAmount();
        if(engine==='CASCADE')amount=Math.floor(amount*65535*(60+Math.floor(q*40))/100)/65535;
      }else if(engine==='WARM'){
        const clock=phaseSteps(temporal+u*.72);
        foreground=count===1?palette[0].map(channel=>channel*(.68+.32*ease(.5+.5*Math.sin(clock*tau)))):gradient(clock,true);
      }else if(engine==='ALL')foreground=gradient(temporal);
      else{foreground=gradient(temporal);amount=objectAmount();}
      const channels=mixAnimated(bg,foreground,amount),bright=engine==='WARM'?(palette.some(c=>c.some(x=>x!==0))?brightness:0):1;
      return channels.slice(0,3).map(x=>Math.round(clamp(255-(255-x*bright)*(1-channels[3]*bright/255),0,255)));
    }
    function catalog() {
      return effects.filter(effect=>effect[1]!=='STATIC').map(effect=>{
        const [name,engine,,variant,overrides={}]=effect;
        const count=effectColorCount(effect);
        // The installed W emitter is neutral/cool, not inherently warm. Use
        // an explicit, editable red-dominant RGB + W mix, without a Kelvin
        // claim. New defaults only: never overwrite saved customer palettes.
        const whiteMixPreset=[48,49,79,84,85].includes(variant);
        const palette=variant===85?['#FF2D00','#400A00']:engine==='WARM'?['#FF2D00']:whiteMixPreset?['#400A00','#803000']:variant===103 ? ['#FFF4D4','#F3A24D'] : ['#C94E46','#F0B95F','#669CC6'];
        const whites=variant===85?[128,220]:engine==='WARM'?[128]:whiteMixPreset?[220,190]:Array(count).fill(0);
        const state={animation:name,engine,variant,legacySpi:true,previewStartedAt:0,phaseMs:0,
          colors:palette.slice(0,count),whiteChannels:whites.slice(0,count),
          rgbEnabled:Array(count).fill(true),whiteEnabled:Array(count).fill(true),colorCount:count,
          on:true,power:true,bri:85,brightness:85,backgroundOn:false,background:'#000000',
          backgroundWhite:0,bgBrightness:10,direction:'right',...animationDefaults(effect),...overrides};
        let capabilities=effectCapabilities(effect);
        if(variant===103) capabilities={speed:true,width:true,smooth:true,direction:true,trail:true};
        else if(variant>=98&&variant<=102) {
          capabilities={speed:true,smooth:true,direction:true};
          state.lineDelayMs=0;
        }
        else if(variant>=90&&variant<=97) {
          // The original multiline editor narrowed these controls beyond
          // the engine-family defaults: a row fade has no pixel width, for
          // example, and Fade Up/Down already encode their direction.
          capabilities={speed:true,smooth:true,lineDelayMs:true,
            width:[94,96,97].includes(variant),direction:![90,91].includes(variant),
            spacing:[90,91,94,96,97].includes(variant),count:[93,94,96,97].includes(variant),
            mirror:[94,96,97].includes(variant)};
          state.lineDelayMs=240;
        }
        const controlKeys=Object.keys(capabilities).filter(key=>capabilities[key]&&key!=='background').map(key=>controlAliases[key]||key);
        const descriptions={
          GRADIENT:'Kleuren lopen geleidelijk in elkaar over over de pixels.',
          FLOW:'Gekleurde lichtbanden bewegen over de LED Line.',
          CHASE:'Een of meer lichtpunten volgen elkaar over de LED Line.',
          COMET:'Een lichtkop met een uitlopende staart reist over de pixels.',
          SCANNER:'Een lichtbundel beweegt heen en terug over de LED Line.',
          MIRROR:'Een gespiegelde beweging op beide zijden van de LED Line.',
          DUAL:'Twee of meer gespiegelde lichtpunten bewegen samen.',
          SPARKLE:'Afzonderlijke pixels lichten kort op.',
          BREATHE:'Lichtsterkte neemt geleidelijk toe en af.',
          WAVE:'Lichtgolven bewegen over de pixels.',
          WARM:'Warm licht en wit gaan zacht in elkaar over.',
          ALTERNATE:'Lichtbanden en kleuren wisselen elkaar af.',
          CASCADE:'Lichtbewegingen volgen elkaar op.',
          SEQUENCE:'Een reeks kleuren beweegt over de pixels.',
          MINIMAL:'Een compact lichtaccent beweegt over de LED Line.'
        };
        const category=variant>=90&&variant<=97?'tunnel':variant>=98&&variant<=102?'whole'
          :BRAND_SPI_VARIANTS.has(Number(variant))?'brand':'pixels';
        const entryFamily=category==='tunnel'?'Tunnel':family({engine});
        return {id:'spi-'+engine.toLowerCase()+'-'+variant,name,family:entryFamily,state,
          category,legacy:true,source:'v21-inline-catalog',paletteEditable:true,whiteMixPreset,
          colorCountRange:{min:1,max:variant===85?2:engine==='WARM'||[90,91,92,94,96,98,99,102].includes(variant)?1:variant===103?2:4},
          backgroundEditable:variant===103||!['STATIC','GRADIENT','WARM','ALL'].includes(engine)&&![100,101].includes(variant),
          description:variant===49?'Een warme RGB + W-mix ademt rustig. Pas de witmix aan voor jouw ledline.':variant===85?'Warm en zacht wit gaan rustig in elkaar over. Beide witmixen zijn instelbaar.':category==='tunnel'?'Een bestaande beweging verdeeld over meerdere LED Lines.':
            category==='whole'?'De volledige SPI LED Line neemt samen dezelfde kleur of fade aan.':descriptions[engine],
          controls:controlKeys,directions:controlKeys.includes('direction')?['right','left']:[],
          minimumReceivers:category==='tunnel'?2:1,
          spatialResolution:category==='whole'||[90,91,92,95].includes(variant)?'receiver':'pixel'};
      });
    }
    return {sample,catalog};
  })();

  function catalog(type) {
    types(type);
    // Static color is its own page, not an animation. Include the real existing
    // whole-line formulas on SPI as well, without remapping their wire variant.
    const whole = canonical.rgbwEffects.filter(effect => effect.engine !== 'STATIC' && effect.kind === 'whole-line');
    const preserved = type === 'RGBW'
      ? canonical.rgbwEffects.filter(effect => effect.engine !== 'STATIC').map(effect => entry(effect, type))
      : legacySpi.catalog().concat(canonical.spiEffects.map(effect => entry(effect, type)), whole.map(effect => entry(effect, type, true)));
    return preserved.concat(extension.catalog(type),references.catalog(type));
  }
  const descriptors = new Map(['RGBW', 'SPI'].flatMap(type => catalog(type).map(effect =>
    [effect.state.v30Effect || [type, effect.state.engine, effect.state.variant, effect.state.previewFamily || ''].join(':'), effect])));
  function descriptorFor(receiver) {
    const state = receiver.state || {};
    return descriptors.get(state.v30Effect || [receiver.type, state.engine, state.variant, state.previewFamily || ''].join(':'));
  }
  function categoryFor(receiver) { return descriptorFor(receiver)?.category; }
  function selected(receiver, selection) {
    return !selection || selection.kind === 'all' ||
      (selection.kind === 'receiver' && selection.receiverId === receiver.id) ||
      (selection.kind === 'receivers' && Array.isArray(selection.receiverIds) && selection.receiverIds.includes(receiver.id));
  }
  function geometry(receivers, layout = 'stacked') {
    if (!Array.isArray(receivers)) throw new Error('Receivers must be an array');
    const seen = new Set();
    let offset = 0;
    const mapped = receivers.map((receiver, lineIndex) => {
      types(receiver.type);
      if (!receiver.id || seen.has(receiver.id)) throw new Error('Receiver identity must be unique');
      seen.add(receiver.id);
      let localOffset = 0;
      const outputs = receiver.type === 'RGBW' ? [] : (receiver.outputs || [])
        .filter(output => output.enabled !== false).slice().sort((a, b) => Number(a.port) - Number(b.port)).map(output => {
        const pixels = Math.round(clamp(output.pixels, 1, 8192, 1));
        const result = { port: output.port, pixels, reversed: Boolean(output.reversed),
          offset: offset + localOffset, localOffset };
        localOffset += pixels;
        return result;
      });
      const result = { receiverId: receiver.id, lineIndex, lineCount: receivers.length,
        pixelCount: receiver.type === 'RGBW' ? 1 : localOffset, offset, outputs };
      offset += result.pixelCount;
      return result;
    });
    return { layout, totalPixels: offset, receivers: mapped };
  }
  function normalizeState(receiver) {
    const state = copy(receiver.state || {});
    const isStatic = !state.engine || String(state.engine).toUpperCase() === 'STATIC';
    state.engine = isStatic ? 'STATIC' : String(state.engine).toUpperCase();
    if (isStatic) { state.animation = 'Static Color'; state.variant = 0; }
    if (!Array.isArray(state.colors) || !state.colors.length) state.colors = [hex([state.r == null ? 255 : state.r, state.g || 0, state.b || 0])];
    if (!Array.isArray(state.whiteChannels)) state.whiteChannels = [clamp(state.w, 0, 255, 0)];
    state.colorCount = Math.round(clamp(state.colorCount, 1, state.v30Effect ? Math.max(1, state.colors.length) : 4, state.colors.length));
    state.brightness = clamp(state.bri == null ? state.brightness : state.bri, 0, 100, 100);
    state.smooth = clamp(state.smooth, 0, 100, 100);
    // Old saved presets may predate the explicit marker. Real SPI variants
    // 0–103 always belong to the preserved inline engine, except the shared
    // RGBW whole-line formulas which are explicitly marked previewFamily.
    state.legacySpi = receiver.type === 'SPI' && !isStatic && !state.v30Effect &&
      state.previewFamily !== 'RGBW' && Number.isInteger(Number(state.variant)) &&
      Number(state.variant) >= 0 && Number(state.variant) <= 103;
    if (state.legacySpi && !Number.isFinite(Number(state.previewStartedAt))) state.previewStartedAt = 0;
    // The earlier non-tunnel engine treats zero as pause. The V30 UI instead
    // promises its slowest speed. Keep every other speed/formula unchanged.
    if (!isStatic) state.speed = clamp(state.speed, state.v30Effect ? 0 : 0.5, 100, 35);
    return state;
  }
  function opticalWhite(sample) {
    const amount = clamp(sample.amount, 0, 1, 0);
    const background = sample.background;
    // Interpolate/dim R/G/B/W independently, exactly like receiver output.
    // Compose the limited screen RGB only afterwards, never round it early.
    const brightness = sample.brightness == null ? 1 : sample.brightness;
    const backgroundWhite = background ? background.white * background.brightness : 0;
    const white = (backgroundWhite + (clamp(sample.white, 0, 255) * brightness - backgroundWhite) * amount) / 255;
    return sample.rgb.map((channel, index) => {
      const base = background ? background.rgb[index] * background.brightness : 0;
      const linear = base + (clamp(channel, 0, 255) * brightness - base) * amount;
      return Math.round(clamp(255 - (255 - linear) * (1 - white), 0, 255));
    });
  }
  function backgroundSample(state) {
    if (!state.backgroundOn) return null;
    const value = typeof state.background === 'object' && state.background
      ? state.background : { rgb: state.background || '#000000', white: state.backgroundWhite || 0 };
    return {
      rgb: state.backgroundRgbEnabled === false ? [0, 0, 0] : rgb(value.rgb),
      white: state.backgroundWhiteEnabled === false ? 0 : clamp(value.white, 0, 255),
      brightness: clamp(state.bgBrightness == null ? state.backgroundBrightness : state.bgBrightness, 0, 100, 10) / 100
    };
  }
  function sample(receiver, sceneGeometry, time = 0) {
    types(receiver.type);
    const group = sceneGeometry || geometry([receiver]);
    const geo = group.receivers.find(item => item.receiverId === receiver.id);
    if (!geo) throw new Error('Receiver is not in the full-zone geometry');
    const state = normalizeState(receiver);
    const background = descriptorFor(receiver)?.backgroundEditable ? backgroundSample(state) : null;
    if (state.on === false || state.power === false) return Array.from({ length: geo.pixelCount }, () => [0, 0, 0]);
    const isStatic = state.engine === 'STATIC';
    if (!isStatic && state.v30Effect) {
      const input = { state, receiverIndex: geo.lineIndex, receiverCount: geo.lineCount,
        receiverType: receiver.type, time, pixelCount: geo.pixelCount,
        totalPixels: group.totalPixels, layout: group.layout };
      const engine=references.supports(state.v30Effect)?references:extension;
      if (receiver.type === 'RGBW') return [engine.sample({ ...input, pixelIndex: 0, globalPixel: geo.offset })];
      return geo.outputs.flatMap(output => Array.from({ length: output.pixels }, (_, pixel) => {
        const oriented = output.reversed ? output.pixels - 1 - pixel : pixel;
        return engine.sample({ ...input, pixelIndex: output.localOffset + oriented, globalPixel: output.offset + oriented });
      }));
    }
    if (isStatic || receiver.type === 'RGBW' || state.previewFamily === 'RGBW') {
      const value = canonical.sampleRgbwLine(background ? { ...state, brightness: 100 } : state, geo.lineIndex, geo.lineCount, time);
      if (background) Object.assign(value, { background, brightness: state.brightness / 100 });
      const colour = opticalWhite(value);
      return Array.from({ length: geo.pixelCount }, () => colour.slice());
    }
    // Physical placement is calculated from ALL zone members, including
    // offline receivers; selecting one receiver must never close a gap.
    const continuous = group.layout === 'continuous';
    const total = continuous ? group.totalPixels : geo.pixelCount;
    return geo.outputs.flatMap(output => Array.from({ length: output.pixels }, (_, pixel) => {
      const oriented = output.reversed ? output.pixels - 1 - pixel : pixel;
      const position = (continuous ? output.offset : output.localOffset) + oriented;
      const sampleState = Object.assign({}, state, {
        groupPixels: total, physicalLeds: geo.pixelCount,
        receiverOffset: continuous ? geo.offset : 0,
        lineIndex: geo.lineIndex, lineCount: geo.lineCount
      });
      if (state.legacySpi) return legacySpi.sample({ ...sampleState, backgroundOn: Boolean(background) }, (position + 0.5) / total, time, position, total);
      const value = canonical.sampleSpiPixel(sampleState,
        (position + 0.5) / total, time, total, geo.lineIndex, geo.lineCount);
      // The preserved engine supplies the true coverage envelope. V30 exposes
      // that existing foreground/background split without changing its recipe.
      value.background = background;
      return opticalWhite(value);
    }));
  }
  function rows(options) {
    const receivers = options.receivers || [];
    const group = geometry(options.geometryReceivers || receivers, options.layout);
    const frame = {
      geometry: group,
      rows: receivers.map(receiver => {
        const outputs = group.receivers.find(item => item.receiverId === receiver.id).outputs;
        const pixels = sample(receiver, group, options.time || 0);
        const blink = options.identifying?.get?.(receiver.id);
        const identificationTime = number(options.identificationTime, options.time || 0);
        const elapsed = blink ? identificationTime - number(blink.startedAt, identificationTime) : -1;
        const ports = blink?.scope === 'all' ? outputs.map(output => output.port)
          : Array.isArray(blink?.ports) ? blink.ports.map(Number) : [];
        const identifying = Boolean(blink && elapsed >= 0 && Number.isFinite(blink.until) &&
          identificationTime < blink.until && (receiver.type === 'RGBW' || outputs.some(output => ports.includes(output.port))));
        // Identification is a presentation overlay, never a new saved colour.
        // Its clock is separate from the animation clock so it can run while
        // an effect is paused. The caller decides when to show this preview;
        // it is not evidence that a physical receiver accepted a command.
        let identificationPixels = null;
        if (identifying) {
          const level = options.reducedMotion ? 1 : .16 + .84 * (.5 - .5 * Math.cos(elapsed * 4.4));
          const white = Math.round(58 + 197 * level);
          identificationPixels = pixels.map((pixel, index) => receiver.type === 'RGBW' ||
            outputs.some(output => ports.includes(output.port) && index >= output.localOffset && index < output.localOffset + output.pixels)
            ? [white, white, white] : pixel.slice());
        }
        return { receiverId: receiver.id, name: receiver.name || 'Receiver', type: receiver.type,
          category: categoryFor(receiver), selected: selected(receiver, options.selection),
          individuallySelected: (options.selection?.kind === 'receiver' || options.selection?.kind === 'receivers') && selected(receiver, options.selection),
          offline: receiver.connection === 'offline', pixels, outputs, identifying, identificationPixels };
      })
    };
    const individualFeedback = options.selectionFeedback === true &&
      !(options.layout === 'continuous' && frame.rows.every(row => row.type === 'SPI'));
    frame.highlightedReceiverIds = individualFeedback
      ? frame.rows.filter(row => row.individuallySelected).map(row => row.receiverId) : [];
    frame.identifyingReceiverIds = frame.rows.filter(row => row.identifying).map(row => row.receiverId);
    return frame;
  }
  function rounded(context, x, y, width, height, radius) {
    context.beginPath();
    if (context.roundRect) context.roundRect(x, y, width, height, radius);
    else context.rect(x, y, width, height);
  }
  // Diffuser depth belongs only to the canvas material, never the sampled
  // light. Shade across the strip, not along it: an RGBW line stays one colour
  // end to end and neighbouring SPI pixels never blend into each other.
  // Every stop is the same RGB ratio; pure red cannot gain white/blue from a
  // decorative highlight. The central lens retains the exact sampled RGB.
  const diffuserStops = [[0,.66],[.16,.92],[.40,1],[.72,1],[1,.62]];
  function diffuser(context, colour, css, crossStart, thickness, vertical, materials) {
    if (materials.has(css)) return materials.get(css);
    let material = css;
    if (typeof context.createLinearGradient === 'function') {
      const gradient = vertical
        ? context.createLinearGradient(crossStart,0,crossStart + thickness,0)
        : context.createLinearGradient(0,crossStart,0,crossStart + thickness);
      // Canvas-less test hosts and old drawing adapters may lack gradients.
      // Their solid fallback preserves exactly the same light and geometry.
      if (gradient && typeof gradient.addColorStop === 'function') {
        diffuserStops.forEach(([position,shade]) => gradient.addColorStop(position,
          'rgb(' + colour.map(channel => Math.round(channel * shade)).join(',') + ')'));
        material = gradient;
      }
    }
    materials.set(css,material);
    return material;
  }
  // The user-confirmed frontal aluminium tunnel from bb93c89. Only its camera
  // and materials return: every light arch still uses one actual receiver row.
  // Arc-length sampling prevents a slow chase from speeding up in the bends.
  function tunnelCurveSamples(curve) {
    const segments=curve.slice(1).map((control,index)=>[
      curve[index].slice(-2),control.slice(0,2),control.slice(2,4),control.slice(4,6)]);
    const raw = [], distances = [0];
    segments.forEach((segment, part) => {
      for (let step = part ? 1 : 0; step <= 48; step++) {
        const t=step/48, s=1-t;
        const p=[0,1].map(axis=>s*s*s*segment[0][axis]+3*s*s*t*segment[1][axis]+3*s*t*t*segment[2][axis]+t*t*t*segment[3][axis]);
        if(raw.length)distances.push(distances.at(-1)+Math.hypot(p[0]-raw.at(-1)[0],p[1]-raw.at(-1)[1]));
        raw.push(p);
      }
    });
    let cursor=1;
    return Array.from({length:129},(_,index)=>{
      const distance=index/128*distances.at(-1);
      while(cursor<distances.length-1&&distances[cursor]<distance)cursor++;
      const ratio=(distance-distances[cursor-1])/(distances[cursor]-distances[cursor-1]);
      return [0,1].map(axis=>raw[cursor-1][axis]+(raw[cursor][axis]-raw[cursor-1][axis])*ratio);
    });
  }
  const tunnelInner=[[82,224],[55,196,40,162,43,122],[46,76,82,40,132,40],[181,40,216,73,220,123],[221,163,206,195,182,224]];
  const tunnelOuter=[[60,224],[20,190,12,148,18,110],[24,47,72,14,132,14],[194,14,241,59,244,116],[246,159,230,194,206,224]];
  const tunnelRim=tunnelOuter.map((points,index)=>points.map((value,axis)=>(value+tunnelInner[index][axis])/2));
  tunnelRim[0]=[83,240];tunnelRim[1][0]=57;tunnelRim[1][1]=211;
  tunnelRim[4][2]=207;tunnelRim[4][3]=211;tunnelRim[4][4]=183;tunnelRim[4][5]=240;
  const tunnelCurve=tunnelCurveSamples(tunnelInner),tunnelOuterCurve=tunnelCurveSamples(tunnelOuter),tunnelFasciaCurve=tunnelCurveSamples(tunnelRim);
  function tunnelProjection(lineCount, width=360, height=240) {
    const count=Math.max(0,Math.floor(number(lineCount,0)));
    width=Math.max(1,number(width,360));height=Math.max(1,number(height,240));
    // Preserve the proportions of the original 360x260 illustration, including
    // its slightly off-centre vanishing point. Never stretch the circular face
    // to fit a wide gallery card or turn it back into an upright U-shaped arch.
    const unit=Math.min(width/360,height/260),offset=[(width-360*unit)/2,(height-260*unit)/2];
    const screen=(x,y)=>[offset[0]+(x+44)*unit,offset[1]+(y+5)*unit];
    const point=(x,y,scale)=>screen(164+(x-164)*scale,108+(y-108)*scale);
    const project=(scale,curve=tunnelCurve)=>curve.map(([x,y])=>point(x,y,scale));
    const floor=(left,right,near=1.1,far=.48)=>[point(left,224,near),point(right,224,near),point(right,224,far),point(left,224,far)];
    const front=project(1), back=project(.48);
    const arches=Array.from({length:count},(_,index)=>{
      const depth=(index+.5)/count,scale=Math.pow(.48,depth);
      // Each selected line gets its own depth. More lines narrow the diffuser
      // instead of clipping the rear lines or imposing the old four-line cap.
      const spacing=184*unit*scale*(1-Math.pow(.48,1/Math.max(1,count)));
      const thickness=Math.max(.45,Math.min(3.2*unit*scale,spacing*.55));
      return {index,depth,scale,thickness,points:project(scale),
        panel:[...project(Math.pow(.48,index/count)),...project(Math.pow(.48,(index+1)/count)).reverse()]};
    });
    return {width,height,unit,arches,front,back,vanishing:point(164,108,1),
      outer:project(1,tunnelOuterCurve),outerBack:project(.48,tunnelOuterCurve),fascia:project(1,tunnelFasciaCurve),
      groundY:point(132,224,1)[1],shadow:screen(132,231),exitCentre:point(132,129,.48),floor:floor(82,182),inlay:floor(109,155),
      exitFloor:floor(82,182,.48,.08),exitInlay:floor(109,155,.48,.08)};
  }
  const tunnelProjectionCache=new Map();
  function drawTunnel(context,frame,width,height) {
    const key=[frame.rows.length,width,height].join(':');
    let model=tunnelProjectionCache.get(key);
    if(!model){
      model=tunnelProjection(frame.rows.length,width,height);
      if(tunnelProjectionCache.size>=8)tunnelProjectionCache.delete(tunnelProjectionCache.keys().next().value);
      tunnelProjectionCache.set(key,model);
    }
    const path=(points,close=false)=>{
      context.beginPath();points.forEach(([x,y],index)=>index?context.lineTo(x,y):context.moveTo(x,y));
      if(close)context.closePath();
    };
    const material=(start,end,from,to,stops)=>{
      if(typeof context.createLinearGradient==='function'){
        const gradient=context.createLinearGradient(...start,...end);
        if(gradient&&typeof gradient.addColorStop==='function'){(stops||[[0,from],[1,to]]).forEach(([at,colour])=>gradient.addColorStop(at,colour));return gradient;}
      }
      return from;
    };
    const radial=(x,y,r,from,to)=>{
      const gradient=context.createRadialGradient?.(x,y,0,x,y,r);
      if(gradient&&typeof gradient.addColorStop==='function'){gradient.addColorStop(0,from);gradient.addColorStop(1,to);return gradient;}
      return from;
    };
    context.shadowBlur=0;
    // Neutral materials, the circular silver face and the dark central inlay
    // reproduce the confirmed product illustration. No decorative light rows,
    // baked-in pink animations or four-block floor reflections are introduced.
    rounded(context,0,0,width,height,18);
    context.fillStyle=material([0,0],[width,height],'#16191a','#2a2c2e');context.fill();
    context.save();context.translate(...model.shadow);context.scale(1,12/131);
    context.beginPath();context.arc(0,0,131*model.unit,0,Math.PI*2);
    context.fillStyle=radial(0,0,131*model.unit,'rgba(0,0,0,.7)','rgba(0,0,0,0)');context.fill();context.restore();
    path(model.back,true);context.fillStyle=material([width*.5,0],[width*.5,height],'#262a2e','#4b4e50');context.fill();
    context.save();path(model.back,true);context.clip();
    context.fillStyle=radial(...model.exitCentre,43*model.unit,'rgba(215,217,216,.23)','rgba(215,217,216,0)');
    context.fillRect(0,0,width,height);
    path(model.exitFloor,true);context.fillStyle='#66696a';context.fill();
    path(model.exitInlay,true);context.fillStyle='#343739';context.fill();context.restore();
    path([...model.outer,...model.outerBack.slice().reverse()],true);
    context.fillStyle=material([0,0],[width,height],'#d1d5d5','#a8aeb1');context.fill();
    path([...model.front,...model.back.slice().reverse()],true);
    const lining=material([width*.2,0],[width*.8,height*.8],'#202226','#111316',[[0,'#202226'],[.36,'#090c10'],[.7,'#25272b'],[1,'#111316']]);
    context.fillStyle=lining;context.fill();
    for(let rowIndex=frame.rows.length-1;rowIndex>=0;rowIndex--){
      const row=frame.rows[rowIndex],pixels=row.identificationPixels||row.pixels;
      const sum=[0,0,0];
      for(const colour of pixels)for(let channel=0;channel<3;channel++)sum[channel]+=colour[channel];
      const mean=sum.map(value=>Math.round(value/Math.max(1,pixels.length)));
      path(model.arches[rowIndex].panel,true);
      context.fillStyle=material([width*.3,height],[width*.7,0],'rgba('+mean.join(',')+',.08)','rgba('+mean.join(',')+',.025)');context.fill();
    }
    path(model.floor,true);
    context.fillStyle=material([width*.4,height],[width*.6,height*.4],'#a3a09a','#424345');context.fill();
    path(model.inlay,true);context.fillStyle='#252729';context.fill();
    context.strokeStyle='#919493';context.lineWidth=Math.max(.45,model.unit*.7);
    path([model.floor[0],model.floor[3]]);context.stroke();
    path([model.floor[1],model.floor[2]]);context.stroke();
    path([model.inlay[0],model.inlay[3]]);context.stroke();
    path([model.inlay[1],model.inlay[2]]);context.stroke();
    context.lineCap='round';context.lineJoin='round';
    for(let rowIndex=frame.rows.length-1;rowIndex>=0;rowIndex--){
      const row=frame.rows[rowIndex],arch=model.arches[rowIndex];
      const pixels=row.identificationPixels||row.pixels;
      const point=position=>{
        const at=clamp(position,0,1)*128,index=Math.min(127,Math.floor(at)),fraction=at-index;
        return [0,1].map(axis=>arch.points[index][axis]+(arch.points[index+1][axis]-arch.points[index][axis])*fraction);
      };
      const part=(from,to)=>{
        const points=[point(from)],begin=Math.floor(from*128)+1,end=Math.ceil(to*128);
        for(let index=begin;index<end;index++)points.push(arch.points[index]);
        points.push(point(to));path(points);
      };
      path(arch.points);context.strokeStyle=material(arch.points[0],arch.points[64],'#393d40','#606467');
      context.lineWidth=arch.thickness+Math.max(.45,1.4*model.unit*arch.scale);context.stroke();
      path(arch.points);context.strokeStyle='#29342f';context.lineWidth=arch.thickness+.8;context.stroke();
      const segments=row.type==='RGBW'?1:Math.min(384,pixels.length);
      // Blur is decoration, not pixel data. Rasterizing hundreds of separate
      // shadow masks per arch is expensive on phones. Draw a bounded, soft
      // halo underneath, then every exact foreground pixel without blur.
      const groupedHalo=row.type==='SPI'&&segments>64;
      if(groupedHalo){
        const groups=16;
        for(let group=0;group<groups;group++){
          const start=Math.floor(group*pixels.length/groups),end=Math.floor((group+1)*pixels.length/groups),sum=[0,0,0];
          for(let pixel=start;pixel<end;pixel++)for(let channel=0;channel<3;channel++)sum[channel]+=pixels[pixel][channel];
          const colour=sum.map(value=>Math.round(value/Math.max(1,end-start)));
          if(Math.max(...colour)===0)continue;
          const css='rgba('+colour.join(',')+',0.38)';context.strokeStyle=css;context.shadowColor=css;
          context.shadowBlur=Math.min(5,arch.thickness*1.25);context.lineWidth=arch.thickness;
          part(group/groups,(group+1)/groups);context.stroke();
        }
        context.shadowBlur=0;
      }
      for(let index=0;index<segments;index++){
        const colour=pixels[Math.min(pixels.length-1,Math.floor((index+.5)/segments*pixels.length))]||[0,0,0];
        const css='rgb('+colour.join(',')+')',on=Math.max(...colour)>0;
        // A tiny gap keeps SPI's physical pixels legible at useful sizes;
        // subpixel/dense samples naturally read as a continuous diffuser.
        const gap=row.type==='SPI'&&pixels.length<=64?.035:0;
        context.strokeStyle=css;context.shadowColor=css;
        context.shadowBlur=on&&!groupedHalo?Math.min(5,arch.thickness*1.25):0;
        context.lineWidth=arch.thickness;
        part((index+gap)/segments,(index+1-gap)/segments);context.stroke();
      }
      context.shadowBlur=0;
    }
    // Constant-width aluminium fascia with level-cut feet, as in bb93c89.
    // Draw only OUTSIDE the opening so even dense front arches stay visible.
    context.save();context.beginPath();context.rect(0,0,width,model.groundY);context.clip();
    context.beginPath();context.rect(0,0,width,height);
    model.front.forEach(([x,y],index)=>index?context.lineTo(x,y):context.moveTo(x,y));context.closePath();context.clip('evenodd');
    context.lineCap='butt';path(model.fascia);context.strokeStyle='#969ea2';context.lineWidth=28*model.unit;context.stroke();
    path(model.fascia);context.strokeStyle='#eceeed';context.lineWidth=27.5*model.unit;context.stroke();
    path(model.fascia);context.strokeStyle=material([width*.25,0],[width*.7,height],'#d5d8d8','#b4b9bc');context.lineWidth=26*model.unit;context.stroke();
    context.restore();context.lineCap='round';
    path(model.front);context.strokeStyle='#858c90';context.lineWidth=Math.max(.5,model.unit);context.stroke();
    // Numbers belong below the model, not on the walkway: the foot of a rear
    // arch is very close to the next strip. Overlay labels used to hide those
    // real SPI pixels. This small ordered key never covers the light itself.
    if(frame.rows.length<=8&&height>=130){
      context.font='10px system-ui';context.textAlign='center';context.textBaseline='top';
      context.strokeStyle='#111514';context.lineWidth=3;context.fillStyle='#d3ddd6';
      for(let rowIndex=frame.rows.length-1;rowIndex>=0;rowIndex--){
        const row=frame.rows[rowIndex];
        const order=(frame.geometry.receivers.find(item=>item.receiverId===row.receiverId)?.lineIndex??rowIndex)+1;
        const spread=Math.min(width*.6,180*model.unit),x=width/2+((rowIndex+.5)/frame.rows.length-.5)*spread,y=height-13;
        context.strokeText(String(order),x,y);context.fillText(String(order),x,y);
      }
    }
    context.shadowBlur=0;
  }
  // The approved "Strakke wand" is only another camera for these same rows.
  // Setup order goes left to right, with each strip's first pixel at its foot.
  // In particular, a view change must not reverse an output a second time.
  function wallProjection(lineCount, width=360, height=240) {
    const count=Math.max(0,Math.floor(number(lineCount,0)));
    width=Math.max(1,number(width,360));height=Math.max(1,number(height,240));
    const wall=[[width*.095,height*.11],[width*.905,height*.11],
      [width*.905,height*.84],[width*.095,height*.84]];
    const lane=width*.648/Math.max(1,count);
    const thickness=Math.max(.2,Math.min(4.3,width*.012,height*.028,lane*.3));
    const profile=Math.min(2,width*.006,height*.012,lane*.18);
    const lines=Array.from({length:count},(_,index)=>{
      const x=width*(.176+.648*(index+.5)/count);
      return {index,thickness,profile,from:[x,height*.7816],to:[x,height*.1757]};
    });
    return {width,height,wall,lines,
      floor:[wall[3],wall[2],[width,height*.98],[0,height*.98]]};
  }
  const wallProjectionCache=new Map();
  function drawWall(context,frame,width,height) {
    const key=[frame.rows.length,width,height].join(':');
    let model=wallProjectionCache.get(key);
    if(!model){
      model=wallProjection(frame.rows.length,width,height);
      if(wallProjectionCache.size>=8)wallProjectionCache.delete(wallProjectionCache.keys().next().value);
      wallProjectionCache.set(key,model);
    }
    const path=(points,close=false)=>{
      context.beginPath();points.forEach(([x,y],index)=>index?context.lineTo(x,y):context.moveTo(x,y));
      if(close)context.closePath();
    };
    const material=(start,end,stops)=>{
      const gradient=context.createLinearGradient?.(...start,...end);
      if(gradient&&typeof gradient.addColorStop==='function'){
        stops.forEach(([at,colour])=>gradient.addColorStop(at,colour));return gradient;
      }
      return stops[0][1];
    };
    context.save();context.shadowBlur=0;
    rounded(context,0,0,width,height,18);context.clip();
    context.fillStyle=material([0,0],[width,height],[[0,'#151b18'],[1,'#323a34']]);context.fillRect(0,0,width,height);
    path(model.floor,true);
    context.fillStyle=material([0,height*.77],[width,height],[[0,'#434a43'],[1,'#232c26']]);context.fill();
    path(model.wall,true);
    context.fillStyle=material([width*.1,height*.1],[width*.8,height*.8],[[0,'#404740'],[.55,'#272f28'],[1,'#1b231d']]);context.fill();
    context.strokeStyle='#555e55';context.lineWidth=.75;context.stroke();
    context.lineCap='butt';context.lineJoin='round';
    frame.rows.forEach((row,rowIndex)=>{
      const line=model.lines[rowIndex],pixels=row.identificationPixels||row.pixels;
      const point=position=>position===0?line.from:position===1?line.to:
        [line.from[0],line.from[1]+(line.to[1]-line.from[1])*position];
      const part=(from,to)=>path([point(from),point(to)]);
      part(0,1);context.strokeStyle='#646b67';context.lineWidth=line.thickness+line.profile;context.stroke();
      part(0,1);context.strokeStyle='#101713';context.lineWidth=line.thickness+.4*line.profile;context.stroke();
      const segments=row.type==='RGBW'?1:Math.min(384,pixels.length);
      // Halo is surface decoration only. Bound expensive shadow masks to
      // sixteen per line; keep all foreground samples exact below the limit.
      const groupedHalo=row.type==='SPI'&&segments>64;
      if(groupedHalo){
        const groups=16;
        for(let group=0;group<groups;group++){
          const start=Math.floor(group*pixels.length/groups),end=Math.floor((group+1)*pixels.length/groups),sum=[0,0,0];
          for(let pixel=start;pixel<end;pixel++)for(let channel=0;channel<3;channel++)sum[channel]+=pixels[pixel][channel];
          const colour=sum.map(value=>Math.round(value/Math.max(1,end-start)));
          if(Math.max(...colour)===0)continue;
          const css='rgba('+colour.join(',')+',0.38)';context.strokeStyle=css;context.shadowColor=css;
          context.shadowBlur=Math.min(7,line.thickness*2);context.lineWidth=line.thickness;
          part(group/groups,(group+1)/groups);context.stroke();
        }
        context.shadowBlur=0;
      }
      for(let index=0;index<segments;index++){
        const colour=pixels[Math.min(pixels.length-1,Math.floor((index+.5)/segments*pixels.length))]||[0,0,0];
        const css='rgb('+colour.join(',')+')';
        const gap=row.type==='SPI'&&pixels.length<=64?.035:0;
        context.strokeStyle=css;context.shadowColor=css;context.lineWidth=line.thickness;
        context.shadowBlur=Math.max(...colour)>0&&!groupedHalo?Math.min(7,line.thickness*2):0;
        part((index+gap)/segments,(index+1-gap)/segments);context.stroke();
      }
      context.shadowBlur=0;
    });
    // An unobtrusive order key on the floor never covers the light itself.
    if(frame.rows.length<=8&&height>=130){
      context.font='10px system-ui';context.textAlign='center';context.textBaseline='middle';context.fillStyle='#c0c8c2';
      frame.rows.forEach((row,index)=>{
        const order=(frame.geometry.receivers.find(item=>item.receiverId===row.receiverId)?.lineIndex??index)+1;
        context.fillText(String(order),model.lines[index].from[0],height*.9);
      });
    }
    context.restore();context.shadowBlur=0;
  }
  // A projection of the SAME sampled pixels, not a second canned animation.
  // View shape changes presentation only; it never changes output mapping.
  function drawSpatial(context,frame,width,height,shape) {
    if(shape==='tunnel'){drawTunnel(context,frame,width,height);return;}
    if(shape==='wall'){drawWall(context,frame,width,height);return;}
    const count=frame.rows.length;
    const point=(index,u)=>{
      const spread=(index+.5)/count;
      if(shape==='frames'){
        const depth=count===1?0:index/(count-1),scale=1-depth*.57;
        const corners=[[-.36,.34],[.36,.34],[.36,-.34],[-.36,-.34],[-.36,.34]];
        const pos=u*4,k=Math.min(3,Math.floor(pos)),f=pos-k;
        return [width*(.5+(corners[k][0]*(1-f)+corners[k+1][0]*f)*scale+depth*.07),height*(.51+(corners[k][1]*(1-f)+corners[k+1][1]*f)*scale-depth*.08)];
      }
      const x=.11+spread*.78;
      if(u<.32)return [width*x,height*(.88-u/.32*.32)];
      const t=(u-.32)/.68,bend=Math.sin(Math.min(1,t*3)*Math.PI/2);
      return [width*(.52+(x-.52)*(1-t*.56)),height*(.56-.18*bend-.24*t)];
    };
    context.lineCap='round';context.lineJoin='round';
    for(let rowIndex=count-1;rowIndex>=0;rowIndex--){
      const row=frame.rows[rowIndex],steps=Math.min(144,Math.max(32,row.pixels.length)),thickness=Math.max(1.2,Math.min(5,width/count*.055));
      const points=Array.from({length:steps+1},(_,i)=>point(rowIndex,i/steps));
      context.beginPath();points.forEach(([x,y],i)=>i?context.lineTo(x,y):context.moveTo(x,y));context.strokeStyle='#303937';context.lineWidth=thickness+2;context.stroke();
      for(let i=0;i<steps;i++){
        const color=row.pixels[Math.min(row.pixels.length-1,Math.floor((i+.5)/steps*row.pixels.length))]||[0,0,0];
        const [r,g,b]=color;context.strokeStyle=`rgb(${r},${g},${b})`;context.shadowColor=context.strokeStyle;context.shadowBlur=Math.max(r,g,b)>35?5:0;
        context.lineWidth=thickness;context.beginPath();context.moveTo(...points[i]);context.lineTo(...points[i+1]);context.stroke();
      }
      context.shadowBlur=0;
      if(count<=8&&height>=130){const p=point(rowIndex,0),number=(frame.geometry.receivers.find(r=>r.receiverId===row.receiverId)?.lineIndex??rowIndex)+1;context.fillStyle='#bcc6c1';context.font='10px system-ui';context.textAlign='center';context.fillText(String(number),p[0],Math.min(height-6,p[1]+14));}
    }
  }
  function draw(canvas, options = {}) {
    const frame = rows(options);
    if (canvas.dataset) {
      canvas.dataset.highlightedReceiverIds = frame.highlightedReceiverIds.join(',');
      canvas.dataset.identifyingReceiverIds = frame.identifyingReceiverIds.join(',');
      canvas.dataset.renderedLineCount = String(frame.rows.length);
      canvas.dataset.lineHitRegions = '[]';
      canvas.dataset.spatialShape = options.spatialShape && frame.rows.length ? options.spatialShape : '';
      canvas.dataset.spatialLineCount = options.spatialShape ? String(frame.rows.length) : '';
    }
    const context = canvas.getContext('2d');
    if (!context) return frame;
    const width = Math.max(1, canvas.clientWidth || canvas.width || 320);
    const height = Math.max(1, canvas.clientHeight || canvas.height || 180);
    const scale = typeof devicePixelRatio === 'number' ? Math.min(devicePixelRatio, 2) : 1;
    if (canvas.width !== Math.round(width * scale)) canvas.width = Math.round(width * scale);
    if (canvas.height !== Math.round(height * scale)) canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#111514';
    rounded(context, 0, 0, width, height, 18); context.fill();
    if (!frame.rows.length) {
      context.fillStyle = '#a8b0ab'; context.font = '13px system-ui';
      context.textAlign = 'center'; context.fillText('Nog geen receivers in deze zone', width / 2, height / 2);
      return frame;
    }
    if(options.spatialShape){
      if(canvas.dataset){canvas.dataset.spatialShape=options.spatialShape;canvas.dataset.spatialLineCount=String(frame.rows.length);}
      drawSpatial(context,frame,width,height,options.spatialShape);return frame;
    }
    const byReceiver = options.presentation === 'receivers' || options.layout !== 'continuous' && frame.rows.some(row => row.category === 'tunnel');
    const vertical = options.layout === 'vertical' && options.presentation !== 'receivers';
    const continuous = options.layout === 'continuous' && !byReceiver && frame.rows.every(row => row.type === 'SPI');
    const padding = Math.min(18, width / 8);
    const maxRowPixels = Math.max(1, ...frame.rows.filter(row => row.type === 'SPI').map(row => row.pixels.length));
    const shortestFraction = Math.min(1, ...frame.rows.filter(row => row.type === 'SPI').map(row => row.pixels.length / maxRowPixels));
    const hitRegions = [];
    context.font = '11px system-ui'; context.textBaseline = 'middle';
    frame.rows.forEach((row, index) => {
      const lane = vertical ? (width - padding * 2) / frame.rows.length : Math.max(1, height - 16) / frame.rows.length;
      // A single ledline should read as a light bar, not a hairline, in the
      // compact sticky preview. Scale with each lane so multi-line layouts
      // stay clearly separated on small screens.
      const showLabel = continuous ? false : vertical ? lane >= 48 : lane >= 30 || row.individuallySelected && lane >= 24;
      const compactVertical = vertical && options.main === true && height < 140;
      const verticalStart = Math.min(showLabel ? compactVertical ? 24 : 38 : 14, height / 3);
      const verticalBottom = compactVertical ? 18 : Math.min(24, height / 4);
      // In a short vertical thumbnail, strip length (not the much wider lane)
      // limits thickness. All lanes keep the same material/pixel pitch, while
      // even the shortest physical line still reads as a line, not a square.
      const verticalThickness = (height - verticalStart - verticalBottom) * shortestFraction * .45;
      // The main preview has an explicit size control. Let its lit strip grow
      // with the chosen canvas height so “large” enlarges the actual example,
      // not just an empty black area around the same thin line. Gallery cards
      // stay compact and keep their established pixel pitch.
      const mainBarLimit = options.main === true ? Math.min(42, Math.max(18, height * .29)) : 18;
      const barHeight = continuous ? Math.min(mainBarLimit, height * .5)
        : Math.max(0.5, Math.min(compactVertical && options.main !== true ? 10 : mainBarLimit,
          lane * 0.62, vertical ? verticalThickness : Infinity));
      const continuousFraction = row.pixels.length / Math.max(1, frame.geometry.totalPixels);
      const continuousOffset = frame.geometry.receivers[index].offset / Math.max(1, frame.geometry.totalPixels);
      const x = continuous ? padding + (width - padding * 2) * continuousOffset : vertical ? padding + lane * index + lane / 2 - barHeight / 2 : padding;
      const y = continuous ? (height - barHeight) / 2 : vertical ? verticalStart
        : 8 + lane * index + (lane - barHeight) / 2 + (showLabel ? 4 : 0);
      if (options.main === true && !continuous) hitRegions.push({receiverId:row.receiverId,
        x:vertical?(padding + lane * index) / width:0,
        y:vertical?0:(8 + lane * index) / height,
        width:vertical?lane / width:1,
        height:vertical?1:lane / height});
      const availableLength = Math.max(0.5, continuous ? (width - padding * 2) * continuousFraction
        : vertical ? height - y - verticalBottom : width - padding * 2);
      // One common physical pixel pitch for separate SPI rows. A 12-pixel
      // line must not get giant blocks beside a 28-pixel line merely because
      // each row was stretched independently to the full viewport width.
      // Long lines share the same drawing stride; real sampling stays exact.
      const sharedPixels = row.type === 'SPI' && !continuous;
      const pixelPitch = availableLength / maxRowPixels;
      const drawStride = sharedPixels ? Math.max(1, Math.ceil(5 / pixelPitch)) : 1;
      const length = sharedPixels ? Math.max(0.5, row.pixels.length * pixelPitch) : availableLength;
      const gap = continuous ? Math.min(1, length / 5) : 0;
      const bw = vertical ? barHeight : Math.max(0.5, length - gap);
      // Light floats directly on the shared dark canvas. No separate casing,
      // border or pill-shaped ring around a receiver's individual LED line.
      // The main preview can mark one selected line beside/below its light.
      // It never dims unselected lines or adds a ring around an LED strip.
      // Sampling stays at real pixel resolution. Only the final canvas drawing
      // is downsampled when a strip has more LEDs than visible screen pixels.
      const visible = row.type === 'RGBW' ? 1 : sharedPixels ? Math.ceil(row.pixels.length / drawStride)
        : Math.max(1, Math.min(row.pixels.length, Math.floor(length / 5)));
      const step = sharedPixels ? pixelPitch * drawStride : length / visible;
      // One material per unique colour in a row. Static lines reuse a single
      // gradient, while effects retain their independently sampled pixels.
      // No extra passes, offscreen canvas, shadows per layer or GPU filters.
      const materials = new Map();
      for (let i = 0; i < visible; i += 1) {
        const colour = (row.identificationPixels || row.pixels)[Math.min(row.pixels.length - 1, sharedPixels ? i * drawStride : Math.floor(i * row.pixels.length / visible))] || [0, 0, 0];
        const css = 'rgb(' + colour.join(',') + ')';
        context.fillStyle = diffuser(context,colour,css,vertical ? x : y,barHeight,vertical,materials);
        context.shadowColor = css;
        // The RGBW diffuser has a soft continuous halo. SPI needs a smaller
        // halo so the separate pixel lenses and dark gaps remain readable.
        const light = Math.max(...colour) / 255;
        context.shadowBlur = Math.min(row.type === 'RGBW' ? 10 : 3.5,barHeight * (row.type === 'RGBW' ? .9 : .32)) * light;
        const inset = row.type === 'RGBW' ? 0 : Math.min(1, step * 0.15);
        const cellLength = Math.min(step, length - i * step);
        const cellWidth = vertical ? barHeight : Math.max(0.25, cellLength - inset - gap);
        const cellHeight = vertical ? Math.max(0.25, cellLength - inset) : barHeight;
        const radius = Math.min(row.type === 'RGBW' ? 2 : 2.6, Math.min(cellWidth,cellHeight) * (row.type === 'RGBW' ? .18 : .26));
        rounded(context, x + (vertical ? 0 : i * step), y + (vertical ? i * step : 0),
          cellWidth, cellHeight, radius);
        context.fill();
      }
      context.shadowBlur = 0;
      const highlighted = frame.highlightedReceiverIds.includes(row.receiverId);
      if (highlighted) {
        context.fillStyle = '#f5f6f1';
        // An open accent marks position without changing the displayed colour
        // or introducing a rounded enclosure. Dense layouts use a short side
        // mark, leaving every real pixel and its spatial offset untouched.
        if (vertical) context.fillRect(Math.max(1, x - 5), y, 2, length);
        else if (showLabel && y + barHeight + 7 < height) context.fillRect(x, y + barHeight + 5, bw, 2);
        else context.fillRect(Math.max(1, x - 6), y, 3, barHeight);
      }
      context.fillStyle = row.selected ? '#eef1ec' : '#85948c';
      context.font = (row.selected ? '600 ' : '') + '10px system-ui';
      context.textAlign = vertical ? 'center' : 'left';
      // The light example is not a receiver list. Separate lines use only
      // their spatial order; a continuous strip has no per-receiver captions.
      // Pixel totals are actual active-output counts, never RGBW's sample size.
      if (options.labels !== false && !continuous && showLabel) {
        if (frame.rows.length > 1 || highlighted) context.fillText(String(options.lineNumbers?.[row.receiverId] || index + 1) + (highlighted ? ' · Actief' : ''),
          vertical ? x + barHeight / 2 : x, vertical ? compactVertical ? 12 : 19 : y - 12,
          vertical ? lane - 5 : Math.max(10, bw));
        if (row.type === 'SPI') {
          context.fillStyle = '#9fac9f'; context.font = '9px system-ui';
          context.textAlign = vertical ? 'center' : 'right';
          context.fillText(row.pixels.length + ' px', vertical ? x + barHeight / 2 : width - padding,
            vertical ? height - 10 : y - 12, vertical ? lane - 5 : Math.max(10, width - padding * 2 - 22));
        }
      }
    });
    if (canvas.dataset) canvas.dataset.lineHitRegions = JSON.stringify(hitRegions);
    return frame;
  }
  return Object.freeze({ catalog, geometry, sample, draw, rows, selected, normalizeState, opticalWhite, tunnelProjection, wallProjection,
    engineVersion: canonical.version, extensionVersion: extension.version, isLocalPreview: true });
}));
