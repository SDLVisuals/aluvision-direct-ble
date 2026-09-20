(function (root, factory) {
  'use strict';
  var api = factory(typeof module === 'object' && module.exports ? require('./model.js') : root.LightningModel);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningFixtures = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Model) {
  'use strict';
  function create() {
    var model = { schemaVersion: 30, demo: true, stands: [{ id: 'stand-demo', name: 'Demo stand', zones: [
      { id: 'zone-rgbw', name: 'Demohoek', type: 'RGBW', layout: 'stacked', receiverIds: ['rgbw-1', 'rgbw-2', 'rgbw-3'] },
      { id: 'zone-spi', name: 'Lichttunnel', type: 'SPI', layout: 'continuous', receiverIds: ['spi-1', 'spi-2', 'spi-3'] }
    ] }], receivers: [], scenes: [], presets: [] };
    ['RGBW', 'SPI'].forEach(function (type) {
      [1,2,3].forEach(function (number) {
        var state = Model.defaultState();
        model.receivers.push({ id: type.toLowerCase() + '-' + number, name: 'Receiver ' + number, type: type,
          standId: 'stand-demo', zoneId: 'zone-' + type.toLowerCase(), role: type === 'RGBW' && number === 1 ? 'main' : 'node',
          lifecycle: 'added', connection: type === 'SPI' && number === 3 ? 'offline' : 'unknown',
          outputs: type === 'SPI' ? [1,2,3,4].map(function (port) { return { port: port, enabled: port === 1, pixels: port === 1 ? [12,28,20][number - 1] : 25, reversed: false }; }) : [], state: state });
      });
    });
    return Model.assertValid(model);
  }
  return Object.freeze({ create: create });
}));
