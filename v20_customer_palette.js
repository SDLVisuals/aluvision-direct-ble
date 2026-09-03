/*
 * Aluvision Lighting Control — customer colour-library management.
 *
 * The established Presets page already renders `db.brand`.  This small layer
 * completes the three-dot menu so a customer can edit, order and remove those
 * colours without replacing the existing page or colour picker.
 */
(() => {
  'use strict';

  function tx(nl, en, fr, de) {
    return typeof window.ac === 'function' ? ac(nl, en, fr, de) : nl;
  }

  function safe(value) {
    return typeof window.esc === 'function'
      ? esc(String(value ?? ''))
      : String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
  }

  function colourAt(index) {
    if (typeof db === 'undefined' || !Array.isArray(db?.brand)) return null;
    const position = Number(index);
    if (!Number.isInteger(position) || position < 0 || position >= db.brand.length) return null;
    return db.brand[position];
  }

  function finish(message) {
    if (typeof save === 'function') save('queued');
    if (typeof closeModal === 'function') closeModal();
    if (typeof render === 'function') render();
    if (message && typeof toast === 'function') toast(message);
  }

  window.requestDeleteBrand = function v20OpenColourMenu(index) {
    const colour = colourAt(index);
    if (!colour) return;
    const first = Number(index) === 0;
    const last = Number(index) === db.brand.length - 1;
    modal(`<section class="v20-colour-library-menu">
      <div class="eyebrow">${tx('OPGESLAGEN KLEUR', 'SAVED COLOUR', 'COULEUR ENREGISTRÉE', 'GESPEICHERTE FARBE')}</div>
      <div class="v20-colour-library-title"><i style="--saved-colour:${safe(colour.hex)}"></i><span><h1>${safe(colour.name)}</h1><small>${safe(String(colour.hex || '').toUpperCase())}</small></span></div>
      <div class="v20-colour-library-actions">
        <button onclick="v20EditBrand(${Number(index)})"><i>✎</i><span><b>${tx('Kleur aanpassen', 'Edit colour', 'Modifier la couleur', 'Farbe bearbeiten')}</b><small>${tx('Naam en kleurwaarde', 'Name and colour value', 'Nom et valeur', 'Name und Farbwert')}</small></span><em>›</em></button>
        <button ${first ? 'disabled' : ''} onclick="v20MoveBrand(${Number(index)},-1)"><i>↑</i><span><b>${tx('Naar voren', 'Move earlier', 'Déplacer avant', 'Nach vorne')}</b><small>${tx('Hoger tussen de snelle kleuren', 'Higher in quick colours', 'Plus haut dans les couleurs rapides', 'Weiter oben in Schnellfarben')}</small></span></button>
        <button ${last ? 'disabled' : ''} onclick="v20MoveBrand(${Number(index)},1)"><i>↓</i><span><b>${tx('Naar achteren', 'Move later', 'Déplacer après', 'Nach hinten')}</b><small>${tx('Lager tussen de snelle kleuren', 'Lower in quick colours', 'Plus bas dans les couleurs rapides', 'Weiter unten in Schnellfarben')}</small></span></button>
        <button class="danger" onclick="v20ConfirmDeleteBrand(${Number(index)})"><i>×</i><span><b>${tx('Kleur verwijderen', 'Delete colour', 'Supprimer la couleur', 'Farbe löschen')}</b><small>${tx('Presets en scènes blijven behouden', 'Presets and scenes stay unchanged', 'Les presets et scènes restent inchangés', 'Presets und Szenen bleiben erhalten')}</small></span><em>›</em></button>
      </div>
      <button class="button soft" onclick="closeModal()">${tx('Sluiten', 'Close', 'Fermer', 'Schließen')}</button>
    </section>`);
  };

  window.v20EditBrand = function v20EditBrand(index) {
    const colour = colourAt(index);
    if (!colour) return;
    const hex = /^#[0-9a-f]{6}$/i.test(colour.hex) ? colour.hex : '#ffffff';
    modal(`<section class="v20-colour-library-editor">
      <button class="button soft" onclick="requestDeleteBrand(${Number(index)})">← ${tx('Terug', 'Back', 'Retour', 'Zurück')}</button>
      <div class="eyebrow">${tx('OPGESLAGEN KLEUR', 'SAVED COLOUR', 'COULEUR ENREGISTRÉE', 'GESPEICHERTE FARBE')}</div>
      <h1>${tx('Kleur aanpassen', 'Edit colour', 'Modifier la couleur', 'Farbe bearbeiten')}</h1>
      <label><span>${tx('Naam', 'Name', 'Nom', 'Name')}</span><input id="v20BrandName" class="field" maxlength="60" value="${safe(colour.name)}"></label>
      <label><span>${tx('Kleur', 'Colour', 'Couleur', 'Farbe')}</span><div class="v20-colour-library-input"><input id="v20BrandPicker" type="color" value="${safe(hex)}" oninput="v20BrandHex.value=this.value.toUpperCase()"><input id="v20BrandHex" class="field" value="${safe(hex.toUpperCase())}" maxlength="7" autocapitalize="characters" oninput="if(/^#[0-9a-f]{6}$/i.test(this.value))v20BrandPicker.value=this.value"></div></label>
      <button class="button" onclick="v20SaveBrand(${Number(index)})">${tx('Wijzigingen bewaren', 'Save changes', 'Enregistrer', 'Änderungen speichern')}</button>
    </section>`);
  };

  window.v20SaveBrand = function v20SaveBrand(index) {
    const colour = colourAt(index);
    const name = document.getElementById('v20BrandName')?.value.trim();
    const hex = document.getElementById('v20BrandHex')?.value.trim();
    if (!colour || !name || !/^#[0-9a-f]{6}$/i.test(hex || '')) {
      return typeof toast === 'function'
        ? toast(tx('Vul een naam en geldige HEX-kleur in', 'Enter a name and valid HEX colour', 'Saisissez un nom et une couleur HEX valide', 'Name und gültige HEX-Farbe eingeben'))
        : undefined;
    }
    colour.name = name;
    colour.hex = hex.toLowerCase();
    finish(tx('Kleur aangepast', 'Colour updated', 'Couleur modifiée', 'Farbe aktualisiert'));
  };

  window.v20MoveBrand = function v20MoveBrand(index, direction) {
    if (!Array.isArray(db?.brand)) return;
    const from = Number(index);
    const to = from + (Number(direction) < 0 ? -1 : 1);
    if (!Number.isInteger(from) || from < 0 || from >= db.brand.length || to < 0 || to >= db.brand.length) return;
    const [colour] = db.brand.splice(from, 1);
    db.brand.splice(to, 0, colour);
    finish(tx('Volgorde aangepast', 'Order updated', 'Ordre modifié', 'Reihenfolge aktualisiert'));
  };

  window.v20ConfirmDeleteBrand = function v20ConfirmDeleteBrand(index) {
    const colour = colourAt(index);
    if (!colour) return;
    modal(`<section class="v20-colour-library-delete">
      <div class="eyebrow">${tx('KLEUR VERWIJDEREN', 'DELETE COLOUR', 'SUPPRIMER LA COULEUR', 'FARBE LÖSCHEN')}</div>
      <div class="v20-colour-library-title"><i style="--saved-colour:${safe(colour.hex)}"></i><span><h1>${safe(colour.name)}</h1><small>${safe(String(colour.hex || '').toUpperCase())}</small></span></div>
      <p class="danger-note">${tx('Deze kleur verdwijnt uit je snelle kleuren. Bestaande presets en scènes veranderen niet.', 'This colour is removed from quick colours. Existing presets and scenes do not change.', 'Cette couleur disparaît des couleurs rapides. Les presets et scènes ne changent pas.', 'Diese Farbe verschwindet aus den Schnellfarben. Presets und Szenen ändern sich nicht.')}</p>
      <div class="row"><button class="button soft" onclick="requestDeleteBrand(${Number(index)})">${tx('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button><button class="button red" onclick="v20DeleteBrand(${Number(index)})">${tx('Verwijderen', 'Delete', 'Supprimer', 'Löschen')}</button></div>
    </section>`);
  };

  window.v20DeleteBrand = function v20DeleteBrand(index) {
    if (!colourAt(index)) return;
    db.brand.splice(Number(index), 1);
    finish(tx('Kleur verwijderd', 'Colour deleted', 'Couleur supprimée', 'Farbe gelöscht'));
  };

  const style = document.createElement('style');
  style.dataset.releaseLayer = 'customer-colour-library';
  style.textContent = `
    .v20-colour-library-menu,.v20-colour-library-editor,.v20-colour-library-delete{display:grid;gap:15px;min-width:0}
    .v20-colour-library-title{display:grid;grid-template-columns:64px minmax(0,1fr);gap:13px;align-items:center}
    .v20-colour-library-title>i{display:block;width:64px;height:64px;border:4px solid var(--panel);border-radius:18px;background:var(--saved-colour);box-shadow:0 0 0 1px var(--line),0 9px 24px color-mix(in srgb,var(--saved-colour),transparent 68%)}
    .v20-colour-library-title h1{margin:0 0 3px}.v20-colour-library-title small{color:var(--mut);font-weight:900;letter-spacing:.8px}
    .v20-colour-library-actions{display:grid;gap:8px}.v20-colour-library-actions>button{display:grid;grid-template-columns:42px minmax(0,1fr) 20px;align-items:center;gap:11px;width:100%;min-height:66px;padding:10px;border:1px solid var(--line);border-radius:15px;background:var(--panel);color:var(--ink);text-align:left;cursor:pointer}
    .v20-colour-library-actions>button>i{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:var(--panel-2);font-size:18px;font-style:normal}.v20-colour-library-actions b,.v20-colour-library-actions small{display:block}.v20-colour-library-actions small{margin-top:3px;color:var(--mut);font-size:9px}.v20-colour-library-actions em{font-size:21px;font-style:normal}.v20-colour-library-actions .danger{color:#b33c35}.v20-colour-library-actions>button:disabled{opacity:.38;cursor:not-allowed}
    .v20-colour-library-editor label{display:grid;gap:7px;color:var(--mut);font-size:10px;font-weight:900}.v20-colour-library-input{display:grid;grid-template-columns:70px minmax(0,1fr);gap:9px}.v20-colour-library-input input[type="color"]{width:70px;height:52px;border:1px solid var(--line);border-radius:13px;background:transparent}
  `;
  document.head.appendChild(style);
})();
