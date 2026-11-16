/* Aluvision: de Receivers-tab en de receiverpagina (C230). Uit prototype receivers-tab (C146p, afspraak 11 november).
 * Lijst
 * - Per zone één rustige kaart per receiver: de tekening, de naam, een statusbolletje (groen = verbonden, grijs = niet
 *   bereikbaar; nooit rood) en het type als badge (SPI of RGBW).
 * - Een blauw telefoontje staat op de tekening van de receiver waarmee deze telefoon nu verbonden is.
 * - Op de kaart staat één knop: Knipperen (de eigenaar 13 nov: "als de kaart is ingeklapt gewoon een mooie knop Knipperen,
 *   bij RGBW hetzelfde en een mooie badge SPI - RGBW; die ene lijn bij RGBW moet er niet bij"). De ledlines met hun
 *   pixels staan dus niet meer op de kaart: die zie je op het scherm van de receiver.
 * - De kaart is één smalle balk: de knop staat rechts van de receiver (de eigenaar 13 nov: "graag de balkjes minder dik,
 *   graag knipperen rechts van de receiver").
 * - Helemaal rechts staat een tandwiel: het zegt dat je de kaart opent voor de instellingen van die receiver (de eigenaar
 *   13 nov: "ook duidelijk zijn dat je dat kan openklikken voor de instellingen van die receiver"). De hele kaart opent
 *   de receiver; het tandwiel is daar het teken van. Knipperen en het tandwiel zijn twee gelijke knopjes zonder tekst
 *   ("graag de knipperknop hetzelfde als instellingen, zonder tekst").
 * - De zonekop toont het aantal receivers en ledlines. Het label "Tunnel klaar / Tunnel vanaf 2" bij een RGBW-zone is
 *   weg (de eigenaar 13 nov: "wat is die tunnel klaar, moet dat er wel bij?"): het telde alleen de receivers en zei dus meer
 *   dan het wist. Receivers die in geen zone zitten, staan bovenaan onder "Niet in een zone".
 * - Bovenaan, onder "Receiver toevoegen", twee rustige knoppen naast elkaar: Software-updates (alle receivers; het
 *   bestaande updatevenster van de app; de eigenaar 13 nov: "software updates graag bovenaan") en, zodra er receivers zijn
 *   die aan geen zone zijn toegewezen, "Niet in een zone" met hun aantal ("de knop niet in zone voor receivers die niet
 *   toegewezen zijn aan een zone", zoals op de oude receiverpagina). Een tik toont alleen die receivers, nog een tik
 *   weer alles. Zijn er geen, dan staat die knop er niet.
 * - "Bekijk tutorial" staat onderaan de lijst (de eigenaar 13 nov: "graag de bekijk tutorial ergens anders").
 * Receiverpagina (een volledig scherm onder het logo, zoals stap 1 en stap 2: kop – beeld – knoppen onderaan)
 * de eigenaar, 12 nov, over de eerste versie (kop, tekening, grote knop, vier rijen, drie knoppen, verwijderen): "de nieuwe
 * receiver pagina voelt veel aan" / "bedenk eens goed hoe dit beter kan". Daarom is de pagina nu één beeld en twee
 * knoppen. de eigenaar, 13 nov: "als je een receiver aanklikt graag een volledige schermweergave i.p.v. pop-up": ze was een
 * vel dat van onderaan omhoog schoof en is nu een eigen scherm met een terugpijl (dezelfde als op de zonepagina).
 * - SPI: de receiver van dichtbij, met zijn vier ledlines eraan in hun eigen kleur en met hun pixels. Tik op het
 *   getal om de pixels aan te passen; tik op de gekleurde strip om die ene ledline te laten knipperen op de stand
 *   (de eigenaar 13 nov: "Ja, bouw het"). Een ledline die uit staat (stippellijn, plusje) tik je aan om ze aan te zetten.
 *   Geen kop, geen uitlegzin, geen rijen: het beeld toont het.
 * - Elk deel van een ledline doet wat het toont (de eigenaar 13 nov: "ook duidelijker dat als je op pixels duwt je de pixels
 *   kan instellen + graag ook een optie om iets uit te zetten, maar verwerk dit goed: ik wil niet dat alles vol staat
 *   met knoppen en tekst, zo visueel mogelijk"): het getal draagt een potloodje en opent de pixels, de strip laat de
 *   ledline knipperen, en de connector is de schakelaar. Tik op de connector van een ledline die aan staat: hij komt
 *   half los en het getal wordt een aan/uit-teken; een tweede tik (op dat teken of op de connector) zet de ledline uit
 *   (de bestaande actie receiver-port-enabled van de app), anders klikt hij na enkele seconden weer vast. De laatste
 *   ledline die aan staat, kan niet uit: daar is de connector geen knop.
 * - Waar geen ledline is aangesloten, zit de connector los: de vaste kabel van de receiver eindigt in de wartel met de
 *   pin en de rode O-ring, de huls van de ledline ligt er een eindje vandaan. Tik je op het plusje, dan schuift de
 *   ledline erin en gaat ze aan in de kleur van haar poort; daarna opent de pixelkiezer van de app (de eigenaar 13 nov:
 *   "kleine details tellen"). Bewaart de klant niet, dan gaat de connector weer los.
 * - Onderaan één grote knop "Looprichting" (stap 2: volgorde en kanten in één scherm; de eigenaar 13 nov: "een duidelijker
 *   naam, aangezien dit nu 1 stap is geworden"). RGBW: "Volgorde" vanaf 2 RGBW's in de zone, anders een korte tip.
 *   Zit de receiver in geen zone, dan is de grote knop "Zone kiezen".
 * - Daaronder alleen "Laat knipperen" en "Meer". Achter "Meer": zone wisselen (ook naar "Niet in een zone"),
 *   software-updates, info, receiver verwijderen. Meer, Zone wisselen, Info en "Bekijk hoe" zijn elk een volledige
 *   pagina met een terugpijl, geen half venster meer (de eigenaar 13 nov: "graag de halve pop-up kaarten volledige pagina
 *   kaarten van maken"). Software-updates en verwijderen openen het bestaande venster van de app.
 * - RGBW: de receiver met zijn echte kabels en de zwarte splitter, hetzelfde beeld als bij het toevoegen
 *   (receiver-pair-scene.js; de eigenaar 13 nov: "zorg ervoor dat de RGBW de juiste splitter gebruikt"). De regel "Eén kleur ·
 *   tot 4 ledlines" is weg ("graag die een kleur weg bij RGBW"). In het klein, op de kaart, staat de receiver met een
 *   stukje van zijn zwarte kabel: de splitter die receiver-art zelf tekent, is niet de echte.
 * Dit bestand is alleen het scherm. De gegevens komen van de app (getState); wat een knop doet, doet de app:
 *   - knoppen met data-action zijn bestaande acties van de app (receiver-add, receiver-pixels-only, visual-identify,
 *     port-identify, receiver-port-enabled, receiver-remove, receiver-update, receiver-update-all): daar verandert niets aan. Bij knipperen
 *     houdt de app zelf de knop bij (aria-pressed en de tekst in de eerste <span>, die er dus altijd moet staan): de
 *     zichtbare tekst volgt aria-pressed in de opmaak;
 *   - onOrder (stap 2: de looprichting), onMove (naar een andere zone, of null = uit de zone), onNewZone (een nieuwe
 *     zone maken en de receiver erin zetten) en onTutorial vraagt het aan de app.
 * Zone wisselen (de eigenaar 13 nov: "zone wisselen menu nog wat meer klantvriendelijk maken") is dezelfde keuze als bij het
 * toevoegen van een receiver: per zone een grote kaart met een rondje, de zone waar hij nu staat is aangevinkt, een zone
 * van het andere type staat erbij met "Alleen voor ...", daaronder "Niet in een zone" en de knop "Nieuwe zone" (naam
 * intikken, klaar). Een tik kiest en sluit.
 * Het stuurt zelf niets naar een receiver en bewaart niets.
 */
