// Dibujo del panel informativo, el atril, el reloj y la pantalla del brief.
// Todo se dibuja con las tipografías de Publitón: Anton para títulos y Barlow para texto.
//
// TAMAÑO DEL TEXTO (UX for XR: «evitá el texto chico»). Estos dibujos son lo único que se puede leer dentro de un
// casco, así que cada texto tiene un mínimo medido en grados (altura de mayúsculas vista desde el punto de inicio):
//   - panel (a ~2,2 m, escala 1,3): mínimo 46 px del lienzo  ≈ 0,8°
//   - atril (a ~1,6 m): mínimo 36 px                         ≈ 0,9°
// El criterio y la medición están en tests/e2e/legibilidad.mjs y docs/auditoria-ux-xr.md.
// Si un contenido no entra con esos tamaños se RECORTA el texto, no se achica la letra.

import {
  COLORS, FONT, roundRect, wrapText, drawSpaced, drawParagraph, measureParagraph, drawIcon, drawNotice,
} from './draw.js';

// ---------- Panel informativo (2048 × 1152) ----------

export const PANEL = { W: 2048, H: 1152, margin: 84, optionsX: 1130, optionsW: 830 };
export const MIN_FONT_PANEL = 46;
export const MIN_FONT_LECTERN = 36;

/** Distribución de las opciones en dos columnas debajo del encabezado (pantalla de ajustes). */
export const GRID = { top: 600, gap: 22, cols: 2, bottomMargin: 56 };

/** Tamaño de letra del panel: escala con `k` pero nunca baja del mínimo legible. */
const fontSize = (n, k) => Math.max(MIN_FONT_PANEL, Math.round(n * k));

/**
 * Dibuja el panel. `k` escala los textos principales (1 = tamaño grande, para leer a ~2 m en VR). Los textos nunca
 * bajan de MIN_FONT_PANEL. Con draw = false solo mide. Devuelve la coordenada y donde terminó el contenido.
 */
export function drawPanel(ctx, W, H, panel, { hasOptions, k = 1, draw = true, dropped = null }) {
  const m = PANEL.margin;
  const grid = panel.layout === 'grid';
  const contentW = hasOptions && !grid ? PANEL.optionsX - m - 40 : W - m * 2;

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
  ctx.font = `700 ${MIN_FONT_PANEL}px ${FONT.body}`;
  ctx.fillStyle = COLORS.muted;
  if (draw) drawSpaced(ctx, panel.eyebrow || '', m, y + 36, 4);
  y += 70;

  // Título (Anton). La última línea va en amarillo cuando hay más de una. Se ajusta al ancho disponible.
  // En la pantalla de dos columnas el título va en una sola línea para dejar lugar a las opciones.
  const lines = grid ? [panel.title.join(' ')] : panel.title;
  const kt = Math.min(k, 1); // el título no crece cuando hay lugar de sobra: solo el cuerpo
  let titleSize = Math.round((grid ? 120 : lines.length > 1 ? 150 : 160) * kt);
  ctx.font = `400 ${titleSize}px ${FONT.display}`;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
  if (widest > contentW) titleSize = Math.floor(titleSize * (contentW / widest));
  ctx.font = `400 ${titleSize}px ${FONT.display}`;
  if (draw) {
    lines.forEach((line, i) => {
      ctx.fillStyle = lines.length > 1 && i === lines.length - 1 ? COLORS.yellow : COLORS.white;
      ctx.fillText(line, m, y + titleSize * 0.9 + i * titleSize * 0.98);
    });
  }
  y += lines.length * titleSize * 0.98 + 34 * kt;

  const bottom = grid ? GRID.top - 16 : H - 64;
  panel.blocks.filter((b) => !b.htmlOnly).forEach((block, i) => {
    if (dropped?.has(i)) return; // no entra con letra legible: se omite y se avisa abajo
    y = drawBlock(ctx, block, m, y, contentW, bottom, k, draw) + 26 * k;
  });
  if (dropped?.size) y = drawBlock(ctx, { t: 'p', tone: 'muted', size: 46, text: MORE_DETAIL }, m, y, contentW, bottom, k, draw) + 26 * k;
  return y;
}

/** Aviso cuando se omitió contenido del panel 3D para no achicar la letra (el panel de texto lo muestra completo). */
export const MORE_DETAIL = 'Más detalle: panel de texto (tecla T).';

