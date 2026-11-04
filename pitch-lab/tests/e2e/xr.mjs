// Prueba del modo inmersivo con un EMULADOR de WebXR (IWER, de Meta). NO es un casco físico.
// Verifica: detección de soporte, entrada y salida de la sesión inmersiva, y que un control
// emulado apuntando a un botón del atril y presionando el gatillo ejecuta la acción.
//
// Uso: node tests/e2e/xr.mjs   (con el servidor en http://localhost:8080)

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { launch, openPage, waitReady } from '../../tools/browser.mjs';
import { MOCK_SPEECH_OK } from './mocks.mjs';
import { wait, state, waitState, dispatch } from './helpers.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const iwerSource = await fs.readFile(require.resolve('iwer/build/iwer.min.js'), 'utf8');

const INSTALL = `${iwerSource}
;(() => {
  const { XRDevice, metaQuest3 } = window.IWER;
  const device = new XRDevice(metaQuest3);
  device.installRuntime({ forceInstall: true });
  window.__xr = device;
})();`;

const results = [];
async function step(name, fn) {
  try { await fn(); results.push({ name, status: 'ok' }); console.log(`✔ ${name}`); }
  catch (error) { results.push({ name, status: 'FALLÓ', detail: error.message }); console.log(`✖ ${name}\n    ${error.message}`); }
}

const browser = await launch();
const { page, problems, context } = await openPage(browser, { init: `${INSTALL}\n${MOCK_SPEECH_OK}`, permissions: ['microphone'] });
await waitReady(page);

await step('X1. Se detecta el modo inmersivo y aparece el botón "Entrar en VR"', async () => {
  assert.equal(await page.evaluate(() => window.pitchLab.xr.supported), true);
  assert.equal(await page.evaluate(() => document.getElementById('btn-vr').hidden), false);
  assert.equal(await page.evaluate(() => document.getElementById('xr-note').hidden), true);
});

await step('X2. Entrar en VR desde el botón: sesión inmersiva activa y vista de casco', async () => {
  await page.click('#btn-vr');
  await page.waitForFunction(() => window.pitchLab.scene.is('vr-mode'), null, { timeout: 8000 });
  assert.equal(await page.evaluate(() => window.pitchLab.xr.active), true);
  assert.equal(await page.evaluate(() => document.body.classList.contains('in-vr')), true);
  assert.equal(await page.evaluate(() => !!window.pitchLab.scene.renderer.xr.isPresenting), true);
  // En VR el atril ofrece "Salir de VR" dentro de la escena
  await wait(400);
  const label = await page.evaluate(() => [...window.pitchLab.stage.ui.lecternPool.buttons.values()].map((b) => b.action?.label));
  assert.ok(label.includes('Salir de VR'), JSON.stringify(label));
  assert.equal(await page.evaluate(() => window.pitchLab.walk.isVR()), true);
});

await step('X3. Los controles aparecen con raycaster y cursor sobre los elementos interactivos', async () => {
  const info = await page.evaluate(() => ['hand-left', 'hand-right'].map((id) => {
    const el = document.getElementById(id);
    return { id, raycaster: el.getAttribute('raycaster')?.objects, cursor: !!el.components.cursor, ray: !!el.components['xr-ray'], visible: el.object3D.visible };
  }));
  for (const c of info) { assert.equal(c.ray, true); assert.equal(c.raycaster, '.ui'); assert.equal(c.cursor, true, `${c.id} sin cursor`); }
  assert.equal(info[1].visible, true, 'el rayo de la mano derecha se muestra al haber un control');
});

await step('X4. Un control emulado apunta al botón del atril y el gatillo lo activa', async () => {
  await wait(600);
  // Posición del botón "Empezar" en coordenadas de la plataforma (el espacio XR cuelga de ella)
  const aim = await page.evaluate(() => {
    const T = AFRAME.THREE;
    const btn = [...window.pitchLab.stage.ui.lecternPool.buttons.values()].find((b) => b.action?.id === 'start');
    const target = new T.Vector3(); btn.el.object3D.getWorldPosition(target);
    const rig = document.getElementById('rig').object3D;
    rig.updateMatrixWorld(true);
    const local = rig.worldToLocal(target.clone());
    const origin = new T.Vector3(0.25, 1.15, -0.15);
    const dir = local.clone().sub(origin).normalize();
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, -1), dir);
    return { origin: origin.toArray(), q: [q.x, q.y, q.z, q.w] };
  });
  await page.evaluate(({ origin, q }) => {
    const c = window.__xr.controllers.right;
    c.position.set(...origin);
    c.quaternion.set(...q);
  }, aim);
  await wait(900); // el raycaster refresca cada ~100 ms
  const hovering = await page.evaluate(() => {
    const el = document.getElementById('hand-right');
    return el.components.raycaster.intersectedEls.length;
  });
  assert.ok(hovering > 0, 'el rayo del control debería tocar un botón');
  assert.equal(await state(page), 'home');
  await page.evaluate(() => window.__xr.controllers.right.updateButtonValue('trigger', 1));
  await wait(250);
  await page.evaluate(() => window.__xr.controllers.right.updateButtonValue('trigger', 0));
  await waitState(page, 'tutorial', 4000);
});

