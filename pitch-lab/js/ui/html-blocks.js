// Dibuja los bloques del modelo de pantalla como HTML accesible (panel de texto).
// Es el espejo del panel 3D: mismos textos, mismas acciones.

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const NOTICE_ICON = { warn: 'Atención', privacy: 'Privacidad', demo: 'Demostración', info: 'Información' };

export function renderBlock(block) {
  switch (block.t) {
    case 'p':
      return `<p class="${block.tone === 'muted' ? 'muted' : ''}">${esc(block.text)}</p>`;

    case 'bullets':
      return `${block.heading ? `<h3>${esc(block.heading)}</h3>` : ''}<ul class="list">${block.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;

    case 'kv':
      return `<dl class="kv">${block.rows.map((r) => `<div><dt>${esc(r.k)}</dt><dd>${esc(r.v)}</dd></div>`).join('')}</dl>`;

    case 'fields':
      return `<dl class="fields">${block.rows.map((r) => `<div><dt>${esc(r.k)}</dt><dd>${esc(r.v)}</dd></div>`).join('')}</dl>`;

    case 'notice':
      return `<div class="notice notice-${esc(block.kind)}" role="note"><strong>${esc(block.label || NOTICE_ICON[block.kind])}</strong><p>${esc(block.text)}</p></div>`;

    case 'tag':
      return `<p class="tag tag-${esc(block.source)}">${esc(block.text)}</p>`;

    case 'quote':
      return `<blockquote class="quote">${esc(block.text)}</blockquote>`;

    case 'meter':
      return `<p class="meter-label">${esc(block.label)}: <strong>${esc(block.text)}</strong></p><meter min="0" max="1" value="${block.value}" aria-label="${esc(block.label)}"></meter>`;

    case 'measures':
      return `<table class="measures"><caption class="sr-only">Medidas de la presentación</caption><tbody>${block.rows.map((r) => `
        <tr class="${r.available ? '' : 'na'}"><th scope="row">${esc(r.label)}${r.note ? `<small>${esc(r.note)}</small>` : ''}</th>
        <td>${esc(r.display)}${r.source ? `<small>${esc(r.source)}</small>` : ''}</td></tr>`).join('')}</tbody></table>`;

    case 'indicator':
      return block.value == null
        ? `<div class="indicator na"><h3>${esc(block.label)}</h3><p class="big">Sin datos suficientes</p><p class="muted">${esc(block.note)}</p></div>`
        : `<div class="indicator"><h3>${esc(block.label)}</h3><p class="big">${block.value}<span> / 100</span></p><p class="muted">${esc(block.note)}</p></div>`;

    case 'tips':
      return `<ol class="tips">${block.items.map((t) => `<li>${esc(t.text)}<small>Basado en: ${esc(t.basedOn)}</small></li>`).join('')}</ol>`;

    default:
      return '';
  }
}

/** Botón HTML para una acción. */
export function renderAction(action, { extraClass = '' } = {}) {
  const disabled = action.disabled ? ' aria-disabled="true"' : '';
  const pressed = action.kind === 'toggle' || action.kind === 'choice' || action.kind === 'tab' || action.kind === 'rubric'
    ? ` aria-pressed="${action.on ? 'true' : 'false'}"` : '';
  const value = action.value ? ` <span class="btn-value">${esc(action.value)}</span>` : '';
  const state = action.kind === 'toggle' ? ` <span class="btn-state">${action.on ? 'Sí' : 'No'}</span>` : '';
  return `<button type="button" class="btn btn-${esc(action.kind)} ${extraClass}" data-action-id="${esc(action.id)}"${disabled}${pressed}>${esc(action.label)}${value}${state}</button>`;
}
