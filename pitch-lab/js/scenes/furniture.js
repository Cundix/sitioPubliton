// Piezas de mobiliario compartidas por todos los escenarios.

import { DEG } from './scene-kit.js';
import { CanvasSurface } from '../ui/canvas-surface.js';
import { drawSign } from '../ui/panel-draw.js';

/** Atril: cuerpo y plano inclinado donde van los controles. */
export function addLectern(kit, { accent = '#FFC94A' } = {}) {
  const g = kit.group3([0, 0, 0]);
  kit.box([1.1, 0.66, 0.46], [0, 0.33, -0.02], '#2A3225', { parent: g, rough: 0.7 });
  kit.box([1.16, 0.05, 0.5], [0, 0.665, -0.02], '#11160E', { parent: g });
  kit.box([1.04, 0.03, 0.4], [0, 0.03, -0.02], accent, { parent: g }); // zócalo amarillo

  // Plano inclinado (la cara de control se dibuja encima, en pitch-ui)
  const slab = kit.group3([0, 1.02, 0], { parent: g });
  slab.rotation.x = -22 * DEG;
  kit.box([1.4, 0.62, 0.05], [0, 0, 0], '#11160E', { parent: slab, rough: 0.5 });
  kit.box([1.4, 0.04, 0.09], [0, -0.31, 0.02], accent, { parent: slab });
  kit.box([1.4, 0.03, 0.06], [0, 0.31, 0], '#2A3225', { parent: slab });

  // Soporte debajo del plano (une cuerpo y plano)
  kit.box([0.9, 0.3, 0.14], [0, 0.82, -0.12], '#20261C', { parent: g });

  return g;
}

/** Cartel con texto (Anton) como textura. Devuelve { el } para anexar a una entidad. */
export function makeSign({ text, sub, w = 1.6, h = 0.5, bg = '#11160E', fg = '#FFFFFF', accent = '#FFC94A', size = 0.55, align = 'center', px = 500 }) {
  const surface = new CanvasSurface(w, h, px);
  surface.draw((ctx, W, H) => drawSign(ctx, W, H, { text, sub, bg, fg, accent, size, align }));
  const el = document.createElement('a-entity');
  el.setObject3D('mesh', surface.mesh);
  return { el, surface, dispose() { el.removeObject3D('mesh'); surface.dispose(); el.remove(); } };
}

/** Maceta con hojas de conos. */
export function addPlant(kit, x, z, scale = 1) {
  const g = kit.group3([x, 0, z]);
  kit.cyl(0.2 * scale, 0.15 * scale, 0.36 * scale, [0, 0.18 * scale, 0], '#FF006E', { parent: g, seg: 10 });
  const leaf = '#5C8A47';
  [[0, 0, 0, 1], [0.12, 0, 0.06, 0.8], [-0.12, 0, -0.05, 0.9], [0.02, 0, -0.12, 0.7]].forEach(([dx, , dz, s], i) => {
    const cone = kit.cyl(0, 0.13 * scale * s, 0.8 * scale * s, [dx * scale, (0.36 + 0.4 * s) * scale, dz * scale], leaf, { parent: g, seg: 6 });
    cone.rotation.z = (i - 1.5) * 0.12;
  });
  return g;
}

/** Marco oscuro para una pantalla o reloj colgado en la pared. */
export function addBezel(kit, { x, y, z, w, h, rotY = 0, depth = 0.08, color = '#0B0E09' }) {
  const g = kit.group3([x, y, z], { rotY });
  kit.box([w + 0.14, h + 0.14, depth], [0, 0, -depth / 2 - 0.004], color, { parent: g, rough: 0.5 });
  kit.box([w + 0.14, 0.03, depth + 0.02], [0, -(h + 0.14) / 2 + 0.015, -depth / 2], '#FFC94A', { parent: g });
  return g;
}

/** Banda luminosa (tubo/panel emisivo que no recibe luz). */
export function addGlow(kit, size, pos, color = '#FFF1C9', opts = {}) {
  return kit.box(size, pos, color, { material: kit.basic(color), ...opts });
}

/** Libros de colores en un estante. */
export function addShelf(kit, { x, y, z, w = 1.4, rotY = 0 }) {
  const g = kit.group3([x, y, z], { rotY });
  kit.box([w, 0.04, 0.3], [0, 0, 0], '#596151', { parent: g });
  kit.box([0.04, 0.5, 0.3], [-w / 2 + 0.02, 0.25, 0], '#596151', { parent: g });
  kit.box([0.04, 0.5, 0.3], [w / 2 - 0.02, 0.25, 0], '#596151', { parent: g });
  const colors = ['#0047FF', '#FFC94A', '#FF006E', '#E9E4D4', '#7C9070'];
  let bx = -w / 2 + 0.1;
  for (let i = 0; i < 9 && bx < w / 2 - 0.1; i++) {
    const bw = 0.05 + (i % 3) * 0.015;
    const bh = 0.24 + (i % 4) * 0.05;
    kit.box([bw, bh, 0.2], [bx + bw / 2, 0.02 + bh / 2, 0], colors[i % colors.length], { parent: g });
    bx += bw + 0.012;
  }
  return g;
}
