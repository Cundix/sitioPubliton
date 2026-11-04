// Sesión: aplica la tabla de estados (state-machine.js) y se ocupa de los efectos:
// cronómetro, cuenta regresiva de preparación, voz, medición de audio y devolución.
//
// Reglas de diseño:
//  - Un solo temporizador (setInterval) a la vez. Se crea y se destruye en un único lugar.
//  - El tiempo se calcula con marcas de reloj (now), no sumando ticks: es exacto aunque el
//    navegador demore los intervalos.
//  - Los resultados asíncronos de la voz se ignoran si la sesión ya cambió de estado.
//  - Cancelar o salir libera voz y audio.

import { Emitter } from './emitter.js';
import { APP_CONFIG, DEMO_TRANSCRIPT } from '../config/app-config.js';
import { getScenario } from '../config/scenarios.js';
import { BRIEFS } from '../config/briefs.js';
import { FLOW, S, ACTIVE_STATES, createInitialData } from './state-machine.js';
import { SOURCES } from './metrics.js';
import { getTimeWarning } from './time-warnings.js';
import { buildFeedback } from './feedback.js';

export const realClock = {
  now: () => Date.now(),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
};

function freshCapture() {
  return {
    activeMs: 0,          // milisegundos efectivos acumulados (sin pausas)
    segmentStart: null,   // inicio del tramo activo actual
    finals: [],           // frases finales del reconocimiento
    interim: '',          // frase parcial en curso
    override: null,       // texto reemplazado por la persona (editado, escrito o demo)
    overrideSource: null, // origen del texto reemplazado
    voiceLost: false,     // el reconocimiento se cortó durante la sesión
    audio: null,          // resultado de la medición de audio (si se activó)
    closed: false,        // ya no acepta frases nuevas del reconocimiento
  };
}

export class Session extends Emitter {
  /**
   * @param {object} deps
   * @param {object} deps.clock      { now, setInterval, clearInterval }
   * @param {object} deps.voice      reconocimiento de voz (opcional): start, pause, resume, stop, abort
   * @param {object} deps.meter      medidor de audio (opcional): start, setActive, stop, dispose
   * @param {object} deps.capabilities { speech: boolean }
   * @param {boolean} deps.tutorialSeen
   */
  constructor({ clock = realClock, voice = null, meter = null, capabilities = {}, tutorialSeen = false, config = APP_CONFIG } = {}) {
    super();
    this.clock = clock;
    this.voice = voice;
    this.meter = meter;
    this.config = config;
    this.state = S.LOADING;
    this.data = createInitialData({ capabilities, tutorialSeen });
    this.capture = freshCapture();
    this._ticker = null;
    this._prepEndsAt = null;
    this._voiceAttempt = 0;
    this._lastWarning = null;
    this._feedbackCache = null;
    this._voiceTouched = false;   // ¿se inició el reconocimiento? (para liberar solo lo necesario)
    this._meterTouched = false;   // ¿se inició el medidor de audio?
    this._disposed = false;
  }

  // ---------- Lectura ----------

  get scenario() { return getScenario(this.data.scenarioId); }
  get brief() { return BRIEFS[this.data.briefIndex % BRIEFS.length]; }
  get isActive() { return ACTIVE_STATES.includes(this.state); }

  /** Tiempo total del escenario en segundos, o null si la práctica es libre. */
  get totalSec() {
    const sc = this.scenario;
    if (!sc || this.data.options.unlimited) return null;
    return sc.durationSec;
  }

  getActiveMs() {
    const c = this.capture;
    return c.activeMs + (c.segmentStart != null ? this.clock.now() - c.segmentStart : 0);
  }

  /** Datos de tiempo para el reloj y la interfaz. */
  getTimeView() {
    const total = this.totalSec;
    const elapsedSec = this.getActiveMs() / 1000;
    const remainingSec = total == null ? null : Math.max(0, total - elapsedSec);
    const prepSec = this.data.options.prepSec;
    let prepRemainingSec = null;
    if (this.state === S.PREP && prepSec > 0 && this._prepEndsAt != null) {
      prepRemainingSec = Math.max(0, Math.ceil((this._prepEndsAt - this.clock.now()) / 1000));
    }
    return {
      state: this.state,
      totalSec: total,
      elapsedSec: Math.floor(elapsedSec),
      remainingSec: remainingSec == null ? null : Math.ceil(remainingSec),
      warning: total == null ? 'none' : getTimeWarning(Math.ceil(remainingSec), total, this.config.timeWarnings),
      prepSec,
      prepRemainingSec,
      prepDone: prepSec > 0 && prepRemainingSec === 0,
    };
  }