/** Límite de contenido hasta el que puede llegar el panel (después hay opciones en dos columnas o el borde). */
export function panelLimit(panel, H = PANEL.H) {
  return panel.layout === 'grid' ? GRID.top - 16 : H - 56;
}

/**
 * Elige cómo dibujar el panel para que todo entre SIN bajar de la letra mínima: si sobra lugar agranda el cuerpo del
 * texto (hasta 1,3: más cómodo de leer), si falta lo achica un poco (hasta 0,8) y, si no alcanza, omite desde el final
 * los bloques marcados `optional3D` (el panel de texto los muestra siempre). Devuelve { k, dropped }.
 */
export function fitPanel(ctx, W, H, panel, hasOptions) {
  const limit = panelLimit(panel, H);
  const blocks = panel.blocks.filter((b) => !b.htmlOnly);
  const optional = blocks.map((b, i) => (b.optional3D ? i : -1)).filter((i) => i >= 0);
  for (let drop = 0; drop <= optional.length; drop++) {
    const dropped = new Set(optional.slice(optional.length - drop));
    for (let k = 1.3; k >= 0.8; k -= 0.05) {
      const end = drawPanel(ctx, W, H, panel, { hasOptions, k, draw: false, dropped });
      if (end <= limit) return { k, dropped };
    }
  }
  return { k: 0.8, dropped: new Set(optional) };
}

