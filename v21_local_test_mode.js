/* Explicit, temporary local test build. Not an ownership/security mechanism.
 * Source-controlled only: no URL or stored preference can activate this mode.
 * The receiver independently permits it only for its factory-blank test profile. */
(() => {
  'use strict';
  const enabled = false;
  const message = 'PIN is tijdelijk uitgeschakeld om de verlichting te testen. Gebruik alleen je eigen lokale testopstelling. Beveiligd herstel en OTA zijn in deze teststand niet beschikbaar.';
  function assertReceiver(rid) {
    const gateway = window.AluvisionNativeWifi, direct = String(gateway?.gatewayRid?.() || '').toUpperCase();
    const target = String(rid || direct).toUpperCase();
    const info = gateway?.receiverInfo?.(direct), selected = gateway?.receiverInfo?.(target);
    const allowed = value => value && String(value.LOCALNOPIN) === '1' &&
      (value.PINSET === undefined || String(value.PINSET) === '0') && !['OWNED','LEGACY'].includes(String(value.TRUSTSTATE || '').toUpperCase());
    if (!window.AluvisionNativeConnection?.available || !gateway?.isReady?.() ||
        !/^[0-9A-F]{16}$/.test(direct) || !/^[0-9A-F]{16}$/.test(target) || !allowed(info) || !allowed(selected)) {
      throw Object.assign(new Error('Deze receiver bevestigt de tijdelijke teststand zonder PIN niet. Plaats eerst de bijbehorende testfirmware en zoek de receiver opnieuw. Een bestaande beveiligde installatie wordt niet overgenomen.'), {code:'LOCAL_NOPIN_FIRMWARE_REQUIRED'});
    }
    return true;
  }
  Object.defineProperty(window, 'AluvisionLocalTestMode', {value:Object.freeze({enabled,message,assertReceiver}),writable:false,configurable:false});
})();
