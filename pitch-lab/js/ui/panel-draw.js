// Dibujo del panel informativo, el atril, el reloj y la pantalla del brief.
// Todo se dibuja con las tipografías de Publitón: Anton para títulos y Barlow para texto.

import {
  COLORS, FONT, roundRect, wrapText, drawSpaced, drawParagraph, measureParagraph, drawIcon, drawNotice,
} from './draw.js';
import { WARNING_LABELS } from '../core/time-warnings.js';

// ---------- Panel informativo (2048 × 1152) ----------

export const PANEL = { W: 2048, H: 1152, margin: 84, optionsX: 1130, optionsW: 830 };

/**
 * Dibuja el panel. `k` escala todas las tipografías (1 = tamaño grande, para leer a ~2 m en VR).
 * Con draw = false solo mide. Devuelve la coordenada y donde terminó el contenido.
 */
export function drawPanel(ctx, W, H, panel, { hasOptions, k = 1, draw = true }) {
  const m = PANEL.margin;
  const contentW = hasOptions ? PANEL.optionsX - m - 40 : W - m * 2;

  if (draw) {
    roundRect(ctx, 6, 6, W - 12, H - 12, 40);
    ctx.fillStyle = '#181D16';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = COLORS.border;
    ctx.stroke();
    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(m, 6, 150, 10); // marca amarilla superior, como en las tarjetas del sitio
  }

  let y = 62;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${Math.round(34 * Math.max(k, 0.85))}px ${FONT.body}`;
  ctx.fillStyle = COLORS.muted;
  if (draw) drawSpaced(ctx, panel.eyebrow || '', m, y + 30, 4);
  y += 64;

  // Título (Anton). La última línea va en amarillo cuando hay más de una. Se ajusta al ancho disponible.
  let titleSize = Math.round((panel.title.length > 1 ? 150 : 160) * k);
  ctx.font = `400 ${titleSize}px ${FONT.display}`;
  const widest = Math.max(...panel.title.map((l) => ctx.measureText(l).width), 1);
  if (widest > contentW) titleSize = Math.floor(titleSize * (contentW / widest));
  ctx.font = `400 ${titleSize}px ${FONT.display}`;
  if (draw) {
    panel.title.forEach((line, i) => {
      ctx.fillStyle = panel.title.length > 1 && i === panel.title.length - 1 ? COLORS.yellow : COLORS.white;
      ctx.fillText(line, m, y + titleSize * 0.9 + i * titleSize * 0.98);
    });
  }
  y += panel.title.length * titleSize * 0.98 + 34 * k;

  const bottom = H - 64;
  for (const block of panel.blocks) {
    y = drawBlock(ctx, block, m, y, contentW, bottom, k, draw) + 26 * k;
  }
  return y;
}

/** Elige el mayor tamaño de letra con el que todo el contenido entra en el panel. */
export function fitPanel(ctx, W, H, panel, hasOptions) {
  for (let k = 1; k >= 0.58; k -= 0.06) {
    const end = drawPanel(ctx, W, H, panel, { hasOptions, k, draw: false });
    if (end <= H - 56) return k;
  }
  return 0.58;
}

function drawBlock(ctx, block, x, y, w, bottom, k, draw) {
  const sz = (n) => Math.round(n * k);
  // En modo medición (draw = false) se usa measureParagraph sin pintar.
  const para = (text, px, py, pw, opts) => (draw
    ? drawParagraph(ctx, text, px, py, pw, opts)
    : py + measureParagraph(ctx, text, pw, opts));

  switch (block.t) {
    case 'p':
      return para(block.text, x, y, w, { size: sz(64), lineHeight: 1.2, color: block.tone === 'muted' ? COLORS.muted : COLORS.white });

    case 'bullets': {
      let cy = y;
      if (block.heading) {
        ctx.font = `700 ${sz(34)}px ${FONT.body}`;
        ctx.fillStyle = COLORS.yellow;
        if (draw) drawSpaced(ctx, block.heading.toUpperCase(), x, cy + sz(30), 3);
        cy += sz(58);
      }
      for (const item of block.items) {
        if (draw) drawIcon(ctx, 'diamond', x + sz(16), cy + sz(32), sz(30), COLORS.yellow);
        cy = para(item, x + sz(56), cy, w - sz(56), { size: sz(58), lineHeight: 1.18 }) + sz(14);
      }
      return cy;
    }

    case 'kv': {
      let cy = y;
      for (const row of block.rows) {
        ctx.font = `700 ${sz(48)}px ${FONT.body}`;
        const lines = wrapText(ctx, row.v, w * 0.6);
        if (draw) {
          ctx.font = `400 ${sz(42)}px ${FONT.body}`;
          ctx.fillStyle = COLORS.muted;
          ctx.fillText(row.k, x, cy + sz(46));
          ctx.font = `700 ${sz(48)}px ${FONT.body}`;
          ctx.fillStyle = COLORS.white;
          ctx.textAlign = 'right';
          lines.forEach((l, i) => ctx.fillText(l, x + w, cy + sz(46) + i * sz(56)));
          ctx.textAlign = 'left';
        }
        cy += Math.max(sz(78), lines.length * sz(56) + sz(22));
        if (draw) { ctx.fillStyle = COLORS.border; ctx.fillRect(x, cy - 10, w, 2); }
      }
      return cy;
    }

    case 'fields': {
      let cy = y;
      for (const row of block.rows) {
        ctx.font = `700 ${sz(32)}px ${FONT.body}`;
        ctx.fillStyle = COLORS.yellow;
        if (draw) drawSpaced(ctx, row.k.toUpperCase(), x, cy + sz(28), 3);
        cy = para(row.v, x, cy + sz(40), w, { size: sz(50), lineHeight: 1.16, maxLines: 3 }) + sz(16);
      }
      return cy;
    }

    case 'notice': {
      const h = drawNotice(ctx, { x, y, w, kind: block.kind, label: block.label, text: block.text, size: sz(44), draw });
      return y + h;
    }

    case 'tag': {
      ctx.font = `700 ${sz(32)}px ${FONT.body}`;
      const tw = ctx.measureText(block.text.toUpperCase()).width + sz(80);
      const th = sz(60);
      if (draw) {
        roundRect(ctx, x, y, tw, th, th / 2);
        ctx.fillStyle = block.source === 'demo' ? COLORS.pink : COLORS.surface2;
        ctx.fill();
        ctx.strokeStyle = block.source === 'demo' ? COLORS.pink : COLORS.border;
        ctx.lineWidth = 3;
        ctx.stroke();
        drawIcon(ctx, block.source === 'demo' ? 'tag' : 'mic', x + sz(34), y + th / 2, sz(30), COLORS.white);
        ctx.fillStyle = COLORS.white;
        ctx.textBaseline = 'middle';
        ctx.fillText(block.text.toUpperCase(), x + sz(62), y + th / 2 + 2);
        ctx.textBaseline = 'alphabetic';
      }
      return y + th;
    }

    case 'quote': {
      const size = sz(48);
      const maxLines = Math.max(2, Math.floor((bottom - y - sz(260)) / (size * 1.28)));
      const opts = { size, lineHeight: 1.28, maxLines };
      const boxH = Math.min(measureParagraph(ctx, block.text, w - 60, opts) + 44, bottom - y);
      if (draw) {
        roundRect(ctx, x, y, w, boxH, 16);
        ctx.fillStyle = COLORS.surface;
        ctx.fill();
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 3;
        ctx.stroke();
        drawParagraph(ctx, block.text, x + 30, y + 16, w - 60, opts);
      }
      return y + boxH;
    }

    case 'meter': {
      const by = y + sz(64), bw = w * 0.7, bh = sz(40);
      if (draw) {
        ctx.font = `700 ${sz(40)}px ${FONT.body}`;
        ctx.fillStyle = COLORS.muted;
        ctx.fillText(block.label, x, y + sz(40));
        roundRect(ctx, x, by, bw, bh, bh / 2);
        ctx.fillStyle = COLORS.surface2;
        ctx.fill();
        roundRect(ctx, x, by, Math.max(bh, bw * block.value), bh, bh / 2);
        ctx.fillStyle = COLORS.yellow;
        ctx.fill();
        ctx.font = `700 ${sz(54)}px ${FONT.body}`;
        ctx.fillStyle = COLORS.white;
        ctx.fillText(block.text, x + bw + 28, by + bh - 4);
      }
      return by + bh + 10;
    }

    case 'measures': {
      let cy = y;
      const rowH = sz(92);
      for (const row of block.rows) {
        if (draw) {
          ctx.font = `700 ${sz(46)}px ${FONT.body}`;
          ctx.fillStyle = row.available ? COLORS.white : COLORS.muted;
          ctx.fillText(row.label, x, cy + sz(40));
          ctx.font = `700 ${sz(50)}px ${FONT.body}`;
          ctx.textAlign = 'right';
          ctx.fillStyle = row.available ? COLORS.yellow : COLORS.muted;
          ctx.fillText(row.display, x + w, cy + sz(42));
          ctx.textAlign = 'left';
          if (row.note) {
            ctx.font = `400 ${sz(34)}px ${FONT.body}`;
            ctx.fillStyle = COLORS.muted;
            let note = row.note;
            while (note.length > 4 && ctx.measureText(note).width > w) note = `${note.slice(0, -2).trimEnd()}…`;
            ctx.fillText(note, x, cy + sz(78));
          }
          ctx.fillStyle = COLORS.border;
          ctx.fillRect(x, cy + rowH - 8, w, 2);
        }
        cy += rowH;
      }
      return cy;
    }

    case 'indicator': {
      const h = sz(170);
      if (draw) {
        roundRect(ctx, x, y, w, h, 18);
        ctx.fillStyle = COLORS.surface;
        ctx.fill();
        ctx.strokeStyle = block.value == null ? COLORS.border : COLORS.yellow;
        ctx.lineWidth = 4;
        if (block.value == null) ctx.setLineDash([16, 10]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `700 ${sz(30)}px ${FONT.body}`;
        ctx.fillStyle = COLORS.muted;
        drawSpaced(ctx, block.label.toUpperCase(), x + 28, y + sz(44), 3);
        if (block.value == null) {
          ctx.font = `400 ${sz(78)}px ${FONT.display}`;
          ctx.fillStyle = COLORS.white;
          ctx.fillText('SIN DATOS SUFICIENTES', x + 28, y + sz(124));
          ctx.font = `400 ${sz(30)}px ${FONT.body}`;
          ctx.fillStyle = COLORS.muted;
          let note = block.note;
          while (note.length > 4 && ctx.measureText(note).width > w - 56) note = `${note.slice(0, -2).trimEnd()}…`;
          ctx.fillText(note, x + 28, y + sz(158));
        } else {
          ctx.font = `400 ${sz(112)}px ${FONT.display}`;
          ctx.fillStyle = COLORS.yellow;
          ctx.fillText(String(block.value), x + 28, y + sz(134));
          const nw = ctx.measureText(String(block.value)).width;
          ctx.font = `700 ${sz(46)}px ${FONT.body}`;
          ctx.fillStyle = COLORS.muted;
          ctx.fillText('/ 100', x + 44 + nw, y + sz(134));
          ctx.font = `400 ${sz(30)}px ${FONT.body}`;
          const lines = wrapText(ctx, block.note, w - sz(420));
          lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, x + sz(400), y + sz(90) + i * sz(38)));
        }
      }
      return y + h;
    }

    case 'tips': {
      let cy = y;
      block.items.forEach((tip, i) => {
        if (draw) {
          ctx.font = `400 ${sz(72)}px ${FONT.display}`;
          ctx.fillStyle = COLORS.yellow;
          ctx.fillText(String(i + 1), x, cy + sz(64));
        }
        cy = para(tip.text, x + sz(64), cy, w - sz(64), { size: sz(48), lineHeight: 1.18 });
        if (draw) {
          ctx.font = `400 ${sz(34)}px ${FONT.body}`;
          ctx.fillStyle = COLORS.muted;
          ctx.fillText(`Basado en: ${tip.basedOn}`, x + sz(64), cy + sz(26));
        }
        cy += sz(54);
      });
      return cy;
    }

    default:
      return y;
  }
}

// ---------- Atril: cara de control (1300 × 560) ----------

export const LECTERN = { W: 1300, H: 560 };

export function drawLecternFace(ctx, W, H, lectern) {
  roundRect(ctx, 4, 4, W - 8, H - 8, 30);
  ctx.fillStyle = COLORS.surface;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = COLORS.border;
  ctx.stroke();

  // Estado
  ctx.fillStyle = COLORS.yellow;
  ctx.fillRect(34, 34, 18, 18);
  ctx.font = `700 34px ${FONT.body}`;
  ctx.fillStyle = COLORS.yellow;
  ctx.textBaseline = 'alphabetic';
  drawSpaced(ctx, lectern.status || '', 66, 54, 4);

  // Pista (hasta 3 líneas)
  drawParagraph(ctx, lectern.hint || '', 34, 70, 940, { size: 34, lineHeight: 1.2, color: COLORS.white, maxLines: 3 });

  // Separador de utilidades
  ctx.fillStyle = COLORS.border;
  ctx.fillRect(1010, 34, 3, H - 68);
}

// ---------- Reloj (1440 × 560) ----------

export const CLOCK = { W: 1440, H: 560 };

export function drawClock(ctx, W, H, clock) {
  const warn = clock.warning;
  const border = warn === 'final' ? COLORS.pink : warn === 'warning' ? COLORS.yellow : COLORS.border;
  const bw = warn === 'final' ? 16 : warn === 'warning' ? 12 : 6;

  roundRect(ctx, bw / 2, bw / 2, W - bw, H - bw, 34);
  ctx.fillStyle = COLORS.dark;
  ctx.fill();
  ctx.lineWidth = bw;
  ctx.strokeStyle = border;
  if (warn === 'warning') ctx.setLineDash([46, 22]); // trazo cortado = poco tiempo
  ctx.stroke();
  ctx.setLineDash([]);

  // Etiqueta
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 44px ${FONT.body}`;
  ctx.fillStyle = COLORS.muted;
  drawSpaced(ctx, clock.label || '', 60, 90, 6);

  // Pausa: dibujo de pausa además del texto
  if (clock.paused) drawIcon(ctx, 'pause', W - 90, 70, 56, COLORS.yellow);

  // Tiempo
  ctx.font = `400 330px ${FONT.display}`;
  ctx.fillStyle = warn === 'final' ? COLORS.pink : warn === 'warning' ? COLORS.yellow : COLORS.white;
  ctx.textAlign = 'center';
  ctx.fillText(clock.time || '0:00', W / 2, 395);
  ctx.textAlign = 'left';

  // Sub etiqueta con ícono para los avisos
  ctx.font = `700 44px ${FONT.body}`;
  ctx.fillStyle = warn === 'none' || warn === 'ok' ? COLORS.muted : COLORS.white;
  let sx = 60;
  if (warn === 'warning' || warn === 'final') {
    drawIcon(ctx, 'warn', 90, 462, 56, warn === 'final' ? COLORS.pink : COLORS.yellow);
    sx = 140;
  }
  drawSpaced(ctx, (clock.sub || '').toUpperCase(), sx, 478, 4);

  // Progreso
  const px = 60, py = H - 56, pw = W - 120, ph = 24;
  roundRect(ctx, px, py, pw, ph, 12);
  ctx.fillStyle = COLORS.surface2;
  ctx.fill();
  if (clock.progress > 0) {
    roundRect(ctx, px, py, Math.max(ph, pw * Math.min(1, clock.progress)), ph, 12);
    ctx.fillStyle = warn === 'final' ? COLORS.pink : COLORS.yellow;
    ctx.fill();
  }
}

