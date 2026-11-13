// Recorrido completo con el análisis de IA (falso y controlado): permisos, captura, resultado, errores,
// reintentos, cancelación y limpieza. No usa red, micrófono ni cámara.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../../js/core/session.js';
import { Settings } from '../../js/core/settings.js';
import { buildScreen } from '../../js/core/screens.js';
import { renderBlock } from '../../js/ui/html-blocks.js';
import { S, FLOW } from '../../js/core/state-machine.js';
import { SOURCES } from '../../js/core/metrics.js';
import { AI_DISCLAIMER } from '../../js/core/feedback.js';
import { normalizeAnalysis } from '../../js/ai/analysis-prompt.js';
import { FakeClock, FakeVoice, flush, GOOD_ANALYSIS } from './helpers.js';

const GESTURES = { measured: true, frames: 120, durationSec: 30, handsVisibleShare: 0.7, twoHandsShare: 0.3, meanSpeed: 0.2, movementSamples: 100, movementLevel: 'moderate', movementLabel: 'moderado' };

class FakeAI {
  constructor({ audioError = null, cameraError = null, gestures = GESTURES, noAudio = false } = {}) {
    this.audioError = audioError;
    this.cameraError = cameraError;
    this.gestures = gestures;
    this.noAudio = noAudio;
    this.calls = [];
    this.pending = [];
  }

  startAudio() { this.calls.push('startAudio'); return this.audioError ? Promise.reject(Object.assign(new Error('mic'), { code: this.audioError })) : Promise.resolve(); }
  startCamera() { this.calls.push('startCamera'); return this.cameraError ? Promise.reject(Object.assign(new Error('cam'), { code: this.cameraError })) : Promise.resolve(); }
  beginTracking() { this.calls.push('beginTracking'); }
  pause() { this.calls.push('pause'); }
  resume() { this.calls.push('resume'); }
  abort() { this.calls.push('abort'); }

  async finishCapture() {
    this.calls.push('finishCapture');
    return { audio: this.noAudio ? null : { blob: { size: 1234 }, durationMs: 30000, truncated: false }, gestures: this.gestures };
  }

  analyze(args) {
    this.calls.push('analyze');
    return new Promise((resolve, reject) => this.pending.push({ resolve, reject, args }));
  }

  count(name) { return this.calls.filter((c) => c === name).length; }
}

const analysisResult = (model = 'gemini-3.5-flash-lite') => ({ analysis: normalizeAnalysis(GOOD_ANALYSIS), model, usage: null });

function make({ speech = true, ai = new FakeAI(), caps = { ai: true, camera: true } } = {}) {
  const clock = new FakeClock();
  const session = new Session({ clock, voice: speech ? new FakeVoice() : null, ai, capabilities: { speech, ...caps }, tutorialSeen: true });
  session.start();
  return { session, ai, clock, settings: new Settings() };
}

function toPrep(ctx, id = 'sala') {
  const { session } = ctx;
  assert.ok(session.dispatch('START'));
  assert.ok(session.dispatch('PICK_SCENARIO', { id }));
  assert.ok(session.dispatch('ENTER'));
  assert.ok(session.dispatch('PREPARE'));
}

function configure(ctx, { aiOn = true, gestures = false } = {}) {
  const { session } = ctx;
  assert.ok(session.dispatch('OPEN_AI'));
  assert.equal(session.state, S.AI_SETUP);
  if (aiOn) assert.ok(session.dispatch('TOGGLE_AI'));
  if (gestures) assert.ok(session.dispatch('TOGGLE_GESTURES'));
  assert.ok(session.dispatch('CLOSE'));
  assert.equal(session.state, S.PREP);
}

async function present(ctx, { gestures = false, aiOn = true, id = 'sala' } = {}) {
  toPrep(ctx, id);
  configure(ctx, { aiOn, gestures });
  ctx.session.dispatch('BEGIN');
  await flush();
  assert.equal(ctx.session.state, S.PRESENTING);
}

// ---------- Configuración ----------

