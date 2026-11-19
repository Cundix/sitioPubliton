// Pruebas de extremo a extremo del análisis con IA, con un navegador real (Edge/Chrome por Playwright).
//
// QUÉ SE USA DE VERDAD: el micrófono falso del navegador (reproduce un archivo de audio de prueba), la grabación con
// MediaRecorder, la conversión a WAV, la cámara falsa del navegador, el modelo de manos de MediaPipe (incluido en el sitio)
// y la interfaz completa (3D con mouse real + panel de texto).
// QUÉ ES UN MOCK: las respuestas de la API de Gemini (las controla el test; no se gasta cuota ni se necesita clave).
// QUÉ NO SE VERIFICA AQUÍ: la calidad del análisis de la IA real, ni manos reales frente a la cámara
// (la cámara falsa no muestra manos). Ver docs/pruebas.md y tests/e2e/ia-real.mjs.
//
// Uso:  node tools/serve.mjs 8090   y después   PITCHLAB_URL=http://localhost:8090/pitch-lab/ node tests/e2e/ai.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openPage, waitReady } from '../../tools/browser.mjs';
import { MOCK_SPEECH_ABSENT } from './mocks.mjs';
import { wait, state, waitState, dispatch, resetView, click3D, actionPoint } from './helpers.mjs';
import { GOOD_ANALYSIS } from '../unit/helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2);
// Host propio de la página (localhost o, al probar el sitio publicado, cundix.github.io): lo demás es «externo».
const OWN_HOST = new URL(process.env.PITCHLAB_URL || 'http://localhost:8080/pitch-lab/').host;
const MEDIAPIPE_INFO = /XNNPACK delegate/; // aviso informativo de MediaPipe (sale por console.error)
const KEY = `AIza${'e2e-prueba-'.padEnd(35, 'k')}`;
const results = [];

// ---------- Audio de prueba: 12 s de un tono con envolvente "de habla" (no es voz real) ----------
function makeFakeMic() {
  const rate = 16000;
  const seconds = 12;
  const samples = new Int16Array(rate * seconds);
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate;
    const envelope = Math.max(0, Math.sin(2 * Math.PI * 3 * t)) ** 0.5; // sílabas de ~3 Hz
    samples[i] = Math.round(Math.sin(2 * Math.PI * 180 * t) * 0.35 * envelope * 32767);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + samples.length * 2, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(samples.length * 2, 40);
  const file = path.join(os.tmpdir(), 'pitchlab-fake-mic.wav');
  fs.writeFileSync(file, Buffer.concat([header, Buffer.from(samples.buffer)]));
  return file;
}

// ---------- Gemini simulado ----------
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,x-goog-api-key', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const ok = (analysis = GOOD_ANALYSIS) => ({ status: 200, json: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(analysis) }] } }], usageMetadata: { totalTokenCount: 4321 } } });
const fail = (status, message, state = '') => ({ status, json: { error: { code: status, message, status: state } } });

async function mockGemini(context, handler = () => ok()) {
  const calls = [];
  await context.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    const url = req.url();
    const call = {
      url,
      method: req.method(),
      headers: req.headers(),
      body: req.postData() ? JSON.parse(req.postData()) : null,
      model: (url.match(/models\/([^/:?]+)/) || [])[1],
      kind: url.includes(':generateContent') ? 'generate' : 'model',
    };
    calls.push(call);
    const out = call.kind === 'model' ? { status: 200, json: { name: `models/${call.model}` } } : await handler(call, calls);
    await route.fulfill({ status: out.status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(out.json) });
  });
  calls.generate = () => calls.filter((c) => c.kind === 'generate');
  return calls;
}

/** Registra los micrófonos/cámaras que abre la página, para comprobar que se liberan. */
const TRACK_SPY = `
(() => {
  window.__tracks = [];
  const md = navigator.mediaDevices;
  if (!md) return;
  const orig = md.getUserMedia.bind(md);
  md.getUserMedia = async (c) => { const s = await orig(c); s.getTracks().forEach((t) => window.__tracks.push(t)); return s; };
  window.__liveTracks = () => window.__tracks.filter((t) => t.readyState === 'live').map((t) => t.kind);
})();`;

