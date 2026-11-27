// Publitón Pitch Lab — arranque de la aplicación.
//
// Orden:
//   1. Detectar capacidades del navegador.
//   2. Crear sesión, voz, preferencias y modelo de pantalla (todo sin 3D).
//   3. Registrar los componentes de A-Frame y crear la escena.
//   4. Conectar teclado, panel de texto accesible y modo VR.

import { app } from './app-context.js';
import { Settings } from './core/settings.js';
import { Session } from './core/session.js';
import { S, allowedEvents } from './core/state-machine.js';
import { APP_CONFIG } from './config/app-config.js';
import { IA_PUBLICA } from './config/ia-publica.js';
import { BRIEFS } from './config/briefs.js';
import { UIHub } from './ui/ui-hub.js';
import { HtmlOverlay } from './ui/html-overlay.js';
import { AudioCues } from './ui/audio-cues.js';
import { detectCapabilities } from './voice/capabilities.js';
import { SpeechController } from './voice/speech-recognizer.js';
import { AudioMeter } from './voice/audio-meter.js';
import { AiKeyStore } from './ai/key-store.js';
import { AnalysisService } from './ai/analysis-service.js';
import { AiSettingsUI } from './ui/ai-settings.js';
import { isTypingTarget } from './components/walk-rig.js';
import { loadPersonas, whenPersonasReady, setPersonasRandom } from './scenes/personas.js';
import './components/stage-controller.js';
import './components/xr-support.js';
import { setupXR, enterVR, exitVR } from './components/xr-support.js';

const SCENE_HTML = `
<a-scene id="scene"
  renderer="antialias: true; powerPreference: high-performance"
  webxr="optionalFeatures: bounded-floor"
  xr-mode-ui="enabled: false"
  device-orientation-permission-ui="enabled: false"
  loading-screen="enabled: false"
  background="color: #0E120B"
  keyboard-shortcuts="enterVR: false">
  <a-entity id="rig" walk-rig position="0 0 0">
    <a-entity id="head" camera="fov: 78; near: 0.05; far: 120" look-controls="pointerLockEnabled: false; magicWindowTrackingEnabled: false" position="0 1.6 0"></a-entity>
    <a-entity id="hand-left" xr-ray="hand: left" cursor="fuse: false; downEvents: ray-down; upEvents: ray-up" raycaster="objects: .ui; far: 45; lineColor: #FFC94A; lineOpacity: 0.9; showLine: true"></a-entity>
    <a-entity id="hand-right" xr-ray="hand: right" cursor="fuse: false; downEvents: ray-down; upEvents: ray-up" raycaster="objects: .ui; far: 45; lineColor: #FFC94A; lineOpacity: 0.9; showLine: true"></a-entity>
  </a-entity>
  <a-entity id="mouse-cursor" cursor="rayOrigin: mouse" raycaster="objects: .ui; far: 80; interval: 40; showLine: false"></a-entity>
  <a-entity id="world" stage-controller></a-entity>
</a-scene>`;

const safeStorage = () => {
  try { return window.localStorage; } catch { return null; }
};
const safeSessionStorage = () => {
  try { return window.sessionStorage; } catch { return null; }
};

function waitForFonts() {
  const loads = ['400 48px Anton', '400 24px Barlow', '700 24px Barlow'].map((f) => document.fonts.load(f).catch(() => []));
  return Promise.race([Promise.all(loads), new Promise((resolve) => setTimeout(resolve, 2500))]);
}

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

