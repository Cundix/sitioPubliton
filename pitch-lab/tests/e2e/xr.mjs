// Prueba del modo inmersivo con un EMULADOR de WebXR (IWER, de Meta). NO es un casco físico.
// Verifica: detección de soporte, entrada y salida de la sesión inmersiva, que un control emulado apuntando a un
// botón del atril y presionando el gatillo ejecuta la acción, y las opciones de comodidad que pide la guía
// «UX for XR» (giro por tramos con el joystick, vibración de los controles, uso con una sola mano, altura de la
// vista y «mantené presionado» para terminar la presentación).
//
// Uso: node tests/e2e/xr.mjs   (con el servidor en PITCHLAB_URL, por defecto http://localhost:8080/pitch-lab/)

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { launch, openPage, waitReady } from '../../tools/browser.mjs';
import { MOCK_SPEECH_OK } from './mocks.mjs';
import { wait, state, waitState, dispatch, HOLD_WAIT_MS } from './helpers.mjs';

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

// ---------- Ayudantes del control emulado ----------

/** Apunta el control `hand` ('left' | 'right') al botón 3D con ese id y espera a que el rayo lo toque. */
async function aimController(hand, actionId) {
  const pose = await page.evaluate(({ hand: h, id }) => {
    const T = AFRAME.THREE;
    const ui = window.pitchLab.stage.ui;
    const btn = [ui.lecternPool, ui.panelPool].filter(Boolean).flatMap((p) => [...p.buttons.values()]).find((b) => b.action?.id === id);
    if (!btn) return null;
    const target = new T.Vector3(); btn.el.object3D.getWorldPosition(target);
    const rig = document.getElementById('rig').object3D; rig.updateMatrixWorld(true);
    const local = rig.worldToLocal(target.clone());
    const origin = new T.Vector3(h === 'right' ? 0.25 : -0.25, 1.15, -0.15);
    const dir = local.clone().sub(origin).normalize();
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, -1), dir);
    return { origin: origin.toArray(), q: [q.x, q.y, q.z, q.w] };
  }, { hand, id: actionId });
  assert.ok(pose, `no existe el botón 3D "${actionId}"`);
  await page.evaluate(({ hand: h, origin, q }) => {
    const c = window.__xr.controllers[h];
    c.position.set(...origin);
    c.quaternion.set(...q);
  }, { hand, ...pose });
  await wait(900); // el raycaster refresca cada ~100 ms
}

/** Apunta el control hacia arriba, lejos de todo lo interactivo. */
async function aimAway(hand) {
  await page.evaluate((h) => {
    const c = window.__xr.controllers[h];
    c.position.set(0.25, 1.15, -0.15);
    c.quaternion.set(-0.7071, 0, 0, 0.7071); // mira hacia el techo
  }, hand);
  await wait(500);
}

async function trigger(hand, holdMs = 250) {
  await page.evaluate((h) => window.__xr.controllers[h].updateButtonValue('trigger', 1), hand);
  await wait(holdMs);
  await page.evaluate((h) => window.__xr.controllers[h].updateButtonValue('trigger', 0), hand);
  await wait(300);
}

async function pointAndPress(hand, actionId) {
  await aimController(hand, actionId);
  await trigger(hand);
  await wait(250);
}

const rigYaw = () => page.evaluate(() => document.getElementById('rig').object3D.rotation.y);
const rigY = () => page.evaluate(() => document.getElementById('rig').object3D.position.y);
const headXZ = () => page.evaluate(() => { const v = new AFRAME.THREE.Vector3(); window.pitchLab.scene.camera.getWorldPosition(v); return { x: v.x, z: v.z }; });
const angleDiff = (a, b) => { const d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); };
const DEG = Math.PI / 180;

async function installPulseSpy() {
  await page.evaluate(() => {
    window.__pulses = window.__pulses || [];
    const session = window.pitchLab.scene.renderer.xr.getSession();
    for (const source of session.inputSources) {
      const actuator = source.gamepad?.hapticActuators?.[0];
      if (!actuator || actuator.__spied) continue;
      const original = actuator.pulse.bind(actuator);
      actuator.pulse = (value, duration) => { window.__pulses.push({ hand: source.handedness, value, duration }); return original(value, duration); };
      actuator.__spied = true;
    }
  });
}
const pulses = () => page.evaluate(() => window.__pulses || []);

// ---------- Pasos ----------

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
  await aimController('right', 'start');
  const hovering = await page.evaluate(() => document.getElementById('hand-right').components.raycaster.intersectedEls.length);
  assert.ok(hovering > 0, 'el rayo del control debería tocar un botón');
  assert.equal(await state(page), 'home');
  await trigger('right');
  await waitState(page, 'tutorial', 4000);
});

