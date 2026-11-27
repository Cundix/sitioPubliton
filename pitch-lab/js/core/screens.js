// Modelo de pantalla: para cada estado, QUÉ se muestra y QUÉ acciones hay.
// Es un objeto de datos puro. Lo dibujan dos "renderizadores" distintos:
//   - el espacio 3D (paneles, atril, reloj)  -> js/components/*
//   - el panel de texto accesible (HTML)      -> js/ui/html-overlay.js
// Así las dos vistas siempre dicen lo mismo y no pueden desincronizarse.
//
// Acción = { id, label, kind, event?, payload?, ui?, disabled?, on?, hint? }
//   kind: 'primary' | 'secondary' | 'danger' | 'toggle' | 'choice' | 'tab'
//   event/payload -> se envía a session.dispatch(event, payload)
//   ui            -> acción de interfaz (volumen, recentrar, etc.), la resuelve main.js

import { S, TUTORIAL_STEPS, usesSpeech } from './state-machine.js';
import { SCENARIOS } from '../config/scenarios.js';
import { BRIEFS } from '../config/briefs.js';
import { APP_CONFIG } from '../config/app-config.js';
import { RUBRIC_QUESTIONS, answerInfo } from './rubric.js';
import {
  formatClock, firstSentence, AI_DISCLAIMER, AI_DISCLAIMER_3D, HUMAN_REVIEW_3D, AI_DISCLAIMER_FREE, AI_DISCLAIMER_FREE_3D, HUMAN_REVIEW_FREE_3D,
} from './feedback.js';
import { SOURCES, SOURCE_LABELS } from './metrics.js';
import { WARNING_LABELS } from './time-warnings.js';
import { snapTurnLabel, heightLabel } from './settings.js';

const act = (id, label, kind, extra = {}) => ({ id, label, kind, ...extra });
const ev = (event, payload) => ({ event, payload });

const TUTORIAL = [
  {
    eyebrow: 'TUTORIAL 1 DE 3',
    title: ['CÓMO', 'MOVERTE'],
    bullets: [
      'Mouse: arrastrá para mirar alrededor.',
      'W A S D o flechas: caminar. Q y E: girar.',
      'Con casco VR: marcas del piso para teletransportarte y joystick para girar. No hay desplazamiento continuo.',
    ],
  },
  {
    eyebrow: 'TUTORIAL 2 DE 3',
    title: ['CÓMO USAR', 'LOS BOTONES'],
    bullets: [
      'Apuntá con el mouse o con el láser del control.',
      'Clic o gatillo para presionar. Los botones grandes del atril son los principales.',
      'Finalizar pide mantener presionado un momento, para no terminar sin querer.',
      'Teclado: Enter acción principal · P pausa · Esc cancelar · R recentrar.',
    ],
  },
  {
    eyebrow: 'TUTORIAL 3 DE 3',
    title: ['CÓMO SE', 'PRESENTA'],
    bullets: [
      'Elegís un espacio y recibís un brief ficticio, o activás «Pitch libre» y vendés lo que quieras.',
      'Te preparás y empezás cuando quieras. Podés pausar o terminar antes.',
      'Hablás con micrófono o practicás solo con el temporizador. Al final hay una devolución y podés reintentar.',
    ],
  },
];

const VOICE_PROBLEM_TEXT = {
  denied: {
    title: ['SIN ACCESO', 'AL MICRÓFONO'],
    text: 'El permiso fue rechazado o está bloqueado. Si querés usar voz, habilitalo desde el candado de la barra de direcciones y probá de nuevo.',
  },
  'service-denied': {
    title: ['RECONOCIMIENTO', 'NO PERMITIDO'],
    text: 'El navegador no permite el servicio de reconocimiento de voz en este momento.',
  },
  'no-mic': {
    title: ['NO HAY', 'MICRÓFONO'],
    text: 'No se encontró un micrófono disponible. Conectá uno o practicá solo con temporizador.',
  },
  network: {
    title: ['SIN CONEXIÓN AL', 'RECONOCIMIENTO'],
    text: 'El reconocimiento de voz del navegador necesita conexión a su servicio. Revisá tu red o practicá sin micrófono.',
  },
  language: {
    title: ['IDIOMA NO', 'DISPONIBLE'],
    text: 'Este navegador no ofrece reconocimiento en español.',
  },
  unsupported: {
    title: ['RECONOCIMIENTO', 'NO DISPONIBLE'],
    text: 'Este navegador no ofrece reconocimiento de voz. Podés practicar con temporizador y autoevaluación.',
  },
  unknown: {
    title: ['FALLÓ EL', 'RECONOCIMIENTO'],
    text: 'No se pudo iniciar el reconocimiento de voz. Podés intentar de nuevo o practicar sin micrófono.',
  },
};

const HOLD_FINISH_HINT = 'Mantené presionado «Finalizar» para terminar la presentación.';

const MIC_DISCLOSURE =
  'Al comenzar, el navegador te pedirá permiso para usar el micrófono. En algunos navegadores (por ejemplo Chrome) el audio se envía a un servicio externo del navegador para reconocerlo. Esta experiencia no graba ni guarda audio ni texto.';

