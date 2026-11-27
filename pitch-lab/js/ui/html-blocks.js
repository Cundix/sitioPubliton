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
      return `<dl class="fields${block.small ? ' fields-small' : ''}">${block.rows.map((r) => `<div><dt>${esc(r.k)}</dt><dd>${esc(r.v)}</dd></div>`).join('')}</dl>`;

    case 'aifull':
      return renderAiFull(block);

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

const li = (items) => `<ul class="list">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;

/**
 * Detalle completo del análisis con IA (solo panel de texto: el panel 3D muestra un resumen).
 * Todo el texto viene de la IA y se escapa. Siempre se rotula como interpretación.
 */
function renderAiFull({ ai, part, gestures }) {
  if (!ai || ai.status !== 'done') return '';
  const a = ai.analysis;
  const before = ai.failedBefore?.length ? ` Antes se intentó con ${ai.failedBefore.join('; ')}.` : '';
  const foot = `<p class="muted small-text ai-model">Modelo: ${esc(ai.model || 'desconocido')}.${esc(before)} ${esc(ai.disclaimer)}</p>`;

  if (ai.mode === 'free') return renderFreeAi({ ai, part, gestures, foot });

  if (part === 'content') {
    const rubric = ai.rubricRows.map((r) => `
      <div class="ai-item"><dt>${esc(r.label)}: <strong>${esc(r.display)}</strong></dt>
      <dd>${esc(r.note)}${r.quote ? `<blockquote class="quote">«${esc(r.quote)}»</blockquote>` : ''}</dd></div>`).join('');
    return `<section class="ai-report" aria-label="Detalle del análisis de contenido">
      <h3>Resumen de la IA</h3><p>${esc(a.summary)}</p>
      <h3>Por criterio (con cita textual)</h3><dl class="ai-list">${rubric}
        <div class="ai-item"><dt>Respeta la restricción: <strong>${esc(ai.restriction.display)}</strong></dt><dd>${esc(ai.restriction.note)}</dd></div></dl>
      ${a.strengths.length ? `<h3>Lo que funcionó</h3>${li(a.strengths)}` : ''}
      ${a.improvements.length ? `<h3>Para mejorar</h3><ol class="tips">${a.improvements.map((i) => `<li>${esc(i.advice)}${i.why ? `<small>Por qué: ${esc(i.why)}</small>` : ''}</li>`).join('')}</ol>` : ''}
      ${foot}</section>`;
  }

  const g = gestures?.measured
    ? `<h3>Gestos (cámara, medido en tu dispositivo)</h3><p>Manos a la vista el ${Math.round(gestures.handsVisibleShare * 100)} % del tiempo; dos manos el ${Math.round(gestures.twoHandsShare * 100)} %; movimiento ${esc(gestures.movementLabel)}. Es una medida aproximada del movimiento de las manos: no evalúa si el gesto fue adecuado.</p>`
    : '';
  return `<section class="ai-report" aria-label="Detalle de la entrega">
    <dl class="ai-list">
      <div class="ai-item"><dt>Ritmo</dt><dd>${esc(a.delivery.pace.observation)}</dd></div>
      <div class="ai-item"><dt>Claridad</dt><dd>${esc(a.delivery.clarity.observation)}</dd></div>
      <div class="ai-item"><dt>Entonación y volumen</dt><dd>${esc(a.delivery.energy.observation)}</dd></div>
      <div class="ai-item"><dt>Pausas</dt><dd>${esc(a.delivery.pauses.observation)}</dd></div>
      <div class="ai-item"><dt>Muletillas</dt><dd>${esc(a.delivery.fillers.observation)}</dd></div>
    </dl>
    ${g}
    ${a.limitations.length ? `<h3>Límites de este análisis</h3>${li(a.limitations)}` : ''}
    ${foot}</section>`;
}

/**
 * Detalle del pitch libre: calificaciones de 1 a 5 por criterio, el promedio que calcula la aplicación y el motivo.
 * Todo el texto viene de la IA y se escapa.
 */
function renderFreeAi({ ai, part, gestures, foot }) {
  const a = ai.analysis;
  const f = ai.free;
  const notRated = !f.rated
    ? `<p class="notice notice-warn" role="note"><strong>SIN CALIFICAR</strong> La IA no pudo calificar esta presentación (poca voz, no se entendió o el contenido no se puede calificar). ${a.limitations.length ? esc(a.limitations.join(' ')) : ''}</p>`
    : '';
  const item = (r) => `<div class="ai-item"><dt>${esc(r.label)}: <strong>${esc(r.display)}</strong>${r.level ? ` <span class="muted">· ${esc(r.level)}</span>` : ''}</dt>
      <dd><span class="muted">${esc(r.question)}</span> ${esc(r.note)}${r.quote ? `<blockquote class="quote">«${esc(r.quote)}»</blockquote>` : ''}${r.tip ? `<p class="tip-up"><strong>Para subir la nota:</strong> ${esc(r.tip)}</p>` : ''}</dd></div>`;
  const fillers = f.fillers && f.fillers.count != null
    ? `<h3>Muletillas</h3><p><strong>${esc(f.fillers.count)}</strong> en total${f.fillers.examples.length ? ` (${esc(f.fillers.examples.join(', '))})` : ''} <span class="muted">· cuenta de la IA sobre el audio: puede no detectar todas</span></p>`
    : '';

  if (part === 'content') {
    return `<section class="ai-report" aria-label="Calificación de la idea">
      ${notRated}
      ${f.topic ? `<h3>Lo que vendiste</h3><p>${esc(f.topic)}</p>` : ''}
      <p class="indicator-line"><strong>Tu idea: ${esc(f.idea.display)}</strong> <span class="muted">(promedio de 5 criterios, calculado por la aplicación)</span></p>
      ${f.idea.rationale ? `<p>${esc(f.idea.rationale)}</p>` : ''}
      <h3>Por criterio (con cita textual)</h3><dl class="ai-list">${f.idea.rows.map(item).join('')}</dl>
      ${a.strengths.length ? `<h3>Lo que funcionó</h3>${li(a.strengths)}` : ''}
      ${a.improvements.length ? `<h3>Para mejorar</h3><ol class="tips">${a.improvements.map((i) => `<li>${esc(i.advice)}${i.why ? `<small>Por qué: ${esc(i.why)}</small>` : ''}</li>`).join('')}</ol>` : ''}
      ${foot}</section>`;
  }
  const g = gestures?.measured
    ? `<h3>Gestos (cámara, medido en tu dispositivo)</h3><p>Manos a la vista el ${Math.round(gestures.handsVisibleShare * 100)} % del tiempo; dos manos el ${Math.round(gestures.twoHandsShare * 100)} %; movimiento ${esc(gestures.movementLabel)}. Es una medida aproximada del movimiento de las manos: no evalúa si el gesto fue adecuado.</p>`
    : '';
  return `<section class="ai-report" aria-label="Calificación de cómo la vendiste">
    ${notRated}
    <p class="indicator-line"><strong>Cómo la vendiste: ${esc(f.selling.display)}</strong> <span class="muted">(promedio de 6 aspectos, calculado por la aplicación)</span></p>
    ${f.selling.rationale ? `<p>${esc(f.selling.rationale)}</p>` : ''}
    <dl class="ai-list">${f.selling.rows.map(item).join('')}</dl>
    ${fillers}
    <p class="muted small-text">Ritmo, claridad, entonación y pausas describen cómo se oye la voz; no evalúan emociones ni personalidad.</p>
    ${g}
    ${a.limitations.length ? `<h3>Límites de este análisis</h3>${li(a.limitations)}` : ''}
    ${foot}</section>`;
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
