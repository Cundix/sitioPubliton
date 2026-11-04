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
