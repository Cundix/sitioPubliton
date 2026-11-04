// Preferencias de la persona: volumen, movimiento reducido, modo sentado y tutorial visto.
// Se guardan en localStorage SOLO preferencias (nunca audio ni transcripciones) y todo
// funciona igual si el almacenamiento no está disponible.

import { Emitter } from './emitter.js';

const KEY = 'publiton-pitch-lab.preferencias.v1';

export class Settings extends Emitter {
  constructor({ storage = null, prefersReducedMotion = false } = {}) {
    super();
    this.storage = storage;
    this.values = {
      volume: 0.7,
      reducedMotion: prefersReducedMotion,
      seated: false,
      tutorialSeen: false,
    };
    this._load();
  }

  _load() {
    try {
      const raw = this.storage?.getItem(KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (typeof saved.volume === 'number') this.values.volume = Math.max(0, Math.min(1, saved.volume));
      if (typeof saved.reducedMotion === 'boolean') this.values.reducedMotion = saved.reducedMotion;
      if (typeof saved.seated === 'boolean') this.values.seated = saved.seated;
      if (typeof saved.tutorialSeen === 'boolean') this.values.tutorialSeen = saved.tutorialSeen;
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

  get(key) { return this.values[key]; }

  set(key, value) {
    if (!(key in this.values) || this.values[key] === value) return;
    this.values[key] = key === 'volume' ? Math.max(0, Math.min(1, Math.round(value * 100) / 100)) : value;
    this._save();
    this.emit('change', { key, value: this.values[key] });
  }
}
