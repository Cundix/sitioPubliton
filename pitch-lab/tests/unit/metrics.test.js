import test from 'node:test';
import assert from 'node:assert/strict';
import { countWords, countFillers, computeMetrics, computeIndicator, SOURCES } from '../../js/core/metrics.js';
import { getTimeWarning } from '../../js/core/time-warnings.js';
import { buildFeedback, formatClock } from '../../js/core/feedback.js';
import { nextAnswer, summarizeRubric, emptyRubric } from '../../js/core/rubric.js';

const words = (n) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(' ');

test('countWords cuenta palabras con tildes, ñ y números', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('   '), 0);
  assert.equal(countWords('Hola, ¿cómo estás? Año 2026'), 5);
  assert.equal(countWords('d\'Artagnan vino'), 2);
});

test('countFillers detecta palabras completas y frases, sin falsos positivos dentro de otras palabras', () => {
  const r = countFillers('Eh, o sea, el tema es que, em, bueno. O  sea que sí.', ['eh', 'em', 'o sea']);
  assert.equal(r.byTerm['eh'], 1);
  assert.equal(r.byTerm['em'], 1); // "tema" no cuenta
  assert.equal(r.byTerm['o sea'], 2);
  assert.equal(r.total, 4);
});

test('countFillers ignora mayúsculas y tildes', () => {
  assert.equal(countFillers('BÁSICAMENTE basicamente', ['básicamente']).total, 2);
});

test('computeMetrics: palabras por minuto con reconocimiento de voz', () => {
  const m = computeMetrics({ text: words(120), source: SOURCES.SPEECH, activeMs: 60_000, targetSec: 60 });
  assert.equal(m.words.value, 120);
  assert.equal(m.wpm.available, true);
  assert.equal(m.wpm.value, 120);
  assert.equal(m.timeUse.value, 1);
});

test('computeMetrics: el tiempo no incluye pausas (activeMs ya viene sin pausas)', () => {
  const m = computeMetrics({ text: words(30), source: SOURCES.SPEECH, activeMs: 15_000, targetSec: 60 });
  assert.equal(m.duration.value, 15);
  assert.equal(m.wpm.value, 120);
});

test('computeMetrics: no calcula palabras por minuto para texto escrito ni demostración', () => {
  for (const source of [SOURCES.TYPED, SOURCES.DEMO]) {
    const m = computeMetrics({ text: words(100), source, activeMs: 60_000, targetSec: 60 });
    assert.equal(m.wpm.available, false, source);
    assert.equal(m.words.available, true, source);
  }
});

test('computeMetrics: sin transcripción solo hay tiempo', () => {
  const m = computeMetrics({ text: '', source: SOURCES.NONE, activeMs: 42_000, targetSec: 60 });
  assert.equal(m.duration.value, 42);
  assert.equal(m.words.available, false);
  assert.equal(m.wpm.available, false);
  assert.equal(m.fillers.available, false);
  assert.equal(m.timeUse.available, true);
});

test('computeMetrics: práctica sin límite no calcula uso del tiempo', () => {
  const m = computeMetrics({ text: '', source: SOURCES.NONE, activeMs: 42_000, targetSec: null });
  assert.equal(m.timeUse.available, false);
});

test('computeMetrics: sin duración suficiente no hay ritmo', () => {
  const m = computeMetrics({ text: words(20), source: SOURCES.SPEECH, activeMs: 4_000, targetSec: 60 });
  assert.equal(m.wpm.available, false);
});

test('computeMetrics: el audio solo aparece si se midió de verdad', () => {
  assert.equal(computeMetrics({ text: '', source: SOURCES.NONE, activeMs: 1000 }).audio.available, false);
  const m = computeMetrics({
    text: '', source: SOURCES.NONE, activeMs: 10_000,
    audio: { measured: true, soundSec: 8, activeSec: 10, longPauses: 1, longPauseSec: 2 },
  });
  assert.equal(m.audio.available, true);
  assert.equal(m.audio.soundShare, 0.8);
});

test('Indicador: "Sin datos suficientes" con pocas palabras', () => {
  const m = computeMetrics({ text: words(10), source: SOURCES.SPEECH, activeMs: 30_000, targetSec: 60 });
  const ind = computeIndicator(m);
  assert.equal(ind.available, false);
  assert.equal(ind.label, 'Sin datos suficientes');
  assert.ok(ind.reasons.length > 0);
});

