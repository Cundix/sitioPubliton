// Arma la devolución a partir de las métricas. Sin DOM.
// Todo consejo sale de una regla simple sobre un dato medido. Nada es aleatorio.

import { APP_CONFIG, PRACTICE_QUESTIONS } from '../config/app-config.js';
import { SOURCES, SOURCE_LABELS, computeMetrics, computeIndicator } from './metrics.js';
import { summarizeRubric } from './rubric.js';

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Filas "qué se pudo medir" y "qué no se pudo medir". */
export function buildMeasurements(metrics, targetSec) {
  const rows = [];

  rows.push({
    id: 'duration',
    label: 'Duración efectiva',
    available: metrics.duration.available,
    display: metrics.duration.available ? formatClock(metrics.duration.value) : '—',
    note: 'Sin contar pausas.',
    source: metrics.duration.source,
  });

  rows.push(metrics.timeUse.available
    ? {
      id: 'timeUse',
      label: 'Uso del tiempo',
      available: true,
      display: `${Math.round(metrics.timeUse.value * 100)}% de ${formatClock(targetSec)}`,
      source: metrics.timeUse.source,
    }
    : { id: 'timeUse', label: 'Uso del tiempo', available: false, display: 'No aplica', note: metrics.timeUse.reason });

  rows.push(metrics.words.available
    ? { id: 'words', label: 'Palabras', available: true, display: String(metrics.words.value), source: metrics.words.source }
    : { id: 'words', label: 'Palabras', available: false, display: 'Sin datos', note: metrics.words.reason });

  rows.push(metrics.wpm.available
    ? {
      id: 'wpm',
      label: 'Palabras por minuto',
      available: true,
      display: String(metrics.wpm.value),
      note: metrics.wpm.edited ? 'Calculado con texto editado por vos.' : undefined,
      source: metrics.wpm.source,
    }
    : { id: 'wpm', label: 'Palabras por minuto', available: false, display: 'Sin datos', note: metrics.wpm.reason });

  if (metrics.fillers.available) {
    const terms = Object.entries(metrics.fillers.byTerm).map(([t, n]) => `«${t}» ×${n}`).join(', ');
    rows.push({
      id: 'fillers',
      label: 'Muletillas detectadas',
      available: true,
      display: `${metrics.fillers.value}`,
      note: terms || 'Ninguna de la lista.',
      source: metrics.fillers.source,
    });
  } else {
    rows.push({ id: 'fillers', label: 'Muletillas detectadas', available: false, display: 'Sin datos', note: metrics.fillers.reason });
  }

  if (metrics.audio.available) {
    rows.push({
      id: 'audio',
      label: 'Nivel de audio medido',
      available: true,
      display: `${Math.round((metrics.audio.soundShare ?? 0) * 100)}% con sonido`,
      note: `${metrics.audio.longPauses} pausa(s) larga(s) de ${metrics.audio.longPauseSec} s o más sin sonido.`,
      source: metrics.audio.source,
    });
  } else {
    rows.push({ id: 'audio', label: 'Silencios y nivel de audio', available: false, display: 'No medido', note: metrics.audio.reason });
  }

  return rows;
}