function drawBlock(ctx, block, x, y, w, bottom, k, draw) {
  const sz = (n) => Math.round(n * k);          // geometría (separaciones, íconos)
  const fs = (n) => fontSize(n, k);              // letra (con mínimo)
  // En modo medición (draw = false) se usa measureParagraph sin pintar.
  const para = (text, px, py, pw, opts) => (draw
    ? drawParagraph(ctx, text, px, py, pw, opts)
    : py + measureParagraph(ctx, text, pw, opts));

  switch (block.t) {
    case 'p':
      return para(block.text, x, y, w, { size: fs(block.size || 64), lineHeight: 1.2, color: block.tone === 'muted' ? COLORS.muted : COLORS.white });

    case 'bullets': {
      let cy = y;
      if (block.heading) {
        const hf = fs(44);
        ctx.font = `700 ${hf}px ${FONT.body}`;
        ctx.fillStyle = COLORS.yellow;
        if (draw) drawSpaced(ctx, block.heading.toUpperCase(), x, cy + hf * 0.9, 3);
        cy += hf * 1.4;
      }
      const f = fs(58);
      for (const item of (block.max3D ? block.items.slice(0, block.max3D) : block.items)) {
        if (draw) drawIcon(ctx, 'diamond', x + f * 0.28, cy + f * 0.6, f * 0.52, COLORS.yellow);
        cy = para(item, x + f * 0.95, cy, w - f * 0.95, { size: f, lineHeight: 1.18 }) + sz(14);
      }
      return cy;
    }

    case 'kv': {
      let cy = y;
      const lf = fs(44);
      const vf = fs(48);
      for (const row of block.rows) {
        ctx.font = `700 ${vf}px ${FONT.body}`;
        const lines = wrapText(ctx, row.v, w * 0.6);
        if (draw) {
          ctx.font = `400 ${lf}px ${FONT.body}`;
          ctx.fillStyle = COLORS.muted;
          ctx.fillText(row.k, x, cy + vf * 0.95);
          ctx.font = `700 ${vf}px ${FONT.body}`;
          ctx.fillStyle = COLORS.white;
          ctx.textAlign = 'right';
          lines.forEach((l, i) => ctx.fillText(l, x + w, cy + vf * 0.95 + i * vf * 1.18));
          ctx.textAlign = 'left';
        }
        cy += Math.max(vf * 1.55, lines.length * vf * 1.18 + sz(24));
        if (draw) { ctx.fillStyle = COLORS.border; ctx.fillRect(x, cy - 10, w, 2); }
      }
      return cy;
    }

    case 'fields': {
      let cy = y;
      const lf = fs(42);
      const vf = fs(block.small ? 44 : 50);
      for (const row of block.rows) {
        ctx.font = `700 ${lf}px ${FONT.body}`;
        ctx.fillStyle = COLORS.yellow;
        if (draw) drawSpaced(ctx, row.k.toUpperCase(), x, cy + lf * 0.85, 3);
        cy = para(row.v, x, cy + lf * 1.15, w, { size: vf, lineHeight: 1.16, maxLines: block.small ? 2 : 3 }) + sz(block.small ? 12 : 18);
      }
      return cy;
    }

    case 'notice': {
      const h = drawNotice(ctx, { x, y, w, kind: block.kind, label: block.label, text: block.text3D || block.text, size: fs(44), draw });
      return y + h;
    }

    case 'tag': {
      const f = fs(42);
      ctx.font = `700 ${f}px ${FONT.body}`;
      const tw = ctx.measureText(block.text.toUpperCase()).width + f * 2.1;
      const th = f * 1.55;
      if (draw) {
        roundRect(ctx, x, y, tw, th, th / 2);
        ctx.fillStyle = block.source === 'demo' ? COLORS.pink : COLORS.surface2;
        ctx.fill();
        ctx.strokeStyle = block.source === 'demo' ? COLORS.pink : COLORS.border;
        ctx.lineWidth = 3;
        ctx.stroke();
        drawIcon(ctx, block.source === 'demo' ? 'tag' : 'mic', x + f * 0.95, y + th / 2, f * 0.8, COLORS.white);
        ctx.fillStyle = COLORS.white;
        ctx.textBaseline = 'middle';
        ctx.fillText(block.text.toUpperCase(), x + f * 1.6, y + th / 2 + 2);
        ctx.textBaseline = 'alphabetic';
      }
      return y + th;
    }

    case 'quote': {
      const size = fs(48);
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
      const lf = fs(42);
      const by = y + lf * 1.5, bw = w * 0.7, bh = sz(40);
      if (draw) {
        ctx.font = `700 ${lf}px ${FONT.body}`;
        ctx.fillStyle = COLORS.muted;
        ctx.fillText(block.label, x, y + lf * 0.95);
        roundRect(ctx, x, by, bw, bh, bh / 2);
        ctx.fillStyle = COLORS.surface2;
        ctx.fill();
        roundRect(ctx, x, by, Math.max(bh, bw * block.value), bh, bh / 2);
        ctx.fillStyle = COLORS.yellow;
        ctx.fill();
        ctx.font = `700 ${fs(54)}px ${FONT.body}`;
        ctx.fillStyle = COLORS.white;
        ctx.fillText(block.text, x + bw + 28, by + bh - 2);
      }
      return by + bh + 10;
    }

    case 'measures': {
      if (block.cards) {
        // Tarjetas de dos columnas: las medidas principales, grandes y legibles dentro del casco.
        const gap = 18;
        const cw = (w - gap) / 2;
        const clf = fs(42);
        const cvf = fs(56);
        const ch = clf * 1.15 + cvf * 1.2 + sz(34);
        if (draw) {
          block.rows.forEach((row, i) => {
            const cx = x + (i % 2) * (cw + gap);
            const cy = y + Math.floor(i / 2) * (ch + gap);
            roundRect(ctx, cx, cy, cw, ch, 16);
            ctx.fillStyle = COLORS.surface;
            ctx.fill();
            ctx.strokeStyle = row.available ? COLORS.border : COLORS.muted;
            ctx.lineWidth = 3;
            if (!row.available) ctx.setLineDash([12, 8]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.font = `700 ${clf}px ${FONT.body}`;
            ctx.fillStyle = COLORS.muted;
            ctx.fillText(row.short || row.label, cx + 22, cy + sz(17) + clf * 0.9);
            ctx.font = `700 ${cvf}px ${FONT.body}`;
            ctx.fillStyle = row.available ? COLORS.yellow : COLORS.muted;
            let value = row.display;
            while (value.length > 3 && ctx.measureText(value).width > cw - 44) value = `${value.slice(0, -2).trimEnd()}…`;
            ctx.fillText(value, cx + 22, cy + ch - sz(17) - cvf * 0.12);
          });
        }
        return y + Math.ceil(block.rows.length / 2) * (ch + gap) - gap;
      }
      let cy = y;
      const lf = fs(46);
      const vf = fs(50);
      const nf = fs(42);
      for (const row of block.rows) {
        const rowH = row.note ? lf * 1.12 + nf * 1.3 + sz(22) : vf * 1.3 + sz(18);
        if (draw) {
          ctx.font = `700 ${lf}px ${FONT.body}`;
          ctx.fillStyle = row.available ? COLORS.white : COLORS.muted;
          ctx.fillText(row.label, x, cy + lf * 0.95);
          ctx.font = `700 ${vf}px ${FONT.body}`;
          ctx.textAlign = 'right';
          ctx.fillStyle = row.available ? COLORS.yellow : COLORS.muted;
          ctx.fillText(row.display, x + w, cy + vf * 0.95);
          ctx.textAlign = 'left';
          if (row.note) {
            ctx.font = `400 ${nf}px ${FONT.body}`;
            ctx.fillStyle = COLORS.muted;
            let note = row.note;
            while (note.length > 4 && ctx.measureText(note).width > w) note = `${note.slice(0, -2).trimEnd()}…`;
            ctx.fillText(note, x, cy + lf * 1.12 + nf * 0.95);
          }
          ctx.fillStyle = COLORS.border;
          ctx.fillRect(x, cy + rowH - 8, w, 2);
        }
        cy += rowH;
      }
      return cy;
    }

    case 'indicator': {
      const lf = fs(42);
      const h = sz(220);
      if (draw) {
        roundRect(ctx, x, y, w, h, 18);
        ctx.fillStyle = COLORS.surface;
        ctx.fill();
        ctx.strokeStyle = block.value == null ? COLORS.border : COLORS.yellow;
        ctx.lineWidth = 4;
        if (block.value == null) ctx.setLineDash([16, 10]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `700 ${lf}px ${FONT.body}`;
        ctx.fillStyle = COLORS.muted;
        drawSpaced(ctx, (block.value == null ? 'Indicador técnico orientativo' : block.label).toUpperCase(), x + 28, y + lf * 1.1, 3);
        if (block.value == null) {
          ctx.font = `400 ${sz(84)}px ${FONT.display}`;
          ctx.fillStyle = COLORS.white;
          ctx.fillText('SIN DATOS SUFICIENTES', x + 28, y + lf * 1.1 + sz(100));
          ctx.font = `400 ${lf}px ${FONT.body}`;
          ctx.fillStyle = COLORS.muted;
          let note = block.note3D || block.note;
          while (note.length > 4 && ctx.measureText(note).width > w - 56) note = `${note.slice(0, -2).trimEnd()}…`;
          ctx.fillText(note, x + 28, y + h - 22);
        } else {
          ctx.font = `400 ${sz(120)}px ${FONT.display}`;
          ctx.fillStyle = COLORS.yellow;
          const by = y + lf * 1.1 + sz(112);
          ctx.fillText(String(block.value), x + 28, by);
          const nw = ctx.measureText(String(block.value)).width;
          ctx.font = `700 ${fs(46)}px ${FONT.body}`;
          ctx.fillStyle = COLORS.muted;
          ctx.fillText('/ 100', x + 44 + nw, by);
          ctx.font = `400 ${lf}px ${FONT.body}`;
          const noteLines = wrapText(ctx, block.note3D || block.note, w - sz(470));
          noteLines.slice(0, 3).forEach((l, i) => ctx.fillText(l, x + sz(450), y + lf * 1.1 + sz(30) + i * lf * 1.2));
        }
      }
      return y + h;
    }

    case 'tips': {
      let cy = y;
      const tf = fs(48);
      const bf = fs(42);
      block.items.forEach((tip, i) => {
        if (draw) {
          ctx.font = `400 ${sz(72)}px ${FONT.display}`;
          ctx.fillStyle = COLORS.yellow;
          ctx.fillText(String(i + 1), x, cy + sz(64));
        }
        cy = para(tip.short || tip.text, x + sz(64), cy, w - sz(64), { size: tf, lineHeight: 1.18 });
        if (draw) {
          ctx.font = `400 ${bf}px ${FONT.body}`;
          ctx.fillStyle = COLORS.muted;
          ctx.fillText(`Basado en: ${tip.basedOn}`, x + sz(64), cy + bf * 0.95);
        }
        cy += bf * 1.3 + sz(30);
      });
      return cy;
    }

    default:
      return y;
  }
}

// ---------- Atril: cara de control (1300 × 560) ----------

export const LECTERN = { W: 1300, H: 560 };
/** Recuadro del reloj del atril (a la vista de quien presenta, sin depender del reloj lejano de la pared). */
export const LECTERN_CLOCK = { x: 650, y: 14, w: 344, h: 172 };
const HINT_W_FULL = 940;

/**
 * @param {object} lectern  { status, hint, actions }
 * @param {object} [extra]
 * @param {object} [extra.clock]  modelo del reloj: se dibuja el recuadro de tiempo (si no es el modo «idle»)
 * @param {{text:string, kind:string}|null} [extra.flash]  aviso corto que reemplaza a la pista (se ve dentro del casco)
 */
export function drawLecternFace(ctx, W, H, lectern, { clock = null, flash = null } = {}) {
  roundRect(ctx, 4, 4, W - 8, H - 8, 30);
  ctx.fillStyle = COLORS.surface;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = COLORS.border;
  ctx.stroke();

  const showClock = clock && clock.mode !== 'idle';

  // Estado
  ctx.fillStyle = COLORS.yellow;
  ctx.fillRect(34, 32, 18, 18);
  ctx.font = `700 ${MIN_FONT_LECTERN + 2}px ${FONT.body}`;
  ctx.fillStyle = COLORS.yellow;
  ctx.textBaseline = 'alphabetic';
  drawSpaced(ctx, lectern.status || '', 66, 54, 4);

  // Pista (hasta 3 líneas) o aviso corto
  const hintW = showClock ? LECTERN_CLOCK.x - 34 - 24 : HINT_W_FULL;
  if (flash) {
    const color = flash.kind === 'warn' ? COLORS.pink : COLORS.yellow;
    drawIcon(ctx, flash.kind === 'warn' ? 'warn' : 'info', 34 + 21, 70 + 30, 42, color);
    drawParagraph(ctx, flash.text, 34 + 58, 70, hintW - 58, { size: MIN_FONT_LECTERN, lineHeight: 1.15, color: COLORS.white, maxLines: 3, weight: 700 });
  } else {
    drawParagraph(ctx, lectern.hint || '', 34, 70, hintW, { size: MIN_FONT_LECTERN, lineHeight: 1.15, color: COLORS.white, maxLines: 3 });
  }

  if (showClock) drawLecternClock(ctx, LECTERN_CLOCK, clock);

  // Separador de utilidades
  ctx.fillStyle = COLORS.border;
  ctx.fillRect(1010, 34, 3, H - 68);
}

/** Reloj chico del atril: etiqueta, tiempo y aviso en palabras (además del color y el trazo). */
function drawLecternClock(ctx, box, clock) {
  const { x, y, w, h } = box;
  const warn = clock.warning;
  const border = warn === 'final' ? COLORS.pink : warn === 'warning' ? COLORS.yellow : clock.mode === 'prep' ? COLORS.blue : COLORS.border;
  const bw = warn === 'final' ? 10 : warn === 'warning' ? 8 : 4;
  roundRect(ctx, x + bw / 2, y + bw / 2, w - bw, h - bw, 22);
  ctx.fillStyle = COLORS.dark;
  ctx.fill();
  ctx.lineWidth = bw;
  ctx.strokeStyle = border;
  if (warn === 'warning') ctx.setLineDash([30, 14]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${MIN_FONT_LECTERN - 2}px ${FONT.body}`;
  ctx.fillStyle = COLORS.muted;
  drawSpaced(ctx, clock.label || '', x + 22, y + 38, 3);
  if (clock.paused) drawIcon(ctx, 'pause', x + w - 40, y + 28, 34, COLORS.yellow);

  ctx.font = `400 88px ${FONT.display}`;
  ctx.fillStyle = warn === 'final' ? COLORS.pink : warn === 'warning' ? COLORS.yellow : COLORS.white;
  ctx.textAlign = 'center';
  ctx.fillText(clock.time || '0:00', x + w / 2, y + 130);
  ctx.textAlign = 'left';

  ctx.font = `700 ${MIN_FONT_LECTERN - 2}px ${FONT.body}`;
  ctx.fillStyle = warn === 'warning' || warn === 'final' ? COLORS.white : COLORS.muted;
  let sx = x + 22;
  if (warn === 'warning' || warn === 'final') {
    drawIcon(ctx, 'warn', x + 36, y + h - 25, 30, warn === 'final' ? COLORS.pink : COLORS.yellow);
    sx = x + 62;
  }
  drawSpaced(ctx, (clock.short || '').toUpperCase(), sx, y + h - 14, 2);
}

// ---------- Reloj de la pared (1440 × 560) ----------
// Se mira de lejos (de 5 a 11 m): solo muestra los números, que son lo único que se lee a esa distancia.
// Las etiquetas y el estado en palabras están en el reloj del atril y en el panel de texto.

export const CLOCK = { W: 1440, H: 560 };

export function drawClock(ctx, W, H, clock) {
  const warn = clock.warning;
  const border = warn === 'final' ? COLORS.pink : warn === 'warning' ? COLORS.yellow : clock.mode === 'prep' ? COLORS.blue : COLORS.border;
  const bw = warn === 'final' ? 16 : warn === 'warning' ? 12 : 8;

  roundRect(ctx, bw / 2, bw / 2, W - bw, H - bw, 34);
  ctx.fillStyle = COLORS.dark;
  ctx.fill();
  ctx.lineWidth = bw;
  ctx.strokeStyle = border;
  if (warn === 'warning') ctx.setLineDash([46, 22]); // trazo cortado = poco tiempo
  ctx.stroke();
  ctx.setLineDash([]);

  // Íconos de estado (pausa y aviso), grandes y sin texto
  if (clock.paused) drawIcon(ctx, 'pause', 110, 100, 110, COLORS.yellow);
  else if (warn === 'warning' || warn === 'final') drawIcon(ctx, 'warn', 110, 100, 110, warn === 'final' ? COLORS.pink : COLORS.yellow);

  // Tiempo
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 400px ${FONT.display}`;
  ctx.fillStyle = warn === 'final' ? COLORS.pink : warn === 'warning' ? COLORS.yellow : COLORS.white;
  ctx.textAlign = 'center';
  ctx.fillText(clock.time || '0:00', W / 2, 430);
  ctx.textAlign = 'left';

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
  ctx.font = `700 40px ${FONT.body}`;
  ctx.fillStyle = COLORS.yellow;
  drawSpaced(ctx, `BRIEF · ${(scenarioName || '').toUpperCase()}`, m, 100, 6);

  // Etiqueta de marca ficticia
  ctx.font = `700 42px ${FONT.body}`;
  const label = 'MARCA FICTICIA';
  const lw = ctx.measureText(label).width + 100;
  roundRect(ctx, W - m - lw, 48, lw, 76, 38);
  ctx.fillStyle = COLORS.pink;
  ctx.fill();
  ctx.fillStyle = COLORS.white;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, W - m - lw + 50, 88);
  ctx.textBaseline = 'alphabetic';

  // Marca
  let brandSize = 190;
  ctx.font = `400 ${brandSize}px ${FONT.display}`;
  while (ctx.measureText(brief.brand.toUpperCase()).width > W - m * 2 && brandSize > 90) { brandSize -= 6; ctx.font = `400 ${brandSize}px ${FONT.display}`; }
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
    ctx.font = `700 38px ${FONT.body}`;
    drawSpaced(ctx, k.toUpperCase(), fx, fy + 52, 4);
    drawParagraph(ctx, v, fx, fy + 66, colW, { size: 42, lineHeight: 1.2, maxLines: 4 });
  });

  // Guía
  ctx.fillStyle = COLORS.surface;
  ctx.fillRect(0, H - 120, W, 120);
  ctx.font = `700 38px ${FONT.body}`;
  ctx.fillStyle = COLORS.yellow;
  drawSpaced(ctx, 'QUÉ PRESENTAR', m, H - 58, 4);
  ctx.font = `400 38px ${FONT.body}`;
  ctx.fillStyle = COLORS.white;
  let text = brief.guide;
  const maxW = W - m * 2 - 400;
  while (text.length > 4 && ctx.measureText(text).width > maxW) text = `${text.slice(0, -2).trimEnd()}…`;
  ctx.fillText(text, m + 400, H - 56);
}