test('IA: la configuración solo se activa con clave (capacidad) y vuelve a la preparación', () => {
  const ctx = make({ caps: { ai: false, camera: false } });
  toPrep(ctx);
  assert.ok(ctx.session.dispatch('OPEN_AI'));
  assert.equal(ctx.session.dispatch('TOGGLE_AI'), false, 'sin clave no se puede activar');
  assert.equal(ctx.session.dispatch('TOGGLE_GESTURES'), false, 'sin cámara no se puede activar');
  ctx.session.setCapabilities({ ai: true });
  assert.ok(ctx.session.dispatch('TOGGLE_AI'));
  assert.equal(ctx.session.data.options.aiAnalysis, true);
  assert.equal(ctx.session.data.options.inputMode, 'voice');
  assert.ok(ctx.session.dispatch('TOGGLE_AI'));
  assert.equal(ctx.session.data.options.aiAnalysis, false);
  assert.ok(ctx.session.dispatch('CLOSE'));
  assert.equal(ctx.session.state, S.PREP);
});

test('IA: abrir y cerrar la configuración no reinicia la cuenta de preparación', () => {
  const ctx = make();
  toPrep(ctx);
  const total = ctx.session.getTimeView().prepRemainingSec;
  assert.ok(total > 10, 'hay cuenta de preparación');
  ctx.clock.advance(5000);
  assert.equal(ctx.session.getTimeView().prepRemainingSec, total - 5);
  ctx.session.dispatch('OPEN_AI');
  ctx.clock.advance(40000); // tiempo que pasa mirando la configuración
  ctx.session.dispatch('CLOSE');
  assert.equal(ctx.session.getTimeView().prepRemainingSec, total - 5);
  ctx.clock.advance(1000);
  assert.equal(ctx.session.getTimeView().prepRemainingSec, total - 6);
  assert.equal(ctx.clock.activeIntervals, 1, 'un solo temporizador');
});

test('IA: si se pierde la clave se apaga el análisis y los gestos si no hay cámara', () => {
  const ctx = make({ speech: false });
  toPrep(ctx);
  configure(ctx, { gestures: true });
  assert.equal(ctx.session.data.options.aiAnalysis, true);
  ctx.session.setCapabilities({ ai: false, camera: false });
  assert.equal(ctx.session.data.options.aiAnalysis, false);
  assert.equal(ctx.session.data.options.gestures, false);
  assert.equal(ctx.session.data.options.inputMode, 'timer', 'sin reconocimiento del navegador no hay voz');
});

// ---------- Captura y análisis ----------

test('IA: con el análisis activo se pide el micrófono, se graba y se envía lo grabado al terminar', async () => {
  const ctx = make();
  await present(ctx);
  const { session, ai } = ctx;
  assert.equal(ai.count('startAudio'), 1);
  assert.equal(ai.count('startCamera'), 0, 'sin gestos no se abre la cámara');
  assert.equal(ai.count('beginTracking'), 1);
  assert.equal(session.aiRecording, true);

  ctx.clock.advance(30000);
  session.dispatch('FINISH');
  assert.equal(session.state, S.REVIEW, 'con reconocimiento del navegador hay revisión de transcripción');
  assert.equal(session.data.ai.status, 'analyzing');
  await flush();
  assert.equal(ai.pending.length, 1);
  const { args } = ai.pending[0];
  assert.equal(args.audio.durationMs, 30000);
  assert.equal(args.context.brief.id, session.brief.id);
  assert.equal(args.context.scenario.id, 'sala');
  assert.equal(args.context.durationSec, 30);
  assert.equal(args.context.targetSec, 60);
  assert.ok(args.signal);

  ai.pending[0].resolve(analysisResult());
  await flush();
  assert.equal(session.data.ai.status, 'done');
  assert.equal(session.data.ai.model, 'gemini-3.5-flash-lite');
  assert.equal(session.aiRecording, false);
  assert.equal(session.canRetryAi, false);
  assert.equal(ai.count('abort'), 0);
  assert.equal(ctx.clock.activeIntervals, 0);
});

test('IA: sin reconocimiento del navegador la transcripción sale de la IA y se rotula así', async () => {
  const ctx = make({ speech: false });
  await present(ctx);
  ctx.clock.advance(20000);
  ctx.session.dispatch('FINISH');
  assert.equal(ctx.session.state, S.FEEDBACK, 'sin revisión de transcripción');
  assert.equal(ctx.session.getTranscript().source, SOURCES.NONE);
  await flush();
  ctx.ai.pending[0].resolve(analysisResult());
  await flush();
  const t = ctx.session.getTranscript();
  assert.equal(t.source, SOURCES.AI);
  assert.match(t.text, /nadie conoce la marca/);
  const fb = ctx.session.getFeedback();
  assert.equal(fb.metrics.source, SOURCES.AI);
  assert.ok(fb.banners.some((b) => b.label === 'TRANSCRIPCIÓN DE LA IA'));
});