await step('X5. Control emulado: "Ver desde el público" teletransporta a la grada y "Recentrar" vuelve', async () => {
  await dispatch(page, 'SKIP');
  await dispatch(page, 'PICK_SCENARIO', { id: 'auditorio' });
  await dispatch(page, 'ENTER');
  await wait(700);
  const pointAt = async (actionId) => {
    const aim = await page.evaluate((id) => {
      const T = AFRAME.THREE;
      const btn = [...window.pitchLab.stage.ui.lecternPool.buttons.values()].find((b) => b.action?.id === id);
      const target = new T.Vector3(); btn.el.object3D.getWorldPosition(target);
      const rig = document.getElementById('rig').object3D; rig.updateMatrixWorld(true);
      const local = rig.worldToLocal(target.clone());
      const origin = new T.Vector3(0.25, 1.15, -0.15);
      const dir = local.clone().sub(origin).normalize();
      const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, -1), dir);
      return { origin: origin.toArray(), q: [q.x, q.y, q.z, q.w] };
    }, actionId);
    await page.evaluate(({ origin, q }) => { const c = window.__xr.controllers.right; c.position.set(...origin); c.quaternion.set(...q); }, aim);
    await wait(900);
    await page.evaluate(() => window.__xr.controllers.right.updateButtonValue('trigger', 1));
    await wait(250);
    await page.evaluate(() => window.__xr.controllers.right.updateButtonValue('trigger', 0));
    await wait(500);
  };
  await pointAt('u-view');
  const rig = await page.evaluate(() => { const p = document.getElementById('rig').object3D.position; return { y: p.y, z: p.z }; });
  assert.ok(rig.z < -12 && rig.y > 0, `la persona debería estar en la grada: ${JSON.stringify(rig)}`);
  assert.equal(await page.evaluate(() => window.pitchLab.walk.zone.id), 'publico');
  // Desde la grada, el botón flotante "Volver al atril" también se puede usar con el rayo (recentrar)
  await page.evaluate(() => window.pitchLab.walk.recenter());
  const back = await page.evaluate(() => document.getElementById('rig').object3D.position.z);
  assert.ok(Math.abs(back - 1.4) < 0.05, `recentrar devuelve al atril (z=${back})`);
});

await step('X6. Modo sentado eleva la vista solo en VR', async () => {
  const y0 = await page.evaluate(() => document.getElementById('rig').object3D.position.y);
  await page.evaluate(() => window.pitchLab.settings.set('seated', true));
  const y1 = await page.evaluate(() => document.getElementById('rig').object3D.position.y);
  assert.ok(Math.abs(y1 - y0 - 0.45) < 0.01, `${y0} -> ${y1}`);
  await page.evaluate(() => window.pitchLab.settings.set('seated', false));
});

await step('X7. Salir de VR: la sesión termina y vuelve la interfaz de escritorio', async () => {
  await page.evaluate(() => window.pitchLab.scene.exitVR());
  await page.waitForFunction(() => !window.pitchLab.scene.is('vr-mode'), null, { timeout: 8000 });
  assert.equal(await page.evaluate(() => window.pitchLab.xr.active), false);
  assert.equal(await page.evaluate(() => document.body.classList.contains('in-vr')), false);
  assert.equal(await page.evaluate(() => document.getElementById('btn-vr').textContent), 'Entrar en VR');
});

const fatal = problems.filter((p) => !/favicon/.test(p));
await step('X8. Sin errores de consola durante la sesión inmersiva emulada', async () => { assert.deepEqual(fatal, []); });

await context.close();
await browser.close();
await fs.writeFile(path.join(here, 'ultimo-resultado-xr.json'), JSON.stringify({
  fecha: new Date().toISOString(),
  nota: 'Emulación con IWER (Meta Quest 3 simulado). No reemplaza una prueba en casco físico.',
  resultados: results,
}, null, 2));
const failed = results.filter((r) => r.status !== 'ok');
console.log(`\n${results.length - failed.length}/${results.length} pruebas XR (emulador) correctas`);
process.exit(failed.length ? 1 : 0);
