// Cálculo de métricas de la presentación. Funciones puras, sin DOM.
//
// Qué se mide y con qué datos (ver docs/metricas-y-puntaje.md):
//   - Duración efectiva  -> cronómetro de la sesión, sin pausas.
//   - Cantidad de palabras -> transcripción (reconocimiento de voz, editada, escrita o de demostración).
//   - Palabras por minuto -> palabras / duración efectiva. SOLO si la transcripción proviene del reconocimiento.
//   - Muletillas -> coincidencias con la lista configurable en APP_CONFIG.fillers.
//   - Uso del tiempo -> duración efectiva / tiempo del escenario (solo con límite de tiempo).
// No se calcula nada sobre confianza, emociones, contacto visual ni persuasión.

import { APP_CONFIG } from '../config/app-config.js';

/** Orígenes posibles de la transcripción. */
export const SOURCES = {
  NONE: 'none',               // sin transcripción
  SPEECH: 'speech',           // reconocimiento de voz del navegador, sin cambios
  SPEECH_EDITED: 'speech-edited', // reconocimiento corregido por la persona
  TYPED: 'typed',             // escrita o pegada por la persona
  DEMO: 'demo',               // texto de demostración
  AI: 'ai',                   // transcripción hecha por la IA a partir del audio grabado (solo si no hubo reconocimiento del navegador)
};

export const SOURCE_LABELS = {
  none: 'Sin transcripción',
  speech: 'Reconocimiento de voz del navegador',
  'speech-edited': 'Reconocimiento de voz, editado por vos',
  typed: 'Texto escrito o pegado por vos',
  demo: 'Demostración (texto de ejemplo)',
  ai: 'Transcripción de la IA (Gemini), a partir del audio',
};

/** Cuenta palabras: secuencias de letras/números (con tildes, ñ y apóstrofes internos). */
export function countWords(text) {
  if (!text) return 0;
  const matches = String(text).match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

/** Minúsculas y sin tildes, para comparar sin depender de cómo escribió el reconocedor. */
export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cuenta muletillas de una lista. Coincide por palabra completa
 * ("em" no cuenta dentro de "tema") y admite frases ("o sea").
 */
export function countFillers(text, fillers = APP_CONFIG.fillers) {
  const haystack = normalize(text);
  const byTerm = {};
  let total = 0;
  for (const term of fillers) {
    const pattern = normalize(term).trim().split(/\s+/).map(escapeRegExp).join('\\s+');
    if (!pattern) continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, 'gu');
    const n = (haystack.match(re) || []).length;
    if (n > 0) {
      byTerm[term] = n;
      total += n;
    }
  }
  return { total, byTerm };
}

/**
 * Calcula las métricas disponibles. Cada métrica trae `available` y, si no está,
 * la razón (`reason`) para mostrarla en la devolución.
 *
 * @param {object} input
 * @param {string} input.text         transcripción final
 * @param {string} input.source       uno de SOURCES
 * @param {number} input.activeMs     milisegundos efectivos (sin pausas)
 * @param {number|null} input.targetSec tiempo del escenario (null = sin límite)
 * @param {object|null} input.audio   medición de audio opcional ({measured: true, ...})
 */
export function computeMetrics({ text = '', source = SOURCES.NONE, activeMs = 0, targetSec = null, audio = null }, config = APP_CONFIG) {
  const durationSec = Math.max(0, activeMs / 1000);
  const hasText = source !== SOURCES.NONE && String(text).trim().length > 0;
  const speechBased = source === SOURCES.SPEECH || source === SOURCES.SPEECH_EDITED || source === SOURCES.AI;

  const duration = {
    available: durationSec > 0,
    value: Math.round(durationSec),
    source: 'Cronómetro de la sesión (sin pausas)',
  };

  let words = { available: false, value: null, reason: 'No hay transcripción.' };
  let fillers = { available: false, value: null, byTerm: {}, per100: null, reason: 'No hay transcripción.' };
  let wpm = { available: false, value: null, reason: 'No hay transcripción.' };

  if (hasText) {
    const wordCount = countWords(text);
    words = { available: true, value: wordCount, source: SOURCE_LABELS[source] };
    const f = countFillers(text, config.fillers);
    fillers = {
      available: true,
      value: f.total,
      byTerm: f.byTerm,
      per100: wordCount > 0 ? (f.total / wordCount) * 100 : 0,
      source: SOURCE_LABELS[source],
    };
    if (!speechBased) {
      wpm = {
        available: false,
        value: null,
        reason: source === SOURCES.DEMO
          ? 'Es un texto de demostración: no corresponde al tiempo que hablaste.'
          : 'El texto fue escrito o pegado: no se relaciona con el tiempo que hablaste.',
      };
    } else if (durationSec < config.minimums.metricsSeconds) {
      wpm = { available: false, value: null, reason: `Hace falta al menos ${config.minimums.metricsSeconds} s de presentación.` };
    } else {
      wpm = {
        available: true,
        value: Math.round(wordCount / (durationSec / 60)),
        source: SOURCE_LABELS[source],
        edited: source === SOURCES.SPEECH_EDITED,
      };
    }
  }

  const timed = Number.isFinite(targetSec) && targetSec > 0;
  const timeUse = timed && durationSec > 0
    ? { available: true, value: durationSec / targetSec, targetSec, source: 'Cronómetro / tiempo del escenario' }
    : { available: false, value: null, reason: timed ? 'No hubo tiempo registrado.' : 'Práctica sin límite de tiempo.' };

  const audioMeasured = audio && audio.measured
    ? {
      available: true,
      soundSec: audio.soundSec,
      activeSec: audio.activeSec,
      soundShare: audio.activeSec > 0 ? audio.soundSec / audio.activeSec : null,
      longPauses: audio.longPauses,
      longPauseSec: audio.longPauseSec,
      source: 'Medición de nivel de audio en este dispositivo',
    }
    : { available: false, reason: 'No se midió el audio.' };

  return { source, hasText, duration, words, wpm, fillers, timeUse, audio: audioMeasured };
}

