// Utilidades puras de la ambientación 3D (sin WebGL ni DOM).
import test from 'node:test';
import assert from 'node:assert/strict';
import { shade } from '../../js/scenes/dressing.js';
import { mulberry32 } from '../../js/core/layouts.js';

test('Ambientación: shade aclara y oscurece sin salirse de #RRGGBB', () => {
  assert.equal(shade('#808080', 0), '#808080');
  const lighter = shade('#808080', 0.5);
  const darker = shade('#808080', -0.5);
  assert.match(lighter, /^#[0-9a-f]{6}$/);
  assert.match(darker, /^#[0-9a-f]{6}$/);
  assert.ok(parseInt(lighter.slice(1, 3), 16) > 0x80);
  assert.ok(parseInt(darker.slice(1, 3), 16) < 0x80);
  assert.equal(shade('#FFFFFF', 0.5), '#ffffff', 'no pasa de blanco');
  assert.equal(shade('#000000', -0.5), '#000000', 'no baja de negro');
  assert.equal(shade('#0047FF', 1), '#ffffff');
});

test('Ambientación: el generador con semilla es determinista (mismo público y mismos afiches en cada carga)', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  const seqA = Array.from({ length: 8 }, () => a());
  const seqB = Array.from({ length: 8 }, () => b());
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, Array.from({ length: 8 }, mulberry32(8)));
  assert.ok(seqA.every((v) => v >= 0 && v < 1));
});
