/* Owner-only local coordinator. Not automatically activated by discovery or
 * loaded remote capability booleans. A real native adapter must supply exact
 * SRP-proved sessions and durable ENCRYPTED secret journaling. No KEY fallback.
 * Legacy NODEs currently lack that owner-session bootstrap: preflight refuses
 * the entire migration, before key activation, until it genuinely exists. */
(() => {
  'use strict';
  const enc = new TextEncoder();
  const hex = bytes => Array.from(bytes, v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const bytes = value => Uint8Array.from(value.match(/../g) || [], v => parseInt(v, 16));
  const validHex = (value, length) => typeof value === 'string' && value.length === length && /^[0-9A-F]+$/.test(value) && !/^0+$/.test(value);
  const failure = (code, message) => Object.assign(new Error(message), { code });
  function fields(text) {
    if (typeof text !== 'string') throw failure('MESH_INVALID_REPLY', 'Ongeldige beveiligde bevestiging.');
    const result = Object.create(null);
    for (const item of text.split(';')) {
      const i = item.indexOf('='); if (i < 1) throw failure('MESH_INVALID_REPLY', 'Onvolledige beveiligde bevestiging.');
      const key = item.slice(0, i); if (Object.hasOwn(result, key)) throw failure('MESH_INVALID_REPLY', 'Dubbele velden in beveiligde bevestiging.');
      result[key] = item.slice(i + 1);
    }
    return result;
  }
  const encode = values => Object.entries(values).map(([k, v]) => k + '=' + v).join(';');
  const clone = value => JSON.parse(JSON.stringify(value));
  function validateInventory(installationId, receivers) {
    if (!validHex(installationId, 8) || !Array.isArray(receivers) || receivers.length < 1 || receivers.length > 30)
      throw failure('MESH_INVENTORY_INVALID', 'De volledige installatie moet bekend zijn, inclusief offline receivers.');
    const seenRids = new Set(), seenMacs = new Set();
    const items = receivers.map(value => {
      if (!validHex(value?.rid, 16) || !validHex(value?.mac, 12) || (parseInt(value.mac.slice(0, 2), 16) & 1) ||
          !['MAIN', 'NODE'].includes(value.role) || seenRids.has(value.rid) || seenMacs.has(value.mac))
        throw failure('MESH_IDENTITY_AMBIGUOUS', 'Een receiver heeft geen unieke, bevestigde identiteit.');
      seenRids.add(value.rid); seenMacs.add(value.mac);
      return Object.freeze({ rid: value.rid, mac: value.mac, role: value.role });
    });
    if (items.filter(value => value.role === 'MAIN').length !== 1) throw failure('MESH_MAIN_INVALID', 'Precies één bestaande hoofdreceiver is vereist.');
    return items.sort((a, b) => a.rid.localeCompare(b.rid));
  }
  async function inventoryDigest(crypto, receiver, peers) {
    const out = new Uint8Array(31 + peers.length * 15); out.set(enc.encode('ALV-MESH-INVENTORY-V1'));
    out.set(bytes(receiver.rid), 21); out[29] = receiver.role === 'MAIN' ? 1 : 2; out[30] = peers.length;
    peers.slice().sort((a, b) => a.rid.localeCompare(b.rid)).forEach((peer, i) => {
      out.set(bytes(peer.rid), 31 + i * 15); out.set(bytes(peer.mac), 39 + i * 15); out[45 + i * 15] = peer.role === 'MAIN' ? 1 : 2;
    });
    return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', out)));
  }
  function compactStage(plan, receiver, peer) {
    if (!peer) return encode({ TX: plan.transaction, R: plan.revision, N: 0, I: receiver.inventory, O: plan.ownerPublic });
    return encode({ TX: plan.transaction, R: plan.revision, N: receiver.peers.length, I: receiver.inventory,
      P: peer.rid, M: peer.mac, T: peer.role === 'MAIN' ? 1 : 2, K: peer.key, O: plan.ownerPublic });
  }
  function create({ sessionProvider, journal, crypto = globalThis.crypto, now = Date.now, isCurrent = () => true, onProgress = () => {} } = {}) {
    // journal is a local native dependency, NOT a value reported by a receiver.
    if (typeof sessionProvider !== 'function' || journal?.storageClass !== 'native-encrypted-owner-secrets-v1-cas' ||
        !['save', 'load', 'remove'].every(k => typeof journal[k] === 'function') || !crypto?.subtle)
      throw failure('MESH_PROVISIONING_UNAVAILABLE', 'Veilige installatie-upgrade is nog niet beschikbaar op dit toestel.');
    let running = false, epoch = 0, plan = null, journalOwned = false;
    function check(generation) {
      if (generation !== epoch || !isCurrent()) throw failure('MESH_CANCELLED', 'De beveiligde installatie-upgrade is onderbroken.');
    }
    function progress(phase, receiver, completed = 0) { onProgress(Object.freeze({ phase, rid: receiver?.rid || '', completed, total: plan?.receivers.length || 0 })); }
    async function owner(receiver, generation) {
      check(generation); const handle = await sessionProvider(Object.freeze({ rid: receiver.rid, mac: receiver.mac, role: receiver.role })); check(generation);
      if (!handle?.session?.ownerSessionActive || typeof handle.session.ownerCommand !== 'function' ||
          typeof handle.transact !== 'function' || typeof handle.isCurrent !== 'function' || !handle.isCurrent())
        throw failure('MESH_PEER_OWNER_PROOF_REQUIRED', 'Niet iedere receiver kan veilig door de eigenaar bevestigd worden. Er is niets geactiveerd.');
      return handle;
    }
    async function command(receiver, action, payload, generation) {
      const handle = await owner(receiver, generation); check(generation);
      const result = await handle.session.ownerCommand(action, payload, frame => {
        check(generation);
        if (!handle.isCurrent() || frame.TARGET !== receiver.rid) throw failure('MESH_TARGET_CHANGED', 'De geselecteerde receiver is veranderd.');
        return handle.transact(frame);
      });
      check(generation); if (!handle.isCurrent()) throw failure('MESH_TARGET_CHANGED', 'De receiververbinding is veranderd.');
      return fields(result); // only plaintext returned by the authenticated SRP adapter
    }
    async function status(receiver, generation) {
      const reply = await command(receiver, 'MESH_SECURE_STATUS', 'QUERY=STATUS', generation);
      if (reply.STATUS !== 'OK' || reply.MESHSECPROTO !== '1' || reply.SELFRID !== receiver.rid || reply.STAMAC !== receiver.mac ||
          reply.LOCALROLE !== receiver.role || reply.INSTALLATION !== plan.installationId || !/^\d{1,10}$/.test(reply.REV || '') ||
          !['LEGACY_UNSECURED', 'AUTHENTICATED_LINKS'].includes(reply.MESHSEC))
        throw failure('MESH_PEER_PROOF_MISMATCH', 'Een receiver bevestigde niet de juiste installatie en aansluiting.');
      if (reply.MESHSEC === 'AUTHENTICATED_LINKS' && reply.OWNERPUB !== plan.ownerPublic)
        throw failure('MESH_OWNER_MISMATCH', 'De bestaande eigenaaridentiteit mag niet worden vervangen.');
      return reply;
    }
    async function persist() {
      // Must complete and read back before the first possibly-mutating commit.
      const previousRevision = plan.journalRevision || 0;
      if (previousRevision >= 0xFFFFFFFF) throw failure('MESH_JOURNAL_EXHAUSTED', 'De beveiligde hersteladministratie kan niet verder verhoogd worden.');
      plan.journalRevision = previousRevision + 1;
      const stored = await journal.save(plan.id, clone(plan), journalOwned ? plan.transaction : null);
      if (stored !== true) throw failure('MESH_JOURNAL_CONFLICT', 'Er wordt al een andere beveiligde netwerkupgrade voorbereid.');
      journalOwned = true;
      const checked = await journal.load(plan.id);
      if (JSON.stringify(checked) !== JSON.stringify(plan)) throw failure('MESH_JOURNAL_UNCONFIRMED', 'De beveiligde herstelkopie kon niet bevestigd worden.');
    }
    async function activate(generation) {
      // All peers were proved before staging. Stage every exact topology before
      // any commit; never accept COMPLETE=1 for a different receipt/target.
      for (const receiver of plan.receivers) {
        if (receiver.committed) continue;
        progress('staging', receiver); receiver.stageStarted = now();
        for (const peer of (receiver.peers.length ? receiver.peers : [null])) {
          const reply = await command(receiver, 'MESH_PEER_STAGE', compactStage(plan, receiver, peer), generation);
          if (reply.STATUS !== 'OK' || reply.DETAIL !== 'MESH_KEY_STAGED' || !validHex(reply.DIGEST, 64))
            throw failure('MESH_STAGE_REJECTED', 'Een receiver heeft de volledige netwerkconfiguratie niet bevestigd.');
          receiver.digest = reply.DIGEST; receiver.complete = reply.COMPLETE === '1';
        }
        if (!receiver.complete) throw failure('MESH_INVENTORY_INCOMPLETE', 'De volledige receiverlijst is niet bevestigd. Er is nog niets geactiveerd.');
      }
      await persist(); check(generation);
      // Nodes first, owner MAIN last. A partial commit is retained as uncertain,
      // never undone by clearing pairing/PIN, inventing success or new keys.
      const ordered = plan.receivers.slice().sort((a, b) => (a.role === 'MAIN') - (b.role === 'MAIN'));
      for (const receiver of ordered) {
        if (receiver.committed) continue;
        if (now() - receiver.stageStarted >= 60000) throw failure('MESH_STAGE_EXPIRED', 'De voorbereide upgrade is verlopen; hervat de beveiligde upgrade.');
        check(generation); plan.commitStarted = true; receiver.commitIntent = true; await persist(); check(generation);
        progress('committing', receiver, ordered.filter(x => x.committed).length);
        const reply = await command(receiver, 'MESH_PEER_COMMIT', encode({ TXN: plan.transaction, DIGEST: receiver.digest }), generation);
        if (reply.STATUS !== 'OK' || reply.DETAIL !== 'MESH_KEY_COMMITTED' || reply.DIGEST !== receiver.digest)
          throw failure('MESH_COMMIT_UNCERTAIN', 'De upgradebevestiging ontbreekt. De herstelgegevens zijn bewaard.');
        const verified = await status(receiver, generation);
        if (verified.MESHSEC !== 'AUTHENTICATED_LINKS' || verified.LASTTXN !== plan.transaction || verified.DIGEST !== receiver.digest ||
            Number(verified.REV) !== plan.revision || Number(verified.MESHSECPEERS) !== receiver.peers.length)
          throw failure('MESH_COMMIT_UNCERTAIN', 'De receiver heeft de actieve beveiligde configuratie niet volledig bevestigd.');
        receiver.committed = true; await persist();
      }
      progress('complete', null, plan.receivers.length);
      if (await journal.remove(plan.id, plan.transaction, plan.journalRevision) !== true) throw failure('MESH_JOURNAL_CONFLICT', 'De upgrade is bevestigd, maar de hersteladministratie kon niet worden afgesloten.');
      return Object.freeze({ ok: true, installationId: plan.installationId, receivers: plan.receivers.length, revision: plan.revision });
    }
    return Object.freeze({
      get active() { return running; },
      cancel() { epoch++; },
      async start({ installationId, receivers, ownerPublic }) {
        if (running) throw failure('MESH_BUSY', 'De netwerkupgrade wordt al uitgevoerd.');
        if (!validHex(ownerPublic, 130) || !ownerPublic.startsWith('04')) throw failure('MESH_OWNER_INVALID', 'Een geldige eigenaaridentiteit is vereist.');
        const list = validateInventory(installationId, receivers), generation = ++epoch; running = true;
        try {
          await crypto.subtle.importKey('raw', bytes(ownerPublic), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); check(generation);
          if (await journal.load(installationId)) throw failure('MESH_RESUME_REQUIRED', 'Hervat eerst de bestaande beveiligde netwerkupgrade.'); check(generation);
          const transaction = hex(crypto.getRandomValues(new Uint8Array(8)));
          plan = { schema: 1, id: installationId, installationId, transaction, ownerPublic, revision: 1,
            commitStarted: false, receivers: list.map(receiver => ({ ...receiver, peers: [], digest: '', committed: false })) };
          // No stage/commit when one legacy NODE cannot prove owner access.
          for (const receiver of plan.receivers) { progress('checking', receiver); const current = await status(receiver, generation); plan.revision = Math.max(plan.revision, Number(current.REV) + 1); }
          if (plan.revision > 0xFFFFFFFF) throw failure('MESH_REVISION_EXHAUSTED', 'De netwerkversie kan niet veilig verhoogd worden.');
          const main = plan.receivers.find(receiver => receiver.role === 'MAIN');
          for (const node of plan.receivers.filter(receiver => receiver.role === 'NODE')) {
            const key = hex(crypto.getRandomValues(new Uint8Array(32)));
            main.peers.push({ rid: node.rid, mac: node.mac, role: 'NODE', key });
            node.peers.push({ rid: main.rid, mac: main.mac, role: 'MAIN', key });
          }
          for (const receiver of plan.receivers) receiver.inventory = await inventoryDigest(crypto, receiver, receiver.peers);
          await persist(); check(generation); return await activate(generation);
        } catch (error) {
          if (plan?.commitStarted) { progress('needs-resume'); throw failure('MESH_COMMIT_UNCERTAIN', 'De upgrade is onderbroken. De beveiligde herstelgegevens blijven bewaard.'); }
          if (plan && journalOwned) await journal.remove(plan.id, plan.transaction, plan.journalRevision); throw error;
        } finally { running = false; plan = null; journalOwned = false; }
      },
      async resume({ installationId, receivers, ownerPublic }) {
        if (running) throw failure('MESH_BUSY', 'De netwerkupgrade wordt al uitgevoerd.');
        const expected = validateInventory(installationId, receivers), generation = ++epoch; running = true;
        try {
          plan = await journal.load(installationId); check(generation);
          if (!plan || plan.schema !== 1 || plan.id !== installationId || plan.installationId !== installationId ||
              plan.ownerPublic !== ownerPublic || !validHex(plan.transaction, 16) || !Number.isInteger(plan.revision) ||
              plan.revision < 1 || plan.revision > 0xFFFFFFFF || !Number.isInteger(plan.journalRevision) || plan.journalRevision < 1 ||
              plan.journalRevision > 0xFFFFFFFF || !Array.isArray(plan.receivers)) throw failure('MESH_JOURNAL_INVALID', 'De beveiligde herstelgegevens zijn onvolledig.');
          journalOwned = true;
          const actual = validateInventory(plan.installationId, plan.receivers);
          if (JSON.stringify(actual) !== JSON.stringify(expected)) throw failure('MESH_INVENTORY_CHANGED', 'De volledige receiverlijst is veranderd. De bestaande upgrade is bewaard.');
          const main = plan.receivers.find(value => value.role === 'MAIN');
          for (const receiver of plan.receivers) {
            const peers = receiver.role === 'MAIN' ? actual.filter(value => value.role === 'NODE') : [main];
            if (!Array.isArray(receiver.peers) || receiver.peers.length !== peers.length ||
                new Set(receiver.peers.map(value => value.rid)).size !== peers.length ||
                receiver.inventory !== await inventoryDigest(crypto, receiver, peers)) throw failure('MESH_JOURNAL_INVALID', 'De voorbereide aansluitingen zijn onvolledig.');
            for (const peer of receiver.peers) {
              const expectedPeer = peers.find(value => value.rid === peer.rid && value.mac === peer.mac && value.role === peer.role);
              const reverse = plan.receivers.find(value => value.rid === peer.rid)?.peers.find(value => value.rid === receiver.rid);
              if (!expectedPeer || !validHex(peer.key, 64) || !reverse || reverse.key !== peer.key)
                throw failure('MESH_JOURNAL_INVALID', 'De beveiligde verbindingen zijn onvolledig.');
            }
            const current = await status(receiver, generation);
            const matched = current.MESHSEC === 'AUTHENTICATED_LINKS' && current.LASTTXN === plan.transaction &&
              current.DIGEST === receiver.digest && Number(current.REV) === plan.revision && Number(current.MESHSECPEERS) === receiver.peers.length;
            if (!matched && Number(current.REV) >= plan.revision) throw failure('MESH_REVISION_CONFLICT', 'Een andere eigenaar heeft de netwerkconfiguratie aangepast.');
            receiver.committed = matched;
          }
          await persist(); check(generation); return await activate(generation);
        } catch (error) {
          progress('needs-resume'); throw error; // never erase uncertain or corrupt journal
        } finally { running = false; plan = null; journalOwned = false; }
      }
    });
  }
  globalThis.AluvisionMeshProvisioning = Object.freeze({ create, inventoryDigest, compactStage, validateInventory });
})();
