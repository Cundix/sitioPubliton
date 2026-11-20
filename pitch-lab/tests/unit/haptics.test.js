// Pruebas de la vibración de los controles (Haptics). No usan un casco ni A-Frame: se simula la sesión con controles falsos.

import test from 'node:test';
import assert from 'node:assert/strict';
import { Settings } from '../../js/core/settings.js';

// xr-support.js registra un componente de A-Frame al importarse: se reemplaza A-Frame por un dato mínimo.
globalThis.AFRAME = { registerComponent() {}, THREE: {} };
const { Haptics, HAPTIC_PULSES } = await import('../../js/components/xr-support.js');

function fakeSource(handedness, { actuator = true, playEffect = false } = {}) {
  const calls = [];
  const gamepad = {};
  if (actuator) gamepad.hapticActuators = [{ pulse: (intensity, ms) => { calls.push({ intensity, ms }); return Promise.resolve(true); } }];
  if (playEffect) gamepad.vibrationActuator = { playEffect: (type, params) => { calls.push({ type, ...params }); return Promise.resolve('complete'); } };
  return { handedness, gamepad, calls };
}

function rig({ sources = [fakeSource('left'), fakeSource('right')], haptics = true } = {}) {
  const settings = new Settings();
  settings.set('haptics', haptics);
  let t = 1000;
  const state = { session: { inputSources: sources } };
  const h = new Haptics({ getSession: () => state.session, settings, now: () => t });
  return { h, sources, settings, state, advance: (ms) => { t += ms; } };
}

test('vibra solo el control que apuntó y con la intensidad del evento', () => {
  const { h, sources } = rig();
  assert.equal(h.pulse('right', 'press'), true);
  assert.deepEqual(sources[1].calls, [{ intensity: HAPTIC_PULSES.press.intensity, ms: HAPTIC_PULSES.press.ms }]);
  assert.deepEqual(sources[0].calls, [], 'el otro control no vibra');
  assert.equal(h.sent, 1);
});

test('apuntar vibra más suave y corto que presionar, y «no disponible» es lo más marcado', () => {
  assert.ok(HAPTIC_PULSES.hover.intensity < HAPTIC_PULSES.press.intensity);
  assert.ok(HAPTIC_PULSES.hover.ms < HAPTIC_PULSES.press.ms);
  assert.ok(HAPTIC_PULSES.denied.intensity >= HAPTIC_PULSES.press.intensity);
  for (const [name, p] of Object.entries(HAPTIC_PULSES)) {
    assert.ok(p.intensity > 0 && p.intensity <= 1, `${name}: intensidad entre 0 y 1`);
    assert.ok(p.ms > 0 && p.ms <= 200, `${name}: duración corta`);
  }
});

test('con la vibración apagada no se envía nada', () => {
  const { h, sources, settings } = rig({ haptics: false });
  assert.equal(h.pulse('right', 'press'), false);
  assert.deepEqual(sources[1].calls, []);
  settings.set('haptics', true);
  assert.equal(h.pulse('right', 'press'), true, 'al volver a encenderla, vibra');
});

test('al pasar el rayo por varios botones seguidos no se vuelve un zumbido continuo', () => {
  const { h, sources, advance } = rig();
  assert.equal(h.pulse('right', 'hover'), true);
  advance(20);
  assert.equal(h.pulse('right', 'hover'), false, 'muy seguido: se descarta');
  advance(80);
  assert.equal(h.pulse('right', 'hover'), true);
  assert.equal(sources[1].calls.length, 2);
  // presionar nunca se descarta por frecuencia
  assert.equal(h.pulse('right', 'press'), true);
  assert.equal(h.pulse('right', 'press'), true);
});

test('sin sesión inmersiva, sin motor de vibración o con manos (sin control) no falla ni vibra', () => {
  const none = rig();
  none.state.session = null;
  assert.equal(none.h.pulse('right', 'press'), false);
  const hands = rig({ sources: [{ handedness: 'right', gamepad: null }] });
  assert.equal(hands.h.pulse('right', 'press'), false);
  const noMotor = rig({ sources: [fakeSource('right', { actuator: false })] });
  assert.equal(noMotor.h.pulse('right', 'press'), false);
  const unknownKind = rig();
  assert.equal(unknownKind.h.pulse('right', 'inventado'), false);
});

test('si el control solo ofrece el motor de la API vieja (playEffect) también se usa', () => {
  const { h, sources } = rig({ sources: [fakeSource('left', { actuator: false, playEffect: true })] });
  assert.equal(h.pulse('left', 'denied'), true);
  assert.equal(sources[0].calls[0].type, 'dual-rumble');
  assert.equal(sources[0].calls[0].duration, HAPTIC_PULSES.denied.ms);
});

test('un fallo del motor de vibración no rompe la experiencia', async () => {
  const bad = fakeSource('right');
  bad.gamepad.hapticActuators[0].pulse = () => Promise.reject(new Error('se desconectó'));
  const { h } = rig({ sources: [bad] });
  assert.equal(h.pulse('right', 'press'), true);
  const thrower = fakeSource('right');
  thrower.gamepad.hapticActuators[0].pulse = () => { throw new Error('boom'); };
  const { h: h2 } = rig({ sources: [thrower] });
  assert.equal(h2.pulse('right', 'press'), false);
  await new Promise((r) => setImmediate(r)); // si hubiera un rechazo sin atender, la prueba fallaría acá
});

test('la mano se toma del control que apuntó (evento del cursor de A-Frame)', () => {
  const evt = (hand) => ({ detail: { cursorEl: { components: { 'xr-ray': { data: { hand } } } } } });
  assert.equal(Haptics.handFromEvent(evt('left')), 'left');
  assert.equal(Haptics.handFromEvent(evt('right')), 'right');
  assert.equal(Haptics.handFromEvent(evt('otra')), null);
  assert.equal(Haptics.handFromEvent({ detail: { cursorEl: { components: {} } } }), null, 'el mouse no tiene xr-ray');
  assert.equal(Haptics.handFromEvent(undefined), null);
  const { h, sources } = rig();
  assert.equal(h.fromEvent(evt('left'), 'press'), true);
  assert.equal(sources[0].calls.length, 1);
  assert.equal(h.fromEvent({ detail: {} }, 'press'), false, 'sin mano conocida, no vibra');
});
