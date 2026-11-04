// Medidor opcional del NIVEL de audio (no del contenido).
//
// Es independiente del reconocimiento de voz: pide su propio permiso de micrófono
// (getUserMedia) solo si la persona activa "Medir nivel de audio".
// Mide, en el dispositivo y sin grabar ni guardar audio:
//   - segundos con sonido por encima de un umbral,
//   - cantidad de pausas largas (sin sonido por encima del umbral durante varios segundos).
// Limitaciones: no distingue voz de ruido ambiente y depende de la ganancia del micrófono.

import { APP_CONFIG } from '../config/app-config.js';

export class AudioMeter {
  constructor({ win = globalThis, config = APP_CONFIG.audioMeter } = {}) {
    this.win = win;
    this.config = config;
    this._reset();
  }

  get available() {
    const nav = this.win.navigator;
    return !!(nav?.mediaDevices?.getUserMedia && (this.win.AudioContext || this.win.webkitAudioContext));
  }

  _reset() {
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.buffer = null;
    this.timer = null;
    this.active = false;
    this.lastSample = 0;
    this.activeSec = 0;
    this.soundSec = 0;
    this.silenceRun = 0;
    this.longPauses = 0;
    this.countedThisRun = false;
    this.started = false;
  }

  /** Pide el micrófono y empieza a muestrear. Rechaza si no hay permiso. */
  async start() {
    if (this.started) return;
    if (!this.available) throw new Error('El medidor de audio no está disponible en este navegador.');
    const Ctx = this.win.AudioContext || this.win.webkitAudioContext;
    // Sin cancelación de eco ni normalización: queremos el nivel real de entrada.
    this.stream = await this.win.navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.ctx = new Ctx();
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.buffer = new Float32Array(this.analyser.fftSize);
    source.connect(this.analyser);
    this.lastSample = performance.now();
    this.started = true;
    this.timer = this.win.setInterval(() => this._sample(), this.config.sampleMs);
  }

  setActive(value) {
    if (!this.started) return;
    this.active = !!value;
    this.lastSample = performance.now();
    if (!value) { this.silenceRun = 0; this.countedThisRun = false; }
  }

  _sample() {
    const now = performance.now();
    const dt = (now - this.lastSample) / 1000;
    this.lastSample = now;
    if (!this.active || !this.analyser) return;

    this.analyser.getFloatTimeDomainData(this.buffer);
    let sum = 0;
    for (let i = 0; i < this.buffer.length; i++) sum += this.buffer[i] * this.buffer[i];
    const rms = Math.sqrt(sum / this.buffer.length);

    this.activeSec += dt;
    if (rms >= this.config.silenceRms) {
      this.soundSec += dt;
      this.silenceRun = 0;
      this.countedThisRun = false;
    } else {
      this.silenceRun += dt;
      if (!this.countedThisRun && this.silenceRun >= this.config.longPauseSec) {
        this.longPauses += 1;
        this.countedThisRun = true;
      }
    }
  }

  /** Detiene la medición, libera el micrófono y devuelve el resumen. */
  stop() {
    const result = this.started
      ? {
        measured: true,
        activeSec: this.activeSec,
        soundSec: this.soundSec,
        longPauses: this.longPauses,
        longPauseSec: this.config.longPauseSec,
      }
      : { measured: false };
    this.dispose();
    return result;
  }

  /** Libera pista de audio, nodo y contexto. Seguro de llamar varias veces. */
  dispose() {
    if (this.timer != null) this.win.clearInterval(this.timer);
    try { this.stream?.getTracks().forEach((track) => track.stop()); } catch { /* ya detenido */ }
    try { this.ctx?.close(); } catch { /* ya cerrado */ }
    this._reset();
  }
}
