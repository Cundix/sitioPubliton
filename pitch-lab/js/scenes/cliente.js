// REUNIÓN CON CLIENTE: sala mediana con una mesa larga. Quien presenta está de pie en la
// cabecera y cinco personas se sientan muy cerca. La cercanía es lo que cambia la experiencia.

import { addLectern, makeSign, addPlant, addBezel, addGlow, addShelf } from './furniture.js';
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

  // --- Estructura ---
  kit.box([W, 0.1, D], [cx, -0.05, cz], '#1A1F15', { rough: 0.9 });
  kit.box([W, 0.1, D], [cx, H + 0.05, cz], '#13170F');
  kit.box([W, H, 0.1], [cx, H / 2, room.minZ - 0.05], theme.wall);
  kit.box([0.1, H, D], [room.minX - 0.05, H / 2, cz], theme.wall);
  kit.box([0.1, H, D], [room.maxX + 0.05, H / 2, cz], theme.wall);
  kit.box([W, H, 0.1], [cx, H / 2, room.maxZ + 0.05], '#1B2016');
  kit.box([W, 0.14, 0.04], [cx, 0.07, room.minZ + 0.02], '#11160E');
  kit.box([0.04, 0.14, D], [room.minX + 0.02, 0.07, cz], '#11160E');
  kit.box([0.04, 0.14, D], [room.maxX - 0.02, 0.07, cz], '#11160E');
  kit.box([W, 0.5, 0.03], [cx, 2.7, room.maxZ - 0.015], theme.accent);   // franja rosa sobre la pantalla

  // --- Alfombra larga bajo la mesa ---
  kit.box([4.2, 0.02, 5.6], [0, 0.01, -3.0], '#232B1E');
  kit.box([4.2, 0.024, 0.06], [0, 0.012, -0.28], '#FFC94A');

  // --- Mesa de reunión ---
  const top = kit.box([1.8, 0.07, 3.75], [0, 0.76, -2.825], '#5A4331', { rough: 0.55 });
  top.geometry.userData.table = true;
  kit.box([1.8, 0.02, 3.75], [0, 0.805, -2.825], '#6B5037', { rough: 0.4 });
  [[-0.78, -1.1], [0.78, -1.1], [-0.78, -4.55], [0.78, -4.55]].forEach(([x, z]) => kit.cyl(0.05, 0.05, 0.73, [x, 0.365, z], '#11160E', { seg: 8 }));
  // Objetos sobre la mesa: tazas, cuadernos, jarra
  [[-0.55, -1.7], [0.55, -1.7], [-0.55, -3.1], [0.55, -3.1], [0, -4.6]].forEach(([x, z], i) => {
    kit.cyl(0.04, 0.035, 0.09, [x * 0.85, 0.87, z], '#F4F1E8', { seg: 10 });
    kit.box([0.26, 0.02, 0.2], [x * 0.55, 0.835, z + (i === 4 ? -0.25 : 0.0)], i % 2 ? '#FFC94A' : '#0047FF', { rotY: (i - 2) * 12 });
  });
  kit.cyl(0.07, 0.07, 0.24, [0, 0.95, -2.8], '#9EC3E6', { seg: 10, opacity: 0.55 });
  kit.cyl(0.075, 0.075, 0.03, [0, 1.08, -2.8], '#11160E', { seg: 10 });

  // --- Pantalla ancha del brief (pared de atrás) ---
  addBezel(kit, { x: 0, y: 1.55, z: room.maxZ - 0.02, w: 3.2, h: 1.8, rotY: 180 });

  // --- Reloj al fondo de la mesa, a la vista de quien presenta ---
  addBezel(kit, { x: 0, y: 2.2, z: room.minZ + 0.02, w: 1.5, h: 0.58, rotY: 0, depth: 0.1 });

  // --- Ventanal con vista a la ciudad (pared derecha) ---
  kit.box([0.08, 2.0, 4.6], [room.maxX - 0.04, 1.5, -3.0], '#0B0E09');
  kit.box([0.02, 1.86, 4.46], [room.maxX - 0.07, 1.5, -3.0], '#10192E', { material: kit.basic('#16233F') });
  const skyline = [[-1.9, 0.9], [-1.5, 1.4], [-1.0, 0.7], [-0.5, 1.6], [0.1, 1.0], [0.6, 1.5], [1.2, 0.8], [1.8, 1.2]];
  skyline.forEach(([dz, h], i) => {
    kit.box([0.02, h, 0.34], [room.maxX - 0.09, 0.57 + h / 2, -3.0 + dz], '#0A0F1C', { material: kit.basic('#0A1226') });
    if (i % 2 === 0) kit.box([0.02, 0.06, 0.06], [room.maxX - 0.095, 0.7 + h * 0.6, -3.0 + dz], '#FFC94A', { material: kit.basic('#FFC94A') });
  });
  for (let i = -2; i <= 2; i++) kit.box([0.04, 1.86, 0.04], [room.maxX - 0.08, 1.5, -3.0 + i * 0.9], '#0B0E09');

  // --- Pared izquierda: cartel + estante + planta ---
  const name = makeSign({ text: 'REUNIÓN CON CLIENTE', sub: 'Espacio 02 · 90 segundos', w: 2.2, h: 0.62, size: 0.4, px: 320 });
  name.el.object3D.position.set(room.minX + 0.075, 1.9, -3.0);
  name.el.object3D.rotation.y = Math.PI / 2;
  entities.push(name.el);
  disposers.push(() => name.dispose());
  addShelf(kit, { x: room.minX + 0.2, y: 1.1, z: -1.3, w: 1.3, rotY: 90 });
  addShelf(kit, { x: room.minX + 0.2, y: 1.6, z: -1.3, w: 1.3, rotY: 90 });
  addPlant(kit, -3.7, -5.6, 1.2);
  addPlant(kit, 3.7, 2.8, 1.0);

  // --- Luminarias lineales sobre la mesa ---
  [-3.8, -2.6, -1.4].forEach((z) => addGlow(kit, [1.5, 0.05, 0.26], [0, H - 0.03, z], '#FFF1C9'));

  addLectern(kit);
  const audience = buildAudience(kit, sc.seats, { seatColor: '#20261C', accent: theme.accent });

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
      panel: { pos: [0, 2.05, -0.5], scale: 1.2 },
      clock: { pos: [0, 2.2, room.minZ + 0.05], rotY: 0, scale: 1.04 },
      brief: { pos: [0, 1.55, room.maxZ - 0.075], rotY: 180, scale: 1.67 },
      compact: { pos: [0, 1.5, room.minZ + 0.05], rotY: 0, scale: 0.8 },
    },
    entities,
    audience,
    disposers,
    update(timeSec, reduced) { audience.pose(timeSec, reduced ? 0 : 1); },
  };
}
