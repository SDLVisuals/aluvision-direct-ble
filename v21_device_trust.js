/* Pinned device ECDSA + ephemeral P-256 ECDH. First blank-device contact is
 * TOFU: the LED blink is recognition, not protection against an active MITM.
 * No owner mutation is sent until the device key is durably pinned. */
(() => {
  'use strict';
  const enc = new TextEncoder(), dec = new TextDecoder('utf-8', {fatal: true});
  const hex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
  const valid = (value, size) => typeof value === 'string' && value.length === size && /^[0-9A-F]+$/.test(value) && !/^0+$/.test(value);
  const unhex = value => Uint8Array.from(value.match(/../g), part => parseInt(part, 16));
  const fail = (code, message) => Object.assign(new Error(message), {code});
  const concat = (...items) => {const out = new Uint8Array(items.reduce((total, item) => total + item.length, 0)); let offset = 0; for (const item of items) {out.set(item, offset); offset += item.length;} return out;};
  const random = length => {const value = crypto.getRandomValues(new Uint8Array(length)); if (value.every(item => !item)) throw fail('TRUST_RANDOM', 'De veilige verbinding kon niet worden voorbereid.'); return value;};
  const fields = text => {
    if (typeof text !== 'string') throw fail('TRUST_REPLY', 'Ongeldige beveiligde bevestiging.');
    if (text.startsWith('ACK;')) text = text.slice(4);
    const result = Object.create(null);
    for (const part of text.split(';')) {
      const at = part.indexOf('='); if (at < 1) throw fail('TRUST_REPLY', 'Onvolledige beveiligde bevestiging.');
      const key = part.slice(0, at); if (!/^[A-Z][A-Z0-9_]*$/.test(key) || Object.hasOwn(result, key)) throw fail('TRUST_REPLY', 'Ongeldige beveiligde bevestiging.');
      result[key] = part.slice(at + 1);
    }
    return result;
  };
  function transcript(reply) {
    return 'ALUVISION-TRUST-V1|RID=' + reply.RID + '|PHYSID=' + reply.PHYSID + '|TYPE=' + reply.DEVTYPE + '|STATE=' + reply.TRUSTSTATE +
      '|CLIENT=' + reply.CLIENT + '|CNONCE=' + reply.CNONCE + '|SNONCE=' + reply.SNONCE +
      '|APPKEY=' + reply.APPKEY + '|DEVICEKEY=' + reply.DEVICEKEY + '|A=' + reply.A + '|B=' + reply.B;
  }
  async function ownerChannel({rid, client, nonce, rawKey, expiresAt, isCurrent, recoveryRequestRaw, recoveryRenew}) {
    let alive = true, busy = false, counter = 0, recovery = null;
    const binding = 'ALUVISION-OWNER-V1|RID=' + rid + '|NONCE=' + nonce + '|CLIENT=' + client;
    let aes;
    try {
      aes = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt']);
      const hmac = await crypto.subtle.importKey('raw', rawKey, {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
      const key = new Uint8Array(await crypto.subtle.sign('HMAC', hmac, enc.encode('ALUVISION-RECOVERY-BINARY-V1')));
      if (typeof window.createAluvisionSecureRecoveryChannel === 'function' && typeof recoveryRequestRaw === 'function')
        recovery = await window.createAluvisionSecureRecoveryChannel({key, rid, client, nonce, isValid: () => active(), requestRaw: recoveryRequestRaw,expiresAt,renew:recoveryRenew});
      key.fill(0);
    } finally {rawKey.fill(0);}
    function active() {return alive && !!aes && Date.now() < expiresAt && isCurrent();}
    function check() {if (!active()) throw fail('TRUST_EXPIRED', 'De beveiligde verbinding is verlopen. Verbind opnieuw.');}
    const close = () => {alive = false; aes = null; recovery?.close();};
    return Object.freeze({
      get ownerSessionActive() {return active();},
      recoveryRequest(path, options, current) {check(); if (!recovery) throw fail('RECOVERY_UNAVAILABLE', 'Herstel is niet beschikbaar op deze verbinding.'); return recovery.request(path, options, current);},
      recoveryContinuation(current) {check();if(!recovery)throw fail('RECOVERY_UNAVAILABLE','Herstel is niet beschikbaar op deze verbinding.');return recovery.reserveContinuation(current);},
      async ownerCommand(action, payload, transact) {
        check();
        if (busy) throw fail('OWNER_BUSY', 'Een beveiligde actie wordt nog afgerond.');
        if (!/^[A-Z_]{3,32}$/.test(action) || typeof payload !== 'string' || !payload.length || enc.encode(payload).length > 1536 || /[\x00-\x1F\x7F]/.test(payload) || typeof transact !== 'function') throw fail('OWNER_COMMAND', 'Ongeldige beveiligde opdracht.');
        if (counter >= 99999999) {close(); throw fail('TRUST_EXPIRED', 'Verbind opnieuw om veilig verder te gaan.');}
        busy = true;
        const sequence = ++counter, transaction = hex(random(8)), capturedAes = aes;
        const suffix = '|COUNTER=' + sequence + '|TXN=' + transaction + '|ACTION=' + action;
        try {
          const iv = random(12), sealed = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: enc.encode(binding + suffix + '|DIRECTION=REQUEST'), tagLength: 128}, capturedAes, enc.encode(payload)));
          check();
          const reply = await transact({TYPE: 'SECURE_OWNER', TARGET: rid, CLIENT: client, NONCE: nonce,
            COUNTER: String(sequence), TXN: transaction, ACTION: action, IV: hex(iv), CIPHER: hex(sealed.subarray(0, -16)), TAG: hex(sealed.subarray(-16))});
          check();
          if (reply?.STATUS !== 'OK' || reply.DETAIL !== 'OWNER_REPLY' || reply.RID !== rid || reply.CLIENT !== client || reply.NONCE !== nonce || reply.COUNTER !== String(sequence) || reply.TXN !== transaction || reply.ACTION !== action ||
              !valid(reply.IV, 24) || !valid(reply.TAG, 32) || !/^(?:[0-9A-F]{2}){1,1536}$/.test(reply.CIPHER || '')) throw fail('OWNER_REPLY', 'De beveiligde bevestiging hoort niet bij deze opdracht.');
          const plain = await crypto.subtle.decrypt({name: 'AES-GCM', iv: unhex(reply.IV), additionalData: enc.encode(binding + suffix + '|DIRECTION=REPLY'), tagLength: 128}, capturedAes, concat(unhex(reply.CIPHER), unhex(reply.TAG)));
          check(); return dec.decode(plain);
        } catch (error) {close(); throw error;} finally {busy = false;}
      }, close
    });
  }
  async function open({rid, receiverType, physicalId = '', expectedDeviceKey = '', allowBlank = false,
    signer, transact, pinDevice, isCurrent = () => true, recoveryRequestRaw, recoveryRenew} = {}) {
    if (!valid(rid, 16) || !['SPI', 'RGBW'].includes(receiverType) || !valid(signer?.publicKey, 130) ||
        typeof signer.sign !== 'function' || typeof transact !== 'function' || typeof pinDevice !== 'function') throw fail('TRUST_UNAVAILABLE', 'Een veilige receiververbinding is niet beschikbaar.');
    if (physicalId && !valid(physicalId, 12) || expectedDeviceKey && !valid(expectedDeviceKey, 130)) throw fail('TRUST_IDENTITY', 'De receiveridentiteit is onvolledig.');
    const client = hex(random(8)), cnonce = hex(random(16)), began = Date.now();
    const check = () => {if (!isCurrent() || Date.now() - began >= 30000) throw fail('TRUST_CANCELLED', 'De veilige receiververbinding is onderbroken.');};
    check();
    const ephemeral = await crypto.subtle.generateKey({name: 'ECDH', namedCurve: 'P-256'}, false, ['deriveBits']);
    const publicKey = hex(new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey)));
    check();
    const reply = await transact({TYPE: 'TRUST_HELLO', TARGET: rid, CLIENT: client, CNONCE: cnonce, APPKEY: signer.publicKey, A: publicKey});
    check();
    if (reply?.STATUS !== 'OK' || reply.DETAIL !== 'TRUST_CHALLENGE' || reply.RID !== rid || reply.DEVTYPE !== receiverType || !valid(reply.PHYSID, 12) ||
        reply.CLIENT !== client || reply.CNONCE !== cnonce || reply.APPKEY !== signer.publicKey || reply.A !== publicKey ||
        !valid(reply.SNONCE, 32) || !valid(reply.DEVICEKEY, 130) || !reply.DEVICEKEY.startsWith('04') || !valid(reply.B, 130) || !reply.B.startsWith('04') || !valid(reply.SIGNATURE, 128) ||
        !['BLANK', 'OWNED'].includes(reply.TRUSTSTATE) || !/^\d{1,5}$/.test(reply.EXPIRESMS || '') || Number(reply.EXPIRESMS) > 30000 || Number(reply.EXPIRESMS) < 1) throw fail('TRUST_CHALLENGE', 'De receiver kon niet veilig worden gecontroleerd.');
    if (physicalId && physicalId !== reply.PHYSID || expectedDeviceKey && expectedDeviceKey !== reply.DEVICEKEY) throw fail('TRUST_KEY_CHANGED', 'Deze receiver heeft een andere beveiligde identiteit. Er is niets overgenomen.');
    if (!expectedDeviceKey && (!allowBlank || reply.TRUSTSTATE !== 'BLANK')) throw fail('TRUST_OWNER_REQUIRED', 'Deze receiver hoort bij een bestaande installatie. Herstel eerst toegang met de installatiepincode.');
    const text = transcript(reply), deviceKey = await crypto.subtle.importKey('raw', unhex(reply.DEVICEKEY), {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify']);
    if (!await crypto.subtle.verify({name: 'ECDSA', hash: 'SHA-256'}, deviceKey, unhex(reply.SIGNATURE), enc.encode(text + '|DIRECTION=SERVER'))) throw fail('TRUST_SIGNATURE', 'De receiveridentiteit kon niet worden bevestigd.');
    check();
    if (Date.now() >= began + Number(reply.EXPIRESMS)) throw fail('TRUST_EXPIRED', 'De receivercontrole is verlopen. Probeer opnieuw.');
    const peer = await crypto.subtle.importKey('raw', unhex(reply.B), {name: 'ECDH', namedCurve: 'P-256'}, false, []);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({name: 'ECDH', public: peer}, ephemeral.privateKey, 256));
    let rawKey;
    try {
      const material = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
      rawKey = new Uint8Array(await crypto.subtle.deriveBits({name: 'HKDF', hash: 'SHA-256', salt: await crypto.subtle.digest('SHA-256', enc.encode(text)), info: enc.encode('ALUVISION-TRUST-KEY-V1')}, material, 256));
    } finally {shared.fill(0);}
    try {
      const proof = hex(await signer.sign(enc.encode(text + '|DIRECTION=CLIENT'))); check();
      const authStarted = Date.now();
      const accepted = await transact({TYPE: 'TRUST_AUTH', TARGET: rid, CLIENT: client, NONCE: reply.SNONCE, PROOF: proof});
      check();
      if (accepted?.STATUS !== 'OK' || accepted.DETAIL !== 'TRUST_AUTHENTICATED' || accepted.RID !== rid || accepted.CLIENT !== client || accepted.NONCE !== reply.SNONCE || accepted.OWNERCHANNEL !== '1' ||
          !valid(accepted.IV, 24) || !valid(accepted.TAG, 32) || !/^(?:[0-9A-F]{2}){6}$/.test(accepted.CIPHER || '')) throw fail('TRUST_FINISH', 'De beveiligde verbinding is niet bevestigd.');
      const aes = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
      const opened = await crypto.subtle.decrypt({name: 'AES-GCM', iv: unhex(accepted.IV), additionalData: enc.encode(text + '|DIRECTION=SERVER_FINISH'), tagLength: 128}, aes, concat(unhex(accepted.CIPHER), unhex(accepted.TAG)));
      if (dec.decode(opened) !== 'AUTH=1') throw fail('TRUST_FINISH', 'De beveiligde verbinding is niet bevestigd.');
      const descriptor = Object.freeze({rid, mac: reply.PHYSID, receiverType, publicKey: reply.DEVICEKEY, role: 'PENDING'});
      check(); await pinDevice(descriptor); check();
      const session = await ownerChannel({rid, client, nonce: reply.SNONCE, rawKey, expiresAt: authStarted + 90000, isCurrent, recoveryRequestRaw, recoveryRenew});
      return Object.freeze({descriptor, trustState: reply.TRUSTSTATE, nonce: reply.SNONCE, session});
    } finally {rawKey?.fill(0);}
  }
  window.AluvisionDeviceTrust = Object.freeze({open, transcript, ownerChannel, parseFields: fields});
})();