// Versiones para el espacio 3D (dentro del casco no hay panel de texto y cada línea cuesta lugar con letra legible).
const MIC_DISCLOSURE_3D =
  'El navegador pide permiso para el micrófono y, en algunos, envía el audio a un servicio externo para reconocerlo. No se guarda audio ni texto.';
const AI_DISCLOSURE_3D =
  'Tu voz se graba y se envía a Google (Gemini) con tu clave. De la cámara solo salen números. No se guarda audio ni texto.';

const AI_DISCLOSURE =
  'Se graba tu voz en la memoria del navegador y, al terminar, se envía a Google (API de Gemini) con tu propia clave, junto con el brief. De la cámara solo salen números, nunca video. Con una clave gratuita, Google puede usar lo enviado para mejorar sus productos. Este sitio no guarda audio ni texto.';

/** Texto corto del estado de la captura durante la presentación. */
function liveHint(session) {
  const { options } = session.data;
  const extras = [session.aiRecording ? 'grabando para la IA' : '', session.cameraOn ? 'cámara activa' : ''].filter(Boolean).join(' · ');
  const suffix = extras ? ` · ${extras}` : '';
  if (options.inputMode !== 'voice') return `Práctica con temporizador. No se usa el micrófono${suffix}.`;
  if (!usesSpeech(session.data)) return `Micrófono activo${suffix}.`;
  if (session.capture.voiceLost) return `Se perdió el reconocimiento. Seguís con el temporizador${suffix}.`;
  const interim = session.capture.interim;
  if (interim) return `Escuchando · «…${interim.slice(-40)}»${suffix}`;
  return `Micrófono activo · reconociendo en español${suffix}.`;
}

/** Bloques de estado del análisis con IA cuando todavía no hay resultado (o falló). */
function aiStatusPage(session, ai, panel) {
  if (ai.status === 'off') {
    panel.title = ['IA NO', 'ACTIVADA'];
    panel.blocks = [
      { t: 'p', text: session.isFreePitch ? 'Activala en la preparación, en «IA y cámara», para que la IA califique tu idea y cómo la vendiste.' : 'Activala en la preparación, en «IA y cámara», para recibir un análisis del audio: contenido frente al brief, entrega y consejos.' },
      { t: 'notice', kind: 'info', label: 'OPCIONAL', text: 'Hace falta tu propia clave de Gemini. Sin ella todo lo demás funciona igual.' },
    ];
    return true;
  }
  if (ai.status === 'analyzing') {
    panel.title = ['ANALIZANDO', 'CON IA'];
    panel.blocks = [
      { t: 'p', text: 'Estamos enviando tu audio a la IA y esperando su respuesta. Suele tardar entre 10 y 30 segundos.' },
      { t: 'p', tone: 'muted', text: 'Mientras tanto podés ver las otras pestañas.' },
    ];
    return true;
  }
  if (ai.status === 'error') {
    panel.title = ['NO SE PUDO', 'ANALIZAR'];
    panel.blocks = [
      { t: 'notice', kind: 'warn', label: 'SIN ANÁLISIS DE LA IA', text: ai.error?.message || 'No se pudo completar el análisis.' },
      { t: 'p', tone: 'muted', text: session.canRetryAi ? 'La grabación sigue en la memoria de esta pestaña: podés reintentar sin volver a presentar.' : 'Podés volver a intentar la presentación. Lo demás de la devolución sigue siendo válido.' },
    ];
    if (session.canRetryAi) panel.options.push(act('ai-retry', 'Reintentar análisis', 'secondary', ev('AI_RETRY')));
    return true;
  }
  return false;
}

function clockModel(session) {
  const view = session.getTimeView();
  const { state } = session;
  const sc = session.scenario;

  if (state === S.PREP) {
    if (!(view.prepSec > 0)) return { mode: 'prep', label: 'PREPARACIÓN', time: '--:--', sub: 'Sin cuenta regresiva', short: 'SIN CUENTA', warning: 'none', progress: 0 };
    return {
      mode: 'prep',
      label: view.prepDone ? 'PREPARACIÓN LISTA' : 'PREPARACIÓN',
      time: formatClock(view.prepRemainingSec ?? view.prepSec),
      sub: view.prepDone ? 'Empezá cuando quieras' : 'Tiempo para pensar',
      short: view.prepDone ? 'LISTO' : 'A PENSAR',
      warning: 'none',
      progress: view.prepSec ? 1 - (view.prepRemainingSec ?? view.prepSec) / view.prepSec : 0,
    };
  }

  if ([S.PRESENTING, S.PAUSED, S.CONFIRM_CANCEL, S.STARTING].includes(state)) {
    const unlimited = view.totalSec == null;
    const paused = state === S.PAUSED || state === S.CONFIRM_CANCEL;
    return {
      mode: 'timer',
      label: paused ? 'EN PAUSA' : unlimited ? 'TRANSCURRIDO' : 'RESTANTE',
      time: formatClock(unlimited ? view.elapsedSec : view.remainingSec ?? 0),
      sub: unlimited ? 'Práctica sin límite' : WARNING_LABELS[view.warning],
      short: paused ? 'DETENIDO' : unlimited ? 'SIN LÍMITE' : WARNING_LABELS[view.warning],
      warning: paused ? 'none' : view.warning,
      progress: unlimited ? 0 : Math.min(1, view.elapsedSec / view.totalSec),
      paused,
    };
  }

  const total = sc ? (session.data.options.unlimited ? null : sc.durationSec) : null;
  return {
    mode: 'idle',
    label: 'DURACIÓN',
    time: total ? formatClock(total) : '--:--',
    sub: sc ? sc.name : 'Elegí un escenario',
    short: '',
    warning: 'none',
    progress: 0,
  };
}

