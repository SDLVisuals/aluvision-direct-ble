/* Shared tunnel timing contract: one pass, ordered lines, then a clean restart.
 * Delay is the actual time between adjacent line events, not a phase offset.
 * Speed controls each event's fade/travel duration. All outputs share a clock.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AluvisionTunnelEngine = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var RGBW = {5:'pulse',6:'tail',7:'glow',8:'chase',9:'colour',10:'colour',11:'strobe',
    12:'ripple',13:'center',14:'outside',15:'alternate',16:'double',21:'glow',22:'echo',
    23:'colour',24:'cross',26:'bounce',27:'build',28:'depth-comet',29:'portal',
    30:'colour-step',31:'breathe-wave'};
  var SPI = {104:'glow',105:'bounce',106:'double',107:'colour',108:'echo',109:'build',110:'cross',111:'tail',128:'glow'};
  // Same line-level effect, separate wire IDs. Existing pixel variants retain
  // their meaning; no saved scene is silently remapped to a different effect.
  Object.keys(RGBW).forEach(function (variant) { SPI[150+Number(variant)] = RGBW[variant]; });
  function sharedRgbwVariant(variant) { var value=Number(variant)-150; return RGBW[value] ? value : null; }
  function sharedSpiVariant(variant) { return RGBW[Number(variant)] ? 150+Number(variant) : null; }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, Number(x) || 0)); }
  function ease(x) { x = clamp(x, 0, 1); return x*x*(3-2*x); }
  function kind(family, variant) { return (family === 'SPI' ? SPI : RGBW)[Number(variant)] || ''; }
  function curve(smooth) {
    var x = clamp(smooth, 0, 100)/100;
    return x < 0.5 ? 4*x*x*x : 1-4*Math.pow(1-x,3);
  }
  function stepsFor(shape, lines) {
    return shape === 'center' || shape === 'outside' || shape === 'portal' ? Math.ceil(lines/2)
      : shape === 'alternate' ? Math.min(2,lines) : lines;
  }
  function plan(shape, lineCount, speed, delayMs) {
    var lines = Math.max(1, Math.floor(Number(lineCount) || 1));
    var steps = stepsFor(shape, lines);
    var delay = lines > 1 ? Math.round(clamp(delayMs,0,5080)/40)*0.04 : 0;
    var normalized = clamp(speed,0,100)/100;
    // Keep the moving front around one or two rows wide, even at the lowest
    // speed. With no row delay, use a normal synchronous whole-line fade.
    var duration = delay > 0 ? Math.max(0.06,delay*(0.7+1.2*Math.pow(1-normalized,2)))
      : 0.24+4*Math.pow(1-normalized,3);
    // A tunnel needs visible travel through DEPTH, not just isolated flashes.
    // These variants intentionally overlap successive rows but never advance
    // a row's start: 5000 ms remains exactly five seconds between entries.
    if (delay > 0 && shape === 'depth-comet') duration += delay*2.4;
    if (delay > 0 && shape === 'breathe-wave') duration += delay*1.65;
    var span = (steps-1)*delay;
    var echo = ['echo','double','ripple'].includes(shape) ? duration*0.65+delay : 0;
    var clear = span+duration*1.65;
    var period = ['build','portal','colour-step'].includes(shape) ? clear+span+duration*1.25
      : shape === 'bounce' ? 2*span+duration*2.25 : span+duration*1.25+echo;
    return {lines:lines,steps:steps,delay:delay,duration:duration,span:span,echo:echo,clear:clear,period:period};
  }
  function rate(family, variant, lineCount, speed, delayMs) {
    var shape = kind(family,variant);
    return !shape || Number(speed) <= 0 ? 0 : 1/plan(shape,lineCount,speed,delayMs).period;
  }
  function orderFor(shape,line,lines,reverse) {
    var steps = stepsFor(shape,lines);
    var order = line;
    if (shape === 'center' || shape === 'outside' || shape === 'portal') {
      order = Math.round(Math.max(0,Math.abs(line-(lines-1)/2)-(lines%2 ? 0 : 0.5)));
      if (shape === 'outside') order = steps-1-order;
    } else if (shape === 'alternate') order = line%2;
    return reverse ? steps-1-order : order;
  }
  function progress(time,duration,smooth) {
    var p = clamp(time/duration,0,1);
    var stepped = Math.floor(p*12)/12;
    return stepped+(p-stepped)*curve(smooth);
  }
  function pulse(time,duration,smooth,shape) {
    if (time <= 0 || time >= duration) return 0;
    var p = progress(time,duration,smooth);
    if (shape === 'strobe') return p > 0.06 && p < 0.22 ? 1 : 0;
    if (shape === 'depth-comet') return ease(p/0.10)*ease((1-p)/0.95);
    if (shape === 'tail' || shape === 'colour') return ease(p/0.18)*ease((1-p)/0.72);
    if (shape === 'chase') return ease(p/0.20)*ease((0.85-p)/0.24);
    var sine = Math.sin(p*Math.PI);
    return sine*sine;
  }
  function colourTravel(position, shape) {
    // Hold the first/last selected colours while the light is visible. Never
    // wrap the last slot back to the first at the end of a single line event.
    var start = shape === 'strobe' ? 0.08 : 0.12;
    var end = shape === 'strobe' ? 0.20 : shape === 'chase' ? 0.70 : 0.78;
    return clamp((position-start)/(end-start),0,1);
  }
  function paletteSpec(sample, count, opposite) {
    count = Math.floor(clamp(count,1,4));
    if (Number.isInteger(sample.paletteStep) && sample.paletteStep >= 0) {
      var selected = sample.paletteStep % count;
      return {first:selected,second:selected,mix:0};
    }
    var position = clamp(sample.colourPhase,0,1);
    var scaled = (opposite ? 1-position : position)*(count-1);
    var first = Math.min(count-1,Math.floor(scaled));
    return {first:first,second:Math.min(count-1,first+1),mix:ease(scaled-first)};
  }
  function sample(family,variant,lineIndex,lineCount,phase,speed,delayMs,smooth,reverse,echoLevel) {
    var shape = kind(family,variant);
    var timing = plan(shape,lineCount,speed,delayMs);
    var line = clamp(Math.floor(Number(lineIndex)||0),0,timing.lines-1);
    var order = orderFor(shape,line,timing.lines,reverse);
    var time = (((Number(phase)||0)%1+1)%1)*timing.period;
    var local = time-order*timing.delay;
    var p = progress(local,timing.duration,smooth);
    var a = pulse(local,timing.duration,smooth,shape);
    var b = 0;
    var colour = colourTravel(p,shape);
    if (shape === 'echo' || shape === 'double' || shape === 'ripple') {
      var gain = shape === 'double' ? 0.9 : shape === 'ripple' ? 0.65 : 0.25+0.45*clamp(echoLevel,0,100)/100;
      b = pulse(local-timing.echo,timing.duration,smooth,'glow')*gain;
      var echoColour = 1-colourTravel(progress(local-timing.echo,timing.duration,smooth),'glow');
      if (a+b > 0) colour += (echoColour-colour)*b/(a+b);
    } else if (shape === 'cross') {
      var otherOrder = timing.steps-1-order;
      var otherLocal = time-otherOrder*timing.delay;
      b = pulse(otherLocal,timing.duration,smooth,'glow');
      // Coincident waves are one full palette journey, not two opposite
      // journeys averaged into a permanently fixed middle colour.
      if (a+b > 0 && timing.delay > 0 && otherOrder !== order) {
        var otherProgress = progress(otherLocal,timing.duration,smooth);
        var weight = b/(a+b);
        colour += (1-colourTravel(otherProgress,'glow')-colour)*weight;
        p += (otherProgress-p)*weight;
      }
    } else if (shape === 'bounce') {
      var back = time-(timing.span+timing.duration)-(timing.steps-1-order)*timing.delay;
      b = pulse(back,timing.duration,smooth,'chase');
      if (b>a+0.000001) { colour=1-colourTravel(progress(back,timing.duration,smooth),'chase'); p=1-progress(back,timing.duration,smooth); }
    } else if (shape === 'build' || shape === 'portal' || shape === 'colour-step') {
      // Portals open from the centre then close from the outside. A colour
      // staircase instead retains the selected slot on each complete row.
      var releaseOrder = shape === 'portal' ? timing.steps-1-order : order;
      a = ease(progress(local,timing.duration,smooth)) *
        (1-ease(progress(time-timing.clear-releaseOrder*timing.delay,timing.duration,smooth)));
    }
    return {amount:clamp(Math.max(a,b),0,1),colourPhase:colour,progress:p,order:order,
      period:timing.period,delay:timing.delay,kind:shape,
      paletteStep:shape === 'colour-step' ? order : -1};
  }
  return Object.freeze({kind:kind,plan:plan,rate:rate,sample:sample,orderFor:orderFor,paletteSpec:paletteSpec,
    sharedRgbwVariant:sharedRgbwVariant,sharedSpiVariant:sharedSpiVariant});
}));
