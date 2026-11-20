// Dibujo de un botón del espacio 3D según su tipo y estado.
// Tipos: primary, secondary, danger, toggle, choice, tab, rubric.
// Estados: hover (apuntado), pressed, disabled, "on" (activado) y progress (avance de «mantené presionado»).
// El estado nunca se transmite solo con color: hay texto, formas y trama.
//
// Tamaño mínimo de letra (`minFont`, en píxeles del lienzo del botón): depende de la distancia a la que se
// mira cada superficie. El atril se mira a ~1,6 m y el panel a ~2,2 m; ver tests/e2e/legibilidad.mjs.

import { COLORS, FONT, roundRect, drawIcon, hatch, wrapText } from './draw.js';

export const DEFAULT_MIN_FONT = 36;

/** Elige un tamaño de fuente que entre en el ancho dado (hasta 2 líneas si hay alto). Nunca baja de `minFont`. */
function fitLabel(ctx, text, maxW, maxH, startSize, minFont, weight = 700) {
  const start = Math.max(startSize, minFont);
  for (let size = start; size >= minFont; size -= 2) {
    ctx.font = `${weight} ${size}px ${FONT.body}`;
    if (ctx.measureText(text).width <= maxW) return { size, lines: [text] };
    if (maxH >= size * 2.5) {
      const lines = wrapText(ctx, text, maxW);
      if (lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= maxW)) return { size, lines };
    }
  }
  ctx.font = `${weight} ${minFont}px ${FONT.body}`;
  return { size: minFont, lines: wrapText(ctx, text, maxW).slice(0, 2) };
}

