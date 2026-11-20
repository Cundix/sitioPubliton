// Pruebas de extremo a extremo con un navegador real (Edge/Chrome por Playwright).
//
// Qué verifican: el recorrido completo en una computadora, con mouse y teclado reales.
// Qué NO verifican: reconocimiento de voz real (se usan MOCKS controlados por el test),
// rendimiento en casco, ni uso en un casco físico. Ver docs/pruebas.md.
//
// Uso:  1) node tools/serve.mjs 8080
//       2) MSYS_NO_PATHCONV=1 node tools/serve.mjs 8081 /sitioPubliton   (para la prueba de rutas)
//       3) node tests/e2e/run.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openPage, waitReady } from '../../tools/browser.mjs';
import { MOCK_SPEECH_OK, MOCK_SPEECH_DENIED, MOCK_SPEECH_ABSENT } from './mocks.mjs';
import {
  wait, state, waitState, dispatch, resetView, click3D, actionPoint, clock, openAndStartSession, words,
} from './helpers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PITCHLAB_URL || 'http://localhost:8080/pitch-lab/';
const BASE_SUBPATH = process.env.PITCHLAB_URL_SUBPATH || 'http://localhost:8081/sitioPubliton/pitch-lab/';
const SITE_ROOT = BASE.replace(/pitch-lab\/?$/, '');

const results = [];
const only = process.argv.slice(2);

