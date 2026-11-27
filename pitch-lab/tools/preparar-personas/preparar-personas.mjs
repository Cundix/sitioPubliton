// Herramienta de UNA SOLA VEZ (no forma parte de la página): convierte los modelos 3D de docentes del colegio (hechos por la persona usuaria para otro proyecto)
// (carpeta por persona con un .fbx y su textura .png, personajes con esqueleto Mixamo) en figuras SENTADAS y livianas
// que el público del Pitch Lab puede dibujar muchas veces con pocas llamadas de dibujo.
//
// Qué hace con cada modelo:
//   1. FBX → glTF (assimpjs).
//   2. Sienta el cuerpo con el esqueleto: muslos hacia adelante, piernas hacia abajo, antebrazos hacia el regazo.
//      La pose se calcula en el espacio del mundo, así que no depende de cómo estén orientados los huesos de cada modelo.
//   3. "Hornea" la pose: guarda las posiciones ya deformadas y descarta el esqueleto (queda una malla fija).
//   4. Escala a una altura humana (1,70 m de pie), apoya los pies en el piso, de frente a -Z y con la cadera sobre el eje del
//      asiento. Los modelos tienen piernas cortas (personaje estilizado): se alarga la pantorrilla lo justo para que la base de la
//      cadera quede a la altura de las butacas de audience.js (0,495 m).
//   5. Suelda vértices, calcula normales suaves y arma DOS versiones de la malla en el mismo archivo:
//        «cerca»: con la textura, ~3 000 triángulos (hasta ~4 400 en los modelos con muchas costuras de textura);
//        «lejos»: sin textura, con color por vértice tomado de la textura, ~800 triángulos (butacas a más de ~11 m).
//   6. Reduce la textura (JPEG) y escribe un .glb por persona, con nombres neutros: persona-01.glb, persona-02.glb…
//      (no se copian al repositorio los nombres de las carpetas de origen).
//
// Uso:   cd tools/preparar-personas && npm install
//        node preparar-personas.mjs <carpeta con una subcarpeta por persona> <carpeta de salida>
// Opciones por variable de entorno: TRIS (triángulos de la versión cercana, 3000), TRIS_LEJOS (la lejana, 800), TEX (lado de la
// textura, 1024), ALTURA (altura de pie equivalente, 1,7 m) y DIAGNOSTICO=1 (muestra las partes sueltas y los bordes de cada malla).

import fs from 'node:fs';
import path from 'node:path';
import assimpjs from 'assimpjs';
import sharp from 'sharp';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptSimplifier } from 'meshoptimizer';

const [srcDir, outDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!srcDir || !outDir) {
  console.error('Uso: node preparar-personas.mjs <carpeta de origen> <carpeta de salida>');
  process.exit(1);
}

const TRIS_NEAR = Number(process.env.TRIS) || 3000;
const TRIS_FAR = Number(process.env.TRIS_LEJOS) || 800;
const TEX_SIZE = Number(process.env.TEX) || 1024;
const SEAT_TOP = 0.495;   // altura de la butaca (audience.js: asiento a 0,46 + 0,035)
const HIP_Z = 0.02;       // la cadera queda apenas detrás del centro del asiento (el respaldo está en +Z)
const STAND_HEIGHT = Number(process.env.ALTURA) || 1.7; // altura de pie equivalente (m); en el público se varía un poco entre personas
const MAX_SHIN_EXTRA = 0.16; // tope del alargamiento de la pantorrilla (m)
const ANKLE_Y = 0.1;      // por debajo de esta altura (pie y tobillo) no se estira nada
const COLOR_TEX = 128;    // lado de la textura reducida de la que se toman los colores de la versión lejana

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---- Lectura -----------------------------------------------------------------------------------------------------

const ajs = await assimpjs();