export function drawButton(ctx, w, h, action, { hover = false, pressed = false, progress = 0, minFont = DEFAULT_MIN_FONT } = {}) {
  const kind = action.kind || 'secondary';
  const disabled = !!action.disabled;
  const on = !!action.on;
  const r = Math.min(26, h * 0.24);
  const bw = hover ? 6 : 3;
  const inset = bw / 2 + 1;
  const x = inset, y = inset, bw2 = w - inset * 2, bh = h - inset * 2;

  ctx.save();
  if (disabled) ctx.globalAlpha = 0.62;

  // --- Fondo ---
  let fill = COLORS.surface2;
  let border = hover ? COLORS.yellow : COLORS.border;
  let textColor = COLORS.white;
  if (kind === 'primary') { fill = hover ? COLORS.blueHover : COLORS.blue; border = hover ? COLORS.yellow : COLORS.blue; }
  else if (kind === 'danger') { fill = COLORS.surface; border = COLORS.pink; if (hover) fill = '#3a1d2b'; }
  else if (kind === 'tab') { fill = on ? COLORS.yellow : COLORS.surface2; textColor = on ? COLORS.bg : COLORS.white; border = on ? COLORS.yellow : (hover ? COLORS.yellow : COLORS.border); }
  else if (kind === 'choice' && on) { border = COLORS.yellow; fill = '#323B2C'; }
  else if (hover) fill = '#343D2E';
  if (kind === 'secondary' && on) border = COLORS.yellow;
  if (pressed) fill = kind === 'primary' ? '#0035bf' : '#1d2418';

  roundRect(ctx, x, y, bw2, bh, r);
  ctx.fillStyle = fill;
  ctx.fill();

  // Avance de «mantené presionado»: una franja clara que crece de izquierda a derecha, con el borde en amarillo.
  if (progress > 0) {
    ctx.save();
    roundRect(ctx, x, y, bw2, bh, r);
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 233, 176, 0.5)';
    ctx.fillRect(x, y, bw2 * Math.min(1, progress), bh);
    ctx.restore();
  }

  if (disabled) ctx.setLineDash([14, 10]);
  ctx.lineWidth = bw;
  ctx.strokeStyle = progress > 0 ? COLORS.yellow : border;
  ctx.stroke();
  ctx.setLineDash([]);
  if (disabled) hatch(ctx, x, y, bw2, bh);

  // --- Contenido ---
  const padX = Math.max(22, h * 0.26);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textColor;
  const cy = h / 2;

  if (kind === 'toggle' || kind === 'rubric' || kind === 'choice') {
    const lead = kind === 'rubric' ? h * 0.62 : kind === 'choice' ? h * 0.4 : 0;
    const trail = kind === 'toggle' ? Math.min(w * 0.3, 200) : 0;
    const textX = padX + (lead ? lead + 18 : 0);
    const maxW = w - textX - padX - (trail ? trail + 12 : 0);

    if (kind === 'choice') {
      ctx.strokeStyle = on ? COLORS.yellow : COLORS.muted;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(padX + lead / 2, cy, lead * 0.4, 0, Math.PI * 2); ctx.stroke();
      if (on) { ctx.fillStyle = COLORS.yellow; ctx.beginPath(); ctx.arc(padX + lead / 2, cy, lead * 0.21, 0, Math.PI * 2); ctx.fill(); }
    }
    if (kind === 'rubric') {
      ctx.strokeStyle = on ? COLORS.yellow : COLORS.muted;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(padX + lead / 2, cy, lead * 0.46, 0, Math.PI * 2); ctx.stroke();
      drawIcon(ctx, action.icon || 'empty', padX + lead / 2, cy, lead * 0.62, on ? COLORS.yellow : COLORS.muted);
    }

    const { size, lines } = fitLabel(ctx, action.label, maxW, kind === 'rubric' ? bh * 0.62 : bh, Math.min(48, h * 0.42), minFont);
    ctx.fillStyle = textColor;
    ctx.font = `700 ${size}px ${FONT.body}`;
    const valueSize = Math.max(Math.round(minFont * 0.9), size * 0.8);
    const blockH = lines.length * size * 1.15 + (kind === 'rubric' ? valueSize * 1.2 : 0);
    let ty = cy - blockH / 2 + size * 0.58;
    for (const line of lines) { ctx.fillText(line, textX, ty); ty += size * 1.15; }
    if (kind === 'rubric') {
      ctx.font = `700 ${valueSize}px ${FONT.body}`;
      ctx.fillStyle = on ? COLORS.yellow : COLORS.muted;
      ctx.fillText(action.value || '', textX, ty + valueSize * 0.15);
    }

    if (kind === 'toggle') {
      const sw = Math.min(trail, 150), sh = Math.min(sw * 0.5, bh * 0.52);
      const sx = w - padX - sw, sy = cy - sh / 2;
      ctx.font = `700 ${Math.max(minFont, sh * 0.7)}px ${FONT.body}`;
      ctx.fillStyle = on ? COLORS.yellow : COLORS.muted;
      ctx.textAlign = 'right';
      ctx.fillText(on ? 'SÍ' : 'NO', sx - 16, cy + 2);
      ctx.textAlign = 'left';
      roundRect(ctx, sx, sy, sw, sh, sh / 2);
      ctx.fillStyle = on ? COLORS.yellow : COLORS.surface;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = on ? COLORS.yellow : COLORS.muted;
      ctx.stroke();
      const knob = sh * 0.72;
      ctx.fillStyle = on ? COLORS.bg : COLORS.muted;
      ctx.beginPath(); ctx.arc(on ? sx + sw - sh / 2 : sx + sh / 2, cy, knob / 2, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    const centered = kind === 'tab';
    const iconName = action.icon || (kind === 'primary' ? 'arrow' : kind === 'danger' ? 'cross' : null);
    const iconSpace = iconName ? h * 0.5 : 0;
    const maxW = w - padX * 2 - iconSpace;
    // Con «mantené presionado» hay una segunda línea de ayuda debajo del nombre.
    const hintSize = action.hold ? minFont : 0;
    const { size, lines } = fitLabel(ctx, action.label, maxW, bh - (hintSize ? hintSize * 1.1 : 0), Math.min(56, h * 0.42), minFont);
    ctx.font = `700 ${size}px ${FONT.body}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = centered ? 'center' : 'left';
    const tx = centered ? w / 2 : padX;
    const hintH = hintSize ? hintSize * 1.25 : 0;
    const blockH = lines.length * size * 1.15 + hintH;
    let ty = cy - blockH / 2 + size * 0.58;
    for (const line of lines) { ctx.fillText(line, tx, ty); ty += size * 1.15; }
    if (hintSize) {
      ctx.font = `700 ${hintSize}px ${FONT.body}`;
      let hint = 'MANTENÉ PRESIONADO';
      if (ctx.measureText(hint).width > maxW) hint = 'MANTENÉ';
      ctx.fillStyle = kind === 'primary' ? '#FFE9B0' : COLORS.yellow;
      ctx.fillText(hint, tx, ty - size * 0.58 + hintSize * 0.7);
    }
    ctx.textAlign = 'left';
    if (iconName) drawIcon(ctx, iconName, w - padX - h * 0.18, cy, h * 0.36, kind === 'danger' ? COLORS.pink : textColor);
  }
  ctx.restore();
}
