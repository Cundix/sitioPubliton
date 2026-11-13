import test from 'node:test';
import assert from 'node:assert/strict';
import { SpeechController } from '../../js/voice/speech-recognizer.js';
import { detectCapabilities, detectImmersive } from '../../js/voice/capabilities.js';
import { Settings } from '../../js/core/settings.js';
import { flush } from './helpers.js';

/** Reconocedor simulado: se controla desde el test. NO es voz real. */
function makeMock() {
  const instances = [];
  class MockRecognition {
    constructor() { this.started = false; instances.push(this); this.stopped = 0; this.aborted = 0; }
    start() { this.started = true; queueMicrotask(() => this.onstart?.()); }
    stop() { this.stopped += 1; queueMicrotask(() => this.onend?.()); }
    abort() { this.aborted += 1; }
    emitResult(items) {
      this.onresult?.({ resultIndex: 0, results: items.map(([t, f]) => Object.assign([{ transcript: t }], { isFinal: f })) });
    }
  }
  return { MockRecognition, instances };
}

const win = (extra = {}) => ({ navigator: { permissions: { query: async () => ({ state: 'prompt' }) } }, ...extra });

test('Voz: start resuelve cuando el navegador empieza a escuchar y entrega frases finales e intermedias', async () => {
  const { MockRecognition, instances } = makeMock();
  const voice = new SpeechController({ Ctor: MockRecognition, win: win() });
  const finals = []; const interims = [];
  voice.setHandlers({ final: (t) => finals.push(t), interim: (t) => interims.push(t) });
  await voice.start();
  instances[0].emitResult([['hola a todos', true], ['y gracias', false]]);
  assert.deepEqual(finals, ['hola a todos']);
  assert.equal(interims.at(-1), 'y gracias');
  assert.equal(instances[0].lang, 'es-AR');
  assert.equal(instances[0].continuous, true);
});

test('Voz: permiso rechazado se informa como "denied" y no se reintenta solo', async () => {
  const { MockRecognition, instances } = makeMock();
  MockRecognition.prototype.start = function () {
    queueMicrotask(() => this.onerror?.({ error: 'not-allowed' }));
  };
  const voice = new SpeechController({ Ctor: MockRecognition, win: win() });
  await assert.rejects(() => voice.start(), (e) => e.code === 'denied');
  await flush();
  assert.equal(instances.length, 1, 'no abrió otra instancia');
});

test('Voz: si el permiso ya está bloqueado no vuelve a pedirlo', async () => {
  const { MockRecognition, instances } = makeMock();
  const blocked = { navigator: { permissions: { query: async () => ({ state: 'denied' }) } } };
  const voice = new SpeechController({ Ctor: MockRecognition, win: blocked });
  await assert.rejects(() => voice.start(), (e) => e.code === 'denied');
  assert.equal(instances.length, 0);
});

test('Voz: sin soporte rechaza con "unsupported"', async () => {
  const voice = new SpeechController({ Ctor: null, win: win() });
  assert.equal(voice.available, false);
  await assert.rejects(() => voice.start(), (e) => e.code === 'unsupported');
});

test('Voz: reinicia si el navegador corta la escucha y avisa si no logra sostenerla', async () => {
  const { MockRecognition, instances } = makeMock();
  const voice = new SpeechController({ Ctor: MockRecognition, win: win(), config: { lang: 'es-AR', fallbackLang: 'es-ES', maxAutoRestarts: 2 } });
  let lost = null;
  voice.setHandlers({ lost: (info) => { lost = info; } });
  await voice.start();
  instances[0].onend();           // corte 1 -> reinicia
  await flush();
  assert.equal(instances.length, 2);
  instances[1].onend();           // corte 2 -> reinicia
  await flush();
  assert.equal(instances.length, 3);
  instances[2].onend();           // supera el tope -> avisa
  await flush();
  assert.equal(instances.length, 3);
  assert.ok(lost);
});

test('Voz: pausa y abort sueltan la instancia; stop pide cierre ordenado', async () => {
  const { MockRecognition, instances } = makeMock();
  const voice = new SpeechController({ Ctor: MockRecognition, win: win() });
  await voice.start();
  voice.pause();
  assert.equal(instances[0].aborted, 1);
  await voice.resume();
  assert.equal(instances.length, 2);
  await voice.stop();
  assert.equal(instances[1].stopped, 1);
  await voice.start();
  voice.abort();
  assert.equal(instances.at(-1).aborted, 1);
});

test('Voz: errores "no-speech" no se consideran fallos', async () => {
  const { MockRecognition, instances } = makeMock();
  const voice = new SpeechController({ Ctor: MockRecognition, win: win() });
  let lost = false;
  voice.setHandlers({ lost: () => { lost = true; } });
  await voice.start();
  instances[0].onerror({ error: 'no-speech' });
  assert.equal(lost, false);
});

test('Capacidades: detecta soporte real y explica la falta de WebXR', async () => {
  assert.equal(detectCapabilities({ navigator: {} }).speech, false);
  assert.equal(detectCapabilities({ navigator: {}, webkitSpeechRecognition: function () {} }).speech, true);
  const noXr = await detectImmersive({ navigator: {}, isSecureContext: true });
  assert.equal(noXr.supported, false);
  assert.match(noXr.reason, /WebXR/);
  const insecure = await detectImmersive({ navigator: { xr: {} }, isSecureContext: false });
  assert.match(insecure.reason, /HTTPS/);
  const noHmd = await detectImmersive({ navigator: { xr: { isSessionSupported: async () => false } }, isSecureContext: true });
  assert.match(noHmd.reason, /casco/);
  const ok = await detectImmersive({ navigator: { xr: { isSessionSupported: async () => true } }, isSecureContext: true });
  assert.equal(ok.supported, true);
});

test('Preferencias: se guardan solo ajustes y toleran almacenamiento roto', () => {
  const store = {};
  const storage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  const a = new Settings({ storage });
  a.set('volume', 0.3);
  a.set('seated', true);
  const b = new Settings({ storage });
  assert.equal(b.get('volume'), 0.3);
  assert.equal(b.get('seated'), true);
  assert.ok(!Object.values(store).join('').includes('transcri'));

  const broken = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  const c = new Settings({ storage: broken, prefersReducedMotion: true });
  c.set('volume', 0.5);
  assert.equal(c.get('volume'), 0.5);
  assert.equal(c.get('reducedMotion'), true);
});
