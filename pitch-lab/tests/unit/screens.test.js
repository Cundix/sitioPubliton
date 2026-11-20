import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../../js/core/session.js';
import { Settings } from '../../js/core/settings.js';
import { buildScreen } from '../../js/core/screens.js';
import { S, FLOW } from '../../js/core/state-machine.js';
import { FakeClock, FakeVoice, flush } from './helpers.js';

function make({ speech = true } = {}) {
  const clock = new FakeClock();
  const session = new Session({ clock, voice: speech ? new FakeVoice() : null, capabilities: { speech }, tutorialSeen: false });
  const settings = new Settings();
  session.start();
  return { session, settings, clock };
}

/** Todas las acciones con "event" de una pantalla deben estar permitidas en ese estado. */
function checkScreen(session, settings, env = { speech: true, meter: true }) {
  const model = buildScreen(session, settings, env);
  const actions = [...model.panel.options, ...model.lectern.actions];
  for (const a of actions) {
    if (a.event && !a.disabled) {
      assert.ok(FLOW[session.state][a.event], `${session.state}: el botón "${a.id}" envía ${a.event}, que no está permitido en ese estado`);
    }
    assert.ok(a.id && a.label && a.kind, `${session.state}: acción incompleta ${JSON.stringify(a)}`);
  }
  assert.ok(model.lectern.actions.length <= 4, `${session.state}: demasiados botones en el atril`);
  assert.ok(model.lectern.actions.filter((a) => a.kind === 'primary').length <= 1, `${session.state}: más de una acción principal`);
  const ids = actions.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, `${session.state}: ids repetidos`);
  assert.ok(model.announce.length > 0);
  return model;
}

test('Cada pantalla tiene a lo sumo una acción principal y todos sus botones son válidos en ese estado', async () => {
  const { session, settings } = make();
  const seen = new Set();
  const visit = () => { seen.add(session.state); return checkScreen(session, settings); };

  visit();                                   // home
  session.dispatch('OPEN_SETTINGS'); visit(); session.dispatch('CLOSE');
  session.dispatch('START'); visit();        // tutorial
  session.dispatch('NEXT'); visit(); session.dispatch('NEXT'); visit(); session.dispatch('NEXT');
  visit();                                   // select (sin elegir)
  session.dispatch('PICK_SCENARIO', { id: 'cliente' }); visit();
  session.dispatch('OPEN_SETTINGS'); visit(); session.dispatch('CLOSE');
  session.dispatch('ENTER'); visit();        // brief
  session.dispatch('PREPARE'); visit();      // prep
  session.dispatch('SET_INPUT_MODE', { mode: 'timer' }); visit();
  session.dispatch('SET_INPUT_MODE', { mode: 'voice' });
  session.dispatch('BEGIN'); visit();        // starting
  await flush();
  visit();                                   // presenting
  session.dispatch('PAUSE'); visit();
  session.dispatch('REQUEST_CANCEL'); visit();
  session.dispatch('KEEP'); session.dispatch('RESUME');
  session.pushFinal('hola equipo esta es una frase de prueba para la revisión');
  session.dispatch('FINISH'); visit();       // review
  session.dispatch('CONTINUE');
  for (let page = 0; page < 3; page++) { session.dispatch('SET_PAGE', { page }); visit(); }
  session.dispatch('RETRY'); visit();        // prep otra vez

  for (const st of [S.HOME, S.TUTORIAL, S.SETTINGS, S.SELECT, S.BRIEF, S.PREP, S.STARTING, S.PRESENTING, S.PAUSED, S.CONFIRM_CANCEL, S.REVIEW, S.FEEDBACK]) {
    assert.ok(seen.has(st), `no se visitó ${st}`);
  }
});

