/*
 * Receivers · tutorial: de pagina zelf.
 * De Receivers-tab zoals ze in de tutorial (receivers-tab-tutorial.js) in de telefoon speelt: dezelfde module en
 * dezelfde stijl als de app (receivers-tab.js), met voorbeeldreceivers, zonder verbinding en zonder opslag.
 *
 * index.html laadt dit bestand; in de app laadt tutorial-frame.js het in een iframe zonder adres, omdat de iPhone-
 * en Android-app geen tweede pagina laten laden. Pas de pagina dus hier aan, niet in index.html.
 */
(()=>{'use strict';
const CSS=["../static-gradient.css", "../styles.css", "../animations.css", "../animation-library.css", "../receiver-visual.css", "../continuity.css", "../onboarding-ui.css", "../first-pin-v2.css", "../pixel-setup.css", "../spi-direction-tutorial.css", "../spi-zone-direction.css", "../receiver-update-ui.css", "../receiver-removal-ui.css", "../app-erase.css", "../scenes.css", "../premium-surfaces.css", "../animation-mobile.css", "../page-interaction.css", "../interface-polish.css", "../v40-design.css", "../ledline-order.css", "../stand-sharing.css", "../stand-animations.css", "../v41-materials.css", "../v41-visual.css", "../onboarding-connect.css", "../v50-interface.css", "../v50-order-drag.css", "../v50-order-guide.css", "../v50-order-clarity.css", "../v50-preview-selection.css", "../v50-order-tutorial.css", "../ui606-controls.css", "../ui606-pages.css", "../ui606-gallery.css", "../colour-picker-dialog.css", "../colour-wheel.css", "../animation-chooser.css", "../animation-refinement.css", "../interface-mode.css", "../theme-audit.css", "../animation-discovery.css", "../ledline-order-focus.css", "../ledline-order-tutorial.css", "../colour-presets-ui.css", "../ledline-order-direct.css", "../main-connection-indicator.css", "../onboarding756.css", "../tunnel756.css", "../keyboard756.css", "../c97-polish.css", "../c98-glass.css", "../c99-responsive.css", "../c100-stand.css", "../c101-order-mirror.css", "../c102-tidy.css", "../c100-android-adaptive.css", "../c104-polish.css", "../c105-polish.css", "../c106-motion.css", "../c113-flow.css", "../c109-interface.css", "../ledlines-setup.css", "../ledlines-tutorial.css", "../ledlines-order-step.css", "../receivers-tab.css", "../connection-choice.css", "../stand-users.css", "../rgbw-tunnel-tutorial.css", "../zone-page.css"];
const JS=["../receiver-art.js", "../ledline-kabels.js", "../receiver-pair-scene.js", "../receivers-tab.js", "rx.js"];
const BODY=`
  <header class="brand-bar"><img src="../assets/aluvision-logo.png" alt="Aluvision"></header>
  <main id="main" tabindex="-1"></main>
  <nav id="navigation" class="navigation has-c109-pill" aria-label="Hoofdnavigatie"><span class="c109-pill is-moving" aria-hidden="true" style="width: 129px; height: 47px; transform: translate(270px, 5px); background-color: rgb(28, 28, 30); background-image: none; box-shadow: rgba(24, 34, 53, 0.2) 0px 2px 6px -3px; border-radius: 26px; border: 0px;"></span><button data-action="nav" data-id="stand"><svg class="icon" data-icon="stand" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V4h18v17M3 8h18M7 21V12h10v9M1 21h22"></path></svg><span>Stand</span></button><button data-action="nav" data-id="scenes"><svg class="icon" data-icon="scenes" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h14v14H7zM3 7v14h14M11 7h6M11 11h6"></path></svg><span>Scènes</span></button><button data-action="nav" data-id="receivers" aria-current="page" class=""><svg class="icon" data-icon="receiver" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 11h13a2.5 2.5 0 0 1 2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-3A2.5 2.5 0 0 1 5.5 11ZM7 15h.01M11 15h1.5M15 15h2M9.5 7.6a3.6 3.6 0 0 1 5 0M7.2 5.2a6.9 6.9 0 0 1 9.6 0"></path></svg><span>Receivers</span></button></nav>
  <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
`;
const root=document.documentElement;root.setAttribute("lang","nl");root.setAttribute("class","interface-polish");document.title="Receivers · tutorial";
// paden vanaf dit bestand: in de app heeft de pagina het adres van de app zelf (en de app staat geen <base> toe)
const HERE=document.currentScript.src,at=p=>new URL(p,HERE).href;
document.write('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'+
  CSS.map(href=>`<link rel="stylesheet" href="${at(href)}">`).join('')+
  '</head><body class="c109-zone-sheet">'+BODY.replace(/ src="([^"]+)"/g,(m,p)=>` src="${at(p)}"`)+
  JS.map(src=>`<script src="${at(src)}"><\/script>`).join(''));
})();
