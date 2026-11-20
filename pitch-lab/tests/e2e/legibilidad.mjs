// Auditoría de legibilidad del texto dentro del espacio 3D (donde NO hay panel HTML de ayuda).
//
// Mide, con la geometría real de la escena, cuántos grados ocupa la altura de las letras mayúsculas de
// CADA texto dibujado en las superficies de interfaz (atril, panel, reloj, brief y botones), vistas desde
// el punto de inicio de la persona. Se mide en el navegador de pruebas con la escena real: no se copian
// constantes, así que si cambia un tamaño o una distancia el resultado cambia.
//
// Umbrales (criterio del proyecto, con respaldo en la bibliografía de lectura en VR):
//   - mínimo duro 0,8°: Solum (2019) propone 14–16 dmm (0,8–0,92°) como tamaño mínimo (resumido en
//     Kilpeläinen y Häkkinen, 2023, Frontiers in Virtual Reality, doi 10.3389/frvir.2023.1243387).
//   - cómodo 1,2°: el mismo resumen cita 21–23 dmm (1,2–1,3°) para lectura cómoda (otros autores piden
//     más: 1,375° y 1,8°). El texto principal (títulos, párrafos, botones principales) debe llegar a esto.
//   - la altura que se mide es la de las mayúsculas, aproximada como 0,7 del tamaño de fuente (Barlow).
//   - se corrige por el ángulo de visión (una superficie inclinada se ve más baja).
// Es una medición en pantalla de computadora con la geometría del casco; NO reemplaza mirar el texto con
// un casco físico, cuya resolución real es otra variable.
//
// Uso: node tests/e2e/legibilidad.mjs   (servidor en PITCHLAB_URL, por defecto http://localhost:8080/pitch-lab/)

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openPage, waitReady } from '../../tools/browser.mjs';
import { wait, dispatch, state, words } from './helpers.mjs';
import { MOCK_SPEECH_OK } from './mocks.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const MIN_DEG = 0.8;
export const COMFORT_DEG = 1.2;

// Se registra cada texto dibujado, con su lienzo y posición, y se descarta lo viejo cuando el lienzo se repinta.
function installSpy() {
  const proto = CanvasRenderingContext2D.prototype;
  const fill = proto.fillText;
  const clear = proto.clearRect;
  window.__txtLog = [];
  proto.fillText = function spyFillText(text, x, y, ...rest) {
    try {
      const m = /(\d+(?:\.\d+)?)px/.exec(this.font);
      window.__txtLog.push({ canvas: this.canvas, text: String(text), size: m ? parseFloat(m[1]) : 0, x, y });
    } catch { /* no interfiere con el dibujo */ }
    return fill.call(this, text, x, y, ...rest);
  };
  proto.clearRect = function spyClearRect(...args) {
    if (args[2] >= this.canvas.width - 1 && args[3] >= this.canvas.height - 1) {
      window.__txtLog = window.__txtLog.filter((e) => e.canvas !== this.canvas);
    }
    return clear.apply(this, args);
  };
}

