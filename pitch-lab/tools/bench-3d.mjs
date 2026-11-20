// Mide cuántos cuadros por segundo dibuja cada espacio con WebGL POR SOFTWARE (SwiftShader) y cuánta geometría usa.
// Sirve SOLO para comparar dos versiones del mismo código en la misma computadora (por ejemplo, antes y después de
// mejorar los modelos). NO es el rendimiento de un casco ni de una GPU real: no usar estos números como cuadros por segundo de VR.
//
// Uso:  PITCHLAB_URL=http://localhost:8090/pitch-lab/ node tools/bench-3d.mjs [etiqueta]

import { launch, openPage, waitReady } from './browser.mjs';

const label = process.argv[2] || 'version';
const browser = await launch();
const { page } = await openPage(browser, { width: 1280, height: 720, permissions: [] });
await waitReady(page);

const dispatch = (event, payload) => page.evaluate(([e, p]) => window.pitchLab.session.dispatch(e, p), [event, payload]);
const measure = async (name, seconds = 5) => {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async (ms) => {
    const info = window.pitchLab.scene.renderer.info;
    let frames = 0;
    const t0 = performance.now();
    await new Promise((resolve) => {
      const tick = () => { frames += 1; if (performance.now() - t0 < ms) requestAnimationFrame(tick); else resolve(); };
      requestAnimationFrame(tick);
    });
    const dt = (performance.now() - t0) / 1000;
    return { fps: frames / dt, calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures };
  }, seconds * 1000);
  console.log(`${label.padEnd(8)} ${name.padEnd(10)} ${r.fps.toFixed(1).padStart(5)} cuadros/s · ${String(r.calls).padStart(3)} llamadas · ${String(r.triangles).padStart(6)} triángulos · ${r.geometries} geometrías · ${r.textures} texturas`);
  return r;
};

await measure('hub');
await dispatch('START'); await dispatch('SKIP');
for (const id of ['sala', 'cliente', 'auditorio']) {
  await dispatch('PICK_SCENARIO', { id }); await dispatch('ENTER'); await dispatch('PREPARE');
  await dispatch('SET_INPUT_MODE', { mode: 'timer' }); await dispatch('BEGIN');
  await measure(id);
  await dispatch('REQUEST_CANCEL'); await dispatch('CONFIRM'); await dispatch('CHANGE_SCENARIO');
}
await browser.close();