async function test(name, fn, { browser, opts = {}, ready = true } = {}) {
  if (only.length && !only.some((o) => name.toLowerCase().includes(o.toLowerCase()))) return;
  const started = Date.now();
  const ctx = await openPage(browser, { permissions: ['microphone'], ...opts });
  const { page, problems, context } = ctx;
  let status = 'ok';
  let detail = '';
  try {
    if (ready) await waitReady(page);
    await fn({ page, problems, context });
    const real = problems.filter((p) => !/requestfailed.*(favicon)/.test(p));
    assert.deepEqual(real, [], `errores de consola o de red: ${real.join(' | ')}`);
  } catch (error) {
    status = 'FALLÓ';
    detail = error.message;
    await page.screenshot({ path: path.join(here, `fallo-${results.length + 1}.png`) }).catch(() => {});
  } finally {
    await context.close();
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  results.push({ name, status, detail, secs: Number(secs) });
  console.log(`${status === 'ok' ? '✔' : '✖'} ${name} (${secs}s)${detail ? `\n    ${detail}` : ''}`);
}

const browser = await launch();
// Prueba larga (60 s reales) en paralelo con el resto, en su propio navegador.
const longBrowser = await launch();
const longRun = test('Temporizador real: 60 s, avisos 20/10 s, cierre automático y devolución con datos', async ({ page }) => {
  await page.evaluate(() => {
    window.__warnings = [];
    window.pitchLab.session.on('warning', (e) => window.__warnings.push({ level: e.level, rem: e.view.remainingSec }));
  });
  await openAndStartSession(page, { scenario: 'sala', voice: true });
  await click3D(page, 'begin');
  await waitState(page, 'presenting');
  const t0 = Date.now();
  const phrases = [[2, words(18, 'hola')], [22, words(18, 'idea')], [42, words(18, 'cierre')]];
  for (const [at, text] of phrases) {
    await wait(Math.max(0, at * 1000 - (Date.now() - t0)));
    assert.ok(await page.evaluate((t) => window.__speech.say(t), text), 'el mock debería estar escuchando');
  }
  // El reloj del escenario muestra cuenta regresiva
  const mid = await clock(page);
  assert.equal(mid.mode, 'timer');
  await waitState(page, 'review', 25000);
  const elapsed = (Date.now() - t0) / 1000;
  assert.ok(elapsed > 59 && elapsed < 64, `cierre automático a los ${elapsed.toFixed(1)} s`);
  const warnings = await page.evaluate(() => window.__warnings);
  assert.deepEqual(warnings.map((w) => w.level), ['warning', 'final'], JSON.stringify(warnings));
  assert.ok(warnings[0].rem <= 20 && warnings[0].rem >= 19, `aviso 1 en ${warnings[0].rem}`);
  assert.ok(warnings[1].rem <= 10 && warnings[1].rem >= 9, `aviso 2 en ${warnings[1].rem}`);
  await dispatch(page, 'CONTINUE');
  const fb = await page.evaluate(() => window.pitchLab.session.getFeedback());
  assert.equal(fb.metrics.duration.value, 60);
  assert.equal(fb.metrics.words.value, 54);
  assert.equal(fb.indicator.available, true, 'con 54 palabras y 60 s hay datos suficientes');
  assert.ok(Number.isInteger(fb.indicator.value) && fb.indicator.value >= 0 && fb.indicator.value <= 100);
  assert.equal(fb.metrics.wpm.value, 54);
  assert.ok(fb.indicator.formula.includes('Indicador ='));
  assert.equal(await page.evaluate(() => window.pitchLab.session.hasTicker), false, 'no queda temporizador activo');
}, { browser: longBrowser, opts: { init: MOCK_SPEECH_OK } });

// ---------------------------------------------------------------------------
await test('1. Carga inicial: sin errores, fuentes locales y recursos del mismo origen', async ({ page }) => {
  assert.equal(await state(page), 'home');
  assert.ok(await page.evaluate(() => document.fonts.check('48px Anton') && document.fonts.check('700 20px Barlow')));
  assert.ok(await page.evaluate(() => !!document.querySelector('a-scene canvas')));
  assert.match(await page.title(), /Pitch Lab/);
  const external = await page.evaluate(() => performance.getEntriesByType('resource')
    .map((r) => new URL(r.name).host).filter((h) => h !== location.host));
  assert.deepEqual(external, [], 'no debe cargar recursos de otros orígenes');
  const status = await page.evaluate(() => document.getElementById('status-line').textContent);
  assert.match(status, /INICIO/);
}, { browser });

await test('2. Acceso a los tres escenarios y sus espacios', async ({ page }) => {
  await dispatch(page, 'START'); await dispatch(page, 'SKIP');
  assert.equal(await page.evaluate(() => window.pitchLab.stage.key), 'hub');
  assert.equal(await page.evaluate(() => window.pitchLab.stage.env.maquettes.length), 3);
  const expected = { sala: [3, 3], cliente: [5, 5], auditorio: [26, 80] };
  for (const [id, [min, max]] of Object.entries(expected)) {
    await dispatch(page, 'PICK_SCENARIO', { id });
    await dispatch(page, 'ENTER');
    assert.equal(await page.evaluate(() => window.pitchLab.stage.key), id);
    assert.ok(await page.evaluate((i) => !!document.getElementById(`env-${i}`), id));
    const n = await page.evaluate(() => window.pitchLab.stage.env.audience.count);
    assert.ok(n >= min && n <= max, `${id}: ${n} personas`);
    const ids = await page.evaluate(() => window.pitchLab.hub.model.lectern.actions.map((a) => a.id));
    assert.ok(ids.includes('prepare'));
    await dispatch(page, 'CHANGE_SCENARIO');
  }
}, { browser });

await test('3. Tutorial con clics 3D reales y navegación con teclado dentro de los límites', async ({ page }) => {
  await click3D(page, 'start');
  await waitState(page, 'tutorial');
  await click3D(page, 'next'); await click3D(page, 'next');
  assert.equal(await page.evaluate(() => window.pitchLab.session.data.tutorialStep), 2);
  await click3D(page, 'next');
  await waitState(page, 'select');
  assert.equal(await page.evaluate(() => window.pitchLab.session.data.tutorialSeen), true);

  // Caminar: no se puede atravesar el atril ni salir de la zona
  const pos = () => page.evaluate(() => { const p = document.getElementById('rig').object3D.position; return { x: p.x, z: p.z }; });
  await resetView(page);
  const start = await pos();
  await page.keyboard.down('w'); await wait(2500); await page.keyboard.up('w');
  const forward = await pos();
  assert.ok(forward.z < start.z - 0.3, `avanzó ${start.z} -> ${forward.z}`);
  assert.ok(forward.z >= 0.45, `no debe atravesar el atril (z=${forward.z})`);
  await page.keyboard.down('a'); await wait(2500); await page.keyboard.up('a');
  const left = await pos();
  assert.ok(left.x >= -1.65, `no debe salir de la zona (x=${left.x})`);
  await page.keyboard.down('s'); await wait(3500); await page.keyboard.up('s');
  const back = await pos();
  assert.ok(back.z <= 2.45, `límite trasero (z=${back.z})`);
  const yaw0 = await page.evaluate(() => document.getElementById('rig').object3D.rotation.y);
  await page.keyboard.down('q'); await wait(500); await page.keyboard.up('q');
  assert.notEqual(await page.evaluate(() => document.getElementById('rig').object3D.rotation.y), yaw0);
  await page.keyboard.press('r'); await wait(200);
  const home = await pos();
  assert.ok(Math.abs(home.x) < 0.01 && Math.abs(home.z - 1.4) < 0.01, 'R recentra en el punto inicial');
}, { browser, opts: { permissions: [] } });

await test('3b. Elegir escenario tocando la maqueta 3D y la opción del panel', async ({ page }) => {
  await dispatch(page, 'START'); await dispatch(page, 'SKIP');
  await resetView(page);
  const pt = await page.evaluate(() => {
    const m = window.pitchLab.stage.env.maquettes.find((x) => x.sc.id === 'auditorio');
    const v = new AFRAME.THREE.Vector3();
    m.hitEl.object3D.getWorldPosition(v);
    v.y += 0.3; // parte alta de la zona de impacto
    v.project(window.pitchLab.scene.camera);
    const r = window.pitchLab.scene.canvas.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, ok: Math.abs(v.x) < 0.97 && Math.abs(v.y) < 0.97 };
  });
  assert.ok(pt.ok, 'la maqueta del auditorio debe estar a la vista');
  await page.mouse.move(pt.x - 8, pt.y); await page.mouse.move(pt.x, pt.y, { steps: 3 }); await wait(200);
  await page.mouse.click(pt.x, pt.y); await wait(200);
  assert.equal(await page.evaluate(() => window.pitchLab.session.data.scenarioId), 'auditorio');
  await click3D(page, 'pick-sala');
  assert.equal(await page.evaluate(() => window.pitchLab.session.data.scenarioId), 'sala');
  await click3D(page, 'enter');
  await waitState(page, 'brief');
  assert.equal(await page.evaluate(() => window.pitchLab.stage.key), 'sala');
}, { browser });

