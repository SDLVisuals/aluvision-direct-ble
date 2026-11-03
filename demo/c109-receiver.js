/* C109: a clear, drawn picture of an SPI or RGBW receiver for lists and the
 * receiver page. It shows which outputs are in use; the moving light in it is
 * an illustration (c109-interface.css), never a claim about the real stand.
 * Loaded before app.js; app.js falls back to its 3D canvas without it. */
(function(root){
  'use strict';
  // Calm screen tones of the identification colours (see c109-interface.css).
  const PORT=['#4c6fe0','#e9963f','#3fae76','#c062cf'];
  const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function spi(receiver,{selectedPort=null}={}){
    const outputs=Array.isArray(receiver.outputs)?receiver.outputs:[];
    const ports=[1,2,3,4].map(port=>({port,enabled:!!outputs.find(item=>item.port===port&&item.enabled)}));
    const lines=ports.map(({port,enabled},i)=>{
      const x=22+i*25,colour=PORT[i],picked=port===selectedPort;
      return `<g class="c109r-port${enabled?' is-on':''}${picked?' is-picked':''}" style="--c109r-c:${colour};--c109r-d:${i*.28}s">
        <path class="c109r-cable" d="M${x} 34v8"/>
        <rect class="c109r-plug" x="${x-4}" y="30" width="8" height="7" rx="2"/>
        <rect class="c109r-strip" x="${x-5}" y="44" width="10" height="38" rx="5"/>
        ${enabled?`<rect class="c109r-glow" x="${x-5}" y="44" width="10" height="38" rx="5"/><circle class="c109r-run" cx="${x}" cy="48" r="3.2"/>`:''}
        <text class="c109r-num" x="${x}" y="94">${port}</text></g>`;
    }).join('');
    return `<svg class="c109r c109r-spi" viewBox="0 0 120 100" role="img" aria-hidden="true" focusable="false">
      <rect class="c109r-shadow" x="10" y="8" width="100" height="28" rx="9"/>
      <rect class="c109r-box" x="8" y="4" width="104" height="28" rx="9"/>
      <rect class="c109r-lid" x="14" y="8" width="92" height="12" rx="5"/>
      <text class="c109r-label" x="60" y="17.5">SPI</text>
      <circle class="c109r-led" cx="100" cy="25" r="2"/>${lines}</svg>`;
  }
  function rgbw(){
    const tails=[['R','#e05a52'],['G','#3fae76'],['B','#4c6fe0'],['W','#f1efe8']].map(([name,colour],i)=>{
      const x=26+i*23;
      return `<g class="c109r-port is-on" style="--c109r-c:${colour};--c109r-d:0s">
        <path class="c109r-cable" d="M60 52 C60 58 ${x} 56 ${x} 64"/>
        <rect class="c109r-strip" x="${x-5}" y="64" width="10" height="20" rx="5"/>
        <rect class="c109r-glow" x="${x-5}" y="64" width="10" height="20" rx="5"/>
        <text class="c109r-num" x="${x}" y="95">${name}</text></g>`;
    }).join('');
    return `<svg class="c109r c109r-rgbw" viewBox="0 0 120 100" role="img" aria-hidden="true" focusable="false">
      <rect class="c109r-shadow" x="22" y="8" width="76" height="30" rx="10"/>
      <rect class="c109r-box" x="20" y="4" width="80" height="30" rx="10"/>
      <rect class="c109r-lid" x="26" y="8" width="68" height="13" rx="5"/>
      <text class="c109r-label" x="60" y="18">RGBW</text>
      <circle class="c109r-led" cx="88" cy="27" r="2"/>
      <path class="c109r-cable" d="M60 34v14"/><circle class="c109r-hub" cx="60" cy="50" r="4.5"/>${tails}</svg>`;
  }
  function svg(receiver,options={}){
    if(!receiver||!['SPI','RGBW'].includes(receiver.type))return '';
    return receiver.type==='SPI'?spi(receiver,options):rgbw(receiver,options);
  }
  root.LightningReceiverIcon109=Object.freeze({svg,esc});
}(window));