  /** Texto actual de la transcripción y su origen. */
  getTranscript() {
    const c = this.capture;
    const recognized = c.finals.join(' ').replace(/\s+/g, ' ').trim();
    if (c.override != null) {
      const text = c.override.trim();
      return { text, source: text ? c.overrideSource : SOURCES.NONE, recognized, interim: '' };
    }
    return { text: recognized, source: recognized ? SOURCES.SPEECH : SOURCES.NONE, recognized, interim: c.interim };
  }

  /** Devolución calculada con los datos reales de la captura. */
  getFeedback() {
    const t = this.getTranscript();
    const key = JSON.stringify([t.text, t.source, this.capture.activeMs, this.capture.audio, this.data.rubric, this.totalSec]);
    if (this._feedbackCache?.key === key) return this._feedbackCache.value;
    const value = buildFeedback(
      { text: t.text, source: t.source, activeMs: this.capture.activeMs, audio: this.capture.audio },
      { targetSec: this.totalSec, rubric: this.data.rubric },
      this.config,
    );
    this._feedbackCache = { key, value };
    return value;
  }

  // ---------- Eventos ----------

  /** Boot: pasa de "loading" a "home". */
  start() { return this.dispatch('READY'); }

  /**
   * Aplica un evento. Devuelve true si se aceptó.
   * Un evento que no corresponde al estado actual se rechaza y se emite "rejected".
   */
  dispatch(type, payload) {
    if (this._disposed) return false;

    if (type === 'RESET') return this._reset();
    if (type === 'VISIBILITY_HIDDEN') {
      return this.state === S.PRESENTING ? this._apply('PAUSE', undefined, 'Pausa automática: la pestaña quedó en segundo plano.') : false;
    }

    return this._apply(type, payload);
  }

  _apply(type, payload, noticeText) {
    // Casos con efecto sobre la captura que no son solo "datos".
    if (this.state === S.REVIEW && (type === 'SET_TRANSCRIPT' || type === 'LOAD_DEMO')) {
      return this._applyTranscriptEvent(type, payload);
    }

    const rule = FLOW[this.state]?.[type];
    if (!rule) {
      this.emit('rejected', { event: type, state: this.state, reason: 'not-allowed-here' });
      return false;
    }
    if (rule.guard && !rule.guard(this.data, payload)) {
      this.emit('rejected', { event: type, state: this.state, reason: 'guard' });
      return false;
    }

    const prev = this.state;
    const target = typeof rule.to === 'function' ? rule.to(this.data, payload) : rule.to;
    const next = target || prev;
    const changes = next !== prev;

    if (changes) {
      this.data.notice = null;
      this._onExit(prev, next);
    }
    rule.run?.(this.data, payload);
    if (noticeText) this.data.notice = { kind: 'info', text: noticeText };
    this.state = next;
    if (changes) this._onEnter(next, prev);

    this.emit('change', { state: this.state, prev, event: type, changed: changes });
    if (changes) this.emit('state', { state: this.state, prev, event: type });
    return true;
  }

  _applyTranscriptEvent(type, payload) {
    const c = this.capture;
    if (type === 'LOAD_DEMO') {
      c.override = DEMO_TRANSCRIPT;
      c.overrideSource = SOURCES.DEMO;
    } else {
      const text = String(payload?.text ?? '');
      const recognized = c.finals.join(' ').replace(/\s+/g, ' ').trim();
      c.override = text;
      if (recognized && text.trim() === recognized) {
        c.override = null; // sin cambios: sigue siendo reconocimiento puro
      } else {
        c.overrideSource = recognized ? SOURCES.SPEECH_EDITED : SOURCES.TYPED;
      }
    }
    this._feedbackCache = null;
    this.emit('change', { state: this.state, prev: this.state, event: type, changed: false });
    return true;
  }

  /** Reinicio limpio a la pantalla de inicio. No se permite durante una sesión activa. */
  _reset() {
    if (this.isActive) {
      this.emit('rejected', { event: 'RESET', state: this.state, reason: 'active-session' });
      return false;
    }
    const prev = this.state;
    this._onExit(prev, S.HOME);
    this._teardownMedia();
    const keep = { capabilities: this.data.capabilities, tutorialSeen: this.data.tutorialSeen };
    this.data = createInitialData(keep);
    this.capture = freshCapture();
    this._feedbackCache = null;
    this.state = S.HOME;
    this.emit('change', { state: this.state, prev, event: 'RESET', changed: true });
    this.emit('state', { state: this.state, prev, event: 'RESET' });
    return true;
  }

