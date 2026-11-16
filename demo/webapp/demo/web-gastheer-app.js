/* Web-demo (tools/test/flutter-web/demo-bouw.sh): het stukje gastheer IN de WebApp, zoals het script dat de iPhone bij het
 * openen van de WebView invoegt (V30FlutterHost.prepare) en AluvisionFlutterHost op Android (AlvFlutterHost.java).
 * Laadt vóór app.js (de bouw zet het direct na de CSP-regel van index.html). Doet alleen iets als de pagina in het iframe van
 * de web-gastheer staat (demo-index.html zet window.__alvWebGastheer); alleen geopend blijft het de gewone demo.
 * Berichten gaan als tekst naar de gastheer (de Android-weg); window.webkit blijft ongemoeid (c98-debug.js en
 * native-runtime.js kijken daarnaar). */
(function(){
  'use strict';
  let ouder=null;
  try{ouder=window.parent!==window&&window.parent.__alvWebGastheer===true?window.parent:null;}catch(_){ouder=null;}
  if(!ouder)return;
  const oorsprong=window.location.origin;
  Object.defineProperty(window,'__lightningFlutterHost',{value:true,writable:false,configurable:false});
  Object.defineProperty(window,'AluvisionFlutterHost',{value:Object.freeze({postMessage(tekst){ouder.postMessage({alvGastheer:1,tekst:String(tekst)},oorsprong);}}),writable:false,configurable:false});
})();