test('Indicador: no se calcula para texto escrito ni demostración', () => {
  for (const source of [SOURCES.TYPED, SOURCES.DEMO]) {
    const m = computeMetrics({ text: words(100), source, activeMs: 60_000, targetSec: 60 });
    assert.equal(computeIndicator(m).available, false, source);
  }
});

test('Indicador: ritmo ideal, sin muletillas y buen uso del tiempo da 100', () => {
  const m = computeMetrics({ text: words(135), source: SOURCES.SPEECH, activeMs: 60_000, targetSec: 60 });
  const ind = computeIndicator(m);
  assert.equal(ind.available, true);
  assert.equal(ind.value, 100);
  assert.equal(ind.components.length, 3);
});

test('Indicador: es determinista (mismos datos, mismo valor)', () => {
  const input = { text: words(90) + ' eh eh eh', source: SOURCES.SPEECH, activeMs: 50_000, targetSec: 60 };
  const a = computeIndicator(computeMetrics(input));
  const b = computeIndicator(computeMetrics(input));
  assert.equal(a.value, b.value);
});

test('Indicador: ritmo muy rápido baja el valor', () => {
  const m = computeMetrics({ text: words(250), source: SOURCES.SPEECH, activeMs: 60_000, targetSec: 60 });
  const ind = computeIndicator(m);
  assert.ok(ind.value < 100 && ind.value >= 0);
  assert.equal(ind.components.find((c) => c.id === 'pace').score < 1, true);
});

test('Indicador: sin límite de tiempo se reparten los pesos entre los otros dos', () => {
  const m = computeMetrics({ text: words(135), source: SOURCES.SPEECH, activeMs: 60_000, targetSec: null });
  const ind = computeIndicator(m);
  assert.equal(ind.available, true);
  assert.equal(ind.components.length, 2);
  const sum = ind.components.reduce((s, c) => s + c.effectiveWeight, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test('Aviso de tiempo: niveles según segundos restantes', () => {
  assert.equal(getTimeWarning(45, 60), 'ok');
  assert.equal(getTimeWarning(20, 60), 'warning');
  assert.equal(getTimeWarning(11, 60), 'warning');
  assert.equal(getTimeWarning(10, 60), 'final');
  assert.equal(getTimeWarning(0, 60), 'final');
  assert.equal(getTimeWarning(30, null), 'none');
  assert.equal(getTimeWarning(30, 0), 'none');
});

test('buildFeedback: texto de demostración queda rotulado y sin ritmo ni indicador', () => {
  const fb = buildFeedback(
    { text: words(60), source: SOURCES.DEMO, activeMs: 30_000, audio: null },
    { targetSec: 60, rubric: emptyRubric() },
  );
  assert.equal(fb.banners[0].label, 'DEMOSTRACIÓN');
  assert.equal(fb.indicator.available, false);
  assert.equal(fb.metrics.wpm.available, false);
});

test('buildFeedback: sin voz muestra aviso "SIN VOZ" y un consejo basado en tiempo', () => {
  const fb = buildFeedback(
    { text: '', source: SOURCES.NONE, activeMs: 20_000, audio: null },
    { targetSec: 60, rubric: emptyRubric() },
  );
  assert.equal(fb.banners[0].label, 'SIN VOZ');
  assert.equal(fb.tips.length, 1);
  assert.match(fb.tips[0].basedOn, /Uso del tiempo/);
});

test('buildFeedback: a lo sumo dos consejos, ordenados por desvío', () => {
  const fb = buildFeedback(
    { text: words(300) + ' eh eh eh eh eh', source: SOURCES.SPEECH, activeMs: 60_000, audio: null },
    { targetSec: 60, rubric: emptyRubric() },
  );
  assert.ok(fb.tips.length <= 2);
  assert.ok(fb.tips.length >= 1);
});

test('formatClock', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(75), '1:15');
  assert.equal(formatClock(59.6), '1:00');
});

test('Rúbrica: ciclo de respuestas y resumen', () => {
  assert.equal(nextAnswer(null), 'yes');
  assert.equal(nextAnswer('yes'), 'partial');
  assert.equal(nextAnswer('partial'), 'no');
  assert.equal(nextAnswer('no'), null);
  const r = { ...emptyRubric(), problem: 'yes', idea: 'partial' };
  const s = summarizeRubric(r);
  assert.equal(s.answered, 2);
  assert.equal(s.yes, 1);
  assert.equal(s.pending.length, 2);
});