// ---------- Recordatorio del brief en la pared del público (1200 × 420) ----------
// Se mira de lejos (de 5 a 8 m): solo la marca y la etiqueta de «ficticia», en tamaño grande.
// El detalle del brief está en el panel (estado «Brief») y en la pantalla de la pared de atrás.

export const COMPACT = { W: 1200, H: 420 };

export function drawBriefCompact(ctx, W, H, brief) {
  roundRect(ctx, 4, 4, W - 8, H - 8, 28);
  ctx.fillStyle = COLORS.dark;
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 104px ${FONT.body}`;
  const label = 'MARCA FICTICIA';
  const lw = ctx.measureText(label).width + 90;
  roundRect(ctx, 40, 34, lw, 140, 70);
  ctx.fillStyle = COLORS.pink;
  ctx.fill();
  ctx.fillStyle = COLORS.white;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 40 + 45, 106);
  ctx.textBaseline = 'alphabetic';

  let compactSize = 190;
  ctx.font = `400 ${compactSize}px ${FONT.display}`;
  while (ctx.measureText(brief.brand.toUpperCase()).width > W - 80 && compactSize > 60) { compactSize -= 4; ctx.font = `400 ${compactSize}px ${FONT.display}`; }
  ctx.fillStyle = COLORS.white;
  ctx.fillText(brief.brand.toUpperCase(), 40, 368);
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