test('Pantalla de problema de voz y de reconocimiento no disponible', async () => {
  const { session, settings } = make({ speech: false });
  session.dispatch('START'); session.dispatch('SKIP');
  session.dispatch('PICK_SCENARIO', { id: 'sala' }); session.dispatch('ENTER'); session.dispatch('PREPARE');
  const prep = checkScreen(session, settings, { speech: false, meter: false });
  assert.equal(prep.panel.options.find((o) => o.id === 'mode-voice').disabled, true);
  session.dispatch('BEGIN');
  const { session: s2, settings: st2 } = make({ speech: true });
  s2.voice.startError = null;
  s2.voice.start = () => Promise.reject(Object.assign(new Error('x'), { code: 'denied' }));
  s2.dispatch('START'); s2.dispatch('SKIP'); s2.dispatch('PICK_SCENARIO', { id: 'sala' }); s2.dispatch('ENTER'); s2.dispatch('PREPARE'); s2.dispatch('BEGIN');
  await flush();
  assert.equal(s2.state, S.VOICE_PROBLEM);
  const model = checkScreen(s2, st2);
  assert.match(model.panel.title.join(' '), /SIN ACCESO/);
});

test('El reloj marca avisos con texto y no solo con color', () => {
  const { session, settings, clock } = make();
  session.dispatch('START'); session.dispatch('SKIP'); session.dispatch('PICK_SCENARIO', { id: 'sala' });
  session.dispatch('ENTER'); session.dispatch('PREPARE'); session.dispatch('SET_INPUT_MODE', { mode: 'timer' }); session.dispatch('BEGIN');
  clock.advance(45_000);
  const warn = buildScreen(session, settings).clock;
  assert.equal(warn.warning, 'warning');
  assert.match(warn.sub, /POCO TIEMPO/);
  clock.advance(7_000);
  const final = buildScreen(session, settings).clock;
  assert.equal(final.warning, 'final');
  assert.match(final.sub, /CUENTA FINAL/);
  assert.equal(final.time, '0:08');
});

// ---------- Revisión con «UX for XR»: opciones de VR, mantener presionado y textos para el casco ----------

function toPresenting(opts) {
  const m = make(opts);
  const { session } = m;
  session.dispatch('START'); session.dispatch('SKIP'); session.dispatch('PICK_SCENARIO', { id: 'sala' });
  session.dispatch('ENTER'); session.dispatch('PREPARE'); session.dispatch('SET_INPUT_MODE', { mode: 'timer' }); session.dispatch('BEGIN');
  return m;
}

test('Ajustes: las opciones de comodidad en VR están en el menú 3D (en dos columnas) y reflejan las preferencias', () => {
  const { session, settings } = make();
  session.dispatch('OPEN_SETTINGS');
  const model = checkScreen(session, settings);
  assert.equal(model.panel.layout, 'grid');
  const ids = model.panel.options.map((o) => o.id);
  for (const id of ['vol-down', 'vol-up', 'motion', 'seated', 'snap', 'haptics', 'height-down', 'height-up']) assert.ok(ids.includes(id), `falta «${id}»`);
  assert.equal(model.panel.options.length, 8, 'ocho opciones = cuatro filas de dos');
  assert.match(model.panel.options.find((o) => o.id === 'snap').label, /30°/);
  assert.equal(model.panel.options.find((o) => o.id === 'haptics').on, true);
  settings.set('snapTurnDeg', 0);
  settings.set('haptics', false);
  settings.set('heightCm', -10);
  const next = buildScreen(session, settings, { speech: true, meter: true });
  assert.match(next.panel.options.find((o) => o.id === 'snap').label, /Desactivado/);
  assert.equal(next.panel.options.find((o) => o.id === 'haptics').on, false);
  const height = next.panel.blocks.find((b) => b.t === 'kv');
  assert.match(height.rows[0].v, /−10 cm/);
});

test('Finalizar pide mantener presionado (en la presentación y en la pausa) y el resto de las acciones no', () => {
  const { session, settings } = toPresenting();
  const live = checkScreen(session, settings);
  const finish = live.lectern.actions.find((a) => a.id === 'finish');
  assert.equal(finish.hold, true);
  assert.match(finish.holdHint, /Mantené presionado/);
  assert.equal(live.lectern.actions.filter((a) => a.hold).length, 1, 'solo «Finalizar» pide mantener');
  session.dispatch('PAUSE');
  const paused = checkScreen(session, settings);
  assert.equal(paused.lectern.actions.find((a) => a.id === 'finish').hold, true);
  assert.ok(!paused.lectern.actions.find((a) => a.id === 'resume').hold);
  // La tecla F y el panel de texto no pasan por el botón 3D: el evento FINISH sigue valiendo sin pulsación sostenida.
  assert.equal(session.dispatch('FINISH'), true);
});