function fbxToGlb(file) {
  const list = new ajs.FileList();
  list.AddFile(path.basename(file), fs.readFileSync(file));
  const res = ajs.ConvertFileList(list, 'glb2');
  if (!res.IsSuccess() || res.FileCount() === 0) throw new Error(`No se pudo leer ${path.basename(file)}: ${res.GetErrorCode()}`);
  const bytes = res.GetFile(0).GetContent();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function parseGlb(arrayBuffer) {
  return new Promise((resolve, reject) => new GLTFLoader().parse(arrayBuffer, '', resolve, reject));
}

/** Huesos por nombre sin prefijo (`mixamorig:LeftArm` → `LeftArm`; three quita los dos puntos al cargar). */
function bonesByName(root) {
  const map = new Map();
  root.traverse((o) => {
    if (!o.isBone) return;
    map.set(o.name.replace(/^mixamorig:?/, ''), o);
  });
  return map;
}

// ---- Pose sentada ------------------------------------------------------------------------------------------------

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _bq = new THREE.Quaternion();
const _pq = new THREE.Quaternion();

/** Gira `bone` (en el espacio del mundo) para que la línea hueso → hijo apunte hacia `dir`. */
function aim(bone, child, dir) {
  bone.updateWorldMatrix(true, true);
  bone.getWorldPosition(_a);
  child.getWorldPosition(_b);
  _b.sub(_a).normalize();
  _q.setFromUnitVectors(_b, dir.clone().normalize());
  bone.getWorldQuaternion(_bq);
  (bone.parent || bone).getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_bq)));
  bone.updateMatrixWorld(true);
}

function seat(bones, forward) {
  const need = (n) => {
    const b = bones.get(n);
    if (!b) throw new Error(`Falta el hueso ${n}`);
    return b;
  };
  const hips = need('Hips');
  hips.updateWorldMatrix(true, true);
  const hipPos = hips.getWorldPosition(v3(0, 0, 0));
  for (const side of ['Left', 'Right']) {
    const upLeg = need(`${side}UpLeg`);
    const out = Math.sign(upLeg.getWorldPosition(v3(0, 0, 0)).x - hipPos.x) || (side === 'Left' ? 1 : -1);
    const O = v3(out, 0, 0);
    const F = forward.clone();
    const U = v3(0, 1, 0);
    // Piernas: muslo hacia adelante (rodillas apenas abiertas), pierna hacia abajo, pie hacia adelante
    aim(upLeg, need(`${side}Leg`), O.clone().multiplyScalar(0.13).add(F).add(U.clone().multiplyScalar(-0.02)));
    aim(need(`${side}Leg`), need(`${side}Foot`), O.clone().multiplyScalar(0.04).add(U.clone().multiplyScalar(-1)).add(F.clone().multiplyScalar(0.06)));
    aim(need(`${side}Foot`), need(`${side}ToeBase`), F.clone().add(U.clone().multiplyScalar(-0.12)));
    // Brazos: brazo casi vertical, antebrazo hacia el regazo y levemente hacia adentro (manos en el regazo)
    aim(need(`${side}Arm`), need(`${side}ForeArm`), O.clone().multiplyScalar(0.1).add(U.clone().multiplyScalar(-1)).add(F.clone().multiplyScalar(0.12)));
    aim(need(`${side}ForeArm`), need(`${side}Hand`), O.clone().multiplyScalar(-0.4).add(U.clone().multiplyScalar(-0.3)).add(F.clone().multiplyScalar(0.87)));
  }
}

// ---- Malla -------------------------------------------------------------------------------------------------------

/** Posiciones del cuerpo ya deformadas por el esqueleto, en el espacio del mundo. */
function bakePositions(mesh) {
  const geo = mesh.geometry;
  const n = geo.attributes.position.count;
  const out = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  mesh.updateWorldMatrix(true, true);
  for (let i = 0; i < n; i += 1) {
    mesh.getVertexPosition(i, v);
    v.applyMatrix4(mesh.matrixWorld);
    out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
  }
  return out;
}

