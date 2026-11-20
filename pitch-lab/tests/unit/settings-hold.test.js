// Pruebas de las opciones de comodidad en VR (preferencias) y de la pulsación sostenida.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Settings, SNAP_ANGLES, HEIGHT_MIN_CM, HEIGHT_MAX_CM, snapTurnLabel, heightLabel,
} from '../../js/core/settings.js';
import { HoldGesture, HOLD_MS } from '../../js/ui/hold.js';

const memoryStorage = (initial = null) => {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_k, v) => { value = v; },
    peek: () => value,
  };
};

test('comodidad en VR: valores por defecto razonables', () => {
  const s = new Settings();
  assert.equal(s.get('snapTurnDeg'), 30, 'el giro por tramos está activado de entrada');
  assert.equal(s.get('haptics'), true);
  assert.equal(s.get('heightCm'), 0);
});

test('el giro con el joystick solo acepta los ángulos de la lista y se puede recorrer', () => {
  const s = new Settings();
  s.set('snapTurnDeg', 37);
  assert.equal(s.get('snapTurnDeg'), 30, 'un ángulo inventado se ignora');
  const seen = [s.get('snapTurnDeg')];
  for (let i = 0; i < SNAP_ANGLES.length; i++) { s.cycleSnapTurn(); seen.push(s.get('snapTurnDeg')); }
  assert.deepEqual(seen, [30, 45, 90, 0, 15, 30], 'recorre la lista completa y vuelve al principio');
  assert.equal(snapTurnLabel(0), 'Desactivado');
  assert.equal(snapTurnLabel(45), '45°');
});

test('la altura se corrige de a 5 cm y tiene tope en los dos sentidos', () => {
  const s = new Settings();
  s.adjustHeight(1);
  assert.equal(s.get('heightCm'), 5);
  for (let i = 0; i < 20; i++) s.adjustHeight(1);
  assert.equal(s.get('heightCm'), HEIGHT_MAX_CM);
  for (let i = 0; i < 30; i++) s.adjustHeight(-1);
  assert.equal(s.get('heightCm'), HEIGHT_MIN_CM);
  s.set('heightCm', 12);
  assert.equal(s.get('heightCm'), 10, 'un valor suelto se redondea al paso');
  s.set('heightCm', Number.NaN);
  assert.equal(s.get('heightCm'), 10, 'un valor que no es número se ignora');
  assert.equal(heightLabel(0), '0 cm');
  assert.equal(heightLabel(5), '+5 cm');
  assert.equal(heightLabel(-10), '−10 cm');
});

test('las opciones se guardan, se recuperan y avisan cuando cambian', () => {
  const storage = memoryStorage();
  const a = new Settings({ storage });
  const changes = [];
  a.on('change', (c) => changes.push(c.key));
  a.set('snapTurnDeg', 90);
  a.set('haptics', false);
  a.set('heightCm', -15);
  a.set('haptics', false); // sin cambio: no avisa de nuevo
  assert.deepEqual(changes, ['snapTurnDeg', 'haptics', 'heightCm']);
  const b = new Settings({ storage });
  assert.equal(b.get('snapTurnDeg'), 90);
  assert.equal(b.get('haptics'), false);
  assert.equal(b.get('heightCm'), -15);
});

test('preferencias guardadas por una versión anterior o dañadas no rompen nada', () => {
  const old = memoryStorage(JSON.stringify({ volume: 0.4, seated: true }));
  const s = new Settings({ storage: old });
  assert.equal(s.get('volume'), 0.4);
  assert.equal(s.get('seated'), true);
  assert.equal(s.get('snapTurnDeg'), 30, 'lo nuevo toma el valor por defecto');
  const broken = new Settings({ storage: memoryStorage('{no es json') });
  assert.equal(broken.get('haptics'), true);
  const weird = new Settings({ storage: memoryStorage(JSON.stringify({ snapTurnDeg: 7, heightCm: 'alto', haptics: 'sí' })) });
  assert.equal(weird.get('snapTurnDeg'), 30);
  assert.equal(weird.get('heightCm'), 0);
  assert.equal(weird.get('haptics'), true);
});

