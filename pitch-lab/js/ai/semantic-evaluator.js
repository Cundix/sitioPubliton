// Interfaz PREPARADA para una futura evaluación semántica con IA.
// HOY NO EXISTE: no hay ningún servicio conectado y el producto no depende de esto.
//
// Para conectarla más adelante habría que:
//   1. Implementar una clase con esta misma forma (evaluate devuelve una promesa).
//   2. Hacerlo mediante un backend propio: nunca poner claves en el cliente.
//   3. Pedir consentimiento explícito antes de enviar la transcripción.
//   4. Mostrar el resultado rotulado como "Evaluación asistida por IA" y revisable por una persona.
//
// Forma esperada del resultado:
//   { rubric: { problem: 'yes'|'partial'|'no', idea: ..., benefit: ..., close: ... }, notes: string[] }

export class SemanticEvaluatorUnavailable extends Error {
  constructor() {
    super('La evaluación semántica con IA no está disponible en esta versión.');
    this.code = 'semantic-evaluator-unavailable';
  }
}

export class SemanticEvaluator {
  /** Siempre false mientras no exista una implementación real. */
  get available() { return false; }

  /**
   * @param {{ transcript: string, brief: object }} _input
   * @returns {Promise<{rubric: object, notes: string[]}>}
   */
  async evaluate(_input) {
    throw new SemanticEvaluatorUnavailable();
  }
}

export const semanticEvaluator = new SemanticEvaluator();
