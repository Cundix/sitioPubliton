// Público estilizado y liviano, hecho con mallas instanciadas (pocas llamadas de dibujo).
// Cada persona es una pieza simple: cuerpo cónico + cabeza esférica sobre un asiento.
//
// IMPORTANTE (honestidad de diseño): las animaciones son un movimiento ambiental suave
// (respiración, leve giro de cabeza). NO dependen de lo que se diga ni del puntaje, y no
// representan una reacción real al argumento.

import { COLORS } from '../ui/draw.js';

const BODY_COLORS = ['#0047FF', '#FFC94A', '#FF006E', '#E9E4D4', '#7C9070', '#3E5CC8', '#C9A24A'];
const SKIN_TONES = ['#E9C9A6', '#C69C74', '#8D5F3C', '#F3D9C0', '#A97B55', '#6B452B'];

function radialShadowTexture(T) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

/**
 * @param {Kit} kit
 * @param {Array} seats  resultado de resolveScenario().seats
 * @param {object} opts  { seatColor }
 */
export function buildAudience(kit, seats, { seatColor = '#2A3225', accent = '#0047FF' } = {}) {
  const T = kit.T;
  const people = seats.filter((s) => s.occupied);
  const group = new T.Group();
  group.name = 'audience';
  kit.group.add(group);

  const dummy = new T.Object3D();
  const child = new T.Object3D();
  dummy.add(child);

  // --- Asientos: pie, base y respaldo ---
  const seatGeo = new T.BoxGeometry(0.46, 0.07, 0.44);
  const backGeo = new T.BoxGeometry(0.46, 0.5, 0.06);
  const legGeo = new T.CylinderGeometry(0.03, 0.05, 0.42, 8);
  const seatMat = kit.mat(seatColor, { rough: 0.8 });
  const accentMat = kit.mat(accent, { rough: 0.7 });
  const seatMesh = new T.InstancedMesh(seatGeo, seatMat, seats.length);
  const backMesh = new T.InstancedMesh(backGeo, accentMat, seats.length);
  const legMesh = new T.InstancedMesh(legGeo, kit.mat('#11160E', { rough: 0.6 }), seats.length);

  seats.forEach((s, i) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, s.yaw, 0);
    dummy.updateMatrix();
    child.position.set(0, 0.46, 0); child.rotation.set(0, 0, 0); child.updateWorldMatrix(true, false);
    seatMesh.setMatrixAt(i, child.matrixWorld);
    child.position.set(0, 0.72, 0.2); child.updateWorldMatrix(true, false);
    backMesh.setMatrixAt(i, child.matrixWorld);
    child.position.set(0, 0.21, 0); child.updateWorldMatrix(true, false);
    legMesh.setMatrixAt(i, child.matrixWorld);
  });
  group.add(seatMesh, backMesh, legMesh);

  // --- Sombras suaves bajo los asientos ---
  const shadowTex = radialShadowTexture(T);
  const shadowMat = new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false });
  const shadowGeo = new T.PlaneGeometry(1.0, 1.0);
  const shadowMesh = new T.InstancedMesh(shadowGeo, shadowMat, seats.length);
  seats.forEach((s, i) => {
    dummy.position.set(s.x, s.y + 0.012, s.z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.updateMatrix();
    shadowMesh.setMatrixAt(i, dummy.matrix);
  });
  group.add(shadowMesh);

  // --- Personas: cuerpo y cabeza ---
  const bodyGeo = new T.CylinderGeometry(0.12, 0.2, 0.56, 10);
  const headGeo = new T.SphereGeometry(0.115, 12, 9);
  const bodyMat = new T.MeshStandardMaterial({ roughness: 0.75, flatShading: true });
  const headMat = new T.MeshStandardMaterial({ roughness: 0.8, flatShading: true });
  const bodies = new T.InstancedMesh(bodyGeo, bodyMat, Math.max(1, people.length));
  const heads = new T.InstancedMesh(headGeo, headMat, Math.max(1, people.length));
  bodies.count = people.length;
  heads.count = people.length;
  const color = new T.Color();
  people.forEach((p, i) => {
    bodies.setColorAt(i, color.set(BODY_COLORS[(i * 3 + 1) % BODY_COLORS.length]));
    heads.setColorAt(i, color.set(SKIN_TONES[(i * 5 + 2) % SKIN_TONES.length]));
  });
  group.add(bodies, heads);

  const phases = people.map((_, i) => (i * 2.399963) % (Math.PI * 2)); // ángulo áureo: fases dispersas

  /** Pose de las personas. `amount` 0 = quietas (movimiento reducido), 1 = movimiento suave. */
  function pose(timeSec, amount = 1) {
    people.forEach((p, i) => {
      const ph = phases[i];
      const bob = Math.sin(timeSec * 0.9 + ph) * 0.007 * amount;
      const sway = Math.sin(timeSec * 0.45 + ph) * 0.014 * amount;
      const turn = Math.sin(timeSec * 0.3 + ph * 1.7) * 0.14 * amount;
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.updateMatrix();

      child.position.set(0, 0.5 + 0.28 + bob, 0.02);
      child.rotation.set(0, 0, sway);
      child.updateWorldMatrix(true, false);
      bodies.setMatrixAt(i, child.matrixWorld);

      child.position.set(0, 0.5 + 0.56 + 0.13 + bob * 1.4, 0.0);
      child.rotation.set(0, turn, 0);
      child.updateWorldMatrix(true, false);
      heads.setMatrixAt(i, child.matrixWorld);
    });
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
  }
  pose(0, 0);

  const disposable = {
    dispose() {
      [seatGeo, backGeo, legGeo, shadowGeo, bodyGeo, headGeo].forEach((g) => g.dispose());
      [shadowMat, bodyMat, headMat].forEach((m) => m.dispose());
      shadowTex.dispose();
      [seatMesh, backMesh, legMesh, shadowMesh, bodies, heads].forEach((m) => m.dispose());
    },
  };
  kit.track(disposable);

  return { pose, count: people.length, group };
}

export { COLORS };
