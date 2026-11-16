/*
 * Een tutorialtelefoon met een échte pagina erin (de zonepagina, de Receivers-tab).
 *
 * De iPhone- en de Android-app laten geen tweede pagina laden, ook niet in een iframe (15 nov, iPhone 972: de telefoon
 * in de tutorial bleef wit en "Je stand" bleef leeg). Daarom krijgt het iframe geen adres: fill() schrijft er alleen
 * <map>/pagina.js in, en dat bestand schrijft de pagina zelf. Er is geen navigatie, het iframe blijft van dezelfde
 * oorsprong als de app, en de tutorial kan erin kijken en tikken zoals in de browser.
 * Het iframe erft de regels van de app (geen script in de pagina, geen <base>): daarom zet de app hier zelf de
 * zoekvraag, en rekent pagina.js zijn paden uit vanaf zijn eigen adres.
 *
 * dir   = map van de pagina ('zone-tutorial', 'receivers-tutorial')
 * query = wat de pagina in location.search leest ('?tut=1&uitleg=0')
 */
(()=>{'use strict';
function fill(frame,dir,query){const w=frame?.contentWindow,d=frame?.contentDocument;if(!w||!d)return false;
  d.open();
  // na open() heeft het iframe het adres van de app; alleen de zoekvraag wordt die van de pagina
  try{w.history.replaceState(null,'',location.href.split(/[?#]/)[0]+String(query||''));}catch(_){}
  d.write(`<!doctype html><html><head><meta charset="utf-8"><script src="${dir}/pagina.js"><\/script></head></html>`);
  d.close();return true;}
window.LightningTutorialFrame=Object.freeze({fill});
})();
