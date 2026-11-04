// Botón del espacio 3D: una entidad A-Frame con una textura dibujada.
// Recibe eventos del cursor (mouse en computadora, láser del control en VR):
//   mouseenter / mouseleave -> resaltado,  click -> ejecutar la acción.

import { CanvasSurface } from './canvas-surface.js';
import { drawButton } from './draw-button.js';

export class Button3D {
  /**
   * @param {object} opts
   * @param {number} opts.w  ancho en metros
   * @param {number} opts.h  alto en metros
   * @param {Function} opts.onPress  se llama con la acción cuando se presiona
   * @param {Function} [opts.onDenied]  se llama si se presiona un botón deshabilitado
   */
  constructor({ w, h, onPress, onDenied, px = 1000 }) {
    this.w = w;
    this.h = h;
    this.action = null;
    this.hover = false;
    this.pressed = false;
    this.onPress = onPress;
    this.onDenied = onDenied;
    this.surface = new CanvasSurface(w, h, px);

    const el = document.createElement('a-entity');
    el.classList.add('ui');
    el.setObject3D('mesh', this.surface.mesh);
    this.el = el;

    this._enter = () => { this.hover = true; this.redraw(); this.el.object3D.scale.setScalar(this.action?.disabled ? 1 : 1.035); };
    this._leave = () => { this.hover = false; this.pressed = false; this.redraw(); this.el.object3D.scale.setScalar(1); };
    this._down = () => { this.pressed = true; this.redraw(); };
    this._up = () => { this.pressed = false; this.redraw(); };
    this._click = () => {
      if (!this.action) return;
      if (this.action.disabled) { this.onDenied?.(this.action); return; }
      this.onPress(this.action);
    };
    el.addEventListener('mouseenter', this._enter);
    el.addEventListener('mouseleave', this._leave);
    el.addEventListener('mousedown', this._down);
    el.addEventListener('mouseup', this._up);
    el.addEventListener('click', this._click);
  }

  setAction(action) {
    const changed = JSON.stringify(action) !== JSON.stringify(this.action);
    this.action = action;
    if (changed) this.redraw();
  }

  redraw() {
    if (!this.action) return;
    this.surface.draw((ctx, w, h) => drawButton(ctx, w, h, this.action, { hover: this.hover, pressed: this.pressed }));
  }

  dispose() {
    const { el } = this;
    el.removeEventListener('mouseenter', this._enter);
    el.removeEventListener('mouseleave', this._leave);
    el.removeEventListener('mousedown', this._down);
    el.removeEventListener('mouseup', this._up);
    el.removeEventListener('click', this._click);
    el.removeObject3D('mesh');
    this.surface.dispose();
    el.remove();
  }
}

/** Conjunto de botones reutilizados por clave (para no reconstruirlos y perder el resaltado). */
export class ButtonPool {
  constructor(parentEl, { onPress, onDenied }) {
    this.parentEl = parentEl;
    this.onPress = onPress;
    this.onDenied = onDenied;
    this.buttons = new Map();
  }

  /**
   * @param {Array<{key, action, x, y, w, h, z?}>} items  posiciones en metros, relativas al padre
   */
  sync(items) {
    const keep = new Set();
    for (const item of items) {
      const key = `${item.key}|${item.w.toFixed(3)}x${item.h.toFixed(3)}`;
      keep.add(key);
      let button = this.buttons.get(key);
      if (!button) {
        button = new Button3D({ w: item.w, h: item.h, onPress: this.onPress, onDenied: this.onDenied });
        this.buttons.set(key, button);
        this.parentEl.appendChild(button.el);
      }
      button.el.object3D.position.set(item.x, item.y, item.z ?? 0.008);
      button.setAction(item.action);
    }
    for (const [key, button] of this.buttons) {
      if (!keep.has(key)) { button.dispose(); this.buttons.delete(key); }
    }
  }

  clear() { this.sync([]); }

  dispose() { this.clear(); }
}
