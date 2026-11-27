// Arma la devolución a partir de las métricas. Sin DOM.
// Todo consejo sale de una regla simple sobre un dato medido. Nada es aleatorio.

import { APP_CONFIG, PRACTICE_QUESTIONS } from '../config/app-config.js';
import { SOURCES, SOURCE_LABELS, computeMetrics, computeIndicator } from './metrics.js';
import { summarizeRubric } from './rubric.js';
import { FREE_IDEA_CRITERIA, FREE_SELLING_ASPECTS, RATING_LABELS } from '../ai/analysis-prompt.js';

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Filas "qué se pudo medir" y "qué no se pudo medir". */
export function buildMeasurements(metrics, targetSec, gestures = null) {
  const rows = [];

  rows.push({
    id: 'duration',
    label: 'Duración efectiva',
    short: 'Duración',
    available: metrics.duration.available,
    display: metrics.duration.available ? formatClock(metrics.duration.value) : '—',
    note: 'Sin contar pausas.',
    source: metrics.duration.source,
  });

  rows.push(metrics.timeUse.available
    ? {
      id: 'timeUse',
      label: 'Uso del tiempo',
      short: 'Uso del tiempo',
      available: true,
      display: `${Math.round(metrics.timeUse.value * 100)}% de ${formatClock(targetSec)}`,
      source: metrics.timeUse.source,
    }
    : { id: 'timeUse', label: 'Uso del tiempo', short: 'Uso del tiempo', available: false, display: 'No aplica', note: metrics.timeUse.reason });

  rows.push(metrics.words.available
    ? { id: 'words', label: 'Palabras', short: 'Palabras', available: true, display: String(metrics.words.value), source: metrics.words.source }
    : { id: 'words', label: 'Palabras', short: 'Palabras', available: false, display: 'Sin datos', note: metrics.words.reason });

  rows.push(metrics.wpm.available
    ? {
      id: 'wpm',
      label: 'Palabras por minuto',
      short: 'Palabras/min',
      available: true,
      display: String(metrics.wpm.value),
      note: metrics.wpm.edited ? 'Calculado con texto editado por vos.' : undefined,
      source: metrics.wpm.source,
    }
    : { id: 'wpm', label: 'Palabras por minuto', short: 'Palabras/min', available: false, display: 'Sin datos', note: metrics.wpm.reason });

  if (metrics.fillers.available) {
    const terms = Object.entries(metrics.fillers.byTerm).map(([t, n]) => `«${t}» ×${n}`).join(', ');
    rows.push({
      id: 'fillers',
      label: 'Muletillas detectadas',
      short: 'Muletillas',
      available: true,
      display: `${metrics.fillers.value}`,
      note: terms || 'Ninguna de la lista.',
      source: metrics.fillers.source,
    });
  } else {
    rows.push({ id: 'fillers', label: 'Muletillas detectadas', short: 'Muletillas', available: false, display: 'Sin datos', note: metrics.fillers.reason });
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

  if (gestures) {
    if (gestures.measured) {
      rows.push({
        id: 'hands',
        label: 'Manos a la vista',
        available: true,
        display: `${Math.round(gestures.handsVisibleShare * 100)} %`,
        note: 'Medido en tu dispositivo con la cámara. No se guardó video.',
        source: 'Cámara (seguimiento de manos en el dispositivo)',
      });
      rows.push({
        id: 'handMove',
        label: 'Movimiento de manos',
        available: true,
        display: gestures.movementLabel.toUpperCase(),
        note: 'Referencia relativa; más movimiento no es mejor ni peor.',
        source: 'Cámara (seguimiento de manos en el dispositivo)',
      });
    } else {
      rows.push({ id: 'hands', label: 'Gestos (cámara)', available: false, display: 'Sin datos suficientes', note: 'La cámara casi no tuvo datos (sesión muy corta o sin manos en cuadro).' });
    }
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
        short: `Ritmo rápido (${v} por minuto). Hacé una pausa corta después de cada idea importante.`,
        basedOn: `Palabras por minuto: ${v}`,
      });
    } else if (v < cfg.paceWpm.idealMin) {
      candidates.push({
        weight: (cfg.paceWpm.idealMin - v) / cfg.paceWpm.idealMin,
        text: `Hablaste a unas ${v} palabras por minuto, por debajo del rango de referencia (${cfg.paceWpm.idealMin}–${cfg.paceWpm.idealMax}). Si te sobró tiempo, sumá un ejemplo concreto o repetí el beneficio principal.`,
        short: `Ritmo lento (${v} por minuto). Si te sobró tiempo, sumá un ejemplo concreto.`,
        basedOn: `Palabras por minuto: ${v}`,
      });
    } else {
      candidates.push({
        weight: 0.01,
        text: `Tu ritmo (${v} palabras por minuto) estuvo dentro del rango de referencia. Probá mantenerlo y marcar las ideas clave con una pausa.`,
        short: `Buen ritmo (${v} por minuto). Marcá las ideas clave con una pausa.`,
        basedOn: `Palabras por minuto: ${v}`,
      });
    }
  }

  if (metrics.fillers.available && metrics.fillers.value >= 2 && metrics.fillers.per100 > cfg.fillersPer100.full) {
    const top = Object.entries(metrics.fillers.byTerm).sort((a, b) => b[1] - a[1])[0];
    candidates.push({
      weight: metrics.fillers.per100 / cfg.fillersPer100.zero,
      text: `Se detectaron ${metrics.fillers.value} muletillas, sobre todo «${top[0]}». Probá reemplazarlas por un silencio corto mientras pensás la próxima frase.`,
      short: `${metrics.fillers.value} muletillas, sobre todo «${top[0]}». Probá un silencio corto en su lugar.`,
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
        short: `Usaste el ${pct}% del tiempo. Elegí qué ideas recortar para llegar al cierre.`,
        basedOn: `Uso del tiempo: ${pct}%`,
      });
    } else if (u < cfg.timeUse.idealMin) {
      candidates.push({
        weight: cfg.timeUse.idealMin - u,
        text: `Usaste el ${pct}% del tiempo del escenario. Tenés margen para desarrollar mejor el beneficio o sumar un ejemplo.`,
        short: `Usaste el ${pct}% del tiempo. Tenés margen para desarrollar mejor el beneficio.`,
        basedOn: `Uso del tiempo: ${pct}%`,
      });
    }
  }

  const tips = candidates.sort((a, b) => b.weight - a.weight).slice(0, 2).map(({ text, short, basedOn }) => ({ text, short, basedOn }));
  if (tips.length === 0) {
    tips.push({
      text: 'Con los datos de esta práctica no hay un consejo específico. Completá la autoevaluación y volvé a intentarlo hablando con el micrófono para obtener más medidas.',
      short: 'Sin consejo específico con estos datos. Completá la autoevaluación y probá de nuevo con micrófono.',
      basedOn: 'Datos insuficientes',
    });
  }
  return tips;
}

