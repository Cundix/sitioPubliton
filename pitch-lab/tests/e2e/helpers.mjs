// Ayudantes para las pruebas de extremo a extremo.
// Los clics sobre botones 3D se hacen con el MOUSE REAL: se proyecta la posición del botón a
// pantalla y se hace clic ahí, de modo que se ejercita el raycasting del cursor de A-Frame.

import assert from 'node:assert/strict';

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const state = (page) => page.evaluate(() => window.pitchLab.session.state);

export async function waitState(page, expected, timeout = 8000) {
  try {
    await page.waitForFunction((s) => window.pitchLab.session.state === s, expected, { timeout });
  } catch {
    const now = await state(page);
    throw new Error(`se esperaba el estado "${expected}" y quedó en "${now}"`);
  }
}

export const dispatch = (page, event, payload) =>
  page.evaluate(([e, p]) => window.pitchLab.session.dispatch(e, p), [event, payload]);

/** Deja la cámara en la posición inicial mirando al frente. */
export const resetView = (page) => page.evaluate(() => {
  const app = window.pitchLab;
  app.walk.recenter();
  const look = document.getElementById('head').components['look-controls'];
  look.pitchObject.rotation.x = 0;
  look.yawObject.rotation.y = 0;
});

/** Posición en pantalla de un botón 3D (por id de acción), o null si no existe. */
export const actionPoint = (page, id) => page.evaluate((actionId) => {
  const app = window.pitchLab;
  const ui = app.stage?.ui;
  if (!ui) return null;
  let found = null;
  for (const pool of [ui.lecternPool, ui.panelPool]) {
    if (!pool) continue;
    for (const b of pool.buttons.values()) if (b.action?.id === actionId) found = b;
  }
  if (!found) return null;
  const v = new AFRAME.THREE.Vector3();
  found.el.object3D.getWorldPosition(v);
  v.project(app.scene.camera);
  const rect = app.scene.canvas.getBoundingClientRect();
  return {
    x: rect.left + ((v.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - v.y) / 2) * rect.height,
    inView: Math.abs(v.x) < 0.97 && Math.abs(v.y) < 0.97 && v.z < 1,
    disabled: !!found.action.disabled,
    hold: !!found.action.hold,
  };
}, id);

/** Tiempo que hay que mantener apretado un botón de «mantené presionado» (hold.js) más un margen. */
export const HOLD_WAIT_MS = 1600;

/** Hace clic con el mouse sobre un botón 3D. Los botones de «mantené presionado» se mantienen apretados el tiempo necesario. */
export async function click3D(page, id) {
  const p = await actionPoint(page, id);
  assert.ok(p, `no existe el botón 3D "${id}"`);
  assert.ok(p.inView, `el botón 3D "${id}" no está a la vista`);
  await page.mouse.move(p.x - 12, p.y - 6);
  await page.mouse.move(p.x, p.y, { steps: 3 });
  await wait(170);
  if (p.hold) {
    await page.mouse.down();
    await wait(HOLD_WAIT_MS);
    await page.mouse.up();
  } else {
    await page.mouse.click(p.x, p.y);
  }
  await wait(120);
}

export const clock = (page) => page.evaluate(() => window.pitchLab.hub.model.clock);

export async function openAndStartSession(page, { scenario = 'sala', voice = false } = {}) {
  await dispatch(page, 'START');
  if ((await state(page)) === 'tutorial') await dispatch(page, 'SKIP');
  await dispatch(page, 'PICK_SCENARIO', { id: scenario });
  await dispatch(page, 'ENTER');
  await dispatch(page, 'PREPARE');
  if (!voice) await dispatch(page, 'SET_INPUT_MODE', { mode: 'timer' });
}

export const words = (n, prefix = 'palabra') => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`).join(' ');
