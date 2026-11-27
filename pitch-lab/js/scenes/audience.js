// Público estilizado y liviano, hecho con mallas instanciadas (pocas llamadas de dibujo).
// Cada persona es una figura sentada de pocas piezas: torso, hombros, cuello, cabeza con pelo, brazos, manos,
// muslos, piernas y zapatos. Hay variedad de altura, ropa, pelo, tono de piel y postura de los brazos
// (manos en el regazo, brazos cruzados o apoyados), todo determinista (misma semilla = mismo público).
//
// Costo: ≈ 17 llamadas de dibujo por espacio y ≈ 560 triángulos por persona cercana (≈ 450 si está lejos del atril).
// Material difuso (Lambert): más barato que el PBR estándar y suficiente para figuras de colores planos.
//
// Docentes en 3D: cada persona del público tiene un 30 % de ser, en vez de esta figura genérica, un modelo 3D con textura
// (personas.js, ≈ 4 500 triángulos). Se dibujan instanciados: hasta 6 llamadas de dibujo más por espacio, una por modelo.
//
// IMPORTANTE (honestidad de diseño): las animaciones son un movimiento ambiental suave
// (respiración, leve giro de cabeza). NO dependen de lo que se diga ni del puntaje, y no
// representan una reacción real al argumento.

import { COLORS } from '../ui/draw.js';
import { mulberry32 } from '../core/layouts.js';
import { getLoadedPersonas, pickCameos, personasRandom } from './personas.js';

const SHIRT_COLORS = ['#0047FF', '#FFC94A', '#FF006E', '#E9E4D4', '#7C9070', '#3E5CC8', '#C9A24A', '#2B6F6A', '#B04A2E', '#5B4B8A'];
const SKIN_TONES = ['#E9C9A6', '#C69C74', '#8D5F3C', '#F3D9C0', '#A97B55', '#6B452B'];
const HAIR_COLORS = ['#17110D', '#2E1D12', '#4A3020', '#7A5230', '#B88A4A', '#D8BD83', '#7D7D7A', '#E4DED0', '#8A2F1B'];
const PANTS_COLORS = ['#1B1F2A', '#2B2E24', '#3B3F4A', '#4A3B2E', '#12141A', '#34405C'];
const SHOE_COLORS = ['#0F0F0F', '#EAE6DA', '#7A3B2E', '#1F2A44'];

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
 * @param {object} opts  { seatColor, accent, style: 'chair' | 'theater', personas, random }
 *   `personas`: modelos de los docentes en 3D ya cargados (personas.js); sin ellos todo el público son figuras genéricas.
 *   `random`: origen de azar con el que cada persona decide si es un docente en 3D (30 %).
 */
