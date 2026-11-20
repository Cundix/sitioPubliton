// Briefs ficticios: cantidad, límites de largo (para que entren en pantalla), unicidad y recorrido.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BRIEFS } from '../../js/config/briefs.js';
import { Session } from '../../js/core/session.js';
import { Settings } from '../../js/core/settings.js';
import { buildScreen } from '../../js/core/screens.js';
import { FakeClock } from './helpers.js';

const LIMITS = { brand: 16, problem: 125, audience: 85, objective: 95, constraint: 95, guide: 100 };

test('Briefs: hay variedad de temáticas (al menos 10) y no solo una marca', () => {
  assert.ok(BRIEFS.length >= 10, `hay ${BRIEFS.length}`);
});

test('Briefs: ids y marcas únicos, todas ficticias y sin cifras de estudios ni afirmaciones de salud', () => {
  assert.equal(new Set(BRIEFS.map((b) => b.id)).size, BRIEFS.length, 'ids repetidos');
  assert.equal(new Set(BRIEFS.map((b) => b.brand.toLowerCase())).size, BRIEFS.length, 'marcas repetidas');
  for (const b of BRIEFS) {
    assert.match(b.brandNote, /^Marca ficticia · /, `${b.id}: la nota debe empezar con «Marca ficticia · »`);
    const all = Object.values(b).join(' ');
    assert.doesNotMatch(all, /%|según (un )?estudio|estudios? (demuestra|muestra)|comprobado|cura|saludable|adelgaz|enfermedad/i, `${b.id}: no se inventan datos ni afirmaciones de salud`);
  }
});

test('Briefs: cada campo respeta el largo máximo para entrar en la pantalla y en el panel', () => {
  for (const b of BRIEFS) {
    for (const [key, max] of Object.entries(LIMITS)) {
      assert.ok(b[key].length <= max, `${b.id}.${key} tiene ${b[key].length} caracteres (máximo ${max})`);
    }
  }
});

test('Briefs: la restricción creativa es distinta en cada uno (si no, los briefs se parecen demasiado)', () => {
  assert.equal(new Set(BRIEFS.map((b) => b.constraint)).size, BRIEFS.length);
});

function make(opts = {}) {
  const session = new Session({ clock: new FakeClock(), capabilities: { speech: false }, tutorialSeen: true, ...opts });
  session.start();
  return session;
}
const toBrief = (s) => { s.dispatch('START'); s.dispatch('PICK_SCENARIO', { id: 'sala' }); s.dispatch('ENTER'); };

test('Briefs: por defecto la sesión parte del primero; briefStart elige otro y el reinicio vuelve a ese', () => {
  assert.equal(make().brief.id, BRIEFS[0].id);
  const s = make({ briefStart: 4 });
  assert.equal(s.brief.id, BRIEFS[4].id);
  toBrief(s);
  s.dispatch('NEXT_BRIEF');
  assert.equal(s.brief.id, BRIEFS[5].id);
  s.dispatch('BACK'); // brief -> select (no hay reinicio): se sigue desde el actual
  s.dispatch('BACK');
  assert.ok(s.dispatch('RESET'));
  assert.equal(s.brief.id, BRIEFS[4].id, 'el reinicio vuelve al brief del que se partió');
});

test('Briefs: «Otro brief» recorre todos y vuelve al primero, y el botón dice cuántos hay', () => {
  const s = make();
  toBrief(s);
  const seen = [];
  for (let i = 0; i < BRIEFS.length; i++) {
    const model = buildScreen(s, new Settings(), {});
    const button = model.lectern.actions.find((a) => a.id === 'other-brief');
    assert.equal(button.label, `Otro brief ${i + 1}/${BRIEFS.length}`);
    assert.equal(model.panel.title[0], s.brief.brand.toUpperCase());
    seen.push(s.brief.id);
    assert.ok(s.dispatch('NEXT_BRIEF'));
  }
  assert.equal(new Set(seen).size, BRIEFS.length, 'se vieron todos distintos');
  assert.equal(s.brief.id, BRIEFS[0].id, 'después del último vuelve al primero');
});
