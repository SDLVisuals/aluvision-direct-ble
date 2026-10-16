(function(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningColourPresetsUI = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const languages = ['nl', 'en', 'fr', 'de'];
  const texts = {
    title: ['Kleurpresets', 'Colour presets', 'Couleurs enregistrées', 'Farbvorlagen'],
    hint: ['Tik om te gebruiken. Sleep de puntjes om te verplaatsen.', 'Tap to use. Drag the dots to move.', 'Touchez pour utiliser. Faites glisser les points pour déplacer.', 'Zum Anwenden tippen. Zum Verschieben die Punkte ziehen.'],
    brand: ['Merk', 'Brand', 'Marque', 'Marke'],
    saveCurrent: ['Kleur opslaan', 'Save colour', 'Enregistrer une couleur', 'Farbe speichern'],
    addBrands: ['Merkkleuren toevoegen', 'Add brand colours', 'Ajouter les couleurs de marque', 'Markenfarben hinzufügen'],
    empty: ['Bewaar je favoriete kleuren om ze hier snel te kiezen.', 'Save your favourite colours for quick access here.', 'Enregistrez vos couleurs favorites pour les retrouver ici.', 'Speichere deine Lieblingsfarben für den schnellen Zugriff.'],
    apply: ['{name} gebruiken', 'Use {name}', 'Utiliser {name}', '{name} anwenden'],
    move: ['{name} verplaatsen', 'Move {name}', 'Déplacer {name}', '{name} verschieben'],
    edit: ['{name} bewerken', 'Edit {name}', 'Modifier {name}', '{name} bearbeiten'],
    remove: ['{name} verwijderen', 'Delete {name}', 'Supprimer {name}', '{name} löschen'],
    editTitle: ['Preset aanpassen', 'Edit preset', 'Modifier la couleur', 'Vorlage bearbeiten'],
    editHint: ['Je wijzigt alleen deze preset, niet het licht dat nu brandt.', 'Only this preset changes, not the light that is currently on.', 'Vous modifiez uniquement cette couleur enregistrée, pas la lumière allumée.', 'Du änderst nur diese Vorlage, nicht das aktuell leuchtende Licht.'],
    name: ['Naam', 'Name', 'Nom', 'Name'],
    rgb: ['RGB-kleur kiezen', 'Choose RGB colour', 'Choisir la couleur RVB', 'RGB-Farbe auswählen'],
    exact: ['Exacte kleurwaarden', 'Exact colour values', 'Valeurs exactes de couleur', 'Exakte Farbwerte'],
    r: ['Rood', 'Red', 'Rouge', 'Rot'], g: ['Groen', 'Green', 'Vert', 'Grün'],
    b: ['Blauw', 'Blue', 'Bleu', 'Blau'], w: ['Wit', 'White', 'Blanc', 'Weiß'],
    brightness: ['Helderheid', 'Brightness', 'Luminosité', 'Helligkeit'],
    save: ['Opslaan', 'Save', 'Enregistrer', 'Speichern'],
    cancel: ['Annuleren', 'Cancel', 'Annuler', 'Abbrechen'],
    undo: ['Verwijderen ongedaan maken', 'Undo deletion', 'Annuler la suppression', 'Löschen rückgängig machen'],
    saving: ['Preset opslaan…', 'Saving preset…', 'Enregistrement de la couleur…', 'Vorlage wird gespeichert…'],
    saved: ['Preset opgeslagen.', 'Preset saved.', 'Couleur enregistrée.', 'Vorlage gespeichert.'],
    saveFailed: ['Opslaan is niet bevestigd. Je wijzigingen blijven staan.', 'Saving is not confirmed. Your changes are kept.', 'L’enregistrement n’est pas confirmé. Vos modifications sont conservées.', 'Speichern ist nicht bestätigt. Deine Änderungen bleiben erhalten.'],
    editedElsewhere: ['Deze preset is intussen gewijzigd. Open hem opnieuw om verder te gaan.', 'This preset changed elsewhere. Open it again to continue.', 'Cette couleur a été modifiée ailleurs. Rouvrez-la pour continuer.', 'Diese Vorlage wurde inzwischen geändert. Öffne sie erneut.'],
    missingPreset: ['Deze preset is niet meer beschikbaar.', 'This preset is no longer available.', 'Cette couleur enregistrée n’est plus disponible.', 'Diese Vorlage ist nicht mehr verfügbar.'],
    invalidName: ['Geef de preset een naam van maximaal 64 tekens.', 'Enter a preset name of up to 64 characters.', 'Donnez un nom de 64 caractères maximum.', 'Gib einen Namen mit höchstens 64 Zeichen ein.'],
    invalidChannels: ['Kies gehele RGBW-waarden van 0 tot 255 en een helderheid van 0 tot 100%.', 'Use whole RGBW values from 0 to 255 and brightness from 0 to 100%.', 'Choisissez des valeurs RVBB entières de 0 à 255 et une luminosité de 0 à 100 %.', 'Wähle ganze RGBW-Werte von 0 bis 255 und eine Helligkeit von 0 bis 100 %.'],
    finishEdit: ['Sla je wijziging eerst op of annuleer ze.', 'Save or cancel your edit first.', 'Enregistrez ou annulez d’abord votre modification.', 'Speichere oder verwerfe zuerst deine Änderung.'],
    deleted: ['{name} verwijderd.', '{name} deleted.', '{name} supprimée.', '{name} gelöscht.'],
    restored: ['{name} teruggezet.', '{name} restored.', '{name} restaurée.', '{name} wiederhergestellt.'],
    orderSaved: ['Volgorde opgeslagen.', 'Order saved.', 'Ordre enregistré.', 'Reihenfolge gespeichert.'],
    brandsAdded: ['Merkkleuren toegevoegd.', 'Brand colours added.', 'Couleurs de marque ajoutées.', 'Markenfarben hinzugefügt.'],
    noChanges: ['Geen wijzigingen om op te slaan.', 'No changes to save.', 'Aucune modification à enregistrer.', 'Keine Änderungen zum Speichern.']
  };
  function t(key, language = 'nl', params = {}) {
    const index = languages.indexOf(String(language).toLowerCase().split(/[-_]/)[0]);
    return (texts[key]?.[Math.max(0, index)] || texts[key]?.[0] || key).replace(/\{([^}]+)\}/g, (all, name) => String(params[name] ?? all));
  }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const integer = (value, max, fallback = 0) => Number.isInteger(value) && value >= 0 && value <= max ? value : fallback;
  const colour = value => ({ r: integer(value?.r, 255), g: integer(value?.g, 255), b: integer(value?.b, 255), w: integer(value?.w, 255), bri: Number.isFinite(value?.bri) && value.bri >= 0 && value.bri <= 100 ? value.bri : 100 });
  const hex = c => '#' + [c.r, c.g, c.b].map(value => value.toString(16).padStart(2, '0')).join('');
  function screen(c, entry, swatchHex) {
    let value;
    try { if (typeof swatchHex === 'function') value = swatchHex({ ...c }, entry); } catch (_) {}
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : hex({ r: Math.min(255, c.r + c.w), g: Math.min(255, c.g + c.w), b: Math.min(255, c.b + c.w) });
  }
  function icon(kind) {
    const paths = {
      drag: '<circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>',
      edit: '<path d="m16 3 5 5-12 12-6 1 1-6L16 3Z"/><path d="m13 6 5 5"/>',
      remove: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
      add: '<path d="M12 5v14M5 12h14"/>', check: '<path d="m5 12 4 4L19 6"/>',
      undo: '<path d="m8 4-5 5 5 5M3 9h10a7 7 0 1 1 0 14"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[kind] || paths.add}</svg>`;
  }
  function editor(entry, draft, language, busy) {
    const c = colour(draft.color), disabled = busy ? ' disabled' : '', name = typeof draft.name === 'string' ? draft.name : entry.name;
    return `<div class="colour-preset-editor667" data-colour-preset-editor667 data-id="${esc(entry.id)}" role="group" aria-label="${esc(t('edit', language, { name: entry.name }))}"><div class="colour-preset-editor-heading667"><b>${esc(t('editTitle', language))}</b><span class="colour-preset-editor-dot667" style="--swatch:${hex(c)}" aria-hidden="true"></span></div><p class="colour-preset-editor-hint667">${esc(t('editHint', language))}</p><label class="colour-preset-field667"><span>${esc(t('name', language))}</span><input type="text" data-colour-preset-name667 maxlength="64" autocomplete="off" value="${esc(name)}"${disabled}></label><label class="colour-preset-rgb-field667"><span>${esc(t('rgb', language))}</span><input type="color" data-colour-preset-rgb667 value="${hex(c)}"${disabled}></label><fieldset class="colour-preset-channels667"><legend>${esc(t('exact', language))}</legend>${['r', 'g', 'b', 'w'].map(channel => `<label data-channel="${channel}"><span>${channel.toUpperCase()}</span><input type="number" inputmode="numeric" data-colour-preset-channel667="${channel}" min="0" max="255" step="1" value="${c[channel]}" aria-label="${esc(t(channel, language))}"${disabled}></label>`).join('')}</fieldset><label class="colour-preset-brightness667"><span>${esc(t('brightness', language))}<output data-colour-preset-bri-output667>${c.bri}%</output></span><input type="range" data-colour-preset-bri667 min="0" max="100" step="any" aria-label="${esc(t('brightness', language))}" value="${c.bri}"${disabled}></label><div class="colour-preset-editor-actions667"><button type="button" data-action="colour-preset-cancel667" data-id="${esc(entry.id)}"${disabled}>${esc(t('cancel', language))}</button><button type="button" data-action="colour-preset-save667" data-id="${esc(entry.id)}"${disabled}>${icon('check')}<span>${esc(t(busy ? 'saving' : 'save', language))}</span></button></div></div>`;
  }
  function markup({ entries = [], language = 'nl', draft = null, busy = false, notice = '', error = '', undo = false, missingBrands = false, swatchHex } = {}) {
    const seen = new Set(), list = (Array.isArray(entries) ? entries : []).filter(entry => {
      if (!entry || typeof entry.id !== 'string' || !entry.id || seen.has(entry.id) || typeof entry.name !== 'string') return false;
      seen.add(entry.id); return true;
    });
    const editing = !!draft && list.some(entry => entry.id === draft.id), disabled = busy ? ' disabled' : '';
    const rows = list.map(entry => {
      const c = colour(entry.color), brand = entry.group === 'brand' || entry.isBrandPresetUI === true, isEditing = editing && draft.id === entry.id;
      return `<div class="saved-colour-item colour-preset-row667${brand ? ' is-brand' : ''}${isEditing ? ' is-editing' : ''}" data-colour-id="${esc(entry.id)}"><button type="button" class="saved-colour" data-action="swatch" data-id="${esc(entry.id)}" data-rgb="${c.r},${c.g},${c.b}" data-white="${c.w}" data-bri="${c.bri}" style="--swatch:${screen(c, entry, swatchHex)}" aria-label="${esc(t('apply', language, { name: entry.name }))}"><i aria-hidden="true"></i><span class="colour-preset-name667">${esc(entry.name)}${brand ? `<small class="saved-colour-kind">${esc(t('brand', language))}</small>` : ''}</span></button><button type="button" class="colour-drag-handle colour-preset-tool667" data-colour-drag="${esc(entry.id)}" aria-label="${esc(t('move', language, { name: entry.name }))}" title="${esc(t('move', language, { name: entry.name }))}"${busy || editing ? ' disabled' : ''}>${icon('drag')}</button><button type="button" class="colour-preset-tool667" data-action="colour-preset-edit667" data-id="${esc(entry.id)}" aria-label="${esc(t('edit', language, { name: entry.name }))}" aria-expanded="${isEditing}" title="${esc(t('edit', language, { name: entry.name }))}"${disabled}>${icon('edit')}</button><button type="button" class="colour-preset-tool667 colour-preset-remove667" data-action="colour-preset-remove667" data-id="${esc(entry.id)}" aria-label="${esc(t('remove', language, { name: entry.name }))}" title="${esc(t('remove', language, { name: entry.name }))}"${disabled}>${icon('remove')}</button>${isEditing ? editor(entry, draft, language, busy) : ''}</div>`;
    }).join('');
    return `<section class="my-colours" data-inline-presets="667"${busy ? ' aria-busy="true"' : ''}><div class="colour-presets-heading667"><h3>${esc(t('title', language))}</h3><p class="colour-library-hint">${esc(t('hint', language))}</p></div><div class="saved-colour-grid" data-colour-presets-inline="667">${rows}</div>${list.length ? '' : `<p class="colour-presets-empty667">${esc(t('empty', language))}</p>`}<div class="colour-presets-add667"><button type="button" data-action="colour-new"${disabled}>${icon('add')}<span>${esc(t('saveCurrent', language))}</span></button>${missingBrands ? `<button type="button" data-action="colour-presets-brands667"${disabled}>${icon('add')}<span>${esc(t('addBrands', language))}</span></button>` : ''}</div>${notice ? `<p class="colour-library-status colour-preset-notice667" role="status" aria-live="polite">${esc(notice)}</p>` : ''}${error ? `<p class="colour-preset-error667" role="alert">${esc(error)}</p>` : ''}${undo ? `<button type="button" class="colour-preset-undo667" data-action="colour-undo"${disabled}>${icon('undo')}<span>${esc(t('undo', language))}</span></button>` : ''}</section>`;
  }
  return Object.freeze({ markup, t });
}));
