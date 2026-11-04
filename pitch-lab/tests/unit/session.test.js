import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../../js/core/session.js';
import { S, FLOW, allowedEvents } from '../../js/core/state-machine.js';
import { FakeClock, FakeVoice, FakeMeter, flush } from './helpers.js';

function make({ voice = new FakeVoice(), meter = null, speech = true, tutorialSeen = true } = {}) {
  const clock = new FakeClock();
  const session = new Session({ clock, voice, meter, capabilities: { speech }, tutorialSeen });
  session.start();
  return { session, clock, voice, meter };
}

/** Lleva la sesión hasta la preparación del escenario indicado. */
function toPrep(ctx, id = 'sala') {
  const { session } = ctx;
  assert.ok(session.dispatch('START'));
  assert.ok(session.dispatch('PICK_SCENARIO', { id }));
  assert.ok(session.dispatch('ENTER'));
  assert.ok(session.dispatch('PREPARE'));
  assert.equal(session.state, S.PREP);
}

async function toPresenting(ctx, id = 'sala') {
  toPrep(ctx, id);
  ctx.session.dispatch('BEGIN');
  await flush();
  assert.equal(ctx.session.state, S.PRESENTING);
}

test('Todos los estados definidos en la tabla son alcanzables y existen', () => {
  const states = Object.values(S);
  for (const state of states) {
    if (state !== S.LOADING) assert.ok(FLOW[state], `falta FLOW para ${state}`);
  }
  assert.ok(allowedEvents(S.PRESENTING).includes('PAUSE'));
});

test('Inicio: primer ingreso pasa por el tutorial; si ya se vio, va directo a elegir escenario', () => {
  const a = make({ tutorialSeen: false });
  a.session.dispatch('START');
  assert.equal(a.session.state, S.TUTORIAL);
  a.session.dispatch('SKIP');
  assert.equal(a.session.state, S.SELECT);
  assert.equal(a.session.data.tutorialSeen, true);

  const b = make({ tutorialSeen: true });
  b.session.dispatch('START');
  assert.equal(b.session.state, S.SELECT);
});

test('Tutorial: avanza por pasos y al terminar vuelve a donde corresponde', () => {
  const { session } = make({ tutorialSeen: false });
  session.dispatch('START');
  assert.equal(session.data.tutorialStep, 0);
  session.dispatch('NEXT'); session.dispatch('NEXT');
  assert.equal(session.state, S.TUTORIAL);
  assert.equal(session.data.tutorialStep, 2);
  session.dispatch('NEXT');
  assert.equal(session.state, S.SELECT);
});

test('Tutorial: BACK no baja del primer paso', () => {
  const { session } = make({ tutorialSeen: false });
  session.dispatch('START');
  assert.equal(session.dispatch('BACK'), false);
});

test('Eventos que no corresponden al estado se rechazan', () => {
  const { session } = make();
  const rejected = [];
  session.on('rejected', (e) => rejected.push(e));
  assert.equal(session.dispatch('PAUSE'), false);
  assert.equal(session.dispatch('FINISH'), false);
  assert.equal(session.state, S.HOME);
  assert.equal(rejected.length, 2);
});

test('No se puede entrar a un escenario sin elegirlo', () => {
  const { session } = make();
  session.dispatch('START');
  assert.equal(session.dispatch('ENTER'), false);
  assert.equal(session.dispatch('PICK_SCENARIO', { id: 'inexistente' }), false);
});

test('Flujo completo con micrófono aceptado y vuelta a intentar', async () => {
  const ctx = make();
  const { session, clock, voice } = ctx;
  await toPresenting(ctx);
  assert.deepEqual(voice.calls, ['start']);

  clock.advance(30_000);
  session.pushFinal('hola equipo presentamos una idea');
  session.pushFinal('para invitar a hacer una pausa');
  session.dispatch('FINISH');
  assert.equal(session.state, S.REVIEW);
  assert.equal(session.getTranscript().source, 'speech');
  assert.equal(Math.round(session.capture.activeMs / 1000), 30);

  session.dispatch('CONTINUE');
  assert.equal(session.state, S.FEEDBACK);
  const fb = session.getFeedback();
  assert.equal(fb.metrics.words.value, 11);
  assert.equal(fb.metrics.duration.value, 30);

  session.dispatch('RETRY');
  assert.equal(session.state, S.PREP);
  assert.equal(session.getTranscript().text, '', 'el reintento no arrastra la transcripción anterior');
  assert.equal(session.capture.activeMs, 0);
});