// ---------- Pantalla del brief (1920 × 1080) ----------

export const BRIEF = { W: 1920, H: 1080 };

export function drawBriefScreen(ctx, W, H, brief, scenarioName) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COLORS.blue;
  ctx.fillRect(0, 0, W, 14);

  const m = 90;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 38px ${FONT.body}`;
  ctx.fillStyle = COLORS.yellow;
  drawSpaced(ctx, `BRIEF · ${(scenarioName || '').toUpperCase()}`, m, 100, 6);

  // Etiqueta de marca ficticia
  ctx.font = `700 30px ${FONT.body}`;
  const label = 'MARCA FICTICIA';
  const lw = ctx.measureText(label).width + 90;
  roundRect(ctx, W - m - lw, 56, lw, 56, 28);
  ctx.fillStyle = COLORS.pink;
  ctx.fill();
  ctx.fillStyle = COLORS.white;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, W - m - lw + 45, 86);
  ctx.textBaseline = 'alphabetic';

  // Marca
  ctx.font = `400 190px ${FONT.display}`;
  ctx.fillStyle = COLORS.white;
  ctx.fillText(brief.brand.toUpperCase(), m, 300);
  ctx.font = `400 40px ${FONT.body}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(brief.brandNote.replace('Marca ficticia · ', '').toUpperCase(), m, 360);

  // Campos 2 × 2
  const fields = [
    ['Problema', brief.problem], ['Público', brief.audience],
    ['Objetivo', brief.objective], ['Restricción creativa', brief.constraint],
  ];
  const colW = (W - m * 2 - 70) / 2;
  fields.forEach(([k, v], i) => {
    const fx = m + (i % 2) * (colW + 70);
    const fy = 430 + Math.floor(i / 2) * 250;
    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(fx, fy, 70, 8);
    ctx.font = `700 32px ${FONT.body}`;
    drawSpaced(ctx, k.toUpperCase(), fx, fy + 52, 4);
    drawParagraph(ctx, v, fx, fy + 66, colW, { size: 42, lineHeight: 1.2, maxLines: 4 });
  });

  // Guía
  ctx.fillStyle = COLORS.surface;
  ctx.fillRect(0, H - 120, W, 120);
  ctx.font = `700 30px ${FONT.body}`;
  ctx.fillStyle = COLORS.yellow;
  drawSpaced(ctx, 'QUÉ PRESENTAR', m, H - 62, 4);
  ctx.font = `400 36px ${FONT.body}`;
  ctx.fillStyle = COLORS.white;
  let text = brief.guide;
  const maxW = W - m * 2 - 340;
  while (text.length > 4 && ctx.measureText(text).width > maxW) text = `${text.slice(0, -2).trimEnd()}…`;
  ctx.fillText(text, m + 330, H - 60);
}

