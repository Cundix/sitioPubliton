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

/** Consulta si hay modo inmersivo y mantiene app.xr al día. */
export async function setupXR(scene) {
  const result = await detectImmersive(window);
  app.xr.supported = result.supported;
  app.xr.reason = result.reason;

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
