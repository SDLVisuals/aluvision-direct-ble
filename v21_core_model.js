/*
 * Aluvision Lighting V21 - canonical installation model (milestone 1).
 *
 * This file deliberately has no DOM, transport, or index.html dependency.  It
 * can run unchanged in a browser, Node.js, and JavaScriptCore/JXA.  V20 remains
 * the live UI until a later integration milestone.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AluvisionV21Model = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SCHEMA = 'aluvision.lighting.core';
  var SCHEMA_VERSION = 21;
  var STORAGE_KEY = 'aluvision.v21.core.v1';
  var LEGACY_KEYS = Object.freeze(['aluv12', 'aluv11', 'aluvision.full-direct.v3']);
  var TYPES = Object.freeze(['SPI', 'RGBW']);
  var RGBW_MODES = Object.freeze(['port1', 'port2', 'linked', 'separate']);
  var ID_PREFIX = Object.freeze({
    installation: 'ins', location: 'loc', zone: 'zon', group: 'grp',
    receiver: 'rcv', port: 'prt', line: 'lin', transaction: 'txn'
  });

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function array(value) {
    return Array.isArray(value) ? value : [];
  }

  function text(value, fallback) {
    var result = value == null ? '' : String(value).trim();
    return result || (fallback == null ? '' : String(fallback));
  }

  function typeOf(value) {
    var raw = text(value && (value.receiverType || value.type || value.deviceType || value.devtype), 'SPI').toUpperCase();
    return raw === 'RGBW' ? 'RGBW' : 'SPI';
  }

  function hash(value) {
    var input = String(value);
    var first = 2166136261;
    var second = 2246822519;
    var index;
    for (index = 0; index < input.length; index += 1) {
      first ^= input.charCodeAt(index);
      first = Math.imul(first, 16777619) >>> 0;
      second ^= input.charCodeAt(index) + index;
      second = Math.imul(second, 3266489917) >>> 0;
    }
    return first.toString(36).padStart(7, '0') + second.toString(36).padStart(7, '0');
  }

  function stableId(kind, naturalKey) {
    if (!ID_PREFIX[kind]) throw new Error('Unknown entity kind: ' + kind);
    return ID_PREFIX[kind] + '_' + hash(kind + '|' + String(naturalKey));
  }

  function uniqueId(kind, preferred, naturalKey, used) {
    var candidate = text(preferred);
    if (!candidate || used.has(candidate)) candidate = stableId(kind, naturalKey);
    var base = candidate;
    var suffix = 2;
    while (used.has(candidate)) {
      candidate = base + '_' + suffix;
      suffix += 1;
    }
    used.add(candidate);
    return candidate;
  }

  function defaultState(type) {
    return {
      receiverType: type,
      animation: 'Static Color', engine: 'STATIC', variant: 0,
      colors: ['#000000'], whiteChannels: [0, 0, 0, 0],
      rgbEnabled: [false, false, false, false],
      whiteEnabled: [false, false, false, false],
      background: '#000000', backgroundWhite: 0,
      backgroundRgbEnabled: false, backgroundWhiteEnabled: false,
      backgroundOn: false, brightness: 100, transitionMs: 70
    };
  }

  function normalizeState(value, type) {
    var state = Object.assign(defaultState(type), clone(object(value)));
    state.receiverType = type;
    state.colors = array(state.colors).length ? clone(state.colors) : ['#000000'];
    state.whiteChannels = array(state.whiteChannels).length ? clone(state.whiteChannels) : [0, 0, 0, 0];
    state.rgbEnabled = array(state.rgbEnabled).length ? clone(state.rgbEnabled) : [true, false, false, false];
    state.whiteEnabled = array(state.whiteEnabled).length ? clone(state.whiteEnabled) : [false, false, false, false];
    return state;
  }

  function emptyModel(name) {
    var installationId = stableId('installation', text(name, 'Aluvision installation'));
    return {
      schema: SCHEMA, schemaVersion: SCHEMA_VERSION, revision: 0,
      installation: { id: installationId, name: text(name, 'Aluvision installation'), locationIds: [] },
      locations: [], zones: [], groups: [], receivers: [], ports: [], logicalLines: [],
      scenes: [], presets: [], settings: {}, brand: [], recent: [], favorites: [],
      migration: { source: 'new', sourceVersion: null, migratedAt: null, warnings: [] }
    };
  }

  function byId(items, id) {
    return array(items).find(function (item) { return item.id === id; }) || null;
  }

  function lineType(model, line) {
    var receiver = byId(model.receivers, line.receiverId);
    return receiver ? receiver.type : text(line.type).toUpperCase();
  }

  function groupForLine(model, lineId) {
    return model.groups.find(function (group) { return group.lineIds.indexOf(lineId) >= 0; }) || null;
  }

  function sourceGroupState(group, line) {
    var states = object(group.parallelLineStates);
    return clone(states[line.id] || line.state || group.state || {});
  }

  function receiverNaturalKey(device, fallback) {
    return text(device.hardwareId || device.rid || device.id, fallback).toUpperCase();
  }

  function endpointAddress(device, number) {
    if (number === 2) return text(device.port2Rid || device.port2rid || device.rid).toUpperCase();
    return text(device.port1Rid || device.port1rid || device.rid).toUpperCase();
  }

  function receiverPortCapacity(device, type) {
    if (type === 'RGBW') return 2;
    var value = Number(device.portCapacity || device.portCapability || device.PORTCAP || device.spiPortCapability || 1);
    return value === 4 ? 4 : 1;
  }

  function receiverPortMask(device, type, assignedNumbers) {
    var capacity = receiverPortCapacity(device, type);
    var maximum = (1 << capacity) - 1;
    var explicit = Number(device.portMask);
    var assigned = array(assignedNumbers).reduce(function (mask, number) {
      return mask | (1 << (Math.max(1, Math.min(capacity, Number(number) || 1)) - 1));
    }, 0);
    if (Number.isFinite(explicit) && explicit > 0) {
      return Math.max(1, Math.min(maximum, Math.round(explicit) | assigned));
    }
    return assigned || 1;
  }

  function inferRgbwMode(device, assignments, mask) {
    var declared = text(device.rgbwOutputMode).toLowerCase();
    if (RGBW_MODES.indexOf(declared) >= 0) return declared;
    if (mask === 1) return 'port1';
    if (mask === 2) return 'port2';
    var bothInOneGroup = assignments.length > 1 && assignments.every(function (entry) {
      return entry.groupKey === assignments[0].groupKey;
    });
    return device.rgbwLinked === true || bothInOneGroup ? 'linked' : 'separate';
  }

  function directToLegacy(value) {
    var direct = object(value);
    var receivers = object(direct.receivers);
    var devices = Object.keys(receivers).map(function (key) {
      var source = object(receivers[key]);
      return Object.assign({}, clone(source), {
        id: text(source.id, key), rid: text(source.rid, key),
        receiverType: typeOf(source)
      });
    });
    var installations = array(direct.locations).map(function (location, locationIndex) {
      return {
        id: text(location.id, 'location-' + (locationIndex + 1)),
        name: text(location.name, 'Location ' + (locationIndex + 1)),
        scenes: clone(array(location.scenes)),
        zones: array(location.zones).map(function (zone, zoneIndex) {
          return {
            id: text(zone.id, 'zone-' + (zoneIndex + 1)), name: text(zone.name, 'Zone ' + (zoneIndex + 1)),
            icon: zone.icon,
            groups: array(zone.groups).map(function (group, groupIndex) {
              var groupType = text(group.type || group.receiverType, 'SPI').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
              var lines = [];
              array(group.receiverIds).forEach(function (receiverKey) {
                var receiver = object(receivers[receiverKey]);
                var deviceId = text(receiver.id, receiverKey);
                var mask = Number(receiver.portMask) || 1;
                if (groupType === 'RGBW') {
                  [1, 2].forEach(function (port) {
                    if (mask & (1 << (port - 1))) lines.push({
                      id: text(group.id, 'group') + '-' + deviceId + '-p' + port,
                      deviceId: deviceId, receiverType: 'RGBW', port: port, pixels: 1
                    });
                  });
                } else {
                  lines.push({ id: text(group.id, 'group') + '-' + deviceId, deviceId: deviceId,
                    receiverType: 'SPI', port: 1, pixels: Number(receiver.pixels) || 25 });
                }
              });
              return {
                id: text(group.id, 'group-' + (groupIndex + 1)), name: text(group.name, 'Group ' + (groupIndex + 1)),
                receiverType: groupType, layout: group.layout, parallelOrientation: group.orientation,
                receivers: lines, state: clone(group.state || {})
              };
            })
          };
        })
      };
    });
    return {
      theme: direct.theme, activeInstallationId: direct.activeLocationId,
      installations: installations, devices: devices, presets: clone(array(direct.presets)),
      settings: clone(object(direct.settings)), brand: clone(array(direct.brand)),
      recent: clone(array(direct.recent)), favorites: clone(array(direct.favorites))
    };
  }

  function migrationSource(value, options) {
    var source = object(value);
    if (source.schema === SCHEMA && Number(source.schemaVersion) === SCHEMA_VERSION) {
      var current = clone(source);
      validateModel(current);
      return current;
    }
    if (Number(source.version) === 3 && Array.isArray(source.locations)) source = directToLegacy(source);
    return migrateV20(source, options || {});
  }

  function migrateV20(legacyValue, options) {
    var legacy = object(legacyValue);
    var legacyLocations = array(legacy.installations);
    if (!legacyLocations.length && Array.isArray(legacy.locations)) legacyLocations = legacy.locations;
    var locationFingerprint = legacyLocations.map(function (item, index) {
      return text(item.id, index) + ':' + text(item.name);
    }).join('|') || 'empty';
    var model = emptyModel(text(options.installationName, 'Aluvision Lighting'));
    model.installation.id = text(options.installationId, stableId('installation', locationFingerprint));
    model.installation.name = text(options.installationName, legacy.installationName || 'Aluvision Lighting');
    model.settings = clone(object(legacy.settings));
    model.theme = text(legacy.theme, 'light');
    model.brand = clone(array(legacy.brand));
    model.recent = clone(array(legacy.recent));
    model.favorites = clone(array(legacy.favorites));
    model.presets = clone(array(legacy.presets));
    model.legacy = {
      activeInstallationId: legacy.activeInstallationId || null,
      activeGroupByZone: clone(object(legacy.activeGroupByZone)),
      studioDrafts: clone(object(legacy.studioDrafts))
    };

    var used = { location: new Set(), zone: new Set(), group: new Set(), receiver: new Set(), line: new Set() };
    var rawAssignments = [];
    legacyLocations.forEach(function (location, locationIndex) {
      array(location.zones).forEach(function (zone, zoneIndex) {
        array(zone.groups).forEach(function (group, groupIndex) {
          array(group.receivers).forEach(function (line, lineIndex) {
            rawAssignments.push({ location: location, zone: zone, group: group, line: line,
              locationIndex: locationIndex, zoneIndex: zoneIndex, groupIndex: groupIndex, lineIndex: lineIndex,
              groupKey: [locationIndex, zoneIndex, groupIndex].join(':') });
          });
        });
      });
    });

    var legacyDevices = array(legacy.devices).slice();
    rawAssignments.forEach(function (entry) {
      var line = entry.line;
      var key = text(line.deviceId || line.hardwareId || line.physicalRid || line.rid);
      if (!key) key = 'orphan-' + entry.groupKey + '-' + entry.lineIndex;
      if (!legacyDevices.some(function (device) { return text(device.id) === key; })) {
        legacyDevices.push({ id: key, hardwareId: line.hardwareId, rid: line.physicalRid || line.rid,
          name: line.name, receiverType: line.receiverType, port: line.port, pixels: line.pixels,
          reversed: line.reversed, orphanedFromLegacyLine: true });
      }
    });

    var receiverIdByLegacy = {};
    legacyDevices.forEach(function (device, deviceIndex) {
      var legacyId = text(device.id, 'legacy-device-' + deviceIndex);
      var natural = receiverNaturalKey(device, legacyId);
      var id = uniqueId('receiver', legacyId, natural, used.receiver);
      receiverIdByLegacy[legacyId] = id;
      var related = rawAssignments.filter(function (entry) {
        return text(entry.line.deviceId || entry.line.hardwareId || entry.line.physicalRid || entry.line.rid) === legacyId;
      });
      var type = typeOf(device);
      if (related.some(function (entry) { return typeOf(entry.line) === 'RGBW'; })) type = 'RGBW';
      var numbers = related.map(function (entry) { return Number(entry.line.port) || 1; });
      var capacity = receiverPortCapacity(device, type);
      var mask = receiverPortMask(device, type, numbers);
      var mode = type === 'RGBW' ? inferRgbwMode(device, related, mask) : null;
      if (type === 'RGBW') mask = mode === 'port1' ? 1 : mode === 'port2' ? 2 : 3;
      var receiver = {
        id: id, legacyId: legacyId, name: text(device.name, 'Receiver ' + (deviceIndex + 1)), type: type,
        hardwareId: text(device.hardwareId), rid: text(device.rid || device.physicalRid).toUpperCase(),
        portIds: [], preferredGateway: Boolean(device.preferredGateway || device.gateway),
        rgbwMode: mode, metadata: clone(device)
      };
      model.receivers.push(receiver);
      var number;
      for (number = 1; number <= capacity; number += 1) {
        var portId = stableId('port', id + '|' + number);
        receiver.portIds.push(portId);
        model.ports.push({
          id: portId, receiverId: id, number: number, type: type,
          endpointKey: id + ':' + number,
          endpointAddress: endpointAddress(device, number),
          active: Boolean(mask & (1 << (number - 1))),
          pixels: type === 'RGBW' ? 1 : Number(object(device.spiPorts)[number] && object(device.spiPorts)[number].pixels) ||
            (number === 1 ? Number(device.pixels) || 25 : 25),
          reversed: type === 'RGBW' ? false : Boolean(object(device.spiPorts)[number] && object(device.spiPorts)[number].reversed ||
            (number === 1 && (device.reversed || device.physicalReverse)))
        });
      }
    });

    function resolveReceiverId(line, entry) {
      var legacyId = text(line.deviceId || line.hardwareId || line.physicalRid || line.rid,
        'orphan-' + entry.groupKey + '-' + entry.lineIndex);
      return receiverIdByLegacy[legacyId];
    }

    var groupEntityByKeyType = {};
    legacyLocations.forEach(function (location, locationIndex) {
      var locationNatural = locationIndex + '|' + text(location.id) + '|' + text(location.name);
      var locationId = uniqueId('location', location.id, locationNatural, used.location);
      var locationEntity = { id: locationId, legacyId: location.id || null,
        name: text(location.name, 'Location ' + (locationIndex + 1)), zoneIds: [], sceneIds: [] };
      model.locations.push(locationEntity);
      model.installation.locationIds.push(locationId);
      array(location.zones).forEach(function (zone, zoneIndex) {
        var zoneNatural = locationId + '|' + zoneIndex + '|' + text(zone.id) + '|' + text(zone.name);
        var zoneId = uniqueId('zone', zone.id, zoneNatural, used.zone);
        var zoneEntity = { id: zoneId, legacyId: zone.id || null, locationId: locationId,
          name: text(zone.name, 'Zone ' + (zoneIndex + 1)), icon: zone.icon || '◼', groupIds: [] };
        model.zones.push(zoneEntity);
        locationEntity.zoneIds.push(zoneId);
        array(zone.groups).forEach(function (group, groupIndex) {
          var lines = array(group.receivers);
          var types = [];
          lines.forEach(function (line) {
            var receiver = byId(model.receivers, resolveReceiverId(line, {
              groupKey: [locationIndex, zoneIndex, groupIndex].join(':'), lineIndex: lines.indexOf(line)
            }));
            var currentType = receiver ? receiver.type : typeOf(line);
            if (types.indexOf(currentType) < 0) types.push(currentType);
          });
          var declared = text(group.receiverType).toUpperCase();
          if (TYPES.indexOf(declared) >= 0) types.sort(function (a) { return a === declared ? -1 : 1; });
          if (!types.length && TYPES.indexOf(declared) >= 0) types.push(declared);
          if (!types.length) types.push(null);
          types.forEach(function (groupType, typeIndex) {
            var preferred = typeIndex === 0 ? group.id : null;
            var groupNatural = zoneId + '|' + groupIndex + '|' + text(group.id) + '|' + (groupType || 'empty');
            var groupId = uniqueId('group', preferred, groupNatural, used.group);
            var groupEntity = {
              id: groupId, legacyId: group.id || null, zoneId: zoneId,
              name: text(group.name, 'Group ' + (groupIndex + 1)) + (typeIndex ? ' · ' + groupType : ''),
              typeLock: groupType, layout: group.layout === 'parallel' ? 'parallel' : 'line',
              orientation: text(group.parallelOrientation).toLowerCase() === 'vertical' ? 'vertical' : 'horizontal',
              lineIds: [], state: normalizeState(group.state, groupType || 'SPI'),
              legacy: { rgbwOutputScope: group.rgbwOutputScope || null, splitFromMixedGroup: typeIndex > 0 }
            };
            model.groups.push(groupEntity);
            zoneEntity.groupIds.push(groupId);
            groupEntityByKeyType[[locationIndex, zoneIndex, groupIndex, groupType || 'empty'].join(':')] = groupEntity;
            if (typeIndex > 0) model.migration.warnings.push('Mixed group ' + text(group.id, groupIndex) + ' split by receiver type.');
          });
        });
      });
      var locationScenes = clone(array(location.scenes));
      locationScenes.forEach(function (scene, sceneIndex) {
        var sceneId = text(scene.id, stableId('line', locationId + '|scene|' + sceneIndex + '|' + text(scene.name)));
        if (!scene.id) scene.id = sceneId;
        scene.locationId = locationId;
        locationEntity.sceneIds.push(sceneId);
        model.scenes.push(scene);
      });
    });

    function rawGroupEntity(entry, type) {
      return groupEntityByKeyType[[entry.locationIndex, entry.zoneIndex, entry.groupIndex, type || 'empty'].join(':')];
    }

    var handledLinked = new Set();
    rawAssignments.forEach(function (entry) {
      var sourceLine = entry.line;
      var receiverId = resolveReceiverId(sourceLine, entry);
      var receiver = byId(model.receivers, receiverId);
      if (!receiver) return;
      var type = receiver.type;
      var groupEntity = rawGroupEntity(entry, type);
      var portNumber = Math.max(1, Math.min(type === 'RGBW' ? 2 : receiver.portIds.length, Number(sourceLine.port) || 1));
      var portId = receiver.portIds[portNumber - 1];
      if (type === 'RGBW' && receiver.rgbwMode === 'linked') {
        var linkKey = receiverId + '|' + groupEntity.id;
        if (handledLinked.has(linkKey)) return;
        handledLinked.add(linkKey);
        var related = rawAssignments.filter(function (other) {
          return resolveReceiverId(other.line, other) === receiverId && rawGroupEntity(other, 'RGBW') === groupEntity;
        });
        var linkedId = uniqueId('line', null, receiverId + '|linked|1+2', used.line);
        var linkedState = sourceGroupState(entry.group, sourceLine);
        model.logicalLines.push({ id: linkedId, legacyId: sourceLine.id || null,
          legacyLineIds: related.map(function (item) { return item.line.id; }).filter(Boolean),
          receiverId: receiverId, portIds: receiver.portIds.slice(0, 2), type: 'RGBW', role: 'linked',
          name: text(sourceLine.name, receiver.name + ' · Linked'), active: true, groupId: groupEntity.id,
          rememberedGroupId: groupEntity.id, order: groupEntity.lineIds.length,
          state: normalizeState(linkedState, 'RGBW') });
        groupEntity.lineIds.push(linkedId);
        [1, 2].forEach(function (number) {
          var raw = related.find(function (item) { return (Number(item.line.port) || 1) === number; });
          var dormantId = uniqueId('line', raw && raw.line.id, receiverId + '|port|' + number, used.line);
          model.logicalLines.push({ id: dormantId, legacyId: raw && raw.line.id || null,
            receiverId: receiverId, portIds: [receiver.portIds[number - 1]], type: 'RGBW', role: 'port',
            name: text(raw && raw.line.name, receiver.name + ' · Port ' + number), active: false, groupId: null,
            rememberedGroupId: groupEntity.id, order: number - 1,
            state: normalizeState(raw ? sourceGroupState(raw.group, raw.line) : linkedState, 'RGBW') });
        });
        return;
      }
      var lineId = uniqueId('line', sourceLine.id, receiverId + '|port|' + portNumber + '|' + entry.groupKey, used.line);
      var active = type !== 'RGBW' || (receiver.rgbwMode === 'separate') ||
        (receiver.rgbwMode === 'port1' && portNumber === 1) || (receiver.rgbwMode === 'port2' && portNumber === 2);
      var lineEntity = { id: lineId, legacyId: sourceLine.id || null,
        receiverId: receiverId, portIds: [portId], type: type, role: 'port',
        name: text(sourceLine.name, receiver.name + ' · Port ' + portNumber), active: active,
        groupId: active ? groupEntity.id : null, rememberedGroupId: groupEntity.id,
        order: groupEntity.lineIds.length, state: normalizeState(sourceGroupState(entry.group, sourceLine), type),
        geometry: { pixels: Number(sourceLine.pixels) || (type === 'RGBW' ? 1 : 25), reversed: Boolean(sourceLine.reversed) } };
      model.logicalLines.push(lineEntity);
      if (active) groupEntity.lineIds.push(lineId);
    });

    model.receivers.filter(function (receiver) { return receiver.type === 'RGBW'; }).forEach(function (receiver) {
      [1, 2].forEach(function (number) {
        var portId = receiver.portIds[number - 1];
        var exists = model.logicalLines.some(function (line) {
          return line.receiverId === receiver.id && line.role === 'port' && line.portIds[0] === portId;
        });
        if (exists) return;
        var fallback = model.logicalLines.find(function (line) { return line.receiverId === receiver.id; });
        var id = uniqueId('line', null, receiver.id + '|port|' + number, used.line);
        model.logicalLines.push({ id: id, legacyId: null, receiverId: receiver.id, portIds: [portId],
          type: 'RGBW', role: 'port', name: receiver.name + ' · Port ' + number,
          active: false, groupId: null, rememberedGroupId: fallback && (fallback.groupId || fallback.rememberedGroupId) || null,
          order: number - 1, state: normalizeState(fallback && fallback.state, 'RGBW') });
      });
    });

    model.active = {
      locationId: model.locations.find(function (location) { return location.legacyId === legacy.activeInstallationId; })?.id || model.locations[0]?.id || null,
      zoneId: null, groupId: null
    };
    model.migration = {
      source: options.sourceKey || 'legacy-object', sourceVersion: legacy.schemaVersion || legacy.version || 'V20',
      migratedAt: options.migratedAt == null ? null : options.migratedAt,
      warnings: model.migration.warnings
    };
    model.revision = 1;
    validateModel(model);
    return model;
  }

  function validateModel(value) {
    var model = object(value);
    var errors = [];
    if (model.schema !== SCHEMA) errors.push('schema');
    if (Number(model.schemaVersion) !== SCHEMA_VERSION) errors.push('schemaVersion');
    var collections = ['locations', 'zones', 'groups', 'receivers', 'ports', 'logicalLines'];
    collections.forEach(function (key) {
      var ids = new Set();
      array(model[key]).forEach(function (item) {
        if (!text(item.id)) errors.push(key + ':missing-id');
        else if (ids.has(item.id)) errors.push(key + ':duplicate-id:' + item.id);
        ids.add(item.id);
      });
    });
    if (!text(model.installation && model.installation.id)) errors.push('installation:missing-id');
    array(model.installation && model.installation.locationIds).forEach(function (locationId) {
      if (!byId(model.locations, locationId)) errors.push('installation:location:' + locationId);
    });
    array(model.locations).forEach(function (location) {
      array(location.zoneIds).forEach(function (zoneId) {
        var zone = byId(model.zones, zoneId);
        if (!zone || zone.locationId !== location.id) errors.push('location:zone:' + location.id + ':' + zoneId);
      });
    });
    array(model.zones).forEach(function (zone) {
      var location = byId(model.locations, zone.locationId);
      if (!location || location.zoneIds.indexOf(zone.id) < 0) errors.push('zone:location:' + zone.id);
      array(zone.groupIds).forEach(function (groupId) {
        var group = byId(model.groups, groupId);
        if (!group || group.zoneId !== zone.id) errors.push('zone:group:' + zone.id + ':' + groupId);
      });
    });
    array(model.groups).forEach(function (group) {
      var zone = byId(model.zones, group.zoneId);
      if (!zone || zone.groupIds.indexOf(group.id) < 0) errors.push('group:zone:' + group.id);
    });
    var endpointKeys = new Set();
    array(model.ports).forEach(function (port) {
      if (!byId(model.receivers, port.receiverId)) errors.push('port:receiver:' + port.id);
      var endpointKey = port.receiverId + ':' + port.number;
      if (endpointKeys.has(endpointKey)) errors.push('port:duplicate-endpoint:' + endpointKey);
      endpointKeys.add(endpointKey);
    });
    array(model.groups).forEach(function (group) {
      if (group.typeLock != null && TYPES.indexOf(group.typeLock) < 0) errors.push('group:type:' + group.id);
      var seen = new Set();
      array(group.lineIds).forEach(function (lineId) {
        var line = byId(model.logicalLines, lineId);
        if (!line) errors.push('group:line:' + group.id + ':' + lineId);
        else {
          if (!line.active || line.groupId !== group.id) errors.push('group:inactive-line:' + lineId);
          if (group.typeLock && lineType(model, line) !== group.typeLock) errors.push('group:mixed:' + group.id);
        }
        if (seen.has(lineId)) errors.push('group:duplicate-line:' + lineId);
        seen.add(lineId);
      });
    });
    array(model.logicalLines).forEach(function (line) {
      var receiver = byId(model.receivers, line.receiverId);
      if (!receiver) errors.push('line:receiver:' + line.id);
      else if (line.type !== receiver.type) errors.push('line:type:' + line.id);
      array(line.portIds).forEach(function (portId) {
        var port = byId(model.ports, portId);
        if (!port || port.receiverId !== line.receiverId) errors.push('line:port:' + line.id + ':' + portId);
        else if (line.active && !port.active) errors.push('line:inactive-port:' + line.id + ':' + portId);
      });
      if (line.active && !groupForLine(model, line.id)) errors.push('line:unassigned:' + line.id);
      if (line.role === 'linked' && line.portIds.length !== 2) errors.push('line:linked-ports:' + line.id);
    });
    if (errors.length) {
      var error = new Error('Invalid V21 model: ' + errors.join(', '));
      error.code = 'V21_MODEL_INVALID';
      error.details = errors;
      throw error;
    }
    return true;
  }

  function endpointInventory(modelValue, receiverId) {
    var model = object(modelValue);
    validateModel(model);
    return model.ports.filter(function (port) { return !receiverId || port.receiverId === receiverId; })
      .sort(function (a, b) {
        var receiverOrder = model.receivers.findIndex(function (item) { return item.id === a.receiverId; }) -
          model.receivers.findIndex(function (item) { return item.id === b.receiverId; });
        return receiverOrder || a.number - b.number;
      }).map(function (port) {
        var receiver = byId(model.receivers, port.receiverId);
        var lines = model.logicalLines.filter(function (line) {
          return line.active && line.portIds.indexOf(port.id) >= 0;
        });
        return {
          endpointKey: port.endpointKey, receiverId: port.receiverId, receiverName: receiver.name,
          receiverType: receiver.type, portId: port.id, portNumber: port.number,
          endpointAddress: port.endpointAddress, active: Boolean(port.active),
          status: lines.length ? 'assigned' : (port.active ? 'available' : 'inactive'),
          logicalLineIds: lines.map(function (line) { return line.id; }),
          groupIds: lines.map(function (line) { return line.groupId; })
        };
      });
  }

  function assertGroupAccepts(model, group, type) {
    if (!group) throw new Error('Unknown group');
    if (group.typeLock && group.typeLock !== type) {
      var error = new Error('Group ' + group.id + ' is locked to ' + group.typeLock + ', not ' + type);
      error.code = 'V21_GROUP_TYPE_LOCK';
      throw error;
    }
  }

  function assignLogicalLine(modelValue, lineId, groupId, index) {
    var next = clone(modelValue);
    validateModel(next);
    var line = byId(next.logicalLines, lineId);
    var group = byId(next.groups, groupId);
    if (!line) throw new Error('Unknown logical line: ' + lineId);
    var type = lineType(next, line);
    assertGroupAccepts(next, group, type);
    next.groups.forEach(function (candidate) {
      candidate.lineIds = candidate.lineIds.filter(function (id) { return id !== lineId; });
    });
    group.typeLock = group.typeLock || type;
    var position = Number.isFinite(Number(index)) ? Math.max(0, Math.min(group.lineIds.length, Number(index))) : group.lineIds.length;
    group.lineIds.splice(position, 0, lineId);
    line.active = true;
    line.groupId = group.id;
    line.rememberedGroupId = group.id;
    line.order = position;
    next.revision = Number(next.revision || 0) + 1;
    validateModel(next);
    return next;
  }

  function rgbwPortLine(model, receiver, number) {
    var portId = receiver.portIds[number - 1];
    return model.logicalLines.find(function (line) {
      return line.receiverId === receiver.id && line.role === 'port' && line.portIds.length === 1 && line.portIds[0] === portId;
    });
  }

  function rgbwLinkedLine(model, receiver) {
    return model.logicalLines.find(function (line) { return line.receiverId === receiver.id && line.role === 'linked'; });
  }

  function compatibleFallbackGroup(model, receiver, lines) {
    var candidates = [];
    lines.forEach(function (line) {
      if (line && line.groupId) candidates.push(line.groupId);
      if (line && line.rememberedGroupId) candidates.push(line.rememberedGroupId);
    });
    var activeReceiverLine = model.logicalLines.find(function (line) { return line.receiverId === receiver.id && line.active; });
    if (activeReceiverLine) candidates.unshift(activeReceiverLine.groupId);
    var result = candidates.map(function (id) { return byId(model.groups, id); }).find(function (group) {
      return group && (!group.typeLock || group.typeLock === 'RGBW');
    });
    return result || model.groups.find(function (group) { return !group.typeLock || group.typeLock === 'RGBW'; }) || null;
  }

  function setRgbwMode(modelValue, receiverId, mode, options) {
    if (RGBW_MODES.indexOf(mode) < 0) throw new Error('Unsupported RGBW mode: ' + mode);
    var next = clone(modelValue);
    validateModel(next);
    var receiver = byId(next.receivers, receiverId);
    if (!receiver || receiver.type !== 'RGBW') throw new Error('Unknown RGBW receiver: ' + receiverId);
    options = object(options);
    var port1 = rgbwPortLine(next, receiver, 1);
    var port2 = rgbwPortLine(next, receiver, 2);
    if (!port1 || !port2) throw new Error('RGBW receiver has no complete port inventory');
    var linked = rgbwLinkedLine(next, receiver);
    if (!linked) {
      linked = { id: stableId('line', receiver.id + '|linked|1+2'), legacyId: null,
        receiverId: receiver.id, portIds: receiver.portIds.slice(0, 2), type: 'RGBW', role: 'linked',
        name: receiver.name + ' · Linked', active: false, groupId: null,
        rememberedGroupId: port1.groupId || port1.rememberedGroupId || null, order: 0,
        state: normalizeState(port1.state, 'RGBW') };
      if (byId(next.logicalLines, linked.id)) linked.id += '_' + hash(String(next.revision));
      next.logicalLines.push(linked);
    }
    var affected = next.logicalLines.filter(function (line) { return line.receiverId === receiver.id; });
    next.groups.forEach(function (group) {
      group.lineIds = group.lineIds.filter(function (lineId) {
        return !affected.some(function (line) { return line.id === lineId; });
      });
    });
    affected.forEach(function (line) {
      if (line.groupId) line.rememberedGroupId = line.groupId;
      line.active = false;
      line.groupId = null;
    });

    function destination(requested, line) {
      var group = byId(next.groups, requested) || compatibleFallbackGroup(next, receiver, [line, port1, port2, linked]);
      assertGroupAccepts(next, group, 'RGBW');
      group.typeLock = group.typeLock || 'RGBW';
      return group;
    }

    function activate(line, group) {
      line.active = true;
      line.groupId = group.id;
      line.rememberedGroupId = group.id;
      line.order = group.lineIds.length;
      group.lineIds.push(line.id);
    }

    if (mode === 'linked') {
      if (options.state) linked.state = normalizeState(options.state, 'RGBW');
      else if (!linked.state) linked.state = normalizeState(port1.state, 'RGBW');
      activate(linked, destination(options.groupId, linked));
    } else if (mode === 'separate') {
      var destinations = object(options.groupIdsByPort);
      activate(port1, destination(destinations[1] || destinations.port1 || options.groupId, port1));
      activate(port2, destination(destinations[2] || destinations.port2 || options.groupId, port2));
    } else {
      var selected = mode === 'port2' ? port2 : port1;
      activate(selected, destination(options.groupId, selected));
    }
    receiver.rgbwMode = mode;
    next.ports.filter(function (port) { return port.receiverId === receiver.id; }).forEach(function (port) {
      port.active = mode === 'port1' ? port.number === 1 : mode === 'port2' ? port.number === 2 : true;
    });
    next.revision = Number(next.revision || 0) + 1;
    validateModel(next);
    return next;
  }

  function beginSecondPortActivation(modelValue, receiverId, choice, options) {
    var model = clone(modelValue);
    validateModel(model);
    var receiver = byId(model.receivers, receiverId);
    if (!receiver || receiver.type !== 'RGBW') throw new Error('Unknown RGBW receiver: ' + receiverId);
    if (choice !== 'linked' && choice !== 'separate') throw new Error('Second port choice must be linked or separate');
    if (receiver.rgbwMode !== 'port1' && receiver.rgbwMode !== 'port2') {
      var modeError = new Error('Second port is already active');
      modeError.code = 'V21_SECOND_PORT_ALREADY_ACTIVE';
      throw modeError;
    }
    var candidate = setRgbwMode(model, receiverId, choice, options);
    return {
      id: stableId('transaction', receiverId + '|' + model.revision + '|' + choice),
      kind: 'activate-second-rgbw-port', receiverId: receiverId,
      expectedRevision: Number(model.revision || 0), expectedPortMask: 3, choice: choice,
      beforeFingerprint: hash(JSON.stringify(model)), candidate: candidate
    };
  }

  function commitSecondPortActivation(modelValue, transaction, confirmation) {
    var current = clone(modelValue);
    validateModel(current);
    if (!transaction || transaction.kind !== 'activate-second-rgbw-port') throw new Error('Invalid transaction');
    if (Number(current.revision || 0) !== transaction.expectedRevision || hash(JSON.stringify(current)) !== transaction.beforeFingerprint) {
      var staleError = new Error('Model changed while second port activation was pending');
      staleError.code = 'V21_TRANSACTION_STALE';
      throw staleError;
    }
    var confirmed = confirmation === true || Boolean(confirmation && confirmation.confirmed === true &&
      Number(confirmation.portMask == null ? 3 : confirmation.portMask) === 3);
    if (!confirmed) {
      var confirmError = new Error('Receiver did not confirm both RGBW ports');
      confirmError.code = 'V21_PORT_ACTIVATION_NOT_CONFIRMED';
      throw confirmError;
    }
    var committed = clone(transaction.candidate);
    committed.lastTransaction = { id: transaction.id, kind: transaction.kind, receiverId: transaction.receiverId,
      status: 'committed', confirmedPortMask: 3 };
    validateModel(committed);
    return committed;
  }

  function activateSecondPortTransactional(modelValue, receiverId, choice, options, confirm) {
    var transaction = beginSecondPortActivation(modelValue, receiverId, choice, options);
    if (typeof confirm !== 'function') throw new Error('A receiver confirmation callback is required');
    return Promise.resolve(confirm({ transactionId: transaction.id, receiverId: receiverId,
      mode: choice, expectedPortMask: 3 })).then(function (confirmation) {
      return commitSecondPortActivation(modelValue, transaction, confirmation);
    });
  }

  function selectLines(modelValue, selector) {
    var model = object(modelValue);
    validateModel(model);
    selector = object(selector);
    var scope = text(selector.scope, 'all').toLowerCase();
    var locationId = selector.locationId || model.active && model.active.locationId || model.locations[0] && model.locations[0].id;
    var allowedGroups = [];
    if (scope === 'all') {
      var location = byId(model.locations, locationId);
      if (!location) throw new Error('Unknown location: ' + locationId);
      var zoneIds = new Set(location.zoneIds);
      allowedGroups = model.groups.filter(function (group) {
        var zone = byId(model.zones, group.zoneId);
        return zone && zoneIds.has(zone.id);
      });
    } else if (scope === 'zone') {
      var zone = byId(model.zones, selector.zoneId);
      if (!zone) throw new Error('Unknown zone: ' + selector.zoneId);
      allowedGroups = zone.groupIds.map(function (id) { return byId(model.groups, id); }).filter(Boolean);
    } else if (scope === 'group') {
      var group = byId(model.groups, selector.groupId);
      if (!group) throw new Error('Unknown group: ' + selector.groupId);
      allowedGroups = [group];
    } else if (scope === 'line') {
      var requested = array(selector.lineIds).length ? selector.lineIds : [selector.lineId];
      var lines = requested.map(function (id) { return byId(model.logicalLines, id); }).filter(function (line) {
        return line && line.active;
      });
      return selectionResult(model, scope, lines);
    } else {
      throw new Error('Unsupported selector scope: ' + scope);
    }
    var lineIds = [];
    allowedGroups.forEach(function (group) {
      group.lineIds.forEach(function (id) { if (lineIds.indexOf(id) < 0) lineIds.push(id); });
    });
    return selectionResult(model, scope, lineIds.map(function (id) { return byId(model.logicalLines, id); }).filter(Boolean));
  }

  function selectionResult(model, scope, lines) {
    var result = { scope: scope, lineIds: lines.map(function (line) { return line.id; }), lines: clone(lines), byType: { SPI: [], RGBW: [] } };
    lines.forEach(function (line) { result.byType[lineType(model, line)].push(line.id); });
    return result;
  }

  function normalizeHex(value) {
    var hex = text(value).toUpperCase();
    if (/^#[0-9A-F]{3}$/.test(hex)) hex = '#' + hex.slice(1).split('').map(function (item) { return item + item; }).join('');
    if (!/^#[0-9A-F]{6}$/.test(hex)) throw new Error('Invalid colour: ' + value);
    return hex;
  }

  function staticColorState(previous, color, type) {
    var state = normalizeState(previous, type);
    state.animation = 'Static Color';
    state.engine = 'STATIC';
    state.variant = 0;
    state.colors = [color];
    state.whiteChannels = [0, 0, 0, 0];
    state.rgbEnabled = [true, false, false, false];
    state.whiteEnabled = [false, false, false, false];
    state.colorCount = 1;
    state.backgroundOn = false;
    return state;
  }

  function commandPlan(model, selection) {
    var batches = { SPI: [], RGBW: [] };
    selection.lineIds.forEach(function (lineId) {
      var line = byId(model.logicalLines, lineId);
      var receiver = byId(model.receivers, line.receiverId);
      var endpoints = line.portIds.map(function (portId) {
        var port = byId(model.ports, portId);
        return { endpointKey: port.endpointKey, receiverId: receiver.id, portId: port.id,
          portNumber: port.number, endpointAddress: port.endpointAddress };
      });
      batches[receiver.type].push({ logicalLineId: line.id, groupId: line.groupId,
        receiverId: receiver.id, receiverType: receiver.type, endpoints: endpoints, state: clone(line.state) });
    });
    return TYPES.filter(function (type) { return batches[type].length; }).map(function (type) {
      return { receiverType: type, commands: batches[type] };
    });
  }

  function applyQuickColor(modelValue, selector, value) {
    var next = clone(modelValue);
    validateModel(next);
    var color = normalizeHex(value);
    var selection = selectLines(next, selector);
    var touchedGroups = new Set();
    selection.lineIds.forEach(function (lineId) {
      var line = byId(next.logicalLines, lineId);
      line.state = staticColorState(line.state, color, lineType(next, line));
      touchedGroups.add(line.groupId);
    });
    touchedGroups.forEach(function (groupId) {
      var group = byId(next.groups, groupId);
      var allSelected = group.lineIds.every(function (lineId) { return selection.lineIds.indexOf(lineId) >= 0; });
      if (allSelected && group.lineIds.length) group.state = clone(byId(next.logicalLines, group.lineIds[0]).state);
    });
    next.revision = Number(next.revision || 0) + 1;
    validateModel(next);
    var updatedSelection = selectLines(next, { scope: 'line', lineIds: selection.lineIds });
    return { model: next, selection: updatedSelection, batches: commandPlan(next, updatedSelection) };
  }

  function storageGet(storage, key) {
    if (!storage) return null;
    if (typeof storage.getItem === 'function') return storage.getItem(key);
    return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
  }

  function storageSet(storage, key, value) {
    if (typeof storage.setItem === 'function') storage.setItem(key, value);
    else storage[key] = value;
  }

  function storageRemove(storage, key) {
    if (typeof storage.removeItem === 'function') storage.removeItem(key);
    else delete storage[key];
  }

  function prepareStorageMigration(storage, options) {
    options = object(options);
    var keys = [STORAGE_KEY].concat(LEGACY_KEYS);
    var parseErrors = [];
    var sourceKey = null;
    var raw = null;
    var parsed = null;
    keys.some(function (key) {
      var candidate = storageGet(storage, key);
      if (candidate == null || candidate === '') return false;
      try {
        parsed = typeof candidate === 'string' ? JSON.parse(candidate) : clone(candidate);
        sourceKey = key;
        raw = typeof candidate === 'string' ? candidate : JSON.stringify(candidate);
        return true;
      } catch (error) {
        parseErrors.push(key + ': ' + error.message);
        return false;
      }
    });
    if (!parsed) throw new Error('No readable Aluvision localStorage state; ' + parseErrors.join('; '));
    var model = migrationSource(parsed, { sourceKey: sourceKey, installationName: options.installationName,
      installationId: options.installationId, migratedAt: options.migratedAt });
    validateModel(model);
    return {
      sourceKey: sourceKey, sourceRaw: raw, sourceFingerprint: hash(raw),
      targetKey: STORAGE_KEY, targetPreviousRaw: storageGet(storage, STORAGE_KEY),
      model: model, encoded: JSON.stringify(model), parseErrors: parseErrors
    };
  }

  function commitStorageMigration(storage, prepared) {
    if (!prepared || !prepared.model || prepared.targetKey !== STORAGE_KEY) throw new Error('Invalid prepared migration');
    var currentRaw = storageGet(storage, prepared.sourceKey);
    currentRaw = typeof currentRaw === 'string' ? currentRaw : JSON.stringify(currentRaw);
    if (hash(currentRaw) !== prepared.sourceFingerprint) {
      var stale = new Error('Legacy storage changed during migration');
      stale.code = 'V21_STORAGE_CHANGED';
      throw stale;
    }
    var previous = storageGet(storage, STORAGE_KEY);
    try {
      storageSet(storage, STORAGE_KEY, prepared.encoded);
      var written = storageGet(storage, STORAGE_KEY);
      var decoded = JSON.parse(written);
      validateModel(decoded);
      return decoded;
    } catch (error) {
      try {
        if (previous == null) storageRemove(storage, STORAGE_KEY);
        else storageSet(storage, STORAGE_KEY, previous);
      } catch (_) { /* best-effort rollback */ }
      throw error;
    }
  }

  function exportModel(modelValue) {
    var exported = clone(modelValue);
    validateModel(exported);
    return exported;
  }

  function createStore(initialValue) {
    var current = initialValue && initialValue.schema === SCHEMA
      ? exportModel(initialValue) : migrationSource(initialValue || {});
    var listeners = [];

    function notify(reason) {
      var snapshot = exportModel(current);
      listeners.slice().forEach(function (listener) { listener(snapshot, reason); });
    }

    function replace(next, reason) {
      current = exportModel(next);
      notify(reason || 'replace');
      return exportModel(current);
    }

    return Object.freeze({
      getSnapshot: function () { return exportModel(current); },
      export: function () { return exportModel(current); },
      replace: replace,
      subscribe: function (listener) {
        if (typeof listener !== 'function') throw new Error('Listener must be a function');
        listeners.push(listener);
        return function () { listeners = listeners.filter(function (item) { return item !== listener; }); };
      },
      assignLogicalLine: function (lineId, groupId, index) {
        return replace(assignLogicalLine(current, lineId, groupId, index), 'assign-logical-line');
      },
      setRgbwMode: function (receiverId, mode, options) {
        return replace(setRgbwMode(current, receiverId, mode, options), 'set-rgbw-mode');
      },
      applyQuickColor: function (selector, color) {
        var result = applyQuickColor(current, selector, color);
        replace(result.model, 'quick-color');
        result.model = exportModel(current);
        return result;
      },
      beginSecondPortActivation: function (receiverId, choice, options) {
        return beginSecondPortActivation(current, receiverId, choice, options);
      },
      commitSecondPortActivation: function (transaction, confirmation) {
        return replace(commitSecondPortActivation(current, transaction, confirmation), 'activate-second-rgbw-port');
      }
    });
  }

  return Object.freeze({
    schema: SCHEMA, schemaVersion: SCHEMA_VERSION, storageKey: STORAGE_KEY, legacyKeys: LEGACY_KEYS,
    stableId: stableId, emptyModel: emptyModel, defaultState: defaultState,
    migrate: migrationSource, migrateLegacy: migrationSource, createStore: createStore, exportModel: exportModel,
    prepareStorageMigration: prepareStorageMigration,
    commitStorageMigration: commitStorageMigration, validateModel: validateModel,
    endpointInventory: endpointInventory, assignLogicalLine: assignLogicalLine,
    setRgbwMode: setRgbwMode, beginSecondPortActivation: beginSecondPortActivation,
    commitSecondPortActivation: commitSecondPortActivation,
    activateSecondPortTransactional: activateSecondPortTransactional,
    selectLines: selectLines, applyQuickColor: applyQuickColor, commandPlan: commandPlan
  });
}));
