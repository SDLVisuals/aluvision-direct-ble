/* Aluvision: wat de tester al toont en een echt toestel nog niet (12 nov 2026).
 * de eigenaar: "ik wil eigenlijk dat je alles die we al hadden inbouwen in de tester, dan kan ik overlopen en zeggen wat
 * anders en beter moet". De prototypes staan daarom in de tester: de demo (/demo/) en de lokale preview op deze Mac.
 * Sinds 14 nov staat alles ook op de toestellen (de eigenaar: "alle oude elementen mogen officieel weg"); de oude schermen
 * zijn uit app.js gehaald. Alleen zone-merge-timing wacht nog op de native weg.
 *
 * De onderdelen (naam → prototype):
 *   order-step     stap 2 "Looprichting": volgorde en kanten in één scherm  prototypes/ketting-leggen   (C141p)
 *   rgbw-tunnel    tunnel met RGBW: paneel, banner, volgorde, tutorial  prototypes/rgbw-tunnel      (C145p)
 *   receivers-tab  de Receivers-tab en de receiverpagina                prototypes/receivers-tab    (C146p)
 *   zone-page      de nieuwe zonepagina                                 prototypes/zone-facelift    (C147p)
 *   zone-merge-timing  op de zonepagina: ledlines samenvoegen, Eigen timing en de gevorderde tutorial. Pas op een toestel
 *                  als de receivers het kunnen (mesh-sessie, docs/zonepagina-samenvoegen-en-eigen-timing.md).
 *   stand-share    je stand delen met de wifi-kaart                     prototypes/ledlines-instellen (share.js)
 *   port-colours   poortkleuren op het scherm: het oranje van poort 4 is duidelijk oranje (pixel-setup.js; de eigenaar 13 nov)
 *   stand-users    Delen en gebruikers in Instellingen: stand delen, gebruikers met vakjes   prototypes/delen-en-gebruikers (stand-users.js; 13 nov)
 *   connection-choice  Instellingen › Verbinding: Bluetooth / Wifi (connection-choice.js; 13 nov). Op een toestel pas aanzetten
 *                  als de receivers bluetooth aan hebben (mesh-sessie); de apps kennen de keuze al.
 *
 * Een nieuw onderdeel eerst alleen in de tester: zet zijn naam in FEATURES en niet in EVERYWHERE. Na akkoord van de eigenaar
 * komt het in EVERYWHERE. ?huidig=1 toont de tester zonder de onderdelen die nog niet op toestellen staan.
 */
(function(root){
  'use strict';
  const FEATURES=Object.freeze(['order-step','rgbw-tunnel','receivers-tab','zone-page','zone-merge-timing','stand-share','port-colours','stand-users','connection-choice']);
  // de eigenaar 14 nov: "Alles van de oude interface mag weg" en "Ja, alles": wat af en getest is, staat ook op toestellen.
  // order-step sinds b040a5f: de receivers tonen het lichtbeeld (FAST_SETUP T/W) en bewaren gaat via de native weg.
  // zone-page sinds 14 nov (de eigenaar: "ik zie nog altijd de oude zones"); samenvoegen en Eigen timing nog niet (zone-merge-timing).
  // connection-choice is van de bluetooth-sessie.
  // de eigenaar 14 nov (via de mesh-sessie): "alle nieuwe dingen worden ingebouwd in de interface. Alle oude elementen mogen
  // officieel weg". Alles staat op toestellen, ook connection-choice (C250 heeft bluetooth aan). Alleen zone-merge-timing
  // wacht nog op de native weg (samenvoegen en Eigen timing naar de receivers).
  const EVERYWHERE=new Set(FEATURES.filter(name=>name!=='zone-merge-timing'));
  // Zelfde afbakening als app.js: geen echte app (native), wel de demo of een lokale preview.
  // Telkens opnieuw bepaald (niet onthouden): de demo-dienst en de native runtime laden na dit bestand.
  function inTester(){
    try{
      const native=root.__lightningV30NativeHost===true||root.location?.protocol==='file:'||root.LightningNativeRuntime?.native===true;
      const demo=root.LightningWebDemo?.available===true;
      const local=['localhost','127.0.0.1','[::1]','::1'].includes(root.location?.hostname||'');
      const current=new URLSearchParams(root.location?.search||'').get('huidig')==='1';
      return !native&&(demo||local)&&!current;
    }catch(_){return false;}
  }
  const has=name=>FEATURES.includes(name)&&(EVERYWHERE.has(name)||inTester());
  root.LightningTesterPreview=Object.freeze({has,active:inTester,features:FEATURES});
}(window));
