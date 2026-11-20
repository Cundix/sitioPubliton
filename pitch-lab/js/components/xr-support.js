// Soporte WebXR: estado del modo inmersivo, marcadores de las manos y aviso al resto de la app.
//
// IMPORTANTE: esta parte se pudo revisar en código y con un emulador de WebXR, pero NO se
// probó en un casco físico. Ver docs/pruebas.md.

import { app } from '../app-context.js';
import { detectImmersive } from '../voice/capabilities.js';

/**
 * Rayo de puntería de una mano o control, basado en el "target ray" de WebXR.
 *
 * Por qué no laser-controls: A-Frame corrige la dirección del rayo según el MODELO 3D del control
 * (se descarga de un CDN) y sin modelo el rayo queda mal orientado en cascos reales. El target ray
 * lo informa el propio sistema (controles Touch, Index, Vive, Pico y también manos con pellizco),
 * no necesita descargar nada y es la forma estándar de apuntar en WebXR.
 */
AFRAME.registerComponent('xr-ray', {
  schema: { hand: { default: 'right' } },

  init() {
    const T = AFRAME.THREE;
    this.session = null;
    this.geo = new T.SphereGeometry(0.012, 10, 8);
    this.mat = new T.MeshBasicMaterial({ color: '#FFC94A', toneMapped: false });
    this.marker = new T.Mesh(this.geo, this.mat);
    this.el.setObject3D('marker', this.marker);
    this.el.object3D.visible = false;

    const forThisHand = (event) => event.inputSource && event.inputSource.handedness === this.data.hand;
    this.onDown = (event) => { if (forThisHand(event)) this.el.emit('ray-down'); };
    this.onUp = (event) => { if (forThisHand(event)) this.el.emit('ray-up'); };
    this.onEnter = () => {
      this.session = this.el.sceneEl.renderer.xr.getSession();
      this.session?.addEventListener('selectstart', this.onDown);
      this.session?.addEventListener('selectend', this.onUp);
    };
    this.onExit = () => {
      this.session?.removeEventListener('selectstart', this.onDown);
      this.session?.removeEventListener('selectend', this.onUp);
      this.session = null;
      this.el.object3D.visible = false;
    };
    this.el.sceneEl.addEventListener('enter-vr', this.onEnter);
    this.el.sceneEl.addEventListener('exit-vr', this.onExit);
  },

  tick() {
    const scene = this.el.sceneEl;
    const frame = scene.frame;
    if (!this.session || !frame) return;
    const refSpace = scene.renderer.xr.getReferenceSpace();
    let pose = null;
    for (const source of this.session.inputSources) {
      if (source.handedness === this.data.hand && source.targetRaySpace) {
        pose = frame.getPose(source.targetRaySpace, refSpace);
        break;
      }
    }
    if (!pose) { this.el.object3D.visible = false; return; }
    const { position: p, orientation: q } = pose.transform;
    this.el.object3D.position.set(p.x, p.y, p.z);
    this.el.object3D.quaternion.set(q.x, q.y, q.z, q.w);
    this.el.object3D.visible = true;
  },

  remove() {
    this.onExit();
    this.el.sceneEl.removeEventListener('enter-vr', this.onEnter);
    this.el.sceneEl.removeEventListener('exit-vr', this.onExit);
    this.el.removeObject3D('marker');
    this.geo.dispose();
    this.mat.dispose();
  },
});

/**
 * Vibración corta de los controles: confirma al tacto que el rayo tocó algo, que se presionó o que una
 * acción no está disponible (UX for XR, cap. 4: el tacto es la señal sutil que acompaña a la vista y al sonido).
 * Nunca es la única señal: siempre hay resaltado visual y, en las acciones, un sonido.
 * Se puede apagar en Ajustes. Si el control no tiene motor de vibración (o son manos sin control) no hace nada.
 */
export const HAPTIC_PULSES = Object.freeze({
  hover: { intensity: 0.12, ms: 18 },
  press: { intensity: 0.5, ms: 40 },
  denied: { intensity: 0.7, ms: 90 },
  teleport: { intensity: 0.35, ms: 50 },
  confirm: { intensity: 0.8, ms: 120 },
});

export class Haptics {
  constructor({ getSession, settings, now = () => performance.now() }) {
    this.getSession = getSession;
    this.settings = settings;
    this.now = now;
    this.sent = 0;       // cuántas vibraciones se pidieron (sirve para las pruebas)
    this.lastAt = new Map();
  }

  /** Mano ('left' / 'right') del control que apuntó, a partir del evento del cursor de A-Frame. */
  static handFromEvent(event) {
    const cursor = event?.detail?.cursorEl;
    const hand = cursor?.components?.['xr-ray']?.data?.hand;
    return hand === 'left' || hand === 'right' ? hand : null;
  }

  fromEvent(event, kind) {
    const hand = Haptics.handFromEvent(event);
    return hand ? this.pulse(hand, kind) : false;
  }

  pulse(hand, kind) {
    const spec = HAPTIC_PULSES[kind];
    if (!spec || !this.settings.get('haptics')) return false;
    const session = this.getSession();
    if (!session) return false;
    // El rayo recorre varios botones al moverse: se limita la frecuencia para que no sea un zumbido continuo.
    const key = `${hand}:${kind}`;
    const t = this.now();
    if (kind === 'hover' && t - (this.lastAt.get(key) ?? -1e9) < 60) return false;
    this.lastAt.set(key, t);
    for (const source of session.inputSources || []) {
      if (source.handedness !== hand) continue;
      const pad = source.gamepad;
      try {
        const actuator = pad?.hapticActuators?.[0];
        if (actuator?.pulse) {
          Promise.resolve(actuator.pulse(spec.intensity, spec.ms)).catch(() => {});
        } else if (pad?.vibrationActuator?.playEffect) {
          Promise.resolve(pad.vibrationActuator.playEffect('dual-rumble', {
            startDelay: 0, duration: spec.ms, weakMagnitude: spec.intensity, strongMagnitude: spec.intensity,
          })).catch(() => {});
        } else {
          return false;
        }
        this.sent += 1;
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

/** Consulta si hay modo inmersivo y mantiene app.xr al día. */
export async function setupXR(scene) {
  const result = await detectImmersive(window);
  app.xr.supported = result.supported;
  app.xr.reason = result.reason;
  app.haptics = new Haptics({
    getSession: () => scene.renderer?.xr?.getSession?.() ?? null,
    settings: app.settings,
  });

  const sync = () => {
    app.xr.active = scene.is('vr-mode');
    app.hub?.setEnv({ vr: app.xr.active });
    document.body.classList.toggle('in-vr', app.xr.active);
    app.overlay?.setXR({ ...app.xr });
  };
  scene.addEventListener('enter-vr', sync);
  scene.addEventListener('exit-vr', sync);
  sync();
  return result;
}

/** Entra en VR. Si falla, devuelve un mensaje claro en lugar de dejar la promesa sin manejar. */
export async function enterVR(scene) {
  try {
    await scene.enterVR();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: 'No se pudo iniciar el modo inmersivo. Revisá que el casco esté conectado y que el navegador tenga permiso.' };
  }
}

export async function exitVR(scene) {
  try {
    await scene.exitVR();
  } catch {
    /* ya había salido */
  }
}