await test('4. Sesión sin voz: inicio, pausa, continuación y finalización con tiempo exacto', async ({ page }) => {
  await openAndStartSession(page, { scenario: 'sala' });
  await resetView(page);
  await click3D(page, 'begin');
  await waitState(page, 'presenting');
  await wait(2600);
  await click3D(page, 'pause');
  await waitState(page, 'paused');
  const atPause = await page.evaluate(() => window.pitchLab.session.getActiveMs());
  await wait(2200);
  const afterWait = await page.evaluate(() => window.pitchLab.session.getActiveMs());
  assert.ok(Math.abs(afterWait - atPause) < 30, 'en pausa el tiempo no corre');
  await click3D(page, 'resume');
  await waitState(page, 'presenting');
  await wait(1000);
  await click3D(page, 'finish');
  await waitState(page, 'feedback');
  const fb = await page.evaluate(() => window.pitchLab.session.getFeedback());
  // 2,6 s + 1 s de uso real (+ la latencia de los clics). Las pausas (2,2 s) NO deben contar: el total sería > 9 s.
  assert.ok(fb.metrics.duration.value >= 3 && fb.metrics.duration.value <= 8, `duración efectiva ${fb.metrics.duration.value}`);
  assert.equal(fb.banners[0].label, 'SIN VOZ');
  assert.equal(fb.indicator.available, false);
  assert.equal(fb.indicator.label, 'Sin datos suficientes');
  // Autoevaluación con clics 3D
  await click3D(page, 'tab-1');
  await click3D(page, 'rubric-problem');
  await click3D(page, 'rubric-idea'); await click3D(page, 'rubric-idea');
  const rubric = await page.evaluate(() => window.pitchLab.session.data.rubric);
  assert.equal(rubric.problem, 'yes');
  assert.equal(rubric.idea, 'partial');
  assert.equal(await page.evaluate(() => window.pitchLab.session.getFeedback().rubricSummary.answered), 2);
}, { browser });

await test('4b. Finalizar pide mantener presionado: un clic corto no termina y avisa en el atril; mantener sí; la tecla F lo hace al instante', async ({ page }) => {
  await openAndStartSession(page, { scenario: 'sala' });
  await resetView(page);
  await click3D(page, 'begin'); await waitState(page, 'presenting');
  await wait(700);
  // Clic corto sobre «Finalizar»: no pasa nada grave y se explica cómo hacerlo
  const p = await actionPoint(page, 'finish');
  assert.ok(p && p.hold, '«Finalizar» es un botón de mantener presionado');
  await page.mouse.move(p.x - 10, p.y - 4); await page.mouse.move(p.x, p.y, { steps: 3 }); await wait(200);
  await page.mouse.click(p.x, p.y); await wait(350);
  assert.equal(await state(page), 'presenting', 'un clic corto no termina la presentación');
  const flash = await page.evaluate(() => window.pitchLab.stage.ui.flash);
  assert.match(flash?.text || '', /Mantené presionado/, 'el aviso se ve dentro del espacio 3D (en el atril)');
  // Soltar antes de tiempo a mitad de camino tampoco termina
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await wait(250); await page.mouse.up(); await wait(250);
  assert.equal(await state(page), 'presenting');
  // Mantener el tiempo completo sí
  await click3D(page, 'finish');
  await waitState(page, 'feedback');
  // La tecla F (y el panel de texto) no piden mantener: no hay riesgo de gatillo accidental
  await dispatch(page, 'RETRY'); await dispatch(page, 'BEGIN'); await waitState(page, 'presenting');
  await page.keyboard.press('f');
  await waitState(page, 'feedback', 2000);
}, { browser });

