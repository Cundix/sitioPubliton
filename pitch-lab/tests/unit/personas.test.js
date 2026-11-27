// Pruebas de la elección de los docentes en 3D en el público (js/scenes/personas.js, parte pura).
// La carga de los modelos y el dibujo se prueban en el navegador (tests/e2e/run.mjs, prueba 2b).

import test from 'node:test';
import assert from 'node:assert/strict';
import { pickCameos, CAMEO_PROBABILITY, PERSONA_FILES } from '../../js/scenes/personas.js';
import { mulberry32 } from '../../js/core/layouts.js';

test('cada persona del público tiene un 30 % de ser uno de los docentes en 3D', () => {
  assert.equal(CAMEO_PROBABILITY, 0.3);
  const n = 30000;
  const picks = pickCameos(n, { random: mulberry32(2026) });
  const share = picks.filter((m) => m >= 0).length / n;
  assert.ok(share > 0.29 && share < 0.31, `proporción ${share}`);
});

test('la decisión de una persona no depende de la de las anteriores (sin rachas raras)', () => {
  const picks = pickCameos(30000, { random: mulberry32(7) }).map((m) => m >= 0);
  // Probabilidad de ser docente en 3D justo después de un docente en 3D y justo después de una genérica: las dos ≈ 0,3
  let afterCameo = 0; let afterCameoYes = 0; let afterGeneric = 0; let afterGenericYes = 0;
  for (let i = 1; i < picks.length; i += 1) {
    if (picks[i - 1]) { afterCameo += 1; if (picks[i]) afterCameoYes += 1; } else { afterGeneric += 1; if (picks[i]) afterGenericYes += 1; }
  }
  assert.ok(Math.abs(afterCameoYes / afterCameo - 0.3) < 0.02, `${afterCameoYes / afterCameo}`);
  assert.ok(Math.abs(afterGenericYes / afterGeneric - 0.3) < 0.02, `${afterGenericYes / afterGeneric}`);
});

test('los modelos se reparten de a bolsa: ninguno se repite hasta haber salido todos', () => {
  const picks = pickCameos(2000, { random: mulberry32(11), probability: 1 });
  const models = PERSONA_FILES.length;
  assert.ok(picks.every((m) => m >= 0 && m < models));
  for (let start = 0; start + models <= picks.length; start += models) {
    const bag = picks.slice(start, start + models);
    assert.equal(new Set(bag).size, models, `bolsa ${start / models}: ${bag}`);
  }
});

test('con unas veinte elegidas (auditorio) cada modelo aparece 3 o 4 veces', () => {
  const picks = pickCameos(100000, { random: mulberry32(5), probability: 1 }).slice(0, 20);
  const counts = new Array(PERSONA_FILES.length).fill(0);
  picks.forEach((m) => { counts[m] += 1; });
  assert.ok(counts.every((c) => c >= 3 && c <= 4), counts.join(','));
});

test('casos límite: sin modelos, probabilidad 0, probabilidad 1 y público vacío', () => {
  assert.deepEqual(pickCameos(5, { models: 0 }), [-1, -1, -1, -1, -1], 'sin modelos cargados todo queda genérico');
  assert.deepEqual(pickCameos(5, { probability: 0 }), [-1, -1, -1, -1, -1]);
  assert.ok(pickCameos(5, { probability: 1 }).every((m) => m >= 0));
  assert.deepEqual(pickCameos(0), []);
  assert.deepEqual(pickCameos(-3), []);
  // azar fijo en 0 → todos docentes en 3D; azar fijo en 0,99 → ninguno
  assert.ok(pickCameos(8, { random: () => 0 }).every((m) => m >= 0));
  assert.ok(pickCameos(8, { random: () => 0.99 }).every((m) => m === -1));
});

test('con el mismo azar la elección es idéntica; con otro, distinta', () => {
  const a = pickCameos(200, { random: mulberry32(42) });
  const b = pickCameos(200, { random: mulberry32(42) });
  const c = pickCameos(200, { random: mulberry32(43) });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('un modelo solo (si los demás no cargaron) también funciona', () => {
  const picks = pickCameos(200, { models: 1, random: mulberry32(3) });
  assert.ok(picks.every((m) => m === -1 || m === 0));
  assert.ok(picks.some((m) => m === 0));
});
