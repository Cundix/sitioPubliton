// Utilidades para los tests: reloj falso y voz/medidor falsos.

export class FakeClock {
  constructor() {
    this.t = 1_000_000;
    this.timers = new Map();
    this.nextId = 1;
  }

  now() { return this.t; }

  setInterval(fn, ms) {
    const id = this.nextId++;
    this.timers.set(id, { fn, ms, next: this.t + ms });
    return id;
  }

  clearInterval(id) { this.timers.delete(id); }

  get activeIntervals() { return this.timers.size; }

  /** Avanza el reloj ejecutando los intervalos que corresponda, en orden. */
  advance(ms) {
    const target = this.t + ms;
    for (;;) {
      let best = null;
      for (const [id, timer] of this.timers) {
        if (timer.next <= target && (!best || timer.next < best.timer.next)) best = { id, timer };
      }
      if (!best) break;
      this.t = best.timer.next;
      best.timer.next += best.timer.ms;
      best.timer.fn();
    }
    this.t = target;
  }
}

/** Voz falsa: se puede configurar para aceptar o rechazar el permiso. */
export class FakeVoice {
  constructor({ startError = null } = {}) {
    this.startError = startError;
    this.calls = [];
    this.listening = false;
  }

  start() {
    this.calls.push('start');
    if (this.startError) return Promise.reject(Object.assign(new Error('fallo'), { code: this.startError }));
    this.listening = true;
    return Promise.resolve();
  }

  pause() { this.calls.push('pause'); this.listening = false; }
  resume() { this.calls.push('resume'); this.listening = true; return Promise.resolve(); }
  stop() { this.calls.push('stop'); this.listening = false; return Promise.resolve(); }
  abort() { this.calls.push('abort'); this.listening = false; }
}

export class FakeMeter {
  constructor() { this.calls = []; this.result = { measured: true, activeSec: 10, soundSec: 8, longPauses: 1, longPauseSec: 2 }; }
  start() { this.calls.push('start'); return Promise.resolve(); }
  setActive(v) { this.calls.push(`active:${v}`); }
  stop() { this.calls.push('stop'); return this.result; }
  dispose() { this.calls.push('dispose'); }
}

/** Espera a que se resuelvan promesas pendientes. */
export const flush = () => new Promise((resolve) => setImmediate(resolve));
