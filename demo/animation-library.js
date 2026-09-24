/* Pure display grouping/search. Original effect IDs, recipes, order within a
 * family and availability remain owned by preview.catalog(); no hardware API. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningAnimationLibrary = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CATEGORIES = Object.freeze([
    Object.freeze({key:'whole',title:'Kleur & sfeer',summary:'De hele lichtlijn verandert samen van kleur of helderheid.',aliases:'hele lijn volledig gelijk samen uniform rgbw'}),
    Object.freeze({key:'pixels',title:'Bewegend licht',summary:'Licht beweegt over de pixels, bijvoorbeeld als golf of lopend licht.',aliases:'pixel pixels pixelanimatie pixelanimaties led strip spi'}),
    Object.freeze({key:'tunnel',title:'Tunnel',summary:'Licht reist tussen twee of meer lichtlijnen.',aliases:'tunnel diepte receiver receivers boog bogen achter elkaar'}),
    Object.freeze({key:'brand',title:'Huisstijl',summary:'Rustig wit en zachte accenten voor je huisstijl.',aliases:'brand huisstijl merk beurs stand presentatie corporate'})
  ]);
  const descriptor = (key, title, summary, aliases = '') => Object.freeze({key,title,summary,aliases});
  const DEFINITIONS = Object.freeze({
    whole:Object.freeze([
      descriptor('colour','Kleurwissel','Vaste kleuren wisselen of vloeien in elkaar over.','kleur kleuren wisselen regenboog rainbow rgb gradient jumping'),
      descriptor('pulse','Ademen & pulsen','De hele lijn wordt rustig lichter en donkerder.','pulse puls pulsen ademen ademend ademhaling breathe breathing fade'),
      descriptor('flow','Zachte overgangen','Kleuren mengen geleidelijk, zonder harde sprongen.','flow gradient verloop kleurverloop vloeien zacht overgang fade'),
      descriptor('flash','Flitsen','Korte lichtflitsen; kan ook snel knipperen.','sparkle flash strobe flits flitsen knipperen theater')
    ]),
    pixels:Object.freeze([
      descriptor('flow','Kleurverloop','Kleuren vloeien zacht over de pixels.','flow gradient verloop kleurverloop vloeien zacht overgang fade'),
      descriptor('pulse','Ademen','Het licht ademt of pulseert binnen de lijn.','pulse puls pulsen ademen ademhaling ademend breathe breathing'),
      descriptor('wave','Golven','Golven bewegen door de lichtlijn.','wave golf golven golfbeweging ripple rimpel'),
      descriptor('chase','Lopend licht','Lichtpunten volgen elkaar over de lijn.','chase looplicht lopen lopend achtervolgen jagen runner running'),
      descriptor('comet','Komeet','Een lichtpunt trekt een zachte staart achter zich aan.','comet komeet kometen meteoor meteor staart trail ribbon'),
      descriptor('scanner','Scanner','Een lichtbundel veegt over de lijn.','scannen veeg vegen sweep heen en weer'),
      descriptor('mirror','Spiegel','Licht beweegt symmetrisch naar binnen of buiten.','mirror spiegelen symmetrie symmetrisch midden center centre buiten'),
      descriptor('sparkle','Twinkelen','Kleine lichtaccenten twinkelen of flitsen.','sparkle twinkelen twinkel fonkelen schitteren shimmer glitter strobe flits'),
      descriptor('sequence','Stap voor stap','Het licht bouwt stap voor stap een patroon op.','sequence volgorde opbouwen stappen opeenvolgen cascade reeks'),
      descriptor('alternate','Afwisseling','Lichtdelen wisselen elkaar om en om af.','alternate alternating afwisselen om en om'),
      descriptor('accent','Accent','Subtiele lichtaccenten trekken rustig de aandacht.','minimal subtiel focus aandacht'),
      descriptor('warm','Warm wit','Warme kleurmixen en zachte wittinten.','warmwit warm white amber wit temperatuur')
    ]),
    tunnel:Object.freeze([
      descriptor('waves','Golven & pulsen','Een golf of puls reist van receiver naar receiver.','golf golven lichtgolf licht golf wave ripple puls pulse ademen echo heen terug pendulum'),
      descriptor('travel','Reizend licht','Een lichtpunt of bundel trekt door de opstelling.','chase comet komeet meteoor scanner sweep reizen looplicht diepte'),
      descriptor('symmetry','Midden & symmetrie','Licht opent naar buiten of beweegt naar het midden.','mirror spiegel spiegelen midden center centre outside binnen buiten symmetrisch kruis cross'),
      descriptor('build','Opbouwen & doorgeven','Receivers lichten één voor één op en doven weer uit.','sequence volgorde opbouwen cascade doorgeven relay stappen build'),
      descriptor('colour','Kleur doorgeven','Kleuren wisselen soepel tussen de receivers.','flow gradient kleurwissel kleuren kleurverloop colour color relay overgang'),
      descriptor('alternate','Flitsen & afwisselen','Receivers flitsen of wisselen elkaar af.','sparkle strobe flash flits knipperen alternate alternating om en om'),
      descriptor('pixels','Pixelgolven','Beweging in elke pixellijn reist door naar de volgende.','pixel pixelgordijn gordijn curtain kruisende pixelgolven cross')
    ]),
    brand:Object.freeze([
      descriptor('white','Wit & sfeer','Rustig wit ademt of verschuift naar een warme mix.','wit warm warmwit white breathe ademen ademend sfeer rustig'),
      descriptor('colour','Huisstijl & kleur','Je huisstijlkleur mengt subtiel met een witte basis.','brand corporate huisstijl merk kleur kleuren accent gradient verloop'),
      descriptor('focus','Lichtaccent & focus','Een zachte gloed of focuspunt trekt de aandacht.','productfocus product highlight sweep gloed focus aandacht lichtaccent')
    ])
  });
  const PIXEL_FAMILIES = Object.freeze({Flow:'flow',Pulse:'pulse',Wave:'wave',Chase:'chase',Comet:'comet',Scanner:'scanner',Spiegel:'mirror',Sparkle:'sparkle',Sequence:'sequence',Afwisseling:'alternate',Accent:'accent','Warm wit':'warm'});
  const TUNNEL_IDS = Object.freeze({
    'v30-tunnel-travel':'waves','v30-tunnel-bounce':'waves','v30-tunnel-pulse':'waves','v30-tunnel-echo':'waves',
    'v30-tunnel-center':'symmetry','v30-tunnel-outside':'symmetry','v30-tunnel-cascade':'build','v30-tunnel-handoff':'build',
    'v30-tunnel-pixel-curtain':'pixels','v30-tunnel-pixel-cross':'pixels'
  });
  const TUNNEL_ENGINES = Object.freeze({WAVE:'waves',BREATHE:'waves',CHASE:'travel',SCANNER:'travel',COMET:'travel',MIRROR:'symmetry',DUAL:'symmetry',CASCADE:'build',SEQUENCE:'build',FLOW:'colour',GRADIENT:'colour',SPARKLE:'alternate',ALTERNATE:'alternate'});
  const BRAND_IDS = Object.freeze({'v30-brand-white-breathe':'white','v30-brand-warm-white':'white','v30-brand-accent':'colour','v30-brand-soft-gradient':'colour','v30-brand-sweep':'focus','v30-brand-focus':'focus'});
  // A small, contrasting introduction. These are references to the existing
  // recipes, never a second catalogue or a change to stored effect identities.
  const STARTERS = Object.freeze([
    {ids:['rgbw-breathe-1','spi-breathe-99'],title:'Zacht ademen',summary:'De hele lichtlijn wordt rustig lichter en donkerder.'},
    {ids:['v30-rgb-jumping'],title:'Kleurwissel',summary:'Rood, groen en blauw wisselen elkaar direct af.'},
    {ids:['spi-chase-8'],title:'Lopend licht',summary:'Een lichtpunt loopt over de pixels van de lichtlijn.'},
    {ids:['spi-wave-29'],title:'Lichtgolf',summary:'Een zachte golf beweegt over de pixels.'},
    {ids:['rgbw-gradient-2'],title:'Kleurverloop',summary:'De hele lichtlijn vloeit zacht van kleur naar kleur.'},
    {ids:['v30-brand-warm-white'],title:'Warm naar wit',summary:'Warm licht gaat rustig over in neutraal wit.'}
  ]);
  function starters(items) {
    const hasPixels=items.some(effect=>effect.category==='pixels');
    return Object.freeze(STARTERS.filter(item=>!hasPixels||!['Kleurverloop','Warm naar wit'].includes(item.title)).flatMap(item=>{
      const effect=items.find(effect=>item.ids.includes(effect.id));
      return effect?[Object.freeze({effect,title:item.title,summary:item.summary})]:[];
    }));
  }
  function displayName(effect) { return STARTERS.find(item=>item.ids.includes(effect.id))?.title||effect.name; }
  const FALLBACK = descriptor('other','Overige bewegingen','Meer animaties uit deze categorie.','overig overige');
  const normalize = value => String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('nl').replace(/[^a-z0-9]+/g,' ').trim();
  const category = key => CATEGORIES.find(item => item.key === key) || null;
  function classification(effect) {
    if (!effect || !category(effect.category)) return null;
    let key;
    if (effect.category === 'whole') key = ({Kleurwissel:'colour',Pulse:'pulse',Flow:'flow',Sparkle:'flash'})[effect.family];
    if (effect.category === 'pixels') key = PIXEL_FAMILIES[effect.family];
    if (effect.category === 'tunnel') key = TUNNEL_IDS[effect.id] || TUNNEL_ENGINES[effect.state?.engine];
    if (effect.category === 'brand') key = BRAND_IDS[effect.id];
    return DEFINITIONS[effect.category].find(item => item.key === key) || FALLBACK;
  }
  function groups(items, selectedCategory = 'catalogue') {
    if (!Array.isArray(items)) throw new TypeError('An animation catalog is required');
    const selected = selectedCategory === 'all' ? 'catalogue' : selectedCategory;
    if (selected !== 'catalogue' && !category(selected)) return [];
    const result = [];
    for (const section of CATEGORIES) {
      if (selected !== 'catalogue' && selected !== section.key) continue;
      for (const family of [...DEFINITIONS[section.key],FALLBACK]) {
        const effects = items.filter(effect => effect.category === section.key && classification(effect).key === family.key);
        if (!effects.length) continue;
        const count = effects.length, extra = count - 1;
        result.push(Object.freeze({key:section.key + ':' + family.key,title:family.title,summary:family.summary,
          category:section.key,categoryTitle:section.title,effects:Object.freeze(effects),preview:effects[0],
          count,additionalCount:extra,totalLabel:count + (count === 1 ? ' animatie' : ' animaties'),
          variantLabel:extra ? '+ ' + extra + (extra === 1 ? ' variant' : ' varianten') : 'Bekijk animatie'}));
      }
    }
    return Object.freeze(result);
  }
  function group(items, key) { return groups(items).find(item => item.key === key) || null; }
  function sections(items) {
    return Object.freeze(CATEGORIES.map(section => {
      const families = groups(items,section.key);
      return Object.freeze({key:section.key,title:section.title,summary:section.summary,groups:families,count:families.reduce((sum,family) => sum + family.count,0)});
    }).filter(section => section.count > 0));
  }
  function search(items, query = '') {
    const terms = normalize(query).split(' ').filter(Boolean);
    const ordered = groups(items).flatMap(family => family.effects);
    if (!terms.length) return ordered;
    return ordered.map((effect,index) => {
      const family = classification(effect), section = category(effect.category);
      const name = normalize(displayName(effect)), familyText = normalize([effect.family,family.title,family.aliases].join(' '));
      const haystack = normalize([effect.name,displayName(effect),effect.family,effect.description,family.title,family.summary,family.aliases,section.title,section.aliases].join(' '));
      if (!terms.every(term => haystack.includes(term))) return null;
      const full = terms.join(' ');
      const rank = name === full ? 4 : name.startsWith(full) ? 3 : terms.every(term => name.includes(term)) ? 2 : terms.every(term => familyText.includes(term)) ? 1 : 0;
      return {effect,index,rank};
    }).filter(Boolean).sort((a,b) => b.rank - a.rank || a.index - b.index).map(item => item.effect);
  }
  return Object.freeze({categories:CATEGORIES,groups,group,sections,search,normalize,starters,displayName});
}));
