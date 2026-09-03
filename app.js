(() => {
  'use strict';

  const UUIDS = Object.freeze({
    service: '8f0d1100-8b2b-4ca3-a9d5-8a39aaf11700',
    command: '8f0d1101-8b2b-4ca3-a9d5-8a39aaf11700',
    status: '8f0d1102-8b2b-4ca3-a9d5-8a39aaf11700',
    info: '8f0d1103-8b2b-4ca3-a9d5-8a39aaf11700'
  });

  const STORE_KEY = 'aluvision.full-direct.v3';
  const LEGACY_STORE_KEY = 'aluvision.direct-ble.v1';
  const MAX_WRITE_BYTES = 150;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function effectColourCount(name, engine, variant) {
    if ([98, 99, 102].includes(variant)) return 1;
    if (variant === 100) return 2;
    if (variant === 101) return 3;
    const lower = name.toLowerCase();
    if (['multi', 'aurora', 'sequence', 'timeline', 'cascade'].some((word) => lower.includes(word))) return 3;
    if (lower.includes('dual') || ['GRADIENT', 'FLOW', 'ALTERNATE'].includes(engine)) return 2;
    return 1;
  }

  function effectPreview(engine) {
    if (engine === 'BREATHE' || engine === 'WARM') return 'pulse';
    if (engine === 'GRADIENT' || engine === 'FLOW') return 'fade';
    return 'motion';
  }

  function catalogueEffect([name, engine, family, variant], options = {}) {
    return {
      name, engine, family, variant,
      colours: effectColourCount(name, engine, variant),
      preview: options.line ? 'whole' : effectPreview(engine),
      warm: engine === 'WARM',
      ...options
    };
  }

  // Variants are the receiver wire contract. Keep these indices aligned with
  // the current SPI firmware even when the catalogue is visually regrouped.
  const SPI_EFFECTS = Object.freeze([
    ['Soft Gradient', 'GRADIENT', 'Gradient', 2],
    ['Multi Gradient', 'GRADIENT', 'Gradient', 3],
    ['Gradient Drift', 'GRADIENT', 'Gradient', 4],
    ['Corporate Flow', 'FLOW', 'Corporate', 5],
    ['Slow Color Flow', 'FLOW', 'Flow', 6],
    ['Elegant Chase', 'CHASE', 'Chase', 7],
    ['Soft Chase', 'CHASE', 'Chase', 8],
    ['Thin Chase', 'CHASE', 'Chase', 9],
    ['Wide Chase', 'CHASE', 'Chase', 10],
    ['Dual Chase', 'DUAL', 'Chase', 11],
    ['Multi Chase', 'CHASE', 'Chase', 12],
    ['Comet', 'COMET', 'Dynamic', 13],
    ['Soft Comet', 'COMET', 'Dynamic', 14],
    ['Moving Highlight', 'CHASE', 'Professional', 15],
    ['Double Highlight', 'DUAL', 'Professional', 16],
    ['Premium Shimmer', 'SPARKLE', 'Ambient', 17],
    ['Subtle Sparkle', 'SPARKLE', 'Ambient', 18],
    ['Slow Shimmer', 'SPARKLE', 'Ambient', 19],
    ['Satin Glow', 'BREATHE', 'Ambient', 20],
    ['Silk Flow', 'FLOW', 'Flow', 21],
    ['Breathing', 'BREATHE', 'Pulse', 22],
    ['Soft Breathing', 'BREATHE', 'Pulse', 23],
    ['Dual Breathing', 'BREATHE', 'Pulse', 24],
    ['Pulse', 'BREATHE', 'Pulse', 25],
    ['Soft Pulse', 'BREATHE', 'Pulse', 26],
    ['Traveling Pulse', 'CHASE', 'Pulse', 27],
    ['Wave', 'WAVE', 'Flow', 28],
    ['Soft Wave', 'WAVE', 'Flow', 29],
    ['Sine Wave', 'WAVE', 'Flow', 30],
    ['Dual Wave', 'WAVE', 'Flow', 31],
    ['Light Sweep', 'SCANNER', 'Dynamic', 32],
    ['Slow Sweep', 'SCANNER', 'Dynamic', 33],
    ['Edge Sweep', 'SCANNER', 'Dynamic', 34],
    ['Center Sweep', 'MIRROR', 'Dynamic', 35],
    ['Center Out', 'MIRROR', 'Dynamic', 36],
    ['Outside In', 'MIRROR', 'Dynamic', 37],
    ['Edge-to-Edge Fade', 'GRADIENT', 'Gradient', 38],
    ['Cross Fade', 'BREATHE', 'Gradient', 39],
    ['Color Fade', 'BREATHE', 'Gradient', 40],
    ['Slow Color Transition', 'BREATHE', 'Gradient', 41],
    ['Aurora Flow', 'FLOW', 'Ambient', 42],
    ['Ambient Drift', 'FLOW', 'Ambient', 43],
    ['Gentle Motion', 'FLOW', 'Ambient', 44],
    ['Minimal Accent', 'MINIMAL', 'Minimal', 45],
    ['Moving Accent', 'MINIMAL', 'Minimal', 46],
    ['Corporate Accent', 'FLOW', 'Corporate', 47],
    ['White Accent Flow', 'FLOW', 'Corporate', 48],
    ['Warm White Flow', 'WARM', 'Corporate', 49],
    ['Architectural Flow', 'FLOW', 'Professional', 51],
    ['Tunnel Flow', 'FLOW', 'Professional', 52],
    ['Parallel Flow', 'FLOW', 'Professional', 53],
    ['Synchronized Sweep', 'SCANNER', 'Professional', 54],
    ['Alternating Lines', 'ALTERNATE', 'Professional', 55],
    ['Cascading Lines', 'CASCADE', 'Professional', 56],
    ['Mirror Flow', 'MIRROR', 'Professional', 57],
    ['Symmetric Chase', 'DUAL', 'Chase', 58],
    ['Asymmetric Chase', 'CHASE', 'Chase', 59],
    ['Liquid Gradient', 'GRADIENT', 'Gradient', 60],
    ['Soft Liquid', 'GRADIENT', 'Gradient', 61],
    ['Glow Trail', 'COMET', 'Dynamic', 62],
    ['Fade Trail', 'COMET', 'Dynamic', 63],
    ['Comet Trail', 'COMET', 'Dynamic', 64],
    ['Light Runner', 'CHASE', 'Dynamic', 65],
    ['Slow Runner', 'CHASE', 'Dynamic', 66],
    ['Spotlight Travel', 'CHASE', 'Professional', 67],
    ['Soft Spotlight', 'CHASE', 'Professional', 68],
    ['Gradient Pulse', 'BREATHE', 'Gradient', 69],
    ['Gradient Wave', 'WAVE', 'Gradient', 70],
    ['Gradient Chase', 'CHASE', 'Gradient', 71],
    ['Gradient Sweep', 'SCANNER', 'Gradient', 72],
    ['Brand Color Flow', 'FLOW', 'Corporate', 73],
    ['Brand Color Pulse', 'BREATHE', 'Corporate', 74],
    ['Brand Color Chase', 'CHASE', 'Corporate', 75],
    ['Exhibition Mode', 'FLOW', 'Professional', 76],
    ['Welcome Flow', 'FLOW', 'Professional', 77],
    ['Presentation Mode', 'BREATHE', 'Professional', 78],
    ['Evening Ambient', 'BREATHE', 'Ambient', 79],
    ['Product Highlight', 'CHASE', 'Professional', 80],
    ['Luxury Shimmer', 'SPARKLE', 'Ambient', 81],
    ['Calm Motion', 'FLOW', 'Ambient', 82],
    ['Dynamic White', 'BREATHE', 'Minimal', 84],
    ['White Temperature Flow', 'WARM', 'Corporate', 85],
    ['Soft Strobe', 'SPARKLE', 'Dynamic', 86],
    ['Accent Flash', 'SPARKLE', 'Dynamic', 87],
    ['Sequence Fade', 'SEQUENCE', 'Dynamic', 88],
    ['Custom Timeline', 'SEQUENCE', 'Custom', 89]
  ].map((effect) => catalogueEffect(effect)));

  const SPI_TUNNEL_EFFECTS = Object.freeze([
    [['Line Fade Down', 'CASCADE', 'Multi-line', 90], { spread: 70, spacing: 68, speed: 12, smooth: 96 }],
    [['Line Fade Up', 'CASCADE', 'Multi-line', 91], { spread: 70, spacing: 68, speed: 12, smooth: 96 }],
    [['LED Line Sequence Fade', 'SEQUENCE', 'Multi-line', 92], { spread: 72, speed: 11, smooth: 98, direction: 'right' }],
    [['Panel Wave', 'WAVE', 'Multi-line', 93], { spread: 64, objectCount: 1, speed: 14, smooth: 96 }],
    [['Panel Chase', 'CHASE', 'Multi-line', 94], { spread: 68, objectCount: 1, widthPixels: 3, speed: 16, smooth: 94 }],
    [['Center Rows Out', 'MIRROR', 'Multi-line', 95], { spread: 72, speed: 11, smooth: 98, direction: 'right' }],
    [['Alternating Directions', 'DUAL', 'Multi-line', 96], { spread: 58, objectCount: 1, widthPixels: 3, speed: 15, smooth: 95 }],
    [['Synchronized Rows', 'FLOW', 'Multi-line', 97], { spread: 0, objectCount: 1, widthPixels: 3, speed: 14, smooth: 96 }],
    [['Tunnel Inwaarts', 'MIRROR', 'Multi-line', 95], { spread: 82, speed: 12, smooth: 98, direction: 'left' }],
    [['Tunnel Uitwaarts', 'MIRROR', 'Multi-line', 95], { spread: 82, speed: 12, smooth: 98, direction: 'right' }],
    [['Dieptegolf', 'WAVE', 'Multi-line', 93], { spread: 78, objectCount: 1, speed: 13, smooth: 98 }],
    [['Ring-per-ring Fade', 'SEQUENCE', 'Multi-line', 92], { spread: 84, speed: 11, smooth: 99, direction: 'right' }],
    [['Dubbele Tunnelgolf', 'WAVE', 'Multi-line', 93], { spread: 58, objectCount: 2, speed: 17, smooth: 96 }],
    [['Kleurdoorgifte', 'WAVE', 'Multi-line', 93], { spread: 66, objectCount: 1, speed: 10, smooth: 99 }],
    [['Afwisselende Ringen', 'DUAL', 'Multi-line', 96], { spread: 38, objectCount: 1, widthPixels: 4, speed: 15, smooth: 96 }],
    [['Tunnelademhaling', 'SEQUENCE', 'Multi-line', 92], { spread: 16, speed: 5, smooth: 100, direction: 'right' }],
    [['Scanner door Diepte', 'CHASE', 'Multi-line', 94], { spread: 92, objectCount: 1, widthPixels: 2, speed: 19, smooth: 94 }],
    [['Comet door Tunnel', 'CHASE', 'Multi-line', 94], { spread: 82, spacing: 82, objectCount: 1, widthPixels: 3, speed: 17, smooth: 97 }],
    [['Regenboogdiepte', 'WAVE', 'Multi-line', 93], { spread: 92, objectCount: 1, speed: 14, smooth: 97 }],
    [['Center Burst', 'MIRROR', 'Multi-line', 95], { spread: 92, speed: 18, smooth: 96, direction: 'right' }],
    [['Echo Pulse', 'CASCADE', 'Multi-line', 90], { spread: 66, spacing: 88, speed: 13, smooth: 98 }],
    [['Soft Cascade', 'SEQUENCE', 'Multi-line', 92], { spread: 44, speed: 7, smooth: 100, direction: 'right' }],
    [['Snelle Strobe Chase', 'CHASE', 'Multi-line', 94], { spread: 88, spacing: 74, objectCount: 3, widthPixels: 1, speed: 32, smooth: 82 }],
    [['Gradient Depth', 'WAVE', 'Multi-line', 93], { spread: 42, objectCount: 1, speed: 8, smooth: 100 }],
    [['Whole Line Pulse', 'BREATHE', 'Whole-line', 98], { speed: 10, smooth: 96, spacing: 34, lineDelayMs: 240 }],
    [['Whole Line Soft Fade', 'BREATHE', 'Whole-line', 99], { speed: 8, smooth: 99, spacing: 24, lineDelayMs: 320 }],
    [['Whole Line Color Fade', 'GRADIENT', 'Whole-line', 100], { speed: 11, smooth: 98, spread: 64, lineDelayMs: 320 }],
    [['Whole Line Smooth Transitions', 'FLOW', 'Whole-line', 101], { speed: 10, smooth: 100, spread: 72, lineDelayMs: 360 }],
    [['Whole Line Flash / Strobe', 'SPARKLE', 'Whole-line', 102], { speed: 18, smooth: 24, spacing: 76, lineDelayMs: 160 }]
  ].map(([effect, defaults]) => catalogueEffect(effect, { line: true, defaults })));

  const RGBW_EFFECTS = Object.freeze([
    { name: 'Pulse', engine: 'BREATHE', variant: 0, family: 'RGBW', colours: 1, preview: 'pulse' },
    { name: 'Soft Fade', engine: 'BREATHE', variant: 1, family: 'RGBW', colours: 1, preview: 'pulse' },
    { name: 'Color Fade', engine: 'GRADIENT', variant: 2, family: 'RGBW', colours: 3, preview: 'fade' },
    { name: 'Smooth Transition', engine: 'FLOW', variant: 3, family: 'RGBW', colours: 4, preview: 'fade' },
    { name: 'Flash / Strobe', engine: 'SPARKLE', variant: 4, family: 'RGBW', colours: 2, preview: 'pulse' },
    { name: 'Line Pulse', engine: 'SEQUENCE', variant: 5, family: 'Tunnel', colours: 1, preview: 'whole', line: true, defaults: { lineDelayMs: 240 } },
    { name: 'Line Fade', engine: 'CASCADE', variant: 6, family: 'Tunnel', colours: 2, preview: 'whole', line: true, defaults: { lineDelayMs: 320 } },
    { name: 'Line Wave', engine: 'WAVE', variant: 7, family: 'Tunnel', colours: 2, preview: 'whole', line: true, defaults: { lineDelayMs: 240 } },
    { name: 'Line Chase', engine: 'CHASE', variant: 8, family: 'Tunnel', colours: 2, preview: 'whole', line: true, defaults: { lineDelayMs: 200 } },
    { name: 'Line Color Fade', engine: 'GRADIENT', variant: 9, family: 'Tunnel', colours: 2, preview: 'whole', line: true, defaults: { lineDelayMs: 320 } },
    { name: 'Line Smooth Transition', engine: 'FLOW', variant: 10, family: 'Tunnel', colours: 3, preview: 'whole', line: true, defaults: { lineDelayMs: 360 } },
    { name: 'Line Strobe', engine: 'SPARKLE', variant: 11, family: 'Tunnel', colours: 2, preview: 'whole', line: true, defaults: { lineDelayMs: 120 } },
    { name: 'Tunnel Ripple', engine: 'WAVE', variant: 12, family: 'Tunnel', colours: 3, preview: 'whole', line: true, defaults: { lineDelayMs: 200 } },
    { name: 'Center Out', engine: 'MIRROR', variant: 13, family: 'Tunnel', colours: 2, preview: 'whole', line: true, defaults: { lineDelayMs: 280 } },
    { name: 'Outside In', engine: 'MIRROR', variant: 14, family: 'Tunnel', colours: 2, preview: 'whole', line: true, defaults: { lineDelayMs: 280 } },
    { name: 'Alternating Lines', engine: 'ALTERNATE', variant: 15, family: 'Tunnel', colours: 2, preview: 'whole', line: true, defaults: { lineDelayMs: 240 } },
    { name: 'Double Line Wave', engine: 'WAVE', variant: 16, family: 'Tunnel', colours: 3, preview: 'whole', line: true, defaults: { lineDelayMs: 160 } }
  ]);

  const $ = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const uid = (prefix) => `${prefix}${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)}`;
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

  function randomHex64() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    if (bytes.every((byte) => byte === 0)) bytes[7] = 1;
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function defaultLightState(type = 'SPI') {
    return {
      mode: 'static', animation: 'Static Color', engine: 'STATIC', variant: 0,
      colours: ['#FF5B4D', '#FFD166', '#39D5A5', '#668CFF'], colourCount: 1, activeSlot: 0,
      rgbEnabled: true, whiteEnabled: false, white: 0, background: '#000000', backgroundOn: false,
      brightness: 100, speed: 18, smooth: 96, widthPixels: 3, direction: 'right',
      spacing: 50, objectCount: 1, trail: 45, spread: 50, lineDelayMs: 240,
      power: true, restartToken: 1, receiverType: type
    };
  }

  function freshDb() {
    const locationId = uid('loc-');
    const zoneId = uid('zone-');
    const groupId = uid('group-');
    return {
      version: 3,
      installationKey: randomHex64(),
      nextNumber: 1,
      theme: 'light',
      activeLocationId: locationId,
      locations: [{
        id: locationId,
        name: 'Hoofdlocatie',
        zones: [{ id: zoneId, name: 'Hoofdzone', groups: [{ id: groupId, name: 'Hoofdlijn', type: 'SPI', layout: 'continuous', orientation: 'horizontal', receiverIds: [], state: defaultLightState('SPI') }] }]
      }],
      receivers: {},
      scenes: [],
      presets: []
    };
  }

  function loadDb() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (stored && stored.version === 3) return normalizeDb(stored);
      const legacy = JSON.parse(localStorage.getItem(LEGACY_STORE_KEY) || 'null');
      if (legacy && legacy.version === 1) {
        const next = freshDb();
        next.installationKey = /^[0-9A-F]{16}$/.test(legacy.installationKey || '') ? legacy.installationKey : randomHex64();
        next.nextNumber = clamp(legacy.nextNumber || 1, 1, 250);
        Object.entries(legacy.receivers || {}).forEach(([rid, receiver]) => {
          next.receivers[rid] = {
            id: rid, rid, number: Number(receiver.number) || next.nextNumber++,
            name: `Receiver ${Number(receiver.number) || next.nextNumber}`,
            type: receiver.type === 'RGBW' ? 'RGBW' : 'SPI', pixels: 60, physicalReverse: false,
            portMask: Number(receiver.portMask) || 3, port1Rid: receiver.port1Rid || '', port2Rid: receiver.port2Rid || '', lastSeen: receiver.lastSeen || ''
          };
        });
        return normalizeDb(next);
      }
    } catch (_) {}
    return freshDb();
  }

  function normalizeDb(candidate) {
    const base = freshDb();
    const next = { ...base, ...candidate };
    if (!/^[0-9A-F]{16}$/.test(next.installationKey || '')) next.installationKey = randomHex64();
    if (!Array.isArray(next.locations) || !next.locations.length) next.locations = base.locations;
    if (!next.receivers || typeof next.receivers !== 'object') next.receivers = {};
    if (!Array.isArray(next.scenes)) next.scenes = [];
    if (!Array.isArray(next.presets)) next.presets = [];
    next.locations.forEach((location) => {
      location.zones = Array.isArray(location.zones) ? location.zones : [];
      location.zones.forEach((zone) => {
        zone.groups = Array.isArray(zone.groups) ? zone.groups : [];
        zone.groups.forEach((group) => {
          group.type = group.type === 'RGBW' ? 'RGBW' : 'SPI';
          group.receiverIds = Array.isArray(group.receiverIds) ? group.receiverIds.filter((id) => next.receivers[id]) : [];
          group.layout = group.layout === 'parallel' ? 'parallel' : 'continuous';
          group.orientation = group.orientation === 'vertical' ? 'vertical' : 'horizontal';
          group.state = { ...defaultLightState(group.type), ...(group.state || {}), receiverType: group.type };
        });
      });
    });
    if (!next.locations.some((item) => item.id === next.activeLocationId)) next.activeLocationId = next.locations[0].id;
    return next;
  }

  let db = loadDb();
  let route = { page: 'home', zoneId: '', groupId: '' };
  let effectFilter = 'Alles';
  let toastTimer = 0;
  let previewFrame = 0;
  let previewLast = 0;
  let liveTimer = 0;
  let liveDirtyGroups = new Set();
  let liveSending = false;
  let sequence = Math.floor(Date.now() % 900000000) || 1;
  let notificationBuffer = '';
  let transactionTail = Promise.resolve();
  const ackWaiters = new Map();

  const ble = {
    device: null, server: null, command: null, status: null, info: null,
    rid: '', key: '', type: 'SPI', number: 1, physical: 60, physicalReverse: false,
    portMask: 3, endpointRids: { 1: '', 2: '' }, connected: false, statusFields: {}
  };

  function saveDb() { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
  function activeLocation() { return db.locations.find((item) => item.id === db.activeLocationId) || db.locations[0]; }
  function activeZone() { return activeLocation()?.zones.find((item) => item.id === route.zoneId) || null; }
  function activeGroup() { return activeZone()?.groups.find((item) => item.id === route.groupId) || null; }
  function allGroups() { return activeLocation()?.zones.flatMap((zone) => zone.groups.map((group) => ({ zone, group }))) || []; }
  function receiverFor(id) { return db.receivers[id] || null; }
  function connectedReceiver() { return ble.connected ? receiverFor(ble.rid) : null; }
  function assignedGroup(receiverId) { return allGroups().find(({ group }) => group.receiverIds.includes(receiverId)) || null; }
  function totalPixels(group) { return Math.max(1, group.receiverIds.reduce((sum, id) => sum + (receiverFor(id)?.pixels || 0), 0) || 25); }
  function lineTargets(group) {
    const result = [];
    group.receiverIds.forEach((id) => {
      const receiver = receiverFor(id);
      if (!receiver) return;
      if (receiver.type === 'RGBW') {
        [1, 2].forEach((port) => {
          if (!(receiver.portMask & (1 << (port - 1)))) return;
          const rid = String(port === 1 ? receiver.port1Rid : receiver.port2Rid).toUpperCase();
          if (/^[0-9A-F]{16}$/.test(rid)) result.push({ receiver, rid, port, pixels: 1 });
        });
      } else {
        result.push({ receiver, rid: receiver.rid, port: 0, pixels: Math.max(1, Number(receiver.pixels) || 1) });
      }
    });
    return result;
  }
  function actualLineCount(group) { return lineTargets(group).length || group.receiverIds.length; }
  // Animation math always needs at least one virtual row; counters must not.
  function lineCount(group) { return Math.max(1, actualLineCount(group)); }
  function groupColour(group) {
    const state = group.state;
    if (!state.power) return '#343633';
    if (!state.rgbEnabled && state.whiteEnabled) return '#F3D7B1';
    return state.colours[0] || '#FF5B4D';
  }

  function showToast(message, error = false) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.toggle('error', error);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }
  function setBusy(active, text = 'Even geduld…') { $('busyText').textContent = text; $('busyOverlay').hidden = !active; }
  function openModal(markup) { $('modalBody').innerHTML = markup; $('modalLayer').hidden = false; document.body.style.overflow = 'hidden'; }
  function closeModal() { $('modalLayer').hidden = true; $('modalBody').innerHTML = ''; document.body.style.overflow = ''; }
  function modalHead(title, eyebrow = '') { return `<div class="modal-head"><span>${eyebrow ? `<small class="eyebrow">${esc(eyebrow)}</small>` : ''}<h2>${esc(title)}</h2></span><button class="close-button" type="button" data-action="close-modal" aria-label="Sluiten">×</button></div>`; }

  function navigate(page, zoneId = '', groupId = '') {
    route = { page, zoneId, groupId };
    closeModal();
    renderApp();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderApp() {
    document.body.classList.toggle('dark', db.theme === 'dark');
    $('locationName').textContent = activeLocation()?.name || 'Locatie';
    const badge = $('connectionBadge');
    badge.classList.toggle('connected', ble.connected);
    badge.querySelector('span').textContent = ble.connected ? `Receiver ${ble.number} live` : 'Geen receiver live';
    document.querySelectorAll('#bottomNav [data-page]').forEach((button) => button.classList.toggle('active', button.dataset.page === route.page || (route.page === 'zone' || route.page === 'group') && button.dataset.page === 'zones'));
    const renderers = { home: renderHome, zones: renderZones, zone: renderZone, group: renderGroup, scenes: renderScenes, presets: renderPresets, receivers: renderReceivers, more: renderMore };
    $('appMain').innerHTML = (renderers[route.page] || renderHome)();
    bindColourWheel();
    requestAnimationFrame(() => paintPreviews(performance.now()));
  }

  function railCells(count = 22) { return Array.from({ length: count }, (_, index) => `<i style="--i:${index}"></i>`).join(''); }
  function renderHome() {
    const groups = allGroups();
    const receiverCount = Object.keys(db.receivers).length;
    const allOn = groups.some(({ group }) => group.state.power);
    const colour = groups[0] ? groupColour(groups[0].group) : '#EF7C73';
    const scenes = db.scenes.slice(0, 3);
    return `<section class="page" data-view="home">
      <div class="page-head"><div><span class="eyebrow">${esc(activeLocation()?.name || '')}</span><h1>Alle verlichting</h1><p class="sub">Eén helder overzicht voor je volledige locatie.</p></div></div>
      <article class="master-card">
        <div><span class="eyebrow">VOLLEDIGE LOCATIE</span><h1>${allOn ? 'Verlichting is aan' : 'Verlichting is uit'}</h1><p class="sub">${groups.length} ${groups.length === 1 ? 'groep' : 'groepen'} · ${receiverCount} ${receiverCount === 1 ? 'receiver' : 'receivers'}</p><div class="master-actions"><button class="button light" type="button" data-action="all-colour">● Kleur kiezen</button><button class="button ${allOn ? 'soft' : 'primary'}" type="button" data-action="all-power">${allOn ? '○ Alles uit' : '● Alles aan'}</button></div></div>
        <div class="master-visual" style="--rail-colour:${esc(colour)}"><div class="rail live">${railCells(24)}</div><div class="rail live">${railCells(24)}</div><div class="visual-caption"><span>LIVE OVERZICHT</span><span>${ble.connected ? 'Verbonden' : 'Lokaal bewaard'}</span></div></div>
      </article>
      <div class="grid quick-grid">
        <button class="quick-card receiver" type="button" data-action="pair"><i>＋</i><span><b>Receiver toevoegen</b><small>NFC of Bluetooth</small></span></button>
        <button class="quick-card" type="button" data-page="zones"><i>▦</i><span><b>Zones</b><small>Ga naar groepen en LED Lines</small></span></button>
        <button class="quick-card" type="button" data-page="scenes"><i>◇</i><span><b>Scène starten</b><small>Herstel een volledige lichtstand</small></span></button>
      </div>
      <div class="section-title"><h2>Opgeslagen scènes</h2>${scenes.length ? '<button class="text-button" type="button" data-page="scenes">Alles bekijken →</button>' : ''}</div>
      ${scenes.length ? `<div class="grid three">${scenes.map(sceneCard).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">◇</div><b>Nog geen scènes</b><p>Stel een groep in en bewaar daarna de gekozen verlichting als scène.</p><button class="button soft" type="button" data-page="scenes">Eerste scène maken</button></div>`}
    </section>`;
  }

  function renderZones() {
    const location = activeLocation();
    return `<section class="page" data-view="zones"><div class="page-head"><div><span class="eyebrow">${esc(location.name)}</span><h1>Zones</h1><p class="sub">Kies een ruimte. Daarna zie je alleen de groepen die daar horen.</p></div><button class="button primary" type="button" data-action="add-zone">＋ Zone</button></div>
      ${location.zones.length ? `<div class="grid cards">${location.zones.map((zone) => {
        const receivers = zone.groups.reduce((sum, group) => sum + actualLineCount(group), 0);
        return `<button class="zone-card" type="button" data-action="open-zone" data-zone="${esc(zone.id)}"><span class="zone-icon">▦</span><span><b>${esc(zone.name)}</b><small>${zone.groups.length} ${zone.groups.length === 1 ? 'groep' : 'groepen'} · ${receivers} ${receivers === 1 ? 'LED Line' : 'LED Lines'}</small></span><i>›</i></button>`;
      }).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">▦</div><b>Maak je eerste zone</b><p>Een zone is bijvoorbeeld een stand, woonkamer, tunnel of gevel.</p><button class="button primary" type="button" data-action="add-zone">＋ Zone maken</button></div>`}
    </section>`;
  }

  function renderZone() {
    const zone = activeZone();
    if (!zone) return renderZones();
    const allOn = zone.groups.some((group) => group.state.power);
    return `<section class="page" data-view="zone"><div class="breadcrumb"><button type="button" data-page="zones">Zones</button><span>›</span><b>${esc(zone.name)}</b></div>
      <div class="page-head"><div><span class="eyebrow">ZONE</span><h1>${esc(zone.name)}</h1><p class="sub">Kies een groep om de verlichting meteen te bedienen.</p></div><div class="row"><button class="kebab" type="button" data-action="zone-menu">•••</button><button class="button primary" type="button" data-action="add-group">＋ Groep</button></div></div>
      ${zone.groups.length ? `<div class="grid cards">${zone.groups.map((group) => groupCard(group, zone)).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">◆</div><b>Nog geen groepen</b><p>Een groep bundelt LED Lines die samen dezelfde verlichting volgen.</p><button class="button primary" type="button" data-action="add-group">＋ Groep maken</button></div>`}
      <article class="card zone-master"><span><small class="eyebrow">HELE ZONE</small><h2>Alle verlichting in ${esc(zone.name)}</h2><p>Past iedere groep in deze zone tegelijk aan.</p></span><button class="button ${allOn ? 'soft' : 'primary'}" type="button" data-action="zone-power">${allOn ? 'Alles uit' : 'Alles aan'}</button></article>
    </section>`;
  }

  function groupCard(group, zone) {
    const online = group.receiverIds.filter((id) => ble.connected && id === ble.rid).length;
    const lines = actualLineCount(group);
    return `<button class="group-card" type="button" data-action="open-group" data-zone="${esc(zone.id)}" data-group="${esc(group.id)}"><span class="group-icon" style="--group-colour:${esc(groupColour(group))}"></span><span><b>${esc(group.name)}${group.state.power ? '<em class="active-mark">ACTIEF</em>' : ''}</b><small>${esc(group.state.mode === 'static' ? 'Vaste kleur' : group.state.animation)} · ${lines} ${lines === 1 ? 'LED Line' : 'LED Lines'}</small></span><i>›</i></button>`;
  }

  function renderGroup() {
    const zone = activeZone();
    const group = activeGroup();
    if (!zone || !group) return renderZones();
    const effects = availableEffects(group);
    const availableFamilies = ['Alles', ...new Set(effects.map((effect) => effect.family))];
    if (!availableFamilies.includes(effectFilter)) effectFilter = 'Alles';
    const filtered = effectFilter === 'Alles' ? effects : effects.filter((effect) => effect.family === effectFilter);
    const families = availableFamilies;
    const receiversOnline = group.receiverIds.filter((id) => ble.connected && id === ble.rid).length;
    const state = group.state;
    const lines = actualLineCount(group);
    return `<section class="page" data-view="group" data-group="${esc(group.id)}">
      <div class="breadcrumb"><button type="button" data-page="zones">Zones</button><span>›</span><button type="button" data-action="open-zone" data-zone="${esc(zone.id)}">${esc(zone.name)}</button><span>›</span><b>${esc(group.name)}</b></div>
      <article class="card group-hero"><span><small class="eyebrow">${esc(zone.name)} · ${esc(group.type)}</small><h1>${esc(group.name)}</h1><div class="group-meta"><span class="pill">${lines} ${lines === 1 ? 'LED Line' : 'LED Lines'}</span><span class="pill">${group.layout === 'parallel' ? (group.orientation === 'vertical' ? 'Verticaal paneel' : 'Lijnen onder elkaar') : 'Doorlopende LED Line'}</span><span class="pill ${receiversOnline ? 'online' : 'offline'}">${receiversOnline ? '● Live' : '○ Niet live'}</span></div></span><div class="row"><button class="kebab" type="button" data-action="group-menu">•••</button><button class="power-toggle button ${state.power ? 'on' : 'soft'}" type="button" data-action="group-power">${state.power ? 'Aan' : 'Uit'}</button></div></article>
      <article class="preview-card"><div class="preview-toolbar"><b>● LIVE PREVIEW</b><span>${esc(state.mode === 'static' ? 'Vaste kleur' : state.animation)}</span></div><div class="live-preview" data-preview-group="${esc(group.id)}"></div></article>
      <div class="mode-switch"><button type="button" data-action="set-mode" data-mode="static" class="${state.mode === 'static' ? 'active' : ''}">● Vaste kleur</button><button type="button" data-action="set-mode" data-mode="animation" class="${state.mode === 'animation' ? 'active' : ''}">✦ Animaties</button></div>
      ${state.mode === 'animation' ? `<article class="card control-section"><div class="control-section-head"><span><small class="eyebrow">KIES EEN ANIMATIE</small><h2>${group.layout === 'parallel' ? 'Tunnel & effecten' : 'Effecten'}</h2></span><span class="pill">${effects.length}</span></div><div class="effect-toolbar">${families.map((family) => `<button class="filter-chip ${effectFilter === family ? 'active' : ''}" type="button" data-action="filter-effects" data-filter="${esc(family)}">${esc(family)}</button>`).join('')}</div><div class="effect-grid">${filtered.map((effect) => effectCard(effect, group)).join('')}</div></article>` : ''}
      ${renderColourPanel(group)}
      ${state.mode === 'animation' ? renderSettings(group) : ''}
      <article class="card"><div class="row"><span><small class="eyebrow">LED LINES IN DEZE GROEP</small><h2>${lines ? `${lines} gekoppeld` : 'Nog geen LED Lines gekoppeld'}</h2></span><button class="button soft" type="button" data-action="manage-group">Beheren</button></div></article>
    </section>`;
  }

  function availableEffects(group) {
    if (group.type === 'RGBW') return RGBW_EFFECTS.filter((effect) => !effect.line || group.layout === 'parallel');
    return group.layout === 'parallel' ? [...SPI_TUNNEL_EFFECTS, ...SPI_EFFECTS] : SPI_EFFECTS;
  }

  function effectCard(effect, group) {
    const active = group.state.mode === 'animation' && Number(group.state.variant) === effect.variant && group.state.engine === effect.engine;
    const cells = Array.from({ length: 10 }, (_, index) => `<i style="--i:${index}"></i>`).join('');
    const preview = effect.line
      ? `<span class="effect-mini tunnel-demo" style="--demo:${demoColour(effect.variant)}">${Array.from({ length: 3 }, (_, row) => `<span style="--row:${row}">${Array.from({ length: 8 }, (_, index) => `<i style="--i:${index}"></i>`).join('')}</span>`).join('')}</span>`
      : `<span class="effect-mini ${effect.preview}" style="--demo:${demoColour(effect.variant)}">${effect.preview === 'fade' ? '' : cells}</span>`;
    return `<button class="effect-card ${active ? 'active' : ''}" type="button" data-action="choose-effect" data-engine="${effect.engine}" data-variant="${effect.variant}">${preview}<b>${esc(effect.name)}</b><small>${esc(effect.family)}</small></button>`;
  }

  function demoColour(variant) { return ['#EF776F', '#FFD166', '#39D5A5', '#628BFF', '#A86AE8'][Math.abs(Number(variant) || 0) % 5]; }

  function renderColourPanel(group) {
    const state = group.state;
    const count = state.mode === 'static' ? 1 : clamp(state.colourCount, 1, 4);
    const colour = state.colours[state.activeSlot] || state.colours[0];
    return `<article class="card control-section"><div class="control-section-head"><span><small class="eyebrow">KLEUREN</small><h2>Kies je licht</h2></span><span class="live-label ${liveSending ? 'sending' : ''}"><i class="live-dot"></i>LIVE</span></div>
      ${count > 1 ? `<div class="palette-slots">${Array.from({ length: count }, (_, index) => `<button class="palette-slot ${state.activeSlot === index ? 'active' : ''}" type="button" data-action="colour-slot" data-slot="${index}"><i style="--slot:${esc(state.colours[index])}"></i>Kleur ${index + 1}</button>`).join('')}</div>` : ''}
      <div class="colour-layout"><div class="color-wheel" data-colour-wheel tabindex="0" role="slider" aria-label="Kleurenwiel"><span class="wheel-pointer"></span></div><div class="colour-side"><div class="colour-summary"><span class="selected-colour" style="background:${esc(colour)}"></span><label><small class="eyebrow">EXACTE KLEUR</small><input class="field" data-setting="hex" value="${esc(colour)}" maxlength="7" spellcheck="false"></label></div><div class="quick-colours">${['#FF453A','#FF9F0A','#FFD60A','#30D158','#32ADE6','#668CFF','#AF52DE','#FFFFFF'].map((hex) => `<button type="button" style="--quick:${hex}" data-action="quick-colour" data-colour="${hex}" aria-label="${hex}"></button>`).join('')}</div><div class="channel-switches"><button class="channel-toggle ${state.rgbEnabled ? 'active' : ''}" type="button" data-action="toggle-rgb"><i class="rgb-icon"></i><span><b>RGB</b><small>${state.rgbEnabled ? 'Kleur aan' : 'Kleur uit'}</small></span></button><button class="channel-toggle ${state.whiteEnabled ? 'active' : ''}" type="button" data-action="toggle-white"><i class="white-icon"></i><span><b>Wit</b><small>${state.whiteEnabled ? 'Wit aan' : 'Wit uit'}</small></span></button></div><div class="setting-card"><div class="row"><span><b>Witkanaal</b><small>Van zacht pastel tot echt wit</small></span><output>${Math.round(state.white)}</output></div><input type="range" min="0" max="255" value="${Math.round(state.white)}" data-setting="white" ${state.whiteEnabled ? '' : 'disabled'}></div></div></div>
    </article>`;
  }

  function renderSettings(group) {
    const state = group.state;
    const maxWidth = totalPixels(group);
    const showWidth = group.type === 'SPI' && !['BREATHE','WARM','SPARKLE'].includes(state.engine) && !(state.variant >= 98 && state.variant <= 102);
    return `<article class="card control-section"><div class="control-section-head"><span><small class="eyebrow">ANIMATIE-INSTELLINGEN</small><h2>Fijn afstellen</h2></span></div><div class="settings-grid">
      ${settingSlider('brightness','Animatiehelderheid','Hoe fel het effect brandt',state.brightness,1,100,'%')}
      ${settingSlider('speed','Animatiesnelheid','Van uiterst rustig tot snel',state.speed,1,100,'')}
      ${settingSlider('smooth','Vloeiendheid','Zachte beweging zonder stappen',state.smooth,0,100,'%')}
      ${showWidth ? settingSlider('widthPixels','Animatiedikte',`Exacte effectbreedte · maximaal ${maxWidth} pixels`,clamp(state.widthPixels,1,maxWidth),1,maxWidth,' px') : ''}
      ${group.layout === 'parallel' ? settingSlider('lineDelayMs','Timing tussen LED Lines','LED Line 1 → 2 → 3',state.lineDelayMs,0,5080,' ms',40) : ''}
      ${settingSlider('spacing','Afstand','Ruimte tussen effecten',state.spacing,0,100,'%')}
      <div class="setting-card"><div class="row"><span><b>Richting</b><small>De beweging blijft logisch over alle receivers</small></span></div><div class="direction-control"><button type="button" data-action="direction" data-direction="left" class="${state.direction === 'left' ? 'active' : ''}">← Links</button><button type="button" data-action="direction" data-direction="right" class="${state.direction === 'right' ? 'active' : ''}">Rechts →</button></div></div>
    </div></article>`;
  }

  function settingSlider(key, title, description, value, min, max, suffix, step = 1) {
    return `<div class="setting-card"><div class="row"><span><b>${esc(title)}</b><small>${esc(description)}</small></span><output>${Math.round(value)}${suffix}</output></div><input type="range" min="${min}" max="${max}" step="${step}" value="${Math.round(value)}" data-setting="${key}"></div>`;
  }

  function renderScenes() {
    return `<section class="page" data-view="scenes"><div class="page-head"><div><span class="eyebrow">VOLLEDIGE LICHTSTAND</span><h1>Scènes</h1><p class="sub">Bewaar precies de zones en groepen die je later in één tik wilt herstellen.</p></div><button class="button primary" type="button" data-action="new-scene">＋ Nieuwe scène</button></div>
      ${db.scenes.length ? `<div class="grid three">${db.scenes.map(sceneCard).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">◇</div><b>Nog geen scènes</b><p>Stel eerst je groepen in. Kies daarna welke groepen in de scène horen.</p><button class="button primary" type="button" data-action="new-scene">Scène opslaan</button></div>`}
    </section>`;
  }

  function sceneCard(scene) {
    const entries = scene.groups || [];
    const first = entries[0]?.state || defaultLightState();
    return `<article class="scene-card"><div class="scene-visual" style="--rail-colour:${esc(first.colours?.[0] || '#EF776F')}"><small class="eyebrow">SCÈNE</small><div class="mini-rail rail live">${railCells(18)}</div></div><div class="scene-content"><div class="row"><span><b>${esc(scene.name)}</b><small>${entries.length} ${entries.length === 1 ? 'groep' : 'groepen'} · ${formatDate(scene.updatedAt || scene.createdAt)}</small></span><button class="kebab" type="button" data-action="scene-menu" data-scene="${esc(scene.id)}">•••</button></div><button class="button primary" style="width:100%;margin-top:13px" type="button" data-action="apply-scene" data-scene="${esc(scene.id)}">Scène activeren</button></div></article>`;
  }

  function renderPresets() {
    const group = currentOrFirstGroup();
    return `<section class="page" data-view="presets"><div class="page-head"><div><span class="eyebrow">JOUW EFFECTEN</span><h1>Presets</h1><p class="sub">Bewaar een mooie kleur of animatie en pas die later meteen opnieuw toe.</p></div><button class="button primary" type="button" data-action="new-preset" ${group ? '' : 'disabled'}>＋ Huidige instelling</button></div>
      ${db.presets.length ? `<div class="grid three">${db.presets.map(presetCard).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">☆</div><b>Nog geen presets</b><p>Open een groep, kies je favoriete kleuren en bewaar die combinatie hier.</p><button class="button soft" type="button" data-page="zones">Naar zones</button></div>`}
    </section>`;
  }

  function presetCard(preset) {
    const state = preset.state || defaultLightState(preset.type);
    return `<article class="preset-card"><div class="preset-visual" style="--rail-colour:${esc(state.colours?.[0] || '#EF776F')}"><small class="eyebrow">${esc(preset.type || 'SPI')} · ${esc(state.mode === 'static' ? 'VASTE KLEUR' : state.animation)}</small><div class="mini-rail rail live">${railCells(18)}</div></div><div class="preset-content"><div class="row"><span><b>${esc(preset.name)}</b><small>${formatDate(preset.updatedAt || preset.createdAt)}</small></span><button class="kebab" type="button" data-action="preset-menu" data-preset="${esc(preset.id)}">•••</button></div><button class="button soft" style="width:100%;margin-top:13px" type="button" data-action="apply-preset" data-preset="${esc(preset.id)}">Toepassen op groep</button></div></article>`;
  }

  function renderReceivers() {
    const receivers = Object.values(db.receivers).sort((a, b) => a.number - b.number);
    return `<section class="page" data-view="receivers"><div class="page-head"><div><span class="eyebrow">LED LINES</span><h1>Receivers</h1><p class="sub">Koppelen, herkennen en aan een groep toevoegen.</p></div><button class="button primary" type="button" data-action="pair">＋ Receiver</button></div>
      <article class="nfc-strip"><span class="nfc-icon">◉</span><span><b>NFC-koppeling</b><small>Tik een receiver aan zodra NFC beschikbaar is. Bluetooth staat ernaast als gewone koppeloptie.</small></span><button class="button dark" type="button" data-action="pair">Bluetooth koppelen</button></article>
      ${receivers.length ? `<div class="grid cards">${receivers.map(receiverCard).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">◆</div><b>Nog geen receivers</b><p>Voeg een SPI- of RGBW-receiver toe. Het juiste type wordt automatisch herkend.</p><button class="button primary" type="button" data-action="pair">Receiver toevoegen</button></div>`}
    </section>`;
  }

  function receiverCard(receiver) {
    const assigned = assignedGroup(receiver.id);
    const live = ble.connected && ble.rid === receiver.rid;
    const detail = receiver.type === 'SPI' ? `${receiver.pixels || 1} pixels · ${receiver.physicalReverse ? 'receiver rechts' : 'receiver links'}` : `${rgbwPortCount(receiver)} LED ${rgbwPortCount(receiver) === 1 ? 'Line' : 'Lines'}`;
    return `<article class="receiver-card"><span class="receiver-number">${receiver.number}</span><span><b>${esc(receiver.name || `Receiver ${receiver.number}`)}</b><small>${esc(receiver.type)} · ${esc(detail)}</small><small>${assigned ? `${esc(assigned.zone.name)} → ${esc(assigned.group.name)}` : 'Nog niet in een groep'}</small></span><span class="receiver-actions"><button class="${live ? 'live' : ''}" type="button" data-action="identify" data-receiver="${esc(receiver.id)}" title="LED Line laten knipperen">☼</button><button type="button" data-action="receiver-menu" data-receiver="${esc(receiver.id)}" title="Beheren">•••</button></span></article>`;
  }

  function renderMore() {
    return `<section class="page" data-view="more"><div class="page-head"><div><span class="eyebrow">ALUVISION</span><h1>Meer</h1><p class="sub">Alleen de extra opties die je af en toe nodig hebt.</p></div></div><div class="grid more-grid"><button class="more-card" type="button" data-action="locations"><i>◆</i><b>Locaties</b><small>Wisselen of een locatie toevoegen</small></button><button class="more-card" type="button" data-action="toggle-theme"><i>◐</i><b>Weergave</b><small>${db.theme === 'dark' ? 'Donkere modus aan' : 'Lichte modus aan'}</small></button><button class="more-card" type="button" data-page="receivers"><i>⌁</i><b>Verbindingen</b><small>${ble.connected ? `Receiver ${ble.number} live verbonden` : 'Geen receiver live verbonden'}</small></button><button class="more-card" type="button" data-action="about"><i>i</i><b>Over de app</b><small>Versie en directe bediening</small></button></div></section>`;
  }

  function currentOrFirstGroup() { return activeGroup() || allGroups()[0]?.group || null; }
  function rgbwPortCount(receiver) { return ((receiver.portMask & 1) ? 1 : 0) + ((receiver.portMask & 2) ? 1 : 0); }
  function formatDate(value) { try { return new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'short' }).format(new Date(value || Date.now())); } catch (_) { return ''; } }

  function openPairModal() {
    openModal(`${modalHead('Receiver toevoegen', 'KOPPELEN')}<div class="pair-choice"><article class="pair-card nfc"><span class="pair-icon">◉</span><b>NFC</b><small>Houd de smart controller tegen de receiver voor automatisch koppelen.</small><span class="pill">NFC READY</span></article><article class="pair-card"><span class="pair-icon">ᛒ</span><b>Bluetooth</b><small>Zoek en koppel rechtstreeks vanuit deze app.</small><button class="button primary" type="button" data-action="connect-ble">Bluetooth koppelen</button></article></div><p class="sub" style="margin-top:14px">Op iPhone opent Bluetooth via Bluefy. Je hebt geen Mac of lokaal wifinetwerk nodig.</p>`);
  }

  function openReceiverSetup(receiverId) {
    const receiver = receiverFor(receiverId);
    if (!receiver) return;
    const compatible = allGroups().filter(({ group }) => !group.receiverIds.length || group.type === receiver.type);
    const assigned = assignedGroup(receiverId);
    openModal(`${modalHead(`Receiver ${receiver.number}`, 'INSTELLEN')}<div class="form-grid">
      <label><span>NAAM</span><input id="receiverNameInput" class="field" value="${esc(receiver.name || `Receiver ${receiver.number}`)}"></label>
      ${receiver.type === 'SPI' ? `<div><span class="eyebrow">PIXELS CONTROLEREN</span><div class="calibrate-visual" style="margin-top:8px"><div class="calibrate-line ${receiver.physicalReverse ? 'reverse' : ''}">${railCells(20)}</div></div><p class="sub" style="margin-top:8px">Groen is het begin. Rood is de laatste gekozen pixel.</p></div><div class="setting-card"><div class="row"><span><b>Aantal pixels</b><small>Pas aan tot rood exact op het einde staat</small></span><output id="setupPixelOutput">${receiver.pixels}</output></div><input id="setupPixels" type="range" min="1" max="1024" value="${receiver.pixels}" data-action="calibrate-pixels"></div><div><span class="eyebrow">AAN WELKE KANT ZIT DE RECEIVER?</span><div class="side-choice" style="margin-top:8px"><button class="${!receiver.physicalReverse ? 'active' : ''}" type="button" data-action="setup-side" data-receiver="${esc(receiver.id)}" data-side="left">Receiver links →</button><button class="${receiver.physicalReverse ? 'active' : ''}" type="button" data-action="setup-side" data-receiver="${esc(receiver.id)}" data-side="right">← Receiver rechts</button></div></div>` : `<div class="card"><b>RGBW automatisch herkend</b><p class="sub">${rgbwPortCount(receiver)} actieve ${rgbwPortCount(receiver) === 1 ? 'uitgang' : 'uitgangen'}. Pixelinstellingen zijn niet nodig.</p></div>`}
      <label><span>GROEP</span><select id="receiverGroupSelect" class="field"><option value="">Niet in een groep</option>${compatible.map(({ zone, group }) => `<option value="${esc(group.id)}" ${assigned?.group.id === group.id ? 'selected' : ''}>${esc(zone.name)} → ${esc(group.name)}</option>`).join('')}</select></label>
      <button class="button primary" type="button" data-action="save-receiver" data-receiver="${esc(receiverId)}">Instellingen opslaan</button>
    </div>`);
  }

  function openManageGroup() {
    const group = activeGroup();
    if (!group) return;
    const compatible = Object.values(db.receivers).filter((receiver) => receiver.type === group.type);
    const ordered = [...group.receiverIds.map(receiverFor).filter(Boolean), ...compatible.filter((receiver) => !group.receiverIds.includes(receiver.id))];
    openModal(`${modalHead(group.name, 'LED LINES BEHEREN')}<div class="layout-choice"><button class="layout-card ${group.layout === 'continuous' ? 'active' : ''}" type="button" data-action="set-layout" data-layout="continuous"><span class="layout-visual continuous"><span></span><span></span></span><b>Doorlopende LED Line</b><small>De animatie loopt van de ene strip door naar de volgende.</small></button><button class="layout-card ${group.layout === 'parallel' ? 'active' : ''}" type="button" data-action="set-layout" data-layout="parallel"><span class="layout-visual parallel"><span></span><span></span><span></span></span><b>Lijnen onder elkaar</b><small>Tunnel- en paneeleffecten bewegen van lijn naar lijn.</small></button></div>
      ${group.layout === 'parallel' ? `<div class="direction-control" style="margin:12px 0"><button type="button" data-action="orientation" data-orientation="horizontal" class="${group.orientation === 'horizontal' ? 'active' : ''}">☰ Horizontaal</button><button type="button" data-action="orientation" data-orientation="vertical" class="${group.orientation === 'vertical' ? 'active' : ''}">▥ Verticaal</button></div>` : ''}
      <div class="section-title" style="margin-top:17px"><h2>Receivers in deze groep</h2></div><div class="check-list">${ordered.length ? ordered.map((receiver, index) => `<div class="check-row"><input type="checkbox" data-group-receiver="${esc(receiver.id)}" ${group.receiverIds.includes(receiver.id) ? 'checked' : ''}><span><b>Receiver ${receiver.number}</b><small>${receiver.type === 'SPI' ? `${receiver.pixels} pixels` : `${rgbwPortCount(receiver)} uitgangen`}</small></span><span class="receiver-actions"><button type="button" data-action="move-receiver" data-receiver="${esc(receiver.id)}" data-move="up" ${!group.receiverIds.includes(receiver.id) || index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-action="move-receiver" data-receiver="${esc(receiver.id)}" data-move="down" ${!group.receiverIds.includes(receiver.id) || index >= group.receiverIds.length - 1 ? 'disabled' : ''}>↓</button><button type="button" data-action="identify" data-receiver="${esc(receiver.id)}">☼</button></span></div>`).join('') : '<div class="empty-state"><b>Geen passende receivers</b><p>Voeg eerst een receiver van hetzelfde type toe.</p></div>'}</div>
      <div class="row" style="margin-top:15px"><button class="button soft" type="button" data-action="pair">＋ Receiver toevoegen</button><button class="button primary" type="button" data-action="save-group-receivers">Klaar</button></div>`);
  }

  function openNewScene() {
    const groups = allGroups();
    openModal(`${modalHead('Nieuwe scène', 'HUIDIGE VERLICHTING BEWAREN')}<div class="form-grid"><label><span>NAAM</span><input id="sceneNameInput" class="field" value="Scene ${db.scenes.length + 1}"></label><div><span class="eyebrow">KIES ZONES EN GROEPEN</span><div class="check-list" style="margin-top:8px">${groups.map(({ zone, group }) => `<label class="check-row"><input type="checkbox" data-scene-group="${esc(group.id)}" checked><span><b>${esc(group.name)}</b><small>${esc(zone.name)} · ${esc(group.state.mode === 'static' ? 'Vaste kleur' : group.state.animation)}</small></span><i style="width:22px;height:22px;border-radius:7px;background:${esc(groupColour(group))}"></i></label>`).join('')}</div></div><button class="button primary" type="button" data-action="save-scene">Scène opslaan</button></div>`);
  }

  function openSceneMenu(id) {
    const scene = db.scenes.find((item) => item.id === id);
    if (!scene) return;
    openModal(`${modalHead(scene.name, 'SCÈNE BEHEREN')}<div class="stack"><button class="button soft" type="button" data-action="rename-scene" data-scene="${esc(id)}">Naam wijzigen</button><button class="button soft" type="button" data-action="overwrite-scene" data-scene="${esc(id)}">Overschrijven met huidige verlichting</button><button class="button soft" type="button" data-action="duplicate-scene" data-scene="${esc(id)}">Dupliceren</button><button class="button danger" type="button" data-action="delete-scene" data-scene="${esc(id)}">Verwijderen</button></div>`);
  }

  function openNewPreset() {
    const group = currentOrFirstGroup();
    if (!group) return showToast('Maak eerst een groep', true);
    openModal(`${modalHead('Preset bewaren', 'HUIDIGE GROEP')}<div class="form-grid"><label><span>NAAM</span><input id="presetNameInput" class="field" value="${esc(group.state.mode === 'static' ? 'Mijn kleur' : group.state.animation)}"></label><div class="card"><small class="eyebrow">WORDT BEWAARD</small><h2>${esc(group.name)}</h2><p class="sub">${esc(group.type)} · ${esc(group.state.mode === 'static' ? 'Vaste kleur' : group.state.animation)} · ${group.state.brightness}%</p></div><button class="button primary" type="button" data-action="save-preset">Preset opslaan</button></div>`);
  }

  function openPresetTarget(id) {
    const preset = db.presets.find((item) => item.id === id);
    if (!preset) return;
    const compatible = allGroups().filter(({ group }) => group.type === preset.type);
    openModal(`${modalHead(preset.name, 'TOEPASSEN OP GROEP')}<div class="stack">${compatible.map(({ zone, group }) => `<button class="group-card" type="button" data-action="apply-preset-group" data-preset="${esc(id)}" data-group="${esc(group.id)}"><span class="group-icon" style="--group-colour:${esc(groupColour(group))}"></span><span><b>${esc(group.name)}</b><small>${esc(zone.name)}</small></span><i>›</i></button>`).join('') || '<div class="empty-state"><b>Geen passende groep</b><p>SPI- en RGBW-receivers blijven altijd in aparte groepen.</p></div>'}</div>`);
  }

  function openPresetMenu(id) {
    const preset = db.presets.find((item) => item.id === id);
    if (!preset) return;
    openModal(`${modalHead(preset.name, 'PRESET BEHEREN')}<div class="stack"><button class="button soft" type="button" data-action="rename-preset" data-preset="${esc(id)}">Naam wijzigen</button><button class="button soft" type="button" data-action="duplicate-preset" data-preset="${esc(id)}">Dupliceren</button><button class="button danger" type="button" data-action="delete-preset" data-preset="${esc(id)}">Verwijderen</button></div>`);
  }

  function openReceiverMenu(id) {
    const receiver = receiverFor(id);
    if (!receiver) return;
    openModal(`${modalHead(`Receiver ${receiver.number}`, 'BEHEREN')}<div class="stack"><button class="button soft" type="button" data-action="edit-receiver" data-receiver="${esc(id)}">Instellingen</button><button class="button soft" type="button" data-action="identify" data-receiver="${esc(id)}">LED Line laten knipperen</button><button class="button ${ble.connected && ble.rid === id ? 'danger' : 'primary'}" type="button" data-action="${ble.connected && ble.rid === id ? 'disconnect' : 'pair'}">${ble.connected && ble.rid === id ? 'Verbinding sluiten' : 'Bluetooth verbinden'}</button><button class="button danger" type="button" data-action="remove-receiver" data-receiver="${esc(id)}">Receiver verwijderen</button></div>`);
  }

  function openLocations() {
    openModal(`${modalHead('Locaties', 'ACTIEVE LOCATIE')}<div class="stack">${db.locations.map((location) => `<button class="zone-card" type="button" data-action="switch-location" data-location="${esc(location.id)}"><span class="zone-icon">◆</span><span><b>${esc(location.name)}${location.id === db.activeLocationId ? '<em class="active-mark">ACTIEF</em>' : ''}</b><small>${location.zones.length} zones</small></span><i>›</i></button>`).join('')}<button class="button soft" type="button" data-action="add-location">＋ Locatie toevoegen</button></div>`);
  }

  function openZoneMenu() {
    const zone = activeZone();
    if (!zone) return;
    openModal(`${modalHead(zone.name, 'ZONE BEHEREN')}<div class="stack"><button class="button soft" type="button" data-action="rename-zone">Naam wijzigen</button><button class="button danger" type="button" data-action="delete-zone">Zone verwijderen</button></div>`);
  }

  function openGroupMenu() {
    const group = activeGroup();
    if (!group) return;
    openModal(`${modalHead(group.name, 'GROEP BEHEREN')}<div class="stack"><button class="button soft" type="button" data-action="rename-group">Naam wijzigen</button><button class="button soft" type="button" data-action="manage-group">LED Lines beheren</button><button class="button danger" type="button" data-action="delete-group">Groep verwijderen</button></div>`);
  }

  function findGroupById(id) {
    for (const location of db.locations) for (const zone of location.zones) {
      const group = zone.groups.find((item) => item.id === id);
      if (group) return { location, zone, group };
    }
    return null;
  }

  function addZone() {
    const name = prompt('Naam van de nieuwe zone', `Zone ${activeLocation().zones.length + 1}`)?.trim();
    if (!name) return;
    const zone = { id: uid('zone-'), name, groups: [] };
    activeLocation().zones.push(zone);
    saveDb();
    navigate('zone', zone.id);
  }

  function addGroup() {
    const zone = activeZone();
    if (!zone) return;
    openModal(`${modalHead('Nieuwe groep', 'ZONE · ' + zone.name)}<div class="form-grid"><label><span>NAAM</span><input id="newGroupName" class="field" value="Groep ${zone.groups.length + 1}"></label><label><span>TYPE LED LINE</span><select id="newGroupType" class="field"><option value="SPI">SPI · individuele pixels</option><option value="RGBW">RGBW · volledige LED Line</option></select></label><button class="button primary" type="button" data-action="confirm-group">Groep maken</button></div>`);
  }

  function confirmGroup() {
    const zone = activeZone();
    const name = $('newGroupName')?.value.trim();
    const type = $('newGroupType')?.value === 'RGBW' ? 'RGBW' : 'SPI';
    if (!zone || !name) return showToast('Geef de groep een naam', true);
    const group = { id: uid('group-'), name, type, layout: 'continuous', orientation: 'horizontal', receiverIds: [], state: defaultLightState(type) };
    zone.groups.push(group);
    saveDb();
    navigate('group', zone.id, group.id);
  }

  function setAllPower(scopeGroups, power) {
    scopeGroups.forEach((group) => { group.state.power = power; scheduleGroupLive(group, true); });
    saveDb();
    renderApp();
  }

  function openAllColour() {
    const first = allGroups()[0]?.group;
    if (!first) return showToast('Maak eerst een groep', true);
    openModal(`${modalHead('Kleur voor alle verlichting', 'VOLLEDIGE LOCATIE')}<div class="colour-layout"><label style="display:grid;gap:8px"><span class="eyebrow">KIES EEN KLEUR</span><input id="allColourInput" type="color" value="${esc(first.state.colours[0])}" style="width:100%;height:180px;border:0;border-radius:20px;background:transparent"></label><div class="stack"><p class="sub">Deze kleur wordt toegepast op alle groepen binnen ${esc(activeLocation().name)}.</p><button class="button primary" type="button" data-action="apply-all-colour">Live toepassen</button></div></div>`);
  }

  function chooseEffect(engine, variant) {
    const group = activeGroup();
    if (!group) return;
    const effect = availableEffects(group).find((item) => item.engine === engine && Number(item.variant) === Number(variant));
    if (!effect) return;
    Object.assign(group.state, effect.defaults || {}, {
      mode: 'animation', animation: effect.name, engine: effect.engine, variant: effect.variant,
      colourCount: effect.colours, restartToken: (group.state.restartToken || 0) + 1
    });
    if (effect.warm) {
      group.state.rgbEnabled = false;
      group.state.whiteEnabled = true;
      group.state.white = Math.max(235, group.state.white || 0);
    }
    saveDb();
    scheduleGroupLive(group, true);
    renderApp();
  }

  function setGroupSetting(key, value, immediate = false) {
    const group = activeGroup();
    if (!group) return;
    if (key === 'hex') {
      const normalized = String(value).trim().toUpperCase();
      if (!/^#[0-9A-F]{6}$/.test(normalized)) return;
      group.state.colours[group.state.activeSlot || 0] = normalized;
    } else {
      const ranges = { brightness: [1,100], speed: [1,100], smooth: [0,100], widthPixels: [1,totalPixels(group)], lineDelayMs: [0,5080], spacing: [0,100], white: [0,255] };
      if (ranges[key]) group.state[key] = clamp(value, ranges[key][0], ranges[key][1]);
    }
    saveDb();
    scheduleGroupLive(group, immediate);
    paintPreviews(performance.now());
  }

  function saveScene() {
    const name = $('sceneNameInput')?.value.trim();
    const selected = [...document.querySelectorAll('[data-scene-group]:checked')].map((input) => input.dataset.sceneGroup);
    if (!name) return showToast('Geef de scène een naam', true);
    if (!selected.length) return showToast('Kies minstens één groep', true);
    const scene = { id: uid('scene-'), name, createdAt: Date.now(), updatedAt: Date.now(), groups: selected.map((id) => ({ groupId: id, state: clone(findGroupById(id).group.state) })) };
    db.scenes.unshift(scene);
    saveDb(); closeModal(); navigate('scenes'); showToast('Scène opgeslagen');
  }

  function applyScene(id) {
    const scene = db.scenes.find((item) => item.id === id);
    if (!scene) return;
    scene.groups.forEach((entry) => {
      const found = findGroupById(entry.groupId);
      if (!found) return;
      found.group.state = { ...defaultLightState(found.group.type), ...clone(entry.state), receiverType: found.group.type };
      scheduleGroupLive(found.group, true);
    });
    scene.lastUsed = Date.now(); saveDb(); renderApp(); showToast(`${scene.name} is actief`);
  }

  function overwriteScene(id) {
    const scene = db.scenes.find((item) => item.id === id);
    if (!scene) return;
    scene.groups = scene.groups.map((entry) => {
      const found = findGroupById(entry.groupId);
      return found ? { groupId: entry.groupId, state: clone(found.group.state) } : entry;
    });
    scene.updatedAt = Date.now(); saveDb(); closeModal(); renderApp(); showToast('Scène overschreven');
  }

  function renameScene(id) {
    const scene = db.scenes.find((item) => item.id === id);
    if (!scene) return;
    const name = prompt('Nieuwe naam', scene.name)?.trim();
    if (!name) return;
    scene.name = name; scene.updatedAt = Date.now(); saveDb(); closeModal(); renderApp();
  }

  function duplicateScene(id) {
    const scene = db.scenes.find((item) => item.id === id);
    if (!scene) return;
    db.scenes.unshift({ ...clone(scene), id: uid('scene-'), name: `${scene.name} kopie`, createdAt: Date.now(), updatedAt: Date.now() });
    saveDb(); closeModal(); renderApp(); showToast('Scène gedupliceerd');
  }

  function deleteScene(id) {
    const scene = db.scenes.find((item) => item.id === id);
    if (!scene || !confirm(`Scène “${scene.name}” verwijderen?`)) return;
    db.scenes = db.scenes.filter((item) => item.id !== id); saveDb(); closeModal(); renderApp();
  }

  function savePreset() {
    const group = currentOrFirstGroup();
    const name = $('presetNameInput')?.value.trim();
    if (!group || !name) return showToast('Geef de preset een naam', true);
    db.presets.unshift({ id: uid('preset-'), name, type: group.type, state: clone(group.state), createdAt: Date.now(), updatedAt: Date.now() });
    saveDb(); closeModal(); navigate('presets'); showToast('Preset opgeslagen');
  }

  function applyPresetToGroup(presetId, groupId) {
    const preset = db.presets.find((item) => item.id === presetId);
    const found = findGroupById(groupId);
    if (!preset || !found || found.group.type !== preset.type) return showToast('Deze preset past niet bij deze groep', true);
    found.group.state = { ...defaultLightState(found.group.type), ...clone(preset.state), receiverType: found.group.type, restartToken: (found.group.state.restartToken || 0) + 1 };
    saveDb(); scheduleGroupLive(found.group, true); closeModal(); route = { page: 'group', zoneId: found.zone.id, groupId: found.group.id }; renderApp(); showToast('Preset live toegepast');
  }

  function renamePreset(id) {
    const preset = db.presets.find((item) => item.id === id);
    const name = preset && prompt('Nieuwe naam', preset.name)?.trim();
    if (!name) return;
    preset.name = name; preset.updatedAt = Date.now(); saveDb(); closeModal(); renderApp();
  }

  function duplicatePreset(id) {
    const preset = db.presets.find((item) => item.id === id);
    if (!preset) return;
    db.presets.unshift({ ...clone(preset), id: uid('preset-'), name: `${preset.name} kopie`, createdAt: Date.now(), updatedAt: Date.now() }); saveDb(); closeModal(); renderApp();
  }

  function deletePreset(id) {
    const preset = db.presets.find((item) => item.id === id);
    if (!preset || !confirm(`Preset “${preset.name}” verwijderen?`)) return;
    db.presets = db.presets.filter((item) => item.id !== id); saveDb(); closeModal(); renderApp();
  }

  function saveGroupReceivers() {
    const group = activeGroup();
    if (!group) return;
    const selected = [...document.querySelectorAll('[data-group-receiver]:checked')].map((input) => input.dataset.groupReceiver);
    selected.forEach((id) => {
      const existing = assignedGroup(id);
      if (existing && existing.group.id !== group.id) existing.group.receiverIds = existing.group.receiverIds.filter((value) => value !== id);
    });
    group.receiverIds = selected;
    saveDb(); closeModal(); renderApp(); scheduleGroupLive(group, true); showToast('Groep bijgewerkt');
  }

  async function saveReceiverSettings(id) {
    const receiver = receiverFor(id);
    if (!receiver) return;
    receiver.name = $('receiverNameInput')?.value.trim() || `Receiver ${receiver.number}`;
    if (receiver.type === 'SPI') receiver.pixels = clamp($('setupPixels')?.value || receiver.pixels, 1, 1024);
    const groupId = $('receiverGroupSelect')?.value || '';
    const existing = assignedGroup(id);
    if (existing) existing.group.receiverIds = existing.group.receiverIds.filter((value) => value !== id);
    const target = groupId && findGroupById(groupId);
    if (target && target.group.type === receiver.type) target.group.receiverIds.push(id);
    saveDb();
    if (ble.connected) {
      setBusy(true, 'Receiverinstellingen bewaren…');
      try {
        if (receiver.type === 'SPI') {
          await transact({ TYPE: 'CONFIG', KEY: db.installationKey, TARGET: receiver.rid, DEVTYPE: 'SPI', PHYSICAL: receiver.pixels, PHYSICALREVERSE: receiver.physicalReverse ? 1 : 0 }, 3000);
          await transact({ TYPE: 'LIVE', KEY: db.installationKey, TARGET: receiver.rid, DEVTYPE: 'SPI', TEST: 'CLEAR' }, 2200, true);
        } else {
          await transact({ TYPE: 'CONFIG', KEY: db.installationKey, TARGET: receiver.rid, DEVTYPE: 'RGBW', PORTMASK: receiver.portMask, PHYSICAL: receiver.portMask }, 3000);
        }
      } catch (error) { showToast(friendlyError(error), true); }
      setBusy(false);
    }
    closeModal(); renderApp(); if (target) scheduleGroupLive(target.group, true); showToast('Receiver opgeslagen');
  }

  async function removeReceiver(id) {
    const receiver = receiverFor(id);
    if (!receiver || !confirm(`Receiver ${receiver.number} verwijderen? Daarna moet je hem opnieuw koppelen.`)) return;
    if (ble.connected && ble.rid === id) {
      try { await transact({ TYPE: 'UNPAIR', KEY: db.installationKey, TARGET: receiver.rid }, 2200, true); } catch (_) {}
      disconnectReceiver();
    }
    allGroups().forEach(({ group }) => { group.receiverIds = group.receiverIds.filter((value) => value !== id); });
    delete db.receivers[id]; saveDb(); closeModal(); renderApp(); showToast('Receiver verwijderd');
  }

  function addLocation() {
    const name = prompt('Naam van de locatie', `Locatie ${db.locations.length + 1}`)?.trim();
    if (!name) return;
    const id = uid('loc-');
    db.locations.push({ id, name, zones: [] }); db.activeLocationId = id; saveDb(); closeModal(); navigate('zones');
  }

  function renameZone() {
    const zone = activeZone();
    const name = zone && prompt('Nieuwe naam voor deze zone', zone.name)?.trim();
    if (!name) return;
    zone.name = name; saveDb(); closeModal(); renderApp();
  }

  function deleteZone() {
    const zone = activeZone();
    if (!zone || !confirm(`Zone “${zone.name}” verwijderen? De receivers blijven bewaard.`)) return;
    activeLocation().zones = activeLocation().zones.filter((item) => item.id !== zone.id);
    saveDb(); closeModal(); navigate('zones');
  }

  function renameGroup() {
    const group = activeGroup();
    const name = group && prompt('Nieuwe naam voor deze groep', group.name)?.trim();
    if (!name) return;
    group.name = name; saveDb(); closeModal(); renderApp();
  }

  function deleteGroup() {
    const zone = activeZone(), group = activeGroup();
    if (!zone || !group || !confirm(`Groep “${group.name}” verwijderen? De receivers blijven bewaard.`)) return;
    zone.groups = zone.groups.filter((item) => item.id !== group.id);
    saveDb(); closeModal(); navigate('zone', zone.id);
  }

  function moveReceiverInGroup(id, direction) {
    const group = activeGroup();
    if (!group) return;
    const index = group.receiverIds.indexOf(id);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= group.receiverIds.length) return;
    [group.receiverIds[index], group.receiverIds[target]] = [group.receiverIds[target], group.receiverIds[index]];
    saveDb(); openManageGroup(); scheduleGroupLive(group, true);
  }

  function handleAction(action, element) {
    const group = activeGroup();
    switch (action) {
      case 'go-home': return navigate('home');
      case 'go-receivers': return navigate('receivers');
      case 'close-modal': return closeModal();
      case 'locations': return openLocations();
      case 'pair': return openPairModal();
      case 'connect-ble': return connectReceiver();
      case 'disconnect': disconnectReceiver(); closeModal(); return;
      case 'add-zone': return addZone();
      case 'add-group': return addGroup();
      case 'confirm-group': return confirmGroup();
      case 'zone-menu': return openZoneMenu();
      case 'rename-zone': return renameZone();
      case 'delete-zone': return deleteZone();
      case 'group-menu': return openGroupMenu();
      case 'rename-group': return renameGroup();
      case 'delete-group': return deleteGroup();
      case 'open-zone': return navigate('zone', element.dataset.zone);
      case 'open-group': return navigate('group', element.dataset.zone, element.dataset.group);
      case 'all-colour': return openAllColour();
      case 'apply-all-colour': {
        const colour = $('allColourInput')?.value || '#FF5B4D';
        allGroups().forEach(({ group: item }) => { Object.assign(item.state, { mode: 'static', engine: 'STATIC', animation: 'Static Color', colourCount: 1, rgbEnabled: true, power: true }); item.state.colours[0] = colour; scheduleGroupLive(item, true); });
        saveDb(); closeModal(); renderApp(); return showToast('Kleur live toegepast');
      }
      case 'all-power': { const groups = allGroups().map((entry) => entry.group); return setAllPower(groups, !groups.some((item) => item.state.power)); }
      case 'zone-power': { const groups = activeZone()?.groups || []; return setAllPower(groups, !groups.some((item) => item.state.power)); }
      case 'group-power': group.state.power = !group.state.power; saveDb(); scheduleGroupLive(group, true); return renderApp();
      case 'set-mode': {
        group.state.mode = element.dataset.mode;
        if (group.state.mode === 'static') {
          Object.assign(group.state, { animation: 'Static Color', engine: 'STATIC', variant: 0, colourCount: 1 });
        } else if (group.state.engine === 'STATIC' || group.state.animation === 'Static Color') {
          const first = availableEffects(group)[0];
          Object.assign(group.state, { animation: first.name, engine: first.engine, variant: first.variant, colourCount: first.colours }, first.defaults || {});
        }
        group.state.restartToken += 1; saveDb(); scheduleGroupLive(group, true); renderApp(); return;
      }
      case 'filter-effects': effectFilter = element.dataset.filter; return renderApp();
      case 'choose-effect': return chooseEffect(element.dataset.engine, element.dataset.variant);
      case 'colour-slot': group.state.activeSlot = Number(element.dataset.slot); saveDb(); return renderApp();
      case 'quick-colour': group.state.colours[group.state.activeSlot || 0] = element.dataset.colour; if (element.dataset.colour === '#FFFFFF') { group.state.rgbEnabled = false; group.state.whiteEnabled = true; group.state.white = Math.max(235, group.state.white); } saveDb(); scheduleGroupLive(group, true); return renderApp();
      case 'toggle-rgb': group.state.rgbEnabled = !group.state.rgbEnabled; if (!group.state.rgbEnabled && !group.state.whiteEnabled) group.state.whiteEnabled = true; saveDb(); scheduleGroupLive(group, true); return renderApp();
      case 'toggle-white': group.state.whiteEnabled = !group.state.whiteEnabled; if (group.state.whiteEnabled && !group.state.white) group.state.white = 220; if (!group.state.whiteEnabled && !group.state.rgbEnabled) group.state.rgbEnabled = true; saveDb(); scheduleGroupLive(group, true); return renderApp();
      case 'direction': group.state.direction = element.dataset.direction; group.state.restartToken += 1; saveDb(); scheduleGroupLive(group, true); return renderApp();
      case 'manage-group': return openManageGroup();
      case 'set-layout': group.layout = element.dataset.layout; if (group.layout === 'parallel' && group.receiverIds.length > 1) effectFilter = 'Tunnel'; saveDb(); closeModal(); renderApp(); scheduleGroupLive(group, true); return;
      case 'orientation': group.orientation = element.dataset.orientation; saveDb(); return openManageGroup();
      case 'save-group-receivers': return saveGroupReceivers();
      case 'move-receiver': return moveReceiverInGroup(element.dataset.receiver, element.dataset.move);
      case 'new-scene': return openNewScene();
      case 'save-scene': return saveScene();
      case 'apply-scene': return applyScene(element.dataset.scene);
      case 'scene-menu': return openSceneMenu(element.dataset.scene);
      case 'rename-scene': return renameScene(element.dataset.scene);
      case 'overwrite-scene': return overwriteScene(element.dataset.scene);
      case 'duplicate-scene': return duplicateScene(element.dataset.scene);
      case 'delete-scene': return deleteScene(element.dataset.scene);
      case 'new-preset': return openNewPreset();
      case 'save-preset': return savePreset();
      case 'apply-preset': return openPresetTarget(element.dataset.preset);
      case 'apply-preset-group': return applyPresetToGroup(element.dataset.preset, element.dataset.group);
      case 'preset-menu': return openPresetMenu(element.dataset.preset);
      case 'rename-preset': return renamePreset(element.dataset.preset);
      case 'duplicate-preset': return duplicatePreset(element.dataset.preset);
      case 'delete-preset': return deletePreset(element.dataset.preset);
      case 'receiver-menu': return openReceiverMenu(element.dataset.receiver);
      case 'edit-receiver': return openReceiverSetup(element.dataset.receiver);
      case 'save-receiver': return saveReceiverSettings(element.dataset.receiver);
      case 'remove-receiver': return removeReceiver(element.dataset.receiver);
      case 'identify': return identifyReceiver(element.dataset.receiver);
      case 'setup-side': { const receiver = receiverFor(element.dataset.receiver) || connectedReceiver(); if (!receiver) return; receiver.physicalReverse = element.dataset.side === 'right'; saveDb(); scheduleCalibration(receiver); return openReceiverSetup(receiver.id); }
      case 'switch-location': db.activeLocationId = element.dataset.location; saveDb(); closeModal(); return navigate('home');
      case 'add-location': return addLocation();
      case 'toggle-theme': db.theme = db.theme === 'dark' ? 'light' : 'dark'; saveDb(); return renderApp();
      case 'about': return openModal(`${modalHead('Aluvision Lighting Control', 'OVER DE APP')}<div class="card"><h2>Volledige directe app</h2><p class="sub">Home, zones, groepen, scènes, presets en receivers worden lokaal op dit toestel bewaard. Live bediening gaat rechtstreeks via Bluetooth en ESP-NOW, zonder Mac.</p></div>`);
      default: return undefined;
    }
  }

  document.addEventListener('click', (event) => {
    const pageButton = event.target.closest('[data-page]');
    if (pageButton) { navigate(pageButton.dataset.page); return; }
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) handleAction(actionButton.dataset.action, actionButton);
  });

  document.addEventListener('input', (event) => {
    const setting = event.target.dataset.setting;
    if (setting) {
      setGroupSetting(setting, event.target.value);
      const output = event.target.closest('.setting-card')?.querySelector('output');
      if (output) output.textContent = `${Math.round(Number(event.target.value))}${setting === 'brightness' || setting === 'smooth' || setting === 'spacing' ? '%' : setting === 'widthPixels' ? ' px' : setting === 'lineDelayMs' ? ' ms' : ''}`;
    }
    if (event.target.matches('[data-action="calibrate-pixels"]')) {
      const receiver = connectedReceiver();
      if (!receiver || receiver.type !== 'SPI') return;
      receiver.pixels = clamp(event.target.value, 1, 1024); saveDb();
      if ($('setupPixelOutput')) $('setupPixelOutput').textContent = String(receiver.pixels);
      scheduleCalibration(receiver);
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.dataset.setting === 'hex') {
      const value = String(event.target.value).trim().toUpperCase();
      if (!/^#[0-9A-F]{6}$/.test(value)) { showToast('Gebruik een kleur zoals #FF453A', true); return renderApp(); }
      setGroupSetting('hex', value, true); renderApp();
    }
  });

  function nextId() {
    sequence = (sequence + 1) % 2147483000;
    if (!sequence) sequence = 1;
    return sequence;
  }

  function parseFields(text) {
    const result = {};
    String(text || '').trim().split(';').forEach((part) => {
      const index = part.indexOf('=');
      if (index > 0) result[part.slice(0, index).trim().toUpperCase()] = part.slice(index + 1).trim();
    });
    return result;
  }

  function bytesToString(value) {
    const view = value instanceof DataView ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : new Uint8Array(value.buffer || value);
    return decoder.decode(view);
  }

  function friendlyError(error) {
    const name = String(error?.name || '');
    const message = String(error?.message || error || 'Onbekende fout');
    if (name === 'NotFoundError') return 'Geen receiver gekozen.';
    if (name === 'SecurityError' || /security|bluetooth.*available/i.test(message)) return 'Open deze GitHub-link op iPhone in Bluefy om Bluetooth te gebruiken.';
    if (/PAIR_DENIED/i.test(message)) return 'De veilige koppeltijd is verstreken. Activeer koppelen op de receiver en probeer opnieuw.';
    if (/AUTH_REQUIRED/i.test(message)) return 'Deze receiver hoort nog bij een andere installatie. Activeer koppelen en probeer opnieuw.';
    if (/GATT|NetworkError|disconnected|connect/i.test(message)) return 'Bluetoothverbinding mislukt. Breng de receiver opnieuw in koppelmodus.';
    if (/timeout/i.test(message)) return 'De receiver antwoordde niet op tijd.';
    return message;
  }

  function onStatusNotification(event) {
    notificationBuffer += bytesToString(event.target.value);
    if (notificationBuffer.length > 5000) notificationBuffer = notificationBuffer.slice(-2500);
    let newline = notificationBuffer.indexOf('\n');
    while (newline >= 0) {
      const message = notificationBuffer.slice(0, newline).replace(/\r/g, '').trim();
      notificationBuffer = notificationBuffer.slice(newline + 1);
      if (message) receiveMessage(message);
      newline = notificationBuffer.indexOf('\n');
    }
  }

  function receiveMessage(message) {
    const fields = parseFields(message);
    const id = Number(fields.ID || 0);
    if (id && ackWaiters.has(id)) {
      const waiter = ackWaiters.get(id);
      ackWaiters.delete(id);
      clearTimeout(waiter.timer);
      waiter.resolve(fields);
    }
    if (fields.FWVER || fields.PHYSICAL || fields.DEVTYPE) {
      ble.statusFields = { ...ble.statusFields, ...fields };
      if (fields.DEVTYPE === 'RGBW' || fields.DEVTYPE === 'SPI') ble.type = fields.DEVTYPE;
      if (ble.type === 'SPI' && Number(fields.PHYSICAL) > 0) ble.physical = clamp(fields.PHYSICAL, 1, 1024);
      if (fields.PHYSICALREVERSE !== undefined) ble.physicalReverse = fields.PHYSICALREVERSE === '1';
      if (Number(fields.PORTMASK) > 0) ble.portMask = clamp(fields.PORTMASK, 1, 3);
    }
  }

  function waitForAck(id, timeoutMs = 2400) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { ackWaiters.delete(id); reject(new Error('Receiver timeout')); }, timeoutMs);
      ackWaiters.set(id, { resolve, reject, timer });
    });
  }

  async function writeCommand(text) {
    if (!ble.connected || !ble.command) throw new Error('Bluetooth disconnected');
    const bytes = encoder.encode(`${text}\n`);
    for (let offset = 0; offset < bytes.length; offset += MAX_WRITE_BYTES) {
      const chunk = bytes.slice(offset, offset + MAX_WRITE_BYTES);
      if (typeof ble.command.writeValueWithoutResponse === 'function') await ble.command.writeValueWithoutResponse(chunk);
      else if (typeof ble.command.writeValue === 'function') await ble.command.writeValue(chunk);
      else await ble.command.writeValueWithResponse(chunk);
      if (bytes.length > MAX_WRITE_BYTES) await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  async function transactNow(fields, timeoutMs = 2400, allowError = false) {
    const id = nextId();
    const ordered = { V: 18, TYPE: fields.TYPE, ID: id, ...fields };
    const command = Object.entries(ordered).filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => `${key}=${value}`).join(';');
    const reply = waitForAck(id, timeoutMs);
    try {
      await writeCommand(command);
      const answer = await reply;
      if (!allowError && answer.STATUS === 'ERROR') throw new Error(answer.DETAIL || 'Receiver error');
      return answer;
    } catch (error) {
      const waiter = ackWaiters.get(id);
      if (waiter) { clearTimeout(waiter.timer); ackWaiters.delete(id); }
      throw error;
    }
  }

  function transact(fields, timeoutMs = 2400, allowError = false) {
    const run = () => transactNow(fields, timeoutMs, allowError);
    const queued = transactionTail.then(run, run);
    transactionTail = queued.catch(() => {});
    return queued;
  }

  async function readInfo() { return parseFields(bytesToString(await ble.info.readValue())); }

  async function pairReceiver(info, existing) {
    const token = String(info.TOKEN || '').toUpperCase();
    if (!/^[0-9A-F]{16}$/.test(token)) {
      if (existing && info.PAIRED === '1') return existing;
      throw new Error('PAIR_DENIED');
    }
    const number = existing?.number || db.nextNumber;
    const fields = { TYPE: 'PAIR', TOKEN: token, NETWORK: db.installationKey, NUMBER: clamp(number, 1, 250) };
    if (info.DEVTYPE === 'RGBW') fields.PORTMASK = clamp(info.PORTMASK || 3, 1, 3);
    const reply = await transact(fields, 3800, true);
    const replyRid = String(reply.RID || reply.TARGETRID || '').toUpperCase();
    const exactModernPair = reply.STATUS === 'OK' && reply.DETAIL === 'PAIRED' && reply.PAIRED === '1' && replyRid === String(info.RID).toUpperCase();
    const committedLegacyPair = reply.STATUS === 'ERROR' && reply.DETAIL === 'PAIRED' && reply.PAIRED === '1' && replyRid === String(info.RID).toUpperCase();
    if (!exactModernPair && !committedLegacyPair) throw new Error(reply.DETAIL || 'PAIR_DENIED');
    ble.number = Number(reply.NUMBER || number) || number;
    db.nextNumber = Math.min(250, Math.max(db.nextNumber, ble.number + 1));
    return reply;
  }

  async function refreshStatus() {
    const request = ble.type === 'RGBW' ? { TYPE: 'STATUS' } : { TYPE: 'STATUS', TARGET: ble.rid, DEVTYPE: 'SPI' };
    const fields = await transact(request, 3300);
    receiveMessage(Object.entries(fields).map(([key, value]) => `${key}=${value}`).join(';'));
    return fields;
  }

  function registerConnectedReceiver(info) {
    const existing = db.receivers[ble.rid];
    const receiver = existing || { id: ble.rid, rid: ble.rid, number: ble.number, name: `Receiver ${ble.number}` };
    Object.assign(receiver, {
      type: ble.type,
      pixels: ble.type === 'SPI' ? clamp(ble.physical || receiver.pixels || 60, 1, 1024) : 1,
      physicalReverse: ble.type === 'SPI' ? Boolean(ble.physicalReverse) : false,
      portMask: ble.portMask,
      port1Rid: ble.endpointRids[1],
      port2Rid: ble.endpointRids[2],
      firmware: ble.statusFields.FWVER || ble.statusFields.BUILD || receiver.firmware || '',
      lastSeen: new Date().toISOString()
    });
    db.receivers[ble.rid] = receiver;
    if (!assignedGroup(receiver.id)) {
      let target = allGroups().find(({ group }) => group.type === receiver.type && !group.receiverIds.length);
      if (!target) target = allGroups().find(({ group }) => group.type === receiver.type);
      if (target) target.group.receiverIds.push(receiver.id);
    }
    saveDb();
    return receiver;
  }

  async function connectReceiver() {
    if (!navigator.bluetooth) {
      closeModal();
      showToast('Open deze link in Bluefy om Bluetooth te gebruiken.', true);
      return;
    }
    if (ble.device?.gatt?.connected) {
      ble.device.removeEventListener('gattserverdisconnected', onDisconnected);
      ble.device.gatt.disconnect();
      ble.connected = false;
    }
    setBusy(true, 'Receiver zoeken…');
    try {
      const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [UUIDS.service] }], optionalServices: [UUIDS.service] });
      device.addEventListener('gattserverdisconnected', onDisconnected);
      setBusy(true, 'Veilig verbinden…');
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(UUIDS.service);
      const [command, status, infoCharacteristic] = await Promise.all([
        service.getCharacteristic(UUIDS.command), service.getCharacteristic(UUIDS.status), service.getCharacteristic(UUIDS.info)
      ]);
      Object.assign(ble, { device, server, command, status, info: infoCharacteristic, connected: true });
      notificationBuffer = '';
      status.addEventListener('characteristicvaluechanged', onStatusNotification);
      await status.startNotifications();
      const info = await readInfo();
      if (!/^[0-9A-F]{16}$/i.test(info.RID || '')) throw new Error('Ongeldige receiveridentiteit');
      ble.statusFields = { ...info };
      ble.rid = String(info.RID).toUpperCase();
      ble.type = info.DEVTYPE === 'RGBW' ? 'RGBW' : 'SPI';
      ble.number = Number(info.NUMBER) || db.receivers[ble.rid]?.number || db.nextNumber;
      ble.physical = clamp(info.PHYSICAL || db.receivers[ble.rid]?.pixels || 60, 1, 1024);
      ble.physicalReverse = info.PHYSICALREVERSE === '1';
      ble.portMask = clamp(info.PORTMASK || db.receivers[ble.rid]?.portMask || 3, 1, 3);
      ble.endpointRids = {
        1: String(info.PORT1RID || info.RID1 || db.receivers[ble.rid]?.port1Rid || '').toUpperCase(),
        2: String(info.PORT2RID || info.RID2 || db.receivers[ble.rid]?.port2Rid || '').toUpperCase()
      };
      const existing = db.receivers[ble.rid];
      if (!existing || info.TOKEN || info.PAIRED !== '1') {
        setBusy(true, 'Receiver koppelen…');
        await pairReceiver(info, existing);
      }
      ble.key = db.installationKey;
      setBusy(true, 'Verbinding controleren…');
      await refreshStatus();
      const receiver = registerConnectedReceiver(info);
      setBusy(false); closeModal(); renderApp(); openReceiverSetup(receiver.id);
      showToast(`Receiver ${receiver.number} is live verbonden`);
    } catch (error) {
      setBusy(false);
      if (ble.device?.gatt?.connected) ble.device.gatt.disconnect();
      ble.connected = false;
      renderApp();
      showToast(friendlyError(error), true);
    }
  }

  function onDisconnected() {
    ble.connected = false;
    ackWaiters.forEach((waiter) => { clearTimeout(waiter.timer); waiter.reject(new Error('Bluetooth disconnected')); });
    ackWaiters.clear();
    renderApp();
    showToast('Bluetoothverbinding gesloten', true);
  }

  function disconnectReceiver() {
    if (ble.device?.gatt?.connected) ble.device.gatt.disconnect();
    else onDisconnected();
  }

  function hexToRgb(hex) {
    const clean = String(hex || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(clean)) return [255, 69, 58];
    return [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16));
  }

  function rgbToHex(r, g, b) { return `#${[r,g,b].map((value) => clamp(Math.round(value),0,255).toString(16).padStart(2,'0')).join('')}`.toUpperCase(); }
  function wireColour(state, slot) {
    const [r,g,b] = state.rgbEnabled ? hexToRgb(state.colours[slot] || state.colours[0]) : [0,0,0];
    const white = state.whiteEnabled ? Math.round(state.white) : 0;
    return `${r},${g},${b},${white}`;
  }

  const phaseClocks = new Map();
  function sharedPhaseMs(group) {
    const existing = phaseClocks.get(group.id);
    if (!existing || existing.restartToken !== group.state.restartToken) {
      phaseClocks.set(group.id, { restartToken: group.state.restartToken, started: performance.now() });
      return 0;
    }
    return Math.max(0, Math.round(performance.now() - existing.started));
  }

  function effectMotionReverse(state) {
    const requested = state.direction === 'left';
    return ['GRADIENT','ALTERNATE'].includes(state.engine) ? !requested : requested;
  }

  function buildLiveFields(group, target, index, targets, phaseMs) {
    const state = group.state;
    const pureWarm = state.engine === 'WARM';
    const colours = pureWarm ? ['0,0,0,235','0,0,0,0','0,0,0,0','0,0,0,0'] : [0,1,2,3].map((slot) => wireColour(state, slot));
    const continuousPixels = Math.max(1, targets.reduce((sum, item) => sum + item.pixels, 0));
    const groupPixels = group.type === 'SPI'
      ? (group.layout === 'parallel' ? Math.max(1, target.pixels) : continuousPixels)
      : 1;
    const physicalReverse = Boolean(target.receiver.physicalReverse);
    const motionReverse = effectMotionReverse(state);
    const fields = {
      TYPE: 'LIVE', KEY: db.installationKey, TARGET: target.rid, DEVTYPE: group.type,
      SCENE: state.power ? (state.mode === 'static' ? (group.type === 'RGBW' ? 'RGBW_SOLID' : 'STATIC') : state.engine) : (group.type === 'RGBW' ? 'RGBW_SOLID' : 'STATIC'),
      VARIANT: state.mode === 'animation' ? state.variant : 0,
      FG: state.power ? colours[0] : '0,0,0,0', FG2: state.power ? colours[1] : '0,0,0,0',
      FG3: state.power ? colours[2] : '0,0,0,0', FG4: state.power ? colours[3] : '0,0,0,0',
      COLORS: state.mode === 'animation' ? clamp(state.colourCount,1,4) : 1,
      BG: state.backgroundOn ? `${hexToRgb(state.background).join(',')},0` : '0,0,0,0', BGON: state.backgroundOn ? 1 : 0,
      SPEED: state.speed, SMOOTH: state.smooth, BRIGHT: state.power ? state.brightness : 0, BGBRIGHT: 0,
      SPACING: state.spacing, COUNT: state.objectCount, TRAIL: state.trail, SPREAD: state.spread,
      RANDOM: 16, BOUNCE: state.engine === 'SCANNER' ? 1 : 0, MIRROR: state.engine === 'MIRROR' ? 1 : 0,
      LINEDELAYMS: clamp(state.lineDelayMs,0,5080), LINEINDEX: group.layout === 'parallel' ? index : 0, LINECOUNT: group.layout === 'parallel' ? targets.length : 1,
      PARALLEL: group.layout === 'parallel' ? 1 : 0, RESTART: state.restartToken,
      POWER: 100, WHITEMIX: 0, TRANSITIONMS: 70, PHASEMS: phaseMs, TEST: 'NONE'
    };
    if (group.type === 'RGBW') fields.PORT = target.port;
    else {
      let offset = 0;
      for (let targetIndex = 0; targetIndex < index; targetIndex++) offset += targets[targetIndex].pixels;
      fields.WIDTH = Math.round(clamp(state.widthPixels / groupPixels * 100, 1, 100));
      fields.WIDTHPX = clamp(state.widthPixels, 1, groupPixels);
      fields.PIXELS = groupPixels; fields.GROUPPIXELS = groupPixels; fields.OFFSET = group.layout === 'continuous' ? offset : 0;
      fields.MOTIONREVERSE = motionReverse ? 1 : 0;
      fields.PHYSICALREVERSE = physicalReverse ? 1 : 0;
      fields.REVERSE = physicalReverse !== motionReverse ? 1 : 0;
    }
    return fields;
  }

  function assertExactAck(fields, targetRid, allowPending = false) {
    if (fields.STATUS !== 'OK') throw new Error(fields.DETAIL || 'Receiver error');
    const expected = String(targetRid || '').toUpperCase();
    const returned = String(fields.TARGETRID || fields.RID || '').toUpperCase();
    const delivery = String(fields.TARGETACK || '').toUpperCase();
    if (expected && returned && returned !== expected) throw new Error('Receiver bevestigde een ander doel');
    const accepted = allowPending
      ? ['1','DIRECT','OK','DELIVERED','PENDING','QUEUED']
      : ['1','DIRECT','OK','DELIVERED'];
    if (expected && delivery && !accepted.includes(delivery)) throw new Error('Live signaal niet bevestigd');
  }

  async function sendGroupState(group) {
    if (!ble.connected) return false;
    const targets = lineTargets(group);
    if (!targets.length) return false;
    const phaseMs = sharedPhaseMs(group);
    for (let index = 0; index < targets.length; index++) {
      const fields = buildLiveFields(group, targets[index], index, targets, phaseMs);
      const reply = await transact(fields, 2800);
      // A gateway acknowledges a relayed LIVE immediately as PENDING while
      // ESP-NOW delivers the latest state. This is accepted transport, not a
      // durable satellite confirmation; CONFIG/SAVE keep their stricter path.
      assertExactAck(reply, targets[index].rid, true);
    }
    return true;
  }

  function scheduleGroupLive(group, immediate = false) {
    if (!group) return;
    liveDirtyGroups.add(group.id);
    clearTimeout(liveTimer);
    liveTimer = setTimeout(flushGroupLive, immediate ? 0 : 65);
  }

  async function flushGroupLive() {
    if (liveSending || !ble.connected) return;
    liveSending = true;
    document.querySelectorAll('.live-label').forEach((item) => item.classList.add('sending'));
    try {
      while (liveDirtyGroups.size && ble.connected) {
        const ids = [...liveDirtyGroups];
        liveDirtyGroups.clear();
        for (const id of ids) {
          const found = findGroupById(id);
          if (found) await sendGroupState(found.group);
        }
      }
    } catch (error) {
      showToast(friendlyError(error), true);
    } finally {
      liveSending = false;
      document.querySelectorAll('.live-label').forEach((item) => item.classList.remove('sending'));
      if (liveDirtyGroups.size && ble.connected) liveTimer = setTimeout(flushGroupLive, 45);
    }
  }

  async function identifyReceiver(id) {
    const receiver = receiverFor(id);
    if (!receiver) return;
    if (!ble.connected) return showToast('Verbind eerst één receiver via Bluetooth', true);
    try {
      if (receiver.type === 'RGBW') {
        const targets = lineTargets({ receiverIds:[id], type:'RGBW' });
        for (const target of targets) {
          const reply = await transact({ TYPE:'LIVE', KEY:db.installationKey, TARGET:target.rid, DEVTYPE:'RGBW', PORT:target.port, TEST:'IDENTIFY' }, 2500);
          assertExactAck(reply,target.rid,true);
        }
      } else {
        const reply = await transact({ TYPE:'LIVE', KEY:db.installationKey, TARGET:receiver.rid, DEVTYPE:'SPI', TEST:'IDENTIFY', PIXELS:receiver.pixels, GROUPPIXELS:receiver.pixels, OFFSET:0 },2500);
        assertExactAck(reply,receiver.rid,true);
      }
      showToast(`LED Line van receiver ${receiver.number} knippert`);
    } catch (error) { showToast(friendlyError(error),true); }
  }

  let calibrationTimer = 0;
  function scheduleCalibration(receiver) {
    clearTimeout(calibrationTimer);
    calibrationTimer = setTimeout(async () => {
      if (!ble.connected || ble.rid !== receiver.rid) return;
      try {
        await transact({ TYPE:'LIVE', KEY:db.installationKey, TARGET:receiver.rid, DEVTYPE:'SPI', TEST:'FILL', PHYSICAL:receiver.pixels, PIXELS:receiver.pixels, GROUPPIXELS:receiver.pixels, OFFSET:0, PHYSICALREVERSE:receiver.physicalReverse ? 1 : 0 },2600,true);
      } catch (error) { showToast(friendlyError(error),true); }
    },70);
  }

  function hexToHsv(hex) {
    const [red,green,blue] = hexToRgb(hex).map((value) => value / 255);
    const max = Math.max(red,green,blue), min = Math.min(red,green,blue), delta = max-min;
    let hue = 0;
    if (delta) {
      if (max === red) hue = 60 * (((green-blue)/delta)%6);
      else if (max === green) hue = 60 * ((blue-red)/delta+2);
      else hue = 60 * ((red-green)/delta+4);
    }
    return { h:(hue+360)%360, s:max ? delta/max : 0, v:max };
  }

  function hsvToHex(hue, saturation, value = 1) {
    const chroma = value*saturation;
    const x = chroma*(1-Math.abs((hue/60)%2-1));
    const match = value-chroma;
    let red=0,green=0,blue=0;
    if (hue<60) [red,green]=[chroma,x];
    else if (hue<120) [red,green]=[x,chroma];
    else if (hue<180) [green,blue]=[chroma,x];
    else if (hue<240) [green,blue]=[x,chroma];
    else if (hue<300) [red,blue]=[x,chroma];
    else [red,blue]=[chroma,x];
    return rgbToHex((red+match)*255,(green+match)*255,(blue+match)*255);
  }

  function bindColourWheel() {
    const wheel = document.querySelector('[data-colour-wheel]');
    const group = activeGroup();
    if (!wheel || !group) return;
    const updatePointer = () => {
      const hsv = hexToHsv(group.state.colours[group.state.activeSlot || 0]);
      const radius = hsv.s*50;
      const angle = hsv.h*Math.PI/180;
      const pointer = wheel.querySelector('.wheel-pointer');
      pointer.style.left = `${50+Math.cos(angle)*radius}%`;
      pointer.style.top = `${50+Math.sin(angle)*radius}%`;
      pointer.style.setProperty('--pointer',group.state.colours[group.state.activeSlot || 0]);
    };
    const setFromEvent = (event) => {
      const box = wheel.getBoundingClientRect();
      const x = event.clientX-box.left-box.width/2;
      const y = event.clientY-box.top-box.height/2;
      const hue = (Math.atan2(y,x)*180/Math.PI+360)%360;
      const saturation = Math.min(1,Math.hypot(x,y)/(box.width/2));
      group.state.colours[group.state.activeSlot || 0] = hsvToHex(hue,saturation,1);
      saveDb(); scheduleGroupLive(group); updatePointer();
      const selected = document.querySelector('.selected-colour');
      const field = document.querySelector('[data-setting="hex"]');
      if (selected) selected.style.background = group.state.colours[group.state.activeSlot || 0];
      if (field) field.value = group.state.colours[group.state.activeSlot || 0];
    };
    let dragging = false;
    wheel.addEventListener('pointerdown',(event) => { dragging=true; wheel.setPointerCapture(event.pointerId); setFromEvent(event); });
    wheel.addEventListener('pointermove',(event) => { if (dragging) setFromEvent(event); });
    wheel.addEventListener('pointerup',() => { dragging=false; scheduleGroupLive(group,true); });
    wheel.addEventListener('pointercancel',() => { dragging=false; });
    wheel.addEventListener('keydown',(event) => {
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const hsv=hexToHsv(group.state.colours[group.state.activeSlot || 0]);
      if (event.key==='ArrowLeft') hsv.h=(hsv.h+357)%360;
      if (event.key==='ArrowRight') hsv.h=(hsv.h+3)%360;
      if (event.key==='ArrowUp') hsv.s=Math.min(1,hsv.s+.03);
      if (event.key==='ArrowDown') hsv.s=Math.max(0,hsv.s-.03);
      group.state.colours[group.state.activeSlot || 0]=hsvToHex(hsv.h,hsv.s,1); saveDb(); scheduleGroupLive(group); updatePointer();
    });
    updatePointer();
  }

  function mixColours(a,b,amount) { return a.map((value,index) => value+(b[index]-value)*amount); }
  function paletteSample(state, position) {
    const count=clamp(state.colourCount||1,1,4);
    if (count===1) return hexToRgb(state.colours[0]);
    const wrapped=((position%1)+1)%1;
    const scaled=wrapped*count;
    const first=Math.floor(scaled)%count;
    const second=(first+1)%count;
    const amount=scaled-Math.floor(scaled);
    return mixColours(hexToRgb(state.colours[first]),hexToRgb(state.colours[second]),amount);
  }

  function visiblePreviewColour(state,rgb,amount=1) {
    let channels=state.rgbEnabled ? rgb.slice() : [0,0,0];
    if (state.whiteEnabled) {
      const warm=[255,224,184], white=clamp(state.white,0,255)/255;
      channels=channels.map((value,index)=>Math.min(255,value+warm[index]*white));
    }
    const gain=(state.power ? state.brightness/100 : 0)*clamp(amount,0,1);
    return channels.map((value)=>Math.round(value*gain));
  }

  function smoothStep(edge0,edge1,value) {
    const amount=clamp((value-edge0)/(edge1-edge0||1),0,1);
    return amount*amount*(3-2*amount);
  }

  function previewSample(state,u,time,lineIndex=0,lines=1,pixels=25) {
    if (!state.power) return [28,29,28];
    if (state.mode==='static' || state.engine==='STATIC') return visiblePreviewColour(state,hexToRgb(state.colours[0]),1);
    if (state.engine==='WARM') {
      const pulse=.68+.32*Math.sin(time*.00032*(state.speed+4))**2;
      return visiblePreviewColour({...state,rgbEnabled:false,whiteEnabled:true,white:Math.max(235,state.white)},[0,0,0],pulse);
    }
    const cycles=.012*Math.pow(34,clamp(state.speed,1,100)/100);
    const timeline=time/1000*cycles;
    const direction=state.direction==='left' ? -1 : 1;
    const lineDelay=clamp(state.lineDelayMs,0,5080)/1000*cycles;
    const order=state.variant===95 ? Math.abs(lineIndex-(lines-1)/2) : state.variant===14 ? (lines-1)/2-Math.abs(lineIndex-(lines-1)/2) : direction>0 ? lineIndex : lines-1-lineIndex;
    const linePhase=timeline-order*lineDelay;
    if (state.variant>=98 && state.variant<=102) {
      const phase=((linePhase%1)+1)%1;
      let amount=1,colour=paletteSample(state,phase);
      if (state.variant===98) amount=.12+.88*(.5-.5*Math.cos(phase*Math.PI*2));
      if (state.variant===99) amount=.28+.72*(.5-.5*Math.cos(phase*Math.PI*2));
      if (state.variant===102) amount=phase<.16?1:.08;
      return visiblePreviewColour(state,colour,amount);
    }
    if (state.variant>=90 || state.receiverType==='RGBW' && state.variant>=9) {
      const phase=((linePhase%1)+1)%1;
      let amount=.14+.86*(.5-.5*Math.cos(phase*Math.PI*2));
      if (state.engine==='ALTERNATE') amount=((Math.floor(timeline*2)+lineIndex)%2) ? .12 : 1;
      if (state.engine==='SPARKLE') amount=phase<.2?1:.07;
      return visiblePreviewColour(state,paletteSample(state,phase),amount);
    }
    if (state.receiverType==='RGBW') {
      const phase=((timeline%1)+1)%1;
      const amount=state.engine==='SPARKLE' ? (phase<.18?1:.06) : .2+.8*(.5-.5*Math.cos(phase*Math.PI*2));
      return visiblePreviewColour(state,paletteSample(state,phase),amount);
    }
    const phase=((u-direction*timeline)%1+1)%1;
    const width=clamp(state.widthPixels,1,pixels)/pixels;
    let amount=.06,colour=paletteSample(state,u+timeline);
    if (['CHASE','COMET','SCANNER','DUAL','MIRROR'].includes(state.engine)) {
      let distance=Math.min(phase,1-phase);
      if (state.engine==='DUAL') distance=Math.min(distance,Math.abs(phase-.5));
      if (state.engine==='MIRROR') distance=Math.abs(Math.abs(u-.5)-((timeline*.7)%.5));
      const edge=Math.max(.012,width);
      amount=1-smoothStep(edge,edge+Math.max(.015,(100-state.smooth)/180),distance);
      if (state.engine==='COMET') amount=Math.max(amount,Math.max(0,1-phase*5)*.65);
    } else if (state.engine==='WAVE') amount=.18+.82*(.5+.5*Math.sin((u*2-direction*timeline)*Math.PI*2));
    else if (state.engine==='BREATHE') amount=.18+.82*(.5-.5*Math.cos(timeline*Math.PI*2));
    else if (state.engine==='SPARKLE') amount=((Math.sin((u*937+Math.floor(timeline*18))*12.9898)*43758.5453)%1)>.72?1:.08;
    else if (state.engine==='GRADIENT'||state.engine==='FLOW') { amount=.9; colour=paletteSample(state,u+direction*timeline); }
    return visiblePreviewColour(state,colour,amount);
  }

  function ensurePreviewMarkup(container,group) {
    const rows=group.layout==='parallel'?Math.min(8,lineCount(group)):1;
    const orientation=group.layout==='parallel'&&group.orientation==='vertical'?'vertical':'horizontal';
    if (container.dataset.rows===String(rows)&&container.dataset.orientation===orientation) return;
    container.dataset.rows=String(rows); container.dataset.orientation=orientation;
    container.innerHTML=`<div class="preview-lines ${orientation}">${Array.from({length:rows},(_,row)=>`<div class="preview-line ${orientation==='vertical'?'vertical':''}" data-preview-row="${row}">${Array.from({length:orientation==='vertical'?18:32},(_,index)=>`<i data-preview-pixel="${index}"></i>`).join('')}</div>`).join('')}</div>`;
  }

  function paintPreviews(time) {
    document.querySelectorAll('[data-preview-group]').forEach((container)=>{
      const found=findGroupById(container.dataset.previewGroup);
      if (!found) return;
      const group=found.group;
      ensurePreviewMarkup(container,group);
      const rows=Number(container.dataset.rows)||1;
      container.querySelectorAll('[data-preview-row]').forEach((line)=>{
        const row=Number(line.dataset.previewRow)||0;
        const pixels=[...line.querySelectorAll('[data-preview-pixel]')];
        pixels.forEach((pixel,index)=>{
          const colour=previewSample(group.state,(index+.5)/pixels.length,time,row,rows,totalPixels(group));
          const css=`rgb(${colour.join(',')})`;
          pixel.style.background=css;
          pixel.style.boxShadow=Math.max(...colour)>70?`0 0 11px rgba(${colour.join(',')},.65)`:'none';
        });
      });
    });
  }

  function previewLoop(time) {
    if (time-previewLast>32) { previewLast=time; paintPreviews(time); }
    previewFrame=requestAnimationFrame(previewLoop);
  }

  if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
  renderApp();
  previewFrame=requestAnimationFrame(previewLoop);
})();
