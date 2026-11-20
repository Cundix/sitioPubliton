// REUNIÓN CON CLIENTE: sala mediana con una mesa larga. Quien presenta está de pie en la
// cabecera y cinco personas se sientan muy cerca. La cercanía es lo que cambia la experiencia.

import { addLectern, makeSign, addPlant, addBezel, addGlow, addShelf } from './furniture.js';
import { addFloor, addWainscot, addCeilingDetail, addWindow, addDoor, addPoster, skyMaterial } from './dressing.js';
import { buildAudience } from './audience.js';

export function buildCliente(kit, sc) {
  const { room, theme } = sc;
  const W = room.maxX - room.minX;
  const D = room.maxZ - room.minZ;
  const H = room.height;
  const cx = (room.minX + room.maxX) / 2;
  const cz = (room.minZ + room.maxZ) / 2;
  const entities = [];
  const disposers = [];
  const bag = { entities, disposers };

  // --- Estructura ---
  kit.box([W, 0.1, D], [cx, -0.05, cz], '#1A1F15', { rough: 0.9 });
  addFloor(kit, 'wood', { x: cx, y: 0.002, z: cz, w: W, d: D, base: '#3A2C1E', tile: 1.2 });
  kit.box([W, 0.1, D], [cx, H + 0.05, cz], '#13170F');
  kit.box([W, H, 0.1], [cx, H / 2, room.minZ - 0.05], theme.wall);
  kit.box([0.1, H, D], [room.minX - 0.05, H / 2, cz], theme.wall);
  kit.box([0.1, H, D], [room.maxX + 0.05, H / 2, cz], theme.wall);
  kit.box([W, H, 0.1], [cx, H / 2, room.maxZ + 0.05], '#1B2016');
  kit.box([W, 0.14, 0.05], [cx, 0.07, room.minZ + 0.025], '#11160E');
  kit.box([0.05, 0.14, D], [room.minX + 0.025, 0.07, cz], '#11160E');
  kit.box([0.05, 0.14, D], [room.maxX - 0.025, 0.07, cz], '#11160E');
  kit.box([W, 0.5, 0.03], [cx, 2.7, room.maxZ - 0.015], theme.accent);   // franja rosa sobre la pantalla
  addWainscot(kit, room, { color: '#20261C', rail: theme.accent, height: 1.0, back: true, right: false }); // sin zócalo bajo el ventanal
  addCeilingDetail(kit, room, H, { cove: '#FFE0A8' });

  // --- Alfombra larga bajo la mesa ---
  kit.box([4.2, 0.02, 5.6], [0, 0.01, -3.0], '#232B1E');
  kit.box([3.9, 0.024, 5.3], [0, 0.012, -3.0], '#1C2A33');
  kit.box([4.2, 0.024, 0.06], [0, 0.012, -0.28], '#FFC94A');

  // --- Mesa de reunión: tapa de madera, canto, bases y objetos ---
  const top = kit.box([1.8, 0.07, 3.75], [0, 0.76, -2.825], '#5A4331', { rough: 0.55 });
  top.geometry.userData.table = true;
  kit.box([1.8, 0.02, 3.75], [0, 0.805, -2.825], '#6B5037', { rough: 0.4 });
  const tb = kit.batch();
  tb.box([1.74, 0.05, 3.69], [0, 0.7, -2.825], '#2B2118');                                            // canto inferior
  [-1.55, -4.1].forEach((z) => {
    tb.box([0.9, 0.68, 0.14], [0, 0.34, z], '#1B2016', { metal: 0.2 });                               // pedestal
    tb.box([1.5, 0.05, 0.5], [0, 0.025, z], '#0B0E09');                                               // pie
  });
  tb.box([0.14, 0.04, 2.4], [0, 0.04, -2.825], '#0B0E09');                                            // travesaño
  tb.flush();

  // Objetos sobre la mesa
  const ob = kit.batch();
  [[-0.55, -1.7], [0.55, -1.7], [-0.55, -3.1], [0.55, -3.1], [0, -4.6]].forEach(([x, z], i) => {
    ob.cyl(0.04, 0.035, 0.09, [x * 0.85, 0.87, z], '#F4F1E8', { seg: 10 });
    ob.box([0.26, 0.02, 0.2], [x * 0.55, 0.835, z + (i === 4 ? -0.25 : 0.0)], i % 2 ? '#FFC94A' : '#0047FF', { rotY: (i - 2) * 12 });
  });
  // Laptops (base + tapa + pantalla) frente a tres lugares
  const screen = kit.basic('#27406E');
  const laptops = [[-0.52, -1.7, -55], [0.52, -3.1, 55], [0, -4.45, 180]]; // orientadas hacia quien se sienta (ellos miran al atril)
  laptops.forEach(([x, z, rotY]) => {
    const r = (rotY * Math.PI) / 180;
    const cs = Math.cos(r); const sn = Math.sin(r);
    const at = (lx, ly, lz) => [x + lx * cs + lz * sn, 0.815 + ly, z - lx * sn + lz * cs];
    ob.box([0.3, 0.015, 0.22], at(0, 0.0075, 0), '#2F392B', { rotY, metal: 0.4 });
    ob.box([0.3, 0.2, 0.01], at(0, 0.115, -0.1), '#1B2016', { rotY, rotX: -14, metal: 0.4 });
    ob.box([0.27, 0.17, 0.004], at(0, 0.115, -0.093), '#27406E', { rotY, rotX: -14, material: screen });
  });
  // Teléfono de conferencia en el centro y portacables
  ob.cyl(0.11, 0.12, 0.025, [0, 0.84, -2.2], '#11160E', { seg: 16 });
  ob.cyl(0.025, 0.025, 0.012, [0, 0.855, -2.2], '#FFC94A', { seg: 10 });
  ob.box([0.18, 0.02, 0.28], [0.18, 0.835, -3.7], '#0B0E09', { rotY: 20 });
  // Jarra de agua con vasos (el cilindro translúcido y la tapa se mantienen como antes)
  ob.cyl(0.035, 0.03, 0.08, [-0.18, 0.845, -2.82], '#9EC3E6', { seg: 8, opacity: 0.55 });
  ob.cyl(0.035, 0.03, 0.08, [0.18, 0.845, -2.5], '#9EC3E6', { seg: 8, opacity: 0.55 });
  ob.flush();
  kit.cyl(0.07, 0.07, 0.24, [0, 0.95, -2.8], '#9EC3E6', { seg: 10, opacity: 0.55 });
  kit.cyl(0.075, 0.075, 0.03, [0, 1.08, -2.8], '#11160E', { seg: 10 });

  // --- Pantalla ancha del brief (pared de atrás) ---
  addBezel(kit, { x: 0, y: 1.55, z: room.maxZ - 0.02, w: 3.2, h: 1.8, rotY: 180 });

  // --- Reloj al fondo de la mesa, a la vista de quien presenta ---
  addBezel(kit, { x: 0, y: 2.2, z: room.minZ + 0.02, w: 1.5, h: 0.58, rotY: 0, depth: 0.1 });

  // --- Afiches de la marca ---
  addPoster(kit, bag, { x: -2.5, y: 1.85, z: room.minZ + 0.05, rotY: 0, w: 0.85, h: 1.15, style: 'blocks', seed: 21 });
  addPoster(kit, bag, { x: 2.5, y: 1.85, z: room.minZ + 0.05, rotY: 0, w: 0.85, h: 1.15, style: 'sun', seed: 22 });
  addPoster(kit, bag, { x: -3.2, y: 1.6, z: room.maxZ - 0.05, rotY: 180, w: 0.9, h: 1.25, style: 'type', seed: 23 });
  addPoster(kit, bag, { x: 3.2, y: 1.6, z: room.maxZ - 0.05, rotY: 180, w: 0.9, h: 1.25, style: 'waves', seed: 24 });

  // --- Ventanal con vista a la ciudad (pared derecha) ---
  addWindow(kit, { x: room.maxX - 0.005, y: 1.5, z: -3.0, rotY: -90, w: 4.5, h: 1.85, cols: 5, rows: 1, sky: skyMaterial(kit, { top: '#0A1330', mid: '#1F3A6A', bottom: '#E8A25A' }) });
  const skyline = [[-1.9, 0.9], [-1.5, 1.4], [-1.0, 0.7], [-0.5, 1.6], [0.1, 1.0], [0.6, 1.5], [1.2, 0.8], [1.8, 1.2]];
  const sb = kit.batch();
  const lit = kit.basic('#FFD98A');
  skyline.forEach(([dz, h], i) => {
    sb.box([0.02, h, 0.34], [room.maxX - 0.03, 0.57 + h / 2, -3.0 + dz], '#0A0F1C', { material: kit.basic('#0A1226') });
    for (let k = 0; k < Math.floor(h * 3); k++) {
      if ((i + k) % 3 === 0) continue;
      sb.box([0.02, 0.05, 0.05], [room.maxX - 0.04, 0.68 + k * 0.17, -3.0 + dz + ((k % 2) ? 0.08 : -0.08)], '#FFD98A', { material: lit });
    }
  });
  sb.flush();

  // --- Pared izquierda: cartel + estante + planta + puerta ---
  const name = makeSign({ text: 'REUNIÓN CON CLIENTE', sub: 'Espacio 02 · 90 segundos', w: 2.2, h: 0.62, size: 0.4, px: 320 });
  name.el.object3D.position.set(room.minX + 0.075, 1.9, -3.0);
  name.el.object3D.rotation.y = Math.PI / 2;
  entities.push(name.el);
  disposers.push(() => name.dispose());
  addShelf(kit, { x: room.minX + 0.2, y: 1.1, z: -1.3, w: 1.3, rotY: 90 });
  addShelf(kit, { x: room.minX + 0.2, y: 1.6, z: -1.3, w: 1.3, rotY: 90 });
  addDoor(kit, { x: room.minX + 0.005, z: -5.5, rotY: 90 });
  addPlant(kit, -3.7, -5.6, 1.2);
  addPlant(kit, 3.7, 2.8, 1.0);

  // --- Luminarias lineales sobre la mesa ---
  [-3.8, -2.6, -1.4].forEach((z) => { kit.box([1.6, 0.03, 0.34], [0, H - 0.015, z], '#0B0E09'); addGlow(kit, [1.5, 0.05, 0.26], [0, H - 0.04, z], '#FFF1C9'); });

  addLectern(kit);
  const audience = buildAudience(kit, sc.seats, { seatColor: '#20261C', accent: theme.accent, style: 'chair' });

  kit.light('hemi', '#DDE4D2', 1.25, [0, H, 0], { ground: '#12170E' });
  kit.light('point', '#FFF0CF', 7, [0, H - 0.4, -2.6], { distance: 10, decay: 1.2 });
  kit.light('point', '#FFF0CF', 4, [0, H - 0.3, 1.6], { distance: 7, decay: 1.2 });

  return {
    id: sc.id,
    background: '#10140D',
    fog: null,
    spawn: sc.spawn,
    zones: sc.walk.zones,
    obstacles: sc.walk.obstacles,
    pads: sc.pads,
    anchors: {
      lectern: { pos: [0, 0, 0] },
      panel: { pos: [0, 2.05, -0.5], scale: 1.3 },
      clock: { pos: [0, 2.2, room.minZ + 0.05], rotY: 0, scale: 1.04 },
      brief: { pos: [0, 1.55, room.maxZ - 0.075], rotY: 180, scale: 1.67 },
      compact: { pos: [0, 1.5, room.minZ + 0.05], rotY: 0, scale: 1.5 },
    },
    entities,
    audience,
    disposers,
    update(timeSec, reduced) { audience.pose(timeSec, reduced ? 0 : 1); },
  };
}
