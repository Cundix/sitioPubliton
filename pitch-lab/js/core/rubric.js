// Rúbrica de autoevaluación del contenido. La completa la persona: la herramienta NO evalúa el contenido.

export const RUBRIC_QUESTIONS = [
  { id: 'problem', label: '¿Presenté el problema?' },
  { id: 'idea', label: '¿Expliqué la idea?' },
  { id: 'benefit', label: '¿Justifiqué el beneficio?' },
  { id: 'close', label: '¿Cerré con una propuesta clara?' },
];

// Respuestas posibles. Cada una tiene texto y símbolo (no depende solo del color).
export const RUBRIC_ANSWERS = {
  yes: { label: 'Sí', symbol: '✓', icon: 'check' },
  partial: { label: 'A medias', symbol: '◐', icon: 'half' },
  no: { label: 'No todavía', symbol: '✕', icon: 'cross' },
  none: { label: 'Sin responder', symbol: '○', icon: 'empty' },
};

const CYCLE = [null, 'yes', 'partial', 'no'];

export function emptyRubric() {
  return Object.fromEntries(RUBRIC_QUESTIONS.map((q) => [q.id, null]));
}

/** Siguiente respuesta al tocar un ítem: sin responder → sí → a medias → no todavía → sin responder. */
export function nextAnswer(current) {
  const i = CYCLE.indexOf(current ?? null);
  return CYCLE[(i + 1) % CYCLE.length];
}

export function answerInfo(value) {
  return RUBRIC_ANSWERS[value ?? 'none'];
}

export function summarizeRubric(rubric) {
  const answered = RUBRIC_QUESTIONS.filter((q) => rubric[q.id]).length;
  const yes = RUBRIC_QUESTIONS.filter((q) => rubric[q.id] === 'yes').length;
  const partial = RUBRIC_QUESTIONS.filter((q) => rubric[q.id] === 'partial').length;
  const pending = RUBRIC_QUESTIONS.filter((q) => !rubric[q.id]).map((q) => q.label);
  return { total: RUBRIC_QUESTIONS.length, answered, yes, partial, pending };
}
