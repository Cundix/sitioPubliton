// Piezas de mobiliario compartidas por todos los escenarios.

import { DEG } from './scene-kit.js';
import { CanvasSurface } from '../ui/canvas-surface.js';
import { drawSign } from '../ui/panel-draw.js';
import { FONT } from '../ui/draw.js';

/**
 * Atril: base, cuerpo con panel frontal y logotipo, plano inclinado para los controles y un micrófono de cuello de cisne.
 * La cara de control se dibuja encima (pitch-ui); el plano inclinado y su posición NO cambian.
 */
export function addLectern(kit, { accent = '#FFC94A' } = {}) {
  const g = kit.group3([0, 0, 0]);
  const b = kit.batch();
  b.box([1.18, 0.05, 0.54], [0, 0.025, -0.02], '#0B0E09', { rough: 0.6 });               // plinto
  b.box([1.1, 0.6, 0.46], [0, 0.35, -0.02], '#2A3225', { rough: 0.7 });                  // cuerpo
  b.box([1.04, 0.03, 0.4], [0, 0.065, -0.02], accent);                                    // zócalo amarillo
  b.box([0.92, 0.38, 0.02], [0, 0.35, 0.215], '#20261C', { rough: 0.6 });                // panel frontal
  b.box([0.92, 0.025, 0.03], [0, 0.55, 0.22], '#11160E');                                 // moldura
  b.box([1.16, 0.05, 0.5], [0, 0.665, -0.02], '#11160E');                                 // tapa
  b.box([0.9, 0.3, 0.14], [0, 0.82, -0.12], '#20261C');                                   // soporte del plano
  b.flush(g);

  // Logotipo en el panel frontal
  const logo = new CanvasSurface(0.62, 0.16, 360);
  logo.draw((ctx, W, H) => {
    ctx.fillStyle = '#FFC94A';
    ctx.font = `400 ${H * 0.78}px ${FONT.display}`;
    ctx.textAlign = 'left';
    ctx.fillText('PITCH LAB', W * 0.04, H * 0.8);
    ctx.fillStyle = '#C5CABF';
    ctx.fillRect(W * 0.04, H * 0.9, W * 0.92, H * 0.04);
  });
  logo.mesh.position.set(0, 0.36, 0.228);
  g.add(logo.mesh);
  kit.track({ dispose: () => logo.dispose() });

  // Plano inclinado (la cara de control se dibuja encima, en pitch-ui)
  const slab = kit.group3([0, 1.02, 0], { parent: g });
  slab.rotation.x = -22 * DEG;
  const sb = kit.batch();
  sb.box([1.4, 0.62, 0.05], [0, 0, 0], '#11160E', { rough: 0.5 });
  sb.box([1.4, 0.04, 0.09], [0, -0.31, 0.02], accent);
  sb.box([1.4, 0.03, 0.06], [0, 0.31, 0], '#2A3225');
  // Micrófono de clip sujeto al borde superior derecho del plano. Es bajo a propósito: más alto taparía el panel de opciones
  // que se ve justo detrás desde la posición inicial.
  const dark = '#0B0E09';
  sb.box([0.07, 0.05, 0.09], [0.6, 0.33, 0.02], dark, { metal: 0.4 });
  sb.cyl(0.009, 0.009, 0.05, [0.6, 0.36, 0.03], dark, { seg: 6 });
  sb.cyl(0.009, 0.009, 0.07, [0.59, 0.39, 0.06], dark, { seg: 6, rotX: 60 });
  sb.cyl(0.022, 0.018, 0.08, [0.575, 0.405, 0.1], '#1B2016', { seg: 10, rotX: 75 });
  sb.sphere(0.024, [0.572, 0.409, 0.135], '#3A4533', { seg: 8, segH: 6 });
  sb.flush(slab);

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

/** Maceta con hojas en abanico (una sola malla de hojas por planta). */
export function addPlant(kit, x, z, scale = 1) {
  const g = kit.group3([x, 0, z]);
  const T = kit.T;
  const b = kit.batch();
  b.cyl(0.21 * scale, 0.15 * scale, 0.34 * scale, [0, 0.17 * scale, 0], '#FF006E', { seg: 12 });   // maceta
  b.cyl(0.225 * scale, 0.215 * scale, 0.05 * scale, [0, 0.355 * scale, 0], '#D6005E', { seg: 12 }); // borde
  b.cyl(0.19 * scale, 0.19 * scale, 0.02 * scale, [0, 0.36 * scale, 0], '#2B1E14', { seg: 12 });   // tierra
  const up = new T.Vector3(0, 1, 0);
  const dir = new T.Vector3();
  const q = new T.Quaternion();
  const leaves = 11;
  for (let i = 0; i < leaves; i++) {
    const phi = (i * 2.399963) % (Math.PI * 2);           // ángulo áureo: reparto parejo
    const tilt = 0.18 + (i % 4) * 0.2;                     // hojas más verticales al centro, más abiertas afuera
    const len = (0.55 + ((i * 7) % 5) * 0.09) * scale;
    dir.set(Math.sin(tilt) * Math.cos(phi), Math.cos(tilt), Math.sin(tilt) * Math.sin(phi)).normalize();
    q.setFromUnitVectors(up, dir);
    const base = [0, 0.36 * scale, 0];
    const center = [base[0] + dir.x * len / 2, base[1] + dir.y * len / 2, base[2] + dir.z * len / 2];
    b.cyl(0, 0.1 * scale, len, center, i % 3 ? '#5C8A47' : '#4A7A3A', { seg: 4, quat: q.clone(), scale: [1, 1, 0.3] });
  }
  b.flush(g);
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

/** Estante con libros, un portarretrato, una plantita y una pieza decorativa. */
export function addShelf(kit, { x, y, z, w = 1.4, rotY = 0 }) {
  const g = kit.group3([x, y, z], { rotY });
  const b = kit.batch();
  b.box([w, 0.04, 0.3], [0, 0, 0], '#596151');
  b.box([0.04, 0.5, 0.3], [-w / 2 + 0.02, 0.25, 0], '#596151');
  b.box([0.04, 0.5, 0.3], [w / 2 - 0.02, 0.25, 0], '#596151');
  b.box([w, 0.5, 0.02], [0, 0.25, -0.14], '#3A4533');                                  // fondo
  const colors = ['#0047FF', '#FFC94A', '#FF006E', '#E9E4D4', '#7C9070'];
  let bx = -w / 2 + 0.1;
  const stop = w * 0.62;
  for (let i = 0; i < 11 && bx < -w / 2 + stop; i++) {
    const bw = 0.05 + (i % 3) * 0.015;
    const bh = 0.24 + (i % 4) * 0.05;
    b.box([bw, bh, 0.2], [bx + bw / 2, 0.02 + bh / 2, 0], colors[i % colors.length], { rotZ: i === 6 ? -10 : 0 });
    bx += bw + 0.012;
  }
  const px = w / 2 - 0.2;
  b.box([0.16, 0.2, 0.02], [px, 0.12, 0.02], '#0B0E09', { rotY: -12 });                  // portarretrato
  b.box([0.13, 0.17, 0.01], [px, 0.12, 0.03], '#FFC94A', { rotY: -12 });
  b.cyl(0.05, 0.04, 0.09, [px - 0.17, 0.065, 0.03], '#E9E4D4', { seg: 8 });              // maceta chica
  b.sphere(0.055, [px - 0.17, 0.14, 0.03], '#5C8A47', { seg: 8, segH: 6 });
  b.flush(g);
  return g;
}