test('IA: con reconocimiento del navegador, el texto del navegador manda y el de la IA no lo pisa', async () => {
  const ctx = make();
  await present(ctx);
  ctx.session.pushFinal('texto del navegador');
  ctx.clock.advance(10000);
  ctx.session.dispatch('FINISH');
  await flush();
  ctx.ai.pending[0].resolve(analysisResult());
  await flush();
  const t = ctx.session.getTranscript();
  assert.equal(t.source, SOURCES.SPEECH);
  assert.equal(t.text, 'texto del navegador');
});

test('IA: la cámara se abre junto con el micrófono y el resumen de gestos llega a la devolución', async () => {
  const ctx = make({ speech: false });
  await present(ctx, { gestures: true });
  assert.equal(ctx.ai.count('startCamera'), 1);
  assert.equal(ctx.session.cameraOn, true);
  ctx.clock.advance(30000);
  ctx.session.dispatch('FINISH');
  await flush();
  assert.equal(ctx.session.cameraOn, false);
  const fb = ctx.session.getFeedback();
  assert.equal(fb.gestures.movementLabel, 'moderado');
  const rows = fb.measurements.filter((r) => ['hands', 'handMove'].includes(r.id));
  assert.equal(rows.length, 2);
  assert.match(rows.find((r) => r.id === 'hands').display, /70\s?%/);
  assert.equal(ctx.ai.pending[0].args.context.gestures.handsVisibleShare, 0.7);
  ctx.ai.pending[0].resolve(analysisResult());
  await flush();
});

test('IA: solo gestos (sin IA y sin micrófono) también funciona: no hay análisis ni envío', async () => {
  const ctx = make({ speech: false });
  toPrep(ctx);
  configure(ctx, { aiOn: false, gestures: true });
  assert.equal(ctx.session.data.options.inputMode, 'timer');
  ctx.session.dispatch('BEGIN');
  await flush();
  assert.equal(ctx.session.state, S.PRESENTING);
  assert.equal(ctx.ai.count('startAudio'), 0);
  assert.equal(ctx.ai.count('startCamera'), 1);
  ctx.clock.advance(15000);
  ctx.session.dispatch('FINISH');
  await flush();
  assert.equal(ctx.ai.count('analyze'), 0, 'nada se envía');
  assert.equal(ctx.session.data.ai.status, 'off');
  assert.equal(ctx.session.getFeedback().gestures.measured, true);
});

test('IA: pausar y retomar detiene y reanuda la grabación y la cámara', async () => {
  const ctx = make();
  await present(ctx, { gestures: true });
  ctx.session.dispatch('PAUSE');
  ctx.session.dispatch('RESUME');
  assert.equal(ctx.ai.count('pause'), 1);
  assert.equal(ctx.ai.count('resume'), 1);
  assert.equal(ctx.ai.count('beginTracking'), 1, 'no se vuelve a empezar de cero');
});

// ---------- Fallos ----------

test('IA: si no se puede grabar el audio, la presentación sigue sin IA y se avisa', async () => {
  const ctx = make({ ai: new FakeAI({ audioError: 'denied' }) });
  const notices = [];
  ctx.session.on('notice', (n) => notices.push(n.text));
  await present(ctx);
  assert.equal(ctx.session.data.options.aiAnalysis, false);
  assert.ok(notices.some((t) => /No se pudo grabar el audio/.test(t)));
  ctx.clock.advance(5000);
  ctx.session.dispatch('FINISH');
  await flush();
  assert.equal(ctx.ai.count('analyze'), 0);
});

test('IA: si no hay ninguna entrada de audio disponible se va a la pantalla de recuperación', async () => {
  const ctx = make({ speech: false, ai: new FakeAI({ audioError: 'denied' }) });
  toPrep(ctx);
  configure(ctx);
  ctx.session.dispatch('BEGIN');
  await flush();
  assert.equal(ctx.session.state, S.VOICE_PROBLEM);
  assert.ok(ctx.ai.count('abort') >= 1, 'se libera lo que se hubiera iniciado');
  assert.equal(ctx.session.aiRecording, false);
});

test('IA: si falla solo la cámara, se sigue sin gestos y el audio igual se analiza', async () => {
  const ctx = make({ speech: false, ai: new FakeAI({ cameraError: 'denied' }) });
  const notices = [];
  ctx.session.on('notice', (n) => notices.push(n.text));
  await present(ctx, { gestures: true });
  assert.equal(ctx.session.data.options.gestures, false);
  assert.equal(ctx.session.data.options.aiAnalysis, true);
  assert.ok(notices.some((t) => /No se pudo usar la cámara/.test(t)));
});

