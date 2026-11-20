// AUDITORIO: escenario elevado frente a una platea con rake, dos alas laterales y un balcón.
// La escala es lo que cambia la experiencia: el público está lejos y repartido en cuatro zonas.

import { addLectern, makeSign, addBezel, addGlow } from './furniture.js';
import { addFloor, addCeilingDetail, addSpeaker, addMonitorWedge, addLightBeam } from './dressing.js';
import { buildAudience } from './audience.js';
import { FloatingButton } from './interactives.js';

export const STAGE_LEVEL = 0;
export const HALL_FLOOR = -0.6;

export function buildAuditorio(kit, sc, { onPress }) {
  const { room, theme } = sc;
  const W = room.maxX - room.minX;
  const D = room.maxZ - room.minZ;
  const H = room.height;
  const cx = (room.minX + room.maxX) / 2;
  const cz = (room.minZ + room.maxZ) / 2;
  const entities = [];
  const disposers = [];
  const stageFront = -2.2;

  // --- Estructura ---
  kit.box([W, 0.1, D], [cx, HALL_FLOOR - 0.05, cz], '#12160F', { rough: 0.9 });          // platea
  kit.box([W, 0.1, D], [cx, H + 0.05, cz], '#0D100A');
  kit.box([W, H + 1, 0.1], [cx, (H - 1) / 2 + 0.0, room.minZ - 0.05], '#1B2018');
  kit.box([0.1, H + 1, D], [room.minX - 0.05, (H - 1) / 2, cz], '#1B2018');
  kit.box([0.1, H + 1, D], [room.maxX + 0.05, (H - 1) / 2, cz], '#1B2018');
  kit.box([W, H + 1, 0.1], [cx, (H - 1) / 2, room.maxZ + 0.05], '#10140D');

  addFloor(kit, 'carpet', { x: cx, y: HALL_FLOOR + 0.003, z: cz, w: W, d: D, base: '#12160F', tile: 1.4 });
  addCeilingDetail(kit, room, H, { beams: false, cove: '#7F9BFF' });

  // --- Escenario elevado ---
  kit.box([15, 0.6, 7.2], [0, -0.3, 1.4], '#1E241A', { rough: 0.7 });
  kit.box([15, 0.03, 7.2], [0, 0.015, 1.4], '#171C13', { rough: 0.5 });
  addFloor(kit, 'stage', { x: 0, y: 0.032, z: 1.4, w: 15, d: 7.2, base: '#161B12', tile: 1.6 });
  // Parlantes a los lados y monitores en el borde del escenario
  [-1, 1].forEach((side) => addSpeaker(kit, { x: side * 6.5, y: 0.03, z: 0.4, rotY: 180, scale: 1.25 }));
  [-3.4, 0, 3.4].forEach((x) => addMonitorWedge(kit, { x, y: 0.03, z: stageFront - 0.12 + 0.0 }));
  kit.box([15, 0.06, 0.1], [0, 0.03, stageFront], '#FFC94A');                               // borde amarillo del escenario
  kit.box([4.4, 0.2, 0.9], [0, -0.5, stageFront - 0.45], '#20261C');                         // escalones
  kit.box([4.4, 0.4, 0.9], [0, -0.4, stageFront - 0.9 + 0.45], '#20261C');

  // --- Pantalla gigante del brief + cortinas ---
  addBezel(kit, { x: 0, y: 3.6, z: room.maxZ - 0.02, w: 8.0, h: 4.5, rotY: 180, depth: 0.2 });
  [-1, 1].forEach((s) => {
    kit.box([1.6, 8.6, 0.3], [s * 6.6, 4.3, room.maxZ - 0.3], theme.accent, { rough: 0.9 });
    kit.box([0.15, 8.6, 0.32], [s * 5.75, 4.3, room.maxZ - 0.29], '#FFC94A');
  });

  // --- Truss y focos sobre el escenario ---
  kit.box([14, 0.18, 0.18], [0, 7.4, 1.0], '#11160E', { metal: 0.4 });
  kit.box([14, 0.18, 0.18], [0, 7.4, 3.6], '#11160E', { metal: 0.4 });
  [-5, -2.5, 0, 2.5, 5].forEach((x) => {
    kit.cyl(0.18, 0.12, 0.34, [x, 7.1, 1.0], '#11160E', { seg: 10, rotX: 20 });
    addGlow(kit, [0.2, 0.04, 0.2], [x, 6.93, 0.9], '#FFF1C9');
  });

  [-3.5, 0, 3.5].forEach((x) => addLightBeam(kit, { from: [x, 6.93, 0.9], to: [x * 0.5, 0.03, 0.2], radius: 1.2, opacity: 0.04 }));

  // --- Tribunas con rake: filas escalonadas por zona ---
  const seatsByZone = sc.audience.zones;
  seatsByZone.forEach((z) => {
    for (let r = 0; r < z.rows; r++) {
      const y = (z.baseY ?? HALL_FLOOR) + z.rise * r;
      const base = z.baseY ?? HALL_FLOOR;
      const widthM = z.cols * z.dx + 0.5;
      const centerX = z.x + ((z.cols - 1) * z.dx) / 2;
      const centerZ = z.z - r * z.dz;
      const thickness = z.baseY != null ? 0.5 : Math.max(0.06, y - HALL_FLOOR);
      const topY = y;
      kit.box([widthM, thickness, z.dz * 0.98], [centerX, topY - thickness / 2, centerZ], '#1A2016', { rough: 0.9 });
      // Franja de luz en el borde de cada grada
      addGlow(kit, [widthM, 0.02, 0.03], [centerX, topY + 0.005, centerZ + z.dz * 0.49], r % 2 ? '#0047FF' : '#FFC94A');
    }
    if (z.baseY != null) {
      // Balcón: cubierta de apoyo + pilares + baranda
      const widthM = z.cols * z.dx + 0.5;
      const centerX = z.x + ((z.cols - 1) * z.dx) / 2;
      const depth = z.rows * z.dz + 1.2;
      kit.box([widthM + 0.6, 0.3, depth], [centerX, z.baseY - 0.35, z.z - ((z.rows - 1) * z.dz) / 2 - 0.2], '#11160E');
      kit.box([widthM + 0.6, 0.9, 0.08], [centerX, z.baseY + 0.45, z.z + z.dz * 0.9], '#11160E', { opacity: 0.85 });
      kit.box([widthM + 0.6, 0.04, 0.1], [centerX, z.baseY + 0.92, z.z + z.dz * 0.9], '#FFC94A');
      [-1, 1].forEach((s) => kit.cyl(0.25, 0.3, z.baseY - HALL_FLOOR, [centerX + s * (widthM / 2 - 0.4), (z.baseY + HALL_FLOOR) / 2, z.z + z.dz * 0.6], '#11160E', { seg: 10 }));
    }
  });

  // --- Paredes laterales: listones acústicos y columnas de luz ---
  const slats = kit.batch();
  for (let z = 3.6, i = 0; z > room.minZ + 1; z -= 0.42, i++) {
    const color = i % 3 === 0 ? '#2F3A2B' : '#232B1E';
    slats.box([0.07, 5.6, 0.17], [room.minX + 0.08, 3.1, z], color, { rough: 0.8 });
    slats.box([0.07, 5.6, 0.17], [room.maxX - 0.08, 3.1, z], color, { rough: 0.8 });
  }
  slats.flush();
  for (let i = 0; i < 6; i++) {
    const z = 2 - i * 5;
    [room.minX + 0.3, room.maxX - 0.3].forEach((x) => addGlow(kit, [0.12, 6.0, 0.12], [x, 3.4, z], i % 2 ? '#0047FF' : '#FFC94A'));
  }

  // --- Reloj grande colgante sobre la platea (a la vista de quien presenta) ---
  const clockZ = -8.2;
  kit.cyl(0.02, 0.02, H - 5.9, [-0.5, 5.9 + (H - 5.9) / 2, clockZ - 0.05], '#11160E', { seg: 6 });
  kit.cyl(0.02, 0.02, H - 5.9, [0.5, 5.9 + (H - 5.9) / 2, clockZ - 0.05], '#11160E', { seg: 6 });
  addBezel(kit, { x: 0, y: 5.4, z: clockZ, w: 3.4, h: 1.32, rotY: 0, depth: 0.2 });

  // --- Cartel de salida ---
  const exit = makeSign({ text: 'SALIDA', w: 1.1, h: 0.3, bg: '#FFC94A', fg: '#181D16', size: 0.7, px: 300 });
  exit.el.object3D.position.set(room.maxX - 0.075, 3.0, -4);
  exit.el.object3D.rotation.y = -Math.PI / 2;
  entities.push(exit.el);
  disposers.push(() => exit.dispose());
  const name = makeSign({ text: 'AUDITORIO', sub: 'Espacio 03 · 120 segundos', w: 3.0, h: 0.9, size: 0.5, px: 260 });
  name.el.object3D.position.set(room.minX + 0.075, 3.4, -4);
  name.el.object3D.rotation.y = Math.PI / 2;
  entities.push(name.el);
  disposers.push(() => name.dispose());

  addLectern(kit);
  const audience = buildAudience(kit, sc.seats, { seatColor: '#20261C', accent: theme.accent, style: 'theater' });

  // Botón de regreso junto al asiento de observación
  const view = sc.seats.find((s) => s.view);
  if (view) {
    const back = new FloatingButton({
      action: { id: 'back-to-stage', label: 'Volver al atril', kind: 'primary', ui: 'recenter' },
      pos: [view.x, view.y + 1.0, view.z + 1.3],
      rotY: 180,
      w: 0.66,
      h: 0.18,
      onPress,
    });
    entities.push(back.el);
    disposers.push(() => back.dispose());
  }

  // --- Luz: focos sobre el escenario + penumbra en la sala ---
  kit.light('hemi', '#BFC8B8', 1.1, [0, H, 0], { ground: '#0C0F09' });
  kit.light('spot', '#F7F8F2', 80, [0, 7.0, 0.9], { target: [0, 1.2, 0], angle: 38, penumbra: 0.6, distance: 25, decay: 1.2 });
  kit.light('spot', '#F1F3EA', 34, [-4, 7.0, 1.4], { target: [-2, 0, 0.5], angle: 36, penumbra: 0.7, distance: 25, decay: 1.2 });
  kit.light('spot', '#F1F3EA', 34, [4, 7.0, 1.4], { target: [2, 0, 0.5], angle: 36, penumbra: 0.7, distance: 25, decay: 1.2 });
  kit.light('point', '#9BB4FF', 40, [0, 6.5, -9], { distance: 24, decay: 1.2 });
  kit.light('point', '#9BB4FF', 30, [0, 6.0, -18], { distance: 24, decay: 1.2 });

  return {
    id: sc.id,
    background: '#0B0E09',
    fog: { color: '#0B0E09', near: 24, far: 60 },
    spawn: sc.spawn,
    zones: sc.walk.zones,
    obstacles: sc.walk.obstacles,
    pads: sc.pads,
    anchors: {
      lectern: { pos: [0, 0, 0] },
      panel: { pos: [0, 2.05, -0.5], scale: 1.2 },
      clock: { pos: [0, 5.4, clockZ + 0.01], rotY: 0, scale: 2.3 },
      brief: { pos: [0, 3.6, room.maxZ - 0.075], rotY: 180, scale: 4.17 },
      compact: null,
    },
    entities,
    audience,
    disposers,
    update(timeSec, reduced) { audience.pose(timeSec, reduced ? 0 : 1); },
  };
}
