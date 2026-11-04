// Captura la devolución CON datos suficientes. Requiere una sesión real de 60 s (Sala de ensayo)
// porque el indicador exige al menos 20 s efectivos y 40 palabras.
// El texto sale de un MOCK de reconocimiento de voz (no es voz real): las capturas deben rotularse así.
// Uso: node tools/shots-datos.mjs <carpeta-salida>

import fs from 'node:fs/promises';
import path from 'node:path';
import { launch, openPage, waitReady } from './browser.mjs';
import { MOCK_SPEECH_OK } from '../tests/e2e/mocks.mjs';

const out = path.resolve(process.argv[2] || 'capturas');
await fs.mkdir(out, { recursive: true });
const browser = await launch();
const { page, problems } = await openPage(browser, { width: 1600, height: 900, init: MOCK_SPEECH_OK, permissions: ['microphone'] });
await waitReady(page);
const dispatch = (event, payload) => page.evaluate(([e, p]) => window.pitchLab.session.dispatch(e, p), [event, payload]);
const shot = async (name) => { await page.waitForTimeout(600); await page.screenshot({ path: path.join(out, `${name}.png`) }); console.log('captura', name); };

await dispatch('START'); await dispatch('SKIP');
await dispatch('PICK_SCENARIO', { id: 'sala' }); await dispatch('ENTER'); await dispatch('PREPARE');
await dispatch('BEGIN');
await page.waitForFunction(() => window.pitchLab.session.state === 'presenting');
const t0 = Date.now();
const frases = [
  [3, 'Buenas tardes, queremos contarles una idea para Yerbita Sol.'],
  [12, 'El problema es que en la oficina las pausas terminan frente al celular y nadie se levanta del escritorio.'],
  [26, 'Nuestra propuesta es una señal en el espacio de trabajo que invita a hacer cinco minutos de pausa real, sin pantallas.'],
  [40, 'El beneficio es volver a la tarea con la cabeza más despejada y con ganas de conversar con el equipo.'],
  [52, 'Les proponemos probarla una semana en una oficina piloto. Muchas gracias.'],
];
for (const [at, text] of frases) {
  await page.waitForTimeout(Math.max(0, at * 1000 - (Date.now() - t0)));
  await page.evaluate((t) => window.__speech.say(t), text);
}
await page.waitForFunction(() => window.pitchLab.session.state === 'review', null, { timeout: 30000 });
await dispatch('CONTINUE');
await shot('40-devolucion-con-datos-medidas');
await dispatch('SET_PAGE', { page: 2 });
await shot('41-devolucion-con-datos-consejos');
const fb = await page.evaluate(() => window.pitchLab.session.getFeedback());
console.log(JSON.stringify({ indicador: fb.indicator.value, wpm: fb.metrics.wpm.value, palabras: fb.metrics.words.value, duracion: fb.metrics.duration.value }));
await browser.close();
console.log('problemas:', problems.length ? problems : 'ninguno');