function measure() {
  const app = window.pitchLab;
  const T = AFRAME.THREE;
  const ui = app.stage?.ui;
  if (!ui) return [];
  const surfaces = new Map();
  const add = (s, kind) => { if (s) surfaces.set(s.canvas, { s, kind }); };
  add(ui.faceSurface, 'atril');
  add(ui.panelSurface, 'panel');
  add(ui.clockSurface, 'reloj');
  add(ui.briefSurface, 'brief (pared)');
  add(ui.compactSurface, 'brief (recordatorio)');
  for (const b of ui.lecternPool.buttons.values()) add(b.surface, 'botón del atril');
  if (ui.panelPool) for (const b of ui.panelPool.buttons.values()) add(b.surface, 'botón del panel');

  const cam = app.scene.camera;
  cam.updateWorldMatrix(true, false);
  const eye = new T.Vector3().setFromMatrixPosition(cam.matrixWorld);
  const visible = (o) => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; };
  const out = [];
  for (const e of window.__txtLog) {
    const info = surfaces.get(e.canvas);
    if (!info || !e.text.trim() || !e.size) continue;
    const { s, kind } = info;
    if (!visible(s.mesh)) continue;
    s.mesh.updateWorldMatrix(true, false);
    const pos = new T.Vector3(); const quat = new T.Quaternion(); const sc = new T.Vector3();
    s.mesh.matrixWorld.decompose(pos, quat, sc);
    const mPerPx = (s.widthM * sc.x) / s.canvas.width;
    const point = new T.Vector3(
      (e.x - s.canvas.width / 2) * (s.widthM / s.canvas.width),
      (s.canvas.height / 2 - e.y) * (s.heightM / s.canvas.height),
      0,
    ).applyMatrix4(s.mesh.matrixWorld);
    // La altura aparente de una letra depende de cuánto de su "arriba" queda de frente a la mirada.
    const up = new T.Vector3(0, 1, 0).applyQuaternion(quat);
    const view = eye.clone().sub(point);
    const dist = view.length();
    const along = up.dot(view.normalize());
    const cos = Math.sqrt(Math.max(0, 1 - along * along));
    const capM = 0.7 * e.size * mPerPx;
    const deg = (Math.atan((capM * cos) / dist) * 180) / Math.PI;
    out.push({ kind, text: e.text, size: e.size, dist: +dist.toFixed(2), cos: +cos.toFixed(2), deg: +deg.toFixed(2) });
  }
  return out;
}

// Resultado de IA de ejemplo con textos del largo que devuelve el modelo (para medir las pantallas «IA»).
const AI_RESULT = {
  model: 'gemini-de-prueba',
  attempts: [],
  analysis: {
    audible: true,
    transcript: 'Hola, el problema es que nadie conoce la marca. Mi idea es una campaña en el barrio con carteles en las plazas.',
    summary: 'Presenta el problema con claridad y propone una idea concreta basada en carteles en las plazas del barrio; el beneficio queda sin desarrollar y falta un cierre con propuesta.',
    rubric: {
      problem: { level: 'yes', quote: 'nadie conoce la marca', note: 'Se entiende el problema y para quién es.' },
      idea: { level: 'yes', quote: 'una campaña en el barrio', note: 'La idea es concreta y se puede imaginar.' },
      benefit: { level: 'partial', quote: '', note: 'El beneficio aparece mencionado sin desarrollar.' },
      close: { level: 'no', quote: '', note: 'No hay una propuesta de siguiente paso.' },
    },
    briefFit: { restriction: 'partial', note: 'La restricción se respeta a medias: se menciona el medio prohibido una vez.' },
    delivery: {
      pace: { observation: 'Se percibe un ritmo pausado, con tramos más rápidos al explicar la idea central.' },
      clarity: { observation: 'Se entiende bien casi todo; algunas palabras se pierden al final de las frases.' },
      energy: { observation: 'La entonación varía poco y el volumen es parejo durante toda la presentación.' },
      pauses: { observation: 'Hay pausas cortas entre ideas y una pausa larga antes del cierre.' },
      fillers: { observation: 'Aparece un «eh» al inicio y dos «o sea» a lo largo del discurso.' },
    },
    strengths: ['Problema claro', 'Idea concreta'],
    improvements: [{ advice: 'Cerrá con una propuesta concreta: qué querés que haga la marca mañana mismo.', why: 'El cierre no aparece.' }, { advice: 'Desarrollá el beneficio con un ejemplo cotidiano.', why: 'Se menciona sin explicar.' }],
    limitations: ['Solo se evaluó el audio.'],
  },
};

const rows = [];
async function snap(page, label) {
  await wait(380);
  const items = await page.evaluate(measure);
  rows.push({ label, items });
}

const browser = await launch();
const { page, problems, context } = await openPage(browser, { init: `(${installSpy.toString()})();
${MOCK_SPEECH_OK}`, permissions: ['microphone'] });
await waitReady(page);

