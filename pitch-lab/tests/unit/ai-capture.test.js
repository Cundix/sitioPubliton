// Captura de audio y seguimiento de manos con un "navegador" simulado: permisos que llegan tarde,
// cancelaciones, topes de grabación y continuidad de la línea de tiempo al pausar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioCapture } from '../../js/ai/audio-capture.js';
import { GestureTracker } from '../../js/ai/gesture-tracker.js';
import { AnalysisService } from '../../js/ai/analysis-service.js';
import { APP_CONFIG } from '../../js/config/app-config.js';
import { flush } from './helpers.js';

const deferred = () => {
  const d = {};
  d.promise = new Promise((resolve, reject) => { d.resolve = resolve; d.reject = reject; });
  return d;
};

class FakeTrack {
  constructor(kind) { this.kind = kind; this.readyState = 'live'; }
  stop() { this.readyState = 'ended'; }
}
class FakeStream {
  constructor(kinds) { this.tracks = kinds.map((k) => new FakeTrack(k)); }
  getTracks() { return this.tracks; }
  get live() { return this.tracks.filter((t) => t.readyState === 'live').length; }
}

class FakeRecorder {
  static isTypeSupported(type) { return type === 'audio/webm;codecs=opus'; }
  constructor(stream, options) {
    this.stream = stream;
    this.mimeType = options?.mimeType || '';
    this.state = 'inactive';
    this.calls = [];
    FakeRecorder.last = this;
  }
  start(slice) { this.state = 'recording'; this.calls.push(`start:${slice}`); }
  pause() { this.state = 'paused'; this.calls.push('pause'); }
  resume() { this.state = 'recording'; this.calls.push('resume'); }
  stop() {
    this.calls.push('stop');
    this.state = 'inactive';
    queueMicrotask(() => this.onstop?.());
  }
  emit(size = 1000) { this.ondataavailable?.({ data: new Blob([new Uint8Array(size)]) }); }
}

function makeWin({ mediaDevices, now = { t: 0 } } = {}) {
  return {
    navigator: { mediaDevices },
    MediaRecorder: FakeRecorder,
    AudioContext: class {},
    OfflineAudioContext: class {},
    WebAssembly: {},
    performance: { now: () => now.t },
    setInterval: (fn, ms) => { win.timers.push({ fn, ms }); return win.timers.length; },
    clearInterval: (id) => { win.timers[id - 1] = null; },
    timers: [],
    document: { createElement: () => makeVideo() },
  };
}
let win;
const makeVideo = () => ({ muted: false, playsInline: false, srcObject: null, play: () => Promise.resolve(), readyState: 4, videoWidth: 640, videoHeight: 480 });

// ---------- Audio ----------

test('Audio: grabar, pausar, retomar y terminar entrega el audio y libera el micrófono', async () => {
  const stream = new FakeStream(['audio']);
  const now = { t: 0 };
  win = makeWin({ mediaDevices: { getUserMedia: async () => stream }, now });
  const cap = new AudioCapture({ win });
  await cap.start();
  assert.equal(cap.active, true);
  assert.equal(FakeRecorder.last.mimeType, 'audio/webm;codecs=opus');
  assert.deepEqual(FakeRecorder.last.calls, ['start:1000']);

  now.t = 2000; FakeRecorder.last.emit();
  cap.pause();
  now.t = 9000; // la pausa no cuenta
  cap.resume();
  now.t = 10000; FakeRecorder.last.emit();
  const out = await cap.finish();
  assert.equal(out.durationMs, 3000);
  assert.equal(out.truncated, false);
  assert.equal(out.blob.size, 2000);
  assert.equal(stream.live, 0, 'el micrófono se liberó');
  assert.equal(cap.recorder, null);
  assert.equal(await cap.finish(), null, 'terminar de nuevo no rompe');
});

