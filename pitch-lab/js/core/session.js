// Sesión: aplica la tabla de estados (state-machine.js) y se ocupa de los efectos:
// cronómetro, cuenta regresiva de preparación, voz, medición de audio y devolución.
//
// Reglas de diseño:
//  - Un solo temporizador (setInterval) a la vez. Se crea y se destruye en un único lugar.
//  - El tiempo se calcula con marcas de reloj (now), no sumando ticks: es exacto aunque el
//    navegador demore los intervalos.
//  - Los resultados asíncronos de la voz se ignoran si la sesión ya cambió de estado.
//  - Cancelar o salir libera voz, audio, cámara y descarta lo grabado.
//  - El análisis con IA es OPCIONAL y corre en segundo plano: no bloquea el recorrido ni puede romperlo.

import { Emitter } from './emitter.js';
import { APP_CONFIG, DEMO_TRANSCRIPT } from '../config/app-config.js';
import { getScenario } from '../config/scenarios.js';
import { BRIEFS, FREE_BRIEF } from '../config/briefs.js';
import { FLOW, S, ACTIVE_STATES, createInitialData, usesSpeech } from './state-machine.js';
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
    gestures: null,       // resumen de gestos medido en el dispositivo (si se activó la cámara)
    aiResult: null,       // { analysis, model, usage } cuando la IA terminó
    closed: false,        // ya no acepta frases nuevas del reconocimiento
  };
}

export class Session extends Emitter {
  /**
   * @param {object} deps
   * @param {object} deps.clock      { now, setInterval, clearInterval }
   * @param {object} deps.voice      reconocimiento de voz (opcional): start, pause, resume, stop, abort
   * @param {object} deps.meter      medidor de audio (opcional): start, setActive, stop, dispose
   * @param {object} deps.ai         análisis con IA (opcional): startAudio, startCamera, beginTracking, pause, resume,
   *                                 finishCapture, analyze, abort
   * @param {object} deps.capabilities { speech: boolean }
   * @param {boolean} deps.tutorialSeen
   */
  constructor({ clock = realClock, voice = null, meter = null, ai = null, capabilities = {}, tutorialSeen = false, briefStart = 0, config = APP_CONFIG } = {}) {
    super();
    this.clock = clock;
    this.voice = voice;
    this.meter = meter;
    this.ai = ai;
    this.config = config;
    this.state = S.LOADING;
    this._briefStart = briefStart;  // brief con el que arranca la experiencia (la app lo sortea)
    this.data = createInitialData({ capabilities, tutorialSeen, briefIndex: briefStart });
    this.capture = freshCapture();
    this._ticker = null;
    this._prepEndsAt = null;
    this._voiceAttempt = 0;
    this._lastWarning = null;
    this._feedbackCache = null;
    this._voiceTouched = false;   // ¿se inició el reconocimiento? (para liberar solo lo necesario)
    this._meterTouched = false;   // ¿se inició el medidor de audio?
    this._aiAudioActive = false;  // ¿se está grabando audio para la IA?
    this._aiCameraActive = false; // ¿está activa la cámara?
    this._aiAttempt = 0;          // invalida resultados tardíos de la IA
    this._aiAbort = null;
    this._aiPayload = null;       // grabación en memoria para poder reintentar el análisis
    this._prepSavedMs = null;
    this._disposed = false;
  }

  // ---------- Lectura ----------

