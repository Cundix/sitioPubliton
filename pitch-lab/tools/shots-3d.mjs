// Capturas de los modelos 3D con cámaras FIJAS (para comparar antes y después de un cambio visual).
// Uso:  node tools/serve.mjs 8090   y después   PITCHLAB_URL=http://localhost:8090/pitch-lab/ node tools/shots-3d.mjs <carpeta> [prefijo]
// Muestra el espacio SIN paneles de interfaz encima (se oculta el panel flotante) para ver la geometría.
// Navegador de pruebas con WebGL por software: sirve para evaluar composición, no rendimiento.

import fs from 'node:fs/promises';
import path from 'node:path';
import { launch, openPage, waitReady } from './browser.mjs';

const out = path.resolve(process.argv[2] || 'capturas-3d');
const prefix = process.argv[3] || '';
await fs.mkdir(out, { recursive: true });

const browser = await launch();
const { page, problems } = await openPage(browser, { width: 1600, height: 900, permissions: [] });
await waitReady(page);

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
const hideUi = () => page.evaluate(() => {
  // Oculta el panel y el reloj/brief flotantes para ver el espacio; no toca la geometría de la sala.
  const ui = window.pitchLab.stage?.ui;
  if (ui) { ['panelEl', 'compactEl'].forEach((k) => { if (ui[k]) ui[k].object3D.visible = false; }); }
  document.getElementById('overlay').style.display = 'none';
});
const shot = async (name) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, `${prefix}${name}.png`) });
  console.log('captura', `${prefix}${name}`);
};

await hideUi();
// ---- Vestíbulo ----
await view({ x: 0, z: 1.4, yaw: 0, pitch: -4 }); await shot('hub-frente');

await dispatch('START'); await dispatch('SKIP');

// ---- Sala de ensayo ----
await dispatch('PICK_SCENARIO', { id: 'sala' }); await dispatch('ENTER'); await dispatch('PREPARE');
await dispatch('SET_INPUT_MODE', { mode: 'timer' }); await dispatch('BEGIN');
await page.waitForTimeout(800); await hideUi();
await view({ x: 0, z: 1.4, yaw: 0, pitch: -6 }); await shot('sala-1-frente');
await view({ x: -0.4, z: -0.9, yaw: 0, pitch: -10 }); await shot('sala-2-publico-cerca');
await view({ x: 2.2, z: 2.6, yaw: 38, pitch: -8 }); await shot('sala-3-general');
await view({ x: -2.0, z: 0.4, yaw: -62, pitch: -4 }); await shot('sala-4-lateral');
await view({ x: 0, z: 2.9, yaw: 180, pitch: 0 }); await shot('sala-5-pared-del-brief');
await dispatch('CANCEL').catch(() => {}); await dispatch('REQUEST_CANCEL'); await dispatch('CONFIRM');

// ---- Reunión con cliente ----
await dispatch('CHANGE_SCENARIO');
await dispatch('PICK_SCENARIO', { id: 'cliente' }); await dispatch('ENTER'); await dispatch('PREPARE');
await dispatch('SET_INPUT_MODE', { mode: 'timer' }); await dispatch('BEGIN');
await page.waitForTimeout(800); await hideUi();
await view({ x: 0, z: 1.4, yaw: 0, pitch: -8 }); await shot('cliente-1-frente');
await view({ x: -0.3, z: -0.7, yaw: 0, pitch: -14 }); await shot('cliente-2-mesa-cerca');
await view({ x: 3.0, z: 2.5, yaw: 38, pitch: -10 }); await shot('cliente-3-general');
await view({ x: 0, z: 2.8, yaw: 180, pitch: 0 }); await shot('cliente-4-pared-del-brief');
await dispatch('REQUEST_CANCEL'); await dispatch('CONFIRM');

// ---- Auditorio ----
await dispatch('CHANGE_SCENARIO');
await dispatch('PICK_SCENARIO', { id: 'auditorio' }); await dispatch('ENTER'); await dispatch('PREPARE');
await dispatch('SET_INPUT_MODE', { mode: 'timer' }); await dispatch('BEGIN');
await page.waitForTimeout(800); await hideUi();
await view({ x: 0, z: 1.4, yaw: 0, pitch: -3 }); await shot('auditorio-1-frente');
await view({ x: -3.0, z: -1.6, yaw: 18, pitch: -12 }); await shot('auditorio-2-platea-cerca');
await view({ x: 4.0, z: 3.0, yaw: 28, pitch: -8 }); await shot('auditorio-3-general');
await view({ x: 0, z: 3.2, yaw: 180, pitch: 4 }); await shot('auditorio-4-pantalla-y-escenario');
await page.evaluate(() => window.pitchLab.walk.teleportTo('publico'));
await page.waitForTimeout(500); await hideUi(); await shot('auditorio-5-desde-el-publico');

await browser.close();
console.log('problemas:', problems.length ? problems : 'ninguno');