await test('5. Cancelación con confirmación y reinicio sin estado residual', async ({ page }) => {
  await openAndStartSession(page, { scenario: 'cliente' });
  await resetView(page);
  await click3D(page, 'begin'); await waitState(page, 'presenting');
  await wait(1200);
  await click3D(page, 'cancel');
  await waitState(page, 'confirm-cancel');
  const frozen = await page.evaluate(() => window.pitchLab.session.getActiveMs());
  await wait(800);
  assert.ok(Math.abs((await page.evaluate(() => window.pitchLab.session.getActiveMs())) - frozen) < 30, 'se pausa mientras se confirma');
  await click3D(page, 'keep'); await waitState(page, 'presenting');
  await page.keyboard.press('Escape'); await waitState(page, 'confirm-cancel');
  await click3D(page, 'confirm-cancel');
  await waitState(page, 'brief');
  const s = await page.evaluate(() => ({
    ticker: window.pitchLab.session.hasTicker, ms: window.pitchLab.session.capture.activeMs,
    text: window.pitchLab.session.getTranscript().text, notice: window.pitchLab.session.data.notice?.text,
  }));
  assert.equal(s.ticker, false); assert.equal(s.ms, 0); assert.equal(s.text, '');
  assert.match(s.notice, /cancelada/);
  await wait(1500);
  assert.equal(await state(page), 'brief', 'ninguna sesión continúa después de cancelar');
  // Nueva sesión: arranca desde cero
  await dispatch(page, 'PREPARE'); await dispatch(page, 'SET_INPUT_MODE', { mode: 'timer' });
  await dispatch(page, 'BEGIN'); await waitState(page, 'presenting');
  assert.ok((await page.evaluate(() => window.pitchLab.session.getActiveMs())) < 800);
  await dispatch(page, 'FINISH');
}, { browser });

await test('6. Micrófono aceptado: transcripción revisable, edición con origen y liberación', async ({ page }) => {
  await openAndStartSession(page, { scenario: 'sala', voice: true });
  await resetView(page);
  const disclosure = await page.evaluate(() => window.pitchLab.hub.model.panel.blocks.find((b) => b.t === 'notice')?.text);
  assert.match(disclosure, /servicio externo/);
  assert.equal(await page.evaluate(() => window.__speech.starts), 0, 'no se pide el micrófono antes de la acción explícita');
  await click3D(page, 'begin');
  await waitState(page, 'presenting');
  assert.equal(await page.evaluate(() => window.__speech.starts), 1);
  await page.evaluate(() => window.__speech.say('probando el micrófono', false));
  await wait(400);
  assert.match(await page.evaluate(() => window.pitchLab.hub.model.lectern.hint), /probando/);
  await page.evaluate(() => window.__speech.say('hola equipo presentamos una idea', true));
  await wait(2500);
  await click3D(page, 'finish');
  await waitState(page, 'review');
  await wait(300);
  assert.equal(await page.evaluate(() => window.__speech.instances.every((i) => !i.running)), true, 'se liberó el reconocimiento');
  const box = await page.evaluate(() => ({ visible: !document.getElementById('transcript-box').hidden, value: document.getElementById('transcript-text').value, source: document.getElementById('transcript-source').textContent }));
  assert.equal(box.visible, true);
  assert.equal(box.value, 'hola equipo presentamos una idea');
  assert.match(box.source, /Reconocimiento de voz del navegador/);
  await page.fill('#transcript-text', 'hola equipo, presentamos una idea corregida a mano');
  // Se espera la condición (el origen pasa a «editado por vos» tras el retardo de 200 ms de la edición) en vez de un tiempo fijo:
  // con el render por software cada cuadro tarda y 450 ms a veces no alcanzaban.
  await page.waitForFunction(() => /editado por vos/.test(document.getElementById('transcript-source').textContent), null, { timeout: 8000 });
  assert.match(await page.evaluate(() => document.getElementById('transcript-source').textContent), /editado por vos/);
  await click3D(page, 'continue');
  await waitState(page, 'feedback');
  const fb = await page.evaluate(() => window.pitchLab.session.getFeedback());
  assert.equal(fb.banners[0].label, 'TEXTO EDITADO');
  assert.equal(fb.metrics.words.value, 8);
  await click3D(page, 'retry');
  await waitState(page, 'prep');
  assert.equal(await page.evaluate(() => window.pitchLab.session.getTranscript().text), '', 'el reintento no arrastra texto');
}, { browser, opts: { init: MOCK_SPEECH_OK } });

await test('7. Micrófono rechazado: recuperación sin reintentos automáticos', async ({ page }) => {
  await openAndStartSession(page, { scenario: 'sala', voice: true });
  await resetView(page);
  await click3D(page, 'begin');
  await waitState(page, 'voice-problem');
  assert.equal(await page.evaluate(() => window.pitchLab.session.data.voiceProblem.code), 'denied');
  await wait(1500);
  assert.equal(await page.evaluate(() => window.__speech.starts), 1, 'no vuelve a pedir el permiso solo');
  const title = await page.evaluate(() => window.pitchLab.hub.model.panel.title.join(' '));
  assert.match(title, /SIN ACCESO/);
  await click3D(page, 'timer-only');
  await waitState(page, 'presenting');
  assert.equal(await page.evaluate(() => window.pitchLab.session.data.options.inputMode), 'timer');
  await wait(1200);
  await dispatch(page, 'FINISH');
  await waitState(page, 'feedback');
  assert.equal(await page.evaluate(() => window.__speech.starts), 1);
}, { browser, opts: { init: MOCK_SPEECH_DENIED } });