export function buildAudience(kit, seats, {
  seatColor = '#2A3225', accent = '#0047FF', style = 'chair', personas = getLoadedPersonas(), random = personasRandom(),
} = {}) {
  const T = kit.T;
  const occupied = seats.filter((s) => s.occupied);
  // Cada persona del público tiene un 30 % de ser uno de los docentes en 3D (modelo 3D) en vez de una figura genérica.
  const cameoOf = pickCameos(occupied.length, { models: personas ? personas.length : 0, random });
  const people = occupied.filter((_, i) => cameoOf[i] < 0); // figuras genéricas
  const cameos = occupied.map((seat, i) => ({ seat, model: cameoOf[i] })).filter((c) => c.model >= 0);
  const n = people.length;
  const group = new T.Group();
  group.name = 'audience';
  kit.group.add(group);

  const geos = [];
  const meshes = [];
  const mats = [];
  const geo = (g) => { geos.push(g); return g; };
  const instanced = (g, material, count) => {
    const m = new T.InstancedMesh(g, material, Math.max(1, count));
    m.count = count;
    meshes.push(m);
    group.add(m);
    return m;
  };

  // Temporales para no crear objetos en cada cuadro
  const up = new T.Vector3(0, 1, 0);
  const pos = new T.Vector3();
  const scl = new T.Vector3(1, 1, 1);
  const quat = new T.Quaternion();
  const eul = new T.Euler();
  const aV = new T.Vector3();
  const bV = new T.Vector3();
  const dir = new T.Vector3();
  const local = new T.Matrix4();
  const out = new T.Matrix4();
  const baseM = new T.Matrix4();

  // --- Asientos ---------------------------------------------------------------------------------------------------
  const seatMat = kit.mat(seatColor, { rough: 0.8 });
  const accentMat = kit.mat(accent, { rough: 0.7 });
  const darkMat = kit.mat('#11160E', { rough: 0.6 });
  const seatGeo = geo(new T.BoxGeometry(0.46, 0.07, 0.44));
  const seatMesh = instanced(seatGeo, seatMat, seats.length);
  const seatBase = new T.Matrix4();
  const placeSeat = (mesh, i, s, lx, ly, lz, rotX = 0) => {
    seatBase.compose(pos.set(s.x, s.y, s.z), quat.setFromAxisAngle(up, s.yaw), scl.set(1, 1, 1));
    local.compose(aV.set(lx, ly, lz), quat.setFromAxisAngle(new T.Vector3(1, 0, 0), rotX), scl.set(1, 1, 1));
    out.multiplyMatrices(seatBase, local);
    mesh.setMatrixAt(i, out);
  };

  if (style === 'theater') {
    const backGeo = geo(new T.BoxGeometry(0.46, 0.58, 0.06));
    const sideGeo = geo(new T.BoxGeometry(0.04, 0.62, 0.44));
    const capGeo = geo(new T.BoxGeometry(0.075, 0.03, 0.44));
    const backMesh = instanced(backGeo, accentMat, seats.length);
    const sideMesh = instanced(sideGeo, darkMat, seats.length * 2);
    const capMesh = instanced(capGeo, seatMat, seats.length * 2);
    seats.forEach((s, i) => {
      placeSeat(seatMesh, i, s, 0, 0.46, 0);
      placeSeat(backMesh, i, s, 0, 0.76, 0.2, 0.08);
      [-1, 1].forEach((side, k) => {
        placeSeat(sideMesh, i * 2 + k, s, side * 0.255, 0.31, 0);
        placeSeat(capMesh, i * 2 + k, s, side * 0.255, 0.635, 0);
      });
    });
  } else {
    const backGeo = geo(new T.BoxGeometry(0.44, 0.46, 0.05));
    const legGeo = geo(new T.CylinderGeometry(0.018, 0.015, 0.44, 6));
    const backMesh = instanced(backGeo, accentMat, seats.length);
    const legMesh = instanced(legGeo, darkMat, seats.length * 4);
    seats.forEach((s, i) => {
      placeSeat(seatMesh, i, s, 0, 0.46, 0);
      placeSeat(backMesh, i, s, 0, 0.74, 0.2, 0.1);
      [[-0.19, -0.17], [0.19, -0.17], [-0.19, 0.17], [0.19, 0.17]].forEach(([lx, lz], k) => placeSeat(legMesh, i * 4 + k, s, lx, 0.22, lz));
    });
  }

  // --- Sombras suaves bajo los asientos -------------------------------------------------------------------------
  const shadowTex = radialShadowTexture(T);
  const shadowMat = new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false });
  mats.push(shadowMat);
  const shadowGeo = geo(new T.PlaneGeometry(1.1, 1.1));
  const shadowMesh = instanced(shadowGeo, shadowMat, seats.length);
  const dummy = new T.Object3D();
  seats.forEach((s, i) => {
    dummy.position.set(s.x, s.y + 0.012, s.z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.updateMatrix();
    shadowMesh.setMatrixAt(i, dummy.matrix);
  });

  // --- Personas ---------------------------------------------------------------------------------------------------
  const body = new T.MeshLambertMaterial({ flatShading: true }); // difuso: más barato que el PBR y suficiente para figuras de colores planos
  mats.push(body);
  const rand = mulberry32(7);
  const pick = (list) => list[Math.floor(rand() * list.length) % list.length];

  const torsoGeo = geo(new T.CylinderGeometry(0.15, 0.18, 0.52, 8));
  const yokeGeo = geo(new T.SphereGeometry(0.16, 8, 6));
  const neckGeo = geo(new T.CylinderGeometry(0.042, 0.05, 0.1, 5));
  const headGeo = geo(new T.SphereGeometry(0.105, 9, 7));
  const hairGeo = geo(new T.SphereGeometry(0.114, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.58));
  const hairBackGeo = geo(new T.BoxGeometry(0.19, 0.2, 0.07));
  const upperGeo = geo(new T.CylinderGeometry(0.042, 0.038, 1, 5));
  const lowerGeo = geo(new T.CylinderGeometry(0.036, 0.03, 1, 5));
  const handGeo = geo(new T.BoxGeometry(0.05, 0.04, 0.075));
  const thighGeo = geo(new T.CylinderGeometry(0.078, 0.066, 1, 6));
  const shinGeo = geo(new T.CylinderGeometry(0.056, 0.045, 1, 6));
  const shoeGeo = geo(new T.BoxGeometry(0.095, 0.065, 0.21));

  // Nivel de detalle: a más de NEAR_DIST metros del atril no se dibujan cuello, manos, zapatos ni pelo largo (no se distinguen).
  const NEAR_DIST = 11;
  const near = people.map((p) => Math.hypot(p.x, p.z) <= NEAR_DIST);
  const nearPos = new Map();
  near.forEach((isNear, i) => { if (isNear) nearPos.set(i, nearPos.size); });
  const nearCount = nearPos.size;

  const torsos = instanced(torsoGeo, body, n);
  const yokes = instanced(yokeGeo, body, n);
  const necks = instanced(neckGeo, body, nearCount);
  const heads = instanced(headGeo, body, n);
  const hairs = instanced(hairGeo, body, n);
  const longHair = people.map((_, i) => near[i] && rand() < 0.34);
  const longIdx = [];
  longHair.forEach((isLong, i) => { if (isLong) longIdx.push(i); });
  const hairBacks = instanced(hairBackGeo, body, longIdx.length);
  const uppers = instanced(upperGeo, body, n * 2);
  const lowers = instanced(lowerGeo, body, n * 2);
  const hands = instanced(handGeo, body, nearCount * 2);
  const thighs = instanced(thighGeo, body, n * 2);
  const shins = instanced(shinGeo, body, n * 2);
  const shoes = instanced(shoeGeo, body, nearCount * 2);

  const color = new T.Color();
  const paint = (mesh, i, hex) => mesh.setColorAt(i, color.set(hex));

  // Datos fijos de cada persona (variedad determinista)
  const info = people.map((p, i) => {
    const kind = rand();
    return {
      hs: 0.94 + rand() * 0.12,                 // altura relativa
      wide: 0.92 + rand() * 0.18,               // ancho de torso
      pose: kind < 0.42 ? 0 : kind < 0.74 ? 1 : 2, // 0 = manos en el regazo · 1 = brazos cruzados · 2 = apoyados
      bald: rand() < 0.1,
      spread: 0.02 + rand() * 0.035,            // separación de rodillas
      sleeves: rand() < 0.5,                    // manga corta: antebrazo con piel
      phase: (i * 2.399963) % (Math.PI * 2),     // ángulo áureo: fases dispersas
    };
  });

  /** Matriz base de la persona (posición del asiento, giro y altura relativa). */
  const baseOf = (p, hs) => baseM.compose(pos.set(p.x, p.y, p.z), quat.setFromAxisAngle(up, p.yaw), scl.set(hs, hs, hs));
  const put = (mesh, i, lx, ly, lz, q, sx = 1, sy = 1, sz = 1) => {
    local.compose(aV.set(lx, ly, lz), q, bV.set(sx, sy, sz));
    out.multiplyMatrices(baseM, local);
    mesh.setMatrixAt(i, out);
  };
  const identity = new T.Quaternion();
  /** Pieza larga entre dos puntos (geometría de altura 1 a lo largo de Y). */
  const limb = (mesh, i, a, b, thick = 1) => {
    aV.set(a[0], a[1], a[2]);
    bV.set(b[0], b[1], b[2]);
    dir.copy(bV).sub(aV);
    const len = dir.length();
    quat.setFromUnitVectors(up, dir.normalize());
    local.compose(pos.copy(aV).add(bV).multiplyScalar(0.5), quat, scl.set(thick, len, thick));
    out.multiplyMatrices(baseM, local);
    mesh.setMatrixAt(i, out);
  };

  people.forEach((p, i) => {
    const d = info[i];
    baseOf(p, d.hs);
    const shirt = pick(SHIRT_COLORS);
    const skin = pick(SKIN_TONES);
    const pants = pick(PANTS_COLORS);
    const shoe = pick(SHOE_COLORS);
    const hair = pick(HAIR_COLORS);
    paint(torsos, i, shirt); paint(yokes, i, shirt);
    if (near[i]) paint(necks, nearPos.get(i), skin);
    paint(heads, i, skin);
    paint(hairs, i, hair);
    const li = longIdx.indexOf(i);
    if (li >= 0) paint(hairBacks, li, hair);

    const sx = [-1, 1];
    sx.forEach((side, k) => {
      const j = i * 2 + k;
      // Piernas: muslo hacia adelante, pierna hacia abajo, zapato apuntando al frente
      const hipX = side * 0.1;
      const kneeX = side * (0.1 + d.spread);
      limb(thighs, j, [hipX, 0.58, 0.02], [kneeX, 0.585, -0.38]);
      limb(shins, j, [kneeX, 0.585, -0.39], [kneeX + side * 0.01, 0.1, -0.43]);
      paint(thighs, j, pants); paint(shins, j, pants);
      if (near[i]) {
        const nj = nearPos.get(i) * 2 + k;
        eul.set(0, -side * 0.12, 0);
        put(shoes, nj, kneeX + side * 0.01, 0.04, -0.5, quat.setFromEuler(eul));
        paint(shoes, nj, shoe);
      }

      // Brazos según la postura
      const S = [side * 0.205, 1.0, 0.04];
      let E; let W;
      if (d.pose === 1) {            // brazos cruzados sobre el pecho
        E = [side * 0.235, 0.8, -0.08];
        W = [-side * 0.11, 0.87, -0.15];
      } else if (d.pose === 2 && style === 'theater') { // apoyados en los apoyabrazos
        E = [side * 0.25, 0.8, 0.0];
        W = [side * 0.255, 0.69, -0.27];
      } else if (d.pose === 2) {     // apoyados al frente (sobre la mesa o el regazo, más abiertos)
        E = [side * 0.26, 0.8, -0.04];
        W = [side * 0.17, 0.71, -0.32];
      } else {                       // manos en el regazo
        E = [side * 0.225, 0.78, -0.02];
        W = [side * 0.12, 0.71, -0.25];
      }
      limb(uppers, j, S, E);
      limb(lowers, j, E, W);
      paint(uppers, j, shirt);
      paint(lowers, j, d.sleeves ? skin : shirt);
      if (near[i]) {
        const nj = nearPos.get(i) * 2 + k;
        put(hands, nj, W[0], W[1] - 0.005, W[2] - 0.03, identity);
        paint(hands, nj, skin);
      }
    });
  });
  [thighs, shins, shoes, uppers, lowers, hands].forEach((m) => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  [torsos, yokes, necks, heads, hairs, hairBacks].forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });

  // --- Docentes en 3D (modelos 3D ya sentados) -----------------------------------------------------------------
  // Una malla instanciada por modelo y por nivel de detalle (≤ 12 llamadas de dibujo en total). Las butacas a más de NEAR_DIST del
  // atril usan la versión liviana (~800 triángulos, con color por vértice); las cercanas, la versión con textura (~3 000 a 4 400).
  // Se mueven apenas: balanceo y respiración.
  const farMaterial = new T.MeshLambertMaterial({ vertexColors: true });
  mats.push(farMaterial);
  const cameoGroups = []; // { model, far, list, mesh }
  (personas || []).forEach((persona, m) => {
    [false, true].forEach((isFar) => {
      const list = cameos.filter((c) => c.model === m && (Math.hypot(c.seat.x, c.seat.z) > NEAR_DIST) === isFar);
      if (!list.length) return;
      const useFar = isFar && persona.far;
      const material = useFar ? farMaterial : new T.MeshLambertMaterial({ map: persona.map });
      if (!useFar) mats.push(material); // se libera el material; las geometrías y la textura son compartidas y no se liberan
      const mesh = new T.InstancedMesh(useFar ? persona.far : persona.near, material, list.length);
      mesh.count = list.length;
      mesh.name = `persona-${m + 1}${isFar ? '-lejos' : ''}`;
      meshes.push(mesh);
      group.add(mesh);
      cameoGroups.push({ model: m, far: isFar, list, mesh });
    });
  });
  const cameoRand = mulberry32(11);
  cameoGroups.forEach((g) => { g.info = g.list.map((_, j) => ({ hs: 0.97 + cameoRand() * 0.06, phase: (j * 2.399963 + 1.1) % (Math.PI * 2) })); });
  const zAxis = new T.Vector3(0, 0, 1);
  const rollQ = new T.Quaternion();
  const poseCameos = (timeSec, amount) => {
    cameoGroups.forEach(({ list, mesh, info }) => {
      list.forEach((c, j) => {
        const d = info[j];
        const s = c.seat;
        const sway = Math.sin(timeSec * 0.45 + d.phase) * 0.012 * amount;
        const breath = 1 + Math.sin(timeSec * 0.9 + d.phase) * 0.004 * amount;
        quat.setFromAxisAngle(up, s.yaw).multiply(rollQ.setFromAxisAngle(zAxis, sway));
        local.compose(pos.set(s.x, s.y, s.z), quat, scl.set(d.hs, d.hs * breath, d.hs));
        mesh.setMatrixAt(j, local);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  };

  const hairBackOffset = new T.Matrix4().makeTranslation(0, -0.04, 0.07);
  const headLocal = new T.Matrix4();

  /** Pose de las personas. `amount` 0 = quietas (movimiento reducido), 1 = movimiento suave. */
  function pose(timeSec, amount = 1) {
    for (let i = 0; i < n; i += 1) {
      const p = people[i];
      const d = info[i];
      baseOf(p, d.hs);
      const ph = d.phase;
      const bob = Math.sin(timeSec * 0.9 + ph) * 0.007 * amount;
      const sway = Math.sin(timeSec * 0.45 + ph) * 0.014 * amount;
      const turn = Math.sin(timeSec * 0.3 + ph * 1.7) * 0.16 * amount;
      const nod = Math.sin(timeSec * 0.37 + ph * 0.8) * 0.05 * amount;
      const breath = Math.sin(timeSec * 0.9 + ph) * 0.012 * amount;

      eul.set(0, 0, sway);
      quat.setFromEuler(eul);
      put(torsos, i, 0, 0.78 + bob * 0.6, 0.04, quat, d.wide * 1.15, 1 + breath, 0.78);
      put(yokes, i, 0, 1.02 + bob * 0.6, 0.04, quat, d.wide * 1.35 / 1.0, 0.42 + breath * 0.5, 0.85);
      if (near[i]) put(necks, nearPos.get(i), 0, 1.085 + bob, 0.03, identity);

      eul.set(nod, turn, 0);
      quat.setFromEuler(eul);
      const hy = 1.19 + bob * 1.4;
      headLocal.compose(aV.set(0, hy, 0.02), quat, bV.set(0.92, 1.08, 1));
      out.multiplyMatrices(baseM, headLocal);
      heads.setMatrixAt(i, out);
      headLocal.compose(aV.set(0, hy + 0.012, 0.02), quat, bV.set(d.bald ? 0.001 : 0.95, d.bald ? 0.001 : 1.1, d.bald ? 0.001 : 1.02));
      out.multiplyMatrices(baseM, headLocal);
      hairs.setMatrixAt(i, out);
      const li = longIdx.indexOf(i);
      if (li >= 0) {
        headLocal.compose(aV.set(0, hy, 0.02), quat, bV.set(1, d.bald ? 0.001 : 1, 1));
        out.multiplyMatrices(baseM, headLocal).multiply(hairBackOffset);
        hairBacks.setMatrixAt(li, out);
      }
    }
    [torsos, yokes, necks, heads, hairs, hairBacks].forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    poseCameos(timeSec, amount);
  }
  pose(0, 0);

  const disposable = {
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      shadowTex.dispose();
      meshes.forEach((m) => m.dispose());
      // Las geometrías y texturas de los docentes en 3D se comparten entre espacios (se cargan una sola vez), así que no se
      // destruyen: solo se libera su copia en la tarjeta gráfica; si se vuelven a usar, se vuelven a subir solas.
      (personas || []).forEach((persona) => { persona.near.dispose(); persona.far?.dispose(); persona.map.dispose(); });
    },
  };
  kit.track(disposable);

  return {
    pose,
    count: occupied.length,           // todas las personas del público (genéricas + docentes en 3D)
    cameos: cameos.length,            // cuántas son docentes en 3D
    cameoModels: (personas || []).map((_, m) => cameos.filter((c) => c.model === m).length), // cuántas veces aparece cada modelo
    cameosLejos: cameos.filter((c) => Math.hypot(c.seat.x, c.seat.z) > NEAR_DIST).length, // cuántas usan la versión liviana
    group,
    drawCalls: meshes.length,
  };
}

export { COLORS };
