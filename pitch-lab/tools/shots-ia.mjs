// Capturas de los estados de la función de IA y cámara que NO salen de la prueba con la API real:
// vista previa de la cámara, "analizando" y error con botón de reintento.
//
// IMPORTANTE: usa una API de Gemini SIMULADA (no gasta cuota) y la cámara/micrófono FALSOS del navegador.
// Sirven para mostrar la interfaz, no resultados reales. Las capturas con la respuesta real las genera
// tests/e2e/ia-real.mjs (con tu propia clave).
//
// Uso:  node tools/serve.mjs 8090   y después   PITCHLAB_URL=http://localhost:8090/pitch-lab/ node tools/shots-ia.mjs capturas

import fs from 'node:fs';
import path from 'node:path';
import { launch, openPage, waitReady } from './browser.mjs';
import { wait, state, waitState, dispatch, resetView, click3D, actionPoint } from '../tests/e2e/helpers.mjs';

const outDir = path.resolve(process.argv[2] || 'capturas');
fs.mkdirSync(outDir, { recursive: true });
const KEY = `AIza${'captura-sim-'.padEnd(35, 'k')}`;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,x-goog-api-key', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const NO_SPEECH = 'delete window.SpeechRecognition; delete window.webkitSpeechRecognition; Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true }); Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true });';

async function press(page, id) {
  for (let i = 0; i < 100; i++) { const p = await actionPoint(page, id); if (p?.inView) break; await wait(100); }
  await click3D(page, id);
}

const browser = await launch();
const { page, context } = await openPage(browser, { permissions: ['microphone', 'camera'], init: NO_SPEECH, width: 1600, height: 900 });
// El pedido a la API simulada queda en espera (para capturar «analizando») hasta que se llame a release().
let release;
const gate = new Promise((resolve) => { release = resolve; });
await context.route('https://generativelanguage.googleapis.com/**', async (route) => {
  const req = route.request();
  if (req.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
  if (!req.url().includes(':generateContent')) { await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: '{}' }); return; }
  await gate;
  await route.fulfill({ status: 429, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ error: { code: 429, message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } }) });
});

try {
  await waitReady(page);
  await page.evaluate((k) => window.pitchLab.keyStore.set(k), KEY);

  // 1) Vista previa de la cámara desde el panel de texto
  await page.click('#btn-drawer');
  await page.click('#ai-settings summary');
  await page.click('#cam-test');
  await page.waitForFunction(() => /Cámara lista|No se pudo|no dio acceso|No se encontró/.test(document.getElementById('cam-status').textContent), null, { timeout: 90000 });
  await wait(600);
  await page.screenshot({ path: path.join(outDir, '56-ia-camara-vista-previa.png') });
  await page.click('#cam-test');
  await page.click('#drawer-close');

  // 2) Presentación breve con IA y cámara activadas
  await dispatch(page, 'START');
  if ((await state(page)) === 'tutorial') await dispatch(page, 'SKIP');
  await dispatch(page, 'PICK_SCENARIO', { id: 'sala' });
  await dispatch(page, 'ENTER');
  await dispatch(page, 'PREPARE');
  await resetView(page);
  await press(page, 'open-ai'); await waitState(page, 'ai-setup');
  await press(page, 'ai-toggle'); await press(page, 'gestures-toggle');
  await wait(300);
  await page.screenshot({ path: path.join(outDir, '51-ia-y-camara-configuracion.png') });
  await press(page, 'close-ai'); await waitState(page, 'prep');
  await wait(300);
  await page.screenshot({ path: path.join(outDir, '50-ia-preparacion-con-ia.png') });
  await press(page, 'begin');
  await waitState(page, 'presenting', 90000);
  await wait(6000);
  await page.screenshot({ path: path.join(outDir, '57-ia-presentando-con-camara.png') });
  await press(page, 'finish');
  await waitState(page, 'feedback');
  await dispatch(page, 'SET_PAGE', { page: 3 });
  await wait(500);
  await page.screenshot({ path: path.join(outDir, '52-ia-analizando.png') });

  // 3) Cuota agotada en los dos modelos: error con botón de reintento
  release();
  await page.waitForFunction(() => window.pitchLab.session.data.ai.status === 'error', null, { timeout: 60000 });
  await wait(500);
  await page.screenshot({ path: path.join(outDir, '58-ia-error-reintentar.png') });
  console.log('capturas guardadas en', outDir);
} finally {
  await context.close();
  await browser.close();
}
