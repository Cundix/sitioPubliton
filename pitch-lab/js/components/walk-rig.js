// walk-rig: la "plataforma" que lleva la cámara. Se ocupa de:
//   - caminar con teclado (W A S D / flechas) y girar (Q / E) en computadora,
//   - respetar los límites del escenario (zonas caminables y obstáculos),
//   - teletransportar a puntos fijos (la forma de moverse en VR; sin deslizamientos),
//   - recentrar la vista,
//   - elevar la vista en modo sentado.
// No hay movimiento automático de cámara: todo cambio de posición lo inicia la persona.

import { app } from '../app-context.js';
import { APP_CONFIG } from '../config/app-config.js';
import { constrainMove, isWalkable } from '../core/layouts.js';
import { DEG } from '../scenes/scene-kit.js';

const MOVE_KEYS = {
  w: 'forward', arrowup: 'forward',
  s: 'back', arrowdown: 'back',
  a: 'left', arrowleft: 'left',
  d: 'right', arrowright: 'right',
  q: 'turnLeft', e: 'turnRight',
};

export function isTypingTarget(target) {
  if (!target || !target.tagName) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

AFRAME.registerComponent('walk-rig', {
  init() {
    this.THREE = AFRAME.THREE;
    this.down = new Set();
    this.env = null;
    this.zone = null;
    this.pendingEnv = app.pendingEnv || null;
    this.v = new this.THREE.Vector3();
    this.p = new this.THREE.Vector3();
    this.fade = null;
    app.walk = this;

    this.onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      const action = MOVE_KEYS[e.key.toLowerCase()];
      if (!action) return;
      this.down.add(action);
      if (e.key.startsWith('Arrow')) e.preventDefault();
    };
    this.onKeyUp = (e) => {
      const action = MOVE_KEYS[e.key.toLowerCase()];
      if (action) this.down.delete(action);
    };
    this.onBlur = () => this.down.clear();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);

    this._off = app.settings.on('change', ({ key }) => { if (key === 'seated') this.applyHeight(); });
    this.el.sceneEl.addEventListener('enter-vr', () => this.applyHeight());
    this.el.sceneEl.addEventListener('exit-vr', () => this.applyHeight());
  },

  remove() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this._off?.();
    this.fade?.dispose();
    if (app.walk === this) app.walk = null;
  },

  // Nota: A-Frame evalúa las propiedades del componente al registrarlo, por eso no se usan getters.
  getCamera() { return this.el.querySelector('[camera]')?.getObject3D('camera') || null; },
  isVR() { return this.el.sceneEl.is('vr-mode'); },

  /** Recibe zonas, obstáculos y punto de inicio del entorno vigente. */
  setEnvironment(env) {
    this.env = env;
    this.pendingEnv = env;
    this.tryApplyEnvironment();
  },

  tryApplyEnvironment() {
    if (!this.pendingEnv || !this.getCamera()) return;
    const env = this.pendingEnv;
    this.env = env;
    this.pendingEnv = null;
    this.zone = env.zones.find((z) => z.id === 'atril') || env.zones[0];
    this.alignTo(env.spawn.x, env.spawn.z, env.spawn.yawDeg * DEG);
    this.applyHeight();
  },

  /** Lleva la cámara a (x, z) mirando hacia `yaw` (radianes), sin importar hacia dónde mirara antes. */
  alignTo(x, z, yaw) {
    const cam = this.getCamera();
    const rig = this.el.object3D;
    if (!cam) return;
    rig.updateMatrixWorld(true);
    cam.getWorldDirection(this.v);
    const camYaw = Math.atan2(-this.v.x, -this.v.z);
    rig.rotation.y += yaw - camYaw;
    rig.updateMatrixWorld(true);
    cam.getWorldPosition(this.p);
    rig.position.x += x - this.p.x;
    rig.position.z += z - this.p.z;
  },

  applyHeight() {
    const rig = this.el.object3D;
    const y = this.zone?.y ?? 0;
    const seatedBoost = app.settings.get('seated') && this.isVR() ? APP_CONFIG.movement.seatedOffsetM : 0;
    rig.position.y = y + seatedBoost;
  },

  /** Teletransporte instantáneo a un punto fijo (sin deslizamiento: no marea). */
  teleportTo(padOrId) {
    if (!this.env) return false;
    const pad = typeof padOrId === 'string' ? this.env.pads.find((p) => p.id === padOrId) : padOrId;
    const target = pad || { id: 'atril', x: this.env.spawn.x, z: this.env.spawn.z, yawDeg: this.env.spawn.yawDeg, zone: 'atril' };
    const zone = this.env.zones.find((z) => z.id === (target.zone || 'atril'));
    if (!zone || !isWalkable(target.x, target.z, zone, this.env.obstacles)) return false;
    this.blink();
    this.zone = zone;
    this.alignTo(target.x, target.z, (target.yawDeg || 0) * DEG);
    this.applyHeight();
    return true;
  },

  /** Recentrar: vuelve al atril y mira hacia el público. */
  recenter() {
    if (!this.env) return;
    this.teleportTo('atril');
  },

  /** Apagón breve de la vista al cambiar de lugar (más cómodo en VR). Se omite con movimiento reducido. */
  blink() {
    if (app.settings.get('reducedMotion')) return;
    const cam = this.getCamera();
    if (!cam) return;
    if (!this.fade) {
      const T = this.THREE;
      const geo = new T.SphereGeometry(0.4, 12, 8);
      const mat = new T.MeshBasicMaterial({ color: 0x000000, side: T.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
      const mesh = new T.Mesh(geo, mat);
      mesh.renderOrder = 1000;
      mesh.frustumCulled = false;
      cam.add(mesh);
      this.fade = { mesh, geo, mat, t: 0, dispose() { mesh.removeFromParent(); geo.dispose(); mat.dispose(); } };
    }
    this.fade.mat.opacity = 1;
    this.fade.t = 0;
  },

  tick(time, deltaMs) {
    if (this.pendingEnv) this.tryApplyEnvironment();

    const dt = Math.min(deltaMs, 100) / 1000;
    if (this.fade && this.fade.mat.opacity > 0) {
      this.fade.t += dt;
      this.fade.mat.opacity = Math.max(0, 1 - this.fade.t / 0.28);
    }

    if (this.isVR() || !this.zone || this.down.size === 0) return;
    const cam = this.getCamera();
    if (!cam) return;
    const rig = this.el.object3D;
    const { walkSpeed, turnSpeedDeg } = APP_CONFIG.movement;

    if (this.down.has('turnLeft')) rig.rotation.y += turnSpeedDeg * DEG * dt;
    if (this.down.has('turnRight')) rig.rotation.y -= turnSpeedDeg * DEG * dt;

    const fwd = (this.down.has('forward') ? 1 : 0) - (this.down.has('back') ? 1 : 0);
    const str = (this.down.has('right') ? 1 : 0) - (this.down.has('left') ? 1 : 0);
    if (!fwd && !str) return;

    cam.getWorldDirection(this.v);
    let fx = this.v.x, fz = this.v.z;
    const len = Math.hypot(fx, fz) || 1;
    fx /= len; fz /= len;
    const rx = -fz, rz = fx;
    let mx = fx * fwd + rx * str;
    let mz = fz * fwd + rz * str;
    const m = Math.hypot(mx, mz) || 1;
    mx = (mx / m) * walkSpeed * dt;
    mz = (mz / m) * walkSpeed * dt;

    cam.getWorldPosition(this.p);
    const next = constrainMove({ x: this.p.x, z: this.p.z }, { x: this.p.x + mx, z: this.p.z + mz }, this.zone, this.env.obstacles);
    rig.position.x += next.x - this.p.x;
    rig.position.z += next.z - this.p.z;
  },
});
