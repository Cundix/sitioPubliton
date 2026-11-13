// Seguimiento de manos con la cámara, TODO en el dispositivo (MediaPipe Hand Landmarker, incluido en vendor/).
//
//  - La cámara se pide solo después de una acción explícita (probar la cámara o comenzar con «Gestos» activado).
//  - NO se graba ni se envía video: solo se calculan números (manos visibles, movimiento) con gesture-metrics.js.
//  - El modelo y el runtime (~22 MB) se descargan únicamente si se activa esta función (carga diferida).
//  - Se libera la cámara al terminar, cancelar o salir.
//  - Un solo temporizador (setInterval) muestrea a pocos cuadros por segundo.

import { APP_CONFIG } from '../config/app-config.js';
import { GestureAccumulator } from './gesture-metrics.js';

const MP_BASE = new URL('../../vendor/mediapipe/', import.meta.url);

export function cameraSupported(win = globalThis) {
  return !!(win.navigator?.mediaDevices?.getUserMedia && win.WebAssembly);
}

function cameraError(code, cause) {
  const error = new Error(code === 'denied' ? 'El navegador no dio acceso a la cámara.' : code === 'no-camera' ? 'No se encontró una cámara.' : 'No se pudo iniciar el seguimiento de manos.');
  error.code = code;
  error.cause = cause;
  return error;
}

export class GestureTracker {
  constructor({ win = globalThis, config = APP_CONFIG.gestures } = {}) {
    this.win = win;
    this.config = config;
    this.stream = null;
    this.video = null;
    this.landmarker = null;
    this.timer = null;
    this.acc = null;
    this.running = false;
    this.t0 = 0;
    this._loading = null;
    this._opening = null;
    this._gen = 0; // sube con cada close(): invalida permisos y cargas que llegan tarde
  }

  async _loadModel() {
    const { FilesetResolver, HandLandmarker } = await import(new URL('vision_bundle.mjs', MP_BASE).href);
    const fileset = await FilesetResolver.forVisionTasks(new URL('wasm', MP_BASE).href);
    return HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: new URL('hand_landmarker.task', MP_BASE).href, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numHands: 2,
    });
  }

  /** Carga diferida del modelo (una sola vez). Si se cerró mientras cargaba, el modelo recién cargado se descarta. */
  async _ensureModel(gen) {
    if (this.landmarker) return;
    if (!this._loading) this._loading = this._loadModel();
    const loading = this._loading;
    let landmarker;
    try {
      landmarker = await loading;
    } catch (error) {
      if (this._loading === loading) this._loading = null;
      throw cameraError('model', error);
    }
    if (gen !== this._gen) {
      try { landmarker.close?.(); } catch { /* ya cerrado */ }
      return;
    }
    this.landmarker = landmarker;
  }

  /** Abre la cámara (y carga el modelo si hace falta). `videoEl` es opcional: sirve de vista previa. */
  open(videoEl = null) {
    if (!cameraSupported(this.win)) return Promise.reject(cameraError('unsupported'));
    if (!this._opening) {
      const gen = this._gen;
      const opening = this._open(gen, videoEl).catch((error) => {
        if (error?.code !== 'aborted' && gen === this._gen) this.close();
        throw error;
      }).finally(() => { if (this._opening === opening) this._opening = null; });
      this._opening = opening;
    }
    return this._opening.then(() => { this._attach(videoEl); });
  }

  async _open(gen, videoEl) {
    if (!this.stream) {
      let stream;
      try {
        stream = await this.win.navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
      } catch (error) {
        const name = error?.name || '';
        throw cameraError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'no-camera' : 'unknown', error);
      }
      if (gen !== this._gen) {
        // Se canceló mientras el navegador concedía el permiso: se suelta la cámara enseguida.
        try { stream.getTracks().forEach((track) => track.stop()); } catch { /* ya liberada */ }
        throw cameraError('aborted');
      }
      this.stream = stream;
    }
    this._attach(videoEl);
    await this._ensureModel(gen);
    if (gen !== this._gen) throw cameraError('aborted');
  }

  _attach(videoEl) {
    if (!this.stream) return;
    const video = videoEl || this.video || this.win.document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = this.stream;
    video.play?.().catch?.(() => {});
    this.video = video;
  }

  /** Empieza a acumular métricas (solo mientras se presenta). */
  start() {
    if (!this.landmarker || !this.video || this.running) return;
    const w = this.video.videoWidth || 640;
    const h = this.video.videoHeight || 480;
    this.acc = this.acc || new GestureAccumulator({ aspect: h / w, config: this.config });
    this.running = true;
    // La línea de tiempo continúa donde quedó (sin contar las pausas): así la duración medida no se reinicia al retomar.
    this.t0 = this.win.performance.now() - (this.acc.lastT ?? 0) * 1000;
    this.timer = this.win.setInterval(() => this._sample(), Math.round(1000 / this.config.sampleFps));
  }

  _sample() {
    const video = this.video;
    if (!this.running || !video || video.readyState < 2 || video.videoWidth === 0) return;
    const now = this.win.performance.now();
    let result;
    try {
      result = this.landmarker.detectForVideo(video, now);
    } catch {
      return; // un cuadro fallido no corta la sesión
    }
    this.acc.addFrame((now - this.t0) / 1000, result?.landmarks || []);
  }

  pause() {
    if (this.timer != null) { this.win.clearInterval(this.timer); this.timer = null; }
    this.running = false;
    this.acc?.breakContinuity();
  }

  resume() {
    if (this.running || !this.landmarker) return;
    this.start();
  }

  /** Devuelve el resumen y libera la cámara. */
  finish() {
    this.pause();
    const summary = this.acc ? this.acc.summary() : { measured: false };
    this.close();
    return summary;
  }

  /** Suelta la cámara y el modelo. Seguro de llamar varias veces. */
  close() {
    this._gen += 1;
    this._opening = null;
    this.pause();
    try { this.stream?.getTracks().forEach((track) => track.stop()); } catch { /* ya liberada */ }
    this.stream = null;
    if (this.video) { try { this.video.srcObject = null; } catch { /* sin efecto */ } }
    try { this.landmarker?.close?.(); } catch { /* ya cerrado */ }
    this.landmarker = null;
    this._loading = null;
    this.acc = null;
  }
}