test('IA: un error del servicio se muestra en la devolución y se puede reintentar con la grabación en memoria', async () => {
  const ctx = make({ speech: false });
  await present(ctx);
  ctx.clock.advance(20000);
  ctx.session.dispatch('FINISH');
  await flush();
  ctx.ai.pending[0].reject(Object.assign(new Error('Se alcanzó el límite de uso de la clave.'), { code: 'quota' }));
  await flush();
  const { session } = ctx;
  assert.equal(session.data.ai.status, 'error');
  assert.equal(session.data.ai.error.code, 'quota');
  assert.equal(session.canRetryAi, true);
  assert.equal(session.getFeedback().ai.status, 'error');

  assert.ok(session.dispatch('AI_RETRY'));
  assert.equal(session.data.ai.status, 'analyzing');
  await flush();
  assert.equal(ctx.ai.pending.length, 2);
  ctx.ai.pending[1].resolve(analysisResult('gemini-3.1-flash-lite'));
  await flush();
  assert.equal(session.data.ai.status, 'done');
  assert.equal(session.getFeedback().ai.model, 'gemini-3.1-flash-lite');
  assert.equal(session.canRetryAi, false, 'la grabación ya se descartó');
  assert.equal(session.dispatch('AI_RETRY'), false);
});

test('IA: un resultado que llega después de reintentar la práctica se ignora y la grabación se borra', async () => {
  const ctx = make({ speech: false });
  await present(ctx);
  ctx.clock.advance(20000);
  ctx.session.dispatch('FINISH');
  await flush();
  const late = ctx.ai.pending[0];
  ctx.session.dispatch('RETRY'); // vuelve a la preparación mientras la IA todavía piensa
  assert.equal(ctx.session.state, S.PREP);
  assert.equal(ctx.session.data.ai.status, 'off');
  late.resolve(analysisResult());
  await flush();
  assert.equal(ctx.session.data.ai.status, 'off');
  assert.equal(ctx.session.capture.aiResult, null);
  assert.equal(ctx.session.canRetryAi, false);
  assert.equal(late.args.signal.aborted, true, 'se avisó a la red que cancele');
});

test('IA: un fallo tardío tampoco pisa una sesión nueva', async () => {
  const ctx = make({ speech: false });
  await present(ctx);
  ctx.session.dispatch('FINISH');
  await flush();
  const late = ctx.ai.pending[0];
  ctx.session.dispatch('RETRY');
  late.reject(Object.assign(new Error('x'), { code: 'network' }));
  await flush();
  assert.equal(ctx.session.data.ai.status, 'off');
});

test('IA: cancelar la presentación libera micrófono y cámara y no analiza nada', async () => {
  const ctx = make();
  await present(ctx, { gestures: true });
  ctx.session.dispatch('REQUEST_CANCEL');
  ctx.session.dispatch('CONFIRM');
  await flush();
  assert.notEqual(ctx.session.state, S.PRESENTING);
  assert.ok(ctx.ai.count('abort') >= 1);
  assert.equal(ctx.ai.count('analyze'), 0);
  assert.equal(ctx.session.aiRecording, false);
  assert.equal(ctx.session.cameraOn, false);
  assert.equal(ctx.clock.activeIntervals, 0);
});

test('IA: cancelar mientras se esperan los permisos libera todo y vuelve a la preparación', async () => {
  const ctx = make();
  toPrep(ctx);
  configure(ctx, { gestures: true });
  ctx.session.dispatch('BEGIN');
  assert.equal(ctx.session.state, S.STARTING);
  ctx.session.dispatch('CANCEL');
  assert.equal(ctx.session.state, S.PREP);
  assert.ok(ctx.ai.count('abort') >= 1);
  await flush();
  assert.equal(ctx.session.state, S.PREP, 'los permisos que llegan tarde no arrancan la sesión');
});

test('IA: si no quedó audio, se informa un error sin romper la devolución', async () => {
  const ctx = make({ speech: false, ai: new FakeAI({ noAudio: true }) });
  await present(ctx);
  ctx.session.dispatch('FINISH');
  await flush();
  assert.equal(ctx.session.data.ai.status, 'error');
  assert.equal(ctx.session.canRetryAi, false);
  assert.ok(ctx.session.getFeedback());
});

