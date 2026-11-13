// Prueba MANUAL (no forma parte de la suite automática) del análisis con la API REAL de Gemini.
//
// Gasta cuota de la clave que uses. Se ejecuta a mano, con TU clave y con un audio de una presentación hablada.
// La clave NO está en el repositorio: se lee de un archivo que vos indicás y se escribe en el campo de la interfaz
// (como lo haría una persona). Nunca se imprime.
//
// Uso (PowerShell, con el servidor local andando: node tools/serve.mjs 8090):
//   $env:GEMINI_API_KEY_FILE = "C:\ruta\mi-clave.txt"       # un archivo con solo la clave
//   $env:PITCHLAB_FAKE_MIC   = "C:\ruta\presentacion.wav"   # WAV 16 bits con una presentación hablada (30-60 s)
//   $env:PITCHLAB_URL        = "http://localhost:8090/pitch-lab/"
//   node tests/e2e/ia-real.mjs
//
// Qué comprueba: que la clave se acepta, que el audio grabado llega a Gemini, que la respuesta real cumple el esquema
// y se muestra en la devolución. Qué NO comprueba: que el análisis sea "correcto" (eso lo juzga una persona).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openPage, waitReady } from '../../tools/browser.mjs';
import { OMITTED_EMOTION_NOTE } from '../../js/ai/analysis-prompt.js';
import { wait, state, waitState, dispatch, resetView, click3D, actionPoint } from './helpers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const keyFile = process.env.GEMINI_API_KEY_FILE;
const micFile = process.env.PITCHLAB_FAKE_MIC;
const shotsDir = process.env.PITCHLAB_SHOTS || path.join(here, '..', '..', 'capturas');
const presentSec = Number(process.env.PITCHLAB_PRESENT_SEC || 38);
if (!keyFile || !fs.existsSync(keyFile)) throw new Error('Falta GEMINI_API_KEY_FILE (archivo con la clave).');
if (!micFile || !fs.existsSync(micFile)) throw new Error('Falta PITCHLAB_FAKE_MIC (WAV con una presentación hablada).');
const KEY = fs.readFileSync(keyFile, 'utf8').trim();
const redact = (text) => String(text).split(KEY).join('«clave»');

/** Espera a que el botón 3D exista y esté a la vista (el render por software puede demorar) y recién ahí hace clic. */
async function press(page, id) {
  for (let i = 0; i < 100; i++) {
    const p = await actionPoint(page, id);
    if (p?.inView) break;
    await wait(100);
  }
  await click3D(page, id);
}

const browser = await launch({ fakeAudioFile: `${micFile}%noloop` });
const { page, problems, context } = await openPage(browser, {
  permissions: ['microphone', 'camera'],
  init: 'delete window.SpeechRecognition; delete window.webkitSpeechRecognition; Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true }); Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true });',
});
const calls = [];
page.on('request', (r) => { if (/googleapis/.test(r.url())) calls.push(`${r.method()} ${redact(r.url()).replace(/\?.*/, '')}`); });
// Solo se imprimen los CONTADORES de tokens que informa la API (sirven para estimar cuota y costo); nunca el contenido.
page.on('response', async (r) => {
  if (!r.url().includes(':generateContent')) return;
  try { console.log(`Respuesta HTTP ${r.status()} · uso de tokens: ${JSON.stringify((await r.json()).usageMetadata || null)}`); } catch { /* sin cuerpo */ }
});

