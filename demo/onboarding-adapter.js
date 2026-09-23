/* V30 ONBOARDING ADAPTER — ISOLATED; NO LIVE BRIDGE, RADIO OR CRYPTOGRAPHY.
 *
 * create({binding OR checkpoint, services}) returns:
 *   snapshot(), dispatch(userEvent), preparePin(pin, repeat, credentialRef),
 *   acceptReceipt(receiptRef), resume(). Async operations return safe snapshots.
 * dispatch accepts only CONFIGURE, REQUEST_CLAIM, FINALIZE, OFFLINE. Resume
 * reads the durable checkpoint; receipt events are NEVER accepted directly.
 *
 * Injected TRUSTED services (all methods async):
 *   capabilities.read(binding) -> {binding, native:{...}, receiver:{...}}
 *   checkpoints.load(binding) -> {checkpoint: safeCheckpoint|null}
 *   checkpoints.save({binding, previous, next}) -> {checkpoint: durableReadback}
 *     save MUST compare-and-swap previous and durably read back before returning.
 *   credentials.prepare({binding, credentialRef, pin}) -> receiptRef
 *     The handle must already have been allocated by native secure storage.
 *     Native validates its full binding and immutable secret, stores encrypted,
 *     never logs input, and retries the SAME handle without replacing its PIN.
 *   commands.execute(command) -> void (not an authenticated receipt)
 *     Native resolves handles internally; claim replay/retry is forbidden.
 *     Any command error is UNCERTAIN, not proof that no mutation happened.
 *     reconcile-configuration queries this exact revision/digest; the receiver
 *     must implement store-configuration idempotently for that canonical
 *     payload and reject a conflicting payload under the same revision.
 *     publish-confirmed-membership is an idempotent notification: the durable
 *     added checkpoint, not delivery of that notification, is authoritative.
 *   receipts.verify({receiptRef, expected}) -> contract receipt event
 *     This service, not a caller boolean, must verify crypto/native provenance,
 *     freshness and exact binding. Factory identity is still TOFU unless that
 *     service has a separately authenticated bootstrap identity.
 *
 * The module implements ordering/validation, not these security guarantees.
 * Capability checks cannot make an untrusted service trustworthy. Old firmware
 * lacking any required version is rejected. No localStorage, logger, timers,
 * native handler, factory reset, open fallback or hidden credential migration.
 * PIN strings exist only as ephemeral arguments; JS strings cannot be securely
 * zeroized. Callers must clear input fields. Checkpoints/results contain only
 * opaque handles. Service errors are redacted, never propagated with payloads.
 */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./onboarding-contract.js'):root.LightningOnboardingContract);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningOnboardingAdapter=api;
})(typeof globalThis==='object'?globalThis:this,function(Contract){
  'use strict';
  const REQUIRED=Object.freeze({
    native:Object.freeze({onboarding:1,opaqueCredentials:1,exactSsidJoin:1,authenticatedReceipts:1,durableCheckpoint:1}),
    receiver:Object.freeze({onboarding:1,transactionalClaim:1,wifiPinCommit:1,configurationReceipts:1,configurationReconcile:1,boundClaimStatus:1})
  });
  const USER_EVENTS=['CONFIGURE','REQUEST_CLAIM','FINALIZE','OFFLINE'];
  const RECEIPTS=['FACTORY_READY','CONFIGURATION_ACK','CONFIGURATION_STATUS','CREDENTIALS_READY','CLAIM_ACK','CLAIM_STATUS','JOIN_SUCCEEDED','IDENTITY_CONFIRMED'];
  const copy=value=>JSON.parse(JSON.stringify(value));
  const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
  const canonical=value=>JSON.stringify(value,(_,item)=>plain(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
  const same=(a,b)=>canonical(a)===canonical(b);
  const receiptRef=value=>typeof value==='string'&&/^receipt:[A-Za-z0-9._-]{8,128}$/.test(value);
  function fail(code){const error=Error('Onboarding kon niet veilig verdergaan ('+code+'). Er is geen fabrieksreset uitgevoerd.');error.code=code;throw error;}
  function contractCall(operation){try{return operation();}catch(error){fail(typeof error?.code==='string'&&/^[A-Z_]{1,50}$/.test(error.code)?error.code:'CONTRACT_INVALID');}}
  function create(options){
    if(!plain(options)||!!options.binding===!!options.checkpoint)fail('ADAPTER_INPUT');
    const services=options.services;
    for(const [name,methods] of Object.entries({capabilities:['read'],checkpoints:['load','save'],credentials:['prepare'],commands:['execute'],receipts:['verify']})){
      if(!plain(services)||!services[name]||methods.some(method=>typeof services[name][method]!=='function'))fail('ADAPTER_SERVICE');
    }
    let state=contractCall(()=>options.checkpoint?Contract.checkpoint(options.checkpoint):Contract.create(options.binding));
    let persisted=options.checkpoint?copy(state):null,busy=false,storageUncertain=false,uncertainVerifiedRelease=null;
    const bound=copy(state.binding);
    const snapshot=()=>copy(state);
    async function requireCapabilities(){
      let report;try{report=await services.capabilities.read(copy(bound));}catch(_){fail('CAPABILITIES_UNAVAILABLE');}
      if(!plain(report)||!same(report.binding,bound)||Object.entries(REQUIRED).some(([scope,fields])=>!plain(report[scope])||Object.entries(fields).some(([key,version])=>report[scope][key]!==version)))fail('ONBOARDING_UNSUPPORTED');
    }
    async function operation(run,allowReload=false){
      if(busy)fail('ADAPTER_BUSY');
      if(storageUncertain&&!allowReload)fail('CHECKPOINT_RELOAD_REQUIRED');
      busy=true;
      try{await requireCapabilities();return await run();}finally{busy=false;}
    }
    async function persist(next){
      const safe=contractCall(()=>Contract.checkpoint(next));
      // Only the verifier -> contract CLAIM_STATUS(not-committed) transition
      // can produce this exact release of an uncertain claim intent. Retain
      // that proof-derived candidate across a lost storage acknowledgement;
      // it is NOT permission to accept any older configuring checkpoint.
      const verifiedRelease=state.stage==='claim-pending'&&state.claimRequested&&!state.durableClaim&&
        safe.stage==='configuring'&&!safe.claimRequested&&!safe.durableClaim?safe:null;
      // Even an unchanged checkpoint is CAS-checked before a retry command.
      let result;
      try{result=await services.checkpoints.save({binding:copy(bound),previous:copy(persisted),next:copy(safe)});}
      catch(_){storageUncertain=true;uncertainVerifiedRelease=verifiedRelease?copy(verifiedRelease):null;fail('CHECKPOINT_WRITE_FAILED');}
      try{
        if(!plain(result)||Object.keys(result).length!==1||!same(Contract.checkpoint(result.checkpoint),safe))throw Error();
      }catch(_){storageUncertain=true;uncertainVerifiedRelease=verifiedRelease?copy(verifiedRelease):null;fail('CHECKPOINT_UNCONFIRMED');}
      state=safe;persisted=copy(safe);uncertainVerifiedRelease=null;
    }
    async function verified(ref,requiredType){
      if(!receiptRef(ref))fail('RECEIPT_REFERENCE');
      let event;
      try{event=await services.receipts.verify({receiptRef:ref,expected:snapshot()});}
      catch(_){fail('RECEIPT_UNVERIFIED');}
      if(!plain(event)||!RECEIPTS.includes(event.type)||(requiredType&&event.type!==requiredType))fail('RECEIPT_UNVERIFIED');
      // Contract validates every field and binding after the trusted verifier.
      return contractCall(()=>Contract.transition(state,event));
    }
    async function commit(result,ephemeralPin){
      if(result.error)return {state:snapshot(),error:copy(result.error),executed:[]};
      await persist(result.state);
      const executed=[];
      for(const command of result.commands){
        if(command.kind==='prepare-credentials'){
          if(typeof ephemeralPin!=='string')fail('PIN_REQUIRED');
          let ref;
          try{ref=await services.credentials.prepare({binding:copy(bound),credentialRef:command.credentialRef,pin:ephemeralPin});}
          catch(_){fail('CREDENTIAL_PREPARATION_FAILED');}
          // No success from a bare true, returned secret, or arbitrary object.
          const ready=await verified(ref,'CREDENTIALS_READY');
          await persist(ready.state);
        }else{
          try{await services.commands.execute(copy(command));}
          catch(_){fail('COMMAND_UNCONFIRMED');}
        }
        executed.push(command.kind);
      }
      return {state:snapshot(),error:null,executed};
    }
    function dispatch(event){
      if(!plain(event)||!USER_EVENTS.includes(event.type))return Promise.reject(Object.assign(Error('Gebruik uitsluitend een toegestane gebruikersactie.'),{code:'USER_EVENT_REQUIRED'}));
      const captured=copy(event);
      return operation(()=>commit(contractCall(()=>Contract.transition(state,captured))));
    }
    function preparePin(pin,repeat,credentialRef){
      return operation(async()=>{
        const valid=Contract.validatePin(pin,repeat);
        if(!valid.valid)return {state:snapshot(),error:valid,executed:[]};
        if(state.stage!=='configuring'||!state.configuration.acknowledged||state.connectivity!=='online')fail('PIN_NOT_READY');
        const result=contractCall(()=>Contract.providePin(state,pin,repeat,credentialRef));
        if(!result.commands.length){
          // Explicit user retry of the already-checkpointed preparation intent.
          // Native must verify the same immutable handle/secret, not rotate it.
          // Even ready handles must not silently accept a different typed PIN.
          result.commands=[{kind:'prepare-credentials',binding:copy(bound),credentialRef:result.state.credentialRef}];
        }
        return commit(result,pin);
      });
    }
    function acceptReceipt(ref){return operation(async()=>commit(await verified(ref)));}
    function resume(){
      return operation(async()=>{
        let saved;
        try{saved=await services.checkpoints.load(copy(bound));}catch(_){fail('CHECKPOINT_LOAD_FAILED');}
        if(!plain(saved)||Object.keys(saved).length!==1)fail('CHECKPOINT_INVALID');
        let restored;
        if(saved.checkpoint===null){
          if(persisted!==null||state.stage!=='factory-open'||state.configuration.revision!==0)fail('CHECKPOINT_MISSING');
          restored=Contract.create(bound);
        }else restored=contractCall(()=>Contract.checkpoint(saved.checkpoint));
        if(!same(restored.binding,bound)||restored.configuration.revision<state.configuration.revision||
          (restored.configuration.revision===state.configuration.revision&&restored.configuration.digest!==state.configuration.digest)||
          restored.connectionAttempt<state.connectionAttempt||
          (state.durableClaim&&!restored.durableClaim)||
          (state.claimRequested&&!restored.claimRequested&&!(uncertainVerifiedRelease&&same(restored,uncertainVerifiedRelease)))||
          (state.membership==='added'&&restored.membership!=='added'))fail('CHECKPOINT_ROLLBACK');
        state=restored;persisted=saved.checkpoint===null?null:copy(restored);storageUncertain=false;uncertainVerifiedRelease=null;
        return commit(contractCall(()=>Contract.resume(state)));
      },true);
    }
    return Object.freeze({snapshot,dispatch,preparePin,acceptReceipt,resume});
  }
  return Object.freeze({REQUIRED,create});
});
