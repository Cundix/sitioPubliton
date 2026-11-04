// UIHub: mantiene el modelo de pantalla vigente y avisa a quien lo dibuja.
//   'model'  -> cambió la pantalla completa (estado, opciones, textos)
//   'clock'  -> cambió lo que muestra el reloj (como máximo una vez por segundo)
//   'hint'   -> cambió el texto corto del atril (por ejemplo, subtítulo de lo que se escucha)
// Se agrupan los cambios para dibujar una sola vez por cuadro.

import { Emitter } from '../core/emitter.js';
import { buildScreen } from '../core/screens.js';

export class UIHub extends Emitter {
  constructor({ session, settings, env = {} }) {
    super();
    this.session = session;
    this.settings = settings;
    this.env = env;
    this.model = buildScreen(session, settings, env);
    this._pending = false;
    this._lastClockKey = '';
    this._lastHint = '';
    this._off = [
      session.on('change', () => this.schedule()),
      session.on('tick', () => this.refreshClock()),
      session.on('transcript', () => this.refreshHint()),
      session.on('notice', () => this.schedule()),
      settings.on('change', () => this.schedule()),
    ];
  }

  setEnv(patch) {
    this.env = { ...this.env, ...patch };
    this.schedule();
  }

  schedule() {
    if (this._pending) return;
    this._pending = true;
    queueMicrotask(() => {
      this._pending = false;
      this.refresh();
    });
  }

  refresh() {
    this.model = buildScreen(this.session, this.settings, this.env);
    this._lastClockKey = JSON.stringify(this.model.clock);
    this._lastHint = this.model.lectern.hint;
    this.emit('model', this.model);
  }

  refreshClock() {
    const model = buildScreen(this.session, this.settings, this.env);
    const key = JSON.stringify(model.clock);
    if (key === this._lastClockKey) return;
    this._lastClockKey = key;
    this.model.clock = model.clock;
    this.emit('clock', model.clock);
  }

  /** Actualiza el texto corto del atril (por ejemplo, el subtítulo de lo que se escucha), como máximo cada 250 ms. */
  refreshHint() {
    if (this._hintTimer) return;
    this._hintTimer = setTimeout(() => {
      this._hintTimer = null;
      const next = buildScreen(this.session, this.settings, this.env);
      if (next.lectern.hint === this._lastHint) return;
      this._lastHint = next.lectern.hint;
      this.model.lectern = next.lectern;
      this.emit('hint', next.lectern);
    }, 250);
  }

  dispose() {
    this._off.forEach((off) => off());
    clearTimeout(this._hintTimer);
  }
}