await step('X5. Control emulado: "Ver desde el público" teletransporta a la grada y "Recentrar" vuelve', async () => {
  await dispatch(page, 'SKIP');
  await dispatch(page, 'PICK_SCENARIO', { id: 'auditorio' });
  await dispatch(page, 'ENTER');
  await wait(700);
  await pointAndPress('right', 'u-view');
  const rig = await page.evaluate(() => { const p = document.getElementById('rig').object3D.position; return { y: p.y, z: p.z }; });
  assert.ok(rig.z < -12 && rig.y > 0, `la persona debería estar en la grada: ${JSON.stringify(rig)}`);
  assert.equal(await page.evaluate(() => window.pitchLab.walk.zone.id), 'publico');
  // Desde la grada, el botón flotante "Volver al atril" también se puede usar con el rayo (recentrar)
  await page.evaluate(() => window.pitchLab.walk.recenter());
  const back = await page.evaluate(() => document.getElementById('rig').object3D.position.z);
  assert.ok(Math.abs(back - 1.4) < 0.05, `recentrar devuelve al atril (z=${back})`);
});

await step('X6. Modo sentado eleva la vista solo en VR', async () => {
  const y0 = await rigY();
  await page.evaluate(() => window.pitchLab.settings.set('seated', true));
  const y1 = await rigY();
  assert.ok(Math.abs(y1 - y0 - 0.45) < 0.01, `${y0} -> ${y1}`);
  await page.evaluate(() => window.pitchLab.settings.set('seated', false));
});

await step('X7. Altura de la vista: la corrección de a 5 cm se aplica en VR y tiene tope', async () => {
  const y0 = await rigY();
  await page.evaluate(() => window.pitchLab.settings.set('heightCm', 10));
  assert.ok(Math.abs((await rigY()) - y0 - 0.10) < 0.005, 'sube 10 cm');
  await page.evaluate(() => window.pitchLab.settings.set('heightCm', -15));
  assert.ok(Math.abs((await rigY()) - y0 + 0.15) < 0.005, 'baja 15 cm');
  await page.evaluate(() => { for (let i = 0; i < 30; i++) window.pitchLab.settings.adjustHeight(1); });
  assert.ok(Math.abs((await rigY()) - y0 - 0.30) < 0.005, 'tope de 30 cm');
  await page.evaluate(() => window.pitchLab.settings.set('heightCm', 0));
  assert.ok(Math.abs((await rigY()) - y0) < 0.005, 'vuelve a la altura original');
});

await step('X8. Giro por tramos con el joystick: gira sobre la cabeza, no repite al mantener y respeta el ángulo elegido', async () => {
  await page.evaluate(() => window.pitchLab.settings.set('snapTurnDeg', 30));
  const yaw0 = await rigYaw();
  const head0 = await headXZ();
  await page.evaluate(() => window.__xr.controllers.right.updateAxes('thumbstick', 1, 0));
  await wait(300);
  const yaw1 = await rigYaw();
  const head1 = await headXZ();
  assert.ok(Math.abs(angleDiff(yaw1, yaw0) + 30 * DEG) < 0.02, `empujar a la derecha gira 30° a la derecha (${(angleDiff(yaw1, yaw0) / DEG).toFixed(1)}°)`);
  assert.ok(Math.hypot(head1.x - head0.x, head1.z - head0.z) < 0.02, 'la cabeza no se desplaza al girar');
  await wait(500);
  assert.ok(Math.abs(angleDiff(await rigYaw(), yaw1)) < 0.001, 'mantener el joystick empujado no sigue girando');
  await page.evaluate(() => window.__xr.controllers.right.updateAxes('thumbstick', 0, 0));
  await wait(200);
  await page.evaluate(() => window.__xr.controllers.right.updateAxes('thumbstick', -1, 0));
  await wait(300);
  assert.ok(Math.abs(angleDiff(await rigYaw(), yaw0)) < 0.02, 'empujar a la izquierda vuelve al giro original');
  await page.evaluate(() => window.__xr.controllers.right.updateAxes('thumbstick', 0, 0));
  await wait(200);
  // Otro ángulo
  await page.evaluate(() => window.pitchLab.settings.set('snapTurnDeg', 90));
  await page.evaluate(() => window.__xr.controllers.left.updateAxes('thumbstick', 1, 0));
  await wait(300);
  assert.ok(Math.abs(angleDiff(await rigYaw(), yaw0) + 90 * DEG) < 0.02, 'con 90° gira un cuarto de vuelta (y el control izquierdo también sirve)');
  await page.evaluate(() => window.__xr.controllers.left.updateAxes('thumbstick', 0, 0));
  await wait(200);
  // Desactivado
  await page.evaluate(() => window.pitchLab.settings.set('snapTurnDeg', 0));
  const yawOff = await rigYaw();
  await page.evaluate(() => window.__xr.controllers.right.updateAxes('thumbstick', 1, 0));
  await wait(300);
  assert.ok(Math.abs(angleDiff(await rigYaw(), yawOff)) < 0.001, 'desactivado no gira');
  await page.evaluate(() => window.__xr.controllers.right.updateAxes('thumbstick', 0, 0));
  await wait(200);
  await page.evaluate(() => { window.pitchLab.settings.set('snapTurnDeg', 30); window.pitchLab.walk.recenter(); });
});