test('IA: reiniciar la experiencia borra cualquier rastro del análisis', async () => {
  const ctx = make({ speech: false });
  await present(ctx);
  ctx.session.dispatch('FINISH');
  await flush();
  ctx.ai.pending[0].resolve(analysisResult());
  await flush();
  assert.equal(ctx.session.data.ai.status, 'done');
  assert.ok(ctx.session.dispatch('RESET'));
  assert.equal(ctx.session.capture.aiResult, null);
  assert.equal(ctx.session.data.ai.status, 'off');
  assert.equal(ctx.session.data.options.aiAnalysis, false);
});

test('IA: sin el análisis activado no se toca nada de la IA', async () => {
  const ctx = make();
  toPrep(ctx);
  ctx.session.dispatch('BEGIN');
  await flush();
  ctx.clock.advance(5000);
  ctx.session.dispatch('FINISH');
  await flush();
  assert.deepEqual(ctx.ai.calls, []);
});

// ---------- Pantallas ----------

test('Pantallas: la configuración de IA y todos los estados de la devolución tienen botones válidos', async () => {
  const ctx = make({ speech: false });
  const { session, settings } = ctx;
  const check = () => {
    const model = buildScreen(session, settings, { speech: false, meter: false });
    const actions = [...model.panel.options, ...model.lectern.actions];
    for (const a of actions) {
      if (a.event && !a.disabled) assert.ok(FLOW[session.state][a.event] || a.event === 'AI_RETRY', `${session.state}: ${a.id} -> ${a.event}`);
    }
    assert.equal(new Set(actions.map((a) => a.id)).size, actions.length, 'ids repetidos');
    assert.ok(model.lectern.actions.filter((a) => a.kind === 'primary').length <= 1);
    return model;
  };

  toPrep(ctx);
  check();
  session.dispatch('OPEN_AI');
  const setup = check();
  assert.equal(setup.panel.title.join(' '), 'IA Y CÁMARA');
  assert.match(JSON.stringify(setup.panel.blocks), /Google/, 'avisa adónde se envía el audio');
  session.dispatch('TOGGLE_AI');
  session.dispatch('CLOSE');
  const prep = check();
  assert.ok(prep.panel.blocks.some((b) => b.t === 'notice' && b.kind === 'privacy' && /IA ACTIVADA/.test(b.label)));

  session.dispatch('BEGIN');
  await flush();
  check();
  session.dispatch('FINISH');
  await flush();

  const tabs = () => check().panel.options.filter((o) => o.kind === 'tab').map((o) => o.id);
  assert.deepEqual(tabs(), ['tab-0', 'tab-1', 'tab-2', 'tab-3', 'tab-4']);
  for (const page of [3, 4]) {
    session.dispatch('SET_PAGE', { page });
    const analyzing = check();
    assert.match(analyzing.panel.title.join(' '), /ANALIZANDO/);
  }

  ctx.ai.pending[0].reject(Object.assign(new Error('Se alcanzó el límite de uso de la clave.'), { code: 'quota' }));
  await flush();
  const errPage = check();
  assert.match(errPage.panel.title.join(' '), /NO SE PUDO/);
  assert.ok(errPage.panel.options.some((o) => o.id === 'ai-retry'));
  assert.match(JSON.stringify(errPage.panel.blocks), /límite de uso/);

  session.dispatch('AI_RETRY');
  await flush();
  ctx.ai.pending[1].resolve(analysisResult());
  await flush();
  session.dispatch('SET_PAGE', { page: 3 });
  const content = check();
  assert.equal(content.panel.title.join(' '), 'IA: CONTENIDO');
  const text = JSON.stringify(content.panel.blocks);
  assert.ok(text.includes(AI_DISCLAIMER), 'siempre se rotula como interpretación');
  assert.match(text, /CLARO|PARCIAL|FALTA/);
  session.dispatch('SET_PAGE', { page: 4 });
  const delivery = check();
  assert.equal(delivery.panel.title.join(' '), 'IA: ENTREGA');
  assert.match(JSON.stringify(delivery.panel.blocks), /NO MEDICIÓN/);
  session.dispatch('SET_PAGE', { page: 2 });
  assert.match(JSON.stringify(check().panel.blocks), /De la IA \(puede equivocarse\)/);
});

