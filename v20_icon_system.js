/* Aluvision V20 icon system.
 *
 * The application used a mixture of font-dependent Unicode symbols. That made
 * the same control look different in Safari, Chrome and the embedded receiver
 * app. This layer replaces customer-facing navigation and structure symbols
 * with one deterministic, scalable SVG family.
 */
(() => {
  'use strict';

  const paths = Object.freeze({
    home: '<path d="M3.5 10.8 12 3.6l8.5 7.2"/><path d="M5.5 9.5V21h13V9.5M9.5 21v-6h5v6"/>',
    zone: '<path d="M4 3h16v18H4z"/><path d="M4 10h7V3M11 14h9M11 14v7"/>',
    group: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    light: '<rect x="3" y="8" width="18" height="8" rx="2"/><path d="M6 12h.01M9 12h.01M12 12h.01M15 12h.01M18 12h.01" stroke-width="2.6"/><path d="M7 5V3M12 5V2M17 5V3M7 19v2M12 19v3M17 19v2"/>',
    animation: '<path d="M3 13h3l2.1-6 4 10 3-7 2.1 3H21"/><path d="m17.5 4 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    colours: '<path d="M12 3a9 9 0 1 0 0 18h1.2a2 2 0 0 0 0-4H12a1.7 1.7 0 0 1 0-3.4h2.5A6.5 6.5 0 0 0 21 7.1C21 4.8 17 3 12 3Z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="9" cy="6.8" r="1"/><circle cx="14" cy="6.5" r="1"/>',
    ledlines: '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M6 7h.01M9 7h.01M12 7h.01M15 7h.01M18 7h.01M6 17h.01M9 17h.01M12 17h.01M15 17h.01M18 17h.01" stroke-width="2.6"/>',
    scenes: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m4.5 12 7.5 4 7.5-4M4.5 16l7.5 4 7.5-4"/>',
    preset: '<path d="M6 3h12v18l-6-3.7L6 21z"/><path d="m12 7 .8 1.7 1.9.2-1.4 1.3.4 1.8-1.7-.9-1.7.9.4-1.8-1.4-1.3 1.9-.2z"/>',
    studio: '<path d="M4 6h7M15 6h5M4 12h3M11 12h9M4 18h10M18 18h2"/><circle cx="13" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
    receiver: '<rect x="5" y="7" width="14" height="12" rx="2"/><path d="M9 7V4m6 3V4M9 12h6M9 15h3"/><circle cx="16" cy="15" r="1"/>',
    receiverPlus: '<rect x="3.5" y="8" width="12" height="10" rx="2"/><path d="M7 8V5m5 3V5M7 13h5M19 9v8M15 13h8"/>',
    academy: '<path d="m3 9 9-5 9 5-9 5z"/><path d="M7 12v4c2.7 2 7.3 2 10 0v-4M21 9v6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2M12 19.2v2M21.2 12h-2M4.8 12h-2M18.5 5.5 17 7M7 17l-1.5 1.5M18.5 18.5 17 17M7 7 5.5 5.5"/><circle cx="12" cy="12" r="7"/>',
    more: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    location: '<path d="M4 21V7l8-4 8 4v14M2 21h20"/><path d="M8 9h2M14 9h2M8 13h2M14 13h2M10 21v-4h4v4"/>',
    chevronDown: '<path d="m7 9.5 5 5 5-5"/>',
    chevronUp: '<path d="m7 14.5 5-5 5 5"/>',
    power: '<path d="M12 2.8v8"/><path d="M7.3 5.4a8 8 0 1 0 9.4 0"/>',
    zonePlus: '<path d="M3.5 4h10v10h-10zM3.5 9h5V4M8.5 11h5"/><path d="M18 12v9M13.5 16.5h9"/>',
    groupPlus: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7M14 17.5h7"/>'
  });

  const style = document.createElement('style');
  style.dataset.releaseLayer = 'icon-system';
  style.textContent = `
    .alv-icon{display:block;width:100%;height:100%;overflow:visible;pointer-events:none}
    [data-alv-icon]{line-height:0}
    .nav>button>i[data-alv-icon]{display:grid;place-items:center}
    .nav>button>i[data-alv-icon]>.alv-icon{width:21px;height:21px}
    .v1814-group-nav button>i[data-alv-icon]>.alv-icon{width:16px;height:16px}
    .customer-zone-icon[data-alv-icon]>.alv-icon,.customer-zone-detail-icon[data-alv-icon]>.alv-icon,
    .v18152-zone-scope-mark[data-alv-icon]>.alv-icon{width:24px;height:24px}
    .customer-location-mark[data-alv-icon]>.alv-icon,.v18152-location-mark[data-alv-icon]>.alv-icon,
    .v1814-all-scope-badge>i[data-alv-icon]>.alv-icon{width:19px;height:19px}
    .utility-menu-mark[data-alv-icon]>.alv-icon{width:25px;height:25px}
    .utility-action-icon[data-alv-icon]>.alv-icon{width:23px;height:23px}
    .utility-preset-note>i[data-alv-icon]>.alv-icon{width:18px;height:18px}
    .v188-structure-route i[data-alv-icon]>.alv-icon{width:17px;height:17px;margin:auto}
    .v20-review-map i[data-alv-icon]>.alv-icon{width:22px;height:22px;margin:auto}
    .alv-home-scope-note>i[data-alv-icon]>.alv-icon,.alv-manage-summary>i[data-alv-icon]>.alv-icon{width:22px;height:22px;margin:auto}
    .active-context-icon[data-alv-icon]>.alv-icon,.group-card-active-note>i[data-alv-icon]>.alv-icon,
    .active-group-modal-banner>i[data-alv-icon]>.alv-icon{width:17px;height:17px}
    .alv-title-with-icon{display:flex!important;align-items:center;gap:9px}
    .alv-title-icon{display:inline-grid;place-items:center;flex:0 0 auto;width:29px;height:29px;border-radius:9px;background:var(--panel-2);color:var(--ink)}
    .alv-title-icon>.alv-icon{width:18px;height:18px}
    .customer-group-explorer.is-active .alv-group-icon{background:var(--red);color:#fff}
    .alv-group-page-icon{width:34px;height:34px;border-radius:11px;background:var(--red);color:#fff}
    .alv-group-page-icon>.alv-icon{width:20px;height:20px}
    .button.alv-icon-button{display:inline-flex;align-items:center;justify-content:center;gap:7px}
    .alv-button-icon{display:inline-grid;place-items:center;flex:0 0 18px;width:18px;height:18px}
    .alv-button-icon>.alv-icon{width:18px;height:18px}
    .v1814-home-action-chevron[data-alv-icon]>.alv-icon,.v1814-home-off-mark[data-alv-icon]>.alv-icon{width:15px;height:15px}
    .customer-device-empty>span[data-alv-icon]>.alv-icon{width:24px;height:24px}
    .customer-group-empty-preview{min-height:76px!important;height:auto!important;padding:10px 12px!important;gap:12px!important;overflow:hidden}
    .customer-group-empty-preview>.alv-empty-line-mark{position:relative;display:grid!important;place-items:center;flex:0 0 clamp(108px,42%,176px);width:clamp(108px,42%,176px)!important;height:50px!important;border:1px solid #ffffff18;border-radius:13px;background:repeating-linear-gradient(90deg,#30332f 0 8px,#151715 8px 11px),#101211;color:#fff!important;box-shadow:inset 0 1px #ffffff12,0 5px 14px #10121018}
    .customer-group-empty-preview>.alv-empty-line-mark>.alv-icon{width:35px!important;height:35px!important;padding:7px;border-radius:10px;background:#0a0c0be8;filter:drop-shadow(0 0 5px #fff5)}
    .customer-group-empty-preview>.alv-empty-line-mark:after{content:'+';position:absolute;right:6px;bottom:6px;display:grid;place-items:center;width:18px;height:18px;border-radius:6px;background:var(--red);color:#fff;font:900 14px/1 system-ui}
    .customer-group-empty-preview>span{min-width:0;max-width:190px;line-height:1.3;text-align:left}
    .customer-group-empty>i[data-alv-icon]{display:grid;place-items:center;width:46px!important;height:46px!important;margin:0 auto 10px;border-radius:14px;background:var(--panel-2);color:var(--red)}
    .customer-group-empty>i[data-alv-icon]>.alv-icon{width:23px!important;height:23px!important}
    .v188-empty-visual.scene.alv-scene-empty-visual{display:grid!important;grid-template-columns:minmax(0,1fr) 46px;align-items:center;gap:13px;width:min(100%,330px)!important;height:100px!important;margin:0 auto 15px!important;padding:14px!important;border:1px solid #ffffff14;border-radius:18px;background:radial-gradient(circle at 82% 22%,#c94e4620,transparent 35%),linear-gradient(145deg,#202220,#090a09)!important;box-shadow:inset 0 1px #ffffff12,0 10px 24px #1112;overflow:hidden}
    .alv-scene-cue-lines{display:grid;gap:7px;min-width:0}
    .alv-scene-cue-track{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:3px;height:17px;padding:3px;border:1px solid #ffffff0d;border-radius:7px;background:#050606;overflow:hidden}
    .alv-scene-cue-track>i{display:block;min-width:0;border-radius:3px;background:#ffffff12;animation:alvSceneRecall 5.4s ease-in-out infinite;animation-delay:calc(-1.85s + (var(--scene-row) * .38s) + (var(--scene-cell) * .055s))}
    .alv-scene-cue-track:nth-child(1){--scene-colour:#ff756a}.alv-scene-cue-track:nth-child(2){--scene-colour:#ffc174}.alv-scene-cue-track:nth-child(3){--scene-colour:#b8dcff}
    .alv-scene-cue-badge{position:relative;display:grid;place-items:center;width:46px;height:46px;border:1px solid #ffffff1c;border-radius:14px;background:#ffffff0b;color:#fff}
    .alv-scene-cue-badge>.alv-icon{width:25px;height:25px}
    .alv-scene-cue-badge>span{position:absolute;right:5px;bottom:5px;width:8px;height:8px;border:2px solid #151615;border-radius:50%;background:var(--red);box-shadow:0 0 10px var(--red);animation:alvSceneReady 5.4s ease-in-out -1.85s infinite}
    @keyframes alvSceneRecall{0%,12%,100%{background:#ffffff12;box-shadow:none;opacity:.55}34%,62%{background:var(--scene-colour);box-shadow:0 0 8px var(--scene-colour);opacity:1}82%{background:#ffffff16;box-shadow:none;opacity:.68}}
    @keyframes alvSceneReady{0%,43%,100%{transform:scale(.65);opacity:.38}57%,75%{transform:scale(1);opacity:1}}
    .v187-layout-grid>.alv-layout-choice{display:grid;grid-template-columns:minmax(0,1fr) 25px;gap:8px;align-items:center;min-width:0;padding:9px;background:var(--panel);color:var(--ink);white-space:normal;text-align:left}
    .v187-layout-grid>.alv-layout-choice>span{min-width:0;font-size:12px}
    .v187-layout-grid>.alv-layout-choice.on{border-color:var(--red);box-shadow:inset 0 0 0 1px var(--red);background:var(--panel)!important;color:var(--ink)!important}
    .v187-layout-demo.alv-layout-scene{display:block!important;position:relative;min-width:0;overflow:hidden;background:#111312!important}
    .alv-layout-scene>svg{display:block;width:100%;height:100%;overflow:hidden}
    .alv-layout-scene .alv-layout-rail{stroke:#414641;stroke-width:8;stroke-linecap:round}
    .alv-layout-scene .alv-layout-pixels{stroke:#707970;stroke-width:5;stroke-dasharray:1 7;stroke-linecap:round}
    .alv-layout-scene .alv-layout-number{font:700 10px system-ui;fill:#ccd2cc;text-anchor:middle}
    .alv-layout-scene .alv-layout-flow{stroke:#fff0d0;stroke-width:7;stroke-linecap:round;stroke-dasharray:15 170;animation:alvLayoutFlow 3.2s linear infinite}
    .alv-layout-scene .alv-layout-whole{stroke:#ffe4b3;stroke-width:8;stroke-linecap:round;animation:alvLayoutWhole 3.2s ease-in-out infinite;animation-delay:var(--alv-line-delay,0s)}
    .alv-layout-scene .alv-layout-arrow{fill:none;stroke:#c94e46;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
    .alv-layout-scene .alv-layout-whole.alv-layout-linked{animation-delay:0s}
    .v207-output-board .v207-output-routes>span>em{position:relative;overflow:hidden}
    .v207-output-board .v207-output-routes>span.on>em:after{content:'';position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,#fff0d0,transparent);animation:alvPortSignal 2.8s linear infinite}
    .v207-output-board .v207-output-routes>span>b.alv-port-strip{position:relative;overflow:hidden;isolation:isolate}
    .v207-output-board .v207-output-routes>span.on>b.alv-port-strip:after{content:'';position:absolute;inset:0;z-index:-1;background:repeating-linear-gradient(90deg,#fff0d022 0 5px,transparent 5px 8px)}
    .v21-rgbw-pair-board>div>span.on>i,.rgbw207-pair-route.on>i{animation:alvRgbwPortGlow 3.2s ease-in-out infinite;background:#ffe4b3!important}
    .v21-rgbw-pair-board[data-mode="separate"]>div>span:nth-child(2).on>i{animation-delay:-1.6s;background:#c94e46!important}
    .v21-rgbw-pair-modes>button>i.alv-port-mode{width:52px!important;height:44px!important;border-radius:10px;background:#141714!important;color:#fff0d0!important;overflow:hidden}
    body.v21 .v21-rgbw-pair-modes>button:has(>.alv-port-mode){grid-template-columns:52px minmax(0,1fr) 22px}
    .alv-port-mode>svg{display:block;width:100%;height:100%}
    .alv-port-mode .alv-port-active{animation:alvRgbwPortGlow 3.2s ease-in-out infinite}
    .alv-port-mode[data-alv-port-mode="separate"] .alv-port-two{animation-delay:-1.6s}
    @keyframes alvLayoutFlow{from{stroke-dashoffset:185}to{stroke-dashoffset:0}}
    @keyframes alvLayoutWhole{0%,100%{opacity:.16}30%,48%{opacity:1}78%{opacity:.16}}
    @keyframes alvPortSignal{to{transform:translateX(100%)}}
    @keyframes alvRgbwPortGlow{0%,100%{opacity:.46}45%,60%{opacity:1}}
    @media(max-width:560px){
      .nav>button>i[data-alv-icon]>.alv-icon{width:20px;height:20px}
      .alv-title-icon{width:27px;height:27px}
      .v1814-group-nav button>i[data-alv-icon]>.alv-icon{width:15px;height:15px}
    }
    @media(prefers-reduced-motion:reduce){.alv-scene-cue-track>i,.alv-scene-cue-badge>span,.alv-layout-scene .alv-layout-flow,.alv-layout-scene .alv-layout-whole,.v207-output-board .v207-output-routes>span.on>em:after,.v21-rgbw-pair-board>div>span.on>i,.rgbw207-pair-route.on>i,.alv-port-mode .alv-port-active{animation:none!important}.alv-layout-scene .alv-layout-flow{stroke-dashoffset:-55}.alv-layout-scene .alv-layout-whole{opacity:.85}.alv-scene-cue-track>i{background:color-mix(in srgb,var(--scene-colour),#161816 38%);opacity:.9}.alv-scene-cue-badge>span{opacity:1}}
  `;
  document.head.append(style);

  function markup(name) {
    const body = paths[name] || paths.light;
    return `<svg class="alv-icon" data-alv-icon-name="${name}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  }

  function setIcon(node, name) {
    if (!node || !paths[name]) return;
    const svg = node.querySelector(':scope > svg[data-alv-icon-name]');
    if (node.dataset.alvIcon === name && svg?.dataset.alvIconName === name && node.childElementCount === 1 && node.childNodes.length === 1) return;
    node.dataset.alvIcon = name;
    node.setAttribute('aria-hidden', 'true');
    node.innerHTML = markup(name);
  }

  function setSemanticIcon(node, name, role = name) {
    if (!node) return;
    setIcon(node, name);
    node.dataset.v21IconId = name;
    node.dataset.v21IconRole = role === 'ledlines' || role === 'light' ? 'led-line' : role;
  }

  function semanticRole(node) {
    if (!node) return '';
    // Read the kind label, never a customer-defined location or group name.
    // The overview journey changes from Zone / Group / Light to Location /
    // Zone / Group after its first render, so position is not a stable role.
    const resolve = value => {
      const label = (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (/\b(?:locatie|locaties|location|locations|emplacement|emplacements|standort|standorte)\b/.test(label)) return 'location';
      if (/\b(?:zone|zones|zonen)\b/.test(label)) return 'zone';
      if (/\b(?:groep|groepen|group|groups|groupe|groupes|gruppe|gruppen)\b/.test(label)) return 'group';
      if (/\b(?:led[ -]?lines?|licht|light|lumiere|beleuchtung)\b/.test(label)) return 'led-line';
      return '';
    };
    const small = node.querySelector('small');
    const role = resolve(small?.textContent || node.querySelector(':scope > b')?.textContent);
    if (role) return role;
    // The polished overview puts "CHOOSE NOW" / "THEN" above Zone / Group.
    // Only this instructional route may derive its kind from that second line.
    return node.parentElement?.matches('.v188-structure-route')
      ? resolve(node.querySelector(':scope > b > strong')?.textContent) : '';
  }

  function refineHierarchy(root = document) {
    root.querySelectorAll?.('.customer-location-mark,.v18152-location-mark,.v1814-all-scope-badge>i')
      .forEach(node => setSemanticIcon(node, 'location'));
    root.querySelectorAll?.('.customer-zone-icon,.customer-zone-detail-icon,.v18152-zone-scope-mark')
      .forEach(node => setSemanticIcon(node, 'zone'));
    root.querySelectorAll?.('.v188-structure-route>span,.customer-structure-route .alv-context-chip,.v20-review-map>span')
      .forEach(node => {
        const role = semanticRole(node);
        if (role) setSemanticIcon(node.querySelector(':scope > i'), role === 'led-line' ? 'ledlines' : role, role);
      });
    root.querySelectorAll?.('[data-v1814-group-tab="light"]>i,[data-v1814-group-tab="lines"]>i,.customer-group-empty-preview>i,.alv-home-scope-note>i,.alv-manage-summary>i')
      .forEach(node => setSemanticIcon(node, 'ledlines', 'led-line'));
    root.querySelectorAll?.('.active-context-icon,.group-card-active-note>i,.active-group-modal-banner>i,.alv-group-icon,.alv-group-page-icon')
      .forEach(node => setSemanticIcon(node, 'group'));
  }

  function language() {
    return (document.documentElement.lang || 'nl').slice(0, 2).toLowerCase();
  }

  function copy(values) {
    return values[language()] || values.nl;
  }

  function decorateNavigation(root) {
    const mappings = [
      ["go('home')", 'home'],
      ["go('zones')", 'zone'],
      ["go('scenes')", 'scenes'],
      ["go('lighting')", 'preset'],
      ["go('studio')", 'studio'],
      ["go('devices')", 'receiver'],
      ["go('help')", 'academy'],
      ["go('settings')", 'settings'],
      ['openUtilityMenu()', 'more']
    ];
    root.querySelectorAll?.('.nav > button').forEach((button) => {
      const action = button.getAttribute('onclick') || '';
      const match = mappings.find(([needle]) => action.includes(needle));
      if (match) setIcon(button.querySelector(':scope > i'), match[1]);
    });
  }

  function decorateLocations(root) {
    root.querySelectorAll?.('.customer-location-mark,.v18152-location-mark,.v1814-all-scope-badge>i')
      .forEach((node) => setIcon(node, 'location'));
  }

  function decorateZones(root) {
    root.querySelectorAll?.('.customer-zone-icon,.customer-zone-detail-icon,.v18152-zone-scope-mark')
      .forEach((node) => setIcon(node, 'zone'));
    root.querySelectorAll?.('.customer-zone-empty>i').forEach((node) => setIcon(node, 'zonePlus'));
  }

  function addTitleIcon(title, name, className) {
    if (!title || title.querySelector(':scope > .alv-title-icon')) return;
    const icon = document.createElement('span');
    icon.className = `alv-title-icon ${className || ''}`.trim();
    setIcon(icon, name);
    title.prepend(icon);
    title.classList.add('alv-title-with-icon');
  }

  function decorateGroups(root) {
    root.querySelectorAll?.('.customer-group-explorer-copy h3')
      .forEach((title) => addTitleIcon(title, 'group', 'alv-group-icon'));
    root.querySelectorAll?.('.customer-group-empty>i').forEach((node) => setIcon(node, 'groupPlus'));
    root.querySelectorAll?.('.customer-group-empty-preview>i').forEach((node) => {
      node.classList.add('alv-empty-line-mark');
      setIcon(node, 'ledlines');
    });
    root.querySelectorAll?.('.active-context-icon,.group-card-active-note>i,.active-group-modal-banner>i')
      .forEach((node) => setIcon(node, 'group'));

    const groupPage = root.querySelector?.('.customer-group-page');
    if (groupPage) {
      const heading = groupPage.querySelector('.v1811-group-head h1,.rgbw-group-head h1,:scope > .row h1');
      addTitleIcon(heading, 'group', 'alv-group-page-icon');
    }

    const labels = {
      nl: { short: 'Animatie', full: 'Animatie-instellingen' },
      en: { short: 'Animation', full: 'Animation settings' },
      fr: { short: 'Animation', full: 'Réglages de l’animation' },
      de: { short: 'Animation', full: 'Animationseinstellungen' }
    };
    const translated = copy(labels);
    const tabIcons = { light: 'ledlines', settings: 'animation', colors: 'colours', lines: 'ledlines' };
    root.querySelectorAll?.('.v1814-group-nav [data-v1814-group-tab]').forEach((button) => {
      const key = button.dataset.v1814GroupTab;
      setIcon(button.querySelector(':scope > i'), tabIcons[key]);
      if (key === 'settings') {
        const label = button.querySelector('b');
        if (label) label.textContent = translated.short;
        button.setAttribute('aria-label', translated.full);
      }
    });
  }

  function decorateUtility(root) {
    setIcon(root.querySelector?.('.utility-menu-mark'), 'more');
    setIcon(root.querySelector?.('.utility-preset-note>i'), 'preset');
    root.querySelectorAll?.('.utility-action').forEach((button) => {
      const action = button.getAttribute('onclick') || '';
      const name = action.includes("go('devices')") ? 'receiver' :
        action.includes("go('help')") ? 'academy' :
          action.includes("go('settings')") ? 'settings' : null;
      if (name) setIcon(button.querySelector('.utility-action-icon'), name);
    });
  }

  function removeLeadingPlus(button) {
    for (const node of button.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const cleaned = node.nodeValue.replace(/^\s*[＋+]\s*/, '');
      if (cleaned !== node.nodeValue) node.nodeValue = cleaned;
      break;
    }
  }

  function decorateCreationButtons(root) {
    const rules = [
      ['button[onclick*="openAddReceiver"]', 'receiverPlus'],
      ['button[onclick*="newZone()"]', 'zonePlus'],
      ['button[onclick*="newGroup()"]', 'groupPlus']
    ];
    rules.forEach(([selector, name]) => root.querySelectorAll?.(selector).forEach((button) => {
      button.classList.add('alv-icon-button');
      if (!button.querySelector(':scope > .alv-button-icon')) {
        const icon = document.createElement('span');
        icon.className = 'alv-button-icon';
        setIcon(icon, name);
        button.prepend(icon);
      }
      removeLeadingPlus(button);
    }));
  }

  function decorateReceivers(root) {
    root.querySelectorAll?.('.customer-device-empty>span').forEach((node) => setIcon(node, 'receiver'));
  }

  function decorateDisclosureIcons(root) {
    root.querySelectorAll?.('.v1814-home-action-chevron').forEach((node) => {
      const button = node.closest('button');
      setIcon(node, button?.classList.contains('on') ? 'chevronUp' : 'chevronDown');
    });
    root.querySelectorAll?.('.v1814-home-off-mark').forEach((node) => setIcon(node, 'power'));
  }

  function decorateEmptyScenes(root) {
    root.querySelectorAll?.('.v188-empty-visual.scene').forEach((node) => {
      if (node.dataset.alvSceneVisual === 'recall') return;
      const lines = Array.from({ length: 3 }, (_, row) =>
        `<div class="alv-scene-cue-track" style="--scene-row:${row}">${Array.from({ length: 12 }, (_, cell) => `<i style="--scene-cell:${cell}"></i>`).join('')}</div>`
      ).join('');
      node.dataset.alvSceneVisual = 'recall';
      node.classList.add('alv-scene-empty-visual');
      node.innerHTML = `<div class="alv-scene-cue-lines">${lines}</div><div class="alv-scene-cue-badge">${markup('scenes')}<span></span></div>`;
    });
  }

  function layoutGroup() {
    try { return typeof group !== 'undefined' ? group : null; } catch (_) { return null; }
  }

  function layoutScene(layout, family, count, orientation) {
    const panel = layout === 'parallel';
    const vertical = panel && orientation === 'vertical';
    const wholeLine = family === 'RGBW';
    const number = (value, x, y) => `<text class="alv-layout-number" x="${x}" y="${y}">${value}</text>`;
    const rail = (path, index, linked = false) => `<path class="alv-layout-rail" d="${path}"/>${wholeLine ? '' : `<path class="alv-layout-pixels" d="${path}"/>`}${panel || wholeLine ? `<path class="alv-layout-whole ${linked ? 'alv-layout-linked' : ''}" d="${path}" style="--alv-line-delay:${(-index * 3.2 / count).toFixed(3)}s"/>` : ''}`;
    let content = '';
    let height = 82;
    if (panel) {
      // Keep one visible rail per logical LED Line. A linked RGBW pair is
      // already collapsed by logicalRgbwLines; no fake per-pixel RGBW motion.
      if (vertical) {
        const gap = 150 / count;
        for (let index = 0; index < count; index += 1) {
          const x = 15 + gap * (index + .5);
          content += rail(`M${x} 15V55`, index) + number(index + 1, x, 73);
        }
        content += '<path class="alv-layout-arrow" d="M15 6h150m-5-4 5 4-5 4"/>';
      } else {
        height = Math.max(82, count * 18 + 16);
        const gap = (height - 18) / count;
        for (let index = 0; index < count; index += 1) {
          const y = 9 + gap * (index + .5);
          content += number(index + 1, 12, y + 3.5) + rail(`M29 ${y}H154`, index);
        }
        content += `<path class="alv-layout-arrow" d="M169 14v${height - 28}m-4-5 4 5 4-5"/>`;
      }
    } else {
      const segments = wholeLine ? 1 : count;
      const gap = 156 / segments;
      for (let index = 0; index < segments; index += 1) {
        const x = 12 + gap * index;
        content += rail(`M${x} 35H${x + gap - (segments > 1 ? 4 : 0)}`, index, true)
          + number(index + 1, x + gap / 2, 57);
      }
      if (!wholeLine) content += '<path class="alv-layout-flow" d="M12 35H168"/>';
      content += '<path class="alv-layout-arrow" d="M22 70h136m-5-4 5 4-5 4"/>';
    }
    return `<svg viewBox="0 0 180 ${height}" aria-hidden="true" focusable="false">${content}</svg>`;
  }

  function portModeScene(mode) {
    const active = port => mode === 'linked' || mode === 'separate' || mode === `port${port}`;
    const rails = [1, 2].map(port => {
      const y = port === 1 ? 14 : 30;
      const on = active(port);
      const colour = !on ? '#424a42' : mode === 'separate' && port === 2 ? '#c94e46' : 'currentColor';
      return `<path d="M18 ${y}h8" stroke="#788078" stroke-width="1.5"/><rect class="${on ? 'alv-port-active' : ''} ${port === 2 ? 'alv-port-two' : ''}" x="27" y="${y - 3}" width="20" height="6" rx="2" fill="${colour}"/><text x="11" y="${y + 2.5}" text-anchor="middle" fill="#eef1ee" font-size="7" font-family="system-ui">${port}</text>`;
    }).join('');
    return `<svg viewBox="0 0 54 44" aria-hidden="true" focusable="false"><rect x="4" y="7" width="14" height="30" rx="4" fill="#343a34"/>${rails}</svg>`;
  }

  function decorateSetupVisuals(root) {
    const selectedGroup = layoutGroup();
    root.querySelectorAll?.('.v21-rgbw-pair[data-phase="rgbw-ports"]>header p').forEach(node => {
      const label = copy({ nl: 'Kies één poort, beide samen of elk apart.', en: 'Choose one port, both together or each separately.', fr: 'Choisissez un port, les deux ensemble ou chacun séparément.', de: 'Wähle einen Port, beide gemeinsam oder jeden einzeln.' });
      if (node.textContent !== label) node.textContent = label;
    });
    root.querySelectorAll?.('.v187-layout-grid>button[onclick*="setGroupLayout("]').forEach(button => {
      if (button.querySelector(':scope > .v187-layout-demo')) return;
      const layout = button.getAttribute('onclick')?.match(/setGroupLayout\(['"](line|parallel)['"]\)/)?.[1];
      if (!layout) return;
      // Four-port SPI can still expose a text-only fallback. Give that button
      // the same broad, animated LED Line illustration as the established
      // setup flow instead of replacing it with a thin technical schematic.
      const title = layout === 'line'
        ? copy({ nl: 'Eén doorlopende LED Line', en: 'One continuous LED Line', fr: 'Une LED Line continue', de: 'Eine fortlaufende LED Line' })
        : copy({ nl: 'LED Lines onder elkaar', en: 'Stacked LED Lines', fr: 'LED Lines superposées', de: 'LED Lines untereinander' });
      const hint = layout === 'line'
        ? copy({ nl: 'Eén lange beweging', en: 'One long movement', fr: 'Un seul mouvement continu', de: 'Eine lange Bewegung' })
        : copy({ nl: 'Rijen vormen een paneel', en: 'Rows form a panel', fr: 'Les rangées forment un panneau', de: 'Reihen bilden ein Paneel' });
      const demoTemplate = document.createElement('template');
      demoTemplate.innerHTML = layout === 'parallel'
        ? '<div class="v187-layout-demo v187-layout-stacked" data-layout-demo="stacked" aria-hidden="true"><span class="v187-wall-line"><i>R1</i><b></b></span><span class="v187-wall-line"><i>R2</i><b></b></span><span class="v187-wall-line"><i>R3</i><b></b></span></div>'
        : '<div class="v187-layout-demo v187-layout-continuous" data-layout-demo="continuous" aria-hidden="true"><span class="v187-continuous-segment"><i>R1</i></span><span class="v187-continuous-segment"><i>R2</i></span><b></b></div>';
      const demo = demoTemplate.content.firstElementChild;
      const copyNode = document.createElement('span');
      const label = document.createElement('b');
      label.textContent = title;
      const description = document.createElement('small');
      description.textContent = hint;
      copyNode.append(label, description);
      const check = document.createElement('strong');
      check.setAttribute('aria-hidden', 'true');
      const selected = (selectedGroup?.layout || 'line') === layout;
      check.textContent = selected ? '✓' : '›';
      button.dataset.layoutChoice = layout;
      button.classList.remove('button', 'soft', 'alv-layout-choice');
      button.classList.add('v187-layout-choice');
      button.classList.toggle('on', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.replaceChildren(demo, copyNode, check);
    });
    root.querySelectorAll?.('.v187-layout-choice[data-layout-choice]>.v187-layout-demo:not([data-layout-demo])').forEach(node => {
      const layout = node.parentElement.dataset.layoutChoice;
      const family = String(selectedGroup?.receiverType || 'SPI').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
      const logical = family === 'RGBW' && window.AluvisionV21?.logicalRgbwLines
        ? window.AluvisionV21.logicalRgbwLines(selectedGroup) : selectedGroup?.receivers || [];
      const count = Math.max(1, logical.length);
      const orientation = selectedGroup?.parallelOrientation === 'vertical' ? 'vertical' : 'horizontal';
      const key = `${layout}:${family}:${count}:${orientation}`;
      if (node.dataset.alvLayoutScene === key && node.querySelector(':scope > svg')) return;
      node.dataset.alvLayoutScene = key;
      node.dataset.alvLineCount = String(layout !== 'parallel' && family === 'RGBW' ? 1 : count);
      node.dataset.alvFamily = family;
      node.classList.add('alv-layout-scene');
      node.innerHTML = layoutScene(layout, family, count, orientation);
    });
    root.querySelectorAll?.('.v207-output-board').forEach(board => {
      const routes = board.querySelectorAll('.v207-output-routes>span');
      board.dataset.alvPhysicalPorts = String(routes.length);
      routes.forEach((route, index) => {
        route.dataset.alvPort = String(index + 1);
        route.querySelector(':scope > b')?.classList.add('alv-port-strip');
      });
    });
    root.querySelectorAll?.('.v21-rgbw-pair-board,.rgbw207-pair-board').forEach(board => {
      board.dataset.alvPhysicalPorts = '2';
    });
    root.querySelectorAll?.('[data-v21-rgbw-pair-mode]>i').forEach(node => {
      const mode = node.parentElement.dataset.v21RgbwPairMode;
      if (node.dataset.alvPortMode === mode && node.querySelector(':scope > svg')) return;
      node.dataset.alvPortMode = mode;
      node.classList.add('alv-port-mode');
      node.setAttribute('aria-hidden', 'true');
      node.innerHTML = portModeScene(mode);
    });
  }

  function apply(root = document) {
    decorateNavigation(root);
    decorateLocations(root);
    decorateZones(root);
    decorateGroups(root);
    decorateUtility(root);
    decorateCreationButtons(root);
    decorateReceivers(root);
    decorateDisclosureIcons(root);
    decorateEmptyScenes(root);
    refineHierarchy(root);
    decorateSetupVisuals(root);
    document.documentElement.dataset.alvIconSystem = '21.0.1';
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply(document);
    });
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => {
      if ([...mutation.addedNodes].some(node => node.nodeType === Node.ELEMENT_NODE)) return true;
      const target = mutation.target?.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target?.parentElement;
      return Boolean(target?.closest?.('[data-alv-icon],.v188-structure-route,.alv-context-chip,.v20-review-map'));
    })) {
      schedule();
    }
  });

  const api = Object.freeze({ markup, semanticRole, setSemanticIcon, refineHierarchy, apply: schedule });
  window.AluvisionIcons = api;
  window.AluvisionV20IconSystem = api;
  apply(document);
  observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
