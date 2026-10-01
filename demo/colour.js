(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LightningColour = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  function hsv(h, s, v = 1) {
    h = ((Number(h) % 360) + 360) % 360; s = clamp(s, 0, 1); v = clamp(v, 0, 1);
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    const sectors = [[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]];
    return sectors[Math.floor(h / 60)].map(n => Math.round((n + m) * 255));
  }
  function toHsv(rgb) {
    const [r,g,b] = rgb.map(n => clamp(n, 0, 255) / 255);
    const max = Math.max(r,g,b), min = Math.min(r,g,b), delta = max - min;
    let h = 0;
    if (delta) h = max === r ? 60 * (((g-b)/delta) % 6) : max === g ? 60 * ((b-r)/delta + 2) : 60 * ((r-g)/delta + 4);
    return { h: (h + 360) % 360, s: max ? delta / max : 0, v: max };
  }
  // The canvas and pointer use exactly the same angle: red at the right edge.
  function fromPoint(x, y, size) {
    const dx = x-size/2, dy = y-size/2;
    return hsv(Math.atan2(dy, dx) * 180 / Math.PI, Math.hypot(dx,dy)/(size/2));
  }
  function position(rgb) {
    const {h,s} = toHsv(rgb), a = h * Math.PI / 180;
    return {x: 50 + Math.cos(a)*s*50, y: 50 + Math.sin(a)*s*50};
  }
  function hex(rgb) { return '#' + rgb.map(n => Math.round(clamp(n,0,255)).toString(16).padStart(2,'0')).join('').toUpperCase(); }
  function mixWhite(rgb, white = 0) { const w=clamp(white,0,255)/255;return rgb.map(channel=>Math.round(255-(255-clamp(channel,0,255))*(1-w))); }
  // Receiver channel values are linear PWM, not already encoded screen RGB.
  // Convert only at the presentation boundary, after channel mixing/dimming.
  // One shared LUT keeps the wheel, swatches and every preview consistent.
  // This is a standard display model, not a measured LED/screen calibration.
  const screenTransfer=Array.from({length:256},(_,channel)=>{
    const linear=channel/255;
    return Math.round(255*(linear<=.0031308?linear*12.92:1.055*Math.pow(linear,1/2.4)-.055));
  });
  function screenRGB(rgb) { return rgb.map(channel=>screenTransfer[Math.round(clamp(channel,0,255))]); }
  function screenHex(rgb,white=0) { return hex(screenRGB(mixWhite(rgb,white))); }
  // A practical RGB/W mix, not a measured colour temperature. Follow the
  // existing white-mix recipes (red + a little green, less W when warmer),
  // but share one 255-unit channel budget: this shortcut never adds full RGB
  // on top of full W. The separate brightness control remains authoritative.
  function warmWhite(warmth = 50) {
    const amount=Math.round(clamp(warmth,0,100));
    const from=amount<=50?[0,0,0,255]:[64,10,0,220];
    const to=amount<=50?[64,10,0,220]:[255,45,0,128];
    const t=amount<=50?amount/50:(amount-50)/50;
    const mix=from.map((channel,index)=>channel+(to[index]-channel)*t);
    const scale=255/mix.reduce((sum,channel)=>sum+channel,0);
    const r=Math.round(mix[0]*scale),g=Math.round(mix[1]*scale);
    return [r,g,0,255-r-g];
  }
  function warmthOf(channels) {
    if(!Array.isArray(channels)||channels.length!==4)return null;
    for(let warmth=0;warmth<=100;warmth++)if(warmWhite(warmth).every((channel,index)=>channel===channels[index]))return warmth;
    return null;
  }
  function state(rgb, white = 0) {
    const [r,g,b] = rgb.map(n => Math.round(clamp(n,0,255))), w = Math.round(clamp(white,0,255));
    return {r,g,b,w,colors:[hex([r,g,b])],whiteChannels:[w],colorCount:1,rgbEnabled:[true],whiteEnabled:[true]};
  }
  return {hsv,toHsv,fromPoint,position,hex,mixWhite,screenRGB,screenHex,warmWhite,warmthOf,state};
});
