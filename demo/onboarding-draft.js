/* V30 consumer setup draft. PURE UI CHOICES, NOT A SECURITY IMPLEMENTATION.
 *
 * A draft never contains a PIN, credential handle, Wi-Fi password, recovery
 * key, verifier, raw receipt, light state or a complete copy of the app model.
 * No transition writes storage, contacts a receiver or inserts a pending unit
 * into the model. A caller keeps ephemeral PIN input in its private closure.
 * The existing onboarding-contract/adapter remain the MAIN security basis;
 * a real authenticated NODE enrollment adapter is required separately.
 *
 * Sequence (V30 brief, not the older V21 late-PIN flow):
 * stand -> zones -> receiver -> [compatible placement] -> [SPI outputs -> each port]
 * -> [MAIN PIN] -> security/rejoin/identity -> zone -> review -> added.
 * Once security starts, choices identifying/configuring the receiver lock.
 * Cancel/retry preserves the same transaction; it never releases ownership,
 * resets a receiver, starts another claim or falls back to open Wi-Fi.
 *
 * API:
 * create({model, transactionId, standId?, activeZoneId?}) -> immutable draft.
 * transition(draft,event) / providePin(draft,pin,repeat) -> {draft,error}.
 * snapshot(draft), steps(draft), configuration(draft), validatePin(pin,repeat).
 * refreshZones(draft,model) refreshes only unlocked setup placement choices.
 * All SET_ events only edit choices; NEXT advances, per output where needed.
 * RGBW is one physical lighting unit and has no output/pixel/side steps.
 *
 * createCommitter({verifyFinalReceipt}) is an explicit trusted adapter seam:
 * confirmSecurity(draft,receiptRef) verifies identity, then allows zone choice;
 * finish(model,draft,receiptRef) verifies final membership, then returns a NEW
 * model. Neither is cryptography. The injected verifier MUST authenticate the
 * receiver/network proof, durable config, ownership, generation and expected
 * identity through the security adapter, never trust a UI boolean/native join.
 * verifyFinalReceipt({receiptRef,purpose,expected}) must return exactly:
 * {kind:'security-confirmed'|'receiver-added', configuration: expected}.
 * This deliberately narrow verified result is NOT an event accepted from UI.
 * `expected` includes exact transaction, stand, physical identity, role, MAIN,
 * output configuration and (for finalization) destination zone. An unavailable
 * provider fails closed. Opaque refs are consumed here, not retained in drafts.
 *
 * The returned model still needs atomic app persistence by the integration;
 * this module does not claim that persistence or physical setup succeeded.
 */
