// Estados y transiciones de la experiencia.
//
// FLOW es una tabla: para cada estado, qué eventos se aceptan y adónde llevan.
// Cualquier evento que NO figure en el estado actual se rechaza. Así un botón
// de una pantalla anterior nunca puede alterar la sesión.
//
// Cada entrada puede tener:
//   guard(data, payload) -> boolean   si devuelve false, el evento se rechaza
//   to                   -> estado destino (texto o función de data/payload).
//                           Se evalúa ANTES de run().
//   run(data, payload)               cambia los datos (sin timers ni voz: eso lo hace Session)
//
// Si falta `to`, el estado no cambia (es una acción dentro de la misma pantalla).

import { APP_CONFIG } from '../config/app-config.js';
import { getScenario } from '../config/scenarios.js';
import { BRIEFS } from '../config/briefs.js';
import { emptyRubric, nextAnswer } from './rubric.js';

export const S = Object.freeze({
  LOADING: 'loading',
  HOME: 'home',
  TUTORIAL: 'tutorial',
  SETTINGS: 'settings',
  AI_SETUP: 'ai-setup',
  SELECT: 'select',
  BRIEF: 'brief',
  PREP: 'prep',
  STARTING: 'starting',
  VOICE_PROBLEM: 'voice-problem',
  PRESENTING: 'presenting',
  PAUSED: 'paused',
  CONFIRM_CANCEL: 'confirm-cancel',
  REVIEW: 'review',
  FEEDBACK: 'feedback',
});

/** Estados en los que hay una sesión activa que no se debe perder por accidente. */
export const ACTIVE_STATES = Object.freeze([S.STARTING, S.PRESENTING, S.PAUSED, S.CONFIRM_CANCEL]);

export const TUTORIAL_STEPS = 3;
export const FEEDBACK_PAGES = 5; // 1 medidas · 2 autoevaluación · 3 consejos · 4 IA contenido · 5 IA entrega