// ---------- Análisis con IA (interpretación, no medición) ----------

export const RUBRIC_LEVEL_LABELS = { yes: 'CLARO', partial: 'PARCIAL', no: 'FALTA' };
export const RESTRICTION_LABELS = { yes: 'SÍ', partial: 'PARCIAL', no: 'NO', unclear: 'NO SE SABE' };
export const AI_RUBRIC_QUESTIONS = [
  { id: 'problem', label: 'Problema' },
  { id: 'idea', label: 'Idea' },
  { id: 'benefit', label: 'Beneficio' },
  { id: 'close', label: 'Cierre' },
];

const ATTEMPT_LABELS = { quota: 'cuota agotada', 'model-unavailable': 'no disponible', server: 'error del servicio', timeout: 'tardó demasiado' };

export const AI_DISCLAIMER =
  'Es una interpretación automática del audio. Puede equivocarse: no es una medición ni una calificación. Revisala con una persona.';
/** Versión para el espacio 3D, donde cada línea cuesta lugar: dice lo mismo (interpretación, puede fallar, que la revise alguien). */
export const AI_DISCLAIMER_3D = 'Interpretación automática: puede equivocarse. Que la revise una persona.';

/** Resumen de lo que no puede juzgar una herramienta, en una frase (versión 3D de HUMAN_REVIEW_ITEMS). */
export const HUMAN_REVIEW_3D = 'Una persona debe revisar si el problema, la idea, el beneficio y el cierre se entienden.';

/** Aviso del pitch libre, donde la IA SÍ califica (con escala de 1 a 5): sigue siendo una interpretación, no una medición. */
export const AI_DISCLAIMER_FREE =
  'Calificación orientativa de la IA: es una interpretación del audio, no una medición ni una nota oficial. Puede equivocarse. Evalúa cómo está planteada y explicada la idea, no si funcionaría.';
export const AI_DISCLAIMER_FREE_3D = 'Orientativa: puede equivocarse. No dice si funcionaría.';
export const HUMAN_REVIEW_FREE_3D = 'Una persona debe revisar si la idea es viable y si las calificaciones son justas.';
export const HUMAN_REVIEW_FREE_ITEMS = [
  'Si la idea es viable o buena como negocio: la IA no lo evalúa.',
  'Si lo que dijiste es verdad y se puede cumplir.',
  'Si las calificaciones te parecen justas: conviene pedir una segunda opinión.',
  'Si la transcripción refleja lo que dijiste: el reconocimiento puede equivocarse.',
];

/** «3,4 / 5» (coma decimal, sin decimales si es entero) o «Sin calificar». */
export function ratingText(value) {
  if (value == null) return 'Sin calificar';
  return `${String(value).replace('.', ',')} / 5`;
}