test('Pantallas: sin IA, las pestañas de IA no aparecen y se explica cómo activarla', async () => {
  const ctx = make();
  toPrep(ctx);
  ctx.session.dispatch('BEGIN');
  await flush();
  ctx.session.dispatch('FINISH');
  ctx.session.dispatch('CONTINUE');
  assert.equal(ctx.session.state, S.FEEDBACK);
  const model = buildScreen(ctx.session, ctx.settings, { speech: true, meter: true });
  assert.deepEqual(model.panel.options.filter((o) => o.kind === 'tab').map((o) => o.id), ['tab-0', 'tab-1', 'tab-2']);
  ctx.session.dispatch('SET_PAGE', { page: 2 });
  assert.match(JSON.stringify(buildScreen(ctx.session, ctx.settings, {}).panel.blocks), /SIN IA/);
});

test('Pantallas: el panel de texto escapa todo lo que escribe la IA (sin inyección de HTML)', async () => {
  const ctx = make({ speech: false });
  await present(ctx);
  ctx.session.dispatch('FINISH');
  await flush();
  const evil = structuredClone(GOOD_ANALYSIS);
  evil.summary = '<img src=x onerror=alert(1)>';
  evil.rubric.problem.quote = '"><script>alert(2)</script>';
  evil.rubric.problem.note = '<b>negrita</b>';
  evil.improvements = [{ advice: '<a href="javascript:alert(3)">click</a>', why: '</li><script>x</script>' }];
  evil.strengths = ['<svg onload=alert(4)>'];
  evil.limitations = ['<iframe src=//evil></iframe>'];
  evil.delivery.pace.observation = '<img src=y onerror=alert(5)>';
  ctx.ai.pending[0].resolve({ analysis: normalizeAnalysis(evil), model: '<b>modelo</b>', usage: null });
  await flush();

  for (const page of [3, 4]) {
    ctx.session.dispatch('SET_PAGE', { page });
    const model = buildScreen(ctx.session, ctx.settings, {});
    const html = model.panel.blocks.map(renderBlock).join('');
    assert.doesNotMatch(html, /<(img|script|svg|iframe|b|a)[\s>]/i, `página ${page}: HTML sin escapar`);
    // Solo se miran etiquetas reales (todo "<" de la IA llega como &lt;): ninguna puede traer un atributo de evento.
    assert.doesNotMatch(html, /<[^>]*\son\w+\s*=/i, `página ${page}: atributo de evento en una etiqueta real`);
    assert.ok(html.includes(page === 3 ? '&lt;img src=x onerror=alert(1)&gt;' : '&lt;img src=y onerror=alert(5)&gt;'), 'el texto de la IA se muestra tal cual, como texto');
  }
});

test('Pantallas: si se usó el modelo de respaldo, la devolución dice cuál falló y por qué', async () => {
  const ctx = make({ speech: false });
  await present(ctx);
  ctx.session.dispatch('FINISH');
  await flush();
  ctx.ai.pending[0].resolve({ ...analysisResult('gemini-3.1-flash-lite'), attempts: [{ model: 'gemini-3.5-flash-lite', code: 'quota' }] });
  await flush();
  assert.deepEqual(ctx.session.getFeedback().ai.failedBefore, ['gemini-3.5-flash-lite (cuota agotada)']);
  ctx.session.dispatch('SET_PAGE', { page: 3 });
  const html = buildScreen(ctx.session, ctx.settings, {}).panel.blocks.map(renderBlock).join('');
  assert.ok(html.includes('Modelo: gemini-3.1-flash-lite. Antes se intentó con gemini-3.5-flash-lite (cuota agotada).'), 'el pie del informe dice qué modelo falló y por qué');
});

test('Pantallas: el detalle de la IA en el panel de texto incluye citas, consejos con motivo y límites', async () => {
  const ctx = make({ speech: false });
  await present(ctx, { gestures: true });
  ctx.session.dispatch('FINISH');
  await flush();
  ctx.ai.pending[0].resolve(analysisResult());
  await flush();
  ctx.session.dispatch('SET_PAGE', { page: 3 });
  let html = buildScreen(ctx.session, ctx.settings, {}).panel.blocks.map(renderBlock).join('');
  assert.match(html, /nadie conoce la marca/);
  assert.match(html, /Por qué: El cierre no aparece/);
  assert.match(html, /Lo que funcionó/);
  assert.match(html, /gemini-3.5-flash-lite/);
  ctx.session.dispatch('SET_PAGE', { page: 4 });
  html = buildScreen(ctx.session, ctx.settings, {}).panel.blocks.map(renderBlock).join('');
  assert.match(html, /Muletillas/);
  assert.match(html, /Límites de este análisis/);
  assert.match(html, /Manos a la vista el 70 %/);
  assert.match(html, /no evalúa si el gesto fue adecuado/);
});
