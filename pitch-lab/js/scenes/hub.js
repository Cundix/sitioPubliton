// Hub: el vestíbulo de Pitch Lab. Acá se da la bienvenida, se aprende a usar los
// controles y se elige un escenario entre tres maquetas sobre pedestales.

import { addLectern, makeSign, addGlow } from './furniture.js';
import { radialFloorMaterial } from './dressing.js';
import { Maquette } from './maquette.js';
import { DEG } from './scene-kit.js';
import { resolveScenario } from '../core/layouts.js';
import { SCENARIOS } from '../config/scenarios.js';

export const HUB_SPAWN = { x: 0, z: 1.4, yawDeg: 0 };

export function buildHub(kit, { onPick, onHover }) {
  const T = kit.T;
  const R = 7.6;
  const H = 5.4;

  // Piso: disco oscuro con anillos amarillos y marca de inicio
  const floor = new T.Mesh(new T.CircleGeometry(R, 56), radialFloorMaterial(kit));
  floor.rotation.x = -Math.PI / 2;
  kit.group.add(floor);
  kit.track({ dispose: () => floor.geometry.dispose() });
  [2.2, 4.6, 6.6].forEach((r, i) => {
    const ring = new T.Mesh(new T.RingGeometry(r, r + 0.035, 72), kit.basic(i === 1 ? '#FFC94A' : '#3C4636'));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.004;
    kit.group.add(ring);
    kit.track({ dispose: () => ring.geometry.dispose() });
  });

  // Paredes curvas, techo y luminarias
  const wallGeo = new T.CylinderGeometry(R, R, H, 56, 1, true);
  const wall = new T.Mesh(wallGeo, kit.mat('#20261C', { side: 'back', flat: false, rough: 0.95 }));
  wall.position.y = H / 2;
  kit.group.add(wall);
  kit.track({ dispose: () => wallGeo.dispose() });
  const ceil = new T.Mesh(new T.CircleGeometry(R, 56), kit.mat('#0F130C', { flat: false }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  kit.group.add(ceil);
  kit.track({ dispose: () => ceil.geometry.dispose() });
  // Costillas verticales en la pared curva (un solo lote) y un óculo luminoso en el techo
  const ribs = kit.batch();
  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * Math.PI * 2;
    ribs.box([0.14, 3.7, 0.07], [Math.sin(a) * (R - 0.045), 2.15, -Math.cos(a) * (R - 0.045)], i % 4 === 0 ? '#3A4533' : '#2A3225', { rotY: -a * (180 / Math.PI), rough: 0.85 });
  }
  ribs.flush();
  const oculus = new T.Mesh(new T.CircleGeometry(1.35, 40), kit.basic('#FFF1C9'));
  oculus.rotation.x = Math.PI / 2;
  oculus.position.y = H - 0.02;
  kit.group.add(oculus);
  kit.track({ dispose: () => oculus.geometry.dispose() });
  const lamp = new T.Mesh(new T.TorusGeometry(3.4, 0.05, 6, 64), kit.basic('#FFF1C9'));
  lamp.rotation.x = Math.PI / 2;
  lamp.position.y = H - 0.06;
  kit.group.add(lamp);
  kit.track({ dispose: () => lamp.geometry.dispose() });

  // Franja amarilla tipo "ticker" a lo largo de la pared del fondo + cartel grande
  const entities = [];
  const disposers = [];
  [['PITCH', -1], ['LAB', 1]].forEach(([word, side]) => {
    const big = makeSign({ text: word, sub: side < 0 ? 'Publitón' : 'Tu idea merece un buen pitch', w: 3.8, h: 1.9, bg: null, fg: side < 0 ? '#FFFFFF' : '#FFC94A', accent: '#C5CABF', size: 0.78, px: 260 });
    const a = side * 62 * DEG;
    big.el.object3D.position.set(Math.sin(a) * (R - 0.34), 3.2, -Math.cos(a) * (R - 0.34)); // un poco más cerca: el cartel es plano y la pared, curva
    big.el.object3D.rotation.y = -a;
    entities.push(big.el);
    disposers.push(() => big.dispose());
  });

  // Franja amarilla en tres tramos que siguen la curva de la pared (un solo cartel plano de 9,6 m se salía de la pared y se cortaba)
  [['MENOS RUIDO. MÁS IDEAS.', -25.5], ['HACKEANDO EL MENSAJE.', 0], ['MENOS RUIDO. MÁS IDEAS.', 25.5]].forEach(([text, deg]) => {
    const tick = makeSign({ text, w: 3.2, h: 0.5, bg: '#FFC94A', fg: '#181D16', size: 0.56, px: 260 });
    const ang = deg * DEG;
    tick.el.object3D.position.set(Math.sin(ang) * (R - 0.27), 1.55, -Math.cos(ang) * (R - 0.27));
    tick.el.object3D.rotation.y = -ang;
    entities.push(tick.el);
    disposers.push(() => tick.dispose());
  });

  // Pilares de luz (marcan el contorno del espacio)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    addGlow(kit, [0.08, 3.2, 0.08], [Math.sin(a) * (R - 0.15), 1.9, -Math.cos(a) * (R - 0.15)], i % 2 ? '#0047FF' : '#FFC94A');
  }

  addLectern(kit);

  // Maquetas: tres pedestales en arco frente a la persona
  const maquettes = [];
  const arc = [{ id: 'sala', a: -46 }, { id: 'cliente', a: 0 }, { id: 'auditorio', a: 46 }];
  const radius = 3.1;
  arc.forEach(({ id, a }) => {
    const sc = resolveScenario(SCENARIOS.find((s) => s.id === id));
    const x = Math.sin(a * DEG) * radius;
    const z = -Math.cos(a * DEG) * radius;
    const mq = new Maquette(kit, sc, { x, z, rotY: -a, onPick, onHover });
    maquettes.push(mq);
    entities.push(mq.root);
    disposers.push(() => mq.dispose());
    kit.light('spot', '#FFF1C9', 45, [x * 0.8, 4.4, z * 0.8 + 0.6], { target: [x, 1, z], angle: 22, penumbra: 0.6, distance: 12, decay: 1.2 });
  });

  kit.light('hemi', '#CFD8C5', 1.7, [0, 5, 0], { ground: '#10140D' });
  kit.light('point', '#FFD98A', 9, [0, 3.2, 3.0], { distance: 9, decay: 1.2 });

  return {
    id: 'hub',
    background: '#0E120B',
    fog: null,
    spawn: HUB_SPAWN,
    zones: [{ id: 'atril', y: 0, rect: { minX: -1.6, maxX: 1.6, minZ: -0.6, maxZ: 2.4 } }],
    obstacles: [{ minX: -0.8, maxX: 0.8, minZ: -0.45, maxZ: 0.5 }],
    pads: [],
    anchors: {
      lectern: { pos: [0, 0, 0] },
      panel: { pos: [0, 2.2, -0.5], scale: 1.2 },
      clock: null,
      brief: null,
      compact: null,
    },
    entities,
    maquettes,
    disposers,
    update(timeSec, reduced) { maquettes.forEach((m) => m.update(timeSec, reduced)); },
  };
}
