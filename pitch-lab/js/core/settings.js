// Preferencias de la persona: volumen, movimiento reducido, modo sentado, tutorial visto y las
// opciones de comodidad en VR (giro con el joystick, vibración de los controles y altura de la vista).
// Se guardan en localStorage SOLO preferencias (nunca audio ni transcripciones) y todo
// funciona igual si el almacenamiento no está disponible.

import { Emitter } from './emitter.js';

const KEY = 'publiton-pitch-lab.preferencias.v1';

/** Ángulos de giro con el joystick que se ofrecen (0 = desactivado). El orden es el del botón del menú. */
export const SNAP_ANGLES = Object.freeze([0, 15, 30, 45, 90]);
/** Corrección de la altura de la vista en VR, en centímetros: de a 5 cm, con tope para no perder el piso. */
export const HEIGHT_STEP_CM = 5;
export const HEIGHT_MIN_CM = -30;
export const HEIGHT_MAX_CM = 30;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class Settings extends Emitter {
  constructor({ storage = null, prefersReducedMotion = false } = {}) {
    super();
    this.storage = storage;
    this.values = {
      volume: 0.7,
      reducedMotion: prefersReducedMotion,
      seated: false,
      tutorialSeen: false,
      snapTurnDeg: 30,   // giro por tramos con el joystick (los giros suaves marean a más gente que los de a saltos)
      haptics: true,     // vibración corta de los controles al apuntar, presionar y cuando algo no está disponible
      heightCm: 0,       // corrección fina de la altura de la vista en VR
    };
    this._load();
  }

  _load() {
    try {
      const raw = this.storage?.getItem(KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (typeof saved.volume === 'number') this.values.volume = clamp(saved.volume, 0, 1);
      if (typeof saved.reducedMotion === 'boolean') this.values.reducedMotion = saved.reducedMotion;
      if (typeof saved.seated === 'boolean') this.values.seated = saved.seated;
      if (typeof saved.tutorialSeen === 'boolean') this.values.tutorialSeen = saved.tutorialSeen;
      if (SNAP_ANGLES.includes(saved.snapTurnDeg)) this.values.snapTurnDeg = saved.snapTurnDeg;
      if (typeof saved.haptics === 'boolean') this.values.haptics = saved.haptics;
      if (Number.isFinite(saved.heightCm)) this.values.heightCm = Settings.normalizeHeight(saved.heightCm);
    } catch {
      /* almacenamiento bloqueado o dañado: se usan los valores por defecto */
    }
  }

  _save() {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.values));
    } catch {
      /* sin almacenamiento: se sigue funcionando */
    }
  }

  /** Redondea al paso y limita al rango permitido. */
  static normalizeHeight(cm) {
    return clamp(Math.round(cm / HEIGHT_STEP_CM) * HEIGHT_STEP_CM, HEIGHT_MIN_CM, HEIGHT_MAX_CM);
  }

  get(key) { return this.values[key]; }

  set(key, value) {
    if (!(key in this.values) || this.values[key] === value) return;
    let next = value;
    if (key === 'volume') next = clamp(Math.round(value * 100) / 100, 0, 1);
    else if (key === 'snapTurnDeg') { if (!SNAP_ANGLES.includes(value)) return; }
    else if (key === 'heightCm') { if (!Number.isFinite(value)) return; next = Settings.normalizeHeight(value); }
    if (this.values[key] === next) return;
    this.values[key] = next;
    this._save();
    this.emit('change', { key, value: this.values[key] });
  }

  /** Pasa al siguiente ángulo de giro de la lista (vuelve al principio después del último). */
  cycleSnapTurn() {
    const i = SNAP_ANGLES.indexOf(this.values.snapTurnDeg);
    this.set('snapTurnDeg', SNAP_ANGLES[(i + 1) % SNAP_ANGLES.length]);
  }

  /** Sube o baja la altura de la vista de a un paso. */
  adjustHeight(direction) {
    this.set('heightCm', this.values.heightCm + Math.sign(direction) * HEIGHT_STEP_CM);
  }
}

/** Texto del giro para botones y paneles. */
export function snapTurnLabel(deg) {
  return deg ? `${deg}°` : 'Desactivado';
}

/** Texto de la altura para botones y paneles (con signo). */
export function heightLabel(cm) {
  return `${cm > 0 ? '+' : cm < 0 ? '−' : ''}${Math.abs(cm)} cm`;
}
