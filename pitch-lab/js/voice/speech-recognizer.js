// Envoltorio sobre la Web Speech API (SpeechRecognition).
//
// Qué hace:
//  - Pide el micrófono SOLO cuando se llama a start() (acción explícita de la persona).
//  - Si el permiso ya figura como denegado, no vuelve a pedirlo.
//  - Reinicia la escucha si el navegador la corta por sí mismo (con un tope).
//  - Traduce los errores del navegador a códigos propios en español.
//  - No graba ni guarda audio: solo entrega texto.
//
// Privacidad: en varios navegadores (por ejemplo Chrome) el audio se envía a un servicio
// del navegador para reconocerlo. Esta clase no puede evitarlo; la interfaz lo avisa.

import { APP_CONFIG } from '../config/app-config.js';
import { getSpeechRecognitionCtor, queryMicPermission } from './capabilities.js';

export const VOICE_ERRORS = {
  denied: 'El navegador no dio acceso al micrófono.',
  'service-denied': 'El navegador no permite el servicio de reconocimiento de voz.',
  'no-mic': 'No se encontró un micrófono disponible.',
  network: 'No se pudo conectar con el servicio de reconocimiento del navegador.',
  language: 'El navegador no soporta el reconocimiento en español.',
  unsupported: 'Este navegador no ofrece reconocimiento de voz.',
  unknown: 'El reconocimiento de voz falló por un motivo desconocido.',
};

function voiceError(code, detail) {
  const error = new Error(VOICE_ERRORS[code] || VOICE_ERRORS.unknown);
  error.code = code;
  error.detail = detail;
  return error;
}

function mapBrowserError(code) {
  switch (code) {
    case 'not-allowed': return 'denied';
    case 'service-not-allowed': return 'service-denied';
    case 'audio-capture': return 'no-mic';
    case 'network': return 'network';
    case 'language-not-supported': return 'language';
    default: return 'unknown';
  }
}

export class SpeechController {
  /**
   * @param {object} options
   * @param {Function} options.Ctor  constructor de SpeechRecognition (inyectable para pruebas)
   * @param {object} options.win     ventana (para consultar permisos)
   */
  constructor({ Ctor = getSpeechRecognitionCtor(), win = globalThis, config = APP_CONFIG.speech } = {}) {
    this.Ctor = Ctor;
    this.win = win;
    this.config = config;
    this.lang = config.lang;
    this.triedFallback = false;
    this.handlers = { final() {}, interim() {}, lost() {} };
    this.rec = null;
    this.wanted = false;     // ¿debería estar escuchando ahora?
    this.restarts = 0;
    this._startWaiter = null;
    this._endWaiter = null;
  }

  get available() { return !!this.Ctor; }

  setHandlers(handlers) { this.handlers = { ...this.handlers, ...handlers }; }

  /** Inicia la escucha. Resuelve cuando el navegador empezó a escuchar; rechaza con { code }. */
  async start() {
    if (!this.Ctor) throw voiceError('unsupported');
    // Si ya se sabe que está bloqueado, no se vuelve a pedir.
    if ((await queryMicPermission(this.win)) === 'denied') throw voiceError('denied');
    this.restarts = 0;
    this.wanted = true;
    return this._open();
  }

  /** Pausa la escucha (por ejemplo, al pausar la sesión). */
  pause() {
    this.wanted = false;
    this._close(false);
  }

  /** Retoma la escucha después de una pausa. */
  resume() {
    if (!this.Ctor) return Promise.reject(voiceError('unsupported'));
    this.wanted = true;
    this.restarts = 0;
    return this._open();
  }

  /** Termina de forma ordenada: deja que el navegador entregue las últimas frases. */
  stop() {
    this.wanted = false;
    if (!this.rec) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, 1500);
      this._endWaiter = () => { clearTimeout(timer); resolve(); };
      this._close(true);
    });
  }

  /** Corta de inmediato y descarta lo pendiente. */
  abort() {
    this.wanted = false;
    this._close(false);
  }

  // ----- internos -----

  _open() {
    this._close(false);
    const rec = new this.Ctor();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    this.rec = rec;

    return new Promise((resolve, reject) => {
      let started = false;

      rec.onstart = () => {
        started = true;
        resolve();
      };

      rec.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript || '';
          if (result.isFinal) this.handlers.final(text.trim());
          else interim += text;
        }
        this.handlers.interim(interim.trim());
      };

      rec.onerror = (event) => {
        const code = event.error;
        if (code === 'no-speech' || code === 'aborted') return; // no son fallos: el navegador reinicia
        if (code === 'language-not-supported' && !this.triedFallback && this.config.fallbackLang) {
          this.triedFallback = true;
          this.lang = this.config.fallbackLang;
          this._open().then(resolve, reject);
          return;
        }
        const mapped = mapBrowserError(code);
        this.wanted = false;
        if (!started) reject(voiceError(mapped, code));
        else this.handlers.lost({ code: mapped, message: VOICE_ERRORS[mapped] });
      };

      rec.onend = () => {
        if (this.rec !== rec) return;
        this.rec = null;
        const waiter = this._endWaiter;
        this._endWaiter = null;
        if (waiter) waiter();
        // El navegador corta la escucha continua por su cuenta: se reinicia mientras haga falta.
        if (this.wanted) {
          if (this.restarts >= this.config.maxAutoRestarts) {
            this.wanted = false;
            this.handlers.lost({ code: 'unknown', message: 'El reconocimiento se detuvo varias veces seguidas.' });
            if (!started) reject(voiceError('unknown'));
            return;
          }
          this.restarts += 1;
          this._open().then(() => {}, () => {
            this.wanted = false;
            this.handlers.lost({ code: 'unknown', message: VOICE_ERRORS.unknown });
          });
        }
      };

      try {
        rec.start();
      } catch (error) {
        this.wanted = false;
        reject(voiceError('unknown', String(error)));
      }
    });
  }

  _close(graceful) {
    const rec = this.rec;
    if (!rec) return;
    if (!graceful) {
      // Se sueltan los oyentes: ya no importa lo que llegue de esta instancia.
      rec.onresult = rec.onerror = rec.onstart = null;
      rec.onend = null;
      this.rec = null;
    }
    try {
      if (graceful) rec.stop();
      else if (typeof rec.abort === 'function') rec.abort();
      else rec.stop();
    } catch {
      /* ya estaba detenido */
    }
  }
}
