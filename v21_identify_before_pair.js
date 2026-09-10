/* Customer identification, not ownership authorization.
 * Transports validate the exact receiver ACK and preserve their existing
 * ownership/PIN restrictions. This module never sends a claim or stores data. */
(() => {
  'use strict';
  const LIMITS = Object.freeze({ identifyTimeoutMs: 6000, repeatCooldownMs: 6000,
    maxAttempts: 3, confirmationTtlMs: 60000 });
  let active = null, serial = 0;
  const safe = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  const tx = (nl, en, fr, de) => typeof window.ac === 'function' ? window.ac(nl, en, fr, de) : nl;
  const exactRid = value => /^[A-F0-9]{16}$/i.test(String(value || '')) ? String(value).toUpperCase() : '';

  function patternFromReply(reply, family, roundTripMs = 0) {
    const halfMs = family === 'RGBW' ? 180 : 250;
    const periodMs = halfMs * 2;
    const integer = value => /^\d{1,6}$/.test(String(value ?? '')) ? Number(value) : NaN;
    const phase = integer(reply?.IDENTIFYPHASEMS), remaining = integer(reply?.IDENTIFYREMAINMS);
    const timed = integer(reply?.IDENTIFYHALFMS) === halfMs && phase < periodMs && remaining <= 5000;
    const oneWayMs = Number.isFinite(roundTripMs) ? Math.min(500, Math.max(0, roundTripMs / 2)) : 0;
    return Object.freeze({ halfMs, periodMs, phaseMs: timed ? (phase + oneWayMs) % periodMs : halfMs,
      remainingMs: timed ? Math.max(0, remaining - oneWayMs) : 5000, timed });
  }
  function startBlink(flow, pattern) {
    const expectedHalf = flow.receiver.receiverType === 'RGBW' ? 180 : 250;
    const valid = pattern?.halfMs === expectedHalf && pattern.periodMs === expectedHalf * 2 &&
      Number.isFinite(pattern.phaseMs) && pattern.phaseMs >= 0 && pattern.phaseMs < pattern.periodMs &&
      Number.isFinite(pattern.remainingMs) && pattern.remainingMs >= 0 && pattern.remainingMs <= 5000;
    const timing = valid ? pattern : patternFromReply(null, flow.receiver.receiverType);
    flow.root.style.setProperty('--identify-period', `${timing.periodMs}ms`);
    flow.root.style.setProperty('--identify-offset', `${-timing.phaseMs}ms`);
    flow.root.dataset.identifyTiming = timing.timed ? 'receiver' : 'pattern';
    if (timing.remainingMs <= 0) return;
    flow.root.classList.add('is-blinking');
    flow.blinkTimer = setTimeout(() => { if (check(flow)) flow.root.classList.remove('is-blinking'); }, timing.remainingMs);
  }

  function externalCurrent(flow) {
    if (active !== flow || flow.finished) return false;
    try { return typeof flow.isCurrent !== 'function' || flow.isCurrent() === true; }
    catch (_) { return false; }
  }
  function ownsPanel(flow) {
    const modal = document.getElementById('modal');
    return Boolean(flow.root?.isConnected && modal && !modal.hidden &&
      document.querySelector('[data-v21-identify-before-pair]') === flow.root);
  }
  function clearAttempt(flow) {
    clearTimeout(flow.timeout);
    clearTimeout(flow.blinkTimer);
    flow.timeout = 0; flow.blinkTimer = 0;
    flow.abort?.abort();
    flow.abort = null;
    flow.root?.classList.remove('is-blinking');
  }
  function finish(flow, confirmed, reason = '') {
    if (flow.finished) return;
    const owned = ownsPanel(flow);
    flow.finished = true;
    flow.observer?.disconnect();
    clearInterval(flow.guard);
    clearTimeout(flow.expires);
    clearTimeout(flow.cooldownTimer);
    clearAttempt(flow);
    if (active === flow) active = null;
    // Confirmation hands this still-open panel to the setup flow. Closing it
    // first cancels commissioning listeners and leaves Home exposed when the
    // next network/storage operation fails. Only an explicit cancel closes it.
    if (owned && confirmed) {
      status(flow, 'continuing', tx('Instellingen openen…', 'Opening settings…', 'Ouverture des réglages…', 'Einstellungen werden geöffnet…'),
        tx('Je receiver is herkend. Even wachten op de volgende stap.', 'Your receiver is identified. Waiting for the next step.', 'Votre récepteur est identifié. La prochaine étape arrive.', 'Dein Receiver wurde erkannt. Der nächste Schritt wird geöffnet.'));
      flow.root.querySelectorAll('button').forEach(button => { button.disabled = true; });
    } else if (owned && ['stale', 'hidden'].includes(reason)) {
      status(flow, 'expired', tx('Verbinding onderbroken', 'Connection interrupted', 'Connexion interrompue', 'Verbindung unterbrochen'),
        tx('Je receiver is nog niet toegevoegd. Controleer de verbinding en probeer opnieuw.', 'Your receiver has not been added. Check the connection and try again.', 'Le récepteur n’a pas été ajouté. Vérifiez la connexion et réessayez.', 'Dein Receiver wurde noch nicht hinzugefügt. Prüfe die Verbindung und versuche es erneut.'));
    } else if (owned) window.closeModal?.();
    flow.resolve(confirmed
      ? { confirmed: true, rid: flow.receiver.rid, requestId: flow.requestId }
      : { confirmed: false, reason: reason || 'cancelled' });
  }
  function check(flow) {
    if (flow.finished || active !== flow) return false;
    if (!externalCurrent(flow)) { finish(flow, false, 'stale'); return false; }
    if (!ownsPanel(flow)) { finish(flow, false, 'closed'); return false; }
    return true;
  }
  function updateButtons(flow) {
    if (!flow.root) return;
    const yes = flow.root.querySelector('[data-identify-action="yes"]');
    const repeat = flow.root.querySelector('[data-identify-action="repeat"]');
    yes.disabled = !flow.identified || flow.phase !== 'ready';
    repeat.disabled = flow.phase === 'identifying' || flow.phase === 'expired' ||
      flow.attempts >= LIMITS.maxAttempts || Date.now() < flow.repeatAt;
    repeat.textContent = flow.phase === 'error'
      ? tx('Opnieuw proberen', 'Try again', 'Réessayer', 'Erneut versuchen')
      : tx('Nogmaals knipperen', 'Flash again', 'Faire clignoter', 'Erneut blinken');
  }
  function status(flow, phase, title, detail) {
    flow.phase = phase;
    flow.root.dataset.phase = phase;
    const target = flow.root.querySelector('[data-identify-status]');
    target.innerHTML = `<i aria-hidden="true">${phase === 'ready' ? '✓' : phase === 'identifying' ? '<span class="v21-identify-spinner"></span>' : '!'}</i><span><b>${safe(title)}</b><small>${safe(detail)}</small></span>`;
    updateButtons(flow);
  }
  function expire(flow) {
    if (!check(flow)) return;
    clearAttempt(flow);
    flow.identified = false;
    flow.attempt += 1;
    status(flow, 'expired', tx('Deze selectie is verlopen', 'This selection expired', 'Cette sélection a expiré', 'Diese Auswahl ist abgelaufen'),
      tx('Ga terug en kies je receiver opnieuw.', 'Go back and choose your receiver again.', 'Revenez et choisissez à nouveau votre récepteur.', 'Gehe zurück und wähle deinen Receiver erneut.'));
  }
  async function identify(flow) {
    if (!check(flow) || flow.phase === 'identifying' || flow.phase === 'expired' ||
        flow.attempts >= LIMITS.maxAttempts || Date.now() < flow.repeatAt) return;
    clearAttempt(flow);
    flow.identified = false;
    flow.attempts += 1;
    const attempt = ++flow.attempt;
    // Local operation correlation only; never used as a pairing password/key.
    flow.requestId = `identify-${flow.id}-${attempt}-${Date.now().toString(36)}`;
    const requestId = flow.requestId;
    const abort = new AbortController(); flow.abort = abort;
    status(flow, 'identifying', tx('LED Line laten knipperen…', 'Making the LED Line flash…', 'Faire clignoter la LED Line…', 'LED Line blinken lassen…'),
      tx('De app stuurt de opdracht naar deze receiver.', 'The app is sending the command to this receiver.', 'L’app envoie la commande à ce récepteur.', 'Die App sendet den Befehl an diesen Receiver.'));
    const attemptCurrent = () => check(flow) && flow.attempt === attempt && !abort.signal.aborted;
    try {
      const timeout = new Promise((_, reject) => {
        flow.timeout = setTimeout(() => reject(Object.assign(new Error('IDENTIFY_TIMEOUT'), { code: 'IDENTIFY_TIMEOUT' })), LIMITS.identifyTimeoutMs);
      });
      const reply = await Promise.race([
        Promise.resolve().then(() => {
          // A customer can close this panel before the queued callback runs.
          // In that case do not begin even a harmless new identify command.
          if (!attemptCurrent()) throw new Error('IDENTIFY_CANCELLED');
          return flow.identify({ rid: flow.receiver.rid, requestId, signal: abort.signal });
        }), timeout
      ]);
      if (!attemptCurrent()) return;
      clearTimeout(flow.timeout); flow.timeout = 0;
      if (!reply || reply.ok !== true || exactRid(reply.rid) !== flow.receiver.rid || reply.requestId !== requestId) {
        throw Object.assign(new Error('IDENTIFY_NOT_CONFIRMED'), { code: 'IDENTIFY_NOT_CONFIRMED' });
      }
      flow.identified = true;
      startBlink(flow, reply.pattern);
      status(flow, 'ready', tx('Kijk naar je LED Line', 'Look at your LED Line', 'Regardez votre LED Line', 'Schau auf deine LED Line'),
        tx('Knippert de juiste LED Line? Bevestig dan hieronder.', 'Is the correct LED Line flashing? Confirm below.', 'Est-ce la bonne LED Line qui clignote ? Confirmez ci-dessous.', 'Blinkt die richtige LED Line? Bestätige unten.'));
    } catch (error) {
      if (!attemptCurrent()) return;
      clearAttempt(flow);
      flow.identified = false;
      const exhausted = flow.attempts >= LIMITS.maxAttempts;
      status(flow, exhausted ? 'exhausted' : 'error', tx('Herkenning niet bevestigd', 'Identification not confirmed', 'Identification non confirmée', 'Erkennung nicht bestätigt'),
        exhausted
          ? tx('Ga terug, controleer stroom en bereik, en kies de receiver opnieuw.', 'Go back, check power and range, and choose the receiver again.', 'Revenez, vérifiez l’alimentation et la portée, puis choisissez à nouveau le récepteur.', 'Gehe zurück, prüfe Strom und Reichweite und wähle den Receiver erneut.')
          : tx('Controleer de verbinding en of je receiver bijgewerkt is. Probeer daarna opnieuw.', 'Check the connection and whether your receiver is up to date. Then try again.', 'Vérifiez la connexion et si votre récepteur est à jour. Puis réessayez.', 'Prüfe die Verbindung und ob dein Receiver aktuell ist. Versuche es danach erneut.'));
    } finally {
      if (active === flow && !flow.finished && flow.attempt === attempt) {
        flow.repeatAt = Date.now() + LIMITS.repeatCooldownMs;
        updateButtons(flow);
        clearTimeout(flow.cooldownTimer);
        flow.cooldownTimer = setTimeout(() => { if (check(flow)) updateButtons(flow); }, LIMITS.repeatCooldownMs);
      }
    }
  }

  function confirm(options = {}) {
    if (active) finish(active, false, 'superseded');
    const rid = exactRid(options.receiver?.rid);
    const family = String(options.receiver?.receiverType || '').toUpperCase();
    if (!rid || !['SPI', 'RGBW'].includes(family) || typeof options.identify !== 'function' || typeof window.modal !== 'function') {
      return Promise.resolve({ confirmed: false, reason: 'unavailable' });
    }
    const receiver = Object.freeze({ rid, receiverType: family, name: String(options.receiver?.name || 'Receiver').slice(0, 100),
      portCount: Math.max(1, Math.min(family === 'RGBW' ? 2 : 4, Math.round(Number(options.receiver?.portCount) || (family === 'RGBW' ? 2 : 4)))) });
    return new Promise(resolve => {
      const flow = { id: ++serial, resolve, receiver, identify: options.identify, isCurrent: options.isCurrent,
        phase: 'initial', attempts: 0, attempt: 0, repeatAt: 0, identified: false, finished: false };
      active = flow;
      if (!externalCurrent(flow)) { finish(flow, false, 'stale'); return; }
      window.modal(`<section class="v21-identify-pair" data-v21-identify-before-pair="${flow.id}" data-phase="initial" data-preserve-transport-copy>
        <header><div class="eyebrow">${tx('RECEIVER TOEVOEGEN', 'ADD RECEIVER', 'AJOUTER UN RÉCEPTEUR', 'RECEIVER HINZUFÜGEN')}</div><h1>${tx('Is dit jouw LED Line?', 'Is this your LED Line?', 'Est-ce votre LED Line ?', 'Ist das deine LED Line?')}</h1><p>${tx('Herken je verlichting voordat je verdergaat.', 'Identify your lighting before continuing.', 'Identifiez votre éclairage avant de continuer.', 'Erkenne deine Beleuchtung, bevor du fortfährst.')}</p></header>
        <div class="v21-identify-visual" aria-hidden="true"><div class="v21-identify-board"><i>${window.AluvisionIcons?.markup?.('receiver') || '▣'}</i><b>${family}-${tx('receiver', 'receiver', 'récepteur', 'Receiver')}</b></div><div class="v21-identify-wire"></div><div class="v21-identify-rail"><i></i></div></div>
        <div class="v21-identify-device"><span class="v21-identify-device-icon" aria-hidden="true">${window.AluvisionIcons?.markup?.('receiver') || '▣'}</span><span><b>${safe(receiver.name)}</b><small>${family} · ${receiver.portCount} ${tx(receiver.portCount === 1 ? 'uitgang' : 'uitgangen', receiver.portCount === 1 ? 'output' : 'outputs', receiver.portCount === 1 ? 'sortie' : 'sorties', receiver.portCount === 1 ? 'Ausgang' : 'Ausgänge')}</small></span></div>
        <div class="v21-identify-status" data-identify-status role="status" aria-live="polite"></div>
        <button class="button soft v21-identify-repeat" type="button" data-identify-action="repeat">${tx('Nogmaals knipperen', 'Flash again', 'Faire clignoter', 'Erneut blinken')}</button>
        <footer><button class="button soft" type="button" data-identify-action="no">${tx('Andere receiver', 'Other receiver', 'Autre récepteur', 'Anderer Receiver')}</button><button class="button" type="button" data-identify-action="yes" disabled>${tx('Ja, deze toevoegen', 'Yes, add this one', 'Oui, ajouter celui-ci', 'Ja, diesen hinzufügen')} <span aria-hidden="true">→</span></button></footer>
      </section>`, { viewKey: `v21-identify-pair-${flow.id}` });
      flow.root = document.querySelector(`[data-v21-identify-before-pair="${flow.id}"]`);
      if (!flow.root) { finish(flow, false, 'unavailable'); return; }
      flow.root.querySelector('[data-identify-action="no"]').addEventListener('click', () => {
        // A disconnected selection has already resolved to its transport, but
        // its visible explanation must still have a working way out.
        if (flow.finished) { if (ownsPanel(flow)) window.closeModal?.(); return; }
        finish(flow, false, 'other-receiver');
      });
      flow.root.querySelector('[data-identify-action="repeat"]').addEventListener('click', () => { void identify(flow); });
      flow.root.querySelector('[data-identify-action="yes"]').addEventListener('click', () => {
        if (check(flow) && flow.phase === 'ready' && flow.identified) finish(flow, true);
      });
      flow.observer = new MutationObserver(() => { check(flow); });
      flow.observer.observe(document.getElementById('modal'), { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
      flow.guard = setInterval(() => { check(flow); }, 250);
      flow.expires = setTimeout(() => expire(flow), LIMITS.confirmationTtlMs);
      void identify(flow);
    });
  }
  window.AluvisionIdentifyBeforePair = Object.freeze({ confirm, limits: LIMITS, patternFromReply,
    cancel(reason = 'cancelled') { if (active) finish(active, false, String(reason)); } });
  window.addEventListener('pagehide', () => window.AluvisionIdentifyBeforePair.cancel('hidden'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') window.AluvisionIdentifyBeforePair.cancel('hidden');
  });
})();
