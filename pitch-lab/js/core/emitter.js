// Emisor de eventos mínimo (sin dependencias del navegador, funciona en Node).

export class Emitter {
  constructor() {
    this._listeners = new Map();
  }

  /** Suscribe un oyente. Devuelve una función para desuscribirse. */
  on(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    const set = this._listeners.get(type);
    if (set) set.delete(fn);
  }

  emit(type, detail) {
    const set = this._listeners.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(detail);
      } catch (error) {
        // Un oyente roto no debe frenar al resto ni a la sesión.
        console.error(`[emitter] error en oyente de "${type}":`, error);
      }
    }
  }

  /** Cantidad de oyentes activos (útil para comprobar que no quedan filtraciones). */
  listenerCount() {
    let n = 0;
    for (const set of this._listeners.values()) n += set.size;
    return n;
  }
}