/** Filas de calificaciones del pitch libre. */
function buildFreeSection(analysis) {
  const rows = (defs, source, withQuote) => defs.map((d) => {
    const item = source[d.id];
    return {
      id: d.id,
      label: d.label,
      question: d.question,
      rating: item.rating,
      display: item.rating == null ? 'Sin calificar' : `${item.rating} / 5`,
      level: item.rating == null ? null : RATING_LABELS[item.rating],
      note: item.note,
      tip: item.tip || '',
      quote: withQuote ? item.quote : '',
      voice: !!d.voice,
    };
  });
  return {
    rated: analysis.rated,
    topic: analysis.topic,
    idea: { average: analysis.idea.average, display: ratingText(analysis.idea.average), rationale: analysis.idea.rationale, rows: rows(FREE_IDEA_CRITERIA, analysis.idea.criteria, true) },
    fillers: analysis.selling.fillers,
    selling: { average: analysis.selling.average, display: ratingText(analysis.selling.average), rationale: analysis.selling.rationale, rows: rows(FREE_SELLING_ASPECTS, analysis.selling.aspects, false) },
  };
}

/** Primera oración (acotada) de un texto, para mostrar en espacios chicos. */
export function firstSentence(text, max = 120) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  const cut = clean.search(/[.!?](\s|$)/);
  const sentence = cut > 0 ? clean.slice(0, cut + 1) : clean;
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
}

/** Sección «IA» de la devolución según el estado del análisis. */
export function buildAiSection(ai) {
  if (!ai || ai.status === 'off' || !ai.status) return { status: 'off' };
  if (ai.status === 'analyzing') return { status: 'analyzing' };
  if (ai.status === 'error') return { status: 'error', error: ai.error };
  const analysis = ai.result?.analysis;
  if (!analysis) return { status: 'error', error: { code: 'bad-response', message: 'No hay resultado del análisis.' } };
  const failedBefore = (ai.result.attempts || []).map((a) => `${a.model} (${ATTEMPT_LABELS[a.code] || 'falló'})`);
  if (analysis.mode === 'free') {
    return { status: 'done', mode: 'free', model: ai.result.model, failedBefore, analysis, free: buildFreeSection(analysis), disclaimer: AI_DISCLAIMER_FREE };
  }
  return {
    status: 'done',
    model: ai.result.model,
    failedBefore,
    analysis,
    rubricRows: AI_RUBRIC_QUESTIONS.map((q) => ({
      id: q.id,
      label: q.label,
      display: RUBRIC_LEVEL_LABELS[analysis.rubric[q.id].level],
      level: analysis.rubric[q.id].level,
      note: analysis.rubric[q.id].note,
      quote: analysis.rubric[q.id].quote,
      available: true,
    })),
    restriction: { display: RESTRICTION_LABELS[analysis.briefFit.restriction], note: analysis.briefFit.note },
    disclaimer: AI_DISCLAIMER,
  };
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
      short: 'Texto de ejemplo: no lo dijiste vos.',
    });
  } else if (metrics.source === SOURCES.TYPED) {
    banners.push({
      kind: 'typed',
      label: 'TEXTO ESCRITO',
      text: 'La transcripción fue escrita o pegada por vos. No se calculan palabras por minuto ni medidas de voz.',
      short: 'Texto escrito por vos: sin medidas de voz.',
    });
  } else if (metrics.source === SOURCES.AI) {
    banners.push({
      kind: 'edited',
      label: 'TRANSCRIPCIÓN DE LA IA',
      text: 'No hubo reconocimiento del navegador: el texto lo transcribió la IA a partir del audio. Puede tener errores.',
      short: 'Lo transcribió la IA: puede tener errores.',
    });
  } else if (metrics.source === SOURCES.SPEECH_EDITED) {
    banners.push({
      kind: 'edited',
      label: 'TEXTO EDITADO',
      text: 'Corregiste la transcripción del reconocimiento. Las medidas usan tu versión y pueden no reflejar lo dicho.',
      short: 'Texto corregido por vos: las medidas usan tu versión.',
    });
  } else if (metrics.source === SOURCES.NONE) {
    banners.push({
      kind: 'novoice',
      label: 'SIN VOZ',
      text: 'Esta práctica no tiene transcripción. Solo se midió el tiempo; el resto depende de tu autoevaluación.',
      short: 'Sin transcripción: solo se midió el tiempo.',
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
    measurements: buildMeasurements(metrics, context.targetSec, capture.gestures ?? null),
    gestures: capture.gestures ?? null,
    ai: buildAiSection(capture.ai),
    tips: buildTips(metrics, config),
    banners: buildBanners(metrics),
    humanReview: context.free ? HUMAN_REVIEW_FREE_ITEMS : HUMAN_REVIEW_ITEMS,
    free: !!context.free,
    rubricSummary: summarizeRubric(context.rubric || {}),
    questions: PRACTICE_QUESTIONS,
    sourceLabel: SOURCE_LABELS[capture.source] || SOURCE_LABELS.none,
  };
}
