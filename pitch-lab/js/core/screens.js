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

import { S, TUTORIAL_STEPS } from './state-machine.js';
import { SCENARIOS } from '../config/scenarios.js';
import { APP_CONFIG } from '../config/app-config.js';
import { RUBRIC_QUESTIONS, answerInfo } from './rubric.js';
import { formatClock } from './feedback.js';
import { SOURCES, SOURCE_LABELS } from './metrics.js';
import { WARNING_LABELS } from './time-warnings.js';

const act = (id, label, kind, extra = {}) => ({ id, label, kind, ...extra });
const ev = (event, payload) => ({ event, payload });

const TUTORIAL = [
  {
    eyebrow: 'TUTORIAL 1 DE 3',
    title: ['CÓMO', 'MOVERTE'],
    bullets: [
      'Mouse: arrastrá para mirar alrededor.',
      'W A S D o flechas: caminar. Q y E: girar.',
      'Con casco VR: usá las marcas del piso para teletransportarte. No hay desplazamiento continuo.',
    ],
  },
  {
    eyebrow: 'TUTORIAL 2 DE 3',
    title: ['CÓMO USAR', 'LOS BOTONES'],
    bullets: [
      'Apuntá con el mouse o con el láser del control.',
      'Clic o gatillo para presionar. Los botones grandes del atril son los principales.',
      'Teclado: Enter acción principal · P pausa · Esc cancelar · R recentrar.',
    ],
  },
  {
    eyebrow: 'TUTORIAL 3 DE 3',
    title: ['CÓMO SE', 'PRESENTA'],
    bullets: [
      'Elegís un espacio y recibís un brief ficticio.',
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

const MIC_DISCLOSURE =
  'Al comenzar, el navegador te pedirá permiso para usar el micrófono. En algunos navegadores (por ejemplo Chrome) el audio se envía a un servicio externo del navegador para reconocerlo. Esta experiencia no graba ni guarda audio ni texto.';

/** Texto corto del estado del reconocimiento durante la presentación. */
function liveHint(session) {
  const { options } = session.data;
  if (options.inputMode !== 'voice') return 'Práctica con temporizador. No se usa el micrófono.';
  if (session.capture.voiceLost) return 'Se perdió el reconocimiento. Seguís con el temporizador.';
  const interim = session.capture.interim;
  if (interim) return `Escuchando · «…${interim.slice(-48)}»`;
  return 'Micrófono activo · reconociendo en español.';
}

function clockModel(session) {
  const view = session.getTimeView();
  const { state } = session;
  const sc = session.scenario;

  if (state === S.PREP) {
    if (!(view.prepSec > 0)) return { mode: 'prep', label: 'PREPARACIÓN', time: '--:--', sub: 'Sin cuenta regresiva', warning: 'none', progress: 0 };
    return {
      mode: 'prep',
      label: view.prepDone ? 'PREPARACIÓN LISTA' : 'PREPARACIÓN',
      time: formatClock(view.prepRemainingSec ?? view.prepSec),
      sub: view.prepDone ? 'Empezá cuando quieras' : 'Tiempo para pensar',
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
        { t: 'p', text: 'Elegí un espacio, recibí un brief ficticio y presentá tu propuesta frente a una audiencia virtual.' },
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
      panel.eyebrow = 'AJUSTES';
      panel.title = ['A TU', 'MEDIDA'];
      panel.blocks = [
        { t: 'meter', label: 'Volumen de los avisos', value: settings.get('volume'), text: `${Math.round(settings.get('volume') * 100)}%` },
        { t: 'p', tone: 'muted', text: 'Los avisos de tiempo siempre tienen señal visual además del sonido.' },
      ];
      panel.options = [
        act('vol-down', 'Bajar volumen', 'secondary', { ui: 'volume-down', icon: 'minus' }),
        act('vol-up', 'Subir volumen', 'secondary', { ui: 'volume-up', icon: 'plus' }),
        act('motion', 'Movimiento reducido', 'toggle', { ui: 'toggle-motion', on: settings.get('reducedMotion') }),
        act('seated', 'Modo sentado (VR)', 'toggle', { ui: 'toggle-seated', on: settings.get('seated') }),
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
      panel.eyebrow = `${sc.name.toUpperCase()} · BRIEF`;
      panel.title = [brief.brand.toUpperCase()];
      panel.blocks = [
        { t: 'notice', kind: 'info', label: 'MARCA FICTICIA', text: brief.brandNote.replace(/^Marca ficticia · /i, '').replace(/^./, (c) => c.toUpperCase()) },
        { t: 'fields', rows: [
          { k: 'Problema', v: brief.problem },
          { k: 'Público', v: brief.audience },
          { k: 'Objetivo', v: brief.objective },
          { k: 'Restricción creativa', v: brief.constraint },
        ] },
      ];
      lectern.status = 'BRIEF';
      lectern.hint = brief.guide;
      lectern.actions = [
        act('prepare', 'Preparar presentación', 'primary', ev('PREPARE')),
        act('other-brief', 'Otro brief', 'secondary', ev('NEXT_BRIEF')),
        act('change-scenario', 'Cambiar escenario', 'secondary', ev('CHANGE_SCENARIO')),
        act('settings', 'Ajustes', 'secondary', ev('OPEN_SETTINGS')),
      ];
      break;

    case S.PREP: {
      const voice = options.inputMode === 'voice';
      panel.eyebrow = `PREPARACIÓN · ${sc.name.toUpperCase()}`;
      panel.title = ['PREPARÁ', 'TU PITCH'];
      panel.blocks = [
        { t: 'p', text: `Tu presentación dura ${options.unlimited ? 'lo que necesites' : formatClock(sc.durationSec)}. Pensá en este orden:` },
        { t: 'bullets', items: ['1. El problema', '2. Tu idea', '3. El beneficio', '4. Un cierre con propuesta clara'] },
        voice
          ? { t: 'notice', kind: 'privacy', label: 'MICRÓFONO', text: MIC_DISCLOSURE }
          : { t: 'notice', kind: 'info', label: 'SOLO TEMPORIZADOR', text: 'No se usa el micrófono. Al terminar hacés una autoevaluación.' },
      ];
      panel.options = [
        act('mode-voice', env.speech === false ? 'Micrófono: no disponible' : 'Con micrófono', 'choice',
          { ...ev('SET_INPUT_MODE', { mode: 'voice' }), on: voice, disabled: env.speech === false }),
        act('mode-timer', 'Solo temporizador', 'choice', { ...ev('SET_INPUT_MODE', { mode: 'timer' }), on: !voice }),
        act('unlimited', 'Sin límite de tiempo', 'toggle', { ...ev('TOGGLE_UNLIMITED'), on: options.unlimited }),
        act('meter', 'Medir nivel de audio', 'toggle', { ...ev('TOGGLE_METER'), on: options.measureAudio, disabled: !voice || env.meter === false }),
        act('prep-less', `Menos preparación (${APP_CONFIG.prep.stepSec} s)`, 'secondary', { ui: 'prep-less', icon: 'minus' }),
        act('prep-more', `Más preparación (${APP_CONFIG.prep.stepSec} s)`, 'secondary', { ui: 'prep-more', icon: 'plus' }),
      ];
      lectern.status = 'PREPARACIÓN';
      lectern.hint = options.prepSec > 0 ? `Preparación: ${formatClock(options.prepSec)}. No empieza sola.` : 'Sin cuenta regresiva de preparación.';
      lectern.actions = [
        act('begin', 'Comenzar presentación', 'primary', ev('BEGIN')),
        act('back', 'Volver al brief', 'secondary', ev('BACK')),
      ];
      break;
    }

    case S.STARTING:
      panel.eyebrow = 'MICRÓFONO';
      panel.title = ['ESPERANDO', 'AL MICRÓFONO'];
      panel.blocks = [
        { t: 'p', text: 'Aceptá el permiso que muestra el navegador. El tiempo todavía no corre.' },
        { t: 'p', tone: 'muted', text: 'Si no ves ningún aviso, cancelá y practicá solo con temporizador.' },
      ];
      lectern.status = 'ESPERANDO PERMISO';
      lectern.hint = 'La presentación empieza cuando el micrófono esté listo.';
      lectern.actions = [act('cancel-start', 'Cancelar', 'secondary', ev('CANCEL'))];
      break;

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
        act('finish', 'Finalizar', 'primary', ev('FINISH')),
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
      ];
      lectern.status = 'EN PAUSA';
      lectern.hint = 'Nada corre mientras estás en pausa.';
      lectern.actions = [
        act('resume', 'Continuar', 'primary', ev('RESUME')),
        act('finish', 'Finalizar', 'secondary', ev('FINISH')),
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
      panel.title = ['REVISÁ LA', 'TRANSCRIPCIÓN'];
      if (t.text) {
        panel.blocks = [
          { t: 'tag', source: t.source, text: SOURCE_LABELS[t.source] },
          { t: 'quote', text: t.text },
          { t: 'notice', kind: 'info', label: 'PUEDE TENER ERRORES', text: 'El reconocimiento se equivoca. En computadora podés corregir el texto en el panel de texto.' },
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
      ];
      if (page === 0) {
        panel.title = ['QUÉ SE MIDIÓ'];
        panel.blocks = [
          ...fb.banners.map((b) => ({ t: 'notice', kind: b.kind === 'demo' ? 'demo' : 'info', label: b.label, text: b.text })),
          { t: 'measures', rows: fb.measurements.filter((r) => r.available || r.id !== 'audio').slice(0, 6) },
          fb.indicator.available
            ? { t: 'indicator', value: fb.indicator.value, label: fb.indicator.label, note: 'Ritmo 40% · muletillas 30% · uso del tiempo 30%. Orientativo: no evalúa el contenido.' }
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
      } else {
        panel.title = ['CONSEJOS Y', 'REVISIÓN HUMANA'];
        panel.blocks = [
          { t: 'tips', items: fb.tips },
          { t: 'bullets', heading: 'Requiere revisión humana', items: fb.humanReview.slice(0, 3) },
          { t: 'notice', kind: 'info', label: 'SIN IA', text: 'La evaluación semántica con IA no está disponible en esta versión. Pedí una opinión a una persona del equipo.' },
        ];
      }
      lectern.status = 'DEVOLUCIÓN';
      lectern.hint = 'Podés reintentar o cambiar de escenario.';
      lectern.actions = [
        act('retry', 'Reintentar', 'primary', ev('RETRY')),
        act('change-scenario', 'Cambiar escenario', 'secondary', ev('CHANGE_SCENARIO')),
        ...(options.inputMode === 'voice' ? [act('edit-transcript', 'Revisar transcripción', 'secondary', ev('EDIT_TRANSCRIPT'))] : []),
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