/** Une los vértices repetidos (misma posición y mismas coordenadas de textura). Devuelve malla indexada. */
function weld(positions, uvs, srcIndex) {
  const key = (i) => {
    const q = (x) => Math.round(x * 1e5);
    return `${q(positions[i * 3])},${q(positions[i * 3 + 1])},${q(positions[i * 3 + 2])},${q(uvs[i * 2])},${q(uvs[i * 2 + 1])}`;
  };
  const map = new Map();
  const remap = new Uint32Array(positions.length / 3);
  const pos = [];
  const uv = [];
  for (let i = 0; i < remap.length; i += 1) {
    const k = key(i);
    let j = map.get(k);
    if (j === undefined) {
      j = pos.length / 3;
      map.set(k, j);
      pos.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      uv.push(uvs[i * 2], uvs[i * 2 + 1]);
    }
    remap[i] = j;
  }
  const idx = new Uint32Array(srcIndex ? srcIndex.length : remap.length);
  for (let i = 0; i < idx.length; i += 1) idx[i] = remap[srcIndex ? srcIndex[i] : i];
  // descartar triángulos degenerados
  const keep = [];
  for (let i = 0; i < idx.length; i += 3) {
    if (idx[i] !== idx[i + 1] && idx[i + 1] !== idx[i + 2] && idx[i] !== idx[i + 2]) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  return { pos: Float32Array.from(pos), uv: Float32Array.from(uv), idx: Uint32Array.from(keep) };
}

/** Normales suaves: se promedian entre todos los vértices que comparten posición (también a través de las costuras de la textura). */
function smoothNormals(pos, idx) {
  const n = pos.length / 3;
  const q = (x) => Math.round(x * 1e5);
  const byPos = new Map();
  const group = new Uint32Array(n);
  for (let i = 0; i < n; i += 1) {
    const k = `${q(pos[i * 3])},${q(pos[i * 3 + 1])},${q(pos[i * 3 + 2])}`;
    let g = byPos.get(k);
    if (g === undefined) { g = byPos.size; byPos.set(k, g); }
    group[i] = g;
  }
  const acc = new Float32Array(byPos.size * 3);
  const a = v3(0, 0, 0); const b = v3(0, 0, 0); const c = v3(0, 0, 0); const f = v3(0, 0, 0);
  for (let t = 0; t < idx.length; t += 3) {
    a.fromArray(pos, idx[t] * 3); b.fromArray(pos, idx[t + 1] * 3); c.fromArray(pos, idx[t + 2] * 3);
    f.subVectors(c, b).cross(a.clone().sub(b)); // ponderada por el área (el largo del producto vectorial)
    for (let k = 0; k < 3; k += 1) {
      const g = group[idx[t + k]] * 3;
      acc[g] += f.x; acc[g + 1] += f.y; acc[g + 2] += f.z;
    }
  }
  const nor = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    const g = group[i] * 3;
    f.set(acc[g], acc[g + 1], acc[g + 2]).normalize();
    nor[i * 3] = f.x; nor[i * 3 + 1] = f.y; nor[i * 3 + 2] = f.z;
  }
  return nor;
}

