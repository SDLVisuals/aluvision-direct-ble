/*
 * Aluvision V20 — secure first-receiver enrollment for the native app.
 *
 * The PIN and Recovery Key never leave the iPhone. Only salted,
 * domain-separated PBKDF2-SHA256 verifiers are sent to the directly connected
 * main receiver. The receiver stores those fixed-size verifiers in NVS.
 */
(() => {
  'use strict';

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
  window.addEventListener?.('aluvision-transport-session-changed', () => {
    securitySession += 1;
    statusRequest += 1;
    cachedStatus = null;
  });

  function t(nl, en, fr, de) {
    try { return typeof window.ac === 'function' ? window.ac(nl, en, fr, de) : nl; }
    catch (_) { return nl; }
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

  function checkSecuritySession(session) {
    if (session.generation !== securitySession || session.mode !== connection.mode || directGatewayRid() !== session.rid) {
      throw new Error(t('De receiververbinding is gewijzigd. Probeer opnieuw.', 'The receiver connection changed. Please retry.',
        'La connexion au récepteur a changé. Réessayez.', 'Die Receiver-Verbindung hat sich geändert. Versuche es erneut.'));
    }
  }

  async function getStatus(force = false) {
    const request = ++statusRequest;
    try {
      const session = captureSecuritySession();
      const rid = session.rid;
      if (!force && cachedStatus?.rid === rid && cachedStatus.mode === session.mode &&
          cachedStatus.generation === session.generation && Date.now() - cachedStatus.checkedAt < 2500) return cachedStatus;
      const reply = await gateway.transact({
        V: 18,
        TYPE: 'SECURITY_STATUS',
        TARGET: rid
      }, { timeout: 4200 });
      checkSecuritySession(session);
      if (!validSecurityReply(reply, 'SECURITY_STATUS') || exactRid(reply.RID) !== rid ||
          !['0', '1'].includes(String(reply.PINSET))) {
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
        trusted: String(reply.PINSET || '') === '1' && String(reply.OWNERMATCH || '') === '1',
        owned: ['0', '1'].includes(String(reply.OWNED)) ? String(reply.OWNED) === '1' : undefined,
        ownerMatches: ['0', '1'].includes(String(reply.OWNERMATCH)) ? String(reply.OWNERMATCH) === '1' : undefined,
        canConfigure: ['0', '1'].includes(String(reply.CANCONFIGURE)) ? String(reply.CANCONFIGURE) === '1' : undefined,
        restoreRequired: String(reply.PINSET || '') === '1' && String(reply.OWNERMATCH || '') !== '1',
        pinAuthSupported: String(reply.PINAUTH || '') === '2' && typeof window.AluvisionPinSrp?.create === 'function',
        retryAfterMs: Math.max(0, Number(reply.RETRYAFTERMS) || 0),
        rid,
        mode: session.mode,
        generation: session.generation,
        checkedAt: Date.now()
      };
      if (request === statusRequest) cachedStatus = result;
      return result;
    } catch (error) {
      const result = {
        available: false,
        configured: false,
        trusted: false,
        error: String(error?.message || error),
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
    if (!status.available) throw new Error(status.error || t('Receiver niet bereikbaar.', 'Receiver unavailable.', 'Récepteur indisponible.', 'Receiver nicht erreichbar.'));
    if (status.configured) {
      throw new Error(t(
        'Deze installatie heeft al een pincode. Kies “Bestaande installatie herstellen”.',
        'This installation already has a PIN. Choose “Restore existing installation”.',
        'Cette installation possède déjà un code PIN. Choisissez « Restaurer l’installation ».',
        'Diese Installation hat bereits eine PIN. Wähle „Bestehende Installation wiederherstellen“.'
      ));
    }
    if (status.canConfigure === false || (status.owned === true && status.ownerMatches === false)) {
      throw new Error(t('Deze receiver heeft een andere eigenaar. Gebruik de bestaande installatiepincode om toegang te herstellen.',
        'This receiver has another owner. Use the existing installation PIN to restore access.',
        'Ce récepteur appartient à une installation existante. Utilisez son code PIN.',
        'Dieser Receiver gehört zu einer bestehenden Installation. Verwende deren PIN.'));
    }

    const session = { rid: status.rid, mode: status.mode, generation: status.generation };
    checkSecuritySession(session);
    const rid = session.rid;
    let saltHex;
    let pinVerifier;
    let recoveryVerifier;
    let recoveryKey;
    if (typeof connection.deriveSecurity === 'function') {
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
    const reply = await gateway.transact({
      V: 18,
      TYPE: 'SECURITY_SETUP',
      TARGET: rid,
      SALT: saltHex,
      VERIFIER: pinVerifier,
      RECOVERY: recoveryVerifier
    }, { timeout: 10000 });
    checkSecuritySession(session);

    if (!validSecurityReply(reply, 'SECURITY_READY') ||
        exactRid(reply.RID) !== rid || String(reply.PINSET || '') !== '1') {
      const detail = String(reply?.DETAIL || '').toUpperCase();
      if (detail === 'SECURITY_ALREADY_SET') {
        throw new Error(t(
          'Deze installatie heeft ondertussen al een pincode.',
          'This installation already has a PIN.',
          'Cette installation possède déjà un code PIN.',
          'Diese Installation hat bereits eine PIN.'
        ));
      }
      throw new Error(t(
        'De receiver kon de pincode niet veilig bewaren. Probeer opnieuw.',
        'The receiver could not store the PIN securely. Please try again.',
        'Le récepteur n’a pas pu enregistrer le code PIN en toute sécurité. Réessayez.',
        'Der Receiver konnte die PIN nicht sicher speichern. Versuche es erneut.'
      ));
    }

    cachedStatus = { available: true, configured: true, trusted: true, rid, mode: session.mode,
      generation: session.generation, checkedAt: Date.now() };
    return { ok: true, recoveryKey, physicalRequired: false };
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
    'PIN_CHALLENGE_EXPIRED', 'PIN_UNSUPPORTED', 'CONNECTION']);
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
  async function restoreInstallation(rawCode) {
    const code = normalizeUserCode(rawCode);
    if (!code) throw new Error(t('Vul je installatiepincode van 8 tot 12 cijfers in.', 'Enter your installation PIN of 8–12 digits.', 'Saisissez votre code PIN de 8 à 12 chiffres.', 'Gib deine Installations-PIN mit 8–12 Ziffern ein.'));
    if (restorePending) throw new Error(t('De PIN wordt al gecontroleerd.', 'The PIN is already being checked.', 'Le PIN est en cours de vérification.', 'Die PIN wird bereits geprüft.'));
    restorePending = true;
    let session = null;
    try {
      const status = await getStatus(true);
      if (!status.available) throw codedRestoreError('CONNECTION', 'Controleer de receiververbinding en probeer opnieuw.');
      if (!status.configured || !status.pinAuthSupported) {
        throw codedRestoreError('PIN_UNSUPPORTED', t('Deze receiver ondersteunt PIN-herstel nog niet. Werk eerst de receiverfirmware bij.',
          'This receiver does not support PIN recovery yet. Update its firmware first.',
          'Mettez à jour le firmware du récepteur pour récupérer l’accès par PIN.',
          'Aktualisiere zuerst die Receiver-Firmware für die PIN-Wiederherstellung.'));
      }
      const transportSession = { rid: status.rid, mode: status.mode, generation: status.generation };
      checkSecuritySession(transportSession);
      const rid = transportSession.rid;
      session = window.AluvisionPinSrp.create(rid);
      let challenge;
      const deadline = Date.now() + 15000;
      do {
        checkSecuritySession(transportSession);
        challenge = await gateway.transact({ V: 18, ...session.hello }, { timeout: 4200 });
        if (validSecurityReply(challenge, 'PIN_AUTH_PENDING')) {
          if (Date.now() >= deadline) throw new Error('De PIN-controle duurde te lang. Probeer opnieuw.');
          await new Promise(resolve => setTimeout(resolve, 150));
        } else break;
      } while (Date.now() < deadline);
      if (!validSecurityReply(challenge, 'PIN_CHALLENGE')) throw restoreError(challenge);
      const proof = await session.prove(code, challenge);
      checkSecuritySession(transportSession);
      const reply = await gateway.transact({ V: 18, ...proof }, { timeout: 10000 });
      if (!validSecurityReply(reply, 'PIN_AUTHENTICATED')) throw restoreError(reply);
      const material = await session.open(reply);
      checkSecuritySession(transportSession);
      if (typeof window.AluvisionDirectBridge?.adoptRecoveredInstallation !== 'function') throw new Error('Herstel is in deze app niet beschikbaar.');
      await window.AluvisionDirectBridge.adoptRecoveredInstallation(material);
      cachedStatus = null;
      const confirmed = await getStatus(true);
      if (!confirmed.available || !confirmed.configured || !confirmed.trusted || confirmed.rid !== rid) {
        throw new Error(t('Toegang is opgeslagen, maar de receiver heeft de verbinding nog niet bevestigd. Controleer de verbinding opnieuw.',
          'Access was saved, but the receiver has not confirmed the connection yet. Check the connection again.',
          'L’accès est enregistré, mais la connexion doit encore être confirmée.',
          'Der Zugriff wurde gespeichert, die Verbindung aber noch nicht bestätigt.'));
      }
      return { ok: true, restored: true, rid, receiverType: material.receiverType,
        number: material.number, configurationRestored: false };
    } catch (error) {
      throw codedRestoreError(error?.code, String(error?.message || 'PIN-herstel mislukt.'), error?.retryAfterMs);
    } finally { session?.close(); restorePending = false; }
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
    getStatus,
    setupInstallation,
    restoreInstallation,
    copyCode
  }));
})();
