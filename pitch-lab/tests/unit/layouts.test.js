import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS } from '../../js/config/scenarios.js';
import { BRIEFS } from '../../js/config/briefs.js';
import { resolveScenario, constrainMove, isWalkable, yawToward, mulberry32 } from '../../js/core/layouts.js';

test('Hay tres escenarios con duraciones 60, 90 y 120 s', () => {
  assert.deepEqual(SCENARIOS.map((s) => s.durationSec), [60, 90, 120]);
  assert.deepEqual(SCENARIOS.map((s) => s.id), ['sala', 'cliente', 'auditorio']);
});

test('Hay al menos tres briefs completos y marcados como ficticios', () => {
  assert.ok(BRIEFS.length >= 3);
  for (const b of BRIEFS) {
    for (const key of ['brand', 'brandNote', 'problem', 'audience', 'objective', 'constraint', 'guide']) {
      assert.ok(b[key] && b[key].length > 5, `${b.id}.${key}`);
    }
    assert.match(b.brandNote, /ficticia/i);
  }
});

test('Sala: 3 oyentes. Cliente: 5. Auditorio: más de 25 en varias zonas', () => {
  const counts = Object.fromEntries(SCENARIOS.map((s) => {
    const r = resolveScenario(s);
    return [s.id, r.seats.filter((x) => x.occupied).length];
  }));
  assert.equal(counts.sala, 3);
  assert.equal(counts.cliente, 5);
  assert.ok(counts.auditorio > 25);
  const zones = new Set(resolveScenario(SCENARIOS[2]).seats.filter((x) => x.occupied).map((x) => x.zone));
  assert.ok(zones.size >= 3);
});

test('La distribución del auditorio es repetible (misma semilla)', () => {
  const a = resolveScenario(SCENARIOS[2]).seats.map((s) => s.occupied);
  const b = resolveScenario(SCENARIOS[2]).seats.map((s) => s.occupied);
  assert.deepEqual(a, b);
  assert.equal(mulberry32(1)(), mulberry32(1)());
});

test('Auditorio: el asiento de observación está libre y tiene punto de teletransporte', () => {
  const r = resolveScenario(SCENARIOS[2]);
  const view = r.seats.find((s) => s.view);
  assert.ok(view);
  assert.equal(view.occupied, false);
  const pad = r.pads.find((p) => p.id === 'publico');
  assert.equal(pad.x, view.x);
  assert.equal(pad.y, view.y);
  assert.ok(r.walk.zones.find((z) => z.id === 'publico'));
});

test('La posición inicial y los puntos de teletransporte son seguros en todos los escenarios', () => {
  for (const s of SCENARIOS) {
    const r = resolveScenario(s);
    for (const pad of r.pads) {
      const zone = r.walk.zones.find((z) => z.id === pad.zone);
      assert.ok(zone, `${s.id}/${pad.id}: zona`);
      assert.ok(isWalkable(pad.x, pad.z, zone, r.walk.obstacles), `${s.id}/${pad.id} no es caminable`);
    }
    const atril = r.walk.zones.find((z) => z.id === 'atril');
    assert.ok(isWalkable(r.spawn.x, r.spawn.z, atril, r.walk.obstacles), `${s.id}: spawn`);
  }
});

test('Ningún asiento ocupado queda dentro de una zona caminable', () => {
  for (const s of SCENARIOS) {
    const r = resolveScenario(s);
    const atril = r.walk.zones.find((z) => z.id === 'atril');
    for (const seat of r.seats.filter((x) => x.occupied)) {
      assert.equal(isWalkable(seat.x, seat.z, atril, []), false, `${s.id}: ${seat.id}`);
    }
  }
});

test('Los límites impiden atravesar obstáculos y salir de la zona', () => {
  const r = resolveScenario(SCENARIOS[0]);
  const zone = r.walk.zones[0];
  const o = r.walk.obstacles;
  // Intento atravesar el atril desde atrás.
  const blocked = constrainMove({ x: 0, z: 0.9 }, { x: 0, z: 0 }, zone, o);
  assert.deepEqual(blocked, { x: 0, z: 0.9 });
  // Desliza por un eje si el otro está libre.
  const slide = constrainMove({ x: 1.0, z: 0.9 }, { x: 0.3, z: 0.1 }, zone, o);
  assert.equal(isWalkable(slide.x, slide.z, zone, o), true);
  // No sale de la zona.
  const out = constrainMove({ x: 2.2, z: 0.9 }, { x: 5, z: 0.9 }, zone, o);
  assert.equal(out.x, 2.2);
});

test('yawToward: el frente del asiento mira hacia el atril', () => {
  // Un asiento en (0, -5) debe quedar mirando a +z (hacia el origen): giro de 180°.
  assert.ok(Math.abs(Math.abs(yawToward(0, -5)) - Math.PI) < 1e-9);
  // Un asiento en (0, 5) mira a -z: giro 0.
  assert.ok(Math.abs(yawToward(0, 5)) < 1e-9);
});

test('La sala del escenario contiene a todos sus asientos', () => {
  for (const s of SCENARIOS) {
    const r = resolveScenario(s);
    for (const seat of r.seats) {
      assert.ok(seat.x > s.room.minX && seat.x < s.room.maxX, `${s.id}/${seat.id} x`);
      assert.ok(seat.z > s.room.minZ && seat.z < s.room.maxZ, `${s.id}/${seat.id} z`);
    }
  }
});