/** Diagnóstico (DIAGNOSTICO=1): partes sueltas y aristas de borde de la malla. */
function diagnose(mesh) {
  const q = (x) => Math.round(x * 1e5);
  const posId = new Map();
  const id = new Uint32Array(mesh.pos.length / 3);
  for (let i = 0; i < id.length; i += 1) {
    const k = `${q(mesh.pos[i * 3])},${q(mesh.pos[i * 3 + 1])},${q(mesh.pos[i * 3 + 2])}`;
    if (!posId.has(k)) posId.set(k, posId.size);
    id[i] = posId.get(k);
  }
  const parent = Array.from({ length: posId.size }, (_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const edges = new Map();
  for (let t = 0; t < mesh.idx.length; t += 3) {
    for (let k = 0; k < 3; k += 1) {
      const a = id[mesh.idx[t + k]]; const b = id[mesh.idx[t + ((k + 1) % 3)]];
      parent[find(a)] = find(b);
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  const comps = new Map();
  for (let t = 0; t < mesh.idx.length; t += 3) { const r = find(id[mesh.idx[t]]); comps.set(r, (comps.get(r) || 0) + 1); }
  const sizes = [...comps.values()].sort((a, b) => b - a);
  let border = 0;
  edges.forEach((c) => { if (c === 1) border += 1; });
  return { partesSueltas: sizes.length, mayores: sizes.slice(0, 6), aristasDeBorde: border };
}

/** Reordena los vértices que quedan después de simplificar (con `extra`: otros datos por vértice y su tamaño). */
function compact(simp, mesh, extra = {}) {
  const [remap, unique] = MeshoptSimplifier.compactMesh(simp);
  const out = { pos: new Float32Array(unique * 3), nor: new Float32Array(unique * 3), idx: simp };
  for (const [name, size] of Object.entries(extra)) out[name] = new Float32Array(unique * size);
  for (let i = 0; i < remap.length; i += 1) {
    const j = remap[i];
    if (j === 0xffffffff || j >= unique) continue;
    out.pos.set(mesh.pos.subarray(i * 3, i * 3 + 3), j * 3);
    out.nor.set(mesh.nor.subarray(i * 3, i * 3 + 3), j * 3);
    for (const [name, size] of Object.entries(extra)) out[name].set(mesh[name].subarray(i * size, i * size + size), j * size);
  }
  return out;
}

/**
 * Versión CERCANA: conserva la textura. Se simplifica cuidando las normales y las coordenadas de textura. Los vértices de una
 * costura de textura no se pueden fundir con los del otro lado, así que los modelos con muchas costuras no bajan de ~4 000
 * triángulos: se usa lo que se logre, hasta `targetTris`.
 */
function simplifyTextured(mesh, targetTris, maxError = 0.2) {
  MeshoptSimplifier.useExperimentalFeatures = true;
  const n = mesh.pos.length / 3;
  const attrs = new Float32Array(n * 5);
  for (let i = 0; i < n; i += 1) attrs.set([mesh.nor[i * 3], mesh.nor[i * 3 + 1], mesh.nor[i * 3 + 2], mesh.uv[i * 2], mesh.uv[i * 2 + 1]], i * 5);
  const [simp, error] = MeshoptSimplifier.simplifyWithAttributes(mesh.idx.slice(), mesh.pos, 3, attrs, 5, [0.4, 0.4, 0.4, 2, 2], null, targetTris * 3, maxError, []);
  return { ...compact(simp, mesh, { uv: 2 }), error };
}

/**
 * Versión LEJANA (butacas a más de ~11 m): sin textura, con COLOR por vértice tomado de la textura. Se simplifica una malla soldada
 * solo por posición (así no hay costuras que lo impidan) y cada vértice que queda toma el color promedio de la textura en los
 * lugares donde estaba. A esa distancia no se distingue de la versión con textura y pesa ~800 triángulos.
 */
function simplifyColored(mesh, targetTris, sampleColor) {
  MeshoptSimplifier.useExperimentalFeatures = true;
  const q = (x) => Math.round(x * 1e5);
  const nVert = mesh.pos.length / 3;
  const byPos = new Map();
  const pid = new Uint32Array(nVert);
  const P = []; const N = []; const C = [];
  for (let i = 0; i < nVert; i += 1) {
    const k = `${q(mesh.pos[i * 3])},${q(mesh.pos[i * 3 + 1])},${q(mesh.pos[i * 3 + 2])}`;
    let j = byPos.get(k);
    if (j === undefined) {
      j = P.length / 3; byPos.set(k, j);
      P.push(mesh.pos[i * 3], mesh.pos[i * 3 + 1], mesh.pos[i * 3 + 2]);
      N.push(mesh.nor[i * 3], mesh.nor[i * 3 + 1], mesh.nor[i * 3 + 2]);
      C.push(0, 0, 0, 0);
    }
    pid[i] = j;
    const c = sampleColor(mesh.uv[i * 2], mesh.uv[i * 2 + 1]);
    C[j * 4] += c[0]; C[j * 4 + 1] += c[1]; C[j * 4 + 2] += c[2]; C[j * 4 + 3] += 1;
  }
  const count = P.length / 3;
  const col = new Float32Array(count * 3);
  for (let j = 0; j < count; j += 1) for (let c = 0; c < 3; c += 1) col[j * 3 + c] = C[j * 4 + c] / C[j * 4 + 3];
  const welded = { pos: Float32Array.from(P), nor: Float32Array.from(N), col };
  const idxP = Uint32Array.from(mesh.idx, (v) => pid[v]);
  const [simp, error] = MeshoptSimplifier.simplifyWithAttributes(idxP.slice(), welded.pos, 3, welded.nor, 3, [0.5, 0.5, 0.5], null, targetTris * 3, 1, []);
  return { ...compact(simp, welded, { col: 3 }), error };
}

// ---- Escritura de GLB ----------------------------------------------------------------------------------------------

function writeGlb(lods, jpeg, extras) {
  const chunks = [];
  const views = [];
  const accessors = [];
  let offset = 0;
  const add = (typed, target) => {
    const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    const pad = (4 - (buf.length % 4)) % 4;
    views.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, ...(target ? { target } : {}) });
    chunks.push(buf, Buffer.alloc(pad));
    offset += buf.length + pad;
    return views.length - 1;
  };
  const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3 };
  const accessor = (typed, componentType, type, target, extra = {}) => {
    accessors.push({ bufferView: add(typed, target), componentType, count: typed.length / SIZE[type], type, ...extra });
    return accessors.length - 1;
  };
  const meshes = lods.map(({ pos, nor, uv, col, idx, material }) => {
    const useU16 = pos.length / 3 < 65536;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k += 1) { min[k] = Math.min(min[k], pos[i + k]); max[k] = Math.max(max[k], pos[i + k]); }
    const attributes = { POSITION: accessor(pos, 5126, 'VEC3', 34962, { min, max }), NORMAL: accessor(nor, 5126, 'VEC3', 34962) };
    if (uv) attributes.TEXCOORD_0 = accessor(uv, 5126, 'VEC2', 34962);
    if (col) attributes.COLOR_0 = accessor(col, 5126, 'VEC3', 34962);
    const indices = accessor(useU16 ? Uint16Array.from(idx) : idx, useU16 ? 5123 : 5125, 'SCALAR', 34963);
    return { primitives: [{ attributes, indices, material }] };
  });
  const vImg = add(new Uint8Array(jpeg), null);
  const json = {
    asset: { version: '2.0', generator: 'preparar-personas.mjs (Publitón Pitch Lab)' },
    scene: 0,
    scenes: [{ nodes: lods.map((_, i) => i) }],
    // Nodo «cerca»: malla con textura. Nodo «lejos»: malla liviana con color por vértice (sin textura).
    nodes: lods.map((l, i) => ({ mesh: i, name: l.name })),
    meshes,
    materials: [
      { pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } },
      { pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } },
    ],
    textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    images: [{ bufferView: vImg, mimeType: 'image/jpeg' }],
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: offset }],
    extras,
  };
  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
  const bin = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii'); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonBuf.length, 0); jh.write('JSON', 4, 'ascii');
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.write(`BIN${String.fromCharCode(0)}`, 4, 'ascii');
  return Buffer.concat([header, jh, jsonBuf, bh, bin]);
}

