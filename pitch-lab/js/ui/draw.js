// Dibujo 2D sobre canvas para los paneles del espacio 3D.
// Se usan las tipografías reales de Publitón (Anton y Barlow) cargadas por CSS.
// Los símbolos se DIBUJAN como formas (no como texto) para no depender de glifos del sistema.

export const COLORS = {
  bg: '#181D16',
  surface: '#20261C',
  surface2: '#2A3225',
  border: '#596151',
  blue: '#0047FF',
  blueHover: '#1F5EFF',
  yellow: '#FFC94A',
  pink: '#FF006E',
  white: '#FFFFFF',
  muted: '#C5CABF',
  dark: '#11160E',
};

export const FONT = {
  display: 'Anton, "Arial Narrow", Impact, sans-serif',
  body: 'Barlow, Arial, sans-serif',
};

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Parte el texto en líneas que entren en maxWidth con la fuente actual del contexto. */
export function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) { lines.push(''); continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${line} ${words[i]}`;
      if (ctx.measureText(test).width <= maxWidth) line = test;
      else { lines.push(line); line = words[i]; }
    }
    lines.push(line);
  }
  return lines;
}

/** Texto con tracking (separación entre letras). */
export function drawSpaced(ctx, text, x, y, spacing = 0) {
  if (!spacing) { ctx.fillText(text, x, y); return ctx.measureText(text).width; }
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  return cx - x - spacing;
}

/** Dibuja líneas envueltas. Devuelve la coordenada y siguiente. */
export function drawParagraph(ctx, text, x, y, maxWidth, { size = 44, lineHeight = 1.3, color = COLORS.white, weight = 400, maxLines = Infinity } = {}) {
  ctx.font = `${weight} ${size}px ${FONT.body}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  let lines = wrapText(ctx, text, maxWidth);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  const step = size * lineHeight;
  lines.forEach((line, i) => ctx.fillText(line, x, y + size + i * step - size * 0.12));
  return y + lines.length * step;
}

/** Mide la altura que ocuparía un párrafo (sin dibujarlo). */
export function measureParagraph(ctx, text, maxWidth, { size = 44, lineHeight = 1.3, weight = 400, maxLines = Infinity } = {}) {
  ctx.font = `${weight} ${size}px ${FONT.body}`;
  const n = Math.min(maxLines, wrapText(ctx, text, maxWidth).length);
  return n * size * lineHeight;
}

// ----- Íconos dibujados con trazos -----