test('El reloj trae un texto corto para el atril en todos los modos (preparación, en vivo, pausa, aviso)', () => {
  const { session, settings, clock } = make();
  session.dispatch('START'); session.dispatch('SKIP'); session.dispatch('PICK_SCENARIO', { id: 'sala' });
  assert.equal(buildScreen(session, settings).clock.mode, 'idle');
  session.dispatch('ENTER'); session.dispatch('PREPARE'); session.dispatch('SET_INPUT_MODE', { mode: 'timer' });
  const prep = buildScreen(session, settings).clock;
  assert.equal(prep.mode, 'prep');
  assert.ok(prep.short && prep.short.length <= 14, `prep: «${prep.short}»`);
  session.dispatch('BEGIN');
  assert.equal(buildScreen(session, settings).clock.short, 'EN TIEMPO');
  clock.advance(45_000);
  assert.equal(buildScreen(session, settings).clock.short, 'POCO TIEMPO');
  clock.advance(7_000);
  assert.equal(buildScreen(session, settings).clock.short, 'CUENTA FINAL');
  session.dispatch('PAUSE');
  const paused = buildScreen(session, settings).clock;
  assert.equal(paused.short, 'DETENIDO');
  assert.equal(paused.paused, true);
});

test('Los textos para el casco dicen lo mismo que los completos pero son más cortos, y los avisos de privacidad no se pierden', () => {
  const { session, settings } = make();
  session.dispatch('START'); session.dispatch('SKIP'); session.dispatch('PICK_SCENARIO', { id: 'sala' });
  session.dispatch('ENTER'); session.dispatch('PREPARE');
  const mic = buildScreen(session, settings, { speech: true, meter: true }).panel.blocks.find((b) => b.t === 'notice');
  assert.match(mic.text, /servicio externo/, 'el panel de texto conserva el aviso completo');
  assert.ok(mic.text3D && mic.text3D.length < mic.text.length, 'el casco tiene una versión más corta');
  assert.match(mic.text3D, /micrófono/);
  assert.match(mic.text3D, /servicio externo/);
  assert.match(mic.text3D, /No se guarda audio ni texto/, 'sigue diciendo que no se guarda nada');
});

test('Devolución: tarjetas de las medidas principales en 3D, detalle completo en el panel de texto y consejos con versión corta', async () => {
  const { session, settings } = make();
  session.dispatch('START'); session.dispatch('SKIP'); session.dispatch('PICK_SCENARIO', { id: 'sala' });
  session.dispatch('ENTER'); session.dispatch('PREPARE'); session.dispatch('SET_INPUT_MODE', { mode: 'timer' });
  session.dispatch('BEGIN'); await flush();
  session.dispatch('FINISH');
  const model = checkScreen(session, settings);
  assert.equal(session.state, S.FEEDBACK);
  const cards = model.panel.blocks.find((b) => b.t === 'measures' && b.cards);
  assert.ok(cards && cards.only3D, 'hay tarjetas solo para el casco');
  assert.deepEqual(cards.rows.map((r) => r.id), ['duration', 'timeUse', 'wpm', 'fillers']);
  for (const r of cards.rows) assert.ok(r.short, `la medida ${r.id} tiene nombre corto`);
  const full = model.panel.blocks.find((b) => b.t === 'measures' && b.htmlOnly);
  assert.ok(full && full.rows.length >= cards.rows.length, 'el panel de texto sigue mostrando todas las medidas');
  // Las medidas que no se pudieron calcular se muestran como tales (no se esconden)
  assert.ok(cards.rows.some((r) => !r.available), 'sin voz, palabras por minuto y muletillas figuran como sin datos');
  session.dispatch('SET_PAGE', { page: 2 });
  const tips = buildScreen(session, settings).panel.blocks.find((b) => b.t === 'tips');
  for (const tip of tips.items) {
    assert.ok(tip.short && tip.short.length < tip.text.length, 'cada consejo tiene una versión corta');
    assert.ok(tip.basedOn, 'y sigue diciendo en qué dato se basa');
  }
  const human = buildScreen(session, settings).panel.blocks.filter((b) => b.heading === 'Requiere revisión humana');
  assert.equal(human.length, 2, 'una lista completa (texto) y una frase corta (3D)');
  assert.ok(human.some((b) => b.htmlOnly) && human.some((b) => b.only3D));
});