  // ---------- Entradas y salidas de estado (efectos) ----------

  _onExit(state, next) {
    if (state === S.PREP) this._stopPrepCountdown();
    if (state === S.STARTING && next !== S.PRESENTING) {
      this._voiceAttempt += 1; // invalida resultados pendientes
      if (this._voiceTouched) {
        this.voice?.abort?.();
        this._voiceTouched = false;
      }
    }
  }

  _onEnter(state, prev) {
    switch (state) {
      case S.PREP:
        this._resetCapture();
        this._startPrepCountdown();
        break;

      case S.STARTING:
        this._startVoice();
        break;

      case S.PRESENTING:
        if (prev === S.PAUSED || prev === S.CONFIRM_CANCEL) this._resumeActive();
        else this._beginPresentation();
        break;

      case S.PAUSED:
      case S.CONFIRM_CANCEL:
        this._pauseActive();
        break;

      case S.REVIEW:
      case S.FEEDBACK:
        if (prev === S.PRESENTING || prev === S.PAUSED) this._finishCapture();
        if (state === S.FEEDBACK) this.capture.closed = true;
        break;

      case S.BRIEF:
        if (prev === S.CONFIRM_CANCEL) {
          this._cancelActiveSession();
        } else {
          this._resetCapture();
        }
        break;

      case S.SELECT:
      case S.HOME:
        this._resetCapture();
        break;

      default:
        break;
    }
    if (state !== S.PREP && state !== S.PRESENTING) this._stopTickerIfIdle();
  }

  // ---------- Captura ----------

  _resetCapture() {
    this._teardownMedia();
    this.capture = freshCapture();
    this._lastWarning = null;
    this._feedbackCache = null;
  }

  _beginPresentation() {
    this.capture = freshCapture();
    this._lastWarning = null;
    this._feedbackCache = null;
    this.capture.segmentStart = this.clock.now();
    this._ensureTicker();
    if (this.data.options.inputMode === 'voice' && this.data.options.measureAudio && this.meter) {
      this._meterTouched = true;
      this.meter.start().then(
        () => { if (this.state === S.PRESENTING) this.meter.setActive(true); },
        () => this.emit('notice', { kind: 'warn', text: 'No se pudo medir el nivel de audio. La práctica sigue sin esa medición.' }),
      );
    }
  }

  _resumeActive() {
    this.capture.segmentStart = this.clock.now();
    this._ensureTicker();
    this.meter?.setActive?.(true);
    if (this.data.options.inputMode === 'voice' && this.voice && !this.capture.voiceLost) {
      Promise.resolve(this.voice.resume()).catch(() => this._markVoiceLost('No se pudo retomar el reconocimiento.'));
    }
  }

  _pauseActive() {
    const c = this.capture;
    if (c.segmentStart != null) {
      c.activeMs += this.clock.now() - c.segmentStart;
      c.segmentStart = null;
    }
    this.meter?.setActive?.(false);
    if (this.data.options.inputMode === 'voice') this.voice?.pause?.();
    this._stopTickerIfIdle();
  }

  _finishCapture() {
    this._pauseActive();
    if (this.data.options.inputMode === 'voice') {
      Promise.resolve(this.voice?.stop?.()).catch(() => {});
    }
    if (this.meter && this._meterTouched) {
      const result = this.meter.stop?.();
      this.capture.audio = result && result.measured ? result : null;
      this._meterTouched = false;
    }
    this.capture.interim = '';
    this._stopTickerIfIdle();
  }

  _cancelActiveSession() {
    this._pauseActive();
    this._teardownMedia();
    this.capture = freshCapture();
    this._feedbackCache = null;
    this._stopTickerIfIdle();
  }

  /** Libera micrófono, reconocimiento y medidor. Es seguro llamarlo varias veces. */
  _teardownMedia() {
    this._voiceAttempt += 1;
    if (this._voiceTouched) {
      try { this.voice?.abort?.(); } catch { /* ya liberado */ }
      this._voiceTouched = false;
    }
    if (this._meterTouched) {
      try { this.meter?.dispose?.(); } catch { /* ya liberado */ }
      this._meterTouched = false;
    }
  }