// ---------- Indicador técnico orientativo ----------

/** Interpolación lineal limitada a [0, 1]. */
function ramp(value, zeroAt, fullAt) {
  if (zeroAt === fullAt) return value === fullAt ? 1 : 0;
  const t = (value - zeroAt) / (fullAt - zeroAt);
  return Math.max(0, Math.min(1, t));
}

/** 1 dentro del rango ideal; baja linealmente hasta 0 en los extremos. */
function rangeScore(value, { zeroBelow, idealMin, idealMax, zeroAbove }) {
  if (value < idealMin) return ramp(value, zeroBelow, idealMin);
  if (value > idealMax) return ramp(value, zeroAbove, idealMax);
  return 1;
}

/**
 * Indicador técnico orientativo (0–100). NO es una evaluación profesional ni del contenido.
 * Se calcula solo con transcripción de reconocimiento de voz y datos suficientes.
 */
export function computeIndicator(metrics, config = APP_CONFIG) {
  const min = config.minimums;
  const cfg = config.indicator;
  const reasons = [];

  const speechBased = metrics.source === SOURCES.SPEECH || metrics.source === SOURCES.SPEECH_EDITED || metrics.source === SOURCES.AI;
  if (!speechBased) reasons.push('Hace falta una transcripción obtenida del audio (reconocimiento de voz o IA).');
  if (!metrics.words.available || metrics.words.value < min.indicatorWords) {
    reasons.push(`Hacen falta al menos ${min.indicatorWords} palabras.`);
  }
  if (!metrics.duration.available || metrics.duration.value < min.indicatorSeconds) {
    reasons.push(`Hacen falta al menos ${min.indicatorSeconds} segundos de presentación.`);
  }
  if (reasons.length > 0 || !metrics.wpm.available) {
    return { available: false, label: 'Sin datos suficientes', reasons, formula: describeFormula(config) };
  }

  const components = [];
  components.push({
    id: 'pace',
    label: 'Ritmo',
    weight: cfg.weights.pace,
    score: rangeScore(metrics.wpm.value, {
      zeroBelow: cfg.paceWpm.zeroBelow,
      idealMin: cfg.paceWpm.idealMin,
      idealMax: cfg.paceWpm.idealMax,
      zeroAbove: cfg.paceWpm.zeroAbove,
    }),
    detail: `${metrics.wpm.value} palabras por minuto (ideal ${cfg.paceWpm.idealMin}–${cfg.paceWpm.idealMax})`,
  });
  components.push({
    id: 'fillers',
    label: 'Muletillas',
    weight: cfg.weights.fillers,
    score: 1 - ramp(metrics.fillers.per100, cfg.fillersPer100.full, cfg.fillersPer100.zero),
    detail: `${metrics.fillers.value} detectadas (${metrics.fillers.per100.toFixed(1)} cada 100 palabras)`,
  });
  if (metrics.timeUse.available) {
    components.push({
      id: 'timeUse',
      label: 'Uso del tiempo',
      weight: cfg.weights.timeUse,
      score: rangeScore(metrics.timeUse.value, {
        zeroBelow: cfg.timeUse.zeroBelow,
        idealMin: cfg.timeUse.idealMin,
        idealMax: cfg.timeUse.idealMax,
        zeroAbove: cfg.timeUse.zeroAbove,
      }),
      detail: `usaste el ${Math.round(metrics.timeUse.value * 100)}% del tiempo (ideal ${Math.round(cfg.timeUse.idealMin * 100)}–${Math.round(cfg.timeUse.idealMax * 100)}%)`,
    });
  }

  // Si falta un componente (práctica sin límite) se reparten los pesos entre los demás.
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const value = Math.round(components.reduce((sum, c) => sum + c.score * (c.weight / totalWeight), 0) * 100);
  return {
    available: true,
    value,
    label: 'Indicador técnico orientativo',
    components: components.map((c) => ({ ...c, effectiveWeight: c.weight / totalWeight })),
    formula: describeFormula(config),
    reasons: [],
  };
}

export function describeFormula(config = APP_CONFIG) {
  const w = config.indicator.weights;
  const p = config.indicator.paceWpm;
  const f = config.indicator.fillersPer100;
  const t = config.indicator.timeUse;
  return (
    `Indicador = ${Math.round(w.pace * 100)}% ritmo + ${Math.round(w.fillers * 100)}% muletillas + ${Math.round(w.timeUse * 100)}% uso del tiempo. ` +
    `Ritmo: máximo entre ${p.idealMin} y ${p.idealMax} palabras por minuto. ` +
    `Muletillas: máximo con ${f.full} o menos cada 100 palabras, cero con ${f.zero} o más. ` +
    `Uso del tiempo: máximo entre ${Math.round(t.idealMin * 100)}% y ${Math.round(t.idealMax * 100)}% del tiempo. ` +
    'Sin límite de tiempo, el peso se reparte entre los otros dos.'
  );
}
