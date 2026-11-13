// Grabación del audio de la presentación SOLO para el análisis con IA (opcional y con consentimiento).
//
//  - El audio vive únicamente en la memoria de la pestaña: no se guarda en disco, ni en localStorage, ni en el repositorio.
//  - Se descarta al terminar el análisis, al cancelar, al reintentar o al salir.
//  - Se pide el micrófono solo cuando la persona presiona «Comenzar presentación» con el análisis activado.
//  - Se libera la pista de audio al terminar, cancelar o salir.
//  - Para enviarlo se convierte a WAV mono de 16 kHz (formato soportado por la API y independiente del navegador).

import { APP_CONFIG } from '../config/app-config.js';

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function recorderSupported(win = globalThis) {
  return !!(win.navigator?.mediaDevices?.getUserMedia && win.MediaRecorder && (win.AudioContext || win.webkitAudioContext) && win.OfflineAudioContext);
}

function captureError(code, cause) {
  const error = new Error(code === 'denied' ? 'El navegador no dio acceso al micrófono.' : 'No se pudo iniciar la grabación.');
  error.code = code;
  error.cause = cause;
  return error;
}

export class AudioCapture {
  constructor({ win = globalThis, config = APP_CONFIG.ai } = {}) {
    this.win = win;
    this.config = config;
    this._gen = 0; // sube con cada dispose(): invalida un permiso de micrófono que llega tarde
    this._reset();
  }

  _reset() {
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.activeMs = 0;
    this.segmentStart = null;
    this.truncated = false;
    this.stopped = null;
    this.mimeType = '';
  }

  get active() { return !!this.recorder && this.recorder.state !== 'inactive'; }

  /** Pide el micrófono y empieza a grabar. Rechaza con { code: 'denied' | 'no-mic' | 'unsupported' | 'unknown' }. */
  async start() {
    if (!recorderSupported(this.win)) throw captureError('unsupported');
    if (this.recorder) return;
    const gen = this._gen;
    let stream;
    try {
      stream = await this.win.navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = error?.name || '';
      throw captureError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'no-mic' : 'unknown', error);
    }
    if (gen !== this._gen) {
      // Se canceló mientras el navegador concedía el permiso: se suelta el micrófono enseguida.
      try { stream.getTracks().forEach((track) => track.stop()); } catch { /* ya liberado */ }
      throw captureError('aborted');
    }
    this.stream = stream;
    this.mimeType = MIME_CANDIDATES.find((m) => this.win.MediaRecorder.isTypeSupported?.(m)) || '';
    try {
      this.recorder = new this.win.MediaRecorder(this.stream, this.mimeType ? { mimeType: this.mimeType } : undefined);
    } catch (error) {
      this._releaseStream();
      throw captureError('unknown', error);
    }
    this.chunks = [];
    this.recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) this.chunks.push(event.data);
      this._enforceLimit();
    };
    this.stopped = new Promise((resolve) => { this.recorder.onstop = resolve; });
    this.recorder.start(1000); // entrega fragmentos cada segundo
    this.segmentStart = this._now();
  }

  _now() { return this.win.performance?.now?.() ?? Date.now(); }

  _currentActiveMs() {
    return this.activeMs + (this.segmentStart != null ? this._now() - this.segmentStart : 0);
  }

  /** Corta la grabación al llegar al tope (evita archivos enormes). */
  _enforceLimit() {
    if (!this.truncated && this._currentActiveMs() >= this.config.maxRecordSec * 1000 && this.recorder?.state !== 'inactive') {
      this.truncated = true;
      this._closeSegment();
      try { this.recorder.stop(); } catch { /* ya detenido */ }
    }
  }

  _closeSegment() {
    if (this.segmentStart != null) { this.activeMs += this._now() - this.segmentStart; this.segmentStart = null; }
  }

  pause() {
    if (this.recorder?.state === 'recording') {
      this._closeSegment();
      try { this.recorder.pause(); } catch { /* sin efecto */ }
    }
  }

  resume() {
    if (this.recorder?.state === 'paused') {
      try { this.recorder.resume(); } catch { return; }
      this.segmentStart = this._now();
    }
  }

  /** Termina la grabación, libera el micrófono y devuelve el audio en memoria. */
  async finish() {
    if (!this.recorder) return null;
    this._closeSegment();
    if (this.recorder.state !== 'inactive') {
      try { this.recorder.stop(); } catch { /* ya detenido */ }
    }
    await this.stopped;
    const blob = new Blob(this.chunks, { type: this.recorder.mimeType || this.mimeType || 'audio/webm' });
    const result = { blob, durationMs: this.activeMs, truncated: this.truncated };
    this.dispose();
    return result;
  }

  _releaseStream() {
    try { this.stream?.getTracks().forEach((track) => track.stop()); } catch { /* ya liberado */ }
    this.stream = null;
  }

  /** Descarta todo y libera el micrófono. Seguro de llamar varias veces. */
  dispose() {
    this._gen += 1;
    if (this.recorder) {
      this.recorder.ondataavailable = null;
      this.recorder.onstop = null;
      if (this.recorder.state !== 'inactive') { try { this.recorder.stop(); } catch { /* ya detenido */ } }
    }
    this._releaseStream();
    this._reset();
  }
}

// ---------- Conversión a WAV mono 16 kHz ----------

/** Codifica muestras Float32 [-1, 1] como WAV PCM de 16 bits. */
export function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  write(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

/** Convierte base de bytes a base64 sin desbordar la pila (por pedazos). */
export function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(binary);
}

/**
 * Decodifica el audio grabado y lo devuelve como WAV mono (base64).
 * @returns {Promise<{ base64: string, mimeType: 'audio/wav', seconds: number }>}
 */
export async function blobToWavBase64(blob, { sampleRate = APP_CONFIG.ai.sampleRate, win = globalThis } = {}) {
  const AudioCtx = win.AudioContext || win.webkitAudioContext;
  const ctx = new AudioCtx();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    ctx.close?.().catch?.(() => {});
  }
  const length = Math.max(1, Math.ceil(decoded.duration * sampleRate));
  const offline = new win.OfflineAudioContext(1, length, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  const wav = encodeWav(rendered.getChannelData(0), sampleRate);
  return { base64: bytesToBase64(wav), mimeType: 'audio/wav', seconds: decoded.duration };
}
