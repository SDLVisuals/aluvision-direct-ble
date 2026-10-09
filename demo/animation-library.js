/* Pure display grouping/search. Original effect IDs, recipes, order within a
 * family and availability remain owned by preview.catalog(); no hardware API. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningAnimationLibrary = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CATEGORIES = Object.freeze([
    Object.freeze({key:'whole',title:'Kleur & sfeer',summary:'Kleur of helderheid verandert tegelijk op alle ledlines.',aliases:'hele lijn volledig gelijk samen uniform rgbw'}),
    Object.freeze({key:'pixels',title:'Bewegend licht',summary:'Beweging over pixels: bijvoorbeeld golven of lopend licht.',aliases:'pixel pixels pixelanimatie pixelanimaties led strip spi'}),
    Object.freeze({key:'tunnel',title:'Tunnel',summary:'Licht reist tussen twee of meer ledlines.',aliases:'tunnel tunnel-effect tunnelanimatie wand wanden wall walls muur muren diepte receiver receivers boog bogen achter elkaar ruimte architectuur'}),
    Object.freeze({key:'brand',title:'Brand animaties',summary:'Rustige kleur- en lichteffecten voor je merk en beursstand.',aliases:'brand brandanimaties huisstijl merk beurs stand presentatie corporate'})
  ]);
  const descriptor = (key, title, summary, aliases = '') => Object.freeze({key,title,summary,aliases});
  const DEFINITIONS = Object.freeze({
    whole:Object.freeze([
      descriptor('colour','Kleurwissel','Vaste kleuren wisselen of vloeien in elkaar over.','kleur kleuren wisselen regenboog rainbow rgb gradient jumping'),
      descriptor('pulse','Ademen & pulsen','Alle ledlines worden rustig lichter en donkerder.','pulse puls pulsen ademen ademend ademhaling breathe breathing fade'),
      descriptor('flow','Zachte overgangen','Kleuren mengen geleidelijk, zonder harde sprongen.','flow gradient verloop kleurverloop vloeien zacht overgang fade'),
      descriptor('flash','Flitsen','Korte lichtflitsen; kan ook snel knipperen.','sparkle flash strobe flits flitsen knipperen theater')
    ]),
    pixels:Object.freeze([
      descriptor('flow','Kleurverloop','Kleuren vloeien zacht over de pixels.','flow gradient verloop kleurverloop vloeien zacht overgang fade'),
      descriptor('pulse','Ademen','Het licht ademt of pulseert binnen de lijn.','pulse puls pulsen ademen ademhaling ademend breathe breathing'),
      descriptor('wave','Golven','Golven bewegen over de pixels.','wave golf golven golfbeweging ripple rimpel'),
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
      descriptor('reference','Lichtbanen & contouren','Lichtbanen, kleurpakketjes en contouren over meerdere ledlines.','video videos referentie plafond contour lint pakket amber'),
      descriptor('waves','Golven & pulsen','Een golf of puls reist van receiver naar receiver.','golf golven lichtgolf licht golf wave ripple puls pulse ademen echo heen terug pendulum'),
      descriptor('travel','Reizend licht','Een lichtpunt of bundel trekt door de opstelling.','chase comet komeet meteoor scanner sweep reizen looplicht diepte'),
      descriptor('symmetry','Midden & symmetrie','Licht opent naar buiten of beweegt naar het midden.','mirror spiegel spiegelen midden center centre outside binnen buiten symmetrisch kruis cross'),
      descriptor('build','Opbouwen & doorgeven','Receivers lichten één voor één op en doven weer uit.','sequence volgorde opbouwen cascade doorgeven relay stappen build'),
      descriptor('colour','Kleur doorgeven','Kleuren wisselen soepel tussen de receivers.','flow gradient kleurwissel kleuren kleurverloop colour color relay overgang'),
      descriptor('alternate','Flitsen & afwisselen','Receivers flitsen of wisselen elkaar af.','sparkle strobe flash flits knipperen alternate alternating om en om'),
      descriptor('pixels','Pixelgolven','Beweging in elke pixellijn reist door naar de volgende.','pixel pixelgordijn gordijn curtain kruisende pixelgolven cross')
    ]),
    brand:Object.freeze([
      descriptor('reference','Rustig voor je beursstand','Vloeiende merkkleuren en zachte lichtaccenten.','video videos referentie merk contour lint zijde rustig beurs'),
      descriptor('white','Wit & warme sfeer','Rustig wit, warm licht en zachte overgangen.','wit warm warmwit white breathe ademen ademend rustig avond presentatie'),
      descriptor('colour','Kleur door de ruimte','Je gekozen kleur vloeit rustig over de ledlines.','brand corporate huisstijl merk kleur kleuren accent gradient verloop flow golf beurs welkom'),
      descriptor('pulse','Zachte kleurpuls','Een gekozen kleur ademt rustig op en neer.','pulse pulseren ademen ademend ritme'),
      descriptor('focus','Lichtaccent & focus','Een lichtaccent beweegt rustig naar een product toe.','productfocus product highlight sweep gloed focus aandacht lichtaccent chase lopend licht'),
      descriptor('sparkle','Subtiele schittering','Kleine lichtaccenten twinkelen zonder onrustig te worden.','twinkel schitter glans luxe shimmer sprankel')
    ])
  });
  const PIXEL_FAMILIES = Object.freeze({Flow:'flow',Pulse:'pulse',Wave:'wave',Chase:'chase',Comet:'comet',Scanner:'scanner',Spiegel:'mirror',Sparkle:'sparkle',Sequence:'sequence',Afwisseling:'alternate',Accent:'accent','Warm wit':'warm'});
  const TUNNEL_IDS = Object.freeze({
    'v30-tunnel-travel':'waves','v30-tunnel-bounce':'waves','v30-tunnel-pulse':'waves','v30-tunnel-echo':'waves',
    'v30-tunnel-center':'symmetry','v30-tunnel-outside':'symmetry','v30-tunnel-cascade':'build','v30-tunnel-handoff':'build',
    'v30-tunnel-pixel-curtain':'pixels','v30-tunnel-pixel-cross':'pixels'
  });
  const TUNNEL_ENGINES = Object.freeze({WAVE:'waves',BREATHE:'waves',CHASE:'travel',SCANNER:'travel',COMET:'travel',MIRROR:'symmetry',DUAL:'symmetry',CASCADE:'build',SEQUENCE:'build',FLOW:'colour',GRADIENT:'colour',SPARKLE:'alternate',ALTERNATE:'alternate'});
  const BRAND_IDS = Object.freeze({
    'v30-brand-white-breathe':'white','v30-brand-warm-white':'white','v30-brand-accent':'colour','v30-brand-soft-gradient':'colour','v30-brand-sweep':'focus','v30-brand-focus':'focus',
    'spi-flow-47':'colour','spi-flow-48':'white','spi-warm-49':'white',
    'spi-flow-73':'colour','spi-breathe-74':'pulse','spi-chase-75':'focus',
    'spi-flow-76':'colour','spi-flow-77':'colour','spi-breathe-78':'pulse','spi-breathe-79':'white',
    'spi-chase-80':'focus','spi-sparkle-81':'sparkle','spi-flow-82':'colour','spi-breathe-84':'white','spi-warm-85':'white'
  });
  const BRAND_NAMES = Object.freeze({
    'spi-flow-47':'Merkaccent','spi-flow-48':'Witte accentgolf','spi-warm-49':'Warm wit in beweging',
    'spi-flow-73':'Meerkleurige merkflow','spi-breathe-74':'Kleur die rustig ademt','spi-chase-75':'Lopend merkaccent',
    'spi-flow-76':'Beursgolf','spi-flow-77':'Welkomsgolf','spi-breathe-78':'Zachte presentatiepuls','spi-breathe-79':'Avondsfeer',
    'spi-chase-80':'Productaccent','spi-sparkle-81':'Luxe schittering','spi-flow-82':'Rustige kleurgolf',
    'spi-breathe-84':'Wit in beweging','spi-warm-85':'Warm naar zacht wit'
  });
  // A small, contrasting introduction. These are references to the existing
  // recipes, never a second catalogue or a change to stored effect identities.
  const STARTERS = Object.freeze([
    {key:'Breathe',ids:['rgbw-breathe-1','spi-breathe-99'],title:'Zacht ademen',summary:'De ledlines worden rustig lichter en donkerder.'},
    {key:'Colour',ids:['v30-rgb-jumping'],title:'Kleurwissel',summary:'Rood, groen en blauw wisselen elkaar direct af.'},
    {key:'Chase',ids:['spi-chase-8'],title:'Lopend licht',summary:'Een lichtpunt loopt over de pixels.'},
    {key:'Wave',ids:['spi-wave-29'],title:'Lichtgolf',summary:'Een zachte golf beweegt over de pixels.'},
    {key:'Gradient',ids:['rgbw-gradient-2'],title:'Kleurverloop',summary:'De ledlines veranderen zacht van kleur.'},
    {key:'Warm',ids:['v30-brand-warm-white'],title:'Warm naar wit',summary:'Een warme witmix gaat rustig over in zacht wit.'}
  ]);
  function text(key,fallback,translate,params={}) {
    if(typeof translate!=='function')return fallback;
    const value=translate(key,params);return typeof value==='string'&&value!==key?value:fallback;
  }
  function starters(items,translate) {
    const hasPixels=items.some(effect=>effect.category==='pixels');
    return Object.freeze(STARTERS.filter(item=>!hasPixels||!['Kleurverloop','Warm naar wit'].includes(item.title)).flatMap(item=>{
      const effect=items.find(effect=>item.ids.includes(effect.id));
      return effect?[Object.freeze({effect,key:item.key,title:text('animationStarter'+item.key,item.title,translate),summary:text('animationStarter'+item.key+'Hint',item.summary,translate)})]:[];
    }));
  }
  function displayName(effect,translate) {
    if(effect.id==='v30-tunnel-pulse'&&effect.standMode==='coordinated'&&Array.isArray(effect.supportedTypes)&&effect.supportedTypes.includes('RGBW')&&effect.supportedTypes.includes('SPI'))return text('v50AnimationStandPulseName',effect.standName||effect.name,translate);
    const starter=STARTERS.find(item=>item.ids.includes(effect.id));
    return starter?text('animationStarter'+starter.key,starter.title,translate):BRAND_NAMES[effect.id]||effect.id.startsWith('v30-')||effect.id.startsWith('v31-ref-')?text('v50AnimationName:'+effect.id,BRAND_NAMES[effect.id]||effect.name,translate):effect.name;
  }
  const FALLBACK = descriptor('other','Overige bewegingen','Meer animaties uit deze categorie.','overig overige');
  const normalize = value => String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('nl').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
  const category = key => CATEGORIES.find(item => item.key === key) || null;
  function categoryInfo(key,translate) {
    const section=category(key);return section?Object.freeze({...section,title:text('v50AnimationCategory:'+key+':title',section.title,translate),summary:text('v50AnimationCategory:'+key+':summary',section.summary,translate)}):null;
  }
  const categoriesFor=translate=>Object.freeze(CATEGORIES.map(section=>categoryInfo(section.key,translate)));
  function classification(effect) {
    if (!effect || !category(effect.category)) return null;
    if(effect.id.startsWith('v31-ref-'))return DEFINITIONS[effect.category].find(item=>item.key==='reference');
    let key;
    if (effect.category === 'whole') key = ({Kleurwissel:'colour',Pulse:'pulse',Flow:'flow',Sparkle:'flash'})[effect.family];
    if (effect.category === 'pixels') key = PIXEL_FAMILIES[effect.family];
    if (effect.category === 'tunnel') key = TUNNEL_IDS[effect.id] || TUNNEL_ENGINES[effect.state?.engine];
    if (effect.category === 'brand') key = BRAND_IDS[effect.id];
    return DEFINITIONS[effect.category].find(item => item.key === key) || FALLBACK;
  }
  function groups(items, selectedCategory = 'catalogue',translate) {
    if (!Array.isArray(items)) throw new TypeError('An animation catalog is required');
    if(typeof selectedCategory==='function'){translate=selectedCategory;selectedCategory='catalogue';}
    const selected = selectedCategory === 'all' ? 'catalogue' : selectedCategory;
    if (selected !== 'catalogue' && !category(selected)) return [];
    const result = [];
    for (const section of CATEGORIES) {
      if (selected !== 'catalogue' && selected !== section.key) continue;
      for (const family of [...DEFINITIONS[section.key],FALLBACK]) {
        const effects = items.filter(effect => effect.category === section.key && classification(effect).key === family.key);
        if (!effects.length) continue;
        const count = effects.length, extra = count - 1;
        const prefix='v50AnimationGroup:'+(family.key==='other'?'other':section.key+':'+family.key);
        result.push(Object.freeze({key:section.key + ':' + family.key,title:text(prefix+':title',family.title,translate),summary:text(prefix+':summary',family.summary,translate),
          category:section.key,categoryTitle:categoryInfo(section.key,translate).title,effects:Object.freeze(effects),preview:effects[0],
          count,additionalCount:extra,totalLabel:text(count===1?'animationCountOne':'animationCountMany',count + (count === 1 ? ' animatie' : ' animaties'),translate,{count}),
          variantLabel:extra?text(extra===1?'v50AnimationAdditionalVariantOne':'v50AnimationAdditionalVariantMany','+ ' + extra + (extra === 1 ? ' variant' : ' varianten'),translate,{count:extra}):text('viewAnimation','Bekijk animatie',translate)}));
      }
    }
    return Object.freeze(result);
  }
  function group(items, key,translate) { return groups(items,'catalogue',translate).find(item => item.key === key) || null; }
  function sections(items,translate) {
    return Object.freeze(CATEGORIES.map(section => {
      const families = groups(items,section.key,translate),info=categoryInfo(section.key,translate);
      return Object.freeze({key:section.key,title:info.title,summary:info.summary,groups:families,count:families.reduce((sum,family) => sum + family.count,0)});
    }).filter(section => section.count > 0));
  }
  function search(items, query = '',translate) {
    const terms = normalize(query).split(' ').filter(Boolean);
    const phrase=terms.join(' ');
    const categoryMatch=CATEGORIES.find(section=>normalize(section.title)===phrase||normalize(categoryInfo(section.key,translate).title)===phrase||terms.length===1&&normalize(section.aliases).split(' ').includes(phrase));
    if(categoryMatch)return items.filter(effect=>effect.category===categoryMatch.key);
    const ordered = groups(items).flatMap(family => family.effects);
    if (!terms.length) return ordered;
    return ordered.map((effect,index) => {
      const family = classification(effect), section = category(effect.category);
      const prefix='v50AnimationGroup:'+(family.key==='other'?'other':section.key+':'+family.key),localCategory=categoryInfo(section.key,translate),localFamilyTitle=text(prefix+':title',family.title,translate),localFamilySummary=text(prefix+':summary',family.summary,translate);
      const standPulse=effect.id==='v30-tunnel-pulse'&&effect.standMode==='coordinated'&&Array.isArray(effect.supportedTypes)&&effect.supportedTypes.includes('RGBW')&&effect.supportedTypes.includes('SPI');
      const description=text(standPulse?'v50AnimationStandPulseDescription':'v50AnimationDescription:'+effect.id,effect.description,translate);
      const name = normalize(displayName(effect,translate)), familyText = normalize([effect.family,family.title,localFamilyTitle,family.aliases].join(' '));
      const haystack = normalize([effect.name,displayName(effect),displayName(effect,translate),effect.family,effect.description,description,family.title,localFamilyTitle,family.summary,localFamilySummary,family.aliases,section.title,localCategory.title,localCategory.summary,section.aliases].join(' '));
      if (!terms.every(term => haystack.includes(term))) return null;
      const full = terms.join(' ');
      const rank = name === full ? 4 : name.startsWith(full) ? 3 : terms.every(term => name.includes(term)) ? 2 : terms.every(term => familyText.includes(term)) ? 1 : 0;
      return {effect,index,rank};
    }).filter(Boolean).sort((a,b) => b.rank - a.rank || a.index - b.index).map(item => item.effect);
  }
  return Object.freeze({categories:CATEGORIES,categoriesFor,categoryInfo,groups,group,sections,search,normalize,starters,displayName});
}));