// --- Inicio, tutorial, ajustes y selección (vestíbulo) ---
await snap(page, 'vestíbulo · inicio');
await dispatch(page, 'START');
await snap(page, 'vestíbulo · tutorial 1');
await dispatch(page, 'NEXT'); await snap(page, 'vestíbulo · tutorial 2');
await dispatch(page, 'NEXT'); await snap(page, 'vestíbulo · tutorial 3');
await dispatch(page, 'SKIP');
await snap(page, 'vestíbulo · elegir escenario');
await dispatch(page, 'OPEN_SETTINGS'); await snap(page, 'vestíbulo · ajustes'); await dispatch(page, 'CLOSE');

const SCENARIOS_TO_CHECK = (process.env.LEGIBILIDAD_SCENARIOS || 'sala,cliente,auditorio').split(',');
for (const id of SCENARIOS_TO_CHECK) {
  await dispatch(page, 'PICK_SCENARIO', { id });
  await dispatch(page, 'ENTER');
  await wait(500);
  await snap(page, `${id} · brief`);
  await dispatch(page, 'PREPARE'); await dispatch(page, 'SET_INPUT_MODE', { mode: 'timer' });
  await snap(page, `${id} · preparación`);
  await dispatch(page, 'OPEN_AI'); await snap(page, `${id} · IA y cámara`); await dispatch(page, 'CLOSE');
  await dispatch(page, 'BEGIN');
  await page.waitForFunction(() => window.pitchLab.session.state === 'presenting', null, { timeout: 8000 });
  await snap(page, `${id} · presentando`);
  await dispatch(page, 'PAUSE'); await snap(page, `${id} · pausa`);
  await dispatch(page, 'REQUEST_CANCEL'); await snap(page, `${id} · confirmar cancelación`);
  await dispatch(page, 'KEEP'); await dispatch(page, 'RESUME'); await wait(900);
  await dispatch(page, 'FINISH');
  await page.waitForFunction(() => ['feedback', 'review'].includes(window.pitchLab.session.state), null, { timeout: 8000 });
  if ((await state(page)) === 'review') { await dispatch(page, 'LOAD_DEMO'); await snap(page, `${id} · revisión`); await dispatch(page, 'CONTINUE'); }
  for (const p of [0, 1, 2]) { await dispatch(page, 'SET_PAGE', { page: p }); await snap(page, `${id} · devolución ${p + 1}`); }
  if (id === SCENARIOS_TO_CHECK[0]) {
    // Pantallas de la IA: se inyecta un resultado de ejemplo (no se llama a ninguna API).
    await page.evaluate((result) => {
      const { session } = window.pitchLab;
      session.capture.aiResult = result;
      session.data.ai = { status: 'done', error: null, model: result.model };
      session.emit('change');
    }, AI_RESULT);
    for (const p of [0, 2, 3, 4]) { await dispatch(page, 'SET_PAGE', { page: p }); await snap(page, `${id} · devolución ${p + 1} con IA`); }
  }
  await dispatch(page, 'CHANGE_SCENARIO');
  await page.waitForFunction(() => ['select', 'home'].includes(window.pitchLab.session.state), null, { timeout: 8000 });
}

// --- Revisión de la transcripción (modo voz con el reconocimiento simulado): el texto largo es el caso más exigente ---
await dispatch(page, 'PICK_SCENARIO', { id: 'sala' });
await dispatch(page, 'ENTER');
await dispatch(page, 'PREPARE');
await dispatch(page, 'SET_INPUT_MODE', { mode: 'voice' });
await dispatch(page, 'BEGIN');
await page.waitForFunction(() => window.pitchLab.session.state === 'presenting', null, { timeout: 8000 });
await page.evaluate((t) => window.__speech.say(t), words(90, 'palabra'));
await wait(500);
await dispatch(page, 'FINISH');
await page.waitForFunction(() => window.pitchLab.session.state === 'review', null, { timeout: 8000 });
await snap(page, 'sala · revisión con transcripción larga');
await dispatch(page, 'SET_TRANSCRIPT', { text: '' });
await snap(page, 'sala · revisión sin transcripción');