const liveTracks = (page) => page.evaluate(() => window.__liveTracks());

/** Interpreta el audio que se envió a Gemini: ¿es un WAV válido de 16 kHz mono con sonido? */
function inspectWav(base64) {
  const buf = Buffer.from(base64, 'base64');
  const info = { bytes: buf.length, riff: buf.toString('ascii', 0, 4), wave: buf.toString('ascii', 8, 12) };
  info.channels = buf.readUInt16LE(22);
  info.rate = buf.readUInt32LE(24);
  info.bits = buf.readUInt16LE(34);
  const n = (buf.length - 44) / 2;
  let sum = 0;
  for (let i = 0; i < n; i++) { const v = buf.readInt16LE(44 + i * 2) / 32768; sum += v * v; }
  info.seconds = n / info.rate;
  info.rms = Math.sqrt(sum / n);
  return info;
}

async function test(name, fn, { browser, opts = {}, allow = [] } = {}) {
  if (only.length && !only.some((o) => name.toLowerCase().includes(o.toLowerCase()))) return;
  const started = Date.now();
  const { init: extraInit = '', ...rest } = opts;
  const ctx = await openPage(browser, { permissions: ['microphone', 'camera'], ...rest, init: `${TRACK_SPY}\n${extraInit}` });
  const { page, problems, context } = ctx;
  const hosts = new Set();
  const logs = [];
  page.on('request', (r) => hosts.add(new URL(r.url()).host));
  page.on('console', (m) => logs.push(m.text()));
  let status = 'ok';
  let detail = '';
  try {
    await waitReady(page);
    await fn({ page, context, problems, hosts, logs });
    const real = problems.filter((p) => !/favicon/.test(p) && !allow.some((a) => a.test(p)));
    assert.deepEqual(real, [], `errores de consola o de red: ${real.join(' | ')}`);
    assert.ok(!logs.some((l) => l.includes(KEY)), 'la clave no debe aparecer en la consola');
  } catch (error) {
    status = 'FALLÓ';
    detail = error.message;
    await page.screenshot({ path: path.join(here, `fallo-ia-${results.length + 1}.png`) }).catch(() => {});
  } finally {
    await context.close();
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  results.push({ name, status, detail, secs: Number(secs) });
  console.log(`${status === 'ok' ? '✔' : '✖'} ${name} (${secs}s)${detail ? `\n    ${detail}` : ''}`);
}

const setKey = (page, key = KEY) => page.evaluate((k) => window.pitchLab.keyStore.set(k), key);

async function gotoPrep(page, scenario = 'sala') {
  await dispatch(page, 'START');
  if ((await state(page)) === 'tutorial') await dispatch(page, 'SKIP');
  await dispatch(page, 'PICK_SCENARIO', { id: scenario });
  await dispatch(page, 'ENTER');
  await dispatch(page, 'PREPARE');
  await resetView(page);
}

/** Activa IA y/o gestos con clics 3D reales en la pantalla «IA y cámara» y vuelve a la preparación. */
async function configureAi(page, { ai = true, gestures = false } = {}) {
  await click3D(page, 'open-ai');
  await waitState(page, 'ai-setup');
  if (ai) await click3D(page, 'ai-toggle');
  if (gestures) await click3D(page, 'gestures-toggle');
  await click3D(page, 'close-ai');
  await waitState(page, 'prep');
}

const modelOf = (page) => page.evaluate(() => window.pitchLab.session.data.ai.model);
const aiStatus = (page) => page.evaluate(() => window.pitchLab.session.data.ai.status);
const waitAi = (page, expected, timeout = 20000) => page.waitForFunction((s) => window.pitchLab.session.data.ai.status === s, expected, { timeout });

const fakeMic = makeFakeMic();
const browser = await launch({ fakeAudioFile: `${fakeMic}%noloop` });

// ---------------------------------------------------------------------------
await test('IA 1. Sin clave: la experiencia no cambia y no se contacta a Google', async ({ page, context, hosts }) => {
  const calls = await mockGemini(context);
  assert.equal(await page.evaluate(() => window.pitchLab.session.data.capabilities.ai), false);
  await gotoPrep(page);
  await click3D(page, 'open-ai');
  await waitState(page, 'ai-setup');
  assert.equal(await dispatch(page, 'TOGGLE_AI'), false, 'sin clave no se puede activar');
  const toggle = await page.evaluate(() => window.pitchLab.hub.model.panel.options.find((o) => o.id === 'ai-toggle'));
  assert.equal(toggle.disabled, true);
  const gt = await page.evaluate(() => window.pitchLab.hub.model.panel.options.find((o) => o.id === 'gestures-toggle'));
  assert.equal(gt.disabled, false, 'la cámara no necesita clave');
  await click3D(page, 'close-ai');
  await waitState(page, 'prep');
  await click3D(page, 'begin');
  await waitState(page, 'presenting');
  await wait(1200);
  await click3D(page, 'finish');
  await waitState(page, 'feedback');
  const tabs = await page.evaluate(() => window.pitchLab.hub.model.panel.options.filter((o) => o.kind === 'tab').map((o) => o.id));
  assert.deepEqual(tabs, ['tab-0', 'tab-1', 'tab-2']);
  assert.equal(calls.length, 0, 'ninguna llamada a la API');
  assert.ok(![...hosts].some((h) => /googleapis|google/.test(h)), `hosts: ${[...hosts]}`);
  assert.deepEqual(await liveTracks(page), []);
}, { browser, opts: { init: MOCK_SPEECH_ABSENT } });

// ---------------------------------------------------------------------------
await test('IA 2. La clave se carga en el panel de texto, se prueba y se guarda solo donde corresponde', async ({ page, context }) => {
  const calls = await mockGemini(context);
  await page.click('#btn-drawer');
  await page.click('#ai-settings summary');
  assert.equal(await page.evaluate(() => document.getElementById('ai-key').type), 'password');

  await page.fill('#ai-key', 'esto no es una clave');
  await page.click('#ai-save');
  assert.match(await page.textContent('#ai-key-status'), /formato esperado/);
  assert.equal(calls.length, 0, 'una clave con formato inválido ni siquiera se envía');

  await page.fill('#ai-key', KEY);
  await page.click('#ai-save');
  await page.waitForFunction(() => /Clave válida/.test(document.getElementById('ai-key-status').textContent));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
  assert.ok(calls[0].url.endsWith('/models/gemini-3.5-flash-lite'), calls[0].url);
  assert.equal(calls[0].headers['x-goog-api-key'], KEY);
  assert.ok(!calls[0].url.includes('AIza'), 'la clave no va en la URL');

  const store = await page.evaluate(() => ({
    session: Object.values(sessionStorage).some((v) => v.includes('AIza')),
    local: Object.values(localStorage).some((v) => v.includes('AIza')),
    input: document.getElementById('ai-key').value,
    text: document.body.innerText,
    ai: window.pitchLab.session.data.capabilities.ai,
    status: document.getElementById('ai-key-status').textContent,
  }));
  assert.equal(store.session, true);
  assert.equal(store.local, false, 'por defecto NO se guarda en el dispositivo');
  assert.equal(store.input, '', 'el campo se vacía');
  assert.ok(!store.text.includes(KEY), 'la clave no se muestra en la página');
  assert.equal(store.ai, true);
  assert.match(store.status, /Clave válida/);

  // Se mantiene al recargar la pestaña (sessionStorage) y se muestra enmascarada
  await page.reload({ waitUntil: 'load' });
  await waitReady(page);
  assert.equal(await page.evaluate(() => window.pitchLab.session.data.capabilities.ai), true);
  const afterReload = await page.evaluate(() => document.getElementById('ai-key-status').textContent);
  assert.match(afterReload, /Clave cargada \(…kkkk, solo en esta pestaña\)/);
  assert.ok(!afterReload.includes('AIza'));

  // «Recordar en este dispositivo»
  await page.click('#btn-drawer');
  await page.click('#ai-settings summary');
  await page.check('#ai-remember');
  await page.fill('#ai-key', KEY);
  await page.click('#ai-save');
  await page.waitForFunction(() => /Clave válida/.test(document.getElementById('ai-key-status').textContent));
  const remembered = await page.evaluate(() => ({ session: Object.values(sessionStorage).some((v) => v.includes('AIza')), local: Object.values(localStorage).some((v) => v.includes('AIza')) }));
  assert.deepEqual(remembered, { session: false, local: true });

  // Borrar
  await page.click('#ai-clear');
  const cleared = await page.evaluate(() => ({ any: [...Object.values(sessionStorage), ...Object.values(localStorage)].some((v) => v.includes('AIza')), ai: window.pitchLab.session.data.capabilities.ai }));
  assert.deepEqual(cleared, { any: false, ai: false });
}, { browser });

// ---------------------------------------------------------------------------
await test('IA 3. Recorrido completo: micrófono → WAV 16 kHz → Gemini (simulado) → devolución', async ({ page, context, hosts }) => {
  const calls = await mockGemini(context, async () => { await wait(1200); return ok(); });
  await setKey(page);
  await gotoPrep(page);
  await configureAi(page);
  assert.match(await page.evaluate(() => window.pitchLab.hub.model.lectern.hint), /IA: sí/);
  assert.equal(await page.evaluate(() => window.pitchLab.session.data.options.inputMode), 'voice');
  assert.equal(calls.length, 0, 'configurar no envía nada');
  assert.deepEqual(await liveTracks(page), [], 'el micrófono no se abre antes de comenzar');

  await click3D(page, 'begin');
  await waitState(page, 'presenting');
  assert.deepEqual(await liveTracks(page), ['audio']);
  assert.equal(await page.evaluate(() => window.pitchLab.session.aiRecording), true);
  await wait(5200);
  await click3D(page, 'finish');
  await waitState(page, 'feedback');
  assert.deepEqual(await liveTracks(page), [], 'el micrófono se liberó al terminar');
  await waitAi(page, 'analyzing');
  assert.match(await page.evaluate(() => window.pitchLab.hub.model.lectern.status), /DEVOLUCIÓN/);

  await waitAi(page, 'done');
  const gen = calls.generate();
  assert.equal(gen.length, 1);
  const call = gen[0];
  assert.equal(call.method, 'POST');
  assert.ok(call.url.endsWith('/models/gemini-3.5-flash-lite:generateContent'), call.url);
  assert.equal(call.headers['x-goog-api-key'], KEY);
  assert.ok(!call.url.includes('AIza'));
  const parts = call.body.contents[0].parts;
  assert.equal(parts[1].inlineData.mimeType, 'audio/wav');
  const wav = inspectWav(parts[1].inlineData.data);
  assert.equal(wav.riff, 'RIFF'); assert.equal(wav.wave, 'WAVE');
  assert.equal(wav.rate, 16000); assert.equal(wav.channels, 1); assert.equal(wav.bits, 16);
  assert.ok(wav.seconds > 4 && wav.seconds < 8, `duración ${wav.seconds.toFixed(1)} s`);
  assert.ok(wav.rms > 0.02, `el audio tiene sonido (rms ${wav.rms.toFixed(3)})`);
  assert.match(parts[0].text, /Marca ficticia/);
  assert.match(parts[0].text, /No se activó la cámara/);
  assert.equal(call.body.generationConfig.responseMimeType, 'application/json');
  assert.match(call.body.systemInstruction.parts[0].text, /NO evalúes ni infieras emociones/);
  assert.equal(await modelOf(page), 'gemini-3.5-flash-lite');

  // Devolución: pestañas nuevas, con clic 3D real
  const tabs = await page.evaluate(() => window.pitchLab.hub.model.panel.options.filter((o) => o.kind === 'tab').map((o) => o.id));
  assert.deepEqual(tabs, ['tab-0', 'tab-1', 'tab-2', 'tab-3', 'tab-4']);
  await click3D(page, 'tab-3');
  assert.equal(await page.evaluate(() => window.pitchLab.hub.model.panel.title.join(' ')), 'IA: CONTENIDO');
  await page.keyboard.press('t');
  await wait(250);
  const drawer = await page.evaluate(() => document.getElementById('drawer-body').innerText);
  assert.match(drawer, /interpretación automática/);
  assert.match(drawer, /nadie conoce la marca/);
  assert.match(drawer, /Por qué: El cierre no aparece/);
  await click3D(page, 'tab-4').catch(async () => dispatch(page, 'SET_PAGE', { page: 4 }));
  assert.match(await page.evaluate(() => document.getElementById('drawer-body').innerText), /muletillas/i);

  // Nada se guarda ni se envía a otros lados
  const stored = await page.evaluate(async () => ({
    ls: JSON.stringify(localStorage).length,
    ss: Object.keys(sessionStorage),
    idb: (await indexedDB.databases?.())?.length || 0,
    stream: window.pitchLab.ai.capture.stream,
    recorder: window.pitchLab.ai.capture.recorder,
  }));
  assert.ok(stored.ls < 600, `localStorage ${stored.ls} bytes`);
  assert.equal(stored.ss.length, 1, 'solo la clave de la sesión');
  assert.equal(stored.idb, 0);
  assert.equal(stored.stream, null);
  assert.equal(stored.recorder, null);
  const external = [...hosts].filter((h) => h !== OWN_HOST);
  assert.deepEqual(external, ['generativelanguage.googleapis.com']);
}, { browser, opts: { init: MOCK_SPEECH_ABSENT } });

// ---------------------------------------------------------------------------
await test('IA 4. Cuota agotada en todos los modelos: error claro y reintento con la grabación en memoria', async ({ page, context }) => {
  let quota = true;
  const calls = await mockGemini(context, () => (quota ? fail(429, 'Quota exceeded', 'RESOURCE_EXHAUSTED') : ok()));
  await setKey(page);
  await gotoPrep(page);
  await configureAi(page);
  await click3D(page, 'begin');
  await waitState(page, 'presenting');
  await wait(3500);
  await click3D(page, 'finish');
  await waitState(page, 'feedback');
  await waitAi(page, 'error');
  assert.equal(calls.generate().length, 2, 'probó los dos modelos');
  assert.deepEqual(calls.generate().map((c) => c.model), ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']);
  await click3D(page, 'tab-3');
  const title = await page.evaluate(() => window.pitchLab.hub.model.panel.title.join(' '));
  assert.match(title, /NO SE PUDO/);
  const text = await page.evaluate(() => JSON.stringify(window.pitchLab.hub.model.panel.blocks));
  assert.match(text, /límite de uso/);
  assert.ok(!text.includes(KEY));
  assert.ok(await actionPoint(page, 'ai-retry'), 'hay botón para reintentar');

  quota = false;
  await click3D(page, 'ai-retry');
  await waitAi(page, 'done');
  assert.equal(calls.generate().length, 3, 'el reintento usa el modelo principal');
  const [first, , retry] = calls.generate();
  assert.equal(retry.body.contents[0].parts[1].inlineData.data.length, first.body.contents[0].parts[1].inlineData.data.length, 'se reenvía la misma grabación');
  assert.equal(await page.evaluate(() => window.pitchLab.session.canRetryAi), false, 'la grabación ya se descartó');
}, { browser, opts: { init: MOCK_SPEECH_ABSENT }, allow: [/429/] });

// ---------------------------------------------------------------------------
await test('IA 5. Si el modelo principal falla, se usa el de respaldo y se informa cuál', async ({ page, context }) => {
  const calls = await mockGemini(context, (c) => (c.model === 'gemini-3.5-flash-lite' ? fail(503, 'overloaded', 'UNAVAILABLE') : ok()));
  await setKey(page);
  await gotoPrep(page);
  await configureAi(page);
  await click3D(page, 'begin');
  await waitState(page, 'presenting');
  await wait(3200);
  await click3D(page, 'finish');
  await waitState(page, 'feedback');
  await waitAi(page, 'done');
  assert.deepEqual(calls.generate().map((c) => c.model), ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']);
  assert.equal(await modelOf(page), 'gemini-3.1-flash-lite');
  await dispatch(page, 'SET_PAGE', { page: 3 });
  await page.keyboard.press('t');
  await wait(250);
  assert.match(await page.evaluate(() => document.getElementById('drawer-body').innerText), /Modelo: gemini-3\.1-flash-lite/);
}, { browser, opts: { init: MOCK_SPEECH_ABSENT }, allow: [/503/] });

// ---------------------------------------------------------------------------
await test('IA 6. Clave rechazada por Google: un solo intento, mensaje claro y sin filtrar la clave', async ({ page, context }) => {
  const calls = await mockGemini(context, () => fail(400, `API key not valid. Please pass a valid API key. (${KEY})`, 'INVALID_ARGUMENT'));
  await setKey(page);
  await gotoPrep(page);
  await configureAi(page);
  await click3D(page, 'begin');
  await waitState(page, 'presenting');
  await wait(3200);
  await click3D(page, 'finish');
  await waitState(page, 'feedback');
  await waitAi(page, 'error');
  assert.equal(calls.generate().length, 1, 'una clave inválida no se reintenta con otro modelo');
  const err = await page.evaluate(() => window.pitchLab.session.data.ai.error);
  assert.equal(err.code, 'invalid-key');
  await page.keyboard.press('t');
  await wait(250);
  const everything = await page.evaluate(() => document.body.innerText + JSON.stringify(window.pitchLab.hub.model));
  assert.ok(!everything.includes(KEY), 'la clave no aparece en la interfaz');
}, { browser, opts: { init: MOCK_SPEECH_ABSENT }, allow: [/400/] });

// ---------------------------------------------------------------------------
await test('IA 7. Cámara: el modelo de manos se carga del mismo sitio, mide en el dispositivo y se libera', async ({ page, context, hosts }) => {
  const calls = await mockGemini(context);
  // Vista previa desde el panel de texto
  await page.click('#btn-drawer');
  await page.click('#ai-settings summary');
  await page.click('#cam-test');
  await page.waitForFunction(() => /Cámara lista|No se pudo|no dio acceso|No se encontró/.test(document.getElementById('cam-status').textContent), null, { timeout: 60000 });
  const camStatus = await page.textContent('#cam-status');
  assert.match(camStatus, /Cámara lista/, camStatus);
  assert.equal(await page.evaluate(() => document.getElementById('cam-float').hidden), false, 'se ve la vista previa');
  assert.deepEqual(await liveTracks(page), ['video']);
  await page.click('#cam-test');
  assert.equal(await page.evaluate(() => document.getElementById('cam-float').hidden), true);
  assert.deepEqual(await liveTracks(page), [], 'apagar la vista previa libera la cámara');
  await page.click('#drawer-close');

  // Presentación solo con gestos (sin IA, sin micrófono)
  await gotoPrep(page);
  await configureAi(page, { ai: false, gestures: true });
  assert.match(await page.evaluate(() => window.pitchLab.hub.model.lectern.hint), /cámara: sí/);
  await click3D(page, 'begin');
  await waitState(page, 'presenting', 60000);
  assert.deepEqual(await liveTracks(page), ['video']);
  await wait(6500);
  await click3D(page, 'finish');
  await waitState(page, 'feedback');
  assert.deepEqual(await liveTracks(page), [], 'la cámara se liberó al terminar');
  assert.equal(await page.evaluate(() => document.getElementById('cam-float').hidden), true);
  const g = await page.evaluate(() => window.pitchLab.session.getFeedback().gestures);
  assert.equal(g.measured, true, JSON.stringify(g));
  assert.ok(g.frames >= 8, `cuadros analizados: ${g.frames}`);
  assert.ok(g.durationSec >= 3, `duración ${g.durationSec}`);
  assert.equal(g.handsVisibleShare, 0, 'la cámara falsa no muestra manos');
  const rows = await page.evaluate(() => window.pitchLab.session.getFeedback().measurements.filter((r) => r.id === 'hands' || r.id === 'handMove').map((r) => r.display));
  assert.equal(rows.length, 2);

  // Todo el modelo y el runtime vinieron del propio sitio; nada se envió a Google
  const mp = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((n) => /mediapipe/.test(n)));
  assert.ok(mp.some((n) => n.endsWith('hand_landmarker.task')), 'cargó el modelo de manos');
  assert.ok(mp.some((n) => n.endsWith('.wasm')), 'cargó el runtime WebAssembly');
  assert.equal(calls.length, 0);
  assert.deepEqual([...hosts].filter((h) => h !== OWN_HOST), []);
}, { browser, opts: { init: MOCK_SPEECH_ABSENT }, allow: [MEDIAPIPE_INFO] });

// ---------------------------------------------------------------------------
await test('IA 8. Cancelar libera micrófono y cámara y no envía nada', async ({ page, context }) => {
  const calls = await mockGemini(context);
  await setKey(page);
  await gotoPrep(page);
  await configureAi(page, { ai: true, gestures: true });
  await click3D(page, 'begin');
  await waitState(page, 'presenting', 60000);
  assert.deepEqual((await liveTracks(page)).sort(), ['audio', 'video']);
  await wait(1500);
  await click3D(page, 'cancel');
  await waitState(page, 'confirm-cancel');
  await click3D(page, 'confirm-cancel');
  await waitState(page, 'brief');
  assert.deepEqual(await liveTracks(page), []);
  await wait(600);
  assert.equal(calls.generate().length, 0);
  assert.equal(await aiStatus(page), 'off');
  assert.equal(await page.evaluate(() => document.getElementById('cam-float').hidden), true);
}, { browser, opts: { init: MOCK_SPEECH_ABSENT }, allow: [MEDIAPIPE_INFO] });

// ---------------------------------------------------------------------------
await test('IA 9. Cancelar mientras se esperan los permisos no deja nada abierto', async ({ page, context }) => {
  await mockGemini(context);
  await setKey(page);
  await gotoPrep(page);
  await configureAi(page, { ai: true, gestures: true });
  await dispatch(page, 'BEGIN');
  await dispatch(page, 'CANCEL');
  await wait(2500);
  assert.equal(await state(page), 'prep');
  assert.deepEqual(await liveTracks(page), []);
}, { browser, opts: { init: MOCK_SPEECH_ABSENT }, allow: [MEDIAPIPE_INFO] });

// ---------------------------------------------------------------------------
await test('IA 10. El navegador solo deja conectar con el propio sitio y con la API de Gemini', async ({ page, context }) => {
  const calls = await mockGemini(context);
  const result = await page.evaluate(async () => {
    const attempt = (url, init) => fetch(url, init).then(() => 'permitido', () => 'bloqueado');
    return {
      otro: await attempt('https://example.com/'),
      telemetria: await attempt('https://odml.pa.googleapis.com/v1/log', { method: 'POST', body: 'x' }),
      mismo: await attempt('./css/pitch-lab.css'),
      gemini: await attempt('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite', { headers: { 'x-goog-api-key': 'AIzaprueba' } }),
    };
  });
  assert.deepEqual(result, { otro: 'bloqueado', telemetria: 'bloqueado', mismo: 'permitido', gemini: 'permitido' });
  assert.equal(calls.length, 1);
  const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content);
  assert.match(csp, /connect-src 'self' https:\/\/generativelanguage\.googleapis\.com/);
}, { browser, allow: [/Content Security Policy|Refused to connect|requestfailed/] });

await browser.close();
const failed = results.filter((r) => r.status !== 'ok');
const resultFile = path.join(here, 'ultimo-resultado-ia.json');
fs.writeFileSync(resultFile, JSON.stringify({ fecha: new Date().toISOString().slice(0, 10), total: results.length, fallaron: failed.length, pruebas: results }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} pruebas de IA correctas`);
process.exit(failed.length ? 1 : 0);
