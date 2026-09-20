/* V30 presentation adapter. No storage, timers, hardware calls or runtime patches.
 * Timing and spatial formulas come from the unmodified, vendored V21 engines.
 * Deliberate V30 corrections: W is neutral white; non-static speed 0 still moves.
 * This is a local preview, not a claim of calibrated light or firmware parity.
 */
(function (root, factory) {
  const canonical = typeof module === 'object' && module.exports
    ? require('./vendor/v21_animation_catalog.js') : root.AluvisionV21AnimationCatalog;
  const extension = typeof module === 'object' && module.exports
    ? require('./animation-engine.js') : root.LightningAnimationEngine;
  const api = factory(canonical, extension);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningPreview = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (canonical, extension) {
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
      category: family(effect) === 'Tunnel' ? 'tunnel' : wholeLine || targetType === 'RGBW' ? 'whole' : 'pixels',
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
  // original chases. Keep those actual formulas and wire variants here, not
  // look-alike aliases using an unrelated new engine. The legacy core below
  // is copied from tunedAnimationPixelCore + the v1817 line/ribbon adapter;
  // timing shaping comes from v20_smoothness.js. Only optical W is neutral.
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
    const MOTION_ENGINES = new Set([...movingFamilies,'LINE_WAVE','BREATHE','WARM','ALL']);
    const rgbHex = rgb;
    const clamp = (value, minimum = 0, maximum = 100) => Math.max(minimum, Math.min(maximum, Number.isFinite(Number(value)) ? Number(value) : minimum));
    const lerp = (a,b,t) => a.map((v,i) => Math.round(v+(b[i]-v)*t));
    const wrap = (a,b) => { const d = Math.abs(a-b); return Math.min(d,1-d); };
    const rgbwPreview = (channels,white=0) => channels.map(value => Math.round(255-(255-clamp(value,0,255))*(1-clamp(white,0,255)/255)));
    const effectWireVariant = effect => Number(effect?.[3]);
    function effectColorCount(effect) {
      const variant = effectWireVariant(effect);
      if ([98,99,102].includes(variant)) return 1;
      if ([100,103].includes(variant)) return 2;
      if (variant === 101) return 3;
      const name = (effect?.[0] || '').toLowerCase(), engine = effect?.[1];
      if (/multi|aurora|sequence|timeline|cascade/.test(name)) return 3;
      return /dual/.test(name) || ['GRADIENT','FLOW','ALTERNATE'].includes(engine) ? 2 : 1;
    }
    const v1817ClampLineDelay = (value,fallback=240) => Math.max(0,Math.min(5080,Math.round((Number.isFinite(Number(value))?Number(value):fallback)/40)*40));

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

function animationCyclesPerSecond(value){let speed=Math.max(0,Math.min(100,Number(value)||0));if(speed<=0)return 0;let normalized=speed/100;return .002+normalized*normalized*.80}

function thicknessAmount(distance,pixels,n,smooth=90){let d=Math.abs(distance)*n,widthPixels=Math.max(1,Math.min(n,Math.round(Number(pixels)||1))),coverage=Math.max(0,Math.min(1,widthPixels/2+.5-d));if(coverage<=0||coverage>=1)return coverage;let eased=coverage*coverage*(3-2*coverage),blend=Math.max(0,Math.min(1,Number(smooth??90)/100));return coverage+(eased-coverage)*blend}

function enabledRgbwPreview(s,index=0,background=false){let rgb=background?s.background||'#000000':s.colors?.[index]||'#000000',white=background?s.backgroundWhite||0:s.whiteChannels?.[index]||0,rgbOn=background?s.backgroundRgbEnabled!==false:!Array.isArray(s.rgbEnabled)||s.rgbEnabled[index]!==false,whiteOn=background?s.backgroundWhiteEnabled!==false:!Array.isArray(s.whiteEnabled)||s.whiteEnabled[index]!==false;return rgbwPreview(rgbOn?rgbHex(rgb):[0,0,0],whiteOn?white:0)}

function previewRgbwPalette(s){return (s.colors||['#873ada']).slice(0,s.colorCount||4).map((c,i)=>enabledRgbwPreview(s,i))}

function tunedAnimationPixelCore(s,u,time,index,n){
  let speed=(s.speed??18)/100,variant=s.variant??0,family=variant%6,cps=animationCyclesPerSecond(s.speed??18),elapsed=Math.max(0,time-(s.previewStartedAt||0)),raw=(((Number(s.phaseMs)||0)/1000+elapsed*cps)%1+1)%1,bounce=s.bounce?1-Math.abs(2*raw-1):raw,left=(s.direction||'right')==='left',phase=left?1-bounce:bounce,engine=s.engine||'CHASE',widthPixels=Math.max(1,Math.min(n,Number(s.widthPixels)||3)),objects=Math.max(1,Math.min(8,Math.round(Number(s.objectCount)||1))),spacing=Math.max(0,Math.min(100,Number(s.spacing??50)))/100,spread=Math.max(0,Math.min(100,Number(s.spread??50)))/100,trailLength=Math.max(0,Math.min(100,Number(s.trailLength??45)))/100,randomness=Math.max(0,Math.min(100,Number(s.randomness??25)))/100,colors=previewRgbwPalette(s),bg=s.backgroundOn===false?[0,0,0]:enabledRgbwPreview(s,0,true).map(v=>Math.round(v*(s.bgBrightness??10)/100)),amount=0,color=colors[Math.floor(u*colors.length)%colors.length],positions=[];
  let gradientAt=coordinate=>{let wrapped=((coordinate%1)+1)%1,scaled=wrapped*colors.length,i=Math.floor(scaled)%colors.length;return lerp(colors[i],colors[(i+1)%colors.length],scaled-Math.floor(scaled))},bandAt=coordinate=>colors[Math.min(colors.length-1,Math.floor(((coordinate%1+1)%1)*colors.length))],coverageAt=(position,pixels=widthPixels,circular=true)=>{let core=Math.max(1,Math.min(n,Math.round(Number(pixels)||1)));if(core>=n)return 1;let sample=u*n-.5,center=circular?((position%1+1)%1)*n+(core-1)*.5:Math.max(0,Math.min(1,position))*(n-core)+(core-1)*.5,delta=sample-center;if(circular)delta-=Math.round(delta/n)*n;let coverage=Math.max(0,Math.min(1,(core+1)*.5-Math.abs(delta)));if(coverage<=0||coverage>=1)return coverage;let eased=coverage*coverage*(3-2*coverage),blend=Math.max(0,Math.min(1,Number(s.smooth??90)/100));return coverage+(eased-coverage)*blend};
  let span=.18+spacing*.82;for(let k=0;k<objects;k++){let p=(phase+(objects===1?0:k/objects*span))%1;positions.push(p);if(s.mirror)positions.push((1-p+1)%1)}
  let atPositions=(pixels=widthPixels)=>{let value=0;positions.forEach(p=>value=Math.max(value,coverageAt(p,pixels,true)));return value};
  let lineCount=Math.max(1,Math.round(Number(s.lineCount)||1)),lineIndex=Math.max(0,Math.min(lineCount-1,Math.round(Number(s.lineIndex)||0))),row=lineCount>1?lineIndex/(lineCount-1):0,wireVariant=Number(s.variant),multiHandled=lineCount>1&&wireVariant>=90&&wireVariant<=97;
  if(multiHandled){
   let rowColor=colors[0],totalRowDelay=spread*.65,rowObjects=position=>{let best=0,span=.18+spacing*.82;for(let object=0;object<objects;object++){let p=(position+(objects===1?0:object*span/objects)+1)%1;best=Math.max(best,coverageAt(p,widthPixels,true));if(s.mirror)best=Math.max(best,coverageAt((1-p+1)%1,widthPixels,true))}return best};
   if(wireVariant===90||wireVariant===91){let ordered=wireVariant===91?lineCount-1-lineIndex:lineIndex,orderedRow=lineCount>1?ordered/(lineCount-1):0,rowPosition=orderedRow*totalRowDelay,distance=wrap(rowPosition,bounce)*lineCount,pulseRows=.72+(1-spacing),feather=.10+(s.smooth??90)*.0038,half=pulseRows*.5,core=Math.max(0,half-feather),q=distance<=core?1:distance>=half+feather?0:1-(distance-core)/Math.max(.001,2*feather);amount=q*q*(3-2*q);color=rowColor}
   else if(wireVariant===92){let progress=1-Math.abs(2*raw-1),ordered=(s.direction||'right')==='left'?lineCount-1-lineIndex:lineIndex,orderedRow=lineCount>1?ordered/(lineCount-1):0,feather=.04+(s.smooth??90)*.0012,trigger=feather+orderedRow*totalRowDelay,q=Math.max(0,Math.min(1,(progress-trigger+feather)/Math.max(.001,2*feather)));amount=q*q*(3-2*q);color=rowColor}
   else if(wireVariant===93){let rowDelay=row*totalRowDelay,coordinate=u-phase+rowDelay,wave=.5+.5*Math.sin(coordinate*Math.PI*2*objects),exponent=.55+(100-(s.smooth??90))*.012;amount=Math.pow(wave,exponent);let q=((coordinate+row*.17+1)%1)*colors.length,i=Math.floor(q)%colors.length;color=lerp(colors[i],colors[(i+1)%colors.length],q-Math.floor(q))}
   else if(wireVariant===94){let rowDelay=row*totalRowDelay;amount=rowObjects((phase-rowDelay+1)%1);color=rowColor}
   else if(wireVariant===95){let center=(lineCount-1)*.5,nearest=lineCount%2?0:.5,maximum=Math.max(nearest,center),distance=maximum>nearest?(Math.abs(lineIndex-center)-nearest)/(maximum-nearest):0,progress=1-Math.abs(2*raw-1),feather=.04+(s.smooth??90)*.0012,orderedDistance=(s.direction||'right')==='left'?1-distance:distance,trigger=feather+orderedDistance*totalRowDelay,q=Math.max(0,Math.min(1,(progress-trigger+feather)/Math.max(.001,2*feather)));amount=q*q*(3-2*q);let gradient=distance*.999*colors.length,i=Math.floor(gradient)%colors.length;color=lerp(colors[i],colors[(i+1)%colors.length],gradient-Math.floor(gradient))}
   else if(wireVariant===96){let delayedPhase=(phase-row*totalRowDelay+1)%1,rowPhase=lineIndex%2?(1-delayedPhase+1)%1:delayedPhase;amount=rowObjects(rowPhase);color=rowColor}
   else {amount=rowObjects(phase);let q=((u-phase+1)%1)*colors.length,i=Math.floor(q)%colors.length;color=lerp(colors[i],colors[(i+1)%colors.length],q-Math.floor(q))}
  }
  else if(engine==='STATIC'){amount=1;color=colors[Math.min(colors.length-1,Math.floor(u*colors.length))]}
  else if(engine==='GRADIENT'){let scale=1+spread*3,q=((u*scale-(family===0?0:phase)+1)%1)*colors.length,i=Math.floor(q)%colors.length;color=lerp(colors[i],colors[(i+1)%colors.length],q-Math.floor(q));amount=1}
  else if(engine==='BREATHE'||engine==='ALL'){let localPhase=u*Math.PI*2*spread,pulse=.5+.5*Math.sin(raw*Math.PI*2+localPhase);amount=pulse;color=gradientAt(u)}
  else if(engine==='WARM'){let white=s.whiteEnabled?.[0]===false?0:Math.max(1,Math.min(255,Number(s.whiteChannels?.[0])||255)),warm=.5+.5*Math.sin(raw*Math.PI*2+u*Math.PI*2*.72);warm=warm*warm*(3-2*warm);amount=1;color=rgbwPreview([white*.45*warm,white*.22*warm,0],white*(1-.48*warm))}
  else if(engine==='SPARKLE'){let cluster=Math.floor(index/Math.max(1,widthPixels)),sparkleSpeed=Math.max(0,Math.min(100,Number(s.speed??18))),tick=sparkleSpeed===0?0:Math.floor(raw*(24+sparkleSpeed*.76)),h=((cluster*1103515245+tick*12345+variant*7919)>>>0)%1000,threshold=Math.min(820,8+Math.round(randomness*100)*2+objects*9);amount=h<threshold?1:0;color=bandAt(cluster/7)}
  else if(engine==='WAVE'||engine==='FLOW'){amount=atPositions(widthPixels);color=gradientAt(u*(1+spread*2)-phase)}
  else if(engine==='SCANNER'){let position=phase;amount=coverageAt(position,widthPixels,false);if(s.mirror)amount=Math.max(amount,coverageAt(1-position,widthPixels,false));color=gradientAt(phase);if(trailLength>0){let d=left?(u-position+1)%1:(position-u+1)%1;amount=Math.max(amount,Math.max(0,1-d*n/Math.max(1,widthPixels*(1+trailLength*100/12)))*.72)}}
  else if(engine==='MIRROR'||engine==='DUAL'){let copies=Math.max(2,objects);for(let k=0;k<copies;k++){let p=(phase+k/copies*(.35+spread*.65))%1;amount=Math.max(amount,coverageAt(p,widthPixels,true),coverageAt((1-p+1)%1,widthPixels,true))}color=gradientAt(u+phase)}
  else if(engine==='ALTERNATE'){let band=Math.max(1,Math.round(widthPixels)),gap=Math.max(1,Math.round(band*(.3+spacing*2.7))),period=band+gap,repeats=Math.max(1,Math.round(n/period)),pixel=u*n-.5,movingX=pixel-phase*repeats*period,local=((movingX%period)+period)%period,center=(band-1)/2,signed=local-center;if(signed>period/2)signed-=period;else if(signed<-period/2)signed+=period;amount=thicknessAmount(Math.abs(signed)/n,band,n,s.smooth);let nearest=Math.round((movingX-center)/period),paletteIndex=((nearest%colors.length)+colors.length)%colors.length;color=colors[paletteIndex]}
  else if(engine==='CASCADE'||engine==='SEQUENCE'){let q=(u-phase+1)%1;amount=atPositions(widthPixels);color=colors[Math.min(Math.floor(q*objects),objects-1)%colors.length];if(engine==='CASCADE')amount*=.60+q*.40}
  else if(engine==='COMET'){positions.forEach(p=>{let head=coverageAt(p,widthPixels,true),d=left?(u-p+1)%1:(p-u+1)%1,tail=Math.max(0,1-d*n/Math.max(1,widthPixels*(1.4+trailLength*9)));amount=Math.max(amount,head,tail*.88)});color=gradientAt(phase)}
  else {amount=atPositions(widthPixels);color=gradientAt(phase)}
  let bright=Math.max(0,Math.min(1,Number(s.brightness??75)/100)),coverage=Math.max(0,Math.min(1,amount));if(s.backgroundOn===false)return lerp(bg,color,coverage).map(value=>Math.round(value*bright));return lerp(bg,color.map(value=>value*bright),coverage).map(value=>Math.round(value))
 }

function v1817PositiveModulo(value,divisor=1){return ((value%divisor)+divisor)%divisor}

function v1817LineOrder(current,lineIndex,lineCount,variant){let count=Math.max(1,lineCount),index=Math.max(0,Math.min(count-1,lineIndex)),reverse=current?.direction==='left';if(variant===90)return index;if(variant===91)return count-1-index;if(variant===16){let pairs=Math.max(1,Math.ceil(count/2)),pair=Math.floor(index/2);return reverse?pairs-1-pair:pair}if(variant===95||variant===13||variant===14){let centre=(count-1)/2,nearest=count%2?0:.5,rank=Math.max(0,Math.round(Math.abs(index-centre)-nearest)),maximum=Math.max(0,Math.ceil(count/2)-1),fromCentre=rank;if(variant===14)fromCentre=maximum-rank;return reverse?maximum-fromCentre:fromCentre}return reverse?count-1-index:index}

function v1817Palette(current,count=4){let palette=previewRgbwPalette(current).slice(0,Math.max(1,count));return palette.length?palette:[[255,255,255]]}

function v1817PaletteAt(palette,phase,smooth=true){let scaled=v1817PositiveModulo(phase,1)*palette.length,index=Math.floor(scaled)%palette.length,mix=scaled-Math.floor(scaled);if(smooth)mix=mix*mix*(3-2*mix);return lerp(palette[index],palette[(index+1)%palette.length],mix)}

function v1817PaletteBand(palette,phase){return palette[Math.floor(v1817PositiveModulo(phase,1)*palette.length)%palette.length]}

function v1817WholeLinePixel(current,time,variant){let count=Math.max(1,Number(current.lineCount)||1),index=Math.max(0,Math.min(count-1,Number(current.lineIndex)||0)),speed=Math.max(0,Math.min(100,Number(current.speed)||0)),cycles=animationCyclesPerSecond(speed),started=Number(current.previewStartedAt),elapsed=Number.isFinite(started)&&started>=0&&started<=time?time-started:0,order=v1817LineOrder(current,index,count,variant),delay=v1817ClampLineDelay(current.lineDelayMs)/1000,timeline=elapsed*cycles+(Number(current.phaseMs)||0)/1000,shifted=timeline-order*delay*cycles,raw=v1817PositiveModulo(current.direction==='left'?-shifted:shifted,1),palette=v1817Palette(current,4),amount=1,color=palette[0],smooth=Math.max(0,Math.min(1,Number(current.smooth??90)/100));
  if(variant===98)amount=.10+.90*(.5-.5*Math.cos(raw*Math.PI*2));
  else if(variant===99){let triangle=1-Math.abs(2*raw-1);amount=triangle*triangle*(3-2*triangle)}
  else if(variant===100)color=v1817PaletteAt(palette,raw,false);
  else if(variant===101)color=v1817PaletteAt(palette,raw,true);
  else if(variant===102){let onFraction=.04+.22*smooth;amount=raw<onFraction?1:0;color=v1817PaletteBand(palette,raw)}
  let background=current.backgroundOn===false?[0,0,0]:enabledRgbwPreview(current,0,true).map(channel=>Math.round(channel*(Number(current.bgBrightness??10)/100))),brightness=Math.max(0,Math.min(1,Number(current.brightness??100)/100)),coverage=Math.max(0,Math.min(1,amount));if(current.backgroundOn===false)return lerp(background,color,coverage).map(channel=>Math.round(channel*brightness));return lerp(background,color.map(channel=>channel*brightness),coverage).map(channel=>Math.round(channel))
 }

function v20WarmRibbonPixel(current,u,time,pixelCount=0){
  let n=Math.max(1,Number(pixelCount)||Number(current.groupPixels)||60),speed=Math.max(0,Math.min(100,Number(current.speed)||0)),cycles=animationCyclesPerSecond(speed),started=Number(current.previewStartedAt),elapsed=Number.isFinite(started)&&started>=0&&started<=time?time-started:0,raw=v1817PositiveModulo((Number(current.phaseMs)||0)/1000+elapsed*cycles,1),reverse=current.direction==='left',head=reverse?1-raw:raw,behind=v1817PositiveModulo(reverse?u-head:head-u,1)*n,width=Math.max(1,Math.min(n,Number(current.widthPixels)||4)),trail=Math.max(0,Math.min(100,Number(current.trailLength??78))),ribbon=Math.max(width,Math.min(Math.max(1,n-.5),n*trail/100)),smooth=Math.max(0,Math.min(1,Number(current.smooth??92)/100)),fade=Math.max(width*(.35+1.15*smooth),ribbon*(.04+.08*smooth)),warmZone=Math.min(ribbon,Math.max(fade*2,width*2)),remaining=ribbon-behind,tailGate=Math.max(0,Math.min(1,(remaining+.5)/Math.max(.5,fade))),headGate=Math.max(0,Math.min(1,(behind+.5)/(.45+1.0*smooth)));tailGate=tailGate*tailGate*(3-2*tailGate);headGate=headGate*headGate*(3-2*headGate);let warmMix=Math.max(0,Math.min(1,(behind-(ribbon-warmZone))/Math.max(.5,warmZone)));warmMix=warmMix*warmMix*(3-2*warmMix);let palette=v1817Palette(current,2),color=lerp(palette[0],palette[1]||palette[0],warmMix),amount=headGate*tailGate,background=current.backgroundOn===false?[0,0,0]:enabledRgbwPreview(current,0,true).map(channel=>Math.round(channel*(Number(current.bgBrightness??10)/100))),brightness=Math.max(0,Math.min(1,Number(current.brightness??100)/100)),composite=current.backgroundOn===false?lerp(background,color,amount).map(channel=>Math.round(channel*brightness)):lerp(background,color.map(channel=>channel*brightness),amount).map(channel=>Math.round(channel));return composite
 }

function smoothMix(value) {
    const normalized = clamp(value) / 100;
    // Keep the lower half deliberately stepped for a useful A/B comparison,
    // then converge quickly toward true continuous motion. This mirrors the
    // receiver curve, so 75% already feels fluid and 100% remains exact.
    return normalized < .5
      ? 4 * normalized * normalized * normalized
      : 1 - 4 * (1 - normalized) * (1 - normalized) * (1 - normalized);
  }

function positiveModulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

function interpolateLedPhase(totalPhase, smoothness, pixelCount, maximumStops = 32) {
    const phase = Number(totalPhase);
    if (!Number.isFinite(phase)) return 0;
    const blend = smoothMix(smoothness);
    if (blend >= 1) return phase;
    const pixels = Math.max(1, Math.round(Number(pixelCount) || 1));
    const stops = Math.max(2, Math.round(Number(maximumStops) || 32));
    const stride = Math.max(1, Math.ceil(pixels / stops));
    const cycle = Math.floor(phase);
    const withinCycle = positiveModulo(phase, 1);
    const firstPixelInStep = Math.floor((withinCycle * pixels) / stride) * stride;
    const snappedPixel = Math.min(pixels - 0.5, firstPixelInStep + 0.5);
    const snapped = cycle + snappedPixel / pixels;
    return snapped + (phase - snapped) * blend;
  }

function interpolateCyclePhase(totalPhase, smoothness, phaseSteps = 16) {
    const phase = Number(totalPhase);
    if (!Number.isFinite(phase)) return 0;
    const blend = smoothMix(smoothness);
    if (blend >= 1) return phase;
    const steps = Math.max(2, Math.round(Number(phaseSteps) || 16));
    const cycle = Math.floor(phase);
    const withinCycle = positiveModulo(phase, 1);
    const stepped = cycle + Math.floor(withinCycle * steps) / steps;
    return stepped + (phase - stepped) * blend;
  }

function adjustedPreviewTime(state, time, pixelCount, cyclesPerSecond, maximumStops = 32) {
    const now = Number(time);
    const started = Number(state?.previewStartedAt);
    const rate = Number(cyclesPerSecond);
    const smoothness = clamp(state?.smooth ?? 100);
    if (!Number.isFinite(now) || !Number.isFinite(started) || !Number.isFinite(rate) || rate <= 0 || smoothness >= 100) return time;
    const elapsed = Math.max(0, now - started);
    const phaseOffset = (Number(state?.phaseMs) || 0) / 1000;
    const continuousPhase = phaseOffset + elapsed * rate;
    const displayPhase = interpolateLedPhase(continuousPhase, smoothness, pixelCount, maximumStops);
    return started + Math.max(0, (displayPhase - phaseOffset) / rate);
  }

function adjustedCyclePreviewTime(state, time, cyclesPerSecond, phaseSteps = 16) {
    const now = Number(time);
    const started = Number(state?.previewStartedAt);
    const rate = Number(cyclesPerSecond);
    const smoothness = clamp(state?.smooth ?? 100);
    if (!Number.isFinite(now) || !Number.isFinite(started) || !Number.isFinite(rate) || rate <= 0 || smoothness >= 100) return time;
    const elapsed = Math.max(0, now - started);
    const phaseOffset = (Number(state?.phaseMs) || 0) / 1000;
    const continuousPhase = phaseOffset + elapsed * rate;
    const displayPhase = interpolateCyclePhase(continuousPhase, smoothness, phaseSteps);
    return started + Math.max(0, (displayPhase - phaseOffset) / rate);
  }

function shouldShapeSpiMotion(state) {
    const variant = Number(state?.variant);
    const engine = String(state?.engine || '').toUpperCase();
    if (variant === 102 || engine === 'STATIC' || engine === 'SPARKLE') return false;
    if (variant >= 98 && variant <= 120) return true;
    return MOTION_ENGINES.has(engine);
  }

function usesCyclePhaseSteps(state) {
    const variant = Number(state?.variant);
    if ((variant >= 98 && variant <= 101) || (variant >= 104 && variant <= 108)) return true;
    return ['BREATHE', 'GRADIENT', 'WARM', 'ALL'].includes(String(state?.engine || '').toUpperCase());
  }

    function baseSample(state,u,time,index,n) {
      const center=tunedAnimationPixelCore(state,u,time,index,n), speed=Number(state.speed??18), smooth=Number(state.smooth??90), engine=state.engine||'CHASE';
      if(widthEngines.has(engine)||speed>25||smooth<55||['STATIC','SPARKLE','BREATHE','WARM'].includes(engine))return center;
      const delta=.28/n, before=tunedAnimationPixelCore(state,u-delta,time,index,n), after=tunedAnimationPixelCore(state,u+delta,time,index,n);
      const mix=Math.max(45,Math.min(135,45+(smooth-55)*2))/255;
      return center.map((v,i)=>Math.round(v*(1-mix)+(before[i]+after[i])*.5*mix));
    }
    function sample(state,u,time,index,n) {
      const variant=Number(state.variant);
      if (shouldShapeSpiMotion(state)) {
        const rate=animationCyclesPerSecond(state.speed);
        time=usesCyclePhaseSteps(state) ? adjustedCyclePreviewTime(state,time,rate,16) : adjustedPreviewTime(state,time,n,rate,32);
      }
      if (variant===103) return v20WarmRibbonPixel(state,u,time,n);
      // These five are ordinary whole-line effects, not tunnel relays.
      // Together therefore shares one phase, including old saved states that
      // still contain a lineDelayMs value. Spatial delays belong to tunnels.
      if (variant>=98 && variant<=102) return v1817WholeLinePixel({...state,lineIndex:0,lineCount:1,lineDelayMs:0},time,variant);
      if (variant>=90 && variant<=97 && Number(state.lineCount)>1 && state.lineDelayMs!=null) {
        const order=v1817LineOrder(state,Number(state.lineIndex)||0,Number(state.lineCount)||1,variant);
        return baseSample({...state,spread:0,previewStartedAt:(Number(state.previewStartedAt)||0)+order*v1817ClampLineDelay(state.lineDelayMs)/1000},u,time,index,n);
      }
      return baseSample(state,u,time,index,n);
    }
    function catalog() {
      return effects.filter(effect=>effect[1]!=='STATIC').map(effect=>{
        const [name,engine,,variant,overrides={}]=effect;
        const count=effectColorCount(effect);
        const palette=variant===103 ? ['#FFF4D4','#F3A24D'] : ['#C94E46','#F0B95F','#669CC6'];
        const state={animation:name,engine,variant,legacySpi:true,previewStartedAt:0,phaseMs:0,
          colors:palette.slice(0,count),whiteChannels:Array(count).fill(engine==='WARM'?255:0),
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
        const category=variant>=90&&variant<=97?'tunnel':variant>=98&&variant<=102?'whole':'pixels';
        const entryFamily=category==='tunnel'?'Tunnel':family({engine});
        return {id:'spi-'+engine.toLowerCase()+'-'+variant,name,family:entryFamily,state,
          category,legacy:true,source:'v21-inline-catalog',paletteEditable:true,
          colorCountRange:{min:1,max:engine==='WARM'||[90,91,92,94,96,98,99,102].includes(variant)?1:variant===103?2:4},
          backgroundEditable:variant===103||!['STATIC','GRADIENT','WARM','ALL'].includes(engine)&&![100,101].includes(variant),
          description:category==='tunnel'?'Een bestaande beweging verdeeld over meerdere LED Lines.':
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
    return preserved.concat(extension.catalog(type));
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
      (selection.kind === 'receiver' && selection.receiverId === receiver.id);
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
    if (background) {
      // Foreground and background are two independently dimmed light colours.
      // Applying foreground brightness after compositing also dims the
      // background (and its W channel), making its own slider misleading.
      const front = opticalWhite({ ...sample, background: null, amount: 1 });
      const back = opticalWhite({ ...background, amount: 1 });
      return back.map((channel, index) => Math.round(channel + (front[index] - channel) * amount));
    }
    const backgroundWhite = background ? background.white * background.brightness : 0;
    const white = (backgroundWhite + (clamp(sample.white, 0, 255) - backgroundWhite) * amount) / 255;
    return sample.rgb.map((channel, index) => {
      const base = background ? background.rgb[index] * background.brightness : 0;
      const linear = base + (clamp(channel, 0, 255) - base) * amount;
      return Math.round(clamp((255 - (255 - linear) * (1 - white)) *
        (sample.brightness == null ? 1 : sample.brightness), 0, 255));
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
      if (receiver.type === 'RGBW') return [extension.sample({ ...input, pixelIndex: 0, globalPixel: geo.offset })];
      return geo.outputs.flatMap(output => Array.from({ length: output.pixels }, (_, pixel) => {
        const oriented = output.reversed ? output.pixels - 1 - pixel : pixel;
        return extension.sample({ ...input, pixelIndex: output.localOffset + oriented, globalPixel: output.offset + oriented });
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
    const group = geometry(receivers, options.layout);
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
          individuallySelected: options.selection?.kind === 'receiver' && selected(receiver, options.selection),
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
  function draw(canvas, options = {}) {
    const frame = rows(options);
    if (canvas.dataset) {
      canvas.dataset.highlightedReceiverIds = frame.highlightedReceiverIds.join(',');
      canvas.dataset.identifyingReceiverIds = frame.identifyingReceiverIds.join(',');
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
    const byReceiver = options.presentation === 'receivers' || frame.rows.some(row => row.category === 'tunnel');
    const vertical = options.layout === 'vertical' && options.presentation !== 'receivers';
    const continuous = options.layout === 'continuous' && !byReceiver && frame.rows.every(row => row.type === 'SPI');
    const padding = Math.min(18, width / 8);
    const maxRowPixels = Math.max(1, ...frame.rows.filter(row => row.type === 'SPI').map(row => row.pixels.length));
    context.font = '11px system-ui'; context.textBaseline = 'middle';
    frame.rows.forEach((row, index) => {
      const lane = vertical ? (width - padding * 2) / frame.rows.length : Math.max(1, height - 16) / frame.rows.length;
      const barHeight = continuous ? Math.min(12, height / 4) : Math.max(0.5, Math.min(12, lane * 0.4));
      const showLabel = continuous ? false : vertical ? lane >= 48 : lane >= 30;
      const continuousFraction = row.pixels.length / Math.max(1, frame.geometry.totalPixels);
      const continuousOffset = frame.geometry.receivers[index].offset / Math.max(1, frame.geometry.totalPixels);
      const x = continuous ? padding + (width - padding * 2) * continuousOffset : vertical ? padding + lane * index + lane / 2 - barHeight / 2 : padding;
      const y = continuous ? (height - barHeight) / 2 : vertical ? Math.min(showLabel ? 38 : 14, height / 3)
        : 8 + lane * index + (lane - barHeight) / 2 + (showLabel ? 4 : 0);
      const availableLength = Math.max(0.5, continuous ? (width - padding * 2) * continuousFraction
        : vertical ? height - y - Math.min(24, height / 4) : width - padding * 2);
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
        if (frame.rows.length > 1 || highlighted) context.fillText(String(index + 1) + (highlighted ? ' · Actief' : ''),
          vertical ? x + barHeight / 2 : x, vertical ? 19 : y - 12,
          vertical ? lane - 5 : Math.max(10, bw));
        if (row.type === 'SPI') {
          context.fillStyle = '#9fac9f'; context.font = '9px system-ui';
          context.textAlign = vertical ? 'center' : 'right';
          context.fillText(row.pixels.length + ' px', vertical ? x + barHeight / 2 : width - padding,
            vertical ? height - 10 : y - 12, vertical ? lane - 5 : Math.max(10, width - padding * 2 - 22));
        }
      }
    });
    return frame;
  }
  return Object.freeze({ catalog, geometry, sample, draw, rows, selected, normalizeState, opticalWhite,
    engineVersion: canonical.version, extensionVersion: extension.version, isLocalPreview: true });
}));