test('El tiempo efectivo excluye las pausas', async () => {
  const ctx = make();
  await toPresenting(ctx);
  const { session, clock } = ctx;
  clock.advance(10_000);
  session.dispatch('PAUSE');
  assert.equal(session.state, S.PAUSED);
  clock.advance(25_000); // en pausa: no cuenta
  assert.equal(session.getTimeView().elapsedSec, 10);
  session.dispatch('RESUME');
  clock.advance(5_000);
  assert.equal(session.getTimeView().elapsedSec, 15);
  assert.equal(session.getTimeView().remainingSec, 45);
});

test('Cuenta regresiva: avisa en los umbrales y termina sola al llegar a cero', async () => {
  const ctx = make();
  await toPresenting(ctx);
  const { session, clock } = ctx;
  const levels = [];
  session.on('warning', (e) => levels.push(e.level));
  clock.advance(39_000);
  assert.deepEqual(levels, []);
  clock.advance(1_000); // quedan 20 s
  assert.deepEqual(levels, ['warning']);
  clock.advance(10_000); // quedan 10 s
  assert.deepEqual(levels, ['warning', 'final']);
  clock.advance(10_500);
  assert.equal(session.state, S.REVIEW);
  assert.equal(session.data.notice.text, 'Se cumplió el tiempo del escenario.');
  assert.equal(clock.activeIntervals, 0, 'no queda ningún temporizador activo');
});

test('Nunca hay más de un temporizador activo', async () => {
  const ctx = make();
  const { session, clock } = ctx;
  toPrep(ctx);
  assert.ok(clock.activeIntervals <= 1);
  session.dispatch('ADJUST_PREP', { delta: 15 });
  session.restartPrepCountdown();
  assert.ok(clock.activeIntervals <= 1);
  session.dispatch('BEGIN');
  await flush();
  assert.equal(clock.activeIntervals, 1);
  session.dispatch('PAUSE');
  assert.equal(clock.activeIntervals, 0);
  session.dispatch('RESUME');
  assert.equal(clock.activeIntervals, 1);
});

test('Preparación: la cuenta regresiva se detiene al salir y no empieza la presentación sola', () => {
  const ctx = make();
  const { session, clock } = ctx;
  toPrep(ctx);
  assert.equal(session.getTimeView().prepRemainingSec, 45);
  clock.advance(46_000);
  assert.equal(session.getTimeView().prepDone, true);
  assert.equal(session.state, S.PREP, 'la preparación no comienza la presentación por sí sola');
  assert.equal(clock.activeIntervals, 0);
  session.dispatch('BACK');
  assert.equal(session.state, S.BRIEF);
  assert.equal(clock.activeIntervals, 0);
});

test('Preparación: el tiempo se ajusta dentro de los límites', () => {
  const ctx = make();
  toPrep(ctx);
  const { session } = ctx;
  for (let i = 0; i < 40; i++) session.dispatch('ADJUST_PREP', { delta: 15 });
  assert.equal(session.data.options.prepSec, 300);
  for (let i = 0; i < 40; i++) session.dispatch('ADJUST_PREP', { delta: -15 });
  assert.equal(session.data.options.prepSec, 0);
  assert.equal(session.getTimeView().prepRemainingSec, null);
});

