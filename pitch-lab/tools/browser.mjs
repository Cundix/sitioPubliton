// Ayudante para las pruebas automáticas y las capturas: abre Microsoft Edge/Chrome con Playwright.
// Usa el navegador ya instalado (no descarga nada). Variables opcionales:
//   PITCHLAB_BROWSER=chrome|msedge   PITCHLAB_URL=http://localhost:8080/pitch-lab/

import { chromium } from 'playwright-core';

export const BASE_URL = process.env.PITCHLAB_URL || 'http://localhost:8080/pitch-lab/';

export async function launch({ fakeMic = true, headless = true, fakeAudioFile = null } = {}) {
  const channel = process.env.PITCHLAB_BROWSER || 'msedge';
  const args = [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--autoplay-policy=no-user-gesture-required',
  ];
  if (fakeMic) args.push('--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream');
  // Un archivo WAV como "micrófono" (se repite en bucle salvo que termine en %noloop).
  if (fakeAudioFile) args.push(`--use-file-for-fake-audio-capture=${fakeAudioFile}`);
  return chromium.launch({ channel, headless, args });
}

/** Abre una página y junta errores de consola y de página. */
export async function openPage(browser, { width = 1280, height = 720, url = BASE_URL, permissions = [], init, ui2d = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, permissions, deviceScaleFactor: 1 });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const problems = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`);
    if (msg.type() === 'warning' && /pitch-ui/.test(msg.text())) problems.push(`warn: ${msg.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message} :: ${(error.stack || '').split('\n').slice(0, 5).join(' | ')}`));
  page.on('requestfailed', (req) => problems.push(`requestfailed: ${req.url()} ${req.failure()?.errorText}`));
  page.on('response', (res) => { if (res.status() >= 400) problems.push(`http ${res.status()}: ${res.url()}`); });
  // Las pruebas usan la interfaz 2D (el modo solo-VR la esconde): se pide con ?2d=1.
  if (ui2d && !/[?&]2d/.test(url)) url += `${url.includes('?') ? '&' : '?'}2d=1`;
  await page.goto(url, { waitUntil: 'load', timeout: 60000 }); // holgado: el render por software es lento si hay dos navegadores a la vez
  return { context, page, problems };
}

/** Espera a que la app esté lista (escena cargada y sesión en "home"). */
export async function waitReady(page, timeout = 30000) {
  await page.waitForFunction(() => window.pitchLab?.session?.state === 'home' && document.getElementById('loading')?.hidden, null, { timeout });
  await page.waitForTimeout(400);
}