  // ---------- Voz ----------

  _startVoice() {
    const attempt = ++this._voiceAttempt;
    if (!this.voice || !this.data.capabilities.speech) {
      queueMicrotask(() => {
        if (attempt === this._voiceAttempt && this.state === S.STARTING) {
          this.dispatch('MIC_FAILED', { code: 'unsupported', message: 'Este navegador no ofrece reconocimiento de voz.' });
        }
      });
      return;
    }
    // Se llama de forma síncrona: conserva el gesto de la persona (necesario para el permiso)
    // y evita que una cancelación posterior deje una escucha iniciada.
    let pending;
    try {
      this._voiceTouched = true;
      pending = Promise.resolve(this.voice.start());
    } catch (error) {
      pending = Promise.reject(error);
    }
    pending
      .then(
        () => {
          if (attempt !== this._voiceAttempt || this.state !== S.STARTING) return;
          this.dispatch('MIC_READY');
        },
        (error) => {
          if (attempt !== this._voiceAttempt || this.state !== S.STARTING) return;
          this.dispatch('MIC_FAILED', { code: error?.code || 'unknown', message: error?.message || '' });
        },
      );
  }

  /** Frase final del reconocimiento. Se acepta mientras se presenta o enseguida después (cierre). */
  pushFinal(text) {
    const c = this.capture;
    const clean = String(text || '').trim();
    if (!clean || c.closed) return;
    if (![S.PRESENTING, S.PAUSED, S.CONFIRM_CANCEL, S.REVIEW].includes(this.state)) return;
    c.finals.push(clean);
    c.interim = '';
    this._feedbackCache = null;
    this.emit('transcript', { final: clean });
  }

  pushInterim(text) {
    if (this.state !== S.PRESENTING) return;
    this.capture.interim = String(text || '');
    this.emit('transcript', { interim: this.capture.interim });
  }

  /** El reconocimiento se cortó y no pudo reiniciarse. La presentación continúa solo con cronómetro. */
  _markVoiceLost(message) {
    if (this.capture.voiceLost) return;
    this.capture.voiceLost = true;
    this.emit('notice', { kind: 'warn', text: message || 'Se perdió el reconocimiento de voz. Seguís practicando con el temporizador.' });
    this.emit('change', { state: this.state, prev: this.state, event: 'VOICE_LOST', changed: false });
  }

  notifyVoiceLost(message) {
    if (this.state === S.PRESENTING || this.state === S.PAUSED) this._markVoiceLost(message);
  }

  // ---------- Temporizadores ----------

  _startPrepCountdown() {
    const sec = this.data.options.prepSec;
    this._prepEndsAt = sec > 0 ? this.clock.now() + sec * 1000 : null;
    if (sec > 0) this._ensureTicker();
  }

  _stopPrepCountdown() {
    this._prepEndsAt = null;
  }

  /** Reinicia la cuenta de preparación (por ejemplo, tras cambiar el tiempo). */
  restartPrepCountdown() {
    if (this.state !== S.PREP) return;
    this._startPrepCountdown();
    this.emit('tick', this.getTimeView());
  }

  _ensureTicker() {
    if (this._ticker != null) return;
    this._ticker = this.clock.setInterval(() => this._tick(), 200);
  }

  _stopTickerIfIdle() {
    const needed =
      (this.state === S.PRESENTING) ||
      (this.state === S.PREP && this._prepEndsAt != null && this.getTimeView().prepRemainingSec > 0);
    if (!needed && this._ticker != null) {
      this.clock.clearInterval(this._ticker);
      this._ticker = null;
    }
  }

  get hasTicker() { return this._ticker != null; }

  _tick() {
    if (this._disposed) return;
    const view = this.getTimeView();
    this.emit('tick', view);

    if (this.state === S.PRESENTING) {
      if (view.warning !== this._lastWarning) {
        this._lastWarning = view.warning;
        if (view.warning === 'warning' || view.warning === 'final') this.emit('warning', { level: view.warning, view });
      }
      if (view.totalSec != null && view.remainingSec <= 0) this.dispatch('TIME_UP');
    } else if (this.state === S.PREP) {
      if (view.prepDone) this._stopTickerIfIdle();
    }
  }

  // ---------- Cierre ----------

  dispose() {
    if (this._disposed) return;
    if (this._ticker != null) {
      this.clock.clearInterval(this._ticker);
      this._ticker = null;
    }
    this._teardownMedia();
    this._disposed = true;
  }
}