test('Audio: un permiso que llega DESPUÉS de cancelar se suelta y no arranca la grabación', async () => {
  const d = deferred();
  const stream = new FakeStream(['audio']);
  win = makeWin({ mediaDevices: { getUserMedia: () => d.promise } });
  FakeRecorder.last = null;
  const cap = new AudioCapture({ win });
  const started = cap.start();
  cap.dispose(); // la persona canceló mientras el navegador mostraba el permiso
  d.resolve(stream);
  await assert.rejects(started, (e) => e.code === 'aborted');
  assert.equal(stream.live, 0, 'el micrófono no queda abierto');
  assert.equal(FakeRecorder.last, null, 'no se creó ninguna grabadora');
  assert.equal(cap.active, false);
});

test('Audio: después de cancelar se puede volver a empezar con normalidad', async () => {
  const first = deferred();
  const s1 = new FakeStream(['audio']);
  const s2 = new FakeStream(['audio']);
  let calls = 0;
  win = makeWin({ mediaDevices: { getUserMedia: () => (++calls === 1 ? first.promise : Promise.resolve(s2)) } });
  const cap = new AudioCapture({ win });
  const a = cap.start();
  cap.dispose();
  await cap.start();           // segundo intento: sí arranca
  first.resolve(s1);           // el permiso viejo llega tarde
  await assert.rejects(a, (e) => e.code === 'aborted');
  assert.equal(s1.live, 0);
  assert.equal(s2.live, 1, 'el segundo micrófono sigue grabando');
  assert.equal(cap.active, true);
  cap.dispose();
  assert.equal(s2.live, 0);
});

test('Audio: errores de permiso se traducen a códigos claros', async () => {
  for (const [name, code] of [['NotAllowedError', 'denied'], ['SecurityError', 'denied'], ['NotFoundError', 'no-mic'], ['AbortError', 'unknown']]) {
    win = makeWin({ mediaDevices: { getUserMedia: async () => { throw Object.assign(new Error(name), { name }); } } });
    await assert.rejects(new AudioCapture({ win }).start(), (e) => e.code === code, name);
  }
  win = makeWin({ mediaDevices: undefined });
  await assert.rejects(new AudioCapture({ win }).start(), (e) => e.code === 'unsupported');
});

test('Audio: al llegar al tope de duración la grabación se corta y se avisa', async () => {
  const stream = new FakeStream(['audio']);
  const now = { t: 0 };
  win = makeWin({ mediaDevices: { getUserMedia: async () => stream }, now });
  const cap = new AudioCapture({ win, config: { ...APP_CONFIG.ai, maxRecordSec: 5 } });
  await cap.start();
  now.t = 3000; FakeRecorder.last.emit();
  assert.equal(cap.truncated, false);
  now.t = 5200; FakeRecorder.last.emit();
  assert.equal(cap.truncated, true);
  assert.equal(FakeRecorder.last.state, 'inactive');
  const out = await cap.finish();
  assert.equal(out.truncated, true);
  assert.ok(out.durationMs >= 5000 && out.durationMs < 5300);
  assert.equal(stream.live, 0);
});

// ---------- Manos ----------

const hand = (x, y) => Array.from({ length: 21 }, (_, i) => ([0, 5, 9, 13, 17].includes(i) ? { x, y } : { x: 0, y: 0 }));

class FakeLandmarker {
  constructor() { this.closed = false; this.hands = []; }
  detectForVideo() { return { landmarks: this.hands }; }
  close() { this.closed = true; }
}

class TestTracker extends GestureTracker {
  constructor(opts) { super(opts); this.loads = []; }
  _loadModel() {
    const d = deferred();
    this.loads.push(d);
    return d.promise;
  }
}

function makeTracker({ now } = {}) {
  const stream = new FakeStream(['video']);
  const gum = deferred();
  win = makeWin({ mediaDevices: { getUserMedia: () => gum.promise }, now });
  const tracker = new TestTracker({ win });
  return { tracker, stream, gum, now: now || { t: 0 } };
}