(function (root, factory) {
  'use strict';
  const common = typeof module === 'object' && module.exports;
  const api = factory(common ? require('./model.js') : root.LightningModel,
    common ? require('./onboarding-contract.js') : root.LightningOnboardingContract,
    common ? null : root.AluvisionSecurityMode);
  if (common) module.exports = api;
  else root.LightningOnboardingDraft = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Model, Contract, SecurityMode) {
  'use strict';
  const STAGES = Object.freeze(['stand','zones','receiver','placement','outputs','pixels','connection','pin','security','zone','review','done']);
  const PHASES = Object.freeze(['idle','configuring','claiming','reconnecting','verifying','resuming','identity-confirmed']);
  // A single generated build setting controls whether commissioning asks for
  // credentials. Node/unit tests without the generated script retain PIN mode.
  const pinRequired=()=> SecurityMode?.pinRequired !== false;
  const own = (value,key) => Object.prototype.hasOwnProperty.call(value,key);
  const plain = value => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
  const copy = value => JSON.parse(JSON.stringify(value));
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  const fail = (code,message) => { const error = new Error(message); error.code = code; throw error; };
  const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value);
  const int = (value,min,max) => Number.isInteger(value) && value >= min && value <= max;
  const hex = (value,length) => typeof value === 'string' && value.length === length && /^[0-9A-F]+$/.test(value) && !/^0+$/.test(value);
  // Swift dictionaries cross the bridge without a guaranteed key order.
  // Compare exact JSON structure, retaining types, keys and output-array order.
  const same = (left,right) => {
    if (left === right) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
      if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
      for (let i=0;i<left.length;i++) if (!own(left,i) || !own(right,i) || !same(left[i],right[i])) return false;
      return true;
    }
    if (!plain(left) || !plain(right)) return false;
    const keys=Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => own(right,key) && same(left[key],right[key]));
  };
  function shape(value,keys,code='DRAFT_INPUT') {
    if (!plain(value) || Object.keys(value).some(key => !keys.includes(key)) || ['__proto__','constructor','prototype'].some(key => own(value,key))) fail(code,'Onbekende of ongeldige instelgegevens.');
  }
  function name(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 64 || /[<>\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(value)) fail('NAME','Kies een gewone naam van 1 tot 64 tekens.');
    return value.trim();
  }
  function validOutput(output,index,allowZero=false) {
    shape(output,['port','enabled','pixels','reversed'],'OUTPUT');
    if (output.port !== index + 1 || typeof output.enabled !== 'boolean' || !int(output.pixels,allowZero?0:1,Model.LIMITS.pixelsPerPort) || typeof output.reversed !== 'boolean') fail('OUTPUT','Controleer de pixels en aansluiting van elke uitgang.');
  }
  function validateReceiver(receiver) {
    shape(receiver,['id','rid','name','type','deviceFingerprint'],'RECEIVER');
    if (!id(receiver.id) || !hex(receiver.rid,16) || !hex(receiver.deviceFingerprint,64) || !['RGBW','SPI'].includes(receiver.type)) fail('RECEIVER_IDENTITY','De gevonden receiver heeft nog geen bevestigbare identiteit.');
    name(receiver.name);
  }
  function validateZone(zone) {
    shape(zone,['id','name','type','layout','isNew','pixels'],'ZONE');
    if (!id(zone.id) || ![null,'RGBW','SPI'].includes(zone.type) || !['stacked','vertical','continuous'].includes(zone.layout) || zone.type === 'RGBW' && zone.layout === 'continuous' || typeof zone.isNew !== 'boolean' || !int(zone.pixels,0,524288)) fail('ZONE','Deze zone kan niet worden gebruikt.');
    name(zone.name);
  }
  function snapshot(value) {
    shape(value,['version','transactionId','stage','stand','zones','receiver','role','mainReceiverId','outputs','port','zoneId','activeZoneId','zoneChoiceRequired','security','cancelled','membership','context'],'DRAFT');
    if(own(value,'zoneChoiceRequired')&&typeof value.zoneChoiceRequired!=='boolean')fail('DRAFT','De zonekeuze is niet geldig.');
    if (![1,2].includes(value.version) || !id(value.transactionId) || !STAGES.includes(value.stage) || !['main','node'].includes(value.role) || value.mainReceiverId !== null && !id(value.mainReceiverId) || typeof value.cancelled !== 'boolean' || !['pending','added'].includes(value.membership)) fail('DRAFT','De instelstap is niet geldig.');
    if ((value.role === 'main') !== (value.mainReceiverId === null)) fail('DRAFT_ROLE','De rol van de receiver komt niet overeen met deze stand.');
    if (value.stand !== null) {
      shape(value.stand,['id','name','isNew'],'STAND');
      if (!id(value.stand.id) || typeof value.stand.isNew !== 'boolean') fail('STAND','Kies de stand waarin je deze receiver plaatst.');
      name(value.stand.name);
    } else if (value.stage !== 'stand') fail('STAND','Geef eerst je stand een naam.');
    if (!Array.isArray(value.zones) || value.zones.length > 256) fail('ZONES','De zonelijst is niet geldig.');
    value.zones.forEach(validateZone);
    if (new Set(value.zones.map(zone => zone.id)).size !== value.zones.length) fail('ZONE_ID','Een zone-ID mag maar één keer voorkomen.');
    for (const key of ['zoneId','activeZoneId']) if (value[key] !== null && !value.zones.some(zone => zone.id === value[key])) fail('ZONE_NOT_FOUND','Deze zone bestaat niet in deze stand.');
    if(value.zoneChoiceRequired&&(value.zoneId!==null||value.activeZoneId!==null))fail('ZONE_REQUIRED','Kies een passende zone of voeg de receiver zonder zone toe.');
    if (value.receiver !== null) validateReceiver(value.receiver);
    else if (!['stand','zones','receiver'].includes(value.stage)) fail('RECEIVER_REQUIRED','Kies eerst een gevonden receiver.');
    if (!Array.isArray(value.outputs)) fail('OUTPUT','De uitgangen ontbreken.');
    if (value.receiver && value.receiver.type === 'SPI') {
      if (value.outputs.length !== 4) fail('OUTPUT','Een SPI-receiver heeft vier uitgangen.');
      const allowZero=['receiver','placement','outputs','pixels','connection'].includes(value.stage)&&value.security?.status==='not-started';
      value.outputs.forEach((output,index)=>validOutput(output,index,allowZero));
      if (!value.outputs.some(output => output.enabled)) fail('OUTPUT','Gebruik minstens één uitgang.');
    } else if (value.outputs.length) fail('RGBW_OUTPUTS','RGBW werkt als één geheel, zonder afzonderlijke uitgangen.');
    if (value.port !== null && (!int(value.port,1,4) || !value.outputs.some(output => output.port === value.port && output.enabled))) fail('PORT','Kies een actieve uitgang.');
    if (['outputs','pixels','connection'].includes(value.stage) && (!value.receiver || value.receiver.type !== 'SPI')) fail('SPI_STAGE','Deze stap is alleen voor SPI.');
    if (['pixels','connection'].includes(value.stage) && value.port === null) fail('PORT','Deze stap mist de actieve uitgang.');
    if (value.stage === 'pin' && value.role !== 'main') fail('PIN_NOT_NEEDED','Een extra receiver gebruikt de bestaande beveiligde stand.');
    shape(value.security,['status','phase'],'SECURITY');
    if (!['not-started','pending','confirmed'].includes(value.security.status) || !PHASES.includes(value.security.phase)) fail('SECURITY','De beveiligingsstap is ongeldig.');
    if (value.security.status !== 'not-started' && !['security','zone','review','done'].includes(value.stage)) fail('SECURITY_LOCKED','Hervat dezelfde beveiligde toevoeging; begin geen nieuwe claim.');
    if (['zone','review','done'].includes(value.stage) && value.security.status !== 'confirmed') fail('SECURITY_UNCONFIRMED','Bevestig eerst de beveiligde receiververbinding.');
    if (['review','done'].includes(value.stage) && (value.zoneChoiceRequired||value.zoneId === null && value.activeZoneId !== null)) fail('ZONE_REQUIRED','Kies een passende zone of voeg de receiver zonder zone toe.');
    if ((value.stage === 'done') !== (value.membership === 'added')) fail('MEMBERSHIP','Een receiver verschijnt pas na definitieve bevestiging in de app.');
    shape(value.context,['standIds','zoneIds','receivers'],'CONTEXT');
    for (const key of ['standIds','zoneIds']) if (!Array.isArray(value.context[key]) || value.context[key].length > 4096 || value.context[key].some(item => !id(item)) || new Set(value.context[key]).size !== value.context[key].length) fail('CONTEXT','De bestaande indeling is ongeldig.');
    if (!Array.isArray(value.context.receivers) || value.context.receivers.length > 4096) fail('CONTEXT','De bestaande receiverlijst is ongeldig.');
    value.context.receivers.forEach(receiver => {
      shape(receiver,['id','rid','deviceFingerprint'],'CONTEXT');
      if (!id(receiver.id) || receiver.rid !== null && (typeof receiver.rid !== 'string' || receiver.rid.length > 96) || receiver.deviceFingerprint !== null && !hex(receiver.deviceFingerprint,64)) fail('CONTEXT','Een bestaande receiveridentiteit is ongeldig.');
    });
    const migrated=copy(value);
    // v1 asked all lengths before any connection sides. Revisit from the first
    // active port if it stopped during lengths; preserve every stored choice.
    // A legacy side step already completed earlier ports, so resume that port.
    if(migrated.version===1&&migrated.stage==='pixels')migrated.port=migrated.outputs.find(output=>output.enabled).port;
    migrated.version=2;
    return freeze(migrated);
  }
  function create(options) {
    shape(options,['model','transactionId','standId','activeZoneId'],'OPTIONS');
    Model.assertValid(options.model);
    if (!id(options.transactionId)) fail('TRANSACTION','Een vaste transactie-ID is vereist voor hervatten.');
    const model = options.model;
    const stand = options.standId ? model.stands.find(item => item.id === options.standId) : model.stands[0] || null;
    if (options.standId && !stand) fail('STAND_NOT_FOUND','Deze stand bestaat niet.');
    const main = stand && model.receivers.find(receiver => receiver.standId === stand.id && receiver.role === 'main' && receiver.lifecycle === 'added');
    const zones = stand ? stand.zones.map(zone => ({id:zone.id,name:zone.name,type:zone.type,layout:zone.layout,isNew:false,
      pixels:Model.zoneReceivers(model,zone.id).reduce((sum,receiver) => sum + receiver.outputs.reduce((n,output) => n + (output.enabled ? output.pixels : 0),0),0)})) : [];
    const active = options.activeZoneId === undefined ? zones[0] && zones[0].id || null : options.activeZoneId;
    return snapshot({version:2,transactionId:options.transactionId,stage:stand ? zones.length || main ? 'receiver' : 'zones' : 'stand',
      stand:stand ? {id:stand.id,name:stand.name,isNew:false} : null,zones,receiver:null,role:main ? 'node' : 'main',mainReceiverId:main ? main.id : null,
      outputs:[],port:null,zoneId:null,activeZoneId:active,security:{status:'not-started',phase:'idle'},cancelled:false,membership:'pending',
      context:{standIds:model.stands.map(item => item.id),zoneIds:model.stands.flatMap(item => item.zones.map(zone => zone.id)),
        receivers:model.receivers.map(receiver => ({id:receiver.id,rid:typeof receiver.rid === 'string' && receiver.rid ? receiver.rid.toUpperCase() : null,
          deviceFingerprint:typeof receiver.deviceFingerprint === 'string' ? receiver.deviceFingerprint.toUpperCase() : null}))}});
  }
  function result(draft,error=null) { return {draft:snapshot(draft),error}; }
  function caught(draft,error) { return result(draft,{code:error.code || 'DRAFT_INPUT',message:error.code ? error.message : 'Deze keuze kon nog niet worden verwerkt.'}); }
  function requireStage(draft,stages) { if (!stages.includes(draft.stage)) fail('STEP','Rond eerst de huidige stap af.'); }
  function unlocked(draft) { if (draft.security.status !== 'not-started') fail('SECURITY_LOCKED','De beveiliging is gestart. Hervat dezelfde receiver zonder opnieuw te claimen.'); }
  function activeOutputs(draft) { return draft.outputs.filter(output => output.enabled); }
  function duplicate(context,receiver) { return context.receivers.some(existing => existing.id === receiver.id || existing.rid === receiver.rid || existing.deviceFingerprint === receiver.deviceFingerprint); }
  function compatible(draft,zone) {
    if (zone.type !== null && zone.type !== draft.receiver.type) fail('MIXED_ZONE','Plaats RGBW en SPI in afzonderlijke zones.');
    if (zone.layout === 'continuous' && zone.type === 'SPI' && zone.pixels + activeOutputs(draft).reduce((sum,output) => sum + output.pixels,0) > Model.LIMITS.continuousPixels) fail('ZONE_PIXEL_LIMIT','Deze doorlopende zone ondersteunt maximaal 8192 pixels. Kies een andere zone.');
  }
  function toSecurity(draft) {
    if(activeOutputs(draft).some(output=>output.pixels===0))fail('PIXELS_REQUIRED','Stel de lengte in voor elke gebruikte uitgang.');
    // Zero belongs to the editable draft, never to a physical configuration.
    // Disabled outputs retain existing lengths; only untouched zeros receive
    // the protocol placeholder. They stay disabled and produce no light.
    for(const output of draft.outputs)if(!output.enabled&&output.pixels===0){output.pixels=1;output.reversed=false;}
    draft.port=null;draft.stage=draft.role==='main'&&pinRequired()?'pin':'security';
    if(draft.stage==='security')draft.security={status:'pending',phase:'configuring'};
  }
  function toConfiguration(draft) { if(draft.receiver.type==='SPI')draft.stage='outputs';else toSecurity(draft); }
  function transition(value,event) {
    const original=snapshot(value), next=copy(original);
    try {
      const fields={SET_STAND:['id','name'],ADD_ZONE:['id','name'],RENAME_ZONE:['zoneId','name'],REMOVE_ZONE:['zoneId'],SELECT_ACTIVE_ZONE:['zoneId'],SELECT_RECEIVER:['receiver'],SET_OUTPUT_COUNT:['count'],SET_OUTPUT_ENABLED:['port','enabled'],SET_PIXELS:['port','pixels'],SET_SIDE:['port','side'],SELECT_ZONE:['zoneId'],SECURITY_PROGRESS:['phase'],SKIP_ZONES:[],NEXT:[],BACK:[],CANCEL:[],RETRY:[]};
      if (!plain(event) || !own(fields,event.type)) fail('EVENT','Deze instelactie is niet beschikbaar.');
      shape(event,['type'].concat(fields[event.type]),'EVENT');
      if (next.stage === 'done') fail('ALREADY_ADDED','Deze receiver is al toegevoegd.');
      if (event.type === 'CANCEL') { next.cancelled=true; return result(next); }
      if (event.type === 'RETRY') { next.cancelled=false; return result(next); }
      if (next.cancelled) fail('CANCELLED','Hervat eerst deze toevoeging.');
      switch (event.type) {
        case 'SET_STAND':
          unlocked(next);requireStage(next,['stand']);
          if (!id(event.id) || next.context.standIds.includes(event.id)) fail('STAND_ID','Kies een nieuwe stand-ID.');
          next.stand={id:event.id,name:name(event.name),isNew:true}; break;
        case 'ADD_ZONE':
          requireStage(next,['zones','receiver','placement','zone']);
          if (!id(event.id) || next.context.zoneIds.includes(event.id) || next.zones.some(zone => zone.id === event.id)) fail('ZONE_ID','Deze zone bestaat al.');
          next.zones.push({id:event.id,name:name(event.name),type:null,layout:'stacked',isNew:true,pixels:0});
          if (next.activeZoneId === null) next.activeZoneId=event.id;
          if (next.stage === 'zone') next.zoneId=event.id;
          if (next.stage === 'placement') next.activeZoneId=event.id;
          delete next.zoneChoiceRequired;
          break;
        case 'SELECT_ACTIVE_ZONE':
          // A destination preference is not membership or a security claim.
          // Actual assignment stays locked behind identity/final receipt checks.
          unlocked(next);requireStage(next,['zones','receiver']);
          if(event.zoneId!==null&&!next.zones.some(zone=>zone.id===event.zoneId))fail('ZONE_NOT_FOUND','Kies een zone in deze stand.');
          next.activeZoneId=event.zoneId;delete next.zoneChoiceRequired;break;
        case 'RENAME_ZONE':
        case 'REMOVE_ZONE': {
          unlocked(next);requireStage(next,['zones']);
          if(next.receiver!==null)fail('RECEIVER_SELECTED','Rond eerst de gekozen receiver af voordat je zones verwijdert.');
          const zone=next.zones.find(item=>item.id===event.zoneId);
          if(!zone)fail('ZONE_NOT_FOUND','Deze zone staat niet in je instelstappen.');
          if(!zone.isNew||next.context.zoneIds.includes(zone.id))fail('ZONE_PERSISTED','Verwijder een opgeslagen zone via het bevestigde zonebeheer.');
          if(event.type==='RENAME_ZONE'){zone.name=name(event.name);break;}
          next.zones=next.zones.filter(item=>item.id!==zone.id);
          if(next.activeZoneId===zone.id)next.activeZoneId=next.zones[0]?.id||null;
          if(next.zoneId===zone.id)next.zoneId=null;
          break;
        }
        case 'SELECT_RECEIVER': {
          unlocked(next);requireStage(next,['receiver']);validateReceiver(event.receiver);
          if (duplicate(next.context,event.receiver)) fail('DUPLICATE_RECEIVER','Deze receiver hoort al bij een installatie in de app.');
          // Back to discovery is not a request to discard the customer's SPI
          // choices. Reuse them only for the exact same verified identity;
          // another physical receiver must start with its own clean settings.
          const sameReceiver=next.receiver&&['id','rid','type','deviceFingerprint'].every(key=>next.receiver[key]===event.receiver[key]);
          next.receiver={...copy(event.receiver),name:name(event.receiver.name)};
          if(!sameReceiver)next.outputs=event.receiver.type === 'SPI' ? [1,2,3,4].map(port => ({port,enabled:port === 1,pixels:0,reversed:false})) : [];
          next.port=null;next.zoneId=null;break;
        }
        case 'SET_OUTPUT_COUNT':
          unlocked(next);requireStage(next,['outputs']);
          if (!int(event.count,1,4)) fail('OUTPUT_COUNT','Kies één, twee, drie of vier uitgangen.');
          next.outputs.forEach(output => {output.enabled=output.port <= event.count;});break;
        case 'SET_OUTPUT_ENABLED':
          unlocked(next);requireStage(next,['outputs']);
          if(!int(event.port,1,4)||typeof event.enabled!=='boolean')fail('OUTPUT','Kies een geldige uitgang.');
          if(!event.enabled&&next.outputs[event.port-1].enabled&&activeOutputs(next).length===1)fail('OUTPUT','Gebruik minstens één uitgang.');
          next.outputs[event.port-1].enabled=event.enabled;break;
        case 'SET_PIXELS':
          unlocked(next);requireStage(next,['pixels']);
          if (event.port !== next.port || !int(event.pixels,0,Model.LIMITS.pixelsPerPort)) fail('PIXELS','Kies een geldig aantal pixels voor de getoonde uitgang.');
          next.outputs[event.port-1].pixels=event.pixels;break;
        case 'SET_SIDE':
          unlocked(next);requireStage(next,['connection']);
          if (event.port !== next.port || !['left','right'].includes(event.side)) fail('SIDE','Kies welk gemarkeerd uiteinde bij het begin van je opstelling ligt.');
          next.outputs[event.port-1].reversed=event.side === 'right';break;
        case 'SELECT_ZONE': {
          requireStage(next,['placement','zone']);const zone=next.zones.find(item => item.id === event.zoneId);
          if(event.zoneId===null){next.activeZoneId=null;next.zoneId=null;delete next.zoneChoiceRequired;break;}
          if (!zone) fail('ZONE_NOT_FOUND','Kies een zone in deze stand.');
          compatible(next,zone);if(next.stage==='placement')next.activeZoneId=zone.id;else next.zoneId=zone.id;delete next.zoneChoiceRequired;break;
        }
        case 'SECURITY_PROGRESS':
          requireStage(next,['security']);
          if (!['configuring','claiming','reconnecting','verifying','resuming'].includes(event.phase) || next.security.status !== 'pending') fail('SECURITY_PHASE','Deze beveiligingsstap moet door de verbinding worden bevestigd.');
          next.security.phase=event.phase;break;
        case 'SKIP_ZONES':
          unlocked(next);requireStage(next,['zones']);delete next.zoneChoiceRequired;next.stage='receiver';break;
        case 'NEXT':
          switch (next.stage) {
            case 'stand': if (!next.stand) fail('STAND','Geef eerst je stand een naam.');next.stage='zones';break;
            case 'zones': if (!next.zones.length) fail('ZONE_REQUIRED','Maak minstens één zone, bijvoorbeeld Demohoek.');next.stage='receiver';break;
            case 'receiver': {
              if (!next.receiver) fail('RECEIVER_REQUIRED','Kies eerst een gevonden receiver.');
              const zone=next.zones.find(zone=>zone.id===next.activeZoneId);
              if(next.zoneChoiceRequired||zone&&zone.type&&zone.type!==next.receiver.type)next.stage='placement';else toConfiguration(next);break;
            }
            case 'placement': {if(next.zoneChoiceRequired)fail('ZONE_REQUIRED','Kies een passende zone of voeg de receiver zonder zone toe.');const zone=next.zones.find(zone=>zone.id===next.activeZoneId);if(zone)compatible(next,zone);toConfiguration(next);break;}
            case 'outputs': next.stage='pixels';next.port=activeOutputs(next)[0].port;break;
            case 'pixels': {
              if(next.outputs[next.port-1].pixels===0)fail('PIXELS_REQUIRED',`Stel eerst de lengte van poort ${next.port} in.`);
              next.stage='connection';break;
            }
            case 'connection': {
              const following=activeOutputs(next).find(output => output.port > next.port);
              if (following) {next.stage='pixels';next.port=following.port;}else toSecurity(next);break;
            }
            case 'zone': if (next.zoneChoiceRequired||next.zoneId===null&&next.activeZoneId!==null) fail('ZONE_REQUIRED','Kies een passende zone of voeg de receiver zonder zone toe.');if(next.zoneId)compatible(next,next.zones.find(zone => zone.id === next.zoneId));next.stage='review';break;
            case 'pin': fail('PIN_REQUIRED','Vul twee keer dezelfde PIN van 8 tot 12 cijfers in.');break;
            case 'security': fail('SECURITY_UNCONFIRMED','De beveiligde verbinding moet eerst bevestigd worden.');break;
            case 'review': fail('FINAL_RECEIPT_REQUIRED','Toevoegen vereist de definitieve bevestiging van deze receiver.');break;
          }break;
        case 'BACK':
          if (next.stage === 'review') {next.stage='zone';break;}
          unlocked(next);
          switch (next.stage) {
            case 'zones': if (!next.stand.isNew) fail('NO_BACK','Deze stand bestaat al.');next.stage='stand';break;
            case 'receiver': next.stage='zones';break;
            case 'placement': next.stage='receiver';break;
            case 'outputs': next.stage='receiver';break;
            case 'pixels': {const previous=activeOutputs(next).filter(output => output.port < next.port).pop();if (previous) {next.stage='connection';next.port=previous.port;}else {next.stage='outputs';next.port=null;}break;}
            case 'connection': next.stage='pixels';break;
            case 'pin': if (next.receiver.type === 'SPI') {next.stage='connection';next.port=activeOutputs(next).slice(-1)[0].port;}else next.stage='receiver';break;
            default: fail('NO_BACK','Je bent aan het begin van deze toevoeging.');
          }break;
      }
      return result(next);
    } catch (error) { return caught(original,error); }
  }
  function providePin(value,pin,repeat) {
    const original=snapshot(value);
    try {
      if (!pinRequired()) fail('PIN_DISABLED','Deze demo gebruikt geen installatie-PIN.');
      requireStage(original,['pin']);unlocked(original);
      if (original.cancelled) fail('CANCELLED','Hervat eerst deze toevoeging.');
      const validation=Contract.validatePin(pin,repeat);
      if (!validation.valid) return result(original,{code:validation.code,message:validation.message});
      const next=copy(original);next.stage='security';next.security={status:'pending',phase:'configuring'};
      return result(next);
    } catch (error) { return caught(original,error); }
  }
  function refreshZones(value,model) {
    const original=snapshot(value),next=copy(original);
    try {
      unlocked(next);requireStage(next,['zones','receiver']);
      if(next.receiver!==null)fail('RECEIVER_SELECTED','Rond eerst de gekozen receiver af voordat je zones beheert.');
      if(next.cancelled)fail('CANCELLED','Hervat eerst deze toevoeging.');
      Model.assertValid(model);
      const stand=model.stands.find(item=>item.id===next.stand.id);
      if(!stand&&!next.stand.isNew)fail('STAND_NOT_FOUND','Deze stand bestaat niet meer. Open eerst de juiste stand.');
      if(stand&&next.stand.isNew)fail('STAND_CHANGED','Deze stand is ondertussen al opgeslagen. Open de juiste stand opnieuw.');
      const main=stand&&model.receivers.find(receiver=>receiver.standId===stand.id&&receiver.role==='main'&&receiver.lifecycle==='added');
      if((main?.id||null)!==next.mainReceiverId)fail('DRAFT_ROLE','De verbinding van deze stand is veranderd. Hervat vanuit de juiste stand.');
      const context={standIds:model.stands.map(item=>item.id),zoneIds:model.stands.flatMap(item=>item.zones.map(zone=>zone.id)),
        receivers:model.receivers.map(receiver=>({id:receiver.id,rid:typeof receiver.rid==='string'&&receiver.rid?receiver.rid.toUpperCase():null,
          deviceFingerprint:typeof receiver.deviceFingerprint==='string'?receiver.deviceFingerprint.toUpperCase():null}))};
      if(next.receiver&&duplicate(context,next.receiver))fail('DUPLICATE_RECEIVER','Deze receiver hoort inmiddels al bij een installatie.');
      const saved=stand?stand.zones.map(zone=>({id:zone.id,name:zone.name,type:zone.type,layout:zone.layout,isNew:false,
        pixels:Model.zoneReceivers(model,zone.id).reduce((sum,receiver)=>sum+receiver.outputs.reduce((n,output)=>n+(output.enabled?output.pixels:0),0),0)})):[];
      const pending=next.zones.filter(zone=>zone.isNew&&!saved.some(item=>item.id===zone.id));
      if(pending.some(zone=>context.zoneIds.includes(zone.id)))fail('ZONE_ID','Een nieuwe zone hoort ondertussen bij een andere stand.');
      next.zones=[...saved,...pending];next.context=context;
      if(stand)next.stand={id:stand.id,name:stand.name,isNew:false};
      // A removed destination is not the customer's explicit "Without zone"
      // choice. Keep that distinction until they choose a destination again.
      if(next.activeZoneId!==null&&!next.zones.some(zone=>zone.id===next.activeZoneId)){next.activeZoneId=null;next.zoneChoiceRequired=true;}
      if(!next.zones.some(zone=>zone.id===next.zoneId))next.zoneId=null;
      if(original.zones.length&&!next.zones.length&&next.stage==='receiver')next.stage='zones';
      return result(next);
    }catch(error){return caught(original,error);}
  }
  function configuration(value) {
    const draft=snapshot(value);
    if (!['pin','security','zone','review','done'].includes(draft.stage)) fail('CONFIGURATION_INCOMPLETE','Rond eerst de receiverinstellingen af.');
    return freeze({version:1,transactionId:draft.transactionId,standId:draft.stand.id,receiverId:draft.receiver.id,rid:draft.receiver.rid,
      deviceFingerprint:draft.receiver.deviceFingerprint,type:draft.receiver.type,role:draft.role,mainReceiverId:draft.mainReceiverId,
      outputs:copy(draft.outputs),zoneId:draft.security.status === 'confirmed' ? draft.zoneId : null});
  }
  function steps(value) {
    const draft=snapshot(value);
    const list=['stand','zones','receiver'];
    if(draft.stage==='placement')list.push('placement');
    if (draft.receiver && draft.receiver.type === 'SPI') list.push('outputs','pixels');
    if (draft.role === 'main' && pinRequired()) list.push('pin');
    return list.concat(['security','zone','review','done']);
  }
  function assertCurrent(model,draft,allowAdded) {
    Model.assertValid(model);
    const stand=model.stands.find(item => item.id === draft.stand.id);
    if (draft.stand.isNew && stand && !allowAdded || !draft.stand.isNew && !stand) fail('STAND_CHANGED','Deze stand is intussen veranderd. Controleer de indeling.');
    const mains=model.receivers.filter(receiver => receiver.standId === draft.stand.id && receiver.lifecycle === 'added' && receiver.role === 'main');
    if (draft.role === 'main' ? mains.some(receiver => !allowAdded || receiver.id !== draft.receiver.id) : mains.length !== 1 || mains[0].id !== draft.mainReceiverId) fail('MAIN_CHANGED','De verbinding van deze stand is veranderd. Hervat vanuit de juiste stand.');
    const identities=model.receivers.filter(receiver => receiver.id === draft.receiver.id || receiver.rid && receiver.rid.toUpperCase() === draft.receiver.rid || receiver.deviceFingerprint && receiver.deviceFingerprint.toUpperCase() === draft.receiver.deviceFingerprint);
    if (identities.length && (!allowAdded || identities.length !== 1 || identities[0].lifecycle !== 'added' || identities[0].onboardingTransactionId !== draft.transactionId || identities[0].id !== draft.receiver.id || identities[0].rid !== draft.receiver.rid || identities[0].deviceFingerprint !== draft.receiver.deviceFingerprint || identities[0].standId !== draft.stand.id || identities[0].zoneId !== draft.zoneId || identities[0].role !== draft.role || !same(identities[0].outputs,draft.outputs))) fail('DUPLICATE_RECEIVER','Deze receiver is intussen al toegevoegd of gewijzigd.');
    return identities[0] || null;
  }
  function buildModel(model,draft) {
    const already=assertCurrent(model,draft,true);
    if (already) return Model.clone(model);
    let next=Model.clone(model);
    if (draft.stand.isNew) next.stands.push({id:draft.stand.id,name:draft.stand.name,zones:[]});
    for (const zone of draft.zones.filter(item => item.isNew)) next=Model.createZone(next,draft.stand.id,{id:zone.id,name:zone.name});
    const zone=draft.zoneId===null?null:Model.getZone(next,draft.zoneId);
    if (draft.zoneId!==null&&(!zone || !next.stands.find(item => item.id === draft.stand.id).zones.some(item => item.id === zone.id))) fail('ZONE_NOT_FOUND','De gekozen zone is niet meer beschikbaar in deze stand.');
    // No pending receiver is ever inserted. Both insertion and assignment are
    // local immutable operations after a verified final receipt, returned only
    // if the complete model (including continuous pixel budget) validates.
    next.receivers.push({id:draft.receiver.id,rid:draft.receiver.rid,deviceFingerprint:draft.receiver.deviceFingerprint,name:draft.receiver.name,type:draft.receiver.type,
      standId:draft.stand.id,zoneId:null,role:draft.role,lifecycle:'added',connection:'unknown',outputs:copy(draft.outputs),state:Model.defaultState(),onboardingTransactionId:draft.transactionId});
    return draft.zoneId===null?Model.assertValid(next):Model.assignReceiverToZone(next,draft.receiver.id,draft.zoneId);
  }
  function createCommitter(options={}) {
    shape(options,['verifyFinalReceipt'],'COMMITTER');
    const verify=options.verifyFinalReceipt;
    async function verified(draft,receiptRef,purpose) {
      if (typeof verify !== 'function') fail('ONBOARDING_UNAVAILABLE','De beveiligde receiververbinding is nog niet beschikbaar.');
      if (typeof receiptRef !== 'string' || !/^receipt:[A-Za-z0-9._-]{8,128}$/.test(receiptRef)) fail('RECEIPT_REFERENCE','Een beveiligde bevestiging is vereist.');
      const expected=configuration(draft);
      let answer;
      try {answer=await verify({receiptRef,purpose,expected});} catch (_) {fail('RECEIPT_UNVERIFIED','De beveiligde bevestiging kon nog niet worden gecontroleerd. Hervat dezelfde toevoeging.');}
      shape(answer,['kind','configuration'],'RECEIPT_UNVERIFIED');
      if (answer.kind !== (purpose === 'security' ? 'security-confirmed' : 'receiver-added') || !same(answer.configuration,expected)) fail('RECEIPT_MISMATCH','Deze bevestiging hoort niet bij de gekozen receiver en instellingen.');
    }
    async function confirmSecurity(value,receiptRef) {
      const original=snapshot(value);
      try {
        requireStage(original,['security']);if (original.cancelled) fail('CANCELLED','Hervat eerst deze toevoeging.');
        await verified(original,receiptRef,'security');
        const next=copy(original);next.security={status:'confirmed',phase:'identity-confirmed'};next.stage='zone';
        const active=next.zones.find(zone => zone.id === next.activeZoneId);
        if (active) {try {compatible(next,active);next.zoneId=active.id;} catch (_) {next.zoneId=null;}}
        return result(next);
      } catch (error) {return caught(original,error);}
    }
    async function finish(model,value,receiptRef) {
      const original=snapshot(value);
      try {
        requireStage(original,['review','done']);if (original.cancelled) fail('CANCELLED','Hervat eerst deze toevoeging.');
        assertCurrent(model,original,true);
        // Validate the current destination before invoking the verifier and
        // again after awaiting it. A changed type/main/config cannot sneak in.
        buildModel(model,original);
        await verified(original,receiptRef,'finalize');
        const nextModel=buildModel(model,original),next=copy(original);
        next.stage='done';next.membership='added';next.activeZoneId=next.zoneId;
        return {model:nextModel,draft:snapshot(next),error:null};
      } catch (error) {return {model,draft:original,error:{code:error.code || 'COMMIT_FAILED',message:error.code ? error.message : 'Toevoegen kon nog niet worden afgerond. Je keuzes blijven bewaard.'}};}
    }
    return Object.freeze({confirmSecurity,finish});
  }
  return Object.freeze({STAGES,create,snapshot,transition,refreshZones,steps,configuration,validatePin:Contract.validatePin,providePin,createCommitter});
}));
