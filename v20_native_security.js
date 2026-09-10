/*
 * Aluvision V20 — secure first-receiver enrollment for the native app.
 *
 * The PIN and Recovery Key never leave the iPhone. Only salted,
 * domain-separated PBKDF2-SHA256 verifiers are sent to the directly connected
 * main receiver. The receiver stores those fixed-size verifiers in NVS.
 */
(() => {
  'use strict';
  if (window.AluvisionLocalTestMode?.enabled) return;

  const connection = window.AluvisionNativeConnection;
  const gateway = window.AluvisionNativeWifi;
  if (!connection?.available || typeof connection.registerSecurityProvider !== 'function' ||
      !gateway?.transact || !gateway?.gatewayRid) return;

  const USER_CODE_MIN = 8;
  const USER_CODE_MAX = 12;
  const PBKDF2_ITERATIONS = 180000;
  const RECOVERY_CHARACTERS = 20;
  const RECOVERY_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const encoder = new TextEncoder();
  let cachedStatus = null;
  let securitySession = 0;
  let statusRequest = 0;
  let setupPending = false;
  // Compatibility hook for the setup screen. The signed claim path no longer
  // retains a plaintext PIN for a later legacy enrollment/finalization step.
  function cancelPendingSetup() {}
  window.addEventListener?.('aluvision-transport-session-changed', () => {
    securitySession += 1;
    statusRequest += 1;
    cachedStatus = null;
    cancelPendingSetup();
  });

  function t(nl, en, fr, de) {
    try { return typeof window.ac === 'function' ? window.ac(nl, en, fr, de) : nl; }
    catch (_) { return nl; }
  }

  // Only local, allowlisted diagnostics may reach the setup screen. Receiver
  // replies and native exceptions can contain session material; never display them.
  function securityFailureDiagnostic(code) {
    const messages = {
      SECURITY_APP_UPDATE: ['De beveiligde verbinding is niet volledig geladen. Sluit en heropen de app of plaats de nieuwste appversie. Je receiver en PIN blijven behouden.', 'The secure connection did not load completely. Reopen the app or install the latest app version. Your receiver and PIN are kept.', 'La connexion sécurisée ne s’est pas chargée complètement. Rouvrez l’app ou installez sa dernière version. Votre récepteur et votre PIN sont conservés.', 'Die sichere Verbindung wurde nicht vollständig geladen. Öffne die App erneut oder installiere die neueste Version. Receiver und PIN bleiben erhalten.'],
      SECURITY_CONNECTION: ['Verbind opnieuw met deze receiver en tik op Opnieuw controleren.', 'Reconnect to this receiver, then tap Check again.', 'Reconnectez-vous à ce récepteur, puis vérifiez à nouveau.', 'Verbinde dich erneut mit diesem Receiver und prüfe noch einmal.'],
      SECURITY_RESPONSE: ['De app kan het beveiligde antwoord niet lezen. Gebruik de nieuwste app en receiverfirmware en controleer opnieuw.', 'The app cannot read the security response. Use the latest app and receiver firmware, then check again.', 'L’app ne peut pas lire la réponse sécurisée. Utilisez les dernières versions de l’app et du firmware, puis réessayez.', 'Die App kann die Sicherheitsantwort nicht lesen. Aktualisiere App und Receiver-Firmware und prüfe erneut.'],
      SECURITY_PROOF: ['De veilige bevestiging van deze receiver is niet gelukt. Controleer opnieuw; er wordt nog geen pincode opgeslagen.', 'Secure confirmation of this receiver failed. Check again; no PIN is being saved yet.', 'La confirmation sécurisée a échoué. Vérifiez à nouveau ; aucun PIN n’est encore enregistré.', 'Die sichere Bestätigung ist fehlgeschlagen. Prüfe erneut; es wird noch keine PIN gespeichert.'],
      SECURITY_STORAGE: ['De beveiligde opslag op deze telefoon is niet beschikbaar. Sluit de app, open ze opnieuw en probeer opnieuw. Wis je appgegevens niet.', 'Secure storage on this phone is unavailable. Close and reopen the app, then retry. Do not erase app data.', 'Le stockage sécurisé est indisponible. Fermez et rouvrez l’app, puis réessayez. N’effacez pas ses données.', 'Der sichere Speicher ist nicht verfügbar. Schließe und öffne die App erneut. Lösche keine App-Daten.'],
      SECURITY_IDENTITY: ['Deze receiver heeft een andere beveiligde identiteit. Er is niets overgenomen. Alleen als je deze receiver bewust volledig hebt gewist: Instellingen → Installaties beheren → Als nieuwe installatie instellen → Bewaren en nieuw beginnen. Anders kies je de juiste installatie en koppel je niets opnieuw.', 'This receiver has a different secure identity. Nothing was taken over. Only if you deliberately factory-reset this receiver: Settings → “Installaties beheren” → “Als nieuwe installatie instellen” → “Bewaren en nieuw beginnen”. Otherwise choose the correct installation without pairing again.', 'Ce récepteur a une autre identité sécurisée. Rien n’a été repris. Uniquement après une réinitialisation volontaire complète : Réglages → « Installaties beheren » → « Als nieuwe installatie instellen » → « Bewaren en nieuw beginnen ». Sinon, choisissez la bonne installation sans refaire l’appairage.', 'Dieser Receiver hat eine andere sichere Identität. Es wurde nichts übernommen. Nur nach bewusstem vollständigem Zurücksetzen: Einstellungen → „Installaties beheren“ → „Als nieuwe installatie instellen“ → „Bewaren en nieuw beginnen“. Andernfalls die richtige Installation wählen und nicht erneut koppeln.'],
      SECURITY_ACCESS: ['De bewaarde toegang kon niet worden bevestigd. Gebruik Bestaande installatie verbinden om je huidige PIN in te voeren.', 'Saved access could not be confirmed. Use Connect existing installation to enter your current PIN.', 'L’accès enregistré n’a pas pu être confirmé. Utilisez Connecter l’installation existante avec votre PIN actuel.', 'Der gespeicherte Zugang wurde nicht bestätigt. Nutze Bestehende Installation verbinden mit deiner aktuellen PIN.']
    };
    const key = Object.prototype.hasOwnProperty.call(messages, code) ? code : 'SECURITY_RESPONSE';
    return { code: key, message: t(...messages[key]) };
  }

  function securityFailure(error, fallback) {
    const groups = {
      SECURITY_STACK_REQUIRED: 'SECURITY_APP_UPDATE',
      TRUST_STORAGE_REQUIRED: 'SECURITY_STORAGE', TRUST_STORAGE_INVALID: 'SECURITY_STORAGE',
      TRUST_MAIN_CONFLICT: 'SECURITY_IDENTITY', TRUST_CONFLICT: 'SECURITY_IDENTITY',
      TRUST_KEY_CHANGED: 'SECURITY_IDENTITY', TRUST_KEY_MISMATCH: 'SECURITY_IDENTITY', TRUST_IDENTITY: 'SECURITY_IDENTITY',
      TRUST_OWNER_REQUIRED: 'SECURITY_ACCESS', TRUST_MISSING: 'SECURITY_ACCESS',
      TRUST_CHALLENGE: 'SECURITY_RESPONSE', TRUST_UNAVAILABLE: 'SECURITY_RESPONSE',
      TRUST_SIGNATURE: 'SECURITY_PROOF', TRUST_FINISH: 'SECURITY_PROOF',
      TRUST_EXPIRED: 'SECURITY_CONNECTION', TRUST_CANCELLED: 'SECURITY_CONNECTION'
    };
    const code = Object.prototype.hasOwnProperty.call(groups, error?.code) ? groups[error.code] : fallback;
    return securityFailureDiagnostic(code);
  }

  function exactRid(value) {
    const rid = String(value || '').trim().toUpperCase();
    return /^[0-9A-F]{16}$/.test(rid) ? rid : '';
  }

  function normalizeUserCode(value) {
    const code = String(value || '').replace(/\D/g, '');
    return code.length >= USER_CODE_MIN && code.length <= USER_CODE_MAX ? code : '';
  }

  function randomBytes(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    if (bytes.every((value) => value === 0)) bytes[bytes.length - 1] = 1;
    return bytes;
  }

  function toHex(value) {
    return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function createRecoveryKey() {
    const random = randomBytes(RECOVERY_CHARACTERS);
    const key = Array.from(random, (value) => RECOVERY_ALPHABET[value % RECOVERY_ALPHABET.length]).join('');
    return key.match(/.{1,4}/g).join('-');
  }

  async function deriveVerifier(secret, salt, purpose) {
    if (!crypto?.subtle) {
      throw new Error(t(
        'Veilige versleuteling is niet beschikbaar op dit toestel.',
        'Secure encryption is not available on this device.',
        'Le chiffrement sécurisé n’est pas disponible sur cet appareil.',
        'Sichere Verschlüsselung ist auf diesem Gerät nicht verfügbar.'
      ));
    }
    const material = await crypto.subtle.importKey(
      'raw', encoder.encode(`ALUVISION:${purpose}:1:${secret}`),
      { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const result = await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    }, material, 256);
    return toHex(new Uint8Array(result));
  }

  function directGatewayRid() {
    const rid = exactRid(gateway.gatewayRid());
    if (!gateway.isReady?.() || !rid) {
      throw new Error(t(
        'Verbind eerst rechtstreeks met je eerste receiver.',
        'Connect directly to your first receiver first.',
        'Connectez-vous d’abord directement à votre premier récepteur.',
        'Verbinde dich zuerst direkt mit deinem ersten Receiver.'
      ));
    }
    return rid;
  }

  function validSecurityReply(reply, expectedDetail = '') {
    const status = String(reply?.STATUS || '').toUpperCase();
    const detail = String(reply?.DETAIL || '').toUpperCase();
    const supported = String(reply?.SECURITY || '') === '1';
    return status === 'OK' && supported && (!expectedDetail || detail === expectedDetail);
  }

  function captureSecuritySession() {
    return { rid: directGatewayRid(), mode: connection.mode, generation: securitySession };
  }

  function secureCoordinator() {
    const secure = window.AluvisionSecureConnection;
    if (!secure || ['hasTrustedMain', 'ensure', 'control'].some(method => typeof secure[method] !== 'function')) {
      throw Object.assign(new Error('Secure connection module unavailable'), {code:'SECURITY_STACK_REQUIRED'});
    }
    return secure;
  }

  function checkSecuritySession(session) {
    if (session.generation !== securitySession || session.mode !== connection.mode || directGatewayRid() !== session.rid) {
      throw new Error(t('De receiververbinding is gewijzigd. Probeer opnieuw.', 'The receiver connection changed. Please retry.',
        'La connexion au récepteur a changé. Réessayez.', 'Die Receiver-Verbindung hat sich geändert. Versuche es erneut.'));
    }
  }

  async function getStatus(force = false, options = {}) {
    const request = ++statusRequest;
    let failureStage = 'SECURITY_CONNECTION';
    try {
      const session = captureSecuritySession();
      // A partial app load must never turn public discovery hints into owner
      // proof, nor fall back to sending PIN verifiers in a legacy raw command.
      // Check before even returning a previously trusted status cache.
      const secure = secureCoordinator();
      const rid = session.rid;
      if (!force && cachedStatus?.rid === rid && cachedStatus.mode === session.mode &&
          cachedStatus.generation === session.generation && Date.now() - cachedStatus.checkedAt < 2500) return cachedStatus;
      failureStage = 'SECURITY_RESPONSE';
      let reply = await gateway.transact({
        V: 18,
        TYPE: 'SECURITY_STATUS',
        TARGET: rid
      }, { timeout: 4200 });
      checkSecuritySession(session);
      let signedBlank = false, ownerProven = false;
      if (options.pinEntry!==true) {
        failureStage = 'SECURITY_ACCESS';
        if(reply?.PINSET==='1') await secure.recoverPendingMain?.();
        if (await secure.hasTrustedMain(rid)) {
          reply = await secure.control({V:18,TYPE:'SECURITY_STATUS',TARGET:rid},{timeout:6000});
          ownerProven = true;
        } else if (reply?.TRUSTSTATE === 'BLANK' && String(reply.PINSET) === '0') {
          failureStage = 'SECURITY_PROOF';
          const trusted = await secure.ensure(rid,{allowBlank:true});
          signedBlank = trusted.trustState === 'BLANK';
        }
        checkSecuritySession(session);
      }
      if (!validSecurityReply(reply, 'SECURITY_STATUS') || exactRid(reply.RID) !== rid ||
          !['0', '1'].includes(String(reply.PINSET))) {
        failureStage = 'SECURITY_RESPONSE';
        throw new Error(t(
          'Deze receiver ondersteunt de beveiligde pincode nog niet. Plaats eerst de nieuwste receiverfirmware.',
          'This receiver does not support the secure PIN yet. Install the latest receiver firmware first.',
          'Ce récepteur ne prend pas encore en charge le code PIN sécurisé. Installez d’abord le dernier firmware.',
          'Dieser Receiver unterstützt die sichere PIN noch nicht. Installiere zuerst die neueste Firmware.'
        ));
      }
      const result = {
        available: true,
        configured: String(reply.PINSET || '') === '1',
        trusted: String(reply.PINSET || '') === '1' && String(reply.OWNERMATCH || '') === '1' && ownerProven,
        owned: signedBlank ? false : ['0', '1'].includes(String(reply.OWNED)) ? String(reply.OWNED) === '1' : undefined,
        ownerMatches: signedBlank ? undefined : ownerProven,
        canConfigure: signedBlank,
        restoreRequired: String(reply.PINSET || '') === '1' && !ownerProven,
        pinAuthSupported: String(reply.PINAUTH || '') === '2' && typeof window.AluvisionPinSrp?.create === 'function',
        localTestMigration: signedBlank && String(reply.PINMIGRATION || '') === '1',
        retryAfterMs: Math.max(0, Number(reply.RETRYAFTERMS) || 0),
        rid,
        mode: session.mode,
        generation: session.generation,
        checkedAt: Date.now()
      };
      if (request === statusRequest) cachedStatus = result;
      return result;
    } catch (error) {
      const diagnostic = securityFailure(error, failureStage);
      const result = {
        available: false,
        configured: false,
        trusted: false,
        error: diagnostic.message,
        errorCode: diagnostic.code,
        checkedAt: Date.now()
      };
      if (request === statusRequest) cachedStatus = result;
      return result;
    }
  }

  async function configureInstallation(rawCode) {
    const code = normalizeUserCode(rawCode);
    if (!code) {
      throw new Error(t(
        'Kies een pincode van 8 tot 12 cijfers.',
        'Choose a PIN of 8 to 12 digits.',
        'Choisissez un code PIN de 8 à 12 chiffres.',
        'Wähle eine PIN mit 8 bis 12 Ziffern.'
      ));
    }
    const status = await getStatus(true);
    if (!status.available) throw Object.assign(new Error(status.error || t('Receiver niet bereikbaar.', 'Receiver unavailable.', 'Récepteur indisponible.', 'Receiver nicht erreichbar.')),{code:status.errorCode||'SECURITY_CONNECTION'});
    if (status.configured) {
      throw new Error(t(
        'Deze installatie heeft al een pincode. Kies “Bestaande installatie herstellen”.',
        'This installation already has a PIN. Choose “Restore existing installation”.',
        'Cette installation possède déjà un code PIN. Choisissez « Restaurer l’installation ».',
        'Diese Installation hat bereits eine PIN. Wähle „Bestehende Installation wiederherstellen“.'
      ));
    }
    if (status.canConfigure !== true || (status.owned === true && status.ownerMatches === false)) {
      throw new Error(t('Deze receiver heeft een andere eigenaar. Gebruik de bestaande installatiepincode om toegang te herstellen.',
        'This receiver has another owner. Use the existing installation PIN to restore access.',
        'Ce récepteur appartient à une installation existante. Utilisez son code PIN.',
        'Dieser Receiver gehört zu einer bestehenden Installation. Verwende deren PIN.'));
    }

    const secure = secureCoordinator();
    if (typeof secure.claimMain !== 'function') throw Object.assign(new Error(securityFailureDiagnostic('SECURITY_APP_UPDATE').message), {code:'SECURITY_STACK_REQUIRED'});

    const session = { rid: status.rid, mode: status.mode, generation: status.generation };
    checkSecuritySession(session);
    const rid = session.rid;
    let saltHex;
    let pinVerifier;
    let recoveryVerifier;
    let recoveryKey;
    const existingClaim = await window.AluvisionSecureConnection?.pendingClaim();
    if (existingClaim?.type === 'claim-main' && existingClaim.rid === rid) {
      saltHex = existingClaim.fields.SALT;
      const salt = Uint8Array.from(saltHex.match(/../g),value=>parseInt(value,16));
      pinVerifier = await deriveVerifier(code,salt,'PIN');
      if (pinVerifier !== existingClaim.fields.VERIFIER) throw new Error('Gebruik dezelfde pincode om de onafgeronde inrichting te hervatten.');
      recoveryVerifier = existingClaim.fields.RECOVERY; recoveryKey = existingClaim.recoveryKey;
    } else if (typeof connection.deriveSecurity === 'function') {
      const material = await connection.deriveSecurity(code);
      saltHex = String(material?.salt || '').toUpperCase();
      pinVerifier = String(material?.pinVerifier || '').toUpperCase();
      recoveryVerifier = String(material?.recoveryVerifier || '').toUpperCase();
      recoveryKey = String(material?.recoveryKey || '').toUpperCase();
    } else {
      const salt = randomBytes(16);
      recoveryKey = createRecoveryKey();
      saltHex = toHex(salt);
      [pinVerifier, recoveryVerifier] = await Promise.all([
        deriveVerifier(code, salt, 'PIN'),
        deriveVerifier(recoveryKey.replaceAll('-', ''), salt, 'RECOVERY')
      ]);
    }
    if (!/^[0-9A-F]{32}$/.test(saltHex) ||
        !/^[0-9A-F]{64}$/.test(pinVerifier) ||
        !/^[0-9A-F]{64}$/.test(recoveryVerifier) ||
        !/^[2-9A-HJ-NP-Z]{4}(?:-[2-9A-HJ-NP-Z]{4}){4}$/.test(recoveryKey)) {
      throw new Error(t(
        'De pincode kon niet veilig worden voorbereid. Probeer opnieuw.',
        'The PIN could not be prepared securely. Please try again.',
        'Le code PIN n’a pas pu être préparé en toute sécurité. Réessayez.',
        'Die PIN konnte nicht sicher vorbereitet werden. Versuche es erneut.'
      ));
    }
    checkSecuritySession(session);
    {
      const claimed = await secure.claimMain({salt:saltHex,pinVerifier,recoveryVerifier,recoveryKey,localTestMigration:status.localTestMigration===true}, {
        isCurrent:()=>{try{checkSecuritySession(session);return true;}catch{return false;}}
      });
      checkSecuritySession(session);
      cachedStatus = {available:true,configured:true,trusted:true,ownerMatches:true,owned:true,rid,mode:session.mode,generation:session.generation,checkedAt:Date.now()};
      cancelPendingSetup();
      return {ok:true,recoveryKey,physicalRequired:false,claimed:true};
    }
  }

  async function setupInstallation(rawCode) {
    if (setupPending) throw new Error(t('De pincode wordt al ingesteld.', 'The PIN is already being set.',
      'Le code PIN est en cours de création.', 'Die PIN wird bereits eingerichtet.'));
    setupPending = true;
    try { return await configureInstallation(rawCode); }
    finally { setupPending = false; }
  }

  let restorePending = false;
  const RESTORE_ERROR_CODES = new Set(['INVALID_PIN', 'PIN_LOCKED', 'PIN_AUTH_BUSY',
    'PIN_CHALLENGE_EXPIRED', 'PIN_UNSUPPORTED', 'CONNECTION', 'SNAPSHOT_MISSING',
    'SNAPSHOT_INTERRUPTED', 'SNAPSHOT_STALE', 'SNAPSHOT_VERSION', 'RECOVERY_WIFI_REQUIRED']);
  function codedRestoreError(code, message, retryAfterMs = 0) {
    return Object.assign(new Error(message), {
      code: RESTORE_ERROR_CODES.has(code) ? code : 'CONNECTION',
      retryAfterMs: Math.min(3600000, Math.max(0, Number(retryAfterMs) || 0))
    });
  }
  function restoreError(reply) {
    const detail = String(reply?.DETAIL || '');
    const make = message => codedRestoreError(detail, message, Number(reply?.RETRYAFTERMS) || 2000);
    const seconds = Math.max(1, Math.ceil((Number(reply?.RETRYAFTERMS) || 2000) / 1000));
    if (detail === 'INVALID_PIN') return make(t(
      'De pincode klopt niet. Probeer opnieuw na ' + seconds + ' seconden.',
      'Incorrect PIN. Try again after ' + seconds + ' seconds.', 'Code PIN incorrect. Réessayez dans ' + seconds + ' secondes.', 'Falsche PIN. Versuche es in ' + seconds + ' Sekunden erneut.'));
    if (detail === 'PIN_LOCKED' || detail === 'PIN_AUTH_BUSY') return make(t(
      'Wacht ' + seconds + ' seconden en probeer opnieuw.', 'Wait ' + seconds + ' seconds and retry.',
      'Attendez ' + seconds + ' secondes puis réessayez.', 'Warte ' + seconds + ' Sekunden und versuche es erneut.'));
    if (detail === 'PIN_CHALLENGE_EXPIRED') return make(t('De PIN-controle is verlopen. Probeer opnieuw.', 'The PIN check expired. Please retry.', 'La vérification a expiré. Réessayez.', 'Die PIN-Prüfung ist abgelaufen. Versuche es erneut.'));
    return make(t('PIN-herstel kon niet veilig worden voltooid. Controleer de verbinding en probeer opnieuw.',
      'PIN recovery could not complete securely. Check the connection and retry.',
      'La récupération sécurisée a échoué. Vérifiez la connexion et réessayez.',
      'Die sichere PIN-Wiederherstellung ist fehlgeschlagen. Prüfe die Verbindung und versuche es erneut.'));
  }
  async function restoreInstallation(rawCode, options = {}) {
    const code = normalizeUserCode(rawCode);
    if (!code) throw new Error(t('Vul je installatiepincode van 8 tot 12 cijfers in.', 'Enter your installation PIN of 8–12 digits.', 'Saisissez votre code PIN de 8 à 12 chiffres.', 'Gib deine Installations-PIN mit 8–12 Ziffern ein.'));
    if (restorePending) throw new Error(t('De PIN wordt al gecontroleerd.', 'The PIN is already being checked.', 'Le PIN est en cours de vérification.', 'Die PIN wird bereits geprüft.'));
    if (!['wifi','bluetooth'].includes(connection.mode)) throw codedRestoreError('RECOVERY_WIFI_REQUIRED', 'Verbind via Wi-Fi of Bluetooth met de hoofdreceiver.');
    restorePending = true;
    let session = null;
    let retained = false;
    let releaseControlPause = null;
    try {
      // The customer is proving the PIN precisely because a stored phone
      // session may be expired/revoked/unavailable. Read only capability hints
      // here; SRP + encrypted exact MAIN acknowledgement below are authority.
      const status = await getStatus(true,{pinEntry:true});
      if (!status.available) throw codedRestoreError('CONNECTION', 'Controleer de receiververbinding en probeer opnieuw.');
      if (!status.configured || !status.pinAuthSupported) {
        throw codedRestoreError('PIN_UNSUPPORTED', t('Deze receiver ondersteunt PIN-herstel nog niet. Werk eerst de receiverfirmware bij.',
          'This receiver does not support PIN recovery yet. Update its firmware first.',
          'Mettez à jour le firmware du récepteur pour récupérer l’accès par PIN.',
          'Aktualisiere zuerst die Receiver-Firmware für die PIN-Wiederherstellung.'));
      }
      const transportSession = { rid: status.rid, mode: status.mode, generation: status.generation };
      const check = () => {
        checkSecuritySession(transportSession);
        if (options.isCurrent?.() === false) throw codedRestoreError('SNAPSHOT_INTERRUPTED', 'Herstel geannuleerd.');
      };
      check();
      const rid = transportSession.rid;
      if(options.accessOnly===true&&window.AluvisionSecureConnection?.pauseForNativeOperation)
        releaseControlPause=await window.AluvisionSecureConnection.pauseForNativeOperation();
      check();
      session = window.AluvisionPinSrp.create(rid);
      let challenge;
      const deadline = Date.now() + 15000;
      do {
        check();
        challenge = await gateway.transact({ V: 18, ...session.hello }, { timeout: 4200 });
        if (validSecurityReply(challenge, 'PIN_AUTH_PENDING')) {
          if (Date.now() >= deadline) throw new Error('De PIN-controle duurde te lang. Probeer opnieuw.');
          await new Promise(resolve => setTimeout(resolve, 150));
        } else break;
      } while (Date.now() < deadline);
      if (!validSecurityReply(challenge, 'PIN_CHALLENGE')) throw restoreError(challenge);
      check();
      const proof = await session.prove(code, challenge);
      check();
      const reply = await gateway.transact({ V: 18, ...proof }, { timeout: 10000 });
      if (!validSecurityReply(reply, 'PIN_AUTHENTICATED')) throw restoreError(reply);
      const material = await session.open(reply);
      check();
      if (!material.ownerChannel) throw codedRestoreError('PIN_UNSUPPORTED', 'Werk de receiver bij voor beveiligde toegang via pincode.');
      const current = () => {
        try { check(); return true; } catch (_) { return false; }
      };
      if(options.accessOnly===true){
        if(!window.AluvisionSecureConnection?.registerRestoredOwner||!window.AluvisionAccountlessRecovery?.openOwnerSession||!window.AluvisionDirectBridge?.adoptRecoveredInstallation)
          throw codedRestoreError('PIN_UNSUPPORTED','Deze app ondersteunt de beveiligde pincodeverbinding nog niet.');
        const fields=window.AluvisionDeviceTrust.parseFields(await session.ownerCommand('CONTROL',
          'V=18;TYPE=SECURITY_STATUS;TARGET='+rid,command=>gateway.transact({V:18,...command},{timeout:8000})));
        check();
        if(fields.STATUS!=='OK'||fields.DETAIL!=='SECURITY_STATUS'||fields.RID!==rid||fields.OWNERMATCH!=='1'||fields.PINSET!=='1'||
           fields.MESHID!==material.meshId||fields.NETWORK!==material.networkKey||fields.ROLE!=='MAIN')
          throw codedRestoreError('CONNECTION','De hoofdreceiver heeft deze pincodeverbinding niet bevestigd.');
        // Persist a real trusted-device registration before reporting success.
        // The PIN itself is never stored. A failed storage/enrolment step is
        // not silently replaced with the old 90-second provisional access.
        await window.AluvisionSecureConnection.prepareOwnerRecord(material,current,{existingPin:true});check();
        await window.AluvisionAccountlessRecovery.openOwnerSession(session,material,current);check();
        await window.AluvisionSecureConnection.registerRestoredOwner(session,material,current,{existingPin:true});check();
        await window.AluvisionDirectBridge.adoptRecoveredInstallation(material);check();
        releaseControlPause?.();releaseControlPause=null;
        const owner=await window.AluvisionSecureConnection.ensure(rid,{installationId:material.meshId,isCurrent:current});check();
        session=owner.session;
        cachedStatus=null;
        const confirmed=await getStatus(true);check();
        if(!confirmed.available||!confirmed.configured||!confirmed.trusted||confirmed.rid!==rid)
          throw codedRestoreError('CONNECTION','Dit toestel is bewaard, maar de verbinding is nog niet bevestigd. Controleer opnieuw; je installatie blijft behouden.');
        retained=true;
        return{ok:true,connected:true,restored:false,configurationRestored:false,temporary:false,trustedDevice:true,
          rid,receiverType:material.receiverType};
      }
      if(!window.AluvisionAccountlessRecovery?.restoreOwnerSnapshot)throw codedRestoreError('PIN_UNSUPPORTED','Volledig herstel is in deze app niet beschikbaar.');
      if (window.AluvisionSecureConnection) {
        await window.AluvisionSecureConnection.prepareOwnerRecord(material,current,{existingPin:true});
        // Bind this newly authenticated phone before a potentially long BLE
        // snapshot. Its pinned device session can then safely rotate keys at
        // chunk boundaries without asking for the installation PIN again.
        await window.AluvisionAccountlessRecovery.openOwnerSession(session,material,current);
        await window.AluvisionSecureConnection.registerRestoredOwner(session,material,current,{existingPin:true});
        const owner=await window.AluvisionSecureConnection.ensure(rid,{installationId:material.meshId,isCurrent:current});
        session=owner.session;
      }
      const restored = options.initialize
        ? (await window.AluvisionAccountlessRecovery.openOwnerSession(session, material, current), null)
        : await window.AluvisionAccountlessRecovery.restoreOwnerSnapshot(session, material, { isCurrent: current });
      check();
      if (typeof window.AluvisionDirectBridge?.adoptRecoveredInstallation !== 'function') throw new Error('Herstel is in deze app niet beschikbaar.');
      await window.AluvisionDirectBridge.adoptRecoveredInstallation(material);
      check();
      cachedStatus = null;
      const confirmed = await getStatus(true);
      if (!confirmed.available || !confirmed.configured || !confirmed.trusted || confirmed.rid !== rid) {
        throw new Error(t('Toegang is opgeslagen, maar de receiver heeft de verbinding nog niet bevestigd. Controleer de verbinding opnieuw.',
          'Access was saved, but the receiver has not confirmed the connection yet. Check the connection again.',
          'L’accès est enregistré, mais la connexion doit encore être confirmée.',
          'Der Zugriff wurde gespeichert, die Verbindung aber noch nicht bestätigt.'));
      }
      check();
      if (restored) {
        window.AluvisionAccountlessRecovery.applyOwnerSnapshot(restored, { isCurrent: current, expected: { installationId: material.meshId } });
        await window.AluvisionSecureConnection?.markConfigurationRestored(material.meshId,current);
      }
      if(window.AluvisionSecureConnection) {
        const owner = await window.AluvisionSecureConnection.ensure(rid,{installationId:material.meshId,isCurrent:current});
        check();
        window.AluvisionAccountlessRecovery.retainOwnerSession?.(owner.session,material);
      } else window.AluvisionAccountlessRecovery.retainOwnerSession?.(session, material);
      retained = true;
      return { ok: true, restored: true, rid, receiverType: material.receiverType,
        number: material.number, configurationRestored: !!restored,
        receiverCount: restored?.state?.devices?.length || 0 };
    } catch (error) {
      throw codedRestoreError(error?.code, String(error?.message || 'PIN-herstel mislukt.'), error?.retryAfterMs);
    } finally { if (!retained) session?.close();releaseControlPause?.(); restorePending = false; }
  }

  async function finalizeInstallation(rid, options = {}) {
    const secure = secureCoordinator();
    {
      const handle = await secure.ensure(rid,{isCurrent:options.isCurrent});
      // Existing PIN access is deliberately independent of Vault/LittleFS.
      // The owner proof permits ordinary setup/control, not a fake durable
      // registration or an implicit full backup operation during Add.
      if(handle.temporaryPin)return{ok:true,temporary:true,backupReady:false,backupPending:true};
      const context = gateway.installationContext();
      const savedAccess=await window.AluvisionSecureConnection.store.load(context.meshId);
      if(savedAccess?.configurationAccess==='remote-pending')return{ok:true,trustedDevice:true,backupReady:false,backupPending:true,configurationRestoreRequired:true};
      const material = {rid,meshId:context.meshId,networkKey:context.networkKey,receiverType:handle.descriptor.receiverType,number:1,role:'MAIN'};
      await window.AluvisionAccountlessRecovery.openOwnerSession(handle.session,material,options.isCurrent);
      await window.AluvisionSecureConnection.registerRestoredOwner(handle.session,material,options.isCurrent);
      const owner = await window.AluvisionSecureConnection.ensure(rid,{installationId:material.meshId,isCurrent:options.isCurrent});
      await window.AluvisionSecureConnection.provisionTopology({isCurrent:options.isCurrent});
      window.AluvisionAccountlessRecovery.retainOwnerSession(owner.session,material);
      return {ok:true,backupReady:true};
    }
  }

  async function copyCode(value) {
    const text = String(value || '');
    try {
      await navigator.clipboard.writeText(text);
      window.toast?.(t('Recovery Key gekopieerd', 'Recovery Key copied', 'Recovery Key copiée', 'Recovery Key kopiert'));
    } catch (_) {
      window.toast?.(text);
    }
  }

  connection.registerSecurityProvider(Object.freeze({
    normalizeUserCode,
    securityFailureDiagnostic,
    getStatus,
    setupInstallation,
    restoreInstallation,
    connectExistingInstallation:(code,options={})=>restoreInstallation(code,{...options,accessOnly:true}),
    finalizeInstallation,
    cancelPendingSetup,
    copyCode
  }));
})();