export function drawIcon(ctx, name, cx, cy, size, color = COLORS.white) {
  const r = size / 2;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.13);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (name) {
    case 'check':
      ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy); ctx.lineTo(cx - r * 0.12, cy + r * 0.5); ctx.lineTo(cx + r * 0.65, cy - r * 0.5); ctx.stroke();
      break;
    case 'cross':
      ctx.beginPath(); ctx.moveTo(cx - r * 0.5, cy - r * 0.5); ctx.lineTo(cx + r * 0.5, cy + r * 0.5);
      ctx.moveTo(cx + r * 0.5, cy - r * 0.5); ctx.lineTo(cx - r * 0.5, cy + r * 0.5); ctx.stroke();
      break;
    case 'half':
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.7, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); ctx.fill();
      break;
    case 'empty':
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2); ctx.stroke();
      break;
    case 'arrow':
      ctx.beginPath(); ctx.moveTo(cx - r * 0.7, cy); ctx.lineTo(cx + r * 0.7, cy);
      ctx.moveTo(cx + r * 0.1, cy - r * 0.6); ctx.lineTo(cx + r * 0.7, cy); ctx.lineTo(cx + r * 0.1, cy + r * 0.6); ctx.stroke();
      break;
    case 'diamond':
      ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.7); ctx.lineTo(cx + r * 0.7, cy); ctx.lineTo(cx, cy + r * 0.7); ctx.lineTo(cx - r * 0.7, cy); ctx.closePath(); ctx.fill();
      break;
    case 'info':
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy - r * 0.38, r * 0.1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.08); ctx.lineTo(cx, cy + r * 0.45); ctx.stroke();
      break;
    case 'warn':
      ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.85); ctx.lineTo(cx + r * 0.9, cy + r * 0.7); ctx.lineTo(cx - r * 0.9, cy + r * 0.7); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.25); ctx.lineTo(cx, cy + r * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy + r * 0.45, r * 0.07, 0, Math.PI * 2); ctx.fill();
      break;
    case 'mic':
      roundRect(ctx, cx - r * 0.28, cy - r * 0.85, r * 0.56, r * 1.05, r * 0.28); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy + r * 0.05, r * 0.6, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.65); ctx.lineTo(cx, cy + r * 0.9); ctx.stroke();
      break;
    case 'tag':
      ctx.beginPath(); ctx.moveTo(cx - r * 0.8, cy - r * 0.45); ctx.lineTo(cx + r * 0.3, cy - r * 0.45); ctx.lineTo(cx + r * 0.85, cy); ctx.lineTo(cx + r * 0.3, cy + r * 0.45); ctx.lineTo(cx - r * 0.8, cy + r * 0.45); ctx.closePath(); ctx.stroke();
      break;
    case 'pause':
      ctx.fillRect(cx - r * 0.5, cy - r * 0.6, r * 0.36, r * 1.2); ctx.fillRect(cx + r * 0.14, cy - r * 0.6, r * 0.36, r * 1.2);
      break;
    case 'plus':
      ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy); ctx.lineTo(cx + r * 0.6, cy); ctx.moveTo(cx, cy - r * 0.6); ctx.lineTo(cx, cy + r * 0.6); ctx.stroke();
      break;
    case 'minus':
      ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy); ctx.lineTo(cx + r * 0.6, cy); ctx.stroke();
      break;
    default:
      break;
  }
  ctx.restore();
}

/** Marco de aviso con ícono, etiqueta y texto. Devuelve la altura usada. */
export function drawNotice(ctx, { x, y, w, kind = 'info', label, text, size = 36, draw = true }) {
  const pad = 26;
  const iconSize = 46;
  const textX = x + pad + iconSize + 22;
  const textW = w - (textX - x) - pad;
  ctx.font = `400 ${size}px ${FONT.body}`;
  const lines = wrapText(ctx, text, textW);
  const labelH = label ? size * 0.95 : 0;
  const h = pad * 2 + labelH + lines.length * size * 1.28;
  if (!draw) return h;

  const accent = kind === 'warn' || kind === 'demo' ? COLORS.pink : kind === 'privacy' ? COLORS.yellow : COLORS.muted;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = COLORS.surface2;
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(x, y + 8, 8, h - 16);
  const icon = kind === 'warn' ? 'warn' : kind === 'privacy' ? 'mic' : kind === 'demo' ? 'tag' : 'info';
  drawIcon(ctx, icon, x + pad + iconSize / 2, y + pad + iconSize / 2 - 2, iconSize, accent);

  let ty = y + pad;
  if (label) {
    ctx.font = `700 ${size * 0.78}px ${FONT.body}`;
    ctx.fillStyle = accent;
    ctx.textBaseline = 'alphabetic';
    drawSpaced(ctx, label, textX, ty + size * 0.72, size * 0.1);
    ty += labelH;
  }
  ctx.font = `400 ${size}px ${FONT.body}`;
  ctx.fillStyle = COLORS.white;
  lines.forEach((line, i) => ctx.fillText(line, textX, ty + size * 0.95 + i * size * 1.28 - size * 0.15));
  return h;
}

/** Fondo con trama sutil para el estado "no disponible" (no depende solo del color). */
export function hatch(ctx, x, y, w, h, color = '#ffffff1a') {
  ctx.save();
  roundRect(ctx, x, y, w, h, 12);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  for (let i = -h; i < w; i += 22) {
    ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.stroke();
  }
  ctx.restore();
}