await step('X9. Vibración de los controles: al apuntar y al presionar, y se puede apagar', async () => {
  await installPulseSpy();
  await page.evaluate(() => { window.__pulses = []; });
  await aimController('right', 'u-seated');
  const hoverPulses = await pulses();
  assert.ok(hoverPulses.some((p) => p.hand === 'right' && p.duration <= 30), `al apuntar vibra corto: ${JSON.stringify(hoverPulses)}`);
  await page.evaluate(() => { window.__pulses = []; });
  await trigger('right');
  const pressPulses = await pulses();
  assert.ok(pressPulses.some((p) => p.hand === 'right' && p.value >= 0.4), `al presionar vibra más fuerte: ${JSON.stringify(pressPulses)}`);
  await page.evaluate(() => window.pitchLab.settings.set('seated', false));
  // Apagada: no vibra
  await page.evaluate(() => window.pitchLab.settings.set('haptics', false));
  await aimAway('right');
  await page.evaluate(() => { window.__pulses = []; });
  await aimController('right', 'u-seated');
  await trigger('right');
  assert.deepEqual(await pulses(), [], 'con la vibración apagada no se envía nada');
  await page.evaluate(() => { window.pitchLab.settings.set('haptics', true); window.pitchLab.settings.set('seated', false); });
});

await step('X10. Una sola mano alcanza: todo se puede hacer solo con el control izquierdo (y solo con el derecho)', async () => {
  await aimAway('right');
  await pointAndPress('left', 'u-seated');
  assert.equal(await page.evaluate(() => window.pitchLab.settings.get('seated')), true, 'el control izquierdo activó el botón');
  await pointAndPress('left', 'u-seated');
  assert.equal(await page.evaluate(() => window.pitchLab.settings.get('seated')), false);
  await aimAway('left');
  await pointAndPress('right', 'u-seated');
  assert.equal(await page.evaluate(() => window.pitchLab.settings.get('seated')), true, 'y el derecho también');
  await page.evaluate(() => window.pitchLab.settings.set('seated', false));
  await aimAway('right');
  await aimAway('left');
});

await step('X11. «Mantené presionado» para finalizar: un toque corto no termina y avisa dentro del casco; mantener sí termina', async () => {
  await dispatch(page, 'PREPARE');
  await dispatch(page, 'SET_INPUT_MODE', { mode: 'timer' });
  await dispatch(page, 'BEGIN');
  await waitState(page, 'presenting');
  await wait(600);
  const finish = await page.evaluate(() => [...window.pitchLab.stage.ui.lecternPool.buttons.values()].find((b) => b.action?.id === 'finish')?.action);
  assert.equal(finish.hold, true, '«Finalizar» pide mantener presionado');
  // Toque corto
  await aimController('right', 'finish');
  await trigger('right', 120);
  assert.equal(await state(page), 'presenting', 'un toque corto no termina la presentación');
  const flash = await page.evaluate(() => window.pitchLab.stage.ui.flash);
  assert.ok(flash && /Mantené presionado/.test(flash.text), `aviso dentro del espacio 3D: ${JSON.stringify(flash)}`);
  // Mantener
  await aimController('right', 'finish');
  await page.evaluate(() => window.__xr.controllers.right.updateButtonValue('trigger', 1));
  await wait(300);
  assert.equal(await state(page), 'presenting', 'a mitad de camino todavía no termina');
  const midProgress = await page.evaluate(() => [...window.pitchLab.stage.ui.lecternPool.buttons.values()].find((b) => b.action?.id === 'finish')?.progress ?? 0);
  assert.ok(midProgress > 0.1 && midProgress < 1, `se ve el avance (${midProgress})`);
  await wait(HOLD_WAIT_MS);
  await page.evaluate(() => window.__xr.controllers.right.updateButtonValue('trigger', 0));
  await waitState(page, 'feedback', 4000);
});

await step('X12. Salir de VR: la sesión termina y vuelve la interfaz de escritorio', async () => {
  await page.evaluate(() => window.pitchLab.scene.exitVR());
  await page.waitForFunction(() => !window.pitchLab.scene.is('vr-mode'), null, { timeout: 8000 });
  assert.equal(await page.evaluate(() => window.pitchLab.xr.active), false);
  assert.equal(await page.evaluate(() => document.body.classList.contains('in-vr')), false);
  assert.equal(await page.evaluate(() => document.getElementById('btn-vr').textContent), 'Entrar en VR');
  // Fuera de VR la corrección de altura no se aplica
  await page.evaluate(() => window.pitchLab.settings.set('heightCm', 20));
  assert.ok(Math.abs(await rigY()) < 0.01, 'en computadora la altura no cambia');
  await page.evaluate(() => window.pitchLab.settings.set('heightCm', 0));
});

const fatal = problems.filter((p) => !/favicon/.test(p));
await step('X13. Sin errores de consola durante la sesión inmersiva emulada', async () => { assert.deepEqual(fatal, []); });

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