test('Cancelar pide confirmación, pausa el tiempo y deja la sesión limpia', async () => {
  const ctx = make();
  await toPresenting(ctx);
  const { session, clock, voice } = ctx;
  clock.advance(12_000);
  session.pushFinal('texto que se debe descartar');
  session.dispatch('REQUEST_CANCEL');
  assert.equal(session.state, S.CONFIRM_CANCEL);
  clock.advance(60_000);
  assert.equal(session.getTimeView().elapsedSec, 12, 'el tiempo no corre mientras se confirma');

  session.dispatch('CONFIRM');
  assert.equal(session.state, S.BRIEF);
  assert.equal(session.getTranscript().text, '');
  assert.equal(session.capture.activeMs, 0);
  assert.equal(clock.activeIntervals, 0);
  assert.ok(voice.calls.includes('abort'), 'se liberó el reconocimiento');
  assert.equal(session.data.notice.text, 'Sesión cancelada. No se guardó nada.');
  clock.advance(120_000);
  assert.equal(session.state, S.BRIEF, 'no continúa ninguna sesión después de cancelar');
});

test('Cancelar y arrepentirse vuelve al estado desde el que se pidió', async () => {
  const ctx = make();
  await toPresenting(ctx);
  const { session, clock } = ctx;
  clock.advance(5_000);
  session.dispatch('PAUSE');
  session.dispatch('REQUEST_CANCEL');
  session.dispatch('KEEP');
  assert.equal(session.state, S.PAUSED);

  session.dispatch('RESUME');
  clock.advance(3_000);
  session.dispatch('REQUEST_CANCEL');
  session.dispatch('KEEP');
  assert.equal(session.state, S.PRESENTING);
  clock.advance(2_000);
  assert.equal(session.getTimeView().elapsedSec, 10);
});

test('RESET no se permite durante una sesión activa, sí en pantallas estáticas', async () => {
  const ctx = make();
  await toPresenting(ctx);
  const { session } = ctx;
  assert.equal(session.dispatch('RESET'), false);
  assert.equal(session.state, S.PRESENTING);

  session.dispatch('FINISH');
  assert.equal(session.dispatch('RESET'), true);
  assert.equal(session.state, S.HOME);
  assert.equal(session.data.scenarioId, null);
  assert.equal(session.data.tutorialSeen, true, 'conserva el tutorial visto');
});

test('Micrófono rechazado: se ofrece alternativa y se puede seguir sin voz', async () => {
  const ctx = make({ voice: new FakeVoice({ startError: 'denied' }) });
  const { session, clock } = ctx;
  toPrep(ctx);
  session.dispatch('BEGIN');
  assert.equal(session.state, S.STARTING);
  await flush();
  assert.equal(session.state, S.VOICE_PROBLEM);
  assert.equal(session.data.voiceProblem.code, 'denied');
  assert.equal(clock.activeIntervals, 0, 'el tiempo no corre mientras no hay permiso');

  session.dispatch('USE_TIMER_ONLY');
  assert.equal(session.state, S.PRESENTING);
  assert.equal(session.data.options.inputMode, 'timer');
  clock.advance(20_000);
  session.dispatch('FINISH');
  assert.equal(session.state, S.FEEDBACK, 'sin voz no hay revisión de transcripción');
  const fb = session.getFeedback();
  assert.equal(fb.metrics.duration.value, 20);
  assert.equal(fb.banners[0].label, 'SIN VOZ');
});

test('Micrófono rechazado: el reintento es una acción explícita y vuelve a pedir una sola vez', async () => {
  const voice = new FakeVoice({ startError: 'denied' });
  const ctx = make({ voice });
  const { session } = ctx;
  toPrep(ctx);
  session.dispatch('BEGIN');
  await flush();
  assert.equal(voice.calls.filter((c) => c === 'start').length, 1);
  await flush();
  assert.equal(voice.calls.filter((c) => c === 'start').length, 1, 'no reintenta solo');
  session.dispatch('RETRY_VOICE');
  await flush();
  assert.equal(voice.calls.filter((c) => c === 'start').length, 2);
  assert.equal(session.data.voiceRetries, 1);
});