// ---- Por persona ---------------------------------------------------------------------------------------------------

async function convert(folder, number) {
  const fbx = fs.readdirSync(folder).find((f) => /\.fbx$/i.test(f));
  const png = fs.readdirSync(folder).find((f) => /\.png$/i.test(f));
  if (!fbx || !png) throw new Error(`En ${path.basename(folder)} falta el .fbx o el .png`);
  const gltf = await parseGlb(fbxToGlb(path.join(folder, fbx)));
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  let mesh = null;
  root.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
  if (!mesh) throw new Error('No hay malla con esqueleto');
  const bones = bonesByName(root);

  // Altura de pie y hacia dónde mira (los dedos de los pies apuntan al frente)
  const rest = bakePositions(mesh);
  let minY = Infinity; let maxY = -Infinity;
  for (let i = 1; i < rest.length; i += 3) { minY = Math.min(minY, rest[i]); maxY = Math.max(maxY, rest[i]); }
  const heightStanding = maxY - minY;
  const foot = bones.get('LeftFoot').getWorldPosition(v3(0, 0, 0));
  const toe = bones.get('LeftToeBase').getWorldPosition(v3(0, 0, 0));
  const frontSign = toe.z - foot.z >= 0 ? 1 : -1;
  const forward = v3(0, 0, frontSign);

  seat(bones, forward);
  const posed = bakePositions(mesh);
  const hipsPos = bones.get('Hips').getWorldPosition(v3(0, 0, 0));

  // Girar para mirar a -Z (multiplicar x y z por -1 equivale a girar 180° en Y) y apoyar la suela en el piso
  const flip = frontSign > 0 ? -1 : 1;
  for (let i = 0; i < posed.length; i += 3) { posed[i] *= flip; posed[i + 2] *= flip; }
  const hip = { x: hipsPos.x * flip, y: hipsPos.y, z: hipsPos.z * flip };
  let floor = Infinity;
  for (let i = 1; i < posed.length; i += 3) floor = Math.min(floor, posed[i]);
  // base de la cadera: lo más bajo del cuerpo en torno a la cadera (la zona que se apoya en el asiento)
  let seatBottom = Infinity;
  for (let i = 0; i < posed.length; i += 3) {
    const nearHipZ = Math.abs(posed[i + 2] - hip.z) < heightStanding * 0.075;
    const aboveKnees = posed[i + 1] > hip.y - heightStanding * 0.14;
    if (nearHipZ && aboveKnees) seatBottom = Math.min(seatBottom, posed[i + 1]);
  }

  // Tamaño: una altura humana de pie (los modelos vienen en otra unidad y con piernas cortas, de personaje estilizado)
  const scale = STAND_HEIGHT / heightStanding;
  for (let i = 0; i < posed.length; i += 3) {
    posed[i] = (posed[i] - hip.x) * scale;
    posed[i + 1] = (posed[i + 1] - floor) * scale;
    posed[i + 2] = (posed[i + 2] - hip.z) * scale + HIP_Z;
  }
  // Con esa altura la cadera queda más baja que el asiento: se alarga la pantorrilla (la franja entre el tobillo y la parte baja
  // del muslo) lo justo para que la base de la cadera quede sobre el asiento y los pies sigan apoyados en el piso.
  const seatBottomScaled = (seatBottom - floor) * scale;
  const extra = Math.min(MAX_SHIN_EXTRA, Math.max(0, SEAT_TOP - seatBottomScaled));
  if (extra > 0) {
    for (let i = 1; i < posed.length; i += 3) {
      const y = posed[i];
      if (y >= seatBottomScaled) posed[i] = y + extra;
      else if (y > ANKLE_Y) posed[i] = ANKLE_Y + (y - ANKLE_Y) * (1 + extra / (seatBottomScaled - ANKLE_Y));
    }
  }

  // Malla fija, soldada, con normales suaves; dos versiones (cerca y lejos)
  const geo = mesh.geometry;
  const welded = weld(posed, geo.attributes.uv.array, geo.index ? geo.index.array : null);
  welded.nor = smoothNormals(welded.pos, welded.idx);
  const trisIn = welded.idx.length / 3;
  if (process.env.DIAGNOSTICO) console.log(`  diagnóstico ${number}:`, JSON.stringify(diagnose(welded)));
  const near = simplifyTextured(welded, TRIS_NEAR);

  // Color de la versión lejana: se lee de la textura reducida (cada punto ya es el promedio de un bloque de píxeles)
  const small = await sharp(path.join(folder, png)).resize(COLOR_TEX, COLOR_TEX, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const toLinear = (c) => (c / 255) ** 2.2; // la textura está en sRGB y el color por vértice de glTF es lineal
  const sampleColor = (u, v) => {
    const x = Math.min(COLOR_TEX - 1, Math.max(0, Math.round(u * (COLOR_TEX - 1))));
    const y = Math.min(COLOR_TEX - 1, Math.max(0, Math.round(v * (COLOR_TEX - 1))));
    const o = (y * COLOR_TEX + x) * small.info.channels;
    return [toLinear(small.data[o]), toLinear(small.data[o + 1]), toLinear(small.data[o + 2])];
  };
  const far = simplifyColored(welded, TRIS_FAR, sampleColor);

  const jpeg = await sharp(path.join(folder, png)).resize(TEX_SIZE, TEX_SIZE, { fit: 'fill' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  let top = -Infinity;
  for (let i = 1; i < near.pos.length; i += 3) top = Math.max(top, near.pos[i]);
  const info = {
    triangulosCerca: near.idx.length / 3, triangulosLejos: far.idx.length / 3, triangulosOriginales: trisIn,
    verticesCerca: near.pos.length / 3, verticesLejos: far.pos.length / 3,
    alturaSentada: Number(top.toFixed(3)), alturaDePieEquivalente: Number((heightStanding * scale).toFixed(2)), escala: Number(scale.toFixed(3)),
    baseDeCaderaAntes: Number(seatBottomScaled.toFixed(3)), pantorrillaMasLarga: Number(extra.toFixed(3)),
    errorRelativoCerca: Number(near.error.toFixed(4)), errorRelativoLejos: Number(far.error.toFixed(4)), texturaKB: Math.round(jpeg.length / 1024),
  };
  const file = path.join(outDir, `persona-${String(number).padStart(2, '0')}.glb`);
  fs.writeFileSync(file, writeGlb([{ name: 'cerca', material: 0, ...near }, { name: 'lejos', material: 1, ...far }], jpeg, info));
  return { file, info, bytes: fs.statSync(file).size };
}

await MeshoptSimplifier.ready;
fs.mkdirSync(outDir, { recursive: true });
const folders = fs.readdirSync(srcDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(srcDir, d.name)).sort();
let n = 0;
for (const folder of folders) {
  n += 1;
  const r = await convert(folder, n); // eslint-disable-line no-await-in-loop
  console.log(path.basename(r.file), `${Math.round(r.bytes / 1024)} KB`, JSON.stringify(r.info));
}
console.log(`Listo: ${n} personas en ${outDir}`);
