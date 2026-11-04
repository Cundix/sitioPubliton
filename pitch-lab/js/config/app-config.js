// Configuración general de Publitón Pitch Lab.
// Todo lo que el equipo puede querer ajustar sin tocar la lógica está acá.

export const APP_CONFIG = {
  // Reconocimiento de voz (Web Speech API del navegador).
  speech: {
    lang: 'es-AR',          // idioma principal
    fallbackLang: 'es-ES',  // se prueba una vez si el principal no está soportado
    maxAutoRestarts: 6,     // reinicios automáticos si el navegador corta la escucha
  },

  // Tiempo de preparación (cuenta regresiva previa a la presentación).
  prep: {
    minSec: 0,    // 0 = sin cuenta regresiva
    maxSec: 300,
    stepSec: 15,
  },

  // Avisos de tiempo durante la presentación (en segundos restantes).
  timeWarnings: {
    warnSec: 20,   // "quedan pocos segundos"
    finalSec: 10,  // "cuenta final"
  },

  // Palabras o frases que se cuentan como muletillas. Editable.
  // Ojo: los reconocedores suelen omitir "eh" o "mm", y algunas palabras
  // pueden ser legítimas según el contexto. Es una referencia, no un veredicto.
  fillers: [
    'eh', 'ehh', 'em', 'mm', 'mmm',
    'o sea', 'digamos', 'como que', 'básicamente', 'la verdad que',
  ],

  // Datos mínimos para mostrar métricas e indicador.
  minimums: {
    metricsSeconds: 10,     // duración efectiva mínima para hablar de ritmo
    indicatorWords: 40,     // palabras mínimas para el indicador técnico
    indicatorSeconds: 20,   // segundos efectivos mínimos para el indicador
  },

  // Fórmula del "Indicador técnico orientativo" (0–100).
  indicator: {
    weights: { pace: 0.4, fillers: 0.3, timeUse: 0.3 },
    paceWpm: { idealMin: 110, idealMax: 160, zeroBelow: 60, zeroAbove: 220 },
    fillersPer100: { full: 1, zero: 8 },
    timeUse: { idealMin: 0.7, idealMax: 1.05, zeroBelow: 0.3, zeroAbove: 1.5 },
  },

  // Medición opcional del nivel de audio (separada del reconocimiento de voz).
  audioMeter: {
    silenceRms: 0.015,      // por debajo de este nivel RMS se considera "sin sonido"
    longPauseSec: 2,        // pausa larga = sin sonido durante al menos esto
    sampleMs: 100,
  },

  // Movimiento en computadora.
  movement: {
    walkSpeed: 1.6,         // metros por segundo
    turnSpeedDeg: 70,       // grados por segundo con Q/E
    seatedOffsetM: 0.45,    // cuánto se eleva la vista en "modo sentado" (VR)
  },
};

// Transcripción de ejemplo. Se muestra SIEMPRE rotulada como "Demostración".
export const DEMO_TRANSCRIPT =
  'Este es un texto de demostración que no fue dicho por la persona. ' +
  'Sirve para comprobar cómo se calcula la devolución. ' +
  'Presentamos una idea para invitar a hacer una pausa real. ' +
  'El problema es que los descansos terminan en el celular. ' +
  'La propuesta es una señal en el espacio que invita a levantarse. ' +
  'El beneficio es volver con la cabeza más despejada. ' +
  'O sea, queremos que pausar sea fácil y visible.';

// Preguntas de práctica PREDEFINIDAS (no son respuestas a lo que dijiste).
export const PRACTICE_QUESTIONS = [
  '¿Cuál es la idea central, dicha en una sola frase?',
  '¿Qué cambiaría en la vida de la audiencia si la campaña funciona?',
  '¿Qué harías si el presupuesto fuera la mitad?',
];