test('Cancelar mientras se espera el permiso ignora la respuesta tardía', async () => {
  let resolveStart;
  const voice = new FakeVoice();
  voice.start = () => new Promise((resolve) => { resolveStart = resolve; });
  const ctx = make({ voice });
  const { session } = ctx;
  toPrep(ctx);
  session.dispatch('BEGIN');
  assert.equal(session.state, S.STARTING);
  session.dispatch('CANCEL');
  assert.equal(session.state, S.PREP);
  resolveStart();
  await flush();
  assert.equal(session.state, S.PREP, 'la respuesta tardía no inicia una sesión');
  assert.ok(voice.calls.includes('abort'));
});

test('Reconocimiento no disponible: la opción de voz se rechaza y la sesión usa temporizador', async () => {
  const ctx = make({ voice: null, speech: false });
  const { session } = ctx;
  toPrep(ctx);
  assert.equal(session.data.options.inputMode, 'timer');
  assert.equal(session.dispatch('SET_INPUT_MODE', { mode: 'voice' }), false);
  session.dispatch('BEGIN');
  assert.equal(session.state, S.PRESENTING);
});

test('Silencio: sin frases reconocidas la revisión queda vacía y la devolución indica falta de datos', async () => {
  const ctx = make();
  await toPresenting(ctx);
  const { session, clock } = ctx;
  clock.advance(30_000);
  session.dispatch('FINISH');
  assert.equal(session.state, S.REVIEW);
  assert.equal(session.getTranscript().source, 'none');
  session.dispatch('CONTINUE');
  const fb = session.getFeedback();
  assert.equal(fb.indicator.available, false);
  assert.equal(fb.metrics.words.available, false);
});

test('Transcripción editada o escrita conserva su origen', async () => {
  const ctx = make();
  await toPresenting(ctx);
  const { session, clock } = ctx;
  clock.advance(30_000);
  session.pushFinal('texto reconocido original');
  session.dispatch('FINISH');

  session.dispatch('SET_TRANSCRIPT', { text: 'texto reconocido original' });
  assert.equal(session.getTranscript().source, 'speech', 'sin cambios sigue siendo reconocimiento');

  session.dispatch('SET_TRANSCRIPT', { text: 'texto corregido por la persona' });
  assert.equal(session.getTranscript().source, 'speech-edited');

  session.dispatch('LOAD_DEMO');
  assert.equal(session.getTranscript().source, 'demo');
});

test('Texto escrito sin reconocimiento previo se marca como escrito', async () => {
  const ctx = make();
  await toPresenting(ctx);
  const { session, clock } = ctx;
  clock.advance(30_000);
  session.dispatch('FINISH');
  session.dispatch('SET_TRANSCRIPT', { text: 'lo escribí yo mismo' });
  assert.equal(session.getTranscript().source, 'typed');
  session.dispatch('CONTINUE');
  assert.equal(session.getFeedback().metrics.wpm.available, false);
});

test('Frases tardías del reconocimiento se aceptan al cerrar, pero no después de la devolución', async () => {
  const ctx = make();
  await toPresenting(ctx);
  const { session, clock } = ctx;
  clock.advance(20_000);
  session.dispatch('FINISH');
  session.pushFinal('última frase tardía');
  assert.equal(session.getTranscript().text, 'última frase tardía');
  session.dispatch('CONTINUE');
  session.pushFinal('no debería entrar');
  assert.equal(session.getTranscript().text, 'última frase tardía');
});

test('Fuera de la presentación no se aceptan frases', () => {
  const { session } = make();
  session.pushFinal('hola');
  assert.equal(session.getTranscript().text, '');
});

test('Rúbrica: se completa en la devolución y no afecta otras pantallas', async () => {
  const ctx = make({ voice: null, speech: false });
  const { session, clock } = ctx;
  toPrep(ctx);
  session.dispatch('BEGIN');
  clock.advance(15_000);
  session.dispatch('FINISH');
  assert.equal(session.state, S.FEEDBACK);
  assert.equal(session.dispatch('RUBRIC_CYCLE', { id: 'problem' }), true);
  assert.equal(session.data.rubric.problem, 'yes');
  assert.equal(session.dispatch('RUBRIC_CYCLE', { id: 'otra' }), false);
  assert.equal(session.getFeedback().rubricSummary.answered, 1);
  session.dispatch('CHANGE_SCENARIO');
  assert.equal(session.state, S.SELECT);
  assert.equal(session.dispatch('RUBRIC_CYCLE', { id: 'problem' }), false);
});