try {
  await waitReady(page);

  // 1) Cargar la clave como lo haría una persona: panel de texto → campo → Guardar (esto prueba la clave de verdad)
  await page.click('#btn-drawer');
  await page.click('#ai-settings summary');
  await page.fill('#ai-key', KEY);
  await page.click('#ai-save');
  await page.waitForFunction(() => /Clave válida|rechazó|límite|No se pudo/.test(document.getElementById('ai-key-status').textContent), null, { timeout: 30000 });
  const keyStatus = redact(await page.textContent('#ai-key-status'));
  console.log(`Clave: ${keyStatus}`);
  assert.match(keyStatus, /Clave válida/);
  fs.mkdirSync(shotsDir, { recursive: true });
  // El campo ya se vació y el estado no muestra ningún carácter de la clave: la captura es segura de publicar.
  assert.equal(await page.inputValue('#ai-key'), '');
  await page.screenshot({ path: path.join(shotsDir, 'ia-0-clave.png') });
  await page.click('#drawer-close');

  // 2) Presentar con el audio de prueba como micrófono
  await dispatch(page, 'START');
  if ((await state(page)) === 'tutorial') await dispatch(page, 'SKIP');
  await dispatch(page, 'PICK_SCENARIO', { id: process.env.PITCHLAB_SCENARIO || 'sala' });
  await dispatch(page, 'ENTER');
  await dispatch(page, 'PREPARE');
  await resetView(page);
  await press(page, 'open-ai');
  await waitState(page, 'ai-setup');
  await press(page, 'ai-toggle');
  fs.mkdirSync(shotsDir, { recursive: true });
  await page.screenshot({ path: path.join(shotsDir, 'ia-1-configuracion.png') });
  await press(page, 'close-ai');
  await waitState(page, 'prep');
  await press(page, 'begin');
  const tBegin = Date.now();
  await waitState(page, 'presenting', 60000); // el archivo de audio de prueba puede tardar en abrirse
  console.log(`Permisos concedidos y grabando tras ${((Date.now() - tBegin) / 1000).toFixed(1)} s`);
  await wait(presentSec * 1000);
  await press(page, 'finish');
  await waitState(page, 'feedback');
  await page.screenshot({ path: path.join(shotsDir, 'ia-2-analizando.png') });

  // 3) Esperar la respuesta real
  const t0 = Date.now();
  await page.waitForFunction(() => ['done', 'error'].includes(window.pitchLab.session.data.ai.status), null, { timeout: 150000 });
  const seconds = ((Date.now() - t0) / 1000).toFixed(1);
  const ai = await page.evaluate(() => window.pitchLab.session.data.ai);
  console.log(`Análisis: ${ai.status} en ${seconds} s · modelo: ${ai.model || '-'}${ai.error ? ` · error: ${redact(ai.error.code)} ${redact(ai.error.message)}` : ''}`);
  assert.equal(ai.status, 'done', `el análisis terminó con error: ${redact(JSON.stringify(ai.error))}`);

  const fb = await page.evaluate(() => {
    const a = window.pitchLab.session.getFeedback().ai.analysis;
    return {
      audible: a.audible,
      transcript: a.transcript,
      summary: a.summary,
      rubric: Object.fromEntries(Object.entries(a.rubric).map(([k, v]) => [k, v.level])),
      restriction: a.briefFit.restriction,
      delivery: a.delivery,
      strengths: a.strengths,
      improvements: a.improvements,
      limitations: a.limitations,
    };
  });
  console.log(JSON.stringify(fb, null, 2));
  assert.equal(fb.audible, true, 'la IA no oyó voz en el audio');
  assert.ok(fb.transcript.length > 40, 'la IA transcribió algo');
  // La validación reemplaza cualquier observación de la entrega que nombre emociones o actitudes; se informa cuántas hubo.
  const omitted = Object.values(fb.delivery).filter((d) => d.observation === OMITTED_EMOTION_NOTE).length;
  console.log(`Observaciones de la entrega omitidas por nombrar emociones o actitudes: ${omitted} de ${Object.keys(fb.delivery).length}`);

  for (const [n, page_] of [[3, 'ia-3-contenido'], [4, 'ia-4-entrega']]) {
    await press(page, `tab-${n}`);
    await wait(300);
    await page.screenshot({ path: path.join(shotsDir, `${page_}.png`) });
  }
  await page.keyboard.press('t');
  await wait(300);
  await page.screenshot({ path: path.join(shotsDir, 'ia-5-panel-de-texto.png') });
  console.log('Llamadas a Google:', calls.join(' | '));
  // Un 503 o 429 del modelo principal NO es un fallo de la prueba: es justamente lo que el modelo de respaldo cubre.
  const transient = /http (429|503)|status of (429|503)/;
  const failedBefore = await page.evaluate(() => window.pitchLab.session.getFeedback().ai.failedBefore);
  if (failedBefore.length) console.log(`El modelo principal falló y se usó el de respaldo. Antes se intentó con: ${failedBefore.join('; ')}`);
  const real = problems.filter((p) => !/favicon/.test(p) && !transient.test(p)).map(redact);
  assert.deepEqual(real, [], `errores de consola o de red: ${real.join(' | ')}`);
  console.log('\n✔ Prueba con la API real: correcta');
} catch (error) {
  console.error(`\n✖ ${redact(error.message)}`);
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