(function(){
'use strict';
const LANGS=['nl','en','fr','de'];
const T={
  title:['Receivers','Receivers','Récepteurs','Receiver'],tutorial:['Bekijk tutorial','View tutorial','Voir le tutoriel','Tutorial ansehen'],
  add:['Receiver toevoegen','Add receiver','Ajouter un récepteur','Receiver hinzufügen'],
  receivers1:['{n} receiver','{n} receiver','{n} récepteur','{n} Receiver'],receiversN:['{n} receivers','{n} receivers','{n} récepteurs','{n} Receiver'],
  lines1:['{n} ledline','{n} LED line','{n} ligne LED','{n} LED-Linie'],linesN:['{n} ledlines','{n} LED lines','{n} lignes LED','{n} LED-Linien'],
  empty:['Nog geen receivers in deze zone.','No receivers in this zone yet.','Pas encore de récepteurs dans cette zone.','Noch keine Receiver in dieser Zone.'],
  noZone:['Niet in een zone','Not in a zone','Sans zone','Ohne Zone'],staysInStand:['Blijft in je stand','Stays in your stand','Reste dans votre stand','Bleibt in deinem Stand'],
  chooseZone:['Zone kiezen','Choose a zone','Choisir une zone','Zone wählen'],
  blinkShort:['Knipperen','Blink','Clignoter','Blinken'],
  blinkAria:['{name} laten knipperen op je stand','Make {name} blink on your stand','Faire clignoter {name} sur votre stand','{name} auf deinem Stand blinken lassen'],
  update:['Software-updates','Software updates','Mises à jour','Software-Updates'],   // zoals het updatevenster van de app heet
  typeSpi:['SPI-receiver','SPI receiver','Récepteur SPI','SPI-Receiver'],typeRgbw:['RGBW-receiver','RGBW receiver','Récepteur RGBW','RGBW-Receiver'],
  px:['px','px','px','px'],back:['Terug','Back','Retour','Zurück'],
  cardAria:['{type} {name}, zone {zone}. Instellingen openen.','{type} {name}, zone {zone}. Open settings.','{type} {name}, zone {zone}. Ouvrir les réglages.','{type} {name}, Zone {zone}. Einstellungen öffnen.'],
  settings:['Instellingen','Settings','Réglages','Einstellungen'],
  meTitle:['Je telefoon is met deze receiver verbonden','Your phone is connected to this receiver','Votre téléphone est connecté à ce récepteur','Dein Telefon ist mit diesem Receiver verbunden'],
  zone:['Zone {zone}','Zone {zone}','Zone {zone}','Zone {zone}'],connected:['Verbonden','Connected','Connecté','Verbunden'],unreachable:['Niet bereikbaar','Not reachable','Injoignable','Nicht erreichbar'],
  yourPhone:['Je telefoon','Your phone','Votre téléphone','Dein Telefon'],
  direction:['Looprichting','Travel direction','Sens de déplacement','Laufrichtung'],order:['Volgorde','Order','Ordre','Reihenfolge'],
  backList:['Terug naar Receivers','Back to Receivers','Retour aux récepteurs','Zurück zu den Receivern'],
  pixelsPerLine:['Pixels per ledline','Pixels per LED line','Pixels par ligne LED','Pixel pro LED-Linie'],
  pixelsHint:['Tik op een ledline om haar pixels aan te passen.','Tap an LED line to adjust its pixels.','Touchez une ligne LED pour régler ses pixels.','Tippe auf eine LED-Linie, um ihre Pixel anzupassen.'],
  ledline:['Ledline {n}','LED line {n}','Ligne LED {n}','LED-Linie {n}'],pixels:['pixels','pixels','pixels','Pixel'],turnOn:['Aanzetten','Turn on','Activer','Einschalten'],
  tunnelTip:['Tunneleffecten?','Tunnel effects?','Effets tunnel ?','Tunneleffekte?'],
  tunnelTipSay:['Voeg een 2e RGBW-receiver toe aan deze zone.','Add a 2nd RGBW receiver to this zone.','Ajoutez un 2e récepteur RGBW à cette zone.','Füge dieser Zone einen 2. RGBW-Receiver hinzu.'],
  addShort:['Toevoegen','Add','Ajouter','Hinzufügen'],
  changeZone:['Zone wisselen','Change zone','Changer de zone','Zone wechseln'],blink:['Laat knipperen','Make it blink','Faire clignoter','Blinken lassen'],blinkStop:['Stop knipperen','Stop blinking','Arrêter','Blinken stoppen'],
  more:['Meer','More','Plus','Mehr'],lineAria:['Ledline {n}: {px} pixels. Tik om aan te passen.','LED line {n}: {px} pixels. Tap to adjust.','Ligne LED {n} : {px} pixels. Touchez pour régler.','LED-Linie {n}: {px} Pixel. Zum Anpassen tippen.'],
  lineBlinkAria:['Ledline {n} laten knipperen op je stand','Make LED line {n} blink on your stand','Faire clignoter la ligne LED {n} sur votre stand','LED-Linie {n} auf deinem Stand blinken lassen'],
  lineUnplugAria:['Ledline {n} uitzetten','Turn LED line {n} off','Éteindre la ligne LED {n}','LED-Linie {n} ausschalten'],
  lineOffAria:['Ledline {n} staat uit. Tik om ze aan te zetten.','LED line {n} is off. Tap to turn it on.','La ligne LED {n} est éteinte. Touchez pour l’activer.','LED-Linie {n} ist aus. Zum Einschalten tippen.'],
  info:['Info','Info','Infos','Info'],remove:['Receiver verwijderen','Remove receiver','Supprimer le récepteur','Receiver entfernen'],
  here:['Hier staat hij nu','It is here now','Il est ici','Hier ist er jetzt'],
  emptyZone:['Nog leeg','Still empty','Encore vide','Noch leer'],onlyFor:['Alleen voor {type}','Only for {type}','Uniquement pour {type}','Nur für {type}'],
  newZone:['Nieuwe zone','New zone','Nouvelle zone','Neue Zone'],zoneName:['Zonenaam','Zone name','Nom de la zone','Zonenname'],zoneNameEg:['Bijvoorbeeld: Balie','For example: Counter','Par exemple : Comptoir','Zum Beispiel: Theke'],
  makeZone:['Zone maken','Create zone','Créer la zone','Zone erstellen'],cancel:['Annuleren','Cancel','Annuler','Abbrechen'],zonesAria:['Zone kiezen','Choose a zone','Choisir une zone','Zone wählen'],
  zoneNoteSpi:['Daarna zet je meteen de looprichting van die zone.','You then set the travel direction of that zone right away.','Vous réglez ensuite le sens de déplacement de cette zone.','Danach stellst du gleich die Laufrichtung dieser Zone ein.'],
  zoneNoteRgbw:['Staan er daarna 2 of meer RGBW’s, dan zet je meteen de volgorde.','With 2 or more RGBW receivers there, you set the order right away.','S’il y a ensuite 2 RGBW ou plus, vous réglez l’ordre aussitôt.','Stehen dort danach 2 oder mehr RGBW, stellst du gleich die Reihenfolge ein.'],
  how:['Bekijk hoe','See how','Voir comment','So geht’s'],
  howZoneTitle:['Zone wisselen','Change zone','Changer de zone','Zone wechseln'],
  howZoneSay:['Kies een andere zone. Daarna zet je meteen de looprichting van die zone.','Choose another zone. You then set the travel direction of that zone right away.','Choisissez une autre zone. Vous réglez ensuite le sens de déplacement de cette zone.','Wähle eine andere Zone. Danach stellst du gleich die Laufrichtung dieser Zone ein.'],
  version:['Versie','Version','Version','Version'],signal:['Signaal','Signal','Signal','Signal'],strong:['Sterk','Strong','Fort','Stark'],good:['Goed','Good','Bon','Gut'],weak:['Zwak','Weak','Faible','Schwach'],
  outputs:['Uitgangen','Outputs','Sorties','Ausgänge'],outputsSpi:['4 · elk een eigen ledline','4 · each its own LED line','4 · chacune sa ligne LED','4 · jede eine eigene LED-Linie'],
  outputsRgbw:['1 · tot 4 ledlines, één kleur','1 · up to 4 LED lines, one colour','1 · jusqu’à 4 lignes LED, une couleur','1 · bis zu 4 LED-Linien, eine Farbe'],
  name:['Naam','Name','Nom','Name'],nameOn:['{name} · staat ook op de receiver','{name} · also printed on the receiver','{name} · aussi sur le récepteur','{name} · steht auch auf dem Receiver']
};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduce=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}};
// ---------- iconen ----------
const IC={
  phone:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.8"/><path d="M10.5 18.2h3"/></svg>',
  chev:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
  back:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h13"/></svg>',   // dezelfde pijl als op de zonepagina
  play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  zone:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/><path d="M14 7h4.5l-1.8-1.8M10 17H5.5l1.8 1.8"/></svg>',
  blink:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.4"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/></svg>',
  info:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg>',
  trash:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  tunnel:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20V11a9 9 0 0 1 18 0v9M7 20v-8a5 5 0 0 1 10 0v8"/></svg>',
  more:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="18.5" cy="12" r="1.9"/></svg>',
  update:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7a9 9 0 0 0-15-2L2 8M2 3v5h5M4 17a9 9 0 0 0 15 2l3-3M22 21v-5h-5"/></svg>',   // het update-icoon van de app
  nozone:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4.5" stroke-dasharray="3.4 3.1"/></svg>',
  pen:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4.2L19.4 8.8a2 2 0 0 0 0-2.8l-1.4-1.4a2 2 0 0 0-2.8 0L4 15.8V20ZM13.6 6.2l4.2 4.2"/></svg>',
  power:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v8M6.6 7.2a7.8 7.8 0 1 0 10.8 0"/></svg>',
  // het tandwiel van de app (instellingen)
  gear:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.61 9.53L21.85 10.26L21.85 13.74L19.61 14.47L19.13 15.63L20.19 17.74L17.74 20.19L15.63 19.13L14.47 19.61L13.74 21.85L10.26 21.85L9.53 19.61L8.37 19.13L6.26 20.19L3.81 17.74L4.87 15.63L4.39 14.47L2.15 13.74L2.15 10.26L4.39 9.53L4.87 8.37L3.81 6.26L6.26 3.81L8.37 4.87L9.53 4.39L10.26 2.15L13.74 2.15L14.47 4.39L15.63 4.87L17.74 3.81L20.19 6.26L19.13 8.37Z"/><circle cx="12" cy="12" r="3.2"/></svg>',
  grid:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/></svg>'};
// Looprichting: drie blokjes waarvan de kleur doorloopt (blauw → geel → paars, met een verloop op de naden)
function orderIcon(id){return `<svg class="rx-oic" viewBox="0 0 48 24" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" x2="48" y1="0" y2="0" gradientUnits="userSpaceOnUse">`+
  `<stop offset="0" stop-color="#2F6BFF"/><stop offset=".26" stop-color="#2F6BFF"/><stop offset=".4" stop-color="#FFC61A"/><stop offset=".6" stop-color="#FFC61A"/><stop offset=".74" stop-color="#9B4DFF"/><stop offset="1" stop-color="#9B4DFF"/></linearGradient></defs>`+
  `<g fill="url(#${id})"><rect x="1" y="7" width="13.5" height="10" rx="2.4"/><rect x="17.25" y="7" width="13.5" height="10" rx="2.4"/><rect x="33.5" y="7" width="13.5" height="10" rx="2.4"/></g>`+
  `<rect class="rx-oic-run" x="-10" y="7" width="8" height="10" rx="2.4" fill="#fff" opacity=".55"/></svg>`;}
// De connector van een ledline, zoals op de stand en in stap 2: witte schroefconnector met de rode O-ring. Hier in twee
// helften, zoals in de kabeltekeningen van de tutorials (ledline-kabels.js): rx = de vaste kabel van de receiver met de
// wartel en de pin met de rode O-ring; led = de huls van de ledline met haar kabeltje, die over de pin schuift. Tegen
// elkaar is het precies de connector van stap 2 (de pin zit dan onder de huls); los zie je de pin.
const ICON_PLUG='<svg viewBox="0 0 44 16" aria-hidden="true"><g class="rx-plug-rx"><path class="co" d="M1 8H3.5"/><path class="ci" d="M1 8H3.5"/>'+
  '<rect class="w" x="3" y="5" width="4" height="6" rx="1"/><path class="l" d="M4.3 5.8v4.4M5.7 5.8v4.4"/><rect class="w" x="7" y="4" width="4" height="8" rx="1.2"/>'+
  '<rect class="w" x="18" y="5.4" width="7.6" height="5.2" rx="1.1"/>'+
  '<rect class="w" x="11" y="2" width="8" height="12" rx="2"/><path class="l" d="M13 3.4v9.2M15 3.4v9.2M17 3.4v9.2"/><rect class="r" x="19" y="3.6" width="1.6" height="8.8" rx=".6"/></g>'+
  '<g class="rx-plug-led"><path class="co" d="M30.5 8H44"/><path class="ci" d="M30.5 8H44"/>'+
  '<rect class="w" x="20.6" y="4" width="6" height="8" rx="1.2"/><rect class="w" x="26.6" y="5" width="4.4" height="6" rx="1"/><path class="l" d="M27.9 5.8v4.4M29.3 5.8v4.4"/></g></svg>';
const UNPLUG_ASK_MS=4000;   // zo lang blijft de connector half los staan wachten op de tweede tik
const PLUG_MS=1000;   // de ledline schuift erin (0,34 s), haar kleur loopt erin (tot 0,72 s) en komt tot rust; dan de pixelkiezer
// Het type als badge: zwart zoals de receiver zelf, alleen het woord (de eigenaar 13 nov: "niet met die kleurbolletjes").
const badge=type=>{const kind=type==='rgbw'?'rgbw':'spi';return `<span class="rx-badge" data-kind="${kind}">${kind==='rgbw'?'RGBW':'SPI'}</span>`;};

function create({getState,onOrder=null,onMove=null,onNewZone=null,onTutorial=null}={}){
  if(typeof getState!=='function')throw Error('RECEIVERS_TAB_STATE_REQUIRED');
  let lang=0,stack=[],currentId=null,gid=0,looseOnly=false;const bound=new WeakSet();   // looseOnly: alleen de receivers zonder zone tonen
  const t=(key,params={})=>String((T[key]||[key])[lang]??(T[key]||[key])[0]).replace(/\{(\w+)\}/g,(m,name)=>name in params?String(params[name]):m);
  const setLang=()=>{lang=Math.max(0,LANGS.indexOf(String(document.documentElement.lang||'nl').toLowerCase().split('-')[0]));};
  const safe=(fn,...args)=>{try{return typeof fn==='function'?fn(...args):undefined;}catch(_){return undefined;}};
  const read=()=>{const S=getState()||{};return {zones:Array.isArray(S.zones)?S.zones:[],receivers:Array.isArray(S.receivers)?S.receivers:[],extra:typeof S.extra==='string'?S.extra:'',canUpdate:S.canUpdate===true};};
  const zoneOf=(S,r)=>S.zones.find(z=>z.id===r.zoneId)||null,inZone=(S,z)=>S.receivers.filter(r=>r.zoneId===z.id);
  const typeName=r=>t(r.type==='rgbw'?'typeRgbw':'typeSpi'),linesOn=r=>(r.lines||[]).filter(l=>l.on).length;
  const count=(n,one,many)=>t(n===1?one:many,{n});
  // De tekening in het klein (op de kaart). RGBW: de receiver met een stukje van zijn zwarte kabel; wat receiver-art
  // daar links van tekent (zijn eigen splitter met de kabeltjes) valt buiten beeld, want dat is niet de echte splitter.
  function art(r,w){const RA=window.AluvisionReceiverArt,led=r.online?'#1FC45B':null;
    try{
      if(!RA)return '';
      if(r.type!=='rgbw'||!RA.build||!RA.DIMENSIONS)return RA.svg({type:r.type,view:'top',theme:'light',outputs:[true,true,true,true],cable:14,lead:6,led,shadow:false,width:w,title:typeName(r)});
      const b=RA.build({type:'rgbw',view:'top',theme:'light',outputs:[true,true,true,true],cable:30,lead:0,led,shadow:false,scale:1,title:typeName(r)});
      const vb=b.viewBox,x0=-RA.DIMENSIONS.XE-11,wmm=vb.x+vb.w-x0;
      return b.svg.replace(/viewBox="[^"]*"/,`viewBox="${x0} ${vb.y} ${wmm} ${vb.h}"`).replace(/ width="[\d.]+"/,` width="${w}"`).replace(/ height="[\d.]+"/,` height="${(w*vb.h/wmm).toFixed(1)}"`);
    }catch(_){return '';}}
  // RGBW in het groot: de receiver met zijn echte kabels en de zwarte splitter, het beeld van het toevoegen
  // (receiver-pair-scene.js). Na het tekenen zet fitPics de camera op de plaats die er is.
  const rgbwPic=r=>{const PS=window.LightningReceiverPairScene;let pic='';try{pic=PS?.ready?.()?PS.still('RGBW'):'';}catch(_){pic='';}
    return pic?`<div class="rx-rgbw-pic">${pic}</div>`:`<div class="rx-big-art is-small">${art(r,240)}</div>`;};
  const fitPics=root=>{const PS=window.LightningReceiverPairScene;if(!PS?.fit||!root?.querySelector?.('[data-pair-still]'))return;
    const go=()=>{try{PS.fit(root);}catch(_){}};go();requestAnimationFrame(()=>requestAnimationFrame(go));setTimeout(go,420);};

  // ---------- de lijst ----------
  function zoneHead(S,z){const rs=inZone(S,z),n=rs.length;
    let meta=count(n,'receivers1','receiversN');
    if(z.type==='spi'){const k=rs.reduce((a,r)=>a+linesOn(r),0);meta+=' · '+count(k,'lines1','linesN');}
    // de eigenaar 13 nov: "graag de badge zetten bij een zone": het type van de zone, dezelfde badge als op de kaart van een receiver
    return `<header class="rx-zhead"><span class="rx-zic">${IC.grid}</span><b>${esc(z.name)}</b>${z.type?badge(z.type):''}<small>${esc(meta)}</small></header>`;}
  // De kaart, één smalle balk: tik erop om de receiver te openen (de knop rx-open beslaat de hele kaart); rechts ligt
  // daarboven één eigen knop: Knipperen (de bestaande actie van de app, die ook de knop bijhoudt). Het tandwiel ernaast
  // is het teken dat de kaart de instellingen van de receiver opent; het hoort bij rx-open en is zelf geen knop.
  function card(S,r){const z=zoneOf(S,r),rid=esc(r.id);
    return `<article class="rx-card" data-rx-card="${rid}"><button type="button" class="rx-open" data-rx-open="${rid}" title="${esc(t('settings'))}" aria-label="${esc(t('cardAria',{type:typeName(r),name:r.name,zone:z?z.name:t('noZone')}))}">`+
      `<span class="rx-artw"><span class="rx-art">${art(r,120)}</span><span class="rx-me"${r.me?'':' hidden'} title="${esc(t('meTitle'))}">${IC.phone}</span></span>`+
      `<span class="rx-txt"><b class="rx-name">${esc(r.name)}</b><small><i class="rx-dot${r.online?' on':''}"></i>${badge(r.type)}</small></span></button>`+
      `<button type="button" class="rx-blink" data-action="visual-identify" data-receiver="${rid}" aria-pressed="${r.blinking===true}" title="${esc(t('blinkShort'))}" aria-label="${esc(t('blinkAria',{name:r.name}))}">`+
      `${IC.blink}<span class="rx-sr"></span></button>`+
      `<span class="rx-set" aria-hidden="true">${IC.gear}</span></article>`;}
  function listHtml(){
    setLang();const S=read(),n=S.receivers.length,loose=S.receivers.filter(r=>!zoneOf(S,r));
    if(!loose.length)looseOnly=false;
    // onder de grote knop: Software-updates (alle receivers samen, het bestaande updatevenster van de app) en, alleen
    // als er receivers zonder zone zijn, "Niet in een zone" met hun aantal (een tik toont alleen die receivers)
    const sec=(S.canUpdate&&n?`<button type="button" class="rx-update" data-action="receiver-update-all">${IC.update}<b>${esc(t('update'))}</b></button>`:'')+
      (loose.length?`<button type="button" class="rx-loose" data-rx="loose" aria-pressed="${looseOnly}" aria-label="${esc(t('noZone')+': '+count(loose.length,'receivers1','receiversN'))}"><i aria-hidden="true">${loose.length}</i><b>${esc(t('noZone'))}</b></button>`:'');
    let h=`<div class="page rx-tab" data-rx-list${looseOnly?' data-rx-only="loose"':''}><div class="rx-head"><div class="rx-title-row"><h1>${esc(t('title'))}</h1><span class="rx-count">${n}</span></div></div>`+
      `<button type="button" class="rx-add" data-action="receiver-add">${IC.plus}<span>${esc(t('add'))}</span></button>${sec?`<div class="rx-sec">${sec}</div>`:''}${S.extra}`;
    if(loose.length)h+=`<section class="rx-zone is-loose" data-rx-zone=""><header class="rx-zhead"><span class="rx-zic">${IC.nozone}</span><b>${esc(t('noZone'))}</b><small>${esc(count(loose.length,'receivers1','receiversN'))}</small></header><div class="rx-cards">${loose.map(r=>card(S,r)).join('')}</div></section>`;
    for(const z of S.zones){const rs=inZone(S,z);
      h+=`<section class="rx-zone" data-rx-zone="${esc(z.id)}">${zoneHead(S,z)}<div class="rx-cards">${rs.length?rs.map(r=>card(S,r)).join(''):`<p class="rx-empty">${esc(t('empty'))}</p>`}</div></section>`;}
    // onderaan, uit de weg: de tutorial van deze tab
    h+=`<div class="rx-tutrow"${typeof onTutorial==='function'?'':' hidden'}><button type="button" class="ls-tut" data-rx="intro"><i aria-hidden="true">${IC.play}</i><span>${esc(t('tutorial'))}</span></button></div>`;
    return h+'</div>';
  }
  // de lijst staat in de pagina van de app: één keer per pagina-element luisteren
  function bind(main){
    if(!main||bound.has(main))return;bound.add(main);
    main.addEventListener('click',event=>{
      if(!event.target.closest?.('[data-rx-list]'))return;
      const open=event.target.closest('[data-rx-open]');if(open){openReceiver(open.dataset.rxOpen);return;}
      const only=event.target.closest('[data-rx="loose"]');
      if(only){   // alleen de receivers zonder zone, of weer alles; de lijst zelf blijft staan, de opmaak verbergt de zones
        looseOnly=!looseOnly;only.setAttribute('aria-pressed',String(looseOnly));
        const root=only.closest('[data-rx-list]');if(looseOnly)root.setAttribute('data-rx-only','loose');else root.removeAttribute('data-rx-only');
        return;
      }
      if(event.target.closest('[data-rx="intro"]'))safe(onTutorial);
    });
  }

  // ---------- vellen ----------
  function sheet(cls,html,{onClose}={}){
    const el=document.createElement('dialog');el.className='rx-sheet '+cls;
    el.innerHTML=`<div class="rx-sheet-back" data-rx-close></div><div class="rx-panel">${html}</div>`;
    document.body.append(el);
    try{el.showModal();}catch(_){el.setAttribute('open','');}
    const entry={el,onClose};stack.push(entry);
    requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('is-in')));
    el.addEventListener('click',onSheetClick);
    el.addEventListener('cancel',event=>{event.preventDefault();if(stack[stack.length-1]===entry)closeTop();});
    return el;
  }
  function closeTop(){
    const top=stack.pop();if(!top)return;
    const el=top.el;el.classList.remove('is-in');el.classList.add('is-out');
    // de app laat elk venster zacht sluiten met een kopie; dit vel schuift zelf omlaag
    const done=()=>{el.dataset.c138ExitedAt=String(Date.now());try{el.close();}catch(_){}el.remove();};
    if(reduce())done();else setTimeout(done,250);
    safe(top.onClose);
  }
  function closeAll(){while(stack.length)closeTop();}
  // Meer, Zone wisselen, Info en "Bekijk hoe" zijn elk een volledige pagina, zoals de receiverpagina zelf: terugpijl,
  // titel met de naam van de receiver eronder, en de inhoud (de eigenaar 13 nov: "graag de halve pop-up kaarten volledige
  // pagina kaarten van maken"). Een keuze in "Meer" neemt de plaats van die pagina in; terug gaat naar de receiver.
  function subPage(cls,title,under,body){
    const el=sheet('rx-page rx-sub '+cls,`<header class="rx-ph rx-top"><button type="button" class="rx-back" data-rx-close aria-label="${esc(t('back'))}" title="${esc(t('back'))}">${IC.back}</button>`+
      `<div><h2>${esc(title)}</h2>${under?`<span class="rx-stat">${esc(under)}</span>`:''}</div></header><div class="rx-body">${body}</div>`);
    el.querySelector('.rx-back')?.focus({preventScroll:true});return el;
  }
  const how=topic=>`<button type="button" class="rx-how" data-rx-how="${topic}"><i aria-hidden="true">${IC.play}</i>${esc(t('how'))}</button>`;

  // ---------- de receiverpagina ----------
  function openReceiver(id){
    setLang();const S=read(),r=S.receivers.find(x=>x.id===id);if(!r)return false;
    closeAll();currentId=id;
    const html=pageHtml(S,r),el=sheet('rx-page',html,{onClose:()=>{currentId=null;}});el.dataset.rxReceiver=id;stack[stack.length-1].html=html;
    el.querySelector('.rx-back')?.focus({preventScroll:true});fitPics(el);
    return true;
  }
  // De receiver van dichtbij, met zijn vier ledlines eraan: elke ledline in haar kleur, met haar pixels; uit = een
  // stippellijn met een plusje. De ledlines staan op de hoogte van hun uitgang (de tekening zegt waar die zitten).
  // Alle maten zijn ontwerp-punten (--t, --h; de opmaak rekent ze om met --u): het beeld groeit mee met de plaats die
  // het scherm heeft, en op een smal scherm is er minder van de receiver in beeld zodat de ledlines de breedte krijgen.
  function linesScene(r,rid){
    const RA=window.AluvisionReceiverArt,PITCH=42,S=PITCH/12.5,CUT=56;   // 12,5 mm tussen twee uitgangen; tot 56 mm van de receiver in beeld
    let b=null;try{b=RA?.build?.({type:'spi',view:'top',theme:'light',outputs:[true,true,true,true],cable:5,lead:0,led:r.online?'#1FC45B':null,shadow:false,scale:S,title:typeName(r)})||null;}catch(_){b=null;}
    const strip='<i class="rx-line-strip"></i>',plug=`<i class="kt-plug rx-line-plug" aria-hidden="true">${ICON_PLUG}</i>`,light=strip+plug;
    const canOff=r.online&&(r.lines||[]).filter(l=>l.on).length>1;   // de laatste ledline die aan staat, kan niet uit
    const pixels=l=>`data-action="receiver-pixels-only" data-id="${rid}" data-ports="${l.port}" data-line-look aria-label="${esc(t(l.on?'lineAria':'lineOffAria',{n:l.port,px:l.px}))}"`;
    // aan: het getal (met potloodje) opent de pixels, de strip laat deze ledline knipperen, de connector zet ze uit
    // (data-rx-unplug = eerst half los en vragen, dan pas de actie van de app); uit: de hele rij zet ze aan. Daar zit de
    // connector los; data-rx-plug = eerst het inpluggen tonen, dan pas de actie van de app (onSheetClick).
    const line=(l,style)=>l.on
      ?`<div class="rx-line" style="${style}--c:${esc(l.hex)}" data-ports="${l.port}"><button type="button" class="rx-line-px" ${pixels(l)}><b>${l.px}</b><small>${esc(t('px'))}</small>${IC.pen}<i class="rx-line-offic" aria-hidden="true">${IC.power}</i></button>`+
        `<button type="button" class="rx-line-light" data-action="port-identify" data-receiver="${rid}" data-port="${l.port}" aria-pressed="${l.blinking===true}" aria-label="${esc(t('lineBlinkAria',{n:l.port}))}"><span class="rx-sr"></span>${strip}</button>`+
        (canOff?`<button type="button" class="rx-line-unplug" data-action="receiver-port-enabled" data-receiver="${rid}" data-port="${l.port}" data-rx-unplug="" aria-label="${esc(t('lineUnplugAria',{n:l.port}))}">${plug}</button>`:`<span class="rx-line-unplug">${plug}</span>`)+`</div>`
      :`<button type="button" class="rx-line off" style="${style}--c:${esc(l.hex)}" data-ports="${l.port}"${r.online?' data-rx-plug=""':''} ${pixels(l)}><span class="rx-line-px">${IC.plus}</span>${light}</button>`;
    if(!b||!Array.isArray(b.anchors)||!b.viewBox)   // zonder tekening: dezelfde ledlines onder elkaar
      return `<div class="rx-lines is-plain">${(r.lines||[]).map(l=>line(l,'')).join('')}</div>`;
    const vb=b.viewBox,x0=Math.min(...b.anchors.map(a=>a.x)),W=CUT*S,H=vb.h*S;
    const svg=b.svg.replace(/viewBox="[^"]*"/,`viewBox="${x0} ${vb.y} ${CUT} ${vb.h}"`).replace(/ width="[\d.]+"/,` width="${W.toFixed(1)}"`);
    const rows=b.anchors.map(a=>{const l=(r.lines||[]).find(x=>x.port===a.port);return l?line(l,`--t:${((a.y-vb.y)*S-PITCH/2).toFixed(1)};`):'';}).join('');
    return `<div class="rx-lines" style="--h:${H.toFixed(1)}"><div class="rx-lines-rows">${rows}</div><div class="rx-lines-art" aria-hidden="true">${svg}</div></div>`;
  }
  // De pagina in drie delen, zoals stap 1 en stap 2: de kop (terugpijl, naam, status), het beeld in het midden en de
  // knoppen onderaan.
  function pageHtml(S,r){
    const z=zoneOf(S,r),same=z?inZone(S,z).filter(x=>x.type==='rgbw').length:0,rid=esc(r.id),key=String(r.id).replace(/[^a-z0-9]/gi,'');
    const top=`<header class="rx-ph rx-top"><button type="button" class="rx-back" data-rx-close aria-label="${esc(t('backList'))}" title="${esc(t('backList'))}">${IC.back}</button><div><h2>${esc(r.name)}</h2>`+
      `<span class="rx-stat"><i class="rx-dot${r.online?' on':''}"></i>${esc(t(r.online?'connected':'unreachable'))}<span class="rx-stat-zone">${esc(z?z.name:t('noZone'))}</span>${r.me?`<span class="rx-me-inline">${IC.phone}${esc(t('yourPhone'))}</span>`:''}</span></div></header>`;
    const orderBtn=label=>`<button type="button" class="rx-primary" data-rx="order"${r.canOrder?'':' disabled'}>${orderIcon('rxg-'+key)}<b>${esc(label)}</b>${IC.chev}</button>`;
    let stage,primary='';
    if(r.type==='spi'){
      stage=linesScene(r,rid);
      if(z)primary=orderBtn(t('direction'));
    }else{
      stage=rgbwPic(r);
      if(same>=2)primary=orderBtn(t('order'));
      else if(z)stage+=`<div class="rx-tip">${IC.tunnel}<p><b>${esc(t('tunnelTip'))}</b> ${esc(t('tunnelTipSay'))}</p><button type="button" class="rx-tip-go" data-action="receiver-add">${IC.plus}${esc(t('addShort'))}</button></div>`;
    }
    // in geen zone: eerst een zone kiezen (hetzelfde vel als "Zone wisselen")
    if(!z)primary=`<button type="button" class="rx-primary rx-zonepick" data-rx="zone">${IC.zone}<b>${esc(t('chooseZone'))}</b>${IC.chev}</button>`;
    return top+`<div class="rx-stage" data-kind="${r.type==='spi'?'spi':'rgbw'}">${stage}</div>`+
      `<footer class="rx-foot">${primary}<div class="rx-small rx-two"><button type="button" data-action="visual-identify" data-receiver="${rid}" aria-pressed="${r.blinking===true}">${IC.blink}<span class="rx-sr"></span><b class="rx-when-off">${esc(t('blink'))}</b><b class="rx-when-on">${esc(t('blinkStop'))}</b></button>`+
      `<button type="button" data-rx="more">${IC.more}<b>${esc(t('more'))}</b></button></div></footer>`;
  }
  // ---------- meer: wat je zelden nodig hebt ----------
  function openMore(){
    const S=read(),r=S.receivers.find(x=>x.id===currentId);if(!r)return;
    const z=zoneOf(S,r),row=(attrs,icon,label,detail='')=>`<button type="button" class="rx-zopt" ${attrs}>${icon}<span><b>${esc(label)}</b>${detail?`<small>${esc(detail)}</small>`:''}</span></button>`;
    subPage('rx-moresheet',t('more'),r.name,`<div class="rx-zopts">`+
      row('data-rx="zone"',IC.zone,t(z?'changeZone':'chooseZone'),z?z.name:t('noZone'))+
      (S.canUpdate?row(`data-action="receiver-update" data-id="${esc(r.id)}"`,IC.update,t('update')):'')+row('data-rx="info"',IC.info,t('info'),typeName(r))+
      row(`data-action="receiver-remove" data-id="${esc(r.id)}"`,IC.trash,t('remove'))+`</div>`);
  }
  // ---------- zone wisselen ----------
  // Dezelfde keuze als bij het toevoegen van een receiver (het zonevenster van de toevoeg-flow): per zone een kaart met
  // een rondje. Aangevinkt = waar de receiver nu staat. Een zone van het andere type kan niet en zegt waarom. Daaronder
  // "Niet in een zone" (hij blijft in de stand) en "Nieuwe zone" (naam intikken; de app maakt de zone en zet hem erin).
  const MARK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5.5 12.5 4.2 4.2L18.5 7.8"/></svg>';
  // dezelfde regel als de app voor een naam (model.js, editName): 1 tot 64 tekens, geen < of > en geen onzichtbare stuurtekens
  const NAME_BAD=/[<>\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/,NAME_BAD_ALL=new RegExp(NAME_BAD.source,'g');
  const nameOk=value=>{const name=String(value??'').trim();return name.length>0&&name.length<=64&&!NAME_BAD.test(name);};
  function openZone(){
    const S=read(),r=S.receivers.find(x=>x.id===currentId);if(!r)return;
    const cur=zoneOf(S,r);
    const pick=({id,name,detail,checked,type='',disabled=false,none=false})=>`<button type="button" role="radio" class="rx-zpick${none?' rx-zpick-none':''}" data-rx-zone-to="${esc(id)}" aria-checked="${checked}"${disabled?' disabled':''}>`+
      `<span><span class="rx-zpick-top"><b>${esc(name)}</b>${type?badge(type):''}</span><small>${esc(detail)}</small></span><i aria-hidden="true">${MARK}</i></button>`;
    const zones=S.zones.map(z=>{const n=inZone(S,z).length,fits=!z.type||z.type===r.type,here=!!cur&&z.id===cur.id;
      return pick({id:z.id,name:z.name,type:z.type,checked:here,disabled:!fits,detail:!fits?t('onlyFor',{type:z.type.toUpperCase()}):here?t('here'):n?count(n,'receivers1','receiversN'):t('emptyZone')});}).join('');
    // De zin "daarna zet je meteen de looprichting" en "Bekijk hoe" staan er alleen als die stap ook kan volgen: de zone
    // telt daarna 2 ledlines of meer (bij RGBW: 2 receivers). Met één ledline valt er niets te ordenen.
    const weight=x=>x.type==='spi'?linesOn(x):1,canNew=typeof onNewZone==='function';
    const follows=S.zones.some(z=>(!z.type||z.type===r.type)&&!(cur&&z.id===cur.id)&&inZone(S,z).reduce((sum,x)=>sum+(x.id===r.id?0:weight(x)),weight(r))>=2)||canNew&&weight(r)>=2;
    const el=subPage('rx-zonesheet',t(cur?'changeZone':'chooseZone'),r.name,
      `<div class="rx-zpicks" role="radiogroup" aria-label="${esc(t('zonesAria'))}">${zones}${pick({id:'',name:t('noZone'),detail:t(cur?'staysInStand':'here'),checked:!cur,none:true})}</div>`+
      (canNew?`<div class="rx-newzone" data-rx-newzone><button type="button" class="rx-newzone-open" data-rx="newzone">${IC.plus}<b>${esc(t('newZone'))}</b></button></div>`:'')+
      (follows?`<p class="rx-note">${esc(t(r.type==='spi'?'zoneNoteSpi':'zoneNoteRgbw'))}</p>${how('zone')}`:''));
    // de naam van een nieuwe zone: tekens die de app in een naam niet aanneemt, komen niet in het veld; de knop
    // "Zone maken" werkt zodra er een naam staat; Enter doet hetzelfde
    const nameTyped=event=>{
      const field=event.target.closest?.('[data-rx-zone-name]');if(!field)return;
      if(!event.isComposing&&NAME_BAD.test(field.value)){
        const at=field.value.slice(0,field.selectionStart??field.value.length).replace(NAME_BAD_ALL,'').length;
        field.value=field.value.replace(NAME_BAD_ALL,'');try{field.setSelectionRange(at,at);}catch(_){}
      }
      const make=el.querySelector('[data-rx="newzone-make"]');if(make)make.disabled=!nameOk(field.value);
    };
    el.addEventListener('input',nameTyped);el.addEventListener('compositionend',nameTyped);
    el.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.closest?.('[data-rx-zone-name]')){event.preventDefault();el.querySelector('[data-rx="newzone-make"]:not(:disabled)')?.click();}});
  }
  // "Nieuwe zone": de knop wordt een veld voor de naam met Annuleren en Zone maken; daarna doet de app de rest.
  function newZoneStep(page,step){
    const box=page.querySelector('[data-rx-newzone]');if(!box)return;
    if(step==='newzone'){
      box.innerHTML=`<label class="rx-field"><span>${esc(t('zoneName'))}</span><input type="text" maxlength="64" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" placeholder="${esc(t('zoneNameEg'))}" data-rx-zone-name></label>`+
        `<div class="rx-newzone-two"><button type="button" class="rx-newzone-cancel" data-rx="newzone-cancel">${esc(t('cancel'))}</button><button type="button" class="rx-newzone-make" data-rx="newzone-make" disabled>${esc(t('makeZone'))}</button></div>`;
      box.classList.add('is-open');const field=box.querySelector('input');field.focus({preventScroll:true});field.scrollIntoView({block:'center',behavior:reduce()?'auto':'smooth'});
    }else if(step==='newzone-cancel'){
      box.classList.remove('is-open');box.innerHTML=`<button type="button" class="rx-newzone-open" data-rx="newzone">${IC.plus}<b>${esc(t('newZone'))}</b></button>`;box.querySelector('button').focus({preventScroll:true});
    }else if(step==='newzone-make'){
      const name=String(box.querySelector('[data-rx-zone-name]')?.value??'').trim();if(!nameOk(name))return;
      const id=currentId;closeAll();safe(onNewZone,id,name);
    }
  }
  // ---------- info ----------
  function openInfo(){
    const S=read(),r=S.receivers.find(x=>x.id===currentId);if(!r)return;
    const level=r.signal==='strong'?'Sterk':r.signal==='good'?'Goed':r.signal==='weak'?'Zwak':'',row=(label,value)=>`<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
    subPage('rx-info',t('info'),r.name+' · '+typeName(r),`<dl class="rx-dl">`+
      (r.version?row(t('version'),esc(r.version)):'')+
      (r.online?(level?row(t('signal'),`<span class="rx-bars" data-lvl="${level}"><i></i><i></i><i></i><i></i></span>${esc(t(r.signal))}`):''):row(t('signal'),esc(t('unreachable'))))+
      row(t('outputs'),esc(t(r.type==='spi'?'outputsSpi':'outputsRgbw')))+row(t('name'),esc(t('nameOn',{name:r.label||r.name})))+`</dl>`);
  }
  // ---------- "Bekijk hoe": een korte animatie bij een instelling ----------
  function openHow(topic){
    if(topic!=='zone')return;
    const S=read(),names=S.zones.slice(0,2).map(z=>z.name);
    subPage('rx-howsheet',t('howZoneTitle'),t('how'),
      `<div class="rx-hw zone" aria-hidden="true"><span class="rx-hw-z a"><b>${esc(names[0]||'')}</b></span><span class="rx-hw-z b"><b>${esc(names[1]||'')}</b></span><i class="rx-hw-card"></i></div><p class="rx-psay">${esc(t('howZoneSay'))}</p>`);
  }
  // ---------- een ledline inpluggen ----------
  // Tik op het plusje van een uitgang zonder ledline: eerst schuift de ledline in de connector en gaat ze aan in de
  // kleur van haar poort (de opmaak doet dat met .is-plugging), dan pas krijgt de app de tik en opent de pixelkiezer.
  // Bewaart de klant daar niets (Sluiten, terug), dan staat de ledline nog uit: de connector gaat weer los.
  function plugIn(row,page){
    const port=row.dataset.ports;row.classList.add('is-plugging');
    const go=()=>{
      // heeft de app de pagina intussen opnieuw getekend, dan is het dezelfde ledline op de nieuwe pagina
      const now=row.isConnected?row:page.querySelector(`button.rx-line.off[data-ports="${CSS.escape(port)}"]`);
      if(!now||now.disabled||!page.isConnected){row.classList.remove('is-plugging');return;}   // de app is bezig of de pagina is weg: niets doen, de connector blijft los
      now.classList.add('is-plugging');now.dataset.rxPlug='go';
      try{now.click();}finally{now.dataset.rxPlug='';}
      let seen=false,saved=false,ticks=0;
      const onSave=event=>{if(event.target.closest?.('dialog.pixel-setup-dialog [data-pixel-action="save"]'))saved=true;};
      document.addEventListener('click',onSave,true);
      const timer=setInterval(()=>{
        ticks++;
        const open=!!document.querySelector('dialog.pixel-setup-dialog[open]');
        if(open)seen=true;
        // opnieuw getekend (de ledline staat aan) → klaar; niet bewaard, of de kiezer kwam niet → de connector gaat los
        if(!now.isConnected||!open&&(saved?ticks>60:seen||ticks>16)){clearInterval(timer);document.removeEventListener('click',onSave,true);now.classList.remove('is-plugging');}
      },250);
    };
    if(reduce())go();else setTimeout(go,PLUG_MS);
  }
  // ---------- een ledline uitzetten ----------
  // Tik op de connector van een ledline die aan staat: hij komt half los en het getal wordt een aan/uit-teken (de opmaak
  // doet dat met .is-unplugging). Een tweede tik, op dat teken of op de connector, geeft de tik door aan de app
  // (receiver-port-enabled): de ledline gaat uit en de pagina tekent haar met de losse connector. Geen tweede tik, of een
  // tik ergens anders: de connector klikt weer vast.
  const unplugTimers=new WeakMap();
  function unplugCancel(row){clearTimeout(unplugTimers.get(row));unplugTimers.delete(row);row.classList.remove('is-unplugging','is-busy');}
  function unplugAsk(row){
    row.classList.add('is-unplugging');clearTimeout(unplugTimers.get(row));
    unplugTimers.set(row,setTimeout(()=>{if(!row.classList.contains('is-busy'))unplugCancel(row);},UNPLUG_ASK_MS));
  }
  function unplugGo(row){
    const button=row.querySelector('button.rx-line-unplug');if(!button||button.disabled||row.classList.contains('is-busy'))return;
    clearTimeout(unplugTimers.get(row));row.classList.add('is-busy');
    // Na de tik van nu, niet erbinnen: een knop die zelf net aangetikt wordt, geeft een tweede click() niet door.
    setTimeout(()=>{
      if(!button.isConnected||button.disabled){unplugCancel(row);return;}
      button.dataset.rxUnplug='go';try{button.click();}finally{button.dataset.rxUnplug='';}
      // Gelukt: de app tekent de pagina opnieuw en deze rij is weg. Zolang de app bewaart, staat de knop uit. Staat hij
      // weer aan en is de rij er nog, dan is het niet gelukt (de app meldt dat zelf): de connector klikt weer vast.
      let ticks=0;const timer=setInterval(()=>{if(!row.isConnected){clearInterval(timer);return;}if(++ticks>=3&&!button.disabled){clearInterval(timer);unplugCancel(row);}},250);
    },0);
  }
  function onSheetClick(event){
    const target=event.target;if(!target.closest)return;
    const unplug=target.closest('button.rx-line-unplug[data-rx-unplug]'),asking=target.closest('.rx-line.is-unplugging');
    if(unplug?.dataset.rxUnplug==='go'){/* de tik die naar de app gaat */}
    else if(asking&&(unplug||target.closest('.rx-line-px'))){event.stopPropagation();event.preventDefault();unplugGo(asking);return;}
    else{
      // elke andere tik laat een wachtende connector weer vastklikken
      event.currentTarget.querySelectorAll('.rx-line.is-unplugging:not(.is-busy)').forEach(row=>{if(row!==unplug?.closest('.rx-line'))unplugCancel(row);});
      if(asking){event.stopPropagation();event.preventDefault();if(!asking.classList.contains('is-busy'))unplugCancel(asking);return;}   // tik op de strip van die rij: alleen terug vast
      if(unplug){event.stopPropagation();event.preventDefault();if(!unplug.disabled)unplugAsk(unplug.closest('.rx-line'));return;}
    }
    const plug=target.closest('button.rx-line.off[data-rx-plug]');
    if(plug&&plug.dataset.rxPlug!=='go'){   // 'go' = de tik die na het inpluggen naar de app gaat
      event.stopPropagation();event.preventDefault();
      if(!plug.disabled&&!plug.classList.contains('is-plugging'))plugIn(plug,event.currentTarget);
      return;
    }
    if(target.closest('[data-rx-close]')){if(stack.length&&stack[stack.length-1].el===event.currentTarget)closeTop();return;}
    const to=target.closest('[data-rx-zone-to]');
    if(to&&!to.disabled){
      // waar hij nu staat: alleen terug; anders: het rondje springt over, dan sluit alles en verplaatst de app hem
      if(to.getAttribute('aria-checked')==='true'){if(stack.length&&stack[stack.length-1].el===event.currentTarget)closeTop();return;}
      if(event.currentTarget.dataset.rxMoving)return;event.currentTarget.dataset.rxMoving='1';
      event.currentTarget.querySelectorAll('[data-rx-zone-to]').forEach(option=>option.setAttribute('aria-checked',String(option===to)));
      const id=currentId,zoneId=to.dataset.rxZoneTo||null,go=()=>{closeAll();safe(onMove,id,zoneId);};   // null = niet in een zone
      if(reduce())go();else setTimeout(go,170);
      return;
    }
    const nz=target.closest('button[data-rx^="newzone"]');if(nz){if(!nz.disabled)newZoneStep(event.currentTarget,nz.dataset.rx);return;}
    const hw=target.closest('[data-rx-how]');if(hw){openHow(hw.dataset.rxHow);return;}
    const own=target.closest('button[data-rx]');
    if(own&&!own.disabled){
      // een keuze in "Meer" neemt de plaats van dat vel in
      if(event.currentTarget.classList.contains('rx-moresheet')&&stack.length&&stack[stack.length-1].el===event.currentTarget)closeTop();
      ({order:()=>safe(onOrder,currentId),zone:openZone,info:openInfo,more:openMore})[own.dataset.rx]?.();return;}
    // een receiver toevoegen verlaat deze pagina: de vellen gaan dicht, de app doet de rest (data-action)
    if(target.closest('button[data-action="receiver-add"]'))closeAll();
    // verwijderen en software-update openen een venster van de app: het vel "Meer" gaat dicht, de receiverpagina blijft eronder
    else if(target.closest('button[data-action="receiver-remove"],button[data-action="receiver-update"]')&&event.currentTarget.classList.contains('rx-moresheet')&&stack.length&&stack[stack.length-1].el===event.currentTarget)closeTop();
  }
  // De app heeft opnieuw getekend: de open receiverpagina volgt (of sluit, als de receiver weg is).
  function refresh(){
    if(!stack.length)return;
    setLang();const S=read(),page=stack.find(entry=>entry.el.dataset.rxReceiver);
    if(!page)return;
    const r=S.receivers.find(x=>x.id===page.el.dataset.rxReceiver);
    if(!r){closeAll();return;}
    if(stack[stack.length-1]!==page)return;   // er ligt nog een vel boven: dat blijft zoals het is
    const panel=page.el.querySelector('.rx-panel'),top=panel.scrollTop,focus=document.activeElement?.closest?.('.rx-panel')===panel?document.activeElement:null;
    const which=el=>el?.dataset.ports||el?.dataset.port||'',key=focus?.dataset.rx||focus?.dataset.action||'',ports=which(focus);   // dezelfde knop van dezelfde ledline
    const html=pageHtml(S,r);if(page.html===html)return;page.html=html;
    panel.innerHTML=html;panel.scrollTop=top;fitPics(page.el);
    if(key)[...panel.querySelectorAll('button')].find(b=>(b.dataset.rx||b.dataset.action||'')===key&&which(b)===ports)?.focus({preventScroll:true});
  }
  return Object.freeze({listHtml,bind,refresh,openReceiver,closeAll,isOpen:()=>stack.length>0,current:()=>currentId});
}
window.LightningReceiversTab=Object.freeze({create});
})();