export function createInitialData(overrides = {}) {
  return {
    capabilities: { speech: false, ai: false, camera: false, ...(overrides.capabilities || {}) },
    tutorialSeen: overrides.tutorialSeen ?? false,
    tutorialStep: 0,
    tutorialReturn: S.SELECT,
    settingsReturn: S.HOME,
    aiReturn: S.PREP,
    scenarioId: null,
    briefIndex: 0,
    options: {
      inputMode: overrides.capabilities?.speech ? 'voice' : 'timer',
      unlimited: false,
      measureAudio: false,
      aiAnalysis: false,   // análisis con IA (grabación + Gemini): opcional y con clave propia
      gestures: false,     // gestos con la cámara (en el dispositivo): opcional
      prepSec: null,
    },
    ai: { status: 'off', error: null, model: null },   // off | analyzing | done | error
    voiceProblem: null,
    voiceRetries: 0,
    cancelReturn: null,
    feedbackPage: 0,
    rubric: emptyRubric(),
    notice: null,
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** ¿Se está usando el reconocimiento de voz del navegador? (hay revisión de transcripción solo en ese caso) */
export function usesSpeech(data) {
  return data.options.inputMode === 'voice' && data.capabilities.speech;
}

/** Qué estado sigue cuando termina la presentación. */
function afterPresenting(data) {
  return usesSpeech(data) ? S.REVIEW : S.FEEDBACK;
}

export const FLOW = {
  [S.LOADING]: {
    READY: { to: S.HOME },
  },

  [S.HOME]: {
    START: {
      to: (d) => (d.tutorialSeen ? S.SELECT : S.TUTORIAL),
      run: (d) => { d.tutorialStep = 0; d.tutorialReturn = S.SELECT; },
    },
    OPEN_HELP: { to: S.TUTORIAL, run: (d) => { d.tutorialStep = 0; d.tutorialReturn = S.HOME; } },
    OPEN_SETTINGS: { to: S.SETTINGS, run: (d) => { d.settingsReturn = S.HOME; } },
  },

  [S.TUTORIAL]: {
    NEXT: {
      to: (d) => (d.tutorialStep >= TUTORIAL_STEPS - 1 ? d.tutorialReturn : S.TUTORIAL),
      run: (d) => {
        if (d.tutorialStep < TUTORIAL_STEPS - 1) d.tutorialStep += 1;
        else d.tutorialSeen = true;
      },
    },
    BACK: { guard: (d) => d.tutorialStep > 0, run: (d) => { d.tutorialStep -= 1; } },
    SKIP: { to: (d) => d.tutorialReturn, run: (d) => { d.tutorialSeen = true; } },
  },

  [S.SETTINGS]: {
    CLOSE: { to: (d) => d.settingsReturn },
  },

  [S.SELECT]: {
    PICK_SCENARIO: {
      guard: (d, p) => !!getScenario(p?.id),
      run: (d, p) => {
        d.scenarioId = p.id;
        d.options.prepSec = getScenario(p.id).prepSec;
      },
    },
    ENTER: { guard: (d) => !!d.scenarioId, to: S.BRIEF },
    BACK: { to: S.HOME },
    OPEN_SETTINGS: { to: S.SETTINGS, run: (d) => { d.settingsReturn = S.SELECT; } },
  },

  [S.BRIEF]: {
    PREPARE: { to: S.PREP },
    NEXT_BRIEF: { run: (d) => { d.briefIndex = (d.briefIndex + 1) % BRIEFS.length; } },
    CHANGE_SCENARIO: { to: S.SELECT },
    OPEN_SETTINGS: { to: S.SETTINGS, run: (d) => { d.settingsReturn = S.BRIEF; } },
  },

  [S.PREP]: {
    BEGIN: {
      // Se pasa por «starting» cuando hay que pedir permisos (micrófono y/o cámara).
      to: (d) => (d.options.inputMode === 'voice' || (d.options.gestures && d.capabilities.camera) ? S.STARTING : S.PRESENTING),
    },
    OPEN_AI: { to: S.AI_SETUP, run: (d) => { d.aiReturn = S.PREP; } },
    BACK: { to: S.BRIEF },
    SET_INPUT_MODE: {
      guard: (d, p) => (p?.mode === 'voice' ? d.capabilities.speech || (d.options.aiAnalysis && d.capabilities.ai) : p?.mode === 'timer'),
      run: (d, p) => { d.options.inputMode = p.mode; if (p.mode === 'timer') d.options.measureAudio = false; },
    },
    TOGGLE_UNLIMITED: { run: (d) => { d.options.unlimited = !d.options.unlimited; } },
    TOGGLE_METER: {
      guard: (d) => d.options.inputMode === 'voice',
      run: (d) => { d.options.measureAudio = !d.options.measureAudio; },
    },
    ADJUST_PREP: {
      run: (d, p) => {
        const { minSec, maxSec } = APP_CONFIG.prep;
        d.options.prepSec = clamp((d.options.prepSec ?? 0) + (p?.delta ?? 0), minSec, maxSec);
      },
    },
  },

  [S.AI_SETUP]: {
    TOGGLE_AI: {
      guard: (d) => d.capabilities.ai || d.options.aiAnalysis,
      run: (d) => {
        d.options.aiAnalysis = !d.options.aiAnalysis;
        // La IA analiza el audio: hace falta el micrófono. Sin IA y sin reconocimiento del navegador, no hay voz.
        if (d.options.aiAnalysis) d.options.inputMode = 'voice';
        else if (!d.capabilities.speech) { d.options.inputMode = 'timer'; d.options.measureAudio = false; }
      },
    },
    TOGGLE_GESTURES: {
      guard: (d) => d.capabilities.camera || d.options.gestures,
      run: (d) => { d.options.gestures = !d.options.gestures; },
    },
    CLOSE: { to: (d) => d.aiReturn || S.PREP },
  },

  [S.STARTING]: {
    MIC_READY: { to: S.PRESENTING },
    MIC_FAILED: {
      to: S.VOICE_PROBLEM,
      run: (d, p) => { d.voiceProblem = { code: p?.code || 'unknown', message: p?.message || '' }; },
    },
    CANCEL: { to: S.PREP },
  },

  [S.VOICE_PROBLEM]: {
    USE_TIMER_ONLY: {
      to: S.PRESENTING,
      run: (d) => { d.options.inputMode = 'timer'; d.options.measureAudio = false; d.voiceProblem = null; },
    },
    RETRY_VOICE: { to: S.STARTING, run: (d) => { d.voiceRetries += 1; d.voiceProblem = null; } },
    BACK: { to: S.PREP, run: (d) => { d.voiceProblem = null; } },
  },

  [S.PRESENTING]: {
    PAUSE: { to: S.PAUSED },
    FINISH: { to: afterPresenting },
    TIME_UP: { to: afterPresenting, run: (d) => { d.notice = { kind: 'info', text: 'Se cumplió el tiempo del escenario.' }; } },
    REQUEST_CANCEL: { to: S.CONFIRM_CANCEL, run: (d) => { d.cancelReturn = S.PRESENTING; } },
  },

  [S.PAUSED]: {
    RESUME: { to: S.PRESENTING },
    FINISH: { to: afterPresenting },
    REQUEST_CANCEL: { to: S.CONFIRM_CANCEL, run: (d) => { d.cancelReturn = S.PAUSED; } },
  },

  [S.CONFIRM_CANCEL]: {
    KEEP: { to: (d) => d.cancelReturn || S.PAUSED },
    CONFIRM: {
      to: S.BRIEF,
      run: (d) => { d.cancelReturn = null; d.notice = { kind: 'info', text: 'Sesión cancelada. No se guardó nada.' }; },
    },
  },

  [S.REVIEW]: {
    SET_TRANSCRIPT: {},   // lo resuelve Session (cambia la captura, no solo los datos)
    LOAD_DEMO: {},        // ídem
    CONTINUE: { to: S.FEEDBACK, run: (d) => { d.feedbackPage = 0; } },
    RETRY: { to: S.PREP },
    AI_RETRY: {},         // lo resuelve Session (vuelve a enviar la grabación que sigue en memoria)
  },

  [S.FEEDBACK]: {
    PAGE_NEXT: { run: (d) => { d.feedbackPage = Math.min(FEEDBACK_PAGES - 1, d.feedbackPage + 1); } },
    PAGE_PREV: { run: (d) => { d.feedbackPage = Math.max(0, d.feedbackPage - 1); } },
    SET_PAGE: {
      guard: (d, p) => Number.isInteger(p?.page) && p.page >= 0 && p.page < FEEDBACK_PAGES,
      run: (d, p) => { d.feedbackPage = p.page; },
    },
    RUBRIC_CYCLE: {
      guard: (d, p) => Object.prototype.hasOwnProperty.call(d.rubric, p?.id),
      run: (d, p) => { d.rubric[p.id] = nextAnswer(d.rubric[p.id]); },
    },
    EDIT_TRANSCRIPT: { guard: (d) => usesSpeech(d), to: S.REVIEW },
    AI_RETRY: {},
    RETRY: { to: S.PREP },
    CHANGE_SCENARIO: { to: S.SELECT },
  },
};

/** Eventos permitidos hoy en un estado (útil para pantallas y tests). */
export function allowedEvents(state) {
  return Object.keys(FLOW[state] || {});
}

