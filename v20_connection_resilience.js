/* V20.6 connection resilience
 *
 * Keeps the customer's latest light intent across a short Wi-Fi/Bluetooth
 * interruption.  The transport layer still owns acknowledgements, routing and
 * safety; this layer only schedules a bounded reconnect and replays the newest
 * state once.  It deliberately never builds a queue of obsolete slider moves.
 */
(() => {
  'use strict';

  if (window.__aluvisionV20ConnectionResilience) return;
  window.__aluvisionV20ConnectionResilience = true;

  const originalLive = typeof window.live === 'function' ? window.live : null;
  const originalDiscover = typeof window.discover === 'function' ? window.discover : null;
  if (!originalLive || !originalDiscover) return;

  const pendingGroups = new Map();
  const groupRevisions = new Map();
  const retryDelays = [420, 900, 1700, 3000, 5000, 8000];
  let retryAttempt = 0;
  let retryTimer = 0;
  let reconnectPromise = null;
  let replayPromise = null;
  let lastHealthyAt = 0;
  let state = 'idle';

  function copy(nl, en, fr, de) {
    try { return typeof window.ac === 'function' ? window.ac(nl, en, fr, de) : nl; }
    catch (_) { return nl; }
  }

  function groupKey(currentGroup) {
    return String(currentGroup?.id || 'active');
  }

  function currentDatabase() {
    try { return typeof db !== 'undefined' ? db : window.db; }
    catch (_) { return window.db; }
  }

  function activeGroup() {
    try { return typeof group !== 'undefined' ? group : window.group; }
    catch (_) { return window.group; }
  }

  function responseAccepted(response) {
    const results = Array.isArray(response?.results) ? response.results : [];
    return Boolean(results.length && results.every((item) => item?.accepted ?? item?.online));
  }

  function markAcceptedRoutes(currentGroup, response) {
    const database = currentDatabase();
    const devices = Array.isArray(database?.devices) ? database.devices : [];
    const receivers = Array.isArray(currentGroup?.receivers) ? currentGroup.receivers : [];
    const results = Array.isArray(response?.results) ? response.results : [];
    let changed = false;
    results.forEach((result) => {
      if (result?.accepted !== true && result?.confirmed !== true && result?.pendingDelivery !== true) return;
      const receiver = receivers.find((item) => String(item?.id || '') === String(result?.id || ''));
      const device = devices.find((item) => String(item?.id || '') === String(receiver?.deviceId || ''));
      if (!device) return;
      // A routed LIVE command is often acknowledged as PENDING by the main
      // receiver. That means the private iPhone-to-main route is healthy and
      // the ESP-NOW delivery is queued. Do not let the older UI layer turn the
      // satellite visibly offline while that valid ACK is being processed.
      if (device.reachableViaGateway !== true) changed = true;
      device.reachableViaGateway = true;
      device.lastAcceptedAt = Date.now();
      if (result.confirmed === true) {
        if (device.online !== true || device.espNowReachable !== true) changed = true;
        device.online = true;
        device.espNowReachable = true;
      } else if (result.pendingDelivery === true || String(result.targetAck || '').toUpperCase() === 'PENDING') {
        if (device.espNowReachable !== true) changed = true;
        device.espNowReachable = true;
      }
    });
    if (changed) {
      try { if (typeof window.updateCustomerStatus === 'function') window.updateCustomerStatus(); }
      catch (_) {}
    }
  }

  function errorText(value) {
    if (!value || typeof value !== 'object') return String(value || '');
    return [value.code, value.message, value.error && errorText(value.error)].filter(Boolean).join(' ');
  }

  function responseCanRecover(response) {
    const results = Array.isArray(response?.results) ? response.results : [];
    const error = errorText(response);
    // A failed target can be marked offline even when the actual error is an
    // owner/PIN rejection or a deliberate route change. Those are not radio
    // failures, and must never replay an older gesture into the next session.
    const allErrors = [error, ...results.map(errorText)].join(' ');
    if (/mixed receiver|zelfde groep|same group|même groupe|gleichen gruppe|NFC|TOKEN|PAIR_DENIED|KEY_MISMATCH|AUTH|SECURITY_|PIN_|TRUST_|beveilig|pincode|TRANSPORT_CHANGED|connection method changed|verbindingsmethode gewijzigd|IDENTITY_|CANCELLED|CANCELED|SUPERSEDED|LIVE_REJECTED/i.test(allErrors)) return false;
    if (!results.length) return /offline|unreachable|unavailable|not acknowledged|timeout|timed? ?out|not respond|connection|verbinding|bereikbaar|connexion|antwoordde niet/i.test(error);
    return results.some((item) => {
      if (item?.queued === true || item?.online === false) return true;
      return /offline|unreachable|timeout|connection|verbinding|bereikbaar|connexion/i.test(errorText(item));
    });
  }

  function anyReceiverReachable() {
    const database = currentDatabase();
    const records = Array.isArray(database?.devices) ? database.devices : [];
    return records.some((device) => {
      try {
        return typeof window.receiverReachable === 'function'
          ? window.receiverReachable(device)
          : Boolean(device?.online || device?.reachableViaGateway);
      } catch (_) {
        return Boolean(device?.online || device?.reachableViaGateway);
      }
    });
  }

  function publish(next, detail = '') {
    if (state === next && !detail) return;
    state = next;
    window.dispatchEvent(new CustomEvent('aluvision:connection-state', {
      detail: Object.freeze({
        state: next,
        pendingGroups: pendingGroups.size,
        lastHealthyAt,
        detail: String(detail || '')
      })
    }));
  }

  function statusNode() {
    return document.getElementById('status');
  }

  function showRecovering() {
    const node = statusNode();
    if (!node || !pendingGroups.size) return;
    const detail = copy(
      'Verbinding herstellen · je laatste wijziging blijft bewaard',
      'Reconnecting · your latest change is saved',
      'Reconnexion · votre dernière modification est conservée',
      'Verbindung wird wiederhergestellt · letzte Änderung bleibt gespeichert'
    );
    node.textContent = `● ${copy('Verbinden…', 'Connecting…', 'Connexion…', 'Verbinden…')}`;
    node.title = detail;
    node.setAttribute('aria-label', detail);
    node.dataset.connectionState = 'recovering';
    node.dataset.busy = 'true';
  }

  function clearRecoveringMarker() {
    const node = statusNode();
    if (node?.dataset.connectionState === 'recovering') {
      delete node.dataset.connectionState;
      delete node.dataset.busy;
    }
  }

  function cancelRetry() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = 0;
  }

  function rememberLatest(currentGroup, revision) {
    if (!currentGroup?.id || !Array.isArray(currentGroup.receivers) || !currentGroup.receivers.length) return;
    const key = groupKey(currentGroup);
    if (groupRevisions.get(key) !== revision) return;
    pendingGroups.set(key, { currentGroup, revision });
  }

  function retirePending(key, revision) {
    if (groupRevisions.get(key) !== revision) return;
    pendingGroups.delete(key);
    if (!pendingGroups.size) {
      cancelRetry();
      clearRecoveringMarker();
      publish('blocked');
    }
  }

  async function replayPending() {
    if (replayPromise) return replayPromise;
    if (!pendingGroups.size) return true;
    const operation = (async () => {
      const entries = [...pendingGroups.entries()];
      for (const [key, record] of entries) {
        if (document.visibilityState === 'hidden') return false;
        if (pendingGroups.get(key) !== record) continue;
        const { currentGroup, revision } = record;
        if (!currentGroup?.receivers?.length) {
          pendingGroups.delete(key);
          continue;
        }
        let response;
        try {
          response = await originalLive(currentGroup, true);
        } catch (error) {
          if (!responseCanRecover(error)) retirePending(key, revision);
          throw error;
        }
        markAcceptedRoutes(currentGroup, response);
        if (!responseAccepted(response) && !responseCanRecover(response)) {
          retirePending(key, revision);
          throw Object.assign(new Error(errorText(response) || 'Light update rejected'), { code: 'LIVE_REJECTED' });
        }
        // A gesture made while this ACK was in flight owns a newer revision.
        // Never clear that gesture because an older replay succeeded.
        if (responseAccepted(response) && pendingGroups.get(key) === record &&
            groupRevisions.get(key) === revision) pendingGroups.delete(key);
      }
      return pendingGroups.size === 0;
    })();
    replayPromise = operation.finally(() => { replayPromise = null; });
    return replayPromise;
  }

  async function reconnectNow() {
    if (reconnectPromise) return reconnectPromise;
    cancelRetry();
    if (document.visibilityState === 'hidden') { publish('waiting'); return false; }
    publish('recovering');
    showRecovering();
    let retryNeeded = false;
    const attemptRevisions = new Map([...pendingGroups].map(([key, record]) => [key, record.revision]));
    reconnectPromise = (async () => {
      try {
        // When the route was healthy moments ago, first retry only the newest
        // light state. A full inventory scan is comparatively expensive and
        // can compete with a slider gesture for the same receiver radio.
        let applied = false;
        if (anyReceiverReachable()) {
          try { applied = await replayPending(); }
          catch (error) {
            // Cached reachability can outlive the GATT/Wi-Fi session. A warm
            // replay failure must still reach the real reconnect/discovery.
            if (!responseCanRecover(error)) throw error;
          }
        }
        if (!applied) {
          if (document.visibilityState === 'hidden') { publish('waiting'); return false; }
          await originalDiscover(true);
          if (!anyReceiverReachable()) throw new Error('receiver unavailable');
          applied = await replayPending();
        }
        if (!applied) throw new Error('latest light state not acknowledged');
        retryAttempt = 0;
        lastHealthyAt = Date.now();
        clearRecoveringMarker();
        publish('ready');
        if (typeof window.updateCustomerStatus === 'function') window.updateCustomerStatus();
        return true;
      } catch (error) {
        retryNeeded = responseCanRecover(error);
        if (!retryNeeded) {
          for (const [key, revision] of attemptRevisions) retirePending(key, revision);
        }
        return false;
      } finally {
        reconnectPromise = null;
        // scheduleReconnect() used to run while reconnectPromise was still
        // set, so its guard silently cancelled every retry after attempt one.
        const newerIntent = [...pendingGroups].some(([key, record]) => attemptRevisions.get(key) !== record.revision);
        if ((retryNeeded || newerIntent) && pendingGroups.size) scheduleReconnect();
      }
    })();
    return reconnectPromise;
  }

  function scheduleReconnect(immediate = false) {
    if (!pendingGroups.size || retryTimer || reconnectPromise) return;
    if (document.visibilityState === 'hidden') {
      publish('waiting');
      return;
    }
    const index = Math.min(retryAttempt, retryDelays.length - 1);
    const delay = immediate ? 0 : retryDelays[index];
    retryAttempt = Math.min(retryAttempt + 1, retryDelays.length);
    publish('recovering');
    showRecovering();
    retryTimer = setTimeout(() => {
      retryTimer = 0;
      reconnectNow();
    }, delay);
  }

  window.live = async function resilientLive(currentGroup = activeGroup(), quiet = false) {
    const key = groupKey(currentGroup);
    const revision = (groupRevisions.get(key) || 0) + 1;
    groupRevisions.set(key, revision);
    let response;
    try {
      response = await originalLive(currentGroup, quiet);
    } catch (error) {
      if (responseCanRecover(error)) {
        rememberLatest(currentGroup, revision);
        scheduleReconnect();
      } else retirePending(key, revision);
      throw error;
    }
    markAcceptedRoutes(currentGroup, response);
    if (groupRevisions.get(key) !== revision) return response;
    if (responseAccepted(response)) {
      pendingGroups.delete(key);
      retryAttempt = 0;
      lastHealthyAt = Date.now();
      if (!pendingGroups.size) {
        cancelRetry();
        clearRecoveringMarker();
        publish('ready');
      }
    } else if (responseCanRecover(response)) {
      rememberLatest(currentGroup, revision);
      scheduleReconnect();
    } else retirePending(key, revision);
    return response;
  };

  window.discover = async function resilientDiscover(...args) {
    const result = await originalDiscover.apply(this, args);
    if (anyReceiverReachable()) {
      lastHealthyAt = Date.now();
      let replayRejected = false;
      if (pendingGroups.size) {
        try { await replayPending(); }
        catch (error) { replayRejected = !responseCanRecover(error); }
      }
      if (pendingGroups.size) scheduleReconnect();
      else if (!replayRejected) {
        retryAttempt = 0;
        cancelRetry();
        clearRecoveringMarker();
        publish('ready');
      }
    } else if (pendingGroups.size) {
      scheduleReconnect();
    }
    return result;
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      cancelRetry();
      if (pendingGroups.size) publish('waiting');
      return;
    }
    if (document.visibilityState === 'visible' && pendingGroups.size) scheduleReconnect(true);
  });
  window.addEventListener('online', () => {
    if (pendingGroups.size) scheduleReconnect(true);
  });

  window.AluvisionConnectionResilience = Object.freeze({
    get state() { return state; },
    get pendingCount() { return pendingGroups.size; },
    get lastHealthyAt() { return lastHealthyAt; },
    retry: () => reconnectNow()
  });
})();
