/* V30 ONBOARDING CONTRACT — PURE, NOT CONNECTED TO THE APP OR RECEIVERS.
 *
 * This is a state/receipt contract, not authentication, encryption, storage,
 * a Wi-Fi implementation, or proof that hardware is secure. A trusted adapter
 * must authenticate receipts and supply the identity it actually verified.
 * A boolean named authenticated cannot itself establish that fact.
 *
 * Integration rules:
 *  - Persist the returned checkpoint BEFORE executing returned commands.
 *  - Every credentialRef is an immutable opaque handle owned by a secure
 *    credential adapter. Never put the PIN, verifier, PSK or recovery key here.
 *  - providePin validates ephemeral user input; the caller securely prepares
 *    exactly that PIN under the supplied handle. No PIN enters state/commands.
 *  - Never turn native join success into authenticated receiver success.
 *  - Resume the exact transaction. An uncertain claim is reconciled, not
 *    replaced, reset, or automatically exposed through open Wi-Fi.
 *
 * API: create(binding), validatePin(pin, repeat), providePin(state, pin, repeat,
 * credentialRef), transition(state, event), checkpoint(state), resume(saved).
 * Transitions return {state,commands,checkpointRequired,error}. Protocol
 * violations throw Error with .code; mismatched user PINs return error without
 * changing state. No timers, randomness, IO, globals or hidden mutation.
 *
 * Events: FACTORY_READY, CONFIGURE, CONFIGURATION_ACK, CONFIGURATION_STATUS, CREDENTIALS_READY,
 * REQUEST_CLAIM, CLAIM_ACK, CLAIM_STATUS, JOIN_SUCCEEDED, IDENTITY_CONFIRMED,
 * FINALIZE, OFFLINE, RESUME. Receipt events carry a `receipt` with all binding
 * fields. Claim/configuration receipts also echo configRevision/configDigest.
 * An unacknowledged saved configuration is reconciled before retry: a verified
 * stored status acknowledges it; only verified not-stored status reissues the
 * exact same revision/digest. Unknown status never retries or starts a claim.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningOnboardingContract = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STAGES = Object.freeze(['factory-open', 'configuring', 'claim-pending', 'committed-rejoin-pending', 'identity-confirmed', 'added']);
  const BINDING_FIELDS = ['standId', 'receiverId', 'deviceFingerprint', 'transactionId', 'credentialGeneration', 'ssid'];
  const MAX_GENERATION = 2147483647;
  const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const plain = value => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
  const copy = value => JSON.parse(JSON.stringify(value));
  const fail = (code, message) => { const error = new Error(message); error.code = code; throw error; };
  const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value);
  // An explicit namespace prevents accidentally passing the literal PIN or a
  // raw PSK as the otherwise generic string handle.
  const credentialHandle = value => typeof value === 'string' && /^cred:[A-Za-z0-9._-]{8,96}$/.test(value) && !/^cred:[0-9]{8,12}$/.test(value);
  const hex = (value, length) => typeof value === 'string' && value.length === length && /^[0-9A-F]+$/.test(value) && !/^0+$/.test(value);
  const integer = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
  function shape(value, fields, code) {
    if (!plain(value) || Object.keys(value).some(key => !fields.includes(key)) || ['__proto__', 'constructor', 'prototype'].some(key => has(value, key))) fail(code, 'Onbekende of ongeldige contractgegevens.');
  }
  function binding(value) {
    shape(value, BINDING_FIELDS, 'BINDING');
    if (!id(value.standId) || !hex(value.receiverId, 16) || !hex(value.deviceFingerprint, 64) || !id(value.transactionId) || !integer(value.credentialGeneration, 1, MAX_GENERATION) ||
      typeof value.ssid !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,31}$/.test(value.ssid)) fail('BINDING', 'Stand, receiver, identiteit, transactie en exact netwerk zijn vereist.');
    return copy(value);
  }
  function validatePin(pin, repeat) {
    if (typeof pin !== 'string' || !/^[0-9]{8,12}$/.test(pin)) return { valid: false, code: 'PIN_FORMAT', message: 'Kies een PIN van 8 tot 12 cijfers.' };
    if (typeof repeat !== 'string' || pin !== repeat) return { valid: false, code: 'PIN_MISMATCH', message: 'Vul twee keer dezelfde PIN in.' };
    return { valid: true, code: null, message: '' };
  }
  function create(value) {
    return checkpoint({ version: 1, stage: 'factory-open', binding: binding(value),
      configuration: { revision: 0, digest: null, acknowledged: false }, credentialRef: null,
      credentialsReady: false, claimRequested: false, durableClaim: false,
      connectionAttempt: 0, joinRequested: false, protectedJoinConfirmed: false, identityConfirmed: false,
      membership: 'pending', connectivity: 'unknown' });
  }
  function checkpoint(value) {
    shape(value, ['version', 'stage', 'binding', 'configuration', 'credentialRef', 'credentialsReady', 'claimRequested', 'durableClaim',
      'connectionAttempt', 'joinRequested', 'protectedJoinConfirmed', 'identityConfirmed', 'membership', 'connectivity'], 'CHECKPOINT');
    if (value.version !== 1 || !STAGES.includes(value.stage) || !['pending', 'added'].includes(value.membership) || !['unknown', 'online', 'offline'].includes(value.connectivity)) fail('CHECKPOINT', 'Onbekende onboardingversie of status.');
    binding(value.binding);
    shape(value.configuration, ['revision', 'digest', 'acknowledged'], 'CONFIGURATION');
    const config = value.configuration;
    if (!integer(config.revision, 0, MAX_GENERATION) || typeof config.acknowledged !== 'boolean' || (config.revision === 0 ? config.digest !== null || config.acknowledged : !hex(config.digest, 64))) fail('CONFIGURATION', 'De configuratieversie of bevestiging is niet geldig.');
    if (value.credentialRef !== null && !credentialHandle(value.credentialRef)) fail('CREDENTIAL_REF', 'Een geldige verwijzing naar beveiligde credentials is vereist.');
    if (!integer(value.connectionAttempt, 0, MAX_GENERATION)) fail('CHECKPOINT', 'De verbindingspoging is niet geldig.');
    for (const field of ['credentialsReady', 'claimRequested', 'durableClaim', 'joinRequested', 'protectedJoinConfirmed', 'identityConfirmed']) if (typeof value[field] !== 'boolean') fail('CHECKPOINT', 'Een contractvlag ontbreekt.');
    if (value.credentialsReady && !value.credentialRef) fail('CHECKPOINT', 'Voorbereide credentials hebben een verwijzing nodig.');
    if (value.claimRequested && (!config.acknowledged || !value.credentialsReady)) fail('CHECKPOINT', 'Een claim vereist bevestigde configuratie en voorbereide credentials.');
    if (value.durableClaim && !value.claimRequested) fail('CHECKPOINT', 'Een duurzame claim vereist dezelfde aangevraagde claim.');
    if (value.joinRequested && (!value.durableClaim || !value.connectionAttempt)) fail('CHECKPOINT', 'Een beschermde verbindingspoging vereist een duurzame claim.');
    if (value.protectedJoinConfirmed && (!value.joinRequested || value.connectivity !== 'online')) fail('CHECKPOINT', 'Een beschermde verbinding vereist een aangevraagde poging en bereikbaarheid.');
    if (value.identityConfirmed && !value.protectedJoinConfirmed) fail('CHECKPOINT', 'Identiteitsbevestiging vereist de beschermde verbinding.');
    if (value.membership === 'added' && value.stage !== 'added' || value.stage === 'added' && value.membership !== 'added') fail('CHECKPOINT', 'Lidmaatschap wordt pas bij definitief toevoegen gewijzigd.');
    if (value.stage === 'factory-open' && (config.revision !== 0 || value.credentialRef !== null || value.claimRequested)) fail('CHECKPOINT', 'De fabrieksfase mag nog geen configuratie of claim bevatten.');
    if (['factory-open', 'configuring'].includes(value.stage) && (value.claimRequested || value.durableClaim || value.identityConfirmed)) fail('CHECKPOINT', 'Een bevestigde of onzekere claim mag niet terugvallen naar open setup.');
    if (value.stage === 'claim-pending' && (!value.claimRequested || value.durableClaim)) fail('CHECKPOINT', 'De onzekere claimstatus klopt niet.');
    if (['committed-rejoin-pending', 'identity-confirmed', 'added'].includes(value.stage) && !value.durableClaim) fail('CHECKPOINT', 'Deze fase vereist bevestigde duurzame eigendom.');
    if (value.stage === 'committed-rejoin-pending' && value.identityConfirmed || value.stage === 'identity-confirmed' && !value.identityConfirmed) fail('CHECKPOINT', 'De identiteitsfase klopt niet.');
    if (JSON.stringify(value).length > 4096) fail('CHECKPOINT_SIZE', 'Het onboardingcheckpoint is te groot.');
    return copy(value);
  }
  function result(state, commands = [], error = null) {
    // Receipt-only progress must be persisted too, not only command-producing
    // transitions. An adapter may skip an identical checkpoint by comparison.
    return { state: checkpoint(state), commands: copy(commands), checkpointRequired: error === null, error };
  }
  function command(state, kind, extra = {}) {
    return Object.assign({ kind, binding: copy(state.binding) }, extra);
  }
  function configurationFields(state) {
    return { configRevision: state.configuration.revision, configDigest: state.configuration.digest };
  }
  function newConnectionAttempt(state) {
    if (state.connectionAttempt >= MAX_GENERATION) fail('ATTEMPT_EXHAUSTED', 'De verbindingspogingen kunnen niet veilig verder worden genummerd.');
    state.connectionAttempt += 1;
  }
  function verifyAttempt(state, reply) {
    if (!integer(reply.connectionAttempt, 0, MAX_GENERATION) || reply.connectionAttempt !== state.connectionAttempt) fail('STALE_CONNECTION', 'Dit antwoord hoort bij een eerdere verbindingspoging.');
  }
  function joinCommand(state) {
    state.joinRequested = true;
    return command(state, 'join-protected-network', { credentialRef: state.credentialRef, connectionAttempt: state.connectionAttempt });
  }
  function requireStage(state, stages) {
    if (!stages.includes(state.stage)) fail('STAGE', 'Deze actie past niet bij de huidige onboardingstap.');
  }
  function receipt(state, value, fields) {
    shape(value, BINDING_FIELDS.concat(fields), 'RECEIPT');
    const identity = {};
    for (const key of BINDING_FIELDS) identity[key] = value[key];
    binding(identity);
    for (const key of BINDING_FIELDS) if (value[key] !== state.binding[key]) fail('STALE_RECEIPT', 'Dit antwoord hoort niet bij de gekozen stand, receiver of transactie.');
    return value;
  }
  function verifiedConfiguration(state, value) {
    if (value.configRevision !== state.configuration.revision || value.configDigest !== state.configuration.digest || value.durable !== true || value.authenticated !== true) fail('CONFIGURATION_UNCONFIRMED', 'De juiste configuratie is niet duurzaam bevestigd.');
  }
  function providePin(original, pin, repeat, credentialRef) {
    const state = checkpoint(original);
    requireStage(state, ['configuring']);
    const checked = validatePin(pin, repeat);
    if (!checked.valid) return result(state, [], { code: checked.code, message: checked.message });
    if (!credentialHandle(credentialRef) || credentialRef.includes(pin)) fail('CREDENTIAL_REF', 'Gebruik een beveiligde, ondoorzichtige credentialverwijzing, nooit de PIN zelf.');
    if (state.credentialRef === credentialRef) return result(state);
    state.credentialRef = credentialRef;
    state.credentialsReady = false;
    return result(state, [command(state, 'prepare-credentials', { credentialRef })]);
  }
  function committed(state, reply) {
    if (!state.claimRequested) fail('UNREQUESTED_CLAIM', 'Er is geen claim aangevraagd voor deze transactie.');
    verifiedConfiguration(state, reply);
    if (reply.ownership !== 'main' || reply.securityCommitted !== true) fail('CLAIM_UNCONFIRMED', 'Eigendom en beveiligde credentials zijn niet bevestigd.');
    if (state.durableClaim) return result(state);
    requireStage(state, ['claim-pending']);
    state.durableClaim = true;
    state.stage = 'committed-rejoin-pending';
    state.connectivity = 'offline';
    newConnectionAttempt(state);
    return result(state, [joinCommand(state)]);
  }
  function transition(original, event) {
    const state = checkpoint(original);
    shape(event, ['type', 'receipt', 'revision', 'digest'], 'EVENT');
    if (typeof event.type !== 'string') fail('EVENT', 'Een contractevent is vereist.');
    const receiptEvents = ['FACTORY_READY', 'CONFIGURATION_ACK', 'CONFIGURATION_STATUS', 'CREDENTIALS_READY', 'CLAIM_ACK', 'CLAIM_STATUS', 'JOIN_SUCCEEDED', 'IDENTITY_CONFIRMED'];
    shape(event, event.type === 'CONFIGURE' ? ['type', 'revision', 'digest'] : receiptEvents.includes(event.type) ? ['type', 'receipt'] : ['type'], 'EVENT');
    if (event.type === 'FACTORY_READY') {
      const reply = receipt(state, event.receipt, ['ownership', 'networkMode', 'authenticated', 'connectionAttempt']);
      verifyAttempt(state, reply);
      if (reply.ownership !== 'blank' || reply.networkMode !== 'open' || reply.authenticated !== true) fail('FACTORY_UNCONFIRMED', 'De gekozen ongekoppelde receiver is niet bevestigd.');
      if (!['factory-open', 'configuring'].includes(state.stage)) return result(state);
      if (state.stage === 'configuring' && state.connectivity === 'online') return result(state);
      state.stage = 'configuring'; state.connectivity = 'online';
      return result(state, [state.configuration.revision && !state.configuration.acknowledged
        ? command(state, 'reconcile-configuration', configurationFields(state))
        : command(state, 'begin-configuration')]);
    }
    if (event.type === 'CONFIGURE') {
      if (!integer(event.revision, 1, MAX_GENERATION) || !hex(event.digest, 64)) fail('CONFIGURATION', 'Een begrensde configuratieversie en digest zijn vereist.');
      if (event.revision === state.configuration.revision && event.digest === state.configuration.digest) {
        return result(state, state.stage === 'configuring' && !state.configuration.acknowledged
          ? [command(state, 'reconcile-configuration', configurationFields(state))] : []);
      }
      requireStage(state, ['configuring']);
      if (event.revision !== state.configuration.revision + 1) fail('CONFIGURATION_REVISION', 'Gebruik de volgende configuratieversie, geen oudere of conflicterende versie.');
      state.configuration = { revision: event.revision, digest: event.digest, acknowledged: false };
      return result(state, [command(state, 'store-configuration', configurationFields(state))]);
    }
    if (event.type === 'CONFIGURATION_ACK') {
      const reply = receipt(state, event.receipt, ['configRevision', 'configDigest', 'durable', 'authenticated']);
      if (!state.configuration.revision) fail('UNREQUESTED_CONFIGURATION', 'Er is nog geen configuratie aangevraagd.');
      verifiedConfiguration(state, reply);
      state.configuration.acknowledged = true;
      return result(state);
    }
    if (event.type === 'CONFIGURATION_STATUS') {
      const reply = receipt(state, event.receipt, ['configRevision', 'configDigest', 'durable', 'authenticated', 'outcome']);
      if (!state.configuration.revision || reply.configRevision !== state.configuration.revision || reply.configDigest !== state.configuration.digest ||
        reply.authenticated !== true || typeof reply.durable !== 'boolean' || !['stored', 'not-stored', 'unknown'].includes(reply.outcome)) fail('CONFIGURATION_UNCONFIRMED', 'De status bevestigt niet de juiste configuratie.');
      if (reply.outcome === 'stored') {
        verifiedConfiguration(state, reply);
        state.configuration.acknowledged = true;
        return result(state);
      }
      // A previously confirmed durable config cannot be downgraded by a
      // delayed negative status, even if its revision/digest match.
      if (state.configuration.acknowledged) fail('CONFIGURATION_ROLLBACK', 'Een bevestigde configuratie mag niet verdwijnen.');
      requireStage(state, ['configuring']);
      if (reply.durable !== false) fail('CONFIGURATION_UNCONFIRMED', 'De configuratiestatus is tegenstrijdig.');
      if (reply.outcome === 'unknown') return result(state);
      return result(state, [command(state, 'store-configuration', configurationFields(state))]);
    }
    if (event.type === 'CREDENTIALS_READY') {
      const reply = receipt(state, event.receipt, ['credentialRef', 'prepared']);
      if (!state.credentialRef || reply.credentialRef !== state.credentialRef || reply.prepared !== true) fail('CREDENTIALS_UNCONFIRMED', 'De gekozen credentials zijn niet voorbereid.');
      state.credentialsReady = true;
      return result(state);
    }
    if (event.type === 'REQUEST_CLAIM') {
      if (state.claimRequested) return result(state);
      requireStage(state, ['configuring']);
      if (state.connectivity !== 'online' || !state.configuration.acknowledged || !state.credentialsReady) fail('CLAIM_NOT_READY', 'Bevestig eerst de configuratie, PIN-voorbereiding en receiververbinding.');
      state.stage = 'claim-pending'; state.claimRequested = true;
      return result(state, [command(state, 'claim-main', Object.assign(configurationFields(state), { credentialRef: state.credentialRef }))]);
    }
    if (event.type === 'CLAIM_ACK' || event.type === 'CLAIM_STATUS') {
      const reply = receipt(state, event.receipt, ['configRevision', 'configDigest', 'durable', 'authenticated', 'ownership', 'securityCommitted', 'outcome']);
      if (event.type === 'CLAIM_ACK' && has(reply, 'outcome') && reply.outcome !== 'committed') fail('CLAIM_STATUS', 'De claimbevestiging bevat een tegenstrijdige status.');
      if (event.type === 'CLAIM_ACK' || reply.outcome === 'committed') return committed(state, reply);
      if (!['unknown', 'not-committed'].includes(reply.outcome)) fail('CLAIM_STATUS', 'Onbekende claimstatus.');
      if (state.durableClaim) fail('CLAIM_ROLLBACK', 'Een duurzame claim mag niet terugvallen naar open setup.');
      requireStage(state, ['claim-pending']);
      if (reply.authenticated !== true) fail('CLAIM_UNCONFIRMED', 'De status is niet door de gekozen receiver bevestigd.');
      if (reply.outcome === 'unknown') return result(state);
      verifiedConfiguration(state, reply);
      if (reply.ownership !== 'blank' || reply.securityCommitted !== false) fail('CLAIM_UNCONFIRMED', 'De receiver heeft niet bewezen dat de claim ontbreekt.');
      state.stage = 'configuring'; state.claimRequested = false; state.connectivity = 'online';
      // No automatic re-claim or open-network join. A new REQUEST_CLAIM remains
      // explicit and reuses the original transaction and credential handle.
      return result(state);
    }
    if (event.type === 'JOIN_SUCCEEDED') {
      const reply = receipt(state, event.receipt, ['networkMode', 'connectionAttempt']);
      requireStage(state, ['committed-rejoin-pending', 'identity-confirmed', 'added']);
      verifyAttempt(state, reply);
      if (!state.joinRequested) fail('UNREQUESTED_JOIN', 'Deze beschermde verbinding is niet aangevraagd.');
      if (reply.networkMode !== 'protected') fail('OPEN_FALLBACK', 'Een gekoppelde receiver mag niet via open setup worden hervat.');
      if (state.protectedJoinConfirmed) return result(state);
      state.protectedJoinConfirmed = true; state.connectivity = 'online';
      return result(state, [command(state, 'verify-owner-identity', { connectionAttempt: state.connectionAttempt })]);
    }
    if (event.type === 'IDENTITY_CONFIRMED') {
      const reply = receipt(state, event.receipt, ['authenticated', 'ownership', 'networkMode', 'securityCommitted', 'connectionAttempt']);
      requireStage(state, ['committed-rejoin-pending', 'identity-confirmed', 'added']);
      verifyAttempt(state, reply);
      if (!state.protectedJoinConfirmed || reply.authenticated !== true || reply.ownership !== 'main' || reply.networkMode !== 'protected' || reply.securityCommitted !== true) fail('IDENTITY_UNCONFIRMED', 'De beschermde verbinding en eigenaaridentiteit zijn nog niet bevestigd.');
      state.identityConfirmed = true;
      if (state.stage !== 'added') state.stage = 'identity-confirmed';
      return result(state);
    }
    if (event.type === 'FINALIZE') {
      if (state.stage === 'added') return result(state);
      requireStage(state, ['identity-confirmed']);
      if (!state.identityConfirmed || state.connectivity !== 'online') fail('IDENTITY_UNCONFIRMED', 'Controleer eerst de eigenaaridentiteit.');
      state.stage = 'added'; state.membership = 'added';
      return result(state, [command(state, 'publish-confirmed-membership')]);
    }
    if (event.type === 'OFFLINE' || event.type === 'RESUME') {
      if (event.type === 'OFFLINE' && state.connectivity === 'offline' && !state.joinRequested) return result(state);
      newConnectionAttempt(state);
      state.connectivity = 'offline'; state.joinRequested = false; state.protectedJoinConfirmed = false; state.identityConfirmed = false;
      if (state.stage === 'identity-confirmed') state.stage = 'committed-rejoin-pending';
      if (event.type === 'OFFLINE') return result(state);
      if (state.durableClaim) return result(state, [joinCommand(state)]);
      if (state.claimRequested) return result(state, [command(state, 'reconcile-claim', Object.assign(configurationFields(state), { credentialRef: state.credentialRef, strategy: 'protected-first-no-open-fallback' }))]);
      return result(state, [command(state, 'verify-factory-identity', { connectionAttempt: state.connectionAttempt })]);
    }
    fail('EVENT', 'Onbekend onboardingevent.');
  }
  function resume(saved) { return transition(checkpoint(saved), { type: 'RESUME' }); }
  return Object.freeze({ STAGES, create, validatePin, providePin, transition, checkpoint, resume });
}));
