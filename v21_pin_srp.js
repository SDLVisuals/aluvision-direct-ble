/* SRP-6a client for Espressif ESP_NG_3072/SHA512.
 * Protocol interoperability reference: ESP-IDF esp_srp.c / esp_prov srp6a.py.
 * PIN derivation reuses the native V20 record. No PIN or verifier is sent.
 * BigInt is confined to this trusted local WebView; WebCrypto handles hashes,
 * PBKDF2, randomness and authenticated encryption. Session material is transient.
 */
(() => {
  'use strict';
  const PRIME = 'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF';
  const N = BigInt('0x' + PRIME), G = 5n, WIDTH = 384;
  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8', { fatal: true });
  const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const bytes = value => {
    if (typeof value !== 'string' || !/^(?:[0-9A-F]{2})+$/.test(value)) throw new Error('Ongeldig beveiligingsantwoord.');
    return Uint8Array.from(value.match(/../g), b => parseInt(b, 16));
  };
  const integer = value => BigInt('0x' + hex(value));
  const raw = value => { let h = value.toString(16).toUpperCase(); return bytes(h.length % 2 ? '0' + h : h); };
  const pad = value => { const out = new Uint8Array(WIDTH); out.set(value, WIDTH - value.length); return out; };
  const concat = (...values) => { const out = new Uint8Array(values.reduce((n, v) => n + v.length, 0)); let at = 0; for (const v of values) { out.set(v, at); at += v.length; } return out; };
  const hash = async (...values) => new Uint8Array(await crypto.subtle.digest('SHA-512', concat(...values)));
  const mod = value => (value % N + N) % N;
  function pow(base, exponent) {
    let result = 1n; base = mod(base);
    while (exponent > 0n) { if (exponent & 1n) result = result * base % N; base = base * base % N; exponent >>= 1n; }
    return result;
  }
  function equal(a, b) { if (a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]; return diff === 0; }
  const random = length => crypto.getRandomValues(new Uint8Array(length));
  const validRid = value => typeof value === 'string' && /^[0-9A-F]{16}$/.test(value) && value !== '0000000000000000';

  function create(rid) {
    if (!validRid(rid) || !crypto?.subtle) throw new Error('Veilig PIN-herstel is niet beschikbaar.');
    let privateBytes = random(32); privateBytes[0] |= 0x80;
    let a = integer(privateBytes); privateBytes.fill(0);
    const A = pad(raw(pow(G, a))), client = hex(random(8));
    const identity = enc.encode('ALUVISION-PIN-V2:' + rid);
    let key = null, expectedM2 = null, nonce = '', expiresAt = Date.now() + 30000, phase = 'hello';
    const clear = () => { a = 0n; key?.fill(0); key = null; expectedM2?.fill(0); expectedM2 = null; phase = 'closed'; };
    return Object.freeze({
      hello: Object.freeze({ TYPE: 'SECURITY_HELLO', TARGET: rid, CLIENT: client, A: hex(A) }),
      async prove(code, fields) {
        if (phase !== 'hello') throw new Error('Voer je installatiepincode opnieuw in.');
        phase = 'proof';
        try {
          if (!/^[0-9]{8,12}$/.test(code) || fields.RID !== rid || fields.CLIENT !== client ||
              fields.PINAUTH !== '2' || fields.ITERATIONS !== '180000' ||
              !/^[0-9A-F]{32}$/.test(fields.SALT || '') || !/^[0-9A-F]{32}$/.test(fields.NONCE || '') ||
              !/^(?:[0-9A-F]{2}){1,384}$/.test(fields.B || '')) throw new Error('Ongeldige PIN-uitdaging.');
          const salt = bytes(fields.SALT), B = bytes(fields.B), b = integer(B);
          if (b <= 1n || b >= N) throw new Error('Ongeldige receiveridentiteit.');
          nonce = fields.NONCE;
          expiresAt = Date.now() + Math.min(30000, Math.max(0, Number(fields.EXPIRESMS) || 0));
          const material = await crypto.subtle.importKey('raw', enc.encode('ALUVISION:PIN:1:' + code), 'PBKDF2', false, ['deriveBits']);
          const verifier = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 180000, hash: 'SHA-256' }, material, 256));
          const password = enc.encode(hex(verifier)); verifier.fill(0);
          const inner = await hash(identity, enc.encode(':'), password); password.fill(0);
          const x = integer(await hash(salt, inner)); inner.fill(0);
          const k = integer(await hash(bytes(PRIME), pad(raw(G))));
          const u = integer(await hash(A, pad(B)));
          if (u === 0n) throw new Error('Ongeldige PIN-uitdaging.');
          const S = pow(mod(b - k * pow(G, x)), a + u * x);
          if (S === 0n) throw new Error('Ongeldige PIN-uitdaging.');
          key = await hash(raw(S)); a = 0n;
          const hn = await hash(bytes(PRIME)), hg = await hash(pad(raw(G)));
          const xor = hn.map((value, index) => value ^ hg[index]);
          const m1 = await hash(xor, await hash(identity), salt, A, B, key);
          expectedM2 = await hash(A, m1, key);
          if (Date.now() >= expiresAt) throw Object.assign(new Error('De PIN-controle is verlopen. Probeer opnieuw.'), { code: 'PIN_CHALLENGE_EXPIRED' });
          return { TYPE: 'SECURITY_AUTH', TARGET: rid, CLIENT: client, NONCE: nonce, PROOF: hex(m1) };
        } catch (error) { clear(); throw error; }
      },
      async open(fields) {
        try {
          if (Date.now() >= expiresAt) throw Object.assign(new Error('De PIN-controle is verlopen. Probeer opnieuw.'), { code: 'PIN_CHALLENGE_EXPIRED' });
          if (phase !== 'proof' || !key || Date.now() >= expiresAt ||
              fields.STATUS !== 'OK' || fields.DETAIL !== 'PIN_AUTHENTICATED' ||
              fields.PINAUTH !== '2' || fields.RID !== rid || fields.CLIENT !== client || fields.NONCE !== nonce ||
              !/^[0-9A-F]{128}$/.test(fields.M2 || '') || !equal(bytes(fields.M2), expectedM2) ||
              !/^[0-9A-F]{24}$/.test(fields.IV || '') || !/^[0-9A-F]{32}$/.test(fields.TAG || '') ||
              !/^(?:[0-9A-F]{2}){1,192}$/.test(fields.CIPHER || '')) throw new Error('De receiver kon niet veilig worden geverifieerd.');
          phase = 'opening';
          const aad = enc.encode('ALUVISION-PIN-ENVELOPE-V2|RID=' + rid + '|NONCE=' + nonce + '|CLIENT=' + client);
          const hmacKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
          const session = await crypto.subtle.sign('HMAC', hmacKey, aad);
          const aes = await crypto.subtle.importKey('raw', session, 'AES-GCM', false, ['decrypt']);
          const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(fields.IV), additionalData: aad, tagLength: 128 },
            aes, concat(bytes(fields.CIPHER), bytes(fields.TAG)));
          const values = Object.create(null);
          for (const part of dec.decode(plain).split(';')) {
            const pair = part.split('=');
            if (pair.length !== 2 || Object.hasOwn(values, pair[0])) throw new Error('Ongeldige installatiegegevens.');
            values[pair[0]] = pair[1];
          }
          if (Object.keys(values).sort().join(',') !== 'DEVTYPE,MESHID,NETWORK,NUMBER,RID,ROLE' ||
              values.RID !== rid || values.ROLE !== 'MAIN' || !validRid(values.NETWORK) ||
              !/^[0-9A-F]{8}$/.test(values.MESHID || '') || values.MESHID === '00000000' ||
              !['SPI','RGBW'].includes(values.DEVTYPE) || !/^[1-9][0-9]{0,2}$/.test(values.NUMBER || '') ||
              Number(values.NUMBER) > 250) throw new Error('Ongeldige installatiegegevens.');
          return { verified: true, rid, networkKey: values.NETWORK, meshId: values.MESHID,
            receiverType: values.DEVTYPE, number: Number(values.NUMBER), role: 'MAIN' };
        } finally { clear(); }
      },
      close: clear
    });
  }
  window.AluvisionPinSrp = Object.freeze({ create });
})();
