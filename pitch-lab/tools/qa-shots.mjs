// Recorre los estados principales y guarda capturas reales de la experiencia.
// Uso: node tools/qa-shots.mjs <carpeta-salida> [width] [height]
// Las capturas salen del navegador en modo headless con WebGL por software (SwiftShader):
// sirven para revisar composición y legibilidad, NO para medir rendimiento.

import fs from 'node:fs/promises';
import path from 'node:path';
import { launch, openPage, waitReady } from './browser.mjs';
import { MOCK_SPEECH_OK } from '../tests/e2e/mocks.mjs';

const out = path.resolve(process.argv[2] || 'capturas');
const width = Number(process.argv[3] || 1280);
const height = Number(process.argv[4] || 720);
await fs.mkdir(out, { recursive: true });

const browser = await launch();
const { page, problems } = await openPage(browser, { width, height, init: MOCK_SPEECH_OK, permissions: ['microphone'] });
await waitReady(page);

const shot = async (name) => {
  await page.waitForTimeout(450);
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

await shot('01-home');
await dispatch('OPEN_HELP'); await shot('02-tutorial-1');
await dispatch('NEXT'); await shot('03-tutorial-2');
await dispatch('NEXT'); await shot('04-tutorial-3');
await dispatch('NEXT'); await dispatch('START'); await shot('05-select');
await dispatch('PICK_SCENARIO', { id: 'sala' }); await shot('06-select-sala');
await dispatch('ENTER'); await shot('07-sala-brief');
await dispatch('PREPARE'); await shot('08-sala-prep');
await dispatch('BEGIN'); await page.waitForTimeout(800); await shot('09-sala-presentando');
await view({ z: 1.4, pitch: -4 }); await shot('10-sala-audiencia');
await dispatch('PAUSE'); await shot('11-sala-pausa');
await dispatch('REQUEST_CANCEL'); await shot('12-sala-confirmar-cancelar');
await dispatch('KEEP'); await dispatch('RESUME');
await page.evaluate(() => window.__speech.say('hola equipo presentamos una idea para invitar a hacer una pausa real en la oficina'));
await page.waitForTimeout(1200);
await dispatch('FINISH'); await shot('13-sala-revision');
await dispatch('CONTINUE'); await shot('14-sala-devolucion-1');
await dispatch('SET_PAGE', { page: 1 }); await shot('15-sala-devolucion-2');
await dispatch('SET_PAGE', { page: 2 }); await shot('16-sala-devolucion-3');
await view({ z: 1.4, yaw: 180, pitch: 0 }); await shot('17-sala-pantalla-brief');
await view({ x: 2.0, z: 2.2, yaw: 40, pitch: -8 }); await shot('18-sala-panoramica');
// ---- Recorrido breve de los otros dos escenarios ----
for (const [id, tag] of [['cliente', '20-cliente'], ['auditorio', '30-auditorio']]) {
  await dispatch('CHANGE_SCENARIO');
  await dispatch('PICK_SCENARIO', { id });
  await dispatch('ENTER'); await shot(`${tag}-brief`);
  await dispatch('PREPARE'); await dispatch('BEGIN'); await page.waitForTimeout(800);
  await shot(`${tag}-presentando`);
  await view({ x: 1.6, z: 2.4, yaw: 35, pitch: -10 }); await shot(`${tag}-panoramica`);
  await view({ x: 0, z: 2.4, yaw: 180, pitch: 0 }); await shot(`${tag}-pantalla`);
  await view({ x: -2.5, z: 1.4, yaw: 0, pitch: 12 }); await shot(`${tag}-reloj`);
  await dispatch('FINISH'); await dispatch('CONTINUE');
}
await browser.close();
console.log('problemas:', problems.length ? problems : 'ninguno');
