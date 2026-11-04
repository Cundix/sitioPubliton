// Recorre los estados principales y guarda capturas reales de la experiencia.
// Uso: node tools/qa-shots.mjs <carpeta-salida> [ancho] [alto]
//
// Las capturas salen de Microsoft Edge en modo headless con WebGL por software (SwiftShader):
// sirven para revisar composición y legibilidad, NO para medir rendimiento ni representan un casco.
// Cuando aparece texto "reconocido", viene de un MOCK de reconocimiento de voz (no es voz real).

import fs from 'node:fs/promises';
import path from 'node:path';
import { launch, openPage, waitReady } from './browser.mjs';
import { MOCK_SPEECH_OK } from '../tests/e2e/mocks.mjs';

const out = path.resolve(process.argv[2] || 'capturas');
const width = Number(process.argv[3] || 1600);
const height = Number(process.argv[4] || 900);
await fs.mkdir(out, { recursive: true });

const browser = await launch();
const { page, problems } = await openPage(browser, { width, height, init: MOCK_SPEECH_OK, permissions: ['microphone'] });
await waitReady(page);

const shot = async (name) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log('captura', name);
};
const dispatch = (event, payload) => page.evaluate(([e, p]) => window.pitchLab.session.dispatch(e, p), [event, payload]);
const view = (opts) => page.evaluate(({ x = 0, y = 0, z = 1.4, yaw = 0, pitch = 0 }) => {
  const rig = document.getElementById('rig');
  const cam = document.getElementById('head');
  rig.object3D.position.set(x, y, z);
  rig.object3D.rotation.y = (yaw * Math.PI) / 180;
  const look = cam.components['look-controls'];
  look.pitchObject.rotation.x = (pitch * Math.PI) / 180;
  look.yawObject.rotation.y = 0;
}, opts);
const recenter = () => page.evaluate(() => {
  window.pitchLab.walk.recenter();
  const look = document.getElementById('head').components['look-controls'];
  look.pitchObject.rotation.x = 0;
  look.yawObject.rotation.y = 0;
});

// ---- Hub, tutorial y elección ----
await shot('01-inicio');
await dispatch('OPEN_HELP'); await shot('02-tutorial-1-moverse');
await dispatch('NEXT'); await shot('03-tutorial-2-botones');
await dispatch('NEXT'); await shot('04-tutorial-3-recorrido');
await dispatch('NEXT'); await dispatch('START'); await shot('05-elegir-escenario');
await dispatch('PICK_SCENARIO', { id: 'sala' }); await shot('06-escenario-elegido');

// ---- Sala de ensayo ----
await dispatch('ENTER'); await shot('07-sala-brief');
await dispatch('PREPARE'); await shot('08-sala-preparacion');
await dispatch('BEGIN'); await page.waitForTimeout(900); await shot('09-sala-presentando');
await dispatch('PAUSE'); await shot('10-sala-pausa');
await dispatch('REQUEST_CANCEL'); await shot('11-sala-confirmar-cancelar');
await dispatch('KEEP'); await dispatch('RESUME');
await page.evaluate(() => window.__speech.say('hola equipo presentamos una idea para invitar a hacer una pausa real en la oficina'));
await page.waitForTimeout(1500);
await dispatch('FINISH'); await shot('12-sala-revision-transcripcion');
await dispatch('CONTINUE'); await shot('13-sala-devolucion-medidas');
await dispatch('SET_PAGE', { page: 1 });
await dispatch('RUBRIC_CYCLE', { id: 'problem' }); await dispatch('RUBRIC_CYCLE', { id: 'idea' }); await dispatch('RUBRIC_CYCLE', { id: 'idea' });
await shot('14-sala-autoevaluacion');
await dispatch('SET_PAGE', { page: 2 }); await shot('15-sala-consejos');
await view({ z: 2.2, yaw: 180, pitch: 0 }); await shot('16-sala-pantalla-del-brief');
await view({ x: 2.0, z: 2.4, yaw: 40, pitch: -8 }); await shot('17-sala-vista-general');

// ---- Reunión con cliente y Auditorio ----
for (const [id, tag] of [['cliente', '20-cliente'], ['auditorio', '30-auditorio']]) {
  await dispatch('CHANGE_SCENARIO');
  await dispatch('PICK_SCENARIO', { id });
  await dispatch('ENTER'); await shot(`${tag}-brief`);
  await dispatch('PREPARE'); await dispatch('BEGIN'); await page.waitForTimeout(900);
  await shot(`${tag}-presentando`);
  await view({ x: 1.6, z: 2.4, yaw: 35, pitch: -10 }); await shot(`${tag}-vista-general`);
  await view({ x: 0, z: 2.6, yaw: 180, pitch: 0 }); await shot(`${tag}-pantalla`);
  if (id === 'auditorio') {
    await recenter();
    await page.evaluate(() => window.pitchLab.walk.teleportTo('publico'));
    await page.waitForTimeout(500);
    await shot('31-auditorio-desde-el-publico');
    await page.evaluate(() => window.pitchLab.walk.recenter());
  }
  await recenter();
  await dispatch('FINISH'); await dispatch('CONTINUE');
}
await browser.close();
console.log('problemas:', problems.length ? problems : 'ninguno');