export function drawBriefCompact(ctx, W, H, brief) {
  roundRect(ctx, 4, 4, W - 8, H - 8, 28);
  ctx.fillStyle = COLORS.dark;
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 30px ${FONT.body}`;
  ctx.fillStyle = COLORS.yellow;
  drawSpaced(ctx, 'TU BRIEF · MARCA FICTICIA', 40, 62, 4);
  ctx.font = `400 96px ${FONT.display}`;
  ctx.fillStyle = COLORS.white;
  ctx.fillText(brief.brand.toUpperCase(), 40, 170);
  drawParagraph(ctx, `Restricción: ${brief.constraint}`, 40, 196, W - 80, { size: 34, lineHeight: 1.2, maxLines: 2, color: COLORS.muted });
}

// ---------- Cartel genérico ----------

export function drawSign(ctx, W, H, { text, sub, bg = COLORS.dark, fg = COLORS.white, accent = COLORS.yellow, size = 0.55, align = 'center' }) {
  ctx.clearRect(0, 0, W, H);
  if (bg) { roundRect(ctx, 0, 0, W, H, Math.min(W, H) * 0.08); ctx.fillStyle = bg; ctx.fill(); }
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = align === 'center' ? 'center' : 'left';
  const tx = align === 'center' ? W / 2 : H * 0.18;
  const fs = H * size;
  ctx.font = `400 ${fs}px ${FONT.display}`;
  ctx.fillStyle = fg;
  ctx.fillText(text, tx, sub ? H * 0.58 : H * 0.5 + fs * 0.34);
  if (sub) {
    ctx.font = `700 ${H * 0.16}px ${FONT.body}`;
    ctx.fillStyle = accent;
    ctx.fillText(sub.toUpperCase(), tx, H * 0.84);
  }
  ctx.textAlign = 'left';
}

export { WARNING_LABELS };