test('Manos: abre la cámara, carga el modelo una sola vez aunque se pida dos veces y mide', async () => {
  const now = { t: 0 };
  const ctx = makeTracker({ now });
  const { tracker, stream, gum } = ctx;
  const video = makeVideo();
  const p1 = tracker.open(video);
  const p2 = tracker.open(video);
  gum.resolve(stream);
  await flush();
  assert.equal(tracker.loads.length, 1, 'un solo modelo');
  const landmarker = new FakeLandmarker();
  landmarker.hands = [hand(0.5, 0.5)];
  tracker.loads[0].resolve(landmarker);
  await Promise.all([p1, p2]);
  assert.equal(video.srcObject, stream);
  assert.equal(tracker.landmarker, landmarker);

  tracker.start();
  const timer = win.timers.find(Boolean);
  assert.equal(timer.ms, 125, 'muestrea a 8 cuadros por segundo');
  for (let i = 0; i < 40; i++) { now.t = i * 125; timer.fn(); }
  const summary = tracker.finish();
  assert.equal(summary.measured, true);
  assert.equal(summary.handsVisibleShare, 1);
  assert.equal(stream.live, 0, 'la cámara se liberó');
  assert.equal(landmarker.closed, true);
  assert.equal(tracker.stream, null);
});

test('Manos: un permiso de cámara que llega DESPUÉS de cancelar se suelta y no carga el modelo', async () => {
  const { tracker, stream, gum } = makeTracker();
  const opening = tracker.open(makeVideo());
  tracker.close();
  gum.resolve(stream);
  await assert.rejects(opening, (e) => e.code === 'aborted');
  assert.equal(stream.live, 0, 'la cámara no queda abierta');
  assert.equal(tracker.loads.length, 0, 'ni siquiera se descargó el modelo');
  assert.equal(tracker.stream, null);
});

test('Manos: si se cancela mientras carga el modelo, el modelo se descarta al terminar de cargar', async () => {
  const { tracker, stream, gum } = makeTracker();
  const opening = tracker.open(makeVideo());
  gum.resolve(stream);
  await flush();
  assert.equal(tracker.loads.length, 1);
  tracker.close(); // cancelado durante la carga
  assert.equal(stream.live, 0);
  const late = new FakeLandmarker();
  tracker.loads[0].resolve(late);
  await assert.rejects(opening, (e) => e.code === 'aborted');
  assert.equal(late.closed, true, 'el modelo tardío se cierra');
  assert.equal(tracker.landmarker, null);
});

test('Manos: si falla la carga del modelo, la cámara se suelta y el error es claro', async () => {
  const { tracker, stream, gum } = makeTracker();
  const opening = tracker.open(makeVideo());
  gum.resolve(stream);
  await flush();
  tracker.loads[0].reject(new Error('sin red'));
  await assert.rejects(opening, (e) => e.code === 'model');
  assert.equal(stream.live, 0);
});

test('Manos: errores de permiso de la cámara se traducen a códigos claros', async () => {
  for (const [name, code] of [['NotAllowedError', 'denied'], ['NotFoundError', 'no-camera'], ['OverconstrainedError', 'unknown']]) {
    win = makeWin({ mediaDevices: { getUserMedia: async () => { throw Object.assign(new Error(name), { name }); } } });
    await assert.rejects(new TestTracker({ win }).open(makeVideo()), (e) => e.code === code, name);
  }
  win = makeWin({ mediaDevices: undefined });
  await assert.rejects(new TestTracker({ win }).open(makeVideo()), (e) => e.code === 'unsupported');
});