/** Construye el modelo de pantalla completo para el estado actual. */
export function buildScreen(session, settings, env = {}) {
  const { state, data } = session;
  const sc = session.scenario;
  const brief = session.brief;
  const options = data.options;
  const model = {
    state,
    announce: '',
    panel: { visible: true, eyebrow: '', title: [], blocks: [], options: [] },
    lectern: { status: '', hint: '', actions: [] },
    clock: clockModel(session),
    notice: data.notice,
  };
  const { panel, lectern } = model;

  switch (state) {
    case S.LOADING:
      panel.eyebrow = 'PUBLITÓN · PITCH LAB';
      panel.title = ['CARGANDO', 'EL ESPACIO'];
      lectern.status = 'CARGANDO';
      break;

    case S.HOME:
      panel.eyebrow = 'PUBLITÓN · PITCH LAB';
      panel.title = ['TU IDEA MERECE', 'UN BUEN PITCH.'];
      panel.blocks = [
        { t: 'p', text: 'Elegí un espacio, recibí un brief ficticio (o elegí «Pitch libre» y vendé lo que quieras) y presentá frente a una audiencia virtual.' },
        { t: 'p', tone: 'muted', text: 'Al terminar, una devolución te muestra lo que se pudo medir y podés volver a intentarlo.' },
      ];
      lectern.status = 'INICIO';
      lectern.hint = 'Apuntá a un botón y presioná.';
      lectern.actions = [
        act('start', 'Empezar', 'primary', ev('START')),
        act('help', 'Ver controles', 'secondary', ev('OPEN_HELP')),
        act('settings', 'Ajustes', 'secondary', ev('OPEN_SETTINGS')),
      ];
      break;

    case S.TUTORIAL: {
      const step = TUTORIAL[data.tutorialStep];
      panel.eyebrow = step.eyebrow;
      panel.title = step.title;
      panel.blocks = [{ t: 'bullets', items: step.bullets }];
      lectern.status = 'TUTORIAL';
      lectern.hint = 'Podés saltarlo cuando quieras.';
      lectern.actions = [
        act('next', data.tutorialStep === TUTORIAL_STEPS - 1 ? '¡Listo!' : 'Siguiente', 'primary', ev('NEXT')),
        ...(data.tutorialStep > 0 ? [act('back', 'Anterior', 'secondary', ev('BACK'))] : []),
        act('skip', 'Saltar tutorial', 'secondary', ev('SKIP')),
      ];
      break;
    }

    case S.SETTINGS: {
      panel.layout = 'grid';
      panel.eyebrow = 'AJUSTES';
      panel.title = ['A TU', 'MEDIDA'];
      panel.blocks = [
        { t: 'meter', label: 'Volumen de los avisos', value: settings.get('volume'), text: `${Math.round(settings.get('volume') * 100)}%` },
        { t: 'kv', rows: [{ k: 'Altura de la vista en VR', v: heightLabel(settings.get('heightCm')) }] },
        { t: 'p', tone: 'muted', htmlOnly: true, text: 'Los avisos de tiempo siempre tienen señal visual además del sonido.' },
      ];
      panel.options = [
        act('vol-down', 'Bajar volumen', 'secondary', { ui: 'volume-down', icon: 'minus' }),
        act('vol-up', 'Subir volumen', 'secondary', { ui: 'volume-up', icon: 'plus' }),
        act('motion', 'Movimiento reducido', 'toggle', { ui: 'toggle-motion', on: settings.get('reducedMotion') }),
        act('seated', 'Modo sentado (VR)', 'toggle', { ui: 'toggle-seated', on: settings.get('seated') }),
        act('snap', `Giro con joystick: ${snapTurnLabel(settings.get('snapTurnDeg'))}`, 'secondary', { ui: 'cycle-snap' }),
        act('haptics', 'Vibración de controles', 'toggle', { ui: 'toggle-haptics', on: settings.get('haptics') }),
        act('height-down', 'Bajar la vista', 'secondary', { ui: 'height-down', icon: 'minus' }),
        act('height-up', 'Subir la vista', 'secondary', { ui: 'height-up', icon: 'plus' }),
      ];
      lectern.status = 'AJUSTES';
      lectern.hint = 'Se guardan en este navegador.';
      lectern.actions = [act('close', 'Listo', 'primary', ev('CLOSE'))];
      break;
    }

    case S.SELECT: {
      panel.eyebrow = 'ELEGÍ UN ESCENARIO';
      panel.options = SCENARIOS.map((s) =>
        act(`pick-${s.id}`, `${s.name} · ${formatClock(s.durationSec)}`, 'choice', { ...ev('PICK_SCENARIO', { id: s.id }), on: data.scenarioId === s.id }));
      if (sc) {
        panel.title = sc.name.toUpperCase().split(' ').reduce((lines, word) => {
          const last = lines[lines.length - 1];
          if (last && (last + ' ' + word).length <= 14) lines[lines.length - 1] = `${last} ${word}`;
          else lines.push(word);
          return lines;
        }, []);
        panel.blocks = [
          { t: 'p', text: sc.description },
          { t: 'kv', rows: [
            { k: 'Duración', v: formatClock(sc.durationSec) },
            { k: 'Espacio', v: sc.spaceNote },
            { k: 'Preparación', v: formatClock(options.prepSec ?? sc.prepSec) },
          ] },
        ];
      } else {
        panel.title = ['TRES ESPACIOS,', 'TRES ESCALAS.'];
        panel.blocks = [
          { t: 'p', text: 'Apuntá a una maqueta o a una opción de la derecha. Cada espacio cambia la distancia y el tamaño del público.' },
        ];
      }
      lectern.status = 'ESCENARIOS';
      lectern.hint = sc ? sc.short : 'Elegí uno para continuar.';
      lectern.actions = [
        sc
          ? act('enter', `Entrar: ${sc.name}`, 'primary', ev('ENTER'))
          : act('enter', 'Elegí un escenario', 'primary', { ...ev('ENTER'), disabled: true }),
        act('back', 'Volver', 'secondary', ev('BACK')),
        act('settings', 'Ajustes', 'secondary', ev('OPEN_SETTINGS')),
      ];
      break;
    }

    case S.BRIEF:
      panel.eyebrow = `${sc.name.toUpperCase()} · ${brief.free ? 'PITCH LIBRE' : 'BRIEF'}`;
      panel.title = [brief.brand.toUpperCase()];
      panel.blocks = [
        { t: 'notice', kind: 'info', label: brief.free ? 'SIN BRIEF' : 'MARCA FICTICIA', text: brief.brandNote.replace(/^(Marca ficticia|Sin brief) · /i, '').replace(/^./, (c) => c.toUpperCase()) },
        { t: 'fields', rows: [
          { k: brief.free ? 'Qué vendés' : 'Problema', v: brief.problem },
          { k: 'Público', v: brief.audience },
          { k: 'Objetivo', v: brief.objective },
          { k: brief.free ? 'Restricción' : 'Restricción creativa', v: brief.constraint },
        ] },
      ];
      // «Pitch libre»: sin brief, vendés lo que quieras; si la IA está activada, califica la idea y cómo la vendés.
      // El botón va en el atril y no en el panel: con opciones, el panel reserva una columna y el brief ya no entra con la letra mínima.
      // El atril admite 4 botones: «Pitch libre» ocupa el lugar de «Ajustes», que sigue en el inicio y en la elección de escenario.
      lectern.status = brief.free ? 'PITCH LIBRE' : 'BRIEF';
      lectern.hint = brief.guide;
      lectern.actions = [
        act('prepare', 'Preparar presentación', 'primary', ev('PREPARE')),
        act('other-brief', brief.free ? 'Usar un brief' : `Otro brief ${(data.briefIndex % BRIEFS.length) + 1}/${BRIEFS.length}`, 'secondary', ev('NEXT_BRIEF')),
        act('free-pitch', `Pitch libre: ${data.freePitch ? 'SÍ' : 'NO'}`, 'secondary', { ...ev('TOGGLE_FREE_PITCH'), on: !!data.freePitch }),
        act('change-scenario', 'Cambiar escenario', 'secondary', ev('CHANGE_SCENARIO')),
      ];
      break;

    case S.PREP: {
      const voice = options.inputMode === 'voice';
      const micAvailable = data.capabilities.speech || (options.aiAnalysis && data.capabilities.ai);
      panel.eyebrow = `PREPARACIÓN · ${sc.name.toUpperCase()}`;
      panel.title = ['PREPARÁ TU PITCH'];
      panel.blocks = [
        { t: 'p', text: `Dura ${options.unlimited ? 'lo que necesites' : formatClock(sc.durationSec)}. Pensá en este orden:` },
        { t: 'bullets', items: ['1. El problema', '2. Tu idea', '3. El beneficio', '4. Un cierre con propuesta clara'] },
        ...(brief.free && !options.aiAnalysis
          ? [{ t: 'notice', kind: 'info', label: 'PITCH LIBRE', optional3D: true, text: 'La IA califica tu idea y cómo la vendés. Es opcional: activala en «IA y cámara». Sin IA, igual podés practicar con el temporizador.', text3D: 'La calificación necesita la IA (opcional).' }]
          : []),
        options.aiAnalysis
          ? { t: 'notice', kind: 'privacy', label: 'IA ACTIVADA · QUÉ SE ENVÍA', text: brief.free ? AI_DISCLOSURE.replace('junto con el brief', 'avisando que es un pitch libre') : AI_DISCLOSURE, text3D: AI_DISCLOSURE_3D }
          : voice
            ? { t: 'notice', kind: 'privacy', label: 'MICRÓFONO', text: MIC_DISCLOSURE, text3D: MIC_DISCLOSURE_3D }
            : { t: 'notice', kind: 'info', label: options.gestures ? 'TEMPORIZADOR Y CÁMARA' : 'SOLO TEMPORIZADOR', text: options.gestures ? 'No se usa el micrófono. La cámara mide tus manos en este dispositivo y no sale ningún video.' : 'No se usa el micrófono. Al terminar hacés una autoevaluación.' },
      ];
      panel.options = [
        act('mode-voice', !micAvailable ? 'Micrófono: no disponible' : 'Con micrófono', 'choice',
          { ...ev('SET_INPUT_MODE', { mode: 'voice' }), on: voice, disabled: !micAvailable }),
        act('mode-timer', 'Solo temporizador', 'choice', { ...ev('SET_INPUT_MODE', { mode: 'timer' }), on: !voice }),
        act('unlimited', 'Sin límite de tiempo', 'toggle', { ...ev('TOGGLE_UNLIMITED'), on: options.unlimited }),
        act('meter', 'Medir nivel de audio', 'toggle', { ...ev('TOGGLE_METER'), on: options.measureAudio, disabled: !voice || env.meter === false }),
        act('prep-less', `Menos preparación (${APP_CONFIG.prep.stepSec} s)`, 'secondary', { ui: 'prep-less', icon: 'minus' }),
        act('prep-more', `Más preparación (${APP_CONFIG.prep.stepSec} s)`, 'secondary', { ui: 'prep-more', icon: 'plus' }),
      ];
      lectern.status = 'PREPARACIÓN';
      lectern.hint = `${options.prepSec > 0 ? `Preparación: ${formatClock(options.prepSec)}. No empieza sola.` : 'Sin cuenta regresiva de preparación.'}${options.aiAnalysis || options.gestures ? ` IA: ${options.aiAnalysis ? 'sí' : 'no'} · cámara: ${options.gestures ? 'sí' : 'no'}.` : ''}`;
      lectern.actions = [
        act('begin', 'Comenzar presentación', 'primary', ev('BEGIN')),
        act('open-ai', 'IA y cámara', 'secondary', ev('OPEN_AI')),
        act('back', 'Volver al brief', 'secondary', ev('BACK')),
      ];
      break;
    }

    case S.STARTING: {
      const asks = [options.inputMode === 'voice' ? 'el micrófono' : '', options.gestures ? 'la cámara' : ''].filter(Boolean).join(' y ');
      panel.eyebrow = 'PERMISOS';
      panel.title = ['ESPERANDO', 'LOS PERMISOS'];
      panel.blocks = [
        { t: 'p', text: `Aceptá el permiso que muestra el navegador para usar ${asks || 'los dispositivos'}. El tiempo todavía no corre.` },
        { t: 'p', tone: 'muted', text: 'Si no ves ningún aviso, cancelá y practicá solo con temporizador.' },
      ];
      lectern.status = 'ESPERANDO PERMISO';
      lectern.hint = 'La presentación empieza cuando todo esté listo.';
      lectern.actions = [act('cancel-start', 'Cancelar', 'secondary', ev('CANCEL'))];
      break;
    }

    case S.AI_SETUP: {
      const caps = data.capabilities;
      panel.eyebrow = 'PREPARACIÓN · OPCIONAL';
      panel.title = ['IA Y CÁMARA'];
      panel.blocks = [
        { t: 'notice', kind: 'privacy', label: 'QUÉ SE ENVÍA', text: AI_DISCLOSURE, text3D: AI_DISCLOSURE_3D },
        { t: 'p', tone: 'muted', optional3D: true, text: caps.ai ? `Clave de Gemini cargada. Modelo principal: ${APP_CONFIG.ai.models[0]}.` : 'Falta la clave de Gemini (o este navegador no puede grabar audio). Cargala en el panel de texto: tecla T, sección «Análisis con IA».' },
      ];
      panel.options = [
        act('ai-toggle', 'Análisis de voz con IA', 'toggle', { ...ev('TOGGLE_AI'), on: options.aiAnalysis, disabled: !caps.ai && !options.aiAnalysis }),
        act('gestures-toggle', caps.camera ? 'Gestos con la cámara' : 'Cámara: no disponible', 'toggle', { ...ev('TOGGLE_GESTURES'), on: options.gestures, disabled: !caps.camera && !options.gestures }),
        act('ai-key', caps.ai ? 'Cambiar la clave (panel de texto)' : 'Cargar la clave (panel de texto)', 'secondary', { ui: 'open-ai-key' }),
        act('ai-test-key', 'Probar la clave', 'secondary', { ui: 'test-ai-key', disabled: !caps.ai }),
      ];
      lectern.status = 'IA Y CÁMARA';
      lectern.hint = 'Opcional: se activa solo si vos lo elegís.';
      lectern.actions = [act('close-ai', 'Listo', 'primary', ev('CLOSE'))];
      break;
    }

    case S.VOICE_PROBLEM: {
      const info = VOICE_PROBLEM_TEXT[data.voiceProblem?.code] || VOICE_PROBLEM_TEXT.unknown;
      panel.eyebrow = 'MICRÓFONO';
      panel.title = info.title;
      panel.blocks = [
        { t: 'p', text: info.text },
        { t: 'notice', kind: 'info', label: 'SIGUE SIENDO POSIBLE', text: 'Podés practicar con temporizador y hacer la autoevaluación al final.' },
      ];
      lectern.status = 'SIN VOZ';
      lectern.hint = 'Elegí cómo seguir. No se vuelve a pedir el permiso sola.';
      lectern.actions = [
        act('timer-only', 'Practicar sin micrófono', 'primary', ev('USE_TIMER_ONLY')),
        act('retry-voice', 'Intentar de nuevo', 'secondary', ev('RETRY_VOICE')),
        act('back', 'Volver', 'secondary', ev('BACK')),
      ];
      break;
    }

    case S.PRESENTING:
      panel.visible = false;
      panel.title = ['PRESENTANDO'];
      lectern.status = 'EN VIVO';
      lectern.hint = liveHint(session);
      lectern.actions = [
        act('finish', 'Finalizar', 'primary', { ...ev('FINISH'), hold: true, holdHint: HOLD_FINISH_HINT }),
        act('pause', 'Pausar', 'secondary', ev('PAUSE')),
        act('cancel', 'Cancelar', 'danger', ev('REQUEST_CANCEL')),
      ];
      break;

    case S.PAUSED:
      panel.eyebrow = 'PAUSA';
      panel.title = ['EN PAUSA'];
      panel.blocks = [
        { t: 'p', text: 'El tiempo y el reconocimiento están detenidos. Respirá y seguí cuando quieras.' },
        { t: 'kv', rows: [{ k: 'Tiempo usado', v: formatClock(session.getTimeView().elapsedSec) }] },
        // Reconocer en vez de recordar: en la pausa se puede volver a leer el brief (en la presentación el panel no tapa al público).
        { t: 'fields', small: true, optional3D: true, rows: [
          { k: brief.free ? 'Tu pitch' : 'Tu brief · marca ficticia', v: brief.brand },
          { k: brief.free ? 'Restricción' : 'Restricción creativa', v: brief.constraint },
        ] },
      ];
      lectern.status = 'EN PAUSA';
      lectern.hint = 'Nada corre mientras estás en pausa.';
      lectern.actions = [
        act('resume', 'Continuar', 'primary', ev('RESUME')),
        act('finish', 'Finalizar', 'secondary', { ...ev('FINISH'), hold: true, holdHint: HOLD_FINISH_HINT }),
        act('cancel', 'Cancelar', 'danger', ev('REQUEST_CANCEL')),
      ];
      break;

    case S.CONFIRM_CANCEL:
      panel.eyebrow = 'CONFIRMAR';
      panel.title = ['¿CANCELAR LA', 'SESIÓN?'];
      panel.blocks = [
        { t: 'p', text: 'Se descarta lo que dijiste y el tiempo registrado. No se guarda nada.' },
        { t: 'p', tone: 'muted', text: 'El tiempo está detenido mientras decidís.' },
      ];
      lectern.status = 'CONFIRMAR';
      lectern.hint = 'Seguir presentando es la opción segura.';
      lectern.actions = [
        act('keep', 'Seguir presentando', 'primary', ev('KEEP')),
        act('confirm-cancel', 'Sí, cancelar sesión', 'danger', ev('CONFIRM')),
      ];
      break;

    case S.REVIEW: {
      const t = session.getTranscript();
      panel.eyebrow = 'REVISIÓN';
      panel.title = ['REVISÁ LA TRANSCRIPCIÓN'];
      if (t.text) {
        panel.blocks = [
          { t: 'tag', source: t.source, text: SOURCE_LABELS[t.source] },
          { t: 'quote', text: t.text },
          { t: 'notice', kind: 'info', label: 'PUEDE TENER ERRORES', text: 'El reconocimiento se equivoca. En computadora podés corregir el texto en el panel de texto.', text3D: 'Puede tener errores. Se corrige en el panel de texto (computadora).' },
        ];
      } else {
        panel.blocks = [
          { t: 'notice', kind: 'warn', label: 'NO SE RECONOCIÓ VOZ', text: 'No hay transcripción. Podés reintentar, escribir el texto en el panel de texto o continuar sin transcripción.' },
        ];
      }
      panel.options = [
        act('edit-text', 'Editar en panel de texto', 'secondary', { ui: 'open-text-panel' }),
        act('load-demo', 'Cargar texto de DEMOSTRACIÓN', 'secondary', ev('LOAD_DEMO')),
      ];
      lectern.status = 'REVISIÓN';
      lectern.hint = t.source === SOURCES.DEMO ? 'Estás usando un texto de demostración.' : 'Confirmá el texto para ver la devolución.';
      lectern.actions = [
        act('continue', 'Ver devolución', 'primary', ev('CONTINUE')),
        act('retry', 'Reintentar', 'secondary', ev('RETRY')),
      ];
      break;
    }

    case S.FEEDBACK: {
      const fb = session.getFeedback();
      const page = data.feedbackPage;
      panel.eyebrow = `DEVOLUCIÓN · ${sc.name.toUpperCase()}`;
      panel.options = [
        act('tab-0', '1 · Qué se midió', 'tab', { ...ev('SET_PAGE', { page: 0 }), on: page === 0 }),
        act('tab-1', '2 · Autoevaluación', 'tab', { ...ev('SET_PAGE', { page: 1 }), on: page === 1 }),
        act('tab-2', '3 · Consejos', 'tab', { ...ev('SET_PAGE', { page: 2 }), on: page === 2 }),
        ...(fb.ai.status !== 'off' ? [
          act('tab-3', fb.free ? '4 · IA: tu idea' : '4 · IA: contenido', 'tab', { ...ev('SET_PAGE', { page: 3 }), on: page === 3 }),
          act('tab-4', fb.free ? '5 · IA: cómo la vendiste' : '5 · IA: entrega', 'tab', { ...ev('SET_PAGE', { page: 4 }), on: page === 4 }),
          ...(fb.free && fb.ai.status === 'done' ? [act('tab-5', '6 · IA: subir tus notas', 'tab', { ...ev('SET_PAGE', { page: 5 }), on: page === 5 })] : []),
        ] : []),
      ];
      if (page === 0) {
        panel.title = ['QUÉ SE MIDIÓ'];
        panel.blocks = [
          ...fb.banners.map((b) => ({ t: 'notice', kind: b.kind === 'demo' ? 'demo' : 'info', label: b.label, text: b.text, text3D: b.short })),
          { t: 'measures', htmlOnly: true, rows: fb.measurements.filter((r) => r.available || r.id !== 'audio').slice(0, 8) },
          // En 3D solo las cuatro medidas que alimentan el indicador, en tarjetas grandes; el resto está en el panel de texto.
          { t: 'measures', only3D: true, cards: true, rows: ['duration', 'timeUse', 'wpm', 'fillers'].map((id) => fb.measurements.find((r) => r.id === id)).filter(Boolean) },
          fb.indicator.available
            ? { t: 'indicator', value: fb.indicator.value, label: fb.indicator.label, note: 'Ritmo 40% · muletillas 30% · uso del tiempo 30%. Orientativo: no evalúa el contenido.', note3D: 'Orientativo. No evalúa el contenido.' }
            : { t: 'indicator', value: null, label: fb.indicator.label, note: fb.indicator.reasons[0] || 'Completá la autoevaluación.' },
        ];
      } else if (page === 1) {
        panel.title = ['TU', 'AUTOEVALUACIÓN'];
        panel.blocks = [
          { t: 'p', text: 'Respondé vos. La herramienta no evalúa el contenido de lo que dijiste.' },
          { t: 'p', tone: 'muted', text: `Respondidas: ${fb.rubricSummary.answered} de ${fb.rubricSummary.total}. Tocá cada pregunta para cambiar la respuesta.` },
        ];
        for (const q of RUBRIC_QUESTIONS) {
          const a = answerInfo(data.rubric[q.id]);
          panel.options.push(act(`rubric-${q.id}`, q.label, 'rubric', { ...ev('RUBRIC_CYCLE', { id: q.id }), on: !!data.rubric[q.id], icon: a.icon, value: a.label }));
        }
      } else if (page === 2) {
        panel.title = ['CONSEJOS'];
        const aiDone = fb.ai.status === 'done';
        panel.blocks = [
          { t: 'tips', items: fb.tips },
          ...(aiDone && fb.ai.analysis.improvements.length
            ? [{ t: 'bullets', heading: 'De la IA (puede equivocarse)', items: fb.ai.analysis.improvements.map((i) => i.advice), max3D: 1, optional3D: true }]
            : []),
          { t: 'bullets', heading: 'Requiere revisión humana', items: fb.humanReview, htmlOnly: true },
          { t: 'bullets', heading: 'Requiere revisión humana', items: [fb.free ? HUMAN_REVIEW_FREE_3D : HUMAN_REVIEW_3D], only3D: true },
          ...(fb.ai.status === 'off'
            ? [{ t: 'notice', kind: 'info', label: 'SIN IA', optional3D: true, text: fb.free ? 'La calificación de la idea y de cómo la vendiste necesita la IA, que es opcional: activala en la preparación, en «IA y cámara». Mientras tanto, pedí una opinión a otra persona.' : 'La evaluación con IA es opcional: activala en la preparación, en «IA y cámara». Mientras tanto, pedí una opinión a una persona del equipo.', text3D: 'La IA es opcional: se activa en la preparación, en «IA y cámara».' }]
            : []),
          { t: 'bullets', heading: 'Preguntas de práctica (predefinidas; no responden a lo que dijiste)', items: fb.questions, htmlOnly: true },
        ];
      } else if (!aiStatusPage(session, fb.ai, panel)) {
        const { analysis } = fb.ai;
        if (fb.ai.mode === 'free') {
          const f = fb.ai.free;
          const row = (label, display, available) => ({ label, display, available });
          const rowsOf = (list) => list.map((r) => row(r.label, r.display, r.rating != null));
          const g = fb.gestures;
          if (page === 3) {
            panel.title = ['IA: TU IDEA'];
            panel.blocks = [
              { t: 'notice', kind: 'info', label: 'CALIFICACIÓN ORIENTATIVA', text: AI_DISCLAIMER_FREE, text3D: AI_DISCLAIMER_FREE_3D },
              ...(f.topic ? [{ t: 'fields', small: true, only3D: true, optional3D: true, rows: [{ k: 'Vendiste', v: firstSentence(f.topic, 78) }] }] : []),
              { t: 'measures', only3D: true, rows: [row('Tu idea (promedio)', f.idea.display, f.idea.average != null), ...rowsOf(f.idea.rows)] },
              { t: 'aifull', ai: fb.ai, part: 'content', htmlOnly: true },
            ];
          } else if (page === 5) {
            panel.title = ['IA: SUBÍ TUS NOTAS'];
            // Los consejos de las notas más bajas primero; en 3D entran los cuatro primeros, y el panel de texto los trae todos.
            const tips = [...f.idea.rows, ...f.selling.rows].filter((r) => r.rating != null && r.tip).sort((x, y) => x.rating - y.rating);
            const line = (r, max) => `${r.label} (${r.display}): ${firstSentence(r.tip, max)}`;
            panel.blocks = [
              { t: 'notice', kind: 'info', label: 'CALIFICACIÓN ORIENTATIVA', text: AI_DISCLAIMER_FREE, text3D: 'Consejos orientativos de la IA.' },
              ...(f.fillers && f.fillers.count != null ? [{ t: 'fields', small: true, only3D: true, rows: [{ k: 'Muletillas', v: `${f.fillers.count} en total (cuenta de la IA)` }] }] : []),
              { t: 'bullets', heading: 'Para subir cada nota', items: tips.slice(0, 3).map((r) => line(r, 60)), only3D: true },
              { t: 'bullets', heading: 'Para subir cada nota', items: tips.map((r) => line(r, 240)), htmlOnly: true },
            ];
          } else {
            panel.title = ['IA: CÓMO LA VENDISTE'];
            panel.blocks = [
              { t: 'notice', kind: 'info', label: 'CALIFICACIÓN ORIENTATIVA', text: AI_DISCLAIMER_FREE, text3D: 'Orientativa. No evalúa emociones ni personalidad.' },
              { t: 'measures', only3D: true, rows: [row('Cómo la vendiste (promedio)', f.selling.display, f.selling.average != null), ...rowsOf(f.selling.rows.filter((r) => ['structure', 'persuasion', 'clarity'].includes(r.id)))] },
              { t: 'measures', only3D: true, optional3D: true, rows: rowsOf(f.selling.rows.filter((r) => ['pace', 'voice', 'pauses'].includes(r.id))) },
              { t: 'aifull', ai: fb.ai, part: 'selling', gestures: g, htmlOnly: true },
            ];
          }
        } else if (page === 3) {
          panel.title = ['IA: CONTENIDO'];
          panel.blocks = [
            { t: 'notice', kind: 'info', label: 'EVALUACIÓN ASISTIDA POR IA', text: AI_DISCLAIMER, text3D: AI_DISCLAIMER_3D },
            { t: 'measures', only3D: true, rows: [
              // Sin notas en 3D (en VR no hay panel de texto y la tipografía debe ser legible); el detalle completo está en el panel de texto.
              ...fb.ai.rubricRows.map((r) => ({ label: r.label, display: r.display, available: true })),
              { label: 'Respeta la restricción', display: fb.ai.restriction.display, available: true },
            ] },
            { t: 'aifull', ai: fb.ai, part: 'content', htmlOnly: true },
          ];
        } else {
          panel.title = ['IA: ENTREGA'];
          const g = fb.gestures;
          panel.blocks = [
            { t: 'notice', kind: 'info', label: 'PERCEPCIÓN DE LA IA, NO MEDICIÓN', text: 'Describe cómo se escucha la entrega. No evalúa emociones ni personalidad.', text3D: 'No evalúa emociones ni personalidad.' },
            { t: 'fields', small: true, only3D: true, rows: [
              { k: 'Ritmo', v: firstSentence(analysis.delivery.pace.observation, 78) },
              { k: 'Claridad', v: firstSentence(analysis.delivery.clarity.observation, 78) },
              { k: 'Entonación y volumen', v: firstSentence(analysis.delivery.energy.observation, 78) },
            ] },
            { t: 'fields', small: true, only3D: true, optional3D: true, rows: [
              { k: 'Pausas', v: firstSentence(analysis.delivery.pauses.observation, 78) },
              ...(g?.measured ? [{ k: 'Gestos (cámara, medido en tu dispositivo)', v: `Manos a la vista el ${Math.round(g.handsVisibleShare * 100)} % del tiempo; movimiento ${g.movementLabel}.` }] : []),
            ] },
            { t: 'aifull', ai: fb.ai, part: 'delivery', gestures: g, htmlOnly: true },
          ];
        }
      }
      lectern.status = 'DEVOLUCIÓN';
      lectern.hint = 'Podés reintentar o cambiar de escenario.';
      lectern.actions = [
        act('retry', 'Reintentar', 'primary', ev('RETRY')),
        act('change-scenario', 'Cambiar escenario', 'secondary', ev('CHANGE_SCENARIO')),
        ...(usesSpeech(data) ? [act('edit-transcript', 'Revisar transcripción', 'secondary', ev('EDIT_TRANSCRIPT'))] : []),
      ];
      break;
    }

    default:
      break;
  }

  model.announce = [panel.eyebrow, panel.title.join(' '), lectern.hint].filter(Boolean).join('. ');
  return model;
}

export { TUTORIAL };
