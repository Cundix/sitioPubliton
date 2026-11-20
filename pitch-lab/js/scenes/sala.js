// SALA DE ENSAYO: cuarto pequeño y cálido, tres oyentes a unos dos metros.
// Pensada para aprender la mecánica con poca presión.

import { addLectern, makeSign, addPlant, addBezel, addGlow, addShelf } from './furniture.js';
import { addFloor, addWainscot, addCeilingDetail, addWindow, addDoor, addPoster } from './dressing.js';
import { buildAudience } from './audience.js';

export function buildSala(kit, sc) {
  const { room, theme } = sc;
  const W = room.maxX - room.minX;
  const D = room.maxZ - room.minZ;
  const H = room.height;
  const cx = (room.minX + room.maxX) / 2;
  const cz = (room.minZ + room.maxZ) / 2;
  const entities = [];
  const disposers = [];
  const bag = { entities, disposers };

  // --- Estructura: piso, techo, paredes ---
  kit.box([W, 0.1, D], [cx, -0.05, cz], '#1B2016', { rough: 0.9 });
  addFloor(kit, 'carpet', { x: cx, y: 0.002, z: cz, w: W, d: D, base: '#1B2016' });
  kit.box([W, 0.1, D], [cx, H + 0.05, cz], '#13170F');
  kit.box([W, H, 0.1], [cx, H / 2, room.minZ - 0.05], theme.wall);                 // pared del público
  kit.box([0.1, H, D], [room.minX - 0.05, H / 2, cz], theme.wall);                 // izquierda
  kit.box([0.1, H, D], [room.maxX + 0.05, H / 2, cz], theme.wall);                 // derecha
  kit.box([W, H, 0.1], [cx, H / 2, room.maxZ + 0.05], '#0A2E9A', { rough: 0.7 }); // pared del brief (azul de marca, oscurecido)
  kit.box([W, 0.12, 0.05], [cx, 0.06, room.minZ + 0.025], '#11160E');               // zócalos
  kit.box([0.05, 0.12, D], [room.minX + 0.025, 0.06, cz], '#11160E');
  kit.box([0.05, 0.12, D], [room.maxX - 0.025, 0.06, cz], '#11160E');
  addWainscot(kit, room, { color: '#2A3225', rail: '#FFC94A', height: 0.95 });
  addCeilingDetail(kit, room, H);

  // --- Alfombra bajo el público ---
  kit.box([3.9, 0.02, 2.3], [0, 0.01, -2.55], '#0B2A8A');
  kit.box([3.6, 0.024, 2.0], [0, 0.012, -2.55], '#0A2478');
  kit.box([3.9, 0.026, 0.05], [0, 0.013, -1.42], '#FFC94A');

  // --- Pantalla del brief (pared de atrás) ---
  addBezel(kit, { x: 0, y: 1.6, z: room.maxZ - 0.02, w: 2.4, h: 1.35, rotY: 180 });

  // --- Reloj en la pared del público, a la vista de quien presenta ---
  addBezel(kit, { x: 0, y: 2.05, z: room.minZ + 0.02, w: 1.5, h: 0.58, rotY: 0, depth: 0.1 });

  // --- Afiches de la marca ---
  addPoster(kit, bag, { x: -1.85, y: 1.75, z: room.minZ + 0.05, rotY: 0, w: 0.72, h: 0.98, style: 'sun', seed: 3 });
  addPoster(kit, bag, { x: 1.85, y: 1.75, z: room.minZ + 0.05, rotY: 0, w: 0.72, h: 0.98, style: 'type', seed: 5 });
  addPoster(kit, bag, { x: -2.05, y: 1.6, z: room.maxZ - 0.05, rotY: 180, w: 0.7, h: 0.95, style: 'blocks', seed: 8 });
  addPoster(kit, bag, { x: 2.05, y: 1.6, z: room.maxZ - 0.05, rotY: 180, w: 0.7, h: 0.95, style: 'waves', seed: 13 });

  // --- Decoración ---
  addPlant(kit, -2.25, -3.45, 1.1);
  addPlant(kit, 2.25, 2.7, 0.9);
  addShelf(kit, { x: 2.7, y: 1.1, z: -0.2, w: 1.2, rotY: -90 });
  addShelf(kit, { x: 2.7, y: 1.6, z: -0.2, w: 1.2, rotY: -90 });

  // Ventana en la pared derecha y puerta en la izquierda (con marco)
  addWindow(kit, { x: room.maxX - 0.005, y: 1.55, z: -2.7, rotY: -90, w: 1.6, h: 1.1, cols: 2 });
  addDoor(kit, { x: room.minX + 0.005, z: -0.9, rotY: 90 });
  const exit = makeSign({ text: 'SALIDA', w: 0.7, h: 0.2, bg: '#FFC94A', fg: '#181D16', size: 0.7, px: 300 });
  exit.el.object3D.position.set(room.minX + 0.075, 2.3, -0.9);
  exit.el.object3D.rotation.y = Math.PI / 2;
  entities.push(exit.el);
  disposers.push(() => exit.dispose());

  // Cartel del espacio
  const name = makeSign({ text: 'SALA DE ENSAYO', sub: 'Espacio 01 · 60 segundos', w: 1.9, h: 0.6, size: 0.42, px: 340 });
  name.el.object3D.position.set(room.minX + 0.075, 1.75, -2.8);
  name.el.object3D.rotation.y = Math.PI / 2;
  entities.push(name.el);
  disposers.push(() => name.dispose());

  // Luminarias de techo (paneles con marco)
  [-1.2, 1.2].forEach((x) => { kit.box([1.0, 0.03, 0.6], [x, H - 0.015, -1.3], '#0B0E09'); addGlow(kit, [0.9, 0.04, 0.5], [x, H - 0.03, -1.3], '#FFF1C9'); });
  kit.box([1.5, 0.03, 0.6], [0, H - 0.015, 1.6], '#0B0E09');
  addGlow(kit, [1.4, 0.04, 0.5], [0, H - 0.03, 1.6], '#FFF1C9');

  addLectern(kit);
  const audience = buildAudience(kit, sc.seats, { seatColor: '#2A3225', accent: theme.accent, style: 'chair' });

  // --- Luz: cálida y pareja ---
  kit.light('hemi', '#DDE4D2', 1.25, [0, H, 0], { ground: '#12170E' });
  kit.light('point', '#FFF0CF', 6, [0, H - 0.3, -1.3], { distance: 8, decay: 1.2 });
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
      clock: { pos: [0, 2.05, room.minZ + 0.05], rotY: 0, scale: 1.04 },
      brief: { pos: [0, 1.6, room.maxZ - 0.075], rotY: 180, scale: 1.25 },
      compact: { pos: [0, 1.4, room.minZ + 0.05], rotY: 0, scale: 1.1 },
    },
    entities,
    audience,
    disposers,
    update(timeSec, reduced) { audience.pose(timeSec, reduced ? 0 : 1); },
  };
}