await test('8. Reconocimiento de voz no disponible: la opción se deshabilita y se practica con temporizador', async ({ page }) => {
  assert.equal(await page.evaluate(() => window.pitchLab.caps.speech), false);
  await dispatch(page, 'START'); await dispatch(page, 'SKIP');
  await dispatch(page, 'PICK_SCENARIO', { id: 'sala' }); await dispatch(page, 'ENTER'); await dispatch(page, 'PREPARE');
  const opt = await page.evaluate(() => window.pitchLab.hub.model.panel.options.find((o) => o.id === 'mode-voice'));
  assert.equal(opt.disabled, true);
  assert.match(opt.label, /no disponible/);
  assert.equal(await page.evaluate(() => window.pitchLab.session.data.options.inputMode), 'timer');
  assert.equal(await dispatch(page, 'SET_INPUT_MODE', { mode: 'voice' }), false);
  await page.keyboard.press('t'); await wait(200);
  assert.equal(await page.evaluate(() => document.querySelector('#drawer [data-action-id="mode-voice"]').getAttribute('aria-disabled')), 'true');
  await click3D(page, 'begin'); // clic 3D sobre el botón principal
  await waitState(page, 'presenting');
  await dispatch(page, 'FINISH');
  await waitState(page, 'feedback');
}, { browser, opts: { init: MOCK_SPEECH_ABSENT } });

await test('9. Silencio o transcripción vacía, y texto de demostración rotulado', async ({ page }) => {
  await openAndStartSession(page, { scenario: 'sala', voice: true });
  await resetView(page);
  await click3D(page, 'begin'); await waitState(page, 'presenting');
  await wait(1500);
  await click3D(page, 'finish'); await waitState(page, 'review');
  const notice = await page.evaluate(() => window.pitchLab.hub.model.panel.blocks.find((b) => b.t === 'notice'));
  assert.equal(notice.label, 'NO SE RECONOCIÓ VOZ');
  assert.equal(await page.evaluate(() => document.getElementById('transcript-text').value), '');
  await click3D(page, 'load-demo');
  assert.equal(await page.evaluate(() => window.pitchLab.session.getTranscript().source), 'demo');
  assert.match(await page.evaluate(() => document.getElementById('transcript-source').textContent), /Demostración/);
  await click3D(page, 'continue'); await waitState(page, 'feedback');
  const fb = await page.evaluate(() => window.pitchLab.session.getFeedback());
  assert.equal(fb.banners[0].label, 'DEMOSTRACIÓN');
  assert.equal(fb.metrics.wpm.available, false);
  assert.equal(fb.indicator.available, false);
  assert.ok(fb.metrics.words.value > 40);
  // Continuar con la transcripción vacía también debe funcionar
  await click3D(page, 'retry'); await waitState(page, 'prep');
  await dispatch(page, 'BEGIN'); await waitState(page, 'presenting');
  await wait(800); await dispatch(page, 'FINISH'); await waitState(page, 'review');
  await click3D(page, 'continue'); await waitState(page, 'feedback');
  const empty = await page.evaluate(() => window.pitchLab.session.getFeedback());
  assert.equal(empty.metrics.words.available, false);
  assert.equal(empty.indicator.label, 'Sin datos suficientes');
}, { browser, opts: { init: MOCK_SPEECH_OK } });

await test('10. Reintento y cambio de escenario desde la devolución', async ({ page }) => {
  await openAndStartSession(page, { scenario: 'sala' });
  await dispatch(page, 'BEGIN'); await wait(900); await dispatch(page, 'FINISH'); await waitState(page, 'feedback');
  await resetView(page);
  await click3D(page, 'retry'); await waitState(page, 'prep');
  assert.equal(await page.evaluate(() => window.pitchLab.stage.key), 'sala');
  await dispatch(page, 'BEGIN'); await wait(700); await dispatch(page, 'FINISH'); await waitState(page, 'feedback');
  await resetView(page);
  await click3D(page, 'change-scenario'); await waitState(page, 'select');
  assert.equal(await page.evaluate(() => window.pitchLab.stage.key), 'hub');
  await click3D(page, 'pick-auditorio'); await click3D(page, 'enter');
  await waitState(page, 'brief');
  assert.equal(await page.evaluate(() => window.pitchLab.stage.key), 'auditorio');
  assert.equal(await page.evaluate(() => window.pitchLab.session.getTimeView().totalSec), 120);
}, { browser });