test('Cambiar de escenario y reintentar parte de cero', async () => {
  const ctx = make({ voice: null, speech: false });
  const { session, clock } = ctx;
  toPrep(ctx, 'sala');
  session.dispatch('BEGIN');
  clock.advance(10_000);
  session.dispatch('FINISH');
  session.dispatch('CHANGE_SCENARIO');
  session.dispatch('PICK_SCENARIO', { id: 'auditorio' });
  session.dispatch('ENTER');
  session.dispatch('PREPARE');
  assert.equal(session.scenario.id, 'auditorio');
  assert.equal(session.capture.activeMs, 0);
  assert.equal(session.getTimeView().totalSec, 120);
  assert.equal(session.getTimeView().prepRemainingSec, 90);
});

test('Práctica sin límite: no hay tiempo total ni cierre automático', async () => {
  const ctx = make();
  toPrep(ctx);
  const { session, clock } = ctx;
  session.dispatch('TOGGLE_UNLIMITED');
  session.dispatch('BEGIN');
  await flush();
  clock.advance(600_000);
  assert.equal(session.state, S.PRESENTING);
  assert.equal(session.getTimeView().totalSec, null);
  assert.equal(session.getTimeView().warning, 'none');
});

test('Medición de audio: solo con voz, y los resultados vienen del medidor', async () => {
  const meter = new FakeMeter();
  const ctx = make({ meter });
  toPrep(ctx);
  const { session, clock } = ctx;
  session.dispatch('TOGGLE_METER');
  session.dispatch('BEGIN');
  await flush();
  clock.advance(30_000);
  session.dispatch('FINISH');
  session.dispatch('CONTINUE');
  const fb = session.getFeedback();
  assert.equal(fb.metrics.audio.available, true);
  assert.ok(meter.calls.includes('start'));
  assert.ok(meter.calls.includes('stop'));
});

test('Medición de audio: sin activarla no se mide ni se informa', async () => {
  const meter = new FakeMeter();
  const ctx = make({ meter });
  await toPresenting(ctx);
  const { session, clock } = ctx;
  clock.advance(30_000);
  session.dispatch('FINISH');
  session.dispatch('CONTINUE');
  const fb = session.getFeedback();
  // El medidor no se inició, así que no hay medición de audio ni se la informa.
  assert.equal(meter.calls.includes('start'), false);
  assert.equal(fb.metrics.audio.available, false);
});

test('Pestaña oculta durante la presentación pausa automáticamente', async () => {
  const ctx = make();
  await toPresenting(ctx);
  const { session, clock } = ctx;
  clock.advance(8_000);
  session.dispatch('VISIBILITY_HIDDEN');
  assert.equal(session.state, S.PAUSED);
  assert.match(session.data.notice.text, /segundo plano/);
  assert.equal(session.dispatch('VISIBILITY_HIDDEN'), false);
});

test('dispose libera temporizador y medios', async () => {
  const meter = new FakeMeter();
  const ctx = make({ meter });
  toPrep(ctx);
  ctx.session.dispatch('TOGGLE_METER');
  ctx.session.dispatch('BEGIN');
  await flush();
  const { session, clock, voice } = ctx;
  session.dispose();
  assert.equal(clock.activeIntervals, 0);
  assert.ok(voice.calls.includes('abort'));
  assert.ok(meter.calls.includes('dispose'));
  assert.equal(session.dispatch('PAUSE'), false);
});

test('Las pantallas estáticas no dejan temporizadores', () => {
  const ctx = make();
  const { session, clock } = ctx;
  assert.equal(clock.activeIntervals, 0);
  session.dispatch('START');
  session.dispatch('PICK_SCENARIO', { id: 'cliente' });
  session.dispatch('ENTER');
  session.dispatch('NEXT_BRIEF');
  assert.equal(session.data.briefIndex, 1);
  assert.equal(clock.activeIntervals, 0);
});