test('Manos: pausar y retomar NO reinicia la línea de tiempo (la duración medida suma todos los tramos)', async () => {
  const now = { t: 1_000_000 };
  const { tracker, stream, gum } = makeTracker({ now });
  const opening = tracker.open(makeVideo());
  gum.resolve(stream);
  await flush();
  const landmarker = new FakeLandmarker();
  landmarker.hands = [hand(0.5, 0.5)];
  tracker.loads[0].resolve(landmarker);
  await opening;

  const run = (fromMs, seconds) => {
    const timer = win.timers.filter(Boolean).pop();
    for (let i = 0; i <= seconds * 8; i++) { now.t = fromMs + i * 125; timer.fn(); }
  };
  tracker.start();
  run(1_000_000, 4);            // 4 s
  tracker.pause();
  assert.equal(win.timers.filter(Boolean).length, 0, 'sin temporizador en pausa');
  now.t = 1_500_000;            // la persona retoma 500 s después
  tracker.resume();
  run(1_500_000, 4);            // 4 s más, 500 s después (la pausa no cuenta)
  const summary = tracker.finish();
  assert.ok(summary.durationSec > 7.5 && summary.durationSec < 8.5, `duración ${summary.durationSec}`);
  assert.equal(summary.measured, true);
});

test('Manos: sin cuadros suficientes no se declara medición', async () => {
  const { tracker, stream, gum } = makeTracker();
  const opening = tracker.open(makeVideo());
  gum.resolve(stream);
  await flush();
  tracker.loads[0].resolve(new FakeLandmarker());
  await opening;
  tracker.start();
  assert.equal(tracker.finish().measured, false);
  assert.equal(new TestTracker({ win }).finish().measured, false, 'sin haber empezado');
});

// ---------- Servicio ----------

function makeService() {
  const calls = [];
  const capture = { active: false, recorder: null, start() { calls.push('audio:start'); return Promise.resolve(); }, pause() {}, resume() {}, dispose() { calls.push('audio:dispose'); }, finish: async () => null };
  const tracker = {
    stream: null, acc: null, running: false,
    open: async () => { calls.push('cam:open'); tracker.stream = {}; },
    close() { calls.push('cam:close'); tracker.stream = null; },
    start() {}, pause() {}, resume() {}, finish() { tracker.close(); return { measured: false }; },
  };
  const service = new AnalysisService({ keyStore: { value: 'AIza-x' }, win: makeWin({ mediaDevices: {} }), capture, tracker, getVideoEl: () => null });
  return { service, calls };
}

test('Servicio: apagar la vista previa NO cierra la cámara si la sesión la está usando', async () => {
  const { service, calls } = makeService();
  await service.previewOn();
  await service.startCamera();      // empieza la práctica con la cámara
  service.previewOff();             // la persona toca «Apagar cámara» en el panel
  assert.ok(!calls.includes('cam:close'), 'la cámara de la práctica sigue abierta');
  assert.equal(service.previewing, true);
  await service.finishCapture();
  assert.ok(calls.includes('cam:close'));
  assert.equal(service.previewing, false);
});

test('Servicio: sin práctica en curso, apagar la vista previa sí cierra la cámara', async () => {
  const { service, calls } = makeService();
  await service.previewOn();
  assert.equal(service.previewing, true);
  service.previewOff();
  assert.ok(calls.includes('cam:close'));
  assert.equal(service.previewing, false);
});

test('Servicio: si falla la cámara de la práctica, no queda marcada como en uso', async () => {
  const { service } = makeService();
  service.tracker.open = async () => { throw Object.assign(new Error('x'), { code: 'denied' }); };
  await assert.rejects(service.startCamera(), (e) => e.code === 'denied');
  service.tracker.open = async () => { service.tracker.stream = {}; };
  await service.previewOn();
  service.previewOff();
  assert.equal(service.previewing, false);
});

test('Servicio: abort() libera audio y cámara', () => {
  const { service, calls } = makeService();
  service.abort();
  assert.deepEqual(calls.filter((c) => c.endsWith('dispose') || c.endsWith('close')).sort(), ['audio:dispose', 'cam:close']);
});