/** Hasta dos consejos concretos, ordenados por cuánto se alejan de lo esperado. */
export function buildTips(metrics, config = APP_CONFIG) {
  const cfg = config.indicator;
  const candidates = [];

  if (metrics.wpm.available) {
    const v = metrics.wpm.value;
    if (v > cfg.paceWpm.idealMax) {
      candidates.push({
        weight: (v - cfg.paceWpm.idealMax) / cfg.paceWpm.idealMax,
        text: `Hablaste a unas ${v} palabras por minuto, por encima del rango de referencia (${cfg.paceWpm.idealMin}–${cfg.paceWpm.idealMax}). Probá hacer una pausa corta después de cada idea importante.`,
        basedOn: `Palabras por minuto: ${v}`,
      });
    } else if (v < cfg.paceWpm.idealMin) {
      candidates.push({
        weight: (cfg.paceWpm.idealMin - v) / cfg.paceWpm.idealMin,
        text: `Hablaste a unas ${v} palabras por minuto, por debajo del rango de referencia (${cfg.paceWpm.idealMin}–${cfg.paceWpm.idealMax}). Si te sobró tiempo, sumá un ejemplo concreto o repetí el beneficio principal.`,
        basedOn: `Palabras por minuto: ${v}`,
      });
    } else {
      candidates.push({
        weight: 0.01,
        text: `Tu ritmo (${v} palabras por minuto) estuvo dentro del rango de referencia. Probá mantenerlo y marcar las ideas clave con una pausa.`,
        basedOn: `Palabras por minuto: ${v}`,
      });
    }
  }

  if (metrics.fillers.available && metrics.fillers.value >= 2 && metrics.fillers.per100 > cfg.fillersPer100.full) {
    const top = Object.entries(metrics.fillers.byTerm).sort((a, b) => b[1] - a[1])[0];
    candidates.push({
      weight: metrics.fillers.per100 / cfg.fillersPer100.zero,
      text: `Se detectaron ${metrics.fillers.value} muletillas, sobre todo «${top[0]}». Probá reemplazarlas por un silencio corto mientras pensás la próxima frase.`,
      basedOn: `Muletillas: ${metrics.fillers.value} (lista configurable)`,
    });
  }

  if (metrics.timeUse.available) {
    const u = metrics.timeUse.value;
    const pct = Math.round(u * 100);
    if (u > cfg.timeUse.idealMax) {
      candidates.push({
        weight: u - cfg.timeUse.idealMax,
        text: `Usaste el ${pct}% del tiempo del escenario. Elegí qué ideas recortar para llegar al cierre dentro del tiempo.`,
        basedOn: `Uso del tiempo: ${pct}%`,
      });
    } else if (u < cfg.timeUse.idealMin) {
      candidates.push({
        weight: cfg.timeUse.idealMin - u,
        text: `Usaste el ${pct}% del tiempo del escenario. Tenés margen para desarrollar mejor el beneficio o sumar un ejemplo.`,
        basedOn: `Uso del tiempo: ${pct}%`,
      });
    }
  }

  const tips = candidates.sort((a, b) => b.weight - a.weight).slice(0, 2).map(({ text, basedOn }) => ({ text, basedOn }));
  if (tips.length === 0) {
    tips.push({
      text: 'Con los datos de esta práctica no hay un consejo específico. Completá la autoevaluación y volvé a intentarlo hablando con el micrófono para obtener más medidas.',
      basedOn: 'Datos insuficientes',
    });
  }
  return tips;
}

/** Lo que una herramienta automática no puede juzgar. */
export const HUMAN_REVIEW_ITEMS = [
  'Si el problema se entiende para alguien que no conoce el brief.',
  'Si la idea respeta la restricción creativa.',
  'Si el beneficio resulta creíble y relevante.',
  'Si el cierre propone un siguiente paso claro.',
  'Si la transcripción refleja lo que dijiste: el reconocimiento puede equivocarse.',
];

/** Banners de aviso según el origen de los datos. */
export function buildBanners(metrics) {
  const banners = [];
  if (metrics.source === SOURCES.DEMO) {
    banners.push({
      kind: 'demo',
      label: 'DEMOSTRACIÓN',
      text: 'El texto es de ejemplo y no fue dicho por vos. Las medidas de texto no reflejan tu presentación.',
    });
  } else if (metrics.source === SOURCES.TYPED) {
    banners.push({
      kind: 'typed',
      label: 'TEXTO ESCRITO',
      text: 'La transcripción fue escrita o pegada por vos. No se calculan palabras por minuto ni medidas de voz.',
    });
  } else if (metrics.source === SOURCES.SPEECH_EDITED) {
    banners.push({
      kind: 'edited',
      label: 'TEXTO EDITADO',
      text: 'Corregiste la transcripción del reconocimiento. Las medidas usan tu versión y pueden no reflejar lo dicho.',
    });
  } else if (metrics.source === SOURCES.NONE) {
    banners.push({
      kind: 'novoice',
      label: 'SIN VOZ',
      text: 'Esta práctica no tiene transcripción. Solo se midió el tiempo; el resto depende de tu autoevaluación.',
    });
  }
  return banners;
}

/**
 * Modelo completo de devolución.
 * @param {object} capture  { text, source, activeMs, audio }
 * @param {object} context  { targetSec, rubric }
 */
export function buildFeedback(capture, context, config = APP_CONFIG) {
  const metrics = computeMetrics({
    text: capture.text,
    source: capture.source,
    activeMs: capture.activeMs,
    targetSec: context.targetSec ?? null,
    audio: capture.audio ?? null,
  }, config);
  const indicator = computeIndicator(metrics, config);
  return {
    metrics,
    indicator,
    measurements: buildMeasurements(metrics, context.targetSec),
    tips: buildTips(metrics, config),
    banners: buildBanners(metrics),
    humanReview: HUMAN_REVIEW_ITEMS,
    rubricSummary: summarizeRubric(context.rubric || {}),
    questions: PRACTICE_QUESTIONS,
    sourceLabel: SOURCE_LABELS[capture.source] || SOURCE_LABELS.none,
  };
}
