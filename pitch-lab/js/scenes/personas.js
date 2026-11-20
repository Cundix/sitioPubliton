// Personas del equipo en el público.
//
// El público del Pitch Lab son figuras genéricas de piezas simples (ver audience.js). Además, cada persona del público tiene
// un 30 % de probabilidad de ser, en lugar de eso, una de las SEIS personas del equipo: modelos 3D con textura (assets/personas/),
// ya sentados y simplificados con tools/preparar-personas/ para que se dibujen instanciados (una llamada de dibujo por persona).
//
// Honestidad de diseño: son figuras decorativas, igual que el resto del público. Se mueven apenas (balanceo y respiración
// ambientales) y NO reaccionan a lo que se dice ni al puntaje.
//
// Este archivo tiene dos partes: la elección (pura, se prueba con pruebas de unidad) y la carga de los modelos (usa el
// GLTFLoader que trae A-Frame). Si los modelos no cargan —o todavía no terminaron de cargar— el público queda todo con
// figuras genéricas y la experiencia funciona igual.

export const CAMEO_PROBABILITY = 0.3;
export const PERSONA_FILES = ['persona-01.glb', 'persona-02.glb', 'persona-03.glb', 'persona-04.glb', 'persona-05.glb', 'persona-06.glb'];

function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Decide, para cada persona del público, si es una de las personas del equipo y cuál.
 * Cada persona tiene `probability` de serlo. Las elegidas reparten los modelos «de a bolsa»: se mezclan los seis y se van
 * sacando, así ninguno se repite hasta haber salido todos (con ~20 elegidas en el auditorio, cada modelo aparece 3 o 4 veces).
 *
 * @param {number} count          cantidad de personas del público
 * @param {object} [opts]
 * @param {number} [opts.models]       cuántos modelos hay (si es 0, no se elige ninguno)
 * @param {number} [opts.probability]  probabilidad de cada persona (0,3)
 * @param {() => number} [opts.random] origen de azar (Math.random por defecto; se inyecta uno fijo en las pruebas)
 * @returns {number[]} por persona: índice del modelo, o -1 si es una figura genérica
 */
export function pickCameos(count, { models = PERSONA_FILES.length, probability = CAMEO_PROBABILITY, random = Math.random } = {}) {
  const out = new Array(Math.max(0, count)).fill(-1);
  if (models <= 0) return out;
  let bag = [];
  for (let i = 0; i < out.length; i += 1) {
    if (random() >= probability) continue;
    if (bag.length === 0) bag = shuffle([...Array(models).keys()], random);
    out[i] = bag.pop();
  }
  return out;
}

let randomSource = Math.random;

/** Para las pruebas y las capturas: fija el origen de azar con el que se elige quién es una persona del equipo. */
export function setPersonasRandom(random) {
  randomSource = typeof random === 'function' ? random : Math.random;
}

export function personasRandom() {
  return randomSource;
}

// ---- Carga ---------------------------------------------------------------------------------------------------------

let loading = null;
let loaded = null;

/**
 * Carga los modelos una sola vez (se llama al iniciar la página, sin esperar). Devuelve la lista de
 * `{ near, map, far }` —geometría cercana con su textura y geometría lejana con color por vértice; solo los modelos que
 * cargaron bien— o una lista vacía si no cargó ninguno.
 */
export function loadPersonas({ THREE = globalThis.AFRAME?.THREE, base = new URL('../../assets/personas/', import.meta.url) } = {}) {
  if (loading) return loading;
  const Loader = THREE?.GLTFLoader;
  if (!Loader) {
    loaded = [];
    loading = Promise.resolve(loaded);
    return loading;
  }
  const loader = new Loader();
  const one = (file) => new Promise((resolve) => {
    loader.load(
      new URL(file, base).href,
      (gltf) => {
        // Cada archivo trae dos versiones de la misma persona: «cerca» (con textura) y «lejos» (más liviana, con color por vértice)
        const near = gltf.scene.getObjectByName('cerca');
        const far = gltf.scene.getObjectByName('lejos');
        if (!near?.isMesh || !near.material?.map) { resolve(null); return; }
        near.geometry.computeBoundingSphere();
        const farGeometry = far?.isMesh && far.geometry.attributes.color ? far.geometry : null;
        farGeometry?.computeBoundingSphere();
        resolve({ near: near.geometry, map: near.material.map, far: farGeometry });
      },
      undefined,
      (error) => {
        console.info(`[pitch-lab] no se pudo cargar ${file}; esa persona no aparece en el público.`, error?.message || '');
        resolve(null);
      },
    );
  });
  loading = Promise.all(PERSONA_FILES.map(one)).then((list) => {
    loaded = list.filter(Boolean);
    return loaded;
  });
  return loading;
}

/** Modelos ya cargados, o `null` si todavía no terminaron (el público se arma entonces solo con figuras genéricas). */
export function getLoadedPersonas() {
  return loaded && loaded.length ? loaded : null;
}

/** Para las pruebas: espera a que terminen de cargar. */
export function whenPersonasReady() {
  return loading || loadPersonas();
}