// ----- Pulsación sostenida -----

function holdRig(durationMs = HOLD_MS) {
  let t = 5000;
  let frames = [];
  const log = { progress: [], complete: 0, abort: [] };
  const hold = new HoldGesture({
    durationMs,
    now: () => t,
    raf: (cb) => { frames.push(cb); return frames.length; },
    caf: () => { frames = []; },
    onProgress: (p) => log.progress.push(Number(p.toFixed(2))),
    onComplete: () => { log.complete += 1; },
    onAbort: (ms) => log.abort.push(ms),
  });
  const advance = (ms) => { t += ms; const run = frames; frames = []; run.forEach((cb) => cb()); };
  return { hold, log, advance };
}

test('mantener el tiempo completo ejecuta la acción una sola vez', () => {
  const { hold, log, advance } = holdRig(700);
  hold.start();
  advance(350);
  assert.equal(log.complete, 0);
  advance(400);
  assert.equal(log.complete, 1);
  assert.deepEqual(log.abort, []);
  assert.equal(hold.active, false);
  advance(400);
  assert.equal(log.complete, 1, 'no se repite');
  hold.cancel(); // soltar después de completar no es un aborto
  assert.deepEqual(log.abort, []);
});

test('soltar antes de tiempo no ejecuta nada y avisa para mostrar la ayuda', () => {
  const { hold, log, advance } = holdRig(700);
  hold.start();
  advance(200);
  hold.cancel();
  assert.equal(log.complete, 0);
  assert.equal(log.abort.length, 1);
  assert.equal(log.abort[0], 200);
  assert.equal(log.progress.at(-1), 0, 'el avance vuelve a cero');
  advance(900);
  assert.equal(log.complete, 0, 'no queda ninguna cuenta corriendo');
});

test('un toque corto también cuenta como soltar antes de tiempo (es el error más común)', () => {
  const { hold, log } = holdRig(700);
  hold.start();
  hold.cancel();
  assert.equal(log.abort.length, 1);
  assert.equal(log.complete, 0);
});

test('el avance sube de a poco y llega a 1 justo al completar', () => {
  const { hold, log, advance } = holdRig(700);
  hold.start();
  advance(175); advance(175); advance(175); advance(175);
  assert.equal(log.progress[0], 0);
  assert.equal(log.progress.at(-1), 1);
  const rising = log.progress.every((p, i) => i === 0 || p >= log.progress[i - 1]);
  assert.ok(rising, JSON.stringify(log.progress));
  assert.equal(log.complete, 1);
});

test('destruir el botón en medio de una pulsación no avisa ni ejecuta', () => {
  const { hold, log, advance } = holdRig(700);
  hold.start();
  advance(300);
  hold.dispose();
  advance(900);
  assert.equal(log.complete, 0);
  assert.deepEqual(log.abort, []);
});

test('empezar dos veces seguidas no duplica la cuenta', () => {
  const { hold, log, advance } = holdRig(700);
  hold.start();
  hold.start();
  advance(800);
  assert.equal(log.complete, 1);
});

test('si la página va lenta y se suelta después del tiempo completo, cuenta como completado (no como aborto)', () => {
  const { hold, log, advance } = holdRig(700);
  hold.start();
  advance(300);
  // pasan 900 ms sin que corra ningún cuadro de dibujo (página lenta) y se suelta el botón
  const clockOnly = hold.now;
  hold.now = () => clockOnly() + 900;
  hold.cancel();
  assert.equal(log.complete, 1, 'quien mantuvo el botón el tiempo pedido lo logra');
  assert.deepEqual(log.abort, []);
  assert.equal(log.progress.at(-1), 1);
  hold.cancel();
  assert.equal(log.complete, 1, 'no se repite');
});
