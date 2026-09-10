/* Bounded AES-GCM recovery channel. Keys are transient SRP/resume-derived
 * keys, not the public installation tag or legacy radio compatibility key.
 * HTTP sees only authenticated ciphertext. There is no plaintext fallback. */
(() => {
  'use strict';
  const HEADER = 92, AAD = 76, BLOCK = 4096, META = 20, LIMIT = 60 + 128 * 1024;
  const MAGIC = 0x31535241;
  const enc = new TextEncoder(), dec = new TextDecoder('utf-8', { fatal: true });
  const paths = new Map([['/alv/recovery/status', 1], ['/alv/recovery/control', 2], ['/alv/recovery/snapshot', 3]]);
  const fromHex = (value, count) => {
    if (typeof value !== 'string' || value.length !== count * 2 || !/^[0-9A-F]+$/.test(value) || /^0+$/.test(value)) throw new Error('Ongeldige beveiligde receiveridentiteit.');
    return Uint8Array.from(value.match(/../g), part => parseInt(part, 16));
  };
  const equal = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
  const bytes = value => value instanceof Uint8Array ? value : value instanceof ArrayBuffer ? new Uint8Array(value) : enc.encode(String(value || ''));
  async function create({ key, rid, client, nonce, isValid, requestRaw, expiresAt = Infinity, renew = null }) {
    if (!(key instanceof Uint8Array) || key.length !== 32 || typeof isValid !== 'function' || typeof requestRaw !== 'function') throw new Error('Beveiligd herstel is niet beschikbaar.');
    const identity = new Uint8Array(32);
    identity.set(fromHex(rid, 8)); identity.set(fromHex(client, 8), 8); identity.set(fromHex(nonce, 16), 16);
    let aes;
    try { aes = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt', 'decrypt']); }
    finally { key.fill(0); }
    let counter = 0, busy = false, alive = true;
    function check(isCurrent) {
      if (!alive || !aes || !isValid() || !isCurrent()) { alive = false; aes = null; throw new Error('De beveiligde herstelsessie is verlopen. Verbind opnieuw.'); }
    }
    async function exchange(operation, kind, transaction, offset, total, plain, isCurrent) {
      check(isCurrent);
      if (++counter >= 0xFFFFFFFF || plain.length > BLOCK || total > LIMIT || offset > total) throw new Error('Ongeldig herstelblok.');
      const header = new Uint8Array(HEADER), view = new DataView(header.buffer);
      view.setUint32(0, MAGIC, true); header[4] = 1; header[5] = 0; header[6] = operation; header[7] = kind;
      header.set(identity, 8); view.setUint32(40, counter, true); header.set(transaction, 44);
      view.setUint32(52, offset, true); view.setUint32(56, total, true); view.setUint16(60, plain.length, true);
      crypto.getRandomValues(header.subarray(64, 76));
      const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: header.subarray(64, 76), additionalData: header.subarray(0, AAD), tagLength: 128 }, aes, plain));
      header.set(sealed.subarray(-16), 76);
      const frame = new Uint8Array(HEADER + plain.length); frame.set(header); frame.set(sealed.subarray(0, -16), HEADER);
      check(isCurrent);
      const response = await requestRaw(frame, rid);
      check(isCurrent);
      if (response?.status !== 200 || !(response.bytes instanceof Uint8Array)) throw new Error('De receiver accepteert deze beveiligde herstelsessie niet.');
      const reply = response.bytes;
      if (reply.length < HEADER + META || reply.length > HEADER + BLOCK) throw new Error('Ongeldig beveiligd herstelantwoord.');
      const rv = new DataView(reply.buffer, reply.byteOffset, reply.byteLength), length = rv.getUint16(60, true);
      if (rv.getUint32(0, true) !== MAGIC || reply[4] !== 1 || reply[5] !== 1 ||
          !equal(reply.subarray(6, 60), header.subarray(6, 60)) || rv.getUint16(62, true) !== 0 ||
          length < META || length > BLOCK || reply.length !== HEADER + length) throw new Error('De herstelbevestiging hoort niet bij deze opdracht.');
      const ciphertext = new Uint8Array(length + 16); ciphertext.set(reply.subarray(HEADER)); ciphertext.set(reply.subarray(76, 92), length);
      const opened = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: reply.subarray(64, 76), additionalData: reply.subarray(0, AAD), tagLength: 128 }, aes, ciphertext));
      check(isCurrent);
      const meta = new DataView(opened.buffer, opened.byteOffset, opened.byteLength);
      const result = { status: meta.getUint16(0, true), complete: meta.getUint16(2, true), accepted: meta.getUint32(4, true), total: meta.getUint32(8, true), offset: meta.getUint32(12, true), size: meta.getUint16(16, true), bytes: opened.subarray(META) };
      if (result.status < 200 || result.status > 599 || result.complete > 1 || meta.getUint16(18, true) !== 0 ||
          result.total > LIMIT || result.offset > result.total || result.size > result.total - result.offset ||
          result.size !== opened.length - META) throw new Error('Ongeldige herstelgrootte.');
      return result;
    }
    function lease(isCurrent,ownsBusy=false) {
      return {identity:{rid,client,nonce},nearExpiry:()=>Date.now()+15000>=expiresAt,renew,
        check:()=>check(isCurrent),release:()=>{if(ownsBusy)busy=false;},abort:()=>{alive=false;aes=null;},
        send:async(...args)=>{try{return await exchange(...args,isCurrent);}catch(error){alive=false;aes=null;throw error;}}};
    }
    return Object.freeze({
      // Internal continuation capability; no key material leaves this closure.
      reserveContinuation(isCurrent=()=>true) {check(isCurrent);if(busy)throw new Error('Een herstelactie wordt nog afgerond.');busy=true;return lease(isCurrent,true);},
      async request(path, options = {}, isCurrent = () => true) {
        check(isCurrent);
        if (busy) throw new Error('Een herstelactie wordt nog afgerond.');
        const operation = paths.get(path), input = bytes(options.body);
        if (!operation || (options.method && options.method !== 'POST') || !input.length || input.length > LIMIT || (operation !== 3 && input.length > BLOCK)) throw new Error('Ongeldige herstelopdracht.');
        busy = true;
        let active=lease(isCurrent),started=false;
        try {
          const transaction = crypto.getRandomValues(new Uint8Array(8));
          if (transaction.every(value => !value)) transaction[0] = 1;
          const send=async(...args)=>{
            if(active.nearExpiry()&&typeof active.renew==='function') {
              if(!isCurrent())throw new Error('Herstel geannuleerd.');
              const next=await active.renew({previous:active.identity,transaction,started,isCurrent});
              if(!next||typeof next.send!=='function')throw new Error('De herstelverbinding kon niet veilig worden vernieuwd.');
              active.release();active=next;
            }
            const response=await active.send(...args);started=true;return response;
          };
          let offset = 0, response;
          while (offset < input.length) {
            const end = Math.min(input.length, offset + BLOCK);
            response = await send(operation, 1, transaction, offset, input.length, input.subarray(offset, end));
            if (response.status >= 400) return { status: response.status, text: dec.decode(response.bytes), bytes: response.bytes };
            if (response.accepted !== end || (end < input.length && (response.complete || response.total || response.size))) throw new Error('De receiver bevestigde niet het juiste herstelblok.');
            offset = end;
          }
          if (!response.complete || !response.total || response.offset !== 0 || !response.size) throw new Error('Herstelantwoord ontbreekt.');
          const result = new Uint8Array(response.total); result.set(response.bytes);
          let received = response.size;
          const status = response.status;
          while (received < result.length) {
            response = await send(operation, 2, transaction, received, result.length, new Uint8Array());
            if (!response.complete || response.status !== status || response.accepted !== input.length ||
                response.offset !== received || response.total !== result.length || !response.size) throw new Error('De herstelgegevens zijn onvolledig.');
            result.set(response.bytes, received); received += response.size;
          }
          active.check();
          return { status, bytes: result, text: operation === 3 && status === 200 && result[0] === 0x31 ? '' : dec.decode(result) };
        } catch (error) { active.abort();alive = false; aes = null; throw error; }
        finally { active.release();busy = false; }
      },
      close() { alive = false; aes = null; }
    });
  }
  window.createAluvisionSecureRecoveryChannel = create;
})();
