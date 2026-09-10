/* Installation owner material is confined to the native encrypted CAS store.
 * Public snapshots and localStorage never contain the private key or tokens. */
(() => {
  'use strict';
  const hex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
  const unhex = value => Uint8Array.from(value.match(/../g), value => parseInt(value, 16));
  const valid = (value, length) => typeof value === 'string' && value.length === length && /^[0-9A-F]+$/.test(value) && !/^0+$/.test(value);
  const clone = value => JSON.parse(JSON.stringify(value));
  const fail = (code, message) => Object.assign(new Error(message), {code});
  function create({journal, crypto = globalThis.crypto} = {}) {
    if (journal?.storageClass !== 'native-encrypted-owner-secrets-v1-cas' || !['save', 'load'].every(key => typeof journal[key] === 'function') || !crypto?.subtle)
      throw fail('TRUST_STORAGE_REQUIRED', 'De beveiligde opslag is niet beschikbaar. Open de geïnstalleerde app.');
    const inFlight = new Set();
    const random = count => { const value = crypto.getRandomValues(new Uint8Array(count)); if (value.every(x => !x)) throw fail('TRUST_RANDOM', 'Veilige opslag kon niet worden voorbereid.'); return hex(value); };
    function checkId(id) { if (!valid(id, 8)) throw fail('TRUST_INSTALLATION', 'Ongeldige installatie.'); }
    function validate(record, id) {
      checkId(id);
      if (!record || record.schema !== 1 || record.id !== id || record.installationId !== id || !valid(record.transaction, 16) ||
          !Number.isSafeInteger(record.journalRevision) || record.journalRevision < 1 || !valid(record.owner?.publicKey, 130) || !record.owner.publicKey.startsWith('04') ||
          record.owner.privateJwk?.kty !== 'EC' || record.owner.privateJwk?.crv !== 'P-256' || typeof record.owner.privateJwk.d !== 'string' ||
          !valid(record.device?.id, 16) || !valid(record.device?.token, 64) || typeof record.receivers !== 'object' || !record.receivers ||
          Array.isArray(record.receivers) || Object.keys(record.receivers).length > 30) throw fail('TRUST_STORAGE_INVALID', 'De beveiligde installatiegegevens zijn onvolledig. Er is niets vervangen.');
      for (const [rid, receiver] of Object.entries(record.receivers)) {
        if (!valid(rid, 16) || receiver.rid !== rid || !valid(receiver.publicKey, 130) || !receiver.publicKey.startsWith('04') ||
            !['SPI', 'RGBW'].includes(receiver.receiverType) || !['MAIN', 'NODE', 'PENDING'].includes(receiver.role) ||
            receiver.mac !== undefined && (!valid(receiver.mac, 12) || (parseInt(receiver.mac.slice(0, 2), 16) & 1)))
          throw fail('TRUST_IDENTITY_INVALID', 'Een opgeslagen receiveridentiteit is ongeldig. Er is niets vervangen.');
      }
      if (Object.values(record.receivers).filter(receiver => receiver.role === 'MAIN').length > 1) throw fail('TRUST_MAIN_CONFLICT', 'De hoofdreceiver is niet eenduidig.');
      return record;
    }
    async function load(id) { checkId(id); const record = await journal.load('trust:' + id); return record === null ? null : validate(record, id); }
    async function persist(record, expected, isCurrent) {
      if (!isCurrent()) throw fail('TRUST_CANCELLED', 'De beveiligde voorbereiding is geannuleerd.');
      validate(record, record.id);
      if (await journal.save('trust:' + record.id, record, expected) !== true) throw fail('TRUST_CONFLICT', 'Deze installatie is intussen gewijzigd. Heropen de installatie.');
      const verified = await journal.load('trust:' + record.id);
      if (JSON.stringify(verified) !== JSON.stringify(record)) throw fail('TRUST_UNCONFIRMED', 'De beveiligde opslag is niet bevestigd. Probeer niet opnieuw te koppelen.');
      if (!isCurrent()) throw fail('TRUST_CANCELLED', 'De voorbereiding is gestopt; opgeslagen beveiliging blijft bewaard.');
      return clone(record);
    }
    async function createInstallation(id, isCurrent = () => true) {
      checkId(id);
      if (inFlight.has(id)) throw fail('TRUST_BUSY', 'Deze installatie wordt al voorbereid.');
      inFlight.add(id);
      try {
        const existing = await load(id); if (existing) return existing;
        if (!isCurrent()) throw fail('TRUST_CANCELLED', 'De voorbereiding is geannuleerd.');
        const pair = await crypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign', 'verify']);
        const publicKey = hex(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
        const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
        return await persist({schema: 1, id, installationId: id, transaction: random(8), journalRevision: 1,
          owner: {publicKey, privateJwk}, device: {id: random(8), token: random(32)}, receivers: {}, pending: null}, null, isCurrent);
      } finally { inFlight.delete(id); }
    }
    async function update(id, mutate, isCurrent = () => true) {
      checkId(id);
      if (typeof mutate !== 'function') throw fail('TRUST_UPDATE', 'Ongeldige opslagactie.');
      if (inFlight.has(id)) throw fail('TRUST_BUSY', 'Een beveiligde wijziging wordt nog afgerond.');
      inFlight.add(id);
      try {
        const current = await load(id); if (!current) throw fail('TRUST_MISSING', 'Herstel eerst deze installatie met je pincode.');
        const next = clone(current); await mutate(next);
        if (next.id !== id || next.transaction !== current.transaction || JSON.stringify(next.owner) !== JSON.stringify(current.owner)) throw fail('TRUST_OWNER_CHANGE', 'De bestaande eigenaar mag niet stil worden vervangen.');
        next.journalRevision = current.journalRevision + 1;
        return await persist(next, current.transaction, isCurrent);
      } finally { inFlight.delete(id); }
    }
    async function signer(id) {
      const record = await load(id); if (!record) throw fail('TRUST_MISSING', 'Herstel eerst deze installatie met je pincode.');
      const key = await crypto.subtle.importKey('jwk', record.owner.privateJwk, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign']);
      const publicKey = await crypto.subtle.importKey('raw', unhex(record.owner.publicKey), {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify']);
      const challenge = crypto.getRandomValues(new Uint8Array(32)), proof = await crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, key, challenge);
      if (!await crypto.subtle.verify({name: 'ECDSA', hash: 'SHA-256'}, publicKey, proof, challenge)) throw fail('TRUST_KEY_MISMATCH', 'De opgeslagen beveiliging is inconsistent.');
      return Object.freeze({publicKey: record.owner.publicKey, sign: async bytes => new Uint8Array(await crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, key, bytes))});
    }
    return Object.freeze({load, createInstallation, update, signer, validate,
      async pinReceiver(id, descriptor, isCurrent = () => true) {
        return update(id, record => {
          const old = record.receivers[descriptor.rid];
          if (old && (old.publicKey !== descriptor.publicKey || old.receiverType !== descriptor.receiverType || old.mac && descriptor.mac !== old.mac)) throw fail('TRUST_KEY_CHANGED', 'Deze receiver heeft een andere beveiligde identiteit. Er is niets overgenomen.');
          record.receivers[descriptor.rid] = {...old, ...clone(descriptor), role: old && descriptor.role === 'PENDING' ? old.role : descriptor.role};
        }, isCurrent);
      }
    });
  }
  window.AluvisionSecureTrustStore = Object.freeze({create});
})();