async function main() {
  const caps = detectCapabilities(window);
  const settings = new Settings({
    storage: safeStorage(),
    prefersReducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  });

  const voice = caps.speech ? new SpeechController() : null;
  const meterCandidate = new AudioMeter();
  const meter = meterCandidate.available ? meterCandidate : null;
  // Análisis con IA (opcional): la clave es de cada persona y solo vive en su navegador.
  const keyStore = new AiKeyStore({ session: safeSessionStorage(), local: safeStorage() });
  // Si el sitio se sirve con `npm run start:ia`, la clave está en el servidor (.env) y la IA queda siempre activa, sin pedir nada.
  let aiConfig = APP_CONFIG.ai;
  try {
    if (!['localhost', '127.0.0.1'].includes(location.hostname)) throw new Error('solo en local');
    const probe = await fetch('./ia-proxy/estado', { cache: 'no-store' });
    if (probe.ok && (await probe.json()).ok) {
      aiConfig = { ...APP_CONFIG.ai, endpoint: new URL('./ia-proxy/v1beta', document.baseURI).href };
      keyStore.useServerKey();
    }
  } catch { /* sin proxy: la IA usa la clave de la persona */ }
  // Sitio publicado: la IA viene lista con la clave incluida (ver config/ia-publica.js). En localhost no, para no gastarla en las pruebas.
  if (!keyStore.hasKey && IA_PUBLICA && !['localhost', '127.0.0.1'].includes(location.hostname)) keyStore.useEmbeddedKey(IA_PUBLICA);
  const ai = new AnalysisService({ keyStore, config: aiConfig, getVideoEl: () => document.getElementById('cam-preview') });
  // Cada visita empieza con un brief distinto (con «Otro brief» se recorren todos).
  const briefStart = Math.floor(Math.random() * BRIEFS.length);
  const session = new Session({ voice, meter, ai, capabilities: { speech: caps.speech, ai: false, camera: false }, tutorialSeen: settings.get('tutorialSeen'), briefStart });
  voice?.setHandlers({
    final: (text) => session.pushFinal(text),
    interim: (text) => session.pushInterim(text),
    lost: (info) => session.notifyVoiceLost(info?.message),
  });

  const hub = new UIHub({ session, settings, env: { speech: caps.speech, meter: !!meter, vr: false } });
  const cues = new AudioCues(settings);
  Object.assign(app, { session, settings, hub, caps, cues, ai, keyStore });
  app.personas = { ready: whenPersonasReady, setRandom: setPersonasRandom };

  // ----- Acciones (las usan los botones 3D, el panel de texto y el teclado) -----
  const runUi = (name) => {
    switch (name) {
      case 'volume-down': settings.set('volume', settings.get('volume') - 0.1); cues.play('click'); break;
      case 'volume-up': settings.set('volume', settings.get('volume') + 0.1); cues.play('click'); break;
      case 'toggle-motion': settings.set('reducedMotion', !settings.get('reducedMotion')); break;
      case 'toggle-seated': settings.set('seated', !settings.get('seated')); break;
      case 'cycle-snap': settings.cycleSnapTurn(); cues.play('click'); break;
      case 'toggle-haptics': settings.set('haptics', !settings.get('haptics')); cues.play('click'); break;
      case 'height-down': settings.adjustHeight(-1); cues.play('click'); break;
      case 'height-up': settings.adjustHeight(1); cues.play('click'); break;
      case 'prep-less':
      case 'prep-more': {
        const step = APP_CONFIG.prep.stepSec * (name === 'prep-more' ? 1 : -1);
        if (session.dispatch('ADJUST_PREP', { delta: step })) session.restartPrepCountdown();
        break;
      }
      case 'recenter': app.walk?.recenter(); break;
      case 'teleport-view': app.walk?.teleportTo('publico'); break;
      case 'exit-vr': exitVR(app.scene); break;
      case 'toggle-drawer': app.overlay.toggleDrawer(); break;
      case 'open-text-panel': app.overlay.openDrawer({ focus: true }); break;
      case 'open-ai-key':
        if (app.overlay.xr.active) app.overlay.toast('Dentro del casco no se puede escribir la clave. Salí de VR, cargala en el panel de texto y volvé a entrar.', 'warn');
        else app.aiSettings.open();
        break;
      case 'test-ai-key': app.aiSettings.testKey(); break;
      default: break;
    }
  };

  app.pressAction = (action) => {
    cues.unlock();
    if (action.disabled) { cues.play('denied'); return; }
    if (action.event) {
      const ok = session.dispatch(action.event, action.payload);
      if (ok) cues.play('click');
      else cues.play('denied');
    } else if (action.ui) {
      runUi(action.ui);
    }
  };

  // ----- Sonidos de estado y persistencia mínima -----
  session.on('state', ({ state, prev }) => {
    if (state === S.PRESENTING && prev !== S.PAUSED && prev !== S.CONFIRM_CANCEL) cues.play('start');
    if ((state === S.REVIEW || state === S.FEEDBACK) && (prev === S.PRESENTING || prev === S.PAUSED)) cues.play('end');
    if (session.data.tutorialSeen && !settings.get('tutorialSeen')) settings.set('tutorialSeen', true);
  });
  session.on('warning', ({ level }) => cues.play(level));

  // ----- Pestaña en segundo plano: pausa automática durante la presentación -----
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) session.dispatch('VISIBILITY_HIDDEN');
  });

  // ----- Teclado -----
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
    const onButton = e.target?.tagName === 'BUTTON' || e.target?.tagName === 'A' || e.target?.tagName === 'SUMMARY' || e.target?.tagName === 'DETAILS';
    const key = e.key.toLowerCase();
    const allowed = allowedEvents(session.state);

    if (key === 'enter' && !onButton) {
      const primary = hub.model.lectern.actions.find((a) => a.kind === 'primary');
      if (primary) { e.preventDefault(); app.pressAction(primary); }
    } else if (key === 'p') {
      if (allowed.includes('PAUSE')) session.dispatch('PAUSE');
      else if (allowed.includes('RESUME')) session.dispatch('RESUME');
    } else if (key === 'f' && allowed.includes('FINISH')) {
      session.dispatch('FINISH');
    } else if (key === 'escape') {
      if (allowed.includes('REQUEST_CANCEL')) session.dispatch('REQUEST_CANCEL');
      else if (allowed.includes('KEEP')) session.dispatch('KEEP');
      else if (allowed.includes('CANCEL')) session.dispatch('CANCEL');
    } else if (key === 'r') {
      app.walk?.recenter();
    } else if (key === 't') {
      app.overlay.toggleDrawer();
    }
  });

  // ----- Panel de texto -----
  const overlay = new HtmlOverlay({
    session, settings, hub, caps,
    onPress: app.pressAction,
    onEnterVR: async () => {
      cues.unlock();
      const result = await enterVR(app.scene);
      if (!result.ok) overlay.toast(result.message, 'warn');
    },
    onExitVR: () => exitVR(app.scene),
  });
  app.overlay = overlay;
  app.aiSettings = new AiSettingsUI({ keyStore, service: ai, session, overlay, onNotice: (text, kind) => overlay.toast(text, kind) });
  if (keyStore.serverKey && session.data.capabilities.ai) {
    session.data.options.aiAnalysis = true;
    session.data.options.inputMode = 'voice';
    session.emit('change');
  }

  // ----- Escena -----
  const hasGL = webglAvailable();
  if (!hasGL) {
    overlay.hideLoading();
    overlay.showFallback('No se pudo iniciar el entorno 3D en este navegador. Podés completar la práctica con este panel de texto.');
    session.start();
    window.pitchLab = app;
    return;
  }

  // Los docentes en 3D del público (modelos 3D) se cargan al abrir la página, sin bloquear nada: si todavía no están
  // listas cuando se arma un espacio, ese público queda con figuras genéricas.
  loadPersonas();
  await waitForFonts();
  document.getElementById('stage').innerHTML = SCENE_HTML;
  const scene = document.getElementById('scene');
  app.scene = scene;

  const failTimer = setTimeout(() => {
    overlay.hideLoading();
    overlay.showFallback('El entorno 3D tardó demasiado en iniciar. Podés continuar con este panel de texto.');
  }, 15000);
  scene.addEventListener('loaded', () => {
    clearTimeout(failTimer);
    overlay.hideLoading();
    session.start();
  }, { once: true });

  const xr = await setupXR(scene);
  overlay.setXR({ ...app.xr });

  window.addEventListener('pagehide', () => {
    session.dispose();
    ai.dispose();
    cues.dispose();
    hub.dispose();
  });

  window.pitchLab = app; // útil para depurar y para las pruebas automáticas
  void xr;
}

main().catch((error) => {
  console.error('[pitch-lab] error al iniciar:', error);
  document.getElementById('loading')?.setAttribute('hidden', '');
  const box = document.getElementById('fallback');
  if (box) {
    box.hidden = false;
    document.getElementById('fallback-text').textContent = 'Ocurrió un error al iniciar la experiencia. Probá recargar la página.';
  }
});
