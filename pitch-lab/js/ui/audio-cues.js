// Avisos sonoros generados con Web Audio (sin archivos de audio). Siempre acompañan a una
// señal visual: el sonido nunca es la única forma de enterarse de algo.
// El volumen sale de las preferencias. Con volumen 0 no suena nada.

export class AudioCues {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
  }

  /** Debe llamarse dentro de un gesto de la persona (clic, tecla): los navegadores lo exigen. */
  unlock() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!this.ctx) this.ctx = new Ctx();
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch {
      /* sin audio: la experiencia sigue con señales visuales */
    }
  }

  _tone(freq, start, dur, vol, type = 'sine') {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + start;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  play(kind) {
    const volume = this.settings.get('volume');
    if (!volume || !this.ctx || this.ctx.state !== 'running') return;
    const v = volume * 0.22;
    switch (kind) {
      case 'click': this._tone(880, 0, 0.06, v * 0.7); break;
      case 'denied': this._tone(190, 0, 0.14, v, 'triangle'); break;
      case 'start': this._tone(523, 0, 0.12, v); this._tone(784, 0.13, 0.18, v); break;
      case 'warning': this._tone(660, 0, 0.14, v); this._tone(660, 0.22, 0.14, v); break;
      case 'final': [0, 0.2, 0.4].forEach((t) => this._tone(880, t, 0.12, v)); break;
      case 'end': this._tone(784, 0, 0.14, v); this._tone(523, 0.15, 0.3, v); break;
      default: break;
    }
  }

  dispose() {
    try { this.ctx?.close(); } catch { /* ya cerrado */ }
    this.ctx = null;
  }
}