await test('11. Teletransporte, recentrado y límites en el auditorio', async ({ page }) => {
  await openAndStartSession(page, { scenario: 'auditorio' });
  await resetView(page);
  const rig = () => page.evaluate(() => { const p = document.getElementById('rig').object3D.position; return { x: p.x, y: p.y, z: p.z }; });
  // Apuntar a la marca del público con el mouse
  const pad = await page.evaluate(() => {
    const tp = window.pitchLab.stage.pads.find((p) => p.pad.id === 'publico');
    const v = new AFRAME.THREE.Vector3(); tp.hitEl.object3D.getWorldPosition(v);
    v.project(window.pitchLab.scene.camera);
    const r = window.pitchLab.scene.canvas.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, inView: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1 };
  });
  if (pad.inView) {
    await page.mouse.move(pad.x - 6, pad.y); await page.mouse.move(pad.x, pad.y, { steps: 2 }); await wait(200);
    await page.mouse.click(pad.x, pad.y); await wait(250);
  } else {
    await page.evaluate(() => window.pitchLab.walk.teleportTo('publico'));
  }
  let p = await rig();
  assert.ok(p.z < -12 && p.y > 0, `en la grada: ${JSON.stringify(p)}`);
  await page.keyboard.press('r'); await wait(250);
  p = await rig();
  assert.ok(Math.abs(p.z - 1.4) < 0.01 && Math.abs(p.y) < 0.01, `vuelve al atril: ${JSON.stringify(p)}`);
  // Camino hacia el borde del escenario: no se cae
  await page.keyboard.down('w'); await wait(5000); await page.keyboard.up('w');
  p = await rig();
  assert.ok(p.z >= 0.45, `el atril bloquea el paso (z=${p.z})`);
  await page.keyboard.down('d'); await wait(6000); await page.keyboard.up('d');
  p = await rig();
  assert.ok(p.x <= 5.21, `no sale del escenario (x=${p.x})`);
}, { browser });

await test('12. Modo sentado, movimiento reducido, volumen y persistencia de preferencias', async ({ page }) => {
  await dispatch(page, 'OPEN_SETTINGS');
  await waitState(page, 'settings');
  await resetView(page);
  const v0 = await page.evaluate(() => window.pitchLab.settings.get('volume'));
  await click3D(page, 'vol-down');
  assert.ok((await page.evaluate(() => window.pitchLab.settings.get('volume'))) < v0);
  await click3D(page, 'motion');
  assert.equal(await page.evaluate(() => window.pitchLab.settings.get('reducedMotion')), true);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('reduce-motion')), true);
  await click3D(page, 'seated');
  assert.equal(await page.evaluate(() => window.pitchLab.settings.get('seated')), true);
  // Opciones de comodidad en VR (también están en el menú 3D: dentro del casco no hay panel de texto)
  assert.equal(await page.evaluate(() => window.pitchLab.settings.get('snapTurnDeg')), 30, 'giro de 30° de entrada');
  await click3D(page, 'snap');
  assert.equal(await page.evaluate(() => window.pitchLab.settings.get('snapTurnDeg')), 45);
  await click3D(page, 'haptics');
  assert.equal(await page.evaluate(() => window.pitchLab.settings.get('haptics')), false);
  await click3D(page, 'height-up'); await click3D(page, 'height-up');
  assert.equal(await page.evaluate(() => window.pitchLab.settings.get('heightCm')), 10);
  await click3D(page, 'height-down');
  assert.equal(await page.evaluate(() => window.pitchLab.settings.get('heightCm')), 5);
  const snapLabel = await page.evaluate(() => window.pitchLab.hub.model.panel.options.find((o) => o.id === 'snap').label);
  assert.match(snapLabel, /45°/, 'el botón muestra el valor actual');
  await click3D(page, 'close');
  await waitState(page, 'home');
  // Con movimiento reducido las maquetas no giran
  const rot = await page.evaluate(() => { const m = window.pitchLab.stage.env.maquettes[0]; m.update(1, true); const a = m.holder.rotation.y; m.update(9, true); return [a, m.holder.rotation.y]; });
  assert.equal(rot[0], rot[1]);
  // Persistencia
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('publiton-pitch-lab.preferencias.v1')));
  assert.equal(saved.seated, true);
  assert.equal(saved.snapTurnDeg, 45);
  assert.equal(saved.haptics, false);
  assert.equal(saved.heightCm, 5);
  assert.ok(!JSON.stringify(saved).match(/transcri|audio/i), 'solo se guardan preferencias');
  await page.reload();
  await waitReady(page);
  assert.equal(await page.evaluate(() => window.pitchLab.settings.get('seated')), true);
  assert.equal(await page.evaluate(() => window.pitchLab.settings.get('snapTurnDeg')), 45, 'las opciones nuevas también se recuerdan');
  assert.equal(await page.evaluate(() => window.pitchLab.settings.get('heightCm')), 5);
  // El panel de texto las refleja y las cambia
  await page.keyboard.press('t'); await wait(250);
  await page.click('#prefs summary');
  assert.equal(await page.evaluate(() => document.getElementById('pref-snap').value), '45');
  assert.equal(await page.evaluate(() => document.getElementById('pref-haptics').checked), false);
  await page.selectOption('#pref-snap', '15');
  assert.equal(await page.evaluate(() => window.pitchLab.settings.get('snapTurnDeg')), 15);
  await page.check('#pref-haptics');
  assert.equal(await page.evaluate(() => window.pitchLab.settings.get('haptics')), true);
}, { browser, opts: { permissions: [] } });