await context.close();
await browser.close();

// ---- Informe ----
// El texto con letras espaciadas se dibuja letra por letra: se agrupa por pantalla, superficie y tamaño.
const groups = new Map();
for (const { label, items } of rows) {
  for (const it of items) {
    const key = `${label}|${it.kind}|${it.size}`;
    const g = groups.get(key);
    if (!g) groups.set(key, { label, ...it, n: 1 });
    else { g.n++; g.deg = Math.min(g.deg, it.deg); if (it.text.length > g.text.length) g.text = it.text; }
  }
}
if (process.env.LEGIBILIDAD_RAW) await fs.writeFile(process.env.LEGIBILIDAD_RAW, JSON.stringify(rows, null, 1));
const all = [...groups.values()];
const below = all.filter((g) => g.deg < MIN_DEG).sort((a, b) => a.deg - b.deg);
const worst = new Map();
for (const g of all) { const w = worst.get(g.kind); if (!w || g.deg < w.deg) worst.set(g.kind, g); }
console.log('Peor caso por superficie (altura de mayúsculas, en grados):');
for (const [kind, w] of [...worst.entries()].sort((a, b) => a[1].deg - b[1].deg)) {
  console.log(`  ${kind.padEnd(22)} ${String(w.deg).padStart(5)}°  «${w.text.slice(0, 36)}» (${w.size}px, ${w.dist} m) en «${w.label}»`);
}
if (below.length) {
  console.log(`Por debajo de ${MIN_DEG}° (${below.length} combinaciones pantalla/superficie/tamaño):`);
  for (const g of below.slice(0, 60)) console.log(`  ✖ ${g.deg}°  ${g.label} · ${g.kind} · ${g.size}px a ${g.dist} m: «${g.text.slice(0, 44)}»`);
}
const total = rows.reduce((n, r) => n + r.items.length, 0);
console.log(`${total} textos medidos en ${rows.length} pantallas; ${below.length} combinaciones por debajo de ${MIN_DEG}°; ${all.filter((g) => g.deg >= MIN_DEG && g.deg < COMFORT_DEG).length} entre ${MIN_DEG}° y ${COMFORT_DEG}°.`);

await fs.writeFile(path.join(here, 'ultimo-resultado-legibilidad.json'), JSON.stringify({
  fecha: new Date().toISOString(),
  nota: 'Medición con la geometría real en un navegador de pruebas. No reemplaza una prueba en casco físico.',
  minimoGrados: MIN_DEG, comodoGrados: COMFORT_DEG,
  pantallas: rows.map((r) => ({ pantalla: r.label, textos: r.items.length, peor: r.items.reduce((m, i) => (i.deg < m.deg ? i : m), { deg: 99 }) })),
}, null, 2));

// El reloj está también en el atril (a la vista de quien presenta): durante la presentación se dibuja el tiempo ahí.
for (const r of rows.filter((x) => x.label.endsWith('presentando'))) {
  const hasTime = r.items.some((i) => i.kind === 'atril' && /^\d+:\d{2}$/.test(i.text));
  assert.ok(hasTime, `${r.label}: el atril no muestra el tiempo`);
}

const fatal = problems.filter((p) => !/favicon/.test(p));
assert.deepEqual(fatal, [], 'errores de consola o contenido del panel que no entra durante la auditoría');
// La auditoría FALLA si algún texto del espacio 3D queda por debajo del mínimo (LEGIBILIDAD_INFO=1 solo informa).
if (below.length && !process.env.LEGIBILIDAD_INFO) {
  console.log(`✖ ${below.length} combinaciones por debajo de ${MIN_DEG}°`);
  process.exit(1);
}
console.log(`✔ Ningún texto del espacio 3D baja de ${MIN_DEG}° (altura de mayúsculas) y todo el contenido entra en los paneles`);
process.exit(0);