  get scenario() { return getScenario(this.data.scenarioId); }
  get brief() { return this.data.freePitch ? FREE_BRIEF : BRIEFS[this.data.briefIndex % BRIEFS.length]; }
  /** ¿Es un pitch libre (sin brief)? */
  get isFreePitch() { return !!this.data.freePitch; }
  get isActive() { return ACTIVE_STATES.includes(this.state); }
  /** ¿Se está grabando audio para la IA ahora? */
  get aiRecording() { return this._aiAudioActive; }
  /** ¿Está activa la cámara ahora? */
  get cameraOn() { return this._aiCameraActive; }
  /** ¿Se puede reintentar el análisis con la grabación que sigue en memoria? */
  get canRetryAi() { return this.data.ai.status === 'error' && !!this._aiPayload?.audio; }

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
    // Sin reconocimiento del navegador (por ejemplo, en un casco), la transcripción puede venir de la IA.
    const ai = c.aiResult?.analysis;
    if (!recognized && ai && ai.audible && ai.transcript && !usesSpeech(this.data)) {
      return { text: ai.transcript, source: SOURCES.AI, recognized: '', interim: '' };
    }
    return { text: recognized, source: recognized ? SOURCES.SPEECH : SOURCES.NONE, recognized, interim: c.interim };
  }

  /** Devolución calculada con los datos reales de la captura. */
  getFeedback() {
    const t = this.getTranscript();
    const key = JSON.stringify([t.text, t.source, this.capture.activeMs, this.capture.audio, this.data.rubric, this.totalSec, this.data.ai, this.capture.gestures, this.capture.aiResult?.model, this.isFreePitch]);
    if (this._feedbackCache?.key === key) return this._feedbackCache.value;
    const value = buildFeedback(
      {
        text: t.text, source: t.source, activeMs: this.capture.activeMs, audio: this.capture.audio,
        gestures: this.capture.gestures,
        ai: { status: this.data.ai.status, error: this.data.ai.error, result: this.capture.aiResult },
      },
      { targetSec: this.totalSec, rubric: this.data.rubric, free: this.isFreePitch },
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
    if (type === 'AI_RETRY' && (this.state === S.REVIEW || this.state === S.FEEDBACK)) {
      return this._applyAiRetry();
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
    const keep = { capabilities: this.data.capabilities, tutorialSeen: this.data.tutorialSeen, briefIndex: this._briefStart };
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
    if (state === S.PREP) {
      // Al abrir «IA y cámara» se conserva el tiempo de preparación que quedaba.
      this._prepSavedMs = next === S.AI_SETUP && this._prepEndsAt != null ? Math.max(0, this._prepEndsAt - this.clock.now()) : null;
      this._stopPrepCountdown();
    }
    if (state === S.STARTING && next !== S.PRESENTING) {
      this._voiceAttempt += 1; // invalida resultados pendientes
      if (this._voiceTouched) {
        this.voice?.abort?.();
        this._voiceTouched = false;
      }
      this._abortAiCapture();
    }
  }

  _onEnter(state, prev) {
    switch (state) {
      case S.PREP:
        if (prev === S.AI_SETUP) {
          // Volvió de «IA y cámara»: no se reinicia nada, sigue la cuenta donde quedó.
          if (this._prepSavedMs != null && this._prepSavedMs > 0) {
            this._prepEndsAt = this.clock.now() + this._prepSavedMs;
            this._ensureTicker();
          }
          this._prepSavedMs = null;
        } else {
          this._resetCapture();
          this._startPrepCountdown();
        }
        break;

      case S.STARTING:
        this._startCapture();
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
    if (this._aiAudioActive || this._aiCameraActive) this.ai?.beginTracking?.();
  }

  _resumeActive() {
    this.capture.segmentStart = this.clock.now();
    this._ensureTicker();
    this.meter?.setActive?.(true);
    if (usesSpeech(this.data) && this.voice && this._voiceTouched && !this.capture.voiceLost) {
      Promise.resolve(this.voice.resume()).catch(() => this._markVoiceLost('No se pudo retomar el reconocimiento.'));
    }
    if (this._aiAudioActive || this._aiCameraActive) this.ai?.resume?.();
  }

  _pauseActive() {
    const c = this.capture;
    if (c.segmentStart != null) {
      c.activeMs += this.clock.now() - c.segmentStart;
      c.segmentStart = null;
    }
    this.meter?.setActive?.(false);
    if (usesSpeech(this.data) && this._voiceTouched) this.voice?.pause?.();
    if (this._aiAudioActive || this._aiCameraActive) this.ai?.pause?.();
    this._stopTickerIfIdle();
  }

  _finishCapture() {
    this._pauseActive();
    if (usesSpeech(this.data) && this._voiceTouched) {
      Promise.resolve(this.voice?.stop?.()).catch(() => {});
    }
    this._finishAi();
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
    this._abortAiCapture();
    this._aiAttempt += 1;               // descarta cualquier análisis en curso
    try { this._aiAbort?.abort(); } catch { /* sin efecto */ }
    this._aiAbort = null;
    this._aiPayload = null;             // la grabación se borra de la memoria
    if (this.data.ai.status !== 'off') this.data.ai = { status: 'off', error: null, model: null };
  }

  // ---------- Voz y captura para la IA ----------

  _usesRecording() {
    const d = this.data;
    return d.options.inputMode === 'voice' && d.options.aiAnalysis && d.capabilities.ai && !!this.ai;
  }

  _usesCamera() {
    const d = this.data;
    return d.options.gestures && d.capabilities.camera && !!this.ai;
  }

  /**
   * Pide los permisos que hagan falta (micrófono para el reconocimiento y/o la grabación, cámara) y arranca.
   * Todo se inicia de forma SÍNCRONA dentro del gesto de la persona (necesario para los permisos) y los
   * resultados tardíos se ignoran si la sesión ya cambió de estado.
   *  - Falla el micrófono (todas las vías) -> pantalla de recuperación.
   *  - Falla solo la cámara o solo la grabación para la IA -> se sigue sin eso y se avisa.
   */
  _startCapture() {
    const attempt = ++this._voiceAttempt;
    const d = this.data;
    const wantsSpeech = usesSpeech(d) && !!this.voice;
    const wantsRecording = this._usesRecording();
    const wantsCamera = this._usesCamera();

    if (d.options.inputMode === 'voice' && !wantsSpeech && !wantsRecording) {
      queueMicrotask(() => {
        if (attempt === this._voiceAttempt && this.state === S.STARTING) {
          this.dispatch('MIC_FAILED', { code: 'unsupported', message: 'Este navegador no ofrece reconocimiento de voz.' });
        }
      });
      return;
    }

    const run = (fn) => {
      try { return Promise.resolve(fn()); } catch (error) { return Promise.reject(error); }
    };
    const micTasks = [];
    if (wantsSpeech) { this._voiceTouched = true; micTasks.push({ kind: 'speech', promise: run(() => this.voice.start()) }); }
    if (wantsRecording) { this._aiAudioActive = true; micTasks.push({ kind: 'audio', promise: run(() => this.ai.startAudio()) }); }
    let camera = null;
    if (wantsCamera) { this._aiCameraActive = true; camera = run(() => this.ai.startCamera()); }

    const settle = (promise) => promise.then(() => ({ ok: true }), (error) => ({ ok: false, error }));
    Promise.all([Promise.all(micTasks.map((t) => settle(t.promise))), camera ? settle(camera) : Promise.resolve({ ok: true, skipped: true })]).then(([mic, cam]) => {
      if (attempt !== this._voiceAttempt || this.state !== S.STARTING) return;

      if (micTasks.length > 0 && mic.every((r) => !r.ok)) {
        const error = mic[0].error;
        this.dispatch('MIC_FAILED', { code: error?.code || 'unknown', message: error?.message || '' });
        return;
      }
      const notes = [];
      micTasks.forEach((task, i) => {
        if (mic[i].ok) return;
        if (task.kind === 'audio') {
          this._aiAudioActive = false;
          this.data.options.aiAnalysis = false;
          notes.push('No se pudo grabar el audio para la IA: seguís sin análisis con IA.');
        } else {
          this._voiceTouched = false;
          notes.push('No se pudo usar el reconocimiento de voz del navegador: la IA analiza el audio igual.');
        }
      });
      if (!cam.ok) {
        this._aiCameraActive = false;
        this.data.options.gestures = false;
        notes.push('No se pudo usar la cámara: seguís sin análisis de gestos.');
      }
      if (notes.length) this.emit('notice', { kind: 'warn', text: notes.join(' ') });
      this.dispatch('MIC_READY');
    });
  }

  /** Libera lo que se hubiera iniciado de la IA (grabación y cámara) sin analizar nada. */
  _abortAiCapture() {
    if (this._aiAudioActive || this._aiCameraActive) {
      try { this.ai?.abort?.(); } catch { /* ya liberado */ }
    }
    this._aiAudioActive = false;
    this._aiCameraActive = false;
  }

  /** Al terminar la presentación: cierra la captura y lanza el análisis en segundo plano. */
  _finishAi() {
    const wantsAudio = this._aiAudioActive;
    const wantsCamera = this._aiCameraActive;
    if (!wantsAudio && !wantsCamera) return;
    this._aiAudioActive = false;
    this._aiCameraActive = false;
    const attempt = ++this._aiAttempt;
    const durationSec = this.capture.activeMs / 1000;
    if (wantsAudio) this.data.ai = { status: 'analyzing', error: null, model: null };

    Promise.resolve(this.ai.finishCapture())
      .then((cap) => {
        if (attempt !== this._aiAttempt) return undefined;
        this.capture.gestures = cap?.gestures || null;
        this._feedbackCache = null;
        if (!wantsAudio) { this._emitAi(); return undefined; }
        if (!cap?.audio) throw Object.assign(new Error('No quedó audio grabado.'), { code: 'no-audio' });
        this._aiPayload = { audio: cap.audio, gestures: this.capture.gestures, durationSec };
        return this._runAnalysis(attempt);
      })
      .catch((error) => {
        if (attempt !== this._aiAttempt) return;
        this._setAiError(error);
      });
  }

  _runAnalysis(attempt) {
    const payload = this._aiPayload;
    if (!payload) return Promise.resolve();
    this.data.ai = { status: 'analyzing', error: null, model: null };
    this._emitAi();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    this._aiAbort = controller;
    return Promise.resolve(this.ai.analyze({
      audio: payload.audio,
      signal: controller?.signal,
      context: {
        brief: this.brief,
        scenario: this.scenario,
        durationSec: payload.durationSec,
        targetSec: this.totalSec,
        gestures: payload.gestures,
      },
    })).then(
      (result) => {
        if (attempt !== this._aiAttempt) return;
        this.capture.aiResult = result;
        this._aiPayload = null; // ya no hace falta conservar la grabación
        this.data.ai = { status: 'done', error: null, model: result.model || null };
        this._feedbackCache = null;
        this._emitAi();
      },
      (error) => {
        if (attempt !== this._aiAttempt || error?.code === 'aborted') return;
        this._setAiError(error);
      },
    );
  }

  _setAiError(error) {
    this.data.ai = { status: 'error', error: { code: error?.code || 'unknown', message: error?.message || 'No se pudo completar el análisis con IA.' }, model: null };
    this._feedbackCache = null;
    this._emitAi();
  }

  _emitAi() {
    this.emit('change', { state: this.state, prev: this.state, event: 'AI_UPDATE', changed: false });
  }

  _applyAiRetry() {
    if (this.data.ai.status !== 'error' || !this._aiPayload?.audio) {
      this.emit('rejected', { event: 'AI_RETRY', state: this.state, reason: 'nothing-to-retry' });
      return false;
    }
    this._runAnalysis(this._aiAttempt);
    return true;
  }

  /** Actualiza capacidades que cambian con el tiempo (por ejemplo, cuando la persona carga su clave). */
  setCapabilities(patch) {
    Object.assign(this.data.capabilities, patch);
    if (!this.data.capabilities.ai && this.data.options.aiAnalysis) {
      this.data.options.aiAnalysis = false;
      if (!this.data.capabilities.speech) this.data.options.inputMode = 'timer';
    }
    if (!this.data.capabilities.camera) this.data.options.gestures = false;
    this.emit('change', { state: this.state, prev: this.state, event: 'CAPABILITIES', changed: false });
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