await test('13. Panel de texto accesible: botones reales, foco visible, anuncios y modo solo teclado', async ({ page }) => {
  await page.keyboard.press('t'); await wait(250);
  assert.equal(await page.evaluate(() => document.getElementById('drawer').hidden), false);
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => !b.textContent.trim() && !b.getAttribute('aria-label')).length);
  assert.equal(unnamed, 0, 'todos los botones tienen nombre accesible');
  // Navegación solo con teclado hasta "Empezar" y activarlo con Enter
  await page.focus('#drawer-title');
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement?.dataset?.actionId === 'start')) break;
  }
  assert.equal(await page.evaluate(() => document.activeElement?.dataset?.actionId), 'start');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert.notEqual(outline, 'none', 'el foco es visible');
  await page.keyboard.press('Enter');
  await waitState(page, 'tutorial');
  assert.match(await page.evaluate(() => document.getElementById('live').textContent), /TUTORIAL/);
  // Completar el recorrido sin tocar el espacio 3D (solo botones HTML)
  const press = (id) => page.evaluate((i) => document.querySelector(`#drawer [data-action-id="${i}"]`).click(), id);
  await press('skip'); await waitState(page, 'select');
  await press('pick-sala'); await press('enter'); await waitState(page, 'brief');
  await press('prepare'); await press('mode-timer'); await press('begin'); await waitState(page, 'presenting');
  await wait(1000);
  await press('finish'); await waitState(page, 'feedback');
  await press('tab-2');
  assert.ok((await page.evaluate(() => document.getElementById('drawer-body').textContent)).includes('Requiere revisión humana'));
}, { browser, opts: { permissions: [] } });

await test('13b. Atajos de teclado: Enter (acción principal), P (pausa), F (finalizar), Esc (cancelar)', async ({ page }) => {
  await page.keyboard.press('Enter'); await waitState(page, 'tutorial');
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await waitState(page, 'select');
  await dispatch(page, 'PICK_SCENARIO', { id: 'sala' });
  await page.keyboard.press('Enter'); await waitState(page, 'brief');
  await page.keyboard.press('Enter'); await waitState(page, 'prep');
  await dispatch(page, 'SET_INPUT_MODE', { mode: 'timer' });
  await page.keyboard.press('Enter'); await waitState(page, 'presenting');
  await page.keyboard.press('p'); await waitState(page, 'paused');
  await page.keyboard.press('p'); await waitState(page, 'presenting');
  await page.keyboard.press('Escape'); await waitState(page, 'confirm-cancel');
  await page.keyboard.press('Escape'); await waitState(page, 'presenting');
  await page.keyboard.press('f'); await waitState(page, 'feedback');
}, { browser, opts: { permissions: [] } });

await test('13c. Medición opcional de nivel de audio: permiso aparte, medición real y liberación de la pista', async ({ page }) => {
  await openAndStartSession(page, { scenario: 'sala', voice: true });
  await dispatch(page, 'TOGGLE_METER');
  assert.equal(await page.evaluate(() => window.pitchLab.session.data.options.measureAudio), true);
  await dispatch(page, 'BEGIN'); await waitState(page, 'presenting');
  await wait(4500);
  await dispatch(page, 'FINISH'); await waitState(page, 'review');
  await dispatch(page, 'CONTINUE'); await waitState(page, 'feedback');
  const { audio, durationSec } = await page.evaluate(() => { const m = window.pitchLab.session.getFeedback().metrics; return { audio: m.audio, durationSec: m.duration.value }; });
  assert.equal(audio.available, true, JSON.stringify(audio));
  // Los segundos activos del medidor deben coincidir con la duración que mide la propia sesión (con un margen de 1 s), en vez de
  // un tope fijo: con el render por software el reloj de la página se atrasa y un tope fijo daba falsos fallos.
  assert.ok(audio.activeSec > 3 && audio.activeSec <= durationSec + 1, `segundos activos ${audio.activeSec} (duración de la sesión: ${durationSec})`);
  assert.ok(audio.soundSec >= 0 && audio.soundSec <= audio.activeSec);
  const live = await page.evaluate(() => window.__tracks.filter((t) => t.readyState === 'live').length);
  assert.equal(live, 0, 'todas las pistas de audio se liberaron');
  assert.ok((await page.evaluate(() => window.__tracks.length)) >= 1, 'se pidió el micrófono para medir');
  // El texto de la devolución nombra la medición como nivel de audio, no como análisis de voz
  const rows = await page.evaluate(() => window.pitchLab.session.getFeedback().measurements.find((r) => r.id === 'audio'));
  assert.match(rows.source, /nivel de audio/);
}, { browser, opts: { init: `${MOCK_SPEECH_OK}
(() => { window.__tracks = []; const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => { const s = await gum(c); s.getTracks().forEach((t) => window.__tracks.push(t)); return s; }; })();` } });

