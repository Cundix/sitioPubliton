// Pulsación sostenida («mantené presionado para confirmar»).
//
// Una acción que cambia mucho la situación y no se puede deshacer (por ejemplo terminar la presentación
// antes de tiempo) solo se ejecuta si el botón se mantiene apretado un rato. Mientras tanto se muestra
// el avance y, si se suelta antes, no pasa nada: hay tiempo de arrepentirse. Es una convención de VR
// («long-press buttons», UX for XR cap. 3) y evita que un toque sin querer con el gatillo arruine una práctica.
//
// Esta clase no sabe nada de A-Frame ni del DOM: recibe el reloj y el temporizador de cuadros, así que se
// puede probar con un reloj falso.

export const HOLD_MS = 700;

export class HoldGesture {
  /**
   * @param {object} opts
   * @param {number} [opts.durationMs]
   * @param {() => number} [opts.now]
   * @param {(cb: () => void) => any} [opts.raf]
   * @param {(id: any) => void} [opts.caf]
   * @param {(progress: number) => void} [opts.onProgress]  de 0 a 1 mientras se mantiene
   * @param {() => void} [opts.onComplete]                    se mantuvo el tiempo completo
   * @param {(heldMs: number) => void} [opts.onAbort]         se soltó antes de tiempo
   */
  constructor({
    durationMs = HOLD_MS,
    now = () => performance.now(),
    raf = (cb) => requestAnimationFrame(cb),
    caf = (id) => cancelAnimationFrame(id),
    onProgress = () => {},
    onComplete = () => {},
    onAbort = () => {},
  } = {}) {
    this.durationMs = durationMs;
    this.now = now;
    this.raf = raf;
    this.caf = caf;
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onAbort = onAbort;
    this.active = false;
    this.t0 = 0;
    this.frame = null;
    this._loop = () => {
      if (!this.active) return;
      const progress = Math.min(1, (this.now() - this.t0) / this.durationMs);
      if (progress >= 1) {
        this.active = false;
        this.frame = null;
        this.onProgress(1);
        this.onComplete();
        return;
      }
      this.onProgress(progress);
      this.frame = this.raf(this._loop);
    };
  }

  /** Empieza a contar (se llama al apretar). Si ya estaba contando no hace nada. */
  start() {
    if (this.active) return;
    this.active = true;
    this.t0 = this.now();
    this.onProgress(0);
    this.frame = this.raf(this._loop);
  }

  /**
   * Se soltó o se apuntó a otro lado. Si faltaba tiempo, avisa con onAbort. Si ya se había mantenido el tiempo completo
   * pero el dibujo todavía no lo había notado (la página puede ir lenta), cuenta como completado: quien mantuvo el botón
   * no tiene la culpa de que un cuadro se demore.
   */
  cancel() {
    if (!this.active) return;
    const held = this.now() - this.t0;
    this.active = false;
    if (this.frame != null) this.caf(this.frame);
    this.frame = null;
    if (held >= this.durationMs) {
      this.onProgress(1);
      this.onComplete();
      return;
    }
    this.onProgress(0);
    this.onAbort(held);
  }

  /** Limpieza al destruir el botón: no avisa nada. */
  dispose() {
    this.active = false;
    if (this.frame != null) this.caf(this.frame);
    this.frame = null;
  }
}
