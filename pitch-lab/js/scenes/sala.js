// SALA DE ENSAYO: cuarto pequeño y cálido, tres oyentes a unos dos metros.
// Pensada para aprender la mecánica con poca presión.

import { addLectern, makeSign, addPlant, addBezel, addGlow, addShelf } from './furniture.js';
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

  // --- Estructura: piso, techo, paredes ---
  kit.box([W, 0.1, D], [cx, -0.05, cz], '#1B2016', { rough: 0.9 });
  kit.box([W, 0.1, D], [cx, H + 0.05, cz], '#13170F');
  kit.box([W, H, 0.1], [cx, H / 2, room.minZ - 0.05], theme.wall);                 // pared del público
  kit.box([0.1, H, D], [room.minX - 0.05, H / 2, cz], theme.wall);                 // izquierda
  kit.box([0.1, H, D], [room.maxX + 0.05, H / 2, cz], theme.wall);                 // derecha
  kit.box([W, H, 0.1], [cx, H / 2, room.maxZ + 0.05], '#0A2E9A', { rough: 0.7 }); // pared del brief (azul de marca, oscurecido)
  kit.box([W, 0.12, 0.04], [cx, 0.06, room.minZ + 0.02], '#11160E');               // zócalos
  kit.box([0.04, 0.12, D], [room.minX + 0.02, 0.06, cz], '#11160E');
  kit.box([0.04, 0.12, D], [room.maxX - 0.02, 0.06, cz], '#11160E');
  kit.box([W, 0.05, 0.03], [cx, 1.08, room.minZ + 0.02], '#FFC94A');               // guarda amarilla

  // --- Alfombra bajo el público ---
  kit.box([3.9, 0.02, 2.3], [0, 0.01, -2.55], '#0B2A8A');
  kit.box([3.6, 0.024, 2.0], [0, 0.012, -2.55], '#0A2478');
  kit.box([3.9, 0.026, 0.05], [0, 0.013, -1.42], '#FFC94A');

  // --- Pantalla del brief (pared de atrás) ---
  addBezel(kit, { x: 0, y: 1.6, z: room.maxZ - 0.02, w: 2.4, h: 1.35, rotY: 180 });

  // --- Reloj en la pared del público, a la vista de quien presenta ---
  addBezel(kit, { x: 0, y: 2.05, z: room.minZ + 0.02, w: 1.5, h: 0.58, rotY: 0, depth: 0.1 });

  // --- Decoración ---
  addPlant(kit, -2.25, -3.45, 1.1);
  addPlant(kit, 2.25, 2.7, 0.9);
  addShelf(kit, { x: 2.7, y: 1.1, z: -1.2, w: 1.2, rotY: -90 });
  addShelf(kit, { x: 2.7, y: 1.6, z: -1.2, w: 1.2, rotY: -90 });

  // Ventana en la pared derecha
  kit.box([0.06, 1.2, 1.7], [room.maxX - 0.03, 1.55, -2.7], '#11160E');
  kit.box([0.02, 1.08, 1.58], [room.maxX - 0.06, 1.55, -2.7], '#1E2C4A', { material: kit.basic('#27406E') });
  kit.box([0.03, 1.08, 0.03], [room.maxX - 0.07, 1.55, -2.7], '#11160E');

  // Puerta en la pared izquierda
  kit.box([0.08, 2.05, 0.95], [room.minX + 0.04, 1.025, -0.9], '#11160E');
  kit.box([0.1, 0.06, 0.06], [room.minX + 0.09, 1.0, -0.55], '#FFC94A');
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

  // Luminarias de techo
  [-1.2, 1.2].forEach((x) => addGlow(kit, [0.9, 0.04, 0.5], [x, H - 0.02, -1.3], '#FFF1C9'));
  addGlow(kit, [1.4, 0.04, 0.5], [0, H - 0.02, 1.6], '#FFF1C9');

  addLectern(kit);
  const audience = buildAudience(kit, sc.seats, { seatColor: '#2A3225', accent: theme.accent });

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
      panel: { pos: [0, 2.05, -0.5], scale: 1.2 },
      clock: { pos: [0, 2.05, room.minZ + 0.05], rotY: 0, scale: 1.04 },
      brief: { pos: [0, 1.6, room.maxZ - 0.075], rotY: 180, scale: 1.25 },
      compact: { pos: [0, 1.4, room.minZ + 0.05], rotY: 0, scale: 0.8 },
    },
    entities,
    audience,
    disposers,
    update(timeSec, reduced) { audience.pose(timeSec, reduced ? 0 : 1); },
  };
}