await test('14. Pausa automática si la pestaña pasa a segundo plano', async ({ page }) => {
  await openAndStartSession(page, { scenario: 'sala' });
  await dispatch(page, 'BEGIN'); await waitState(page, 'presenting');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await waitState(page, 'paused');
  assert.match(await page.evaluate(() => window.pitchLab.session.data.notice.text), /segundo plano/);
}, { browser });

await test('15. Medición de recursos 3D por escenario (informativa, SwiftShader)', async ({ page }) => {
  const info = {};
  await dispatch(page, 'START'); await dispatch(page, 'SKIP');
  const snap = async (key, stageKey = key) => {
    // Con render por software el espacio nuevo puede tardar en dibujarse: se espera a que cambie el espacio y a que
    // se completen 3 cuadros antes de leer el renderizador (antes era una espera fija de 700 ms y a veces leía datos viejos).
    await page.waitForFunction((k) => window.pitchLab.stage.key === k, stageKey, { timeout: 20000 });
    const frame0 = await page.evaluate(() => window.pitchLab.scene.renderer.info.render.frame);
    await page.waitForFunction((f) => window.pitchLab.scene.renderer.info.render.frame >= f + 3, frame0, { timeout: 30000 });
    await wait(300);
    info[key] = await page.evaluate(() => { const r = window.pitchLab.scene.renderer.info; return { calls: r.render.calls, triangles: r.render.triangles, geometries: r.memory.geometries, textures: r.memory.textures }; });
  };
  await snap('hub');
  for (const id of ['sala', 'cliente', 'auditorio']) {
    await dispatch(page, 'PICK_SCENARIO', { id }); await dispatch(page, 'ENTER');
    await snap(id);
    await dispatch(page, 'CHANGE_SCENARIO');
  }
  await snap('hub-de-nuevo', 'hub');
  console.log('    recursos:', JSON.stringify(info));
  await fs.writeFile(path.join(here, 'recursos-3d.json'), JSON.stringify(info, null, 2));
  // Presupuesto de geometría (decidido el 2026-11-13 al mejorar los modelos): que un cambio visual futuro no lo infle sin que se note.
  // Son límites sobre lo que se dibuja, NO una medida de rendimiento en casco (que no se midió).
  for (const [k, v] of Object.entries(info)) {
    assert.ok(v.calls < 200, `${k}: ${v.calls} llamadas de dibujo (presupuesto: 200)`);
    assert.ok(v.triangles < 80000, `${k}: ${v.triangles} triángulos (presupuesto: 80 000)`);
  }
  // Al cambiar de espacio no deben acumularse geometrías (liberación de recursos)
  assert.ok(info['hub-de-nuevo'].geometries <= info.hub.geometries + 4, `geometrías ${info.hub.geometries} -> ${info['hub-de-nuevo'].geometries}`);
  assert.ok(info['hub-de-nuevo'].textures <= info.hub.textures + 2, `texturas ${info.hub.textures} -> ${info['hub-de-nuevo'].textures}`);
}, { browser });

await test('16. Rutas bajo /sitioPubliton/pitch-lab/ (simulación de GitHub Pages)', async ({ page, problems }) => {
  assert.equal(await state(page), 'home');
  const bad = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((n) => !n.includes('/sitioPubliton/')));
  assert.deepEqual(bad, [], 'todos los recursos salen de /sitioPubliton/');
  assert.ok(await page.evaluate(() => document.fonts.check('48px Anton')));
  const fonts = await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => /\.ttf$/.test(r.name)).map((r) => r.name));
  assert.ok(fonts.some((f) => f.endsWith('/sitioPubliton/assets/Anton-Regular.ttf')), fonts.join(','));
  assert.equal(problems.length, 0);
}, { browser, opts: { url: BASE_SUBPATH } });

await test('17. Sitio anterior sin regresiones', async ({ page }) => {
  const title = await page.title();
  // El equipo rediseñó el sitio (2026-11-12) y cambió el título: ya no dice «Hackeando el mensaje». Se exige solo la marca.
  assert.match(title, /^Publitón/);
  assert.match(await page.textContent('h1'), /HACKEÁ/);
  assert.equal(await page.evaluate(() => document.querySelectorAll('[data-reserve]').length), 2);
  await page.click('[data-reserve="creador"]');
  assert.equal(await page.evaluate(() => document.getElementById('reservation').open), true);
}, { browser, opts: { url: SITE_ROOT }, ready: false });

await longRun;
await browser.close();
await longBrowser.close();

const failed = results.filter((r) => r.status !== 'ok');
await fs.writeFile(path.join(here, 'ultimo-resultado.json'), JSON.stringify({
  fecha: new Date().toISOString(),
  navegador: 'Microsoft Edge (Playwright), headless, WebGL por software (SwiftShader)',
  resultados: results,
}, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} pruebas e2e correctas${failed.length ? ` — fallaron ${failed.length}` : ''}`);
process.exit(failed.length ? 1 : 0);
