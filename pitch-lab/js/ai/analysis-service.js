// Servicio de análisis: junta la grabación de audio, el seguimiento de manos y el cliente de Gemini
// detrás de una interfaz pequeña que usa la Sesión. Todo es OPCIONAL: si algo falla, la sesión sigue.
//
// Interfaz que espera Session (ver core/session.js):
//   startAudio() · startCamera() · beginTracking() · pause() · resume() · finishCapture() · abort()
//   analyze({ audio, context, signal })
//
// Privacidad: el audio queda en memoria hasta terminar el análisis; el video nunca se graba ni se envía.

import { AudioCapture, blobToWavBase64, recorderSupported } from './audio-capture.js';
import { GestureTracker, cameraSupported } from './gesture-tracker.js';
import { GeminiClient, AiError } from './gemini-client.js';
import { APP_CONFIG } from '../config/app-config.js';

export class AnalysisService {
  /**
   * @param {object} deps
   * @param {AiKeyStore} deps.keyStore
   * @param {Function} [deps.videoEl]  devuelve el <video> de vista previa (opcional)
   */
  constructor({ keyStore, win = globalThis, config = APP_CONFIG.ai, capture = null, tracker = null, clientFactory = null, getVideoEl = () => null } = {}) {
    this.keyStore = keyStore;
    this.win = win;
    this.config = config;
    this.capture = capture || new AudioCapture({ win, config });
    this.tracker = tracker || new GestureTracker({ win });
    this.clientFactory = clientFactory || ((apiKey) => new GeminiClient({ apiKey, config }));
    this.getVideoEl = getVideoEl;
    this._previewOn = false;
    this._sessionCamera = false; // la sesión de práctica está usando la cámara
  }

  /** Lo que este navegador puede hacer (independiente de si hay clave). */
  get support() {
    return { recorder: recorderSupported(this.win), camera: cameraSupported(this.win) };
  }

  // ----- Captura (la llama la sesión) -----
  startAudio() { return this.capture.start(); }

  async startCamera() {
    this._sessionCamera = true;
    try {
      await this.tracker.open(this.getVideoEl());
    } catch (error) {
      this._sessionCamera = false;
      throw error;
    }
    this._previewOn = true;
  }

  beginTracking() { this.tracker.start(); }

  pause() { this.capture.pause(); this.tracker.pause(); }

  resume() { this.capture.resume(); this.tracker.resume(); }

  /** Cierra todo y devuelve lo capturado: { audio, gestures }. Libera micrófono y cámara. */
  async finishCapture() {
    let audio = null;
    if (this.capture.active || this.capture.recorder) audio = await this.capture.finish();
    const gestures = this.tracker.stream || this.tracker.acc ? this.tracker.finish() : null;
    this._previewOn = false;
    this._sessionCamera = false;
    return { audio, gestures };
  }

  /** Descarta todo sin analizar. */
  abort() {
    this.capture.dispose();
    this.tracker.close();
    this._previewOn = false;
    this._sessionCamera = false;
  }

  // ----- Análisis -----
  async analyze({ audio, context, signal }) {
    const apiKey = this.keyStore.value;
    if (!apiKey) throw new AiError('no-key');
    let wav;
    try {
      wav = await blobToWavBase64(audio.blob, { sampleRate: this.config.sampleRate, win: this.win });
    } catch {
      throw new AiError('bad-response', 'No se pudo preparar el audio.');
    }
    const client = this.clientFactory(apiKey);
    return client.analyze({ audioBase64: wav.base64, mimeType: wav.mimeType, context, signal });
  }

  /** Comprueba la clave sin gastar cuota de generación. */
  async testKey() {
    const apiKey = this.keyStore.value;
    if (!apiKey) throw new AiError('no-key');
    return this.clientFactory(apiKey).testKey();
  }

  // ----- Vista previa de la cámara (para encuadrarse antes de empezar) -----
  async previewOn() {
    await this.tracker.open(this.getVideoEl());
    this._previewOn = true;
  }

  previewOff() {
    if (!this._sessionCamera) this.tracker.close();
    this._previewOn = this._sessionCamera;
  }

  get previewing() { return this._previewOn; }

  dispose() { this.abort(); }
}
