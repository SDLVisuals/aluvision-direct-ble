/*
 * Zonepagina · tutorial: de pagina zelf.
 * De zonepagina zoals ze in de tutorial (zone-page-tutorial.js) in de telefoon speelt: een kopie van
 * prototypes/zone-facelift (C147p), met eigen opslag en zonder verbinding. De echte pagina is zone-page.js. C147p
 * "SPI-zonepagina eenvoudiger" (en RGBW), versie 2: de echte stylesheets van de interface, daarna ketting.css en
 * herkennen.css (dezelfde knoppen en tutorial), toevoegen.css (de iPhone in de tutorial) en de eigen stukken.
 *
 * index.html laadt dit bestand; in de app laadt tutorial-frame.js het in een iframe zonder adres, omdat de iPhone-
 * en Android-app geen tweede pagina laten laden. Pas de pagina dus hier aan, niet in index.html.
 */
(()=>{'use strict';
const CSS=["../static-gradient.css", "../styles.css", "../animations.css", "../animation-library.css", "../receiver-visual.css", "../continuity.css", "../onboarding-ui.css", "../first-pin-v2.css", "../pixel-setup.css", "../spi-direction-tutorial.css", "../spi-zone-direction.css", "../receiver-update-ui.css", "../receiver-removal-ui.css", "../app-erase.css", "../scenes.css", "../premium-surfaces.css", "../animation-mobile.css", "../page-interaction.css", "../interface-polish.css", "../v40-design.css", "../ledline-order.css", "../stand-sharing.css", "../stand-animations.css", "../v41-materials.css", "../v41-visual.css", "../onboarding-connect.css", "../v50-interface.css", "../v50-order-drag.css", "../v50-order-guide.css", "../v50-order-clarity.css", "../v50-preview-selection.css", "../v50-order-tutorial.css", "../ui606-controls.css", "../ui606-pages.css", "../ui606-gallery.css", "../colour-picker-dialog.css", "../colour-wheel.css", "../animation-chooser.css", "../animation-refinement.css", "../interface-mode.css", "../theme-audit.css", "../animation-discovery.css", "../ledline-order-focus.css", "../colour-presets-ui.css", "../ledline-order-direct.css", "../main-connection-indicator.css", "../onboarding756.css", "../tunnel756.css", "../keyboard756.css", "../c97-polish.css", "../c98-glass.css", "../c99-responsive.css", "../c100-stand.css", "../c102-tidy.css", "../c100-android-adaptive.css", "../c104-polish.css", "../c105-polish.css", "../c106-motion.css", "../c113-flow.css", "../c109-interface.css", "ketting.css", "herkennen.css", "toevoegen.css", "zone.css"];
const JS=["../static-gradient.js", "../vendor/v21_tunnel_engine.js", "../vendor/v21_animation_catalog.js", "../model.js", "../colour.js", "../animation-engine.js", "../reference-animations.js", "../preview.js", "../animation-library.js", "../v50-animation-texts.js", "../receiver-art.js", "lijn-view.js", "../tutorial-ask.js", "zone.js"];
const BODY=`
  <div class="kt-app zf-app">
    <header class="brand-bar"><img src="../assets/aluvision-logo.png" alt="Aluvision"><span>LIGHTING <b>V50</b></span></header>
    <!-- alleen in het prototype, met ?test=1 in de link -->
    <section class="zf-proto" aria-label="Prototype-instellingen" hidden>
      <button type="button" data-proto="spi">SPI-zone</button>
      <button type="button" data-proto="rgbw">RGBW-zone</button>
      <button type="button" data-proto="new">Nieuwe zone</button>
      <button type="button" data-proto="rgbw2">RGBW: 2e receiver erbij</button>
      <button type="button" data-proto="reset">Begin opnieuw</button>
    </section>
    <main class="kt-main zf-main" data-view></main>
    <nav id="navigation" class="navigation kt-nav" aria-label="Hoofdnavigatie">
      <button type="button" data-action="nav" data-id="stand" aria-current="page"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V4h18v17M3 8h18M7 21V12h10v9M1 21h22"/></svg><span>Stand</span></button>
      <button type="button" data-action="nav" data-id="scenes"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h14v14H7zM3 7v14h14M11 7h6M11 11h6"/></svg><span>Scènes</span></button>
      <button type="button" data-action="nav" data-id="receivers"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 11h13a2.5 2.5 0 0 1 2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-3A2.5 2.5 0 0 1 5.5 11ZM7 15h.01M11 15h1.5M15 15h2M9.5 7.6a3.6 3.6 0 0 1 5 0M7.2 5.2a6.9 6.9 0 0 1 9.6 0"/></svg><span>Receivers</span></button>
    </nav>
    <div class="kt-toast" data-toast hidden role="status" aria-live="polite"></div>
  </div>
`;
const root=document.documentElement;root.setAttribute("lang","nl");root.setAttribute("class","interface-polish");document.title="Zonepagina · tutorial";
// paden vanaf dit bestand: in de app heeft de pagina het adres van de app zelf (en de app staat geen <base> toe)
const HERE=document.currentScript.src,at=p=>new URL(p,HERE).href;
document.write('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'+
  CSS.map(href=>`<link rel="stylesheet" href="${at(href)}">`).join('')+
  '</head><body data-theme="light" class="kt-body">'+BODY.replace(/ src="([^"]+)"/g,(m,p)=>` src="${at(p)}"`)+
  JS.map(src=>`<script src="${at(src)}"><\/script>`).join(''));
})();
