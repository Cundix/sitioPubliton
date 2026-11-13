// Cliente de la API de Gemini (generateContent) para analizar el audio de una presentación.
// Funciona en el navegador y en Node (se puede inyectar `fetchImpl` para pruebas).
//
// Detalles verificados con la documentación oficial y con llamadas reales (ver docs/analisis-con-ia.md):
//  - Se usa generateContent porque admite CORS desde el navegador con la cabecera x-goog-api-key.
//    (El endpoint /interactions pide una cabecera Api-Revision que el navegador no puede enviar por CORS.)
//  - Cada modelo tiene su propia cuota: ante 429/503 se prueba el siguiente modelo de la lista.
//  - La clave la aporta la persona (no está en el código). Se envía solo a generativelanguage.googleapis.com.

import { APP_CONFIG } from '../config/app-config.js';
import { SYSTEM_INSTRUCTION, RESPONSE_SCHEMA, buildUserText, normalizeAnalysis } from './analysis-prompt.js';

export const AI_ERRORS = {
  'no-key': 'Falta la clave de la API de Gemini.',
  'invalid-key': 'La API rechazó la clave. Revisá que esté bien copiada y habilitada.',
  quota: 'Se alcanzó el límite de uso de la clave (cuota o pedidos por minuto). Esperá un rato o probá con otra clave.',
  'model-unavailable': 'El modelo de IA no está disponible para esta clave.',
  blocked: 'La IA no pudo analizar este audio (contenido bloqueado por sus filtros).',
  network: 'No se pudo conectar con la API de Gemini. Revisá tu conexión.',
  timeout: 'La IA tardó demasiado en responder.',
  'too-large': 'La grabación es demasiado grande para enviarla.',
  'bad-response': 'La IA devolvió una respuesta que no se pudo leer.',
  aborted: 'Se canceló el análisis.',
  server: 'El servicio de IA tuvo un problema. Probá de nuevo en un momento.',
  unknown: 'No se pudo completar el análisis con IA.',
};

export class AiError extends Error {
  constructor(code, detail) {
    super(AI_ERRORS[code] || AI_ERRORS.unknown);
    this.code = code;
    this.detail = detail;
  }
}

/** Texto seguro para mostrar: nunca incluye la clave. */
export function redact(text, apiKey) {
  let out = String(text ?? '');
  if (apiKey) out = out.split(apiKey).join('«clave»');
  return out.replace(/AIza[0-9A-Za-z_-]{20,}/g, '«clave»');
}

function classify(status, body) {
  const message = String(body?.error?.message || '');
  const state = String(body?.error?.status || '');
  if (status === 400 && /api key not valid|api_key_invalid/i.test(message + state)) return 'invalid-key';
  if (status === 400 && /size|too large|exceeds/i.test(message)) return 'too-large';
  if (status === 401 || status === 403) return 'invalid-key';
  if (status === 404) return 'model-unavailable';
  if (status === 413) return 'too-large';
  if (status === 429) return 'quota';
  if (status >= 500) return 'server';
  return 'unknown';
}

export class GeminiClient {
  /**
   * @param {object} opts
   * @param {string} opts.apiKey
   * @param {Function} [opts.fetchImpl]
   * @param {object} [opts.config]  APP_CONFIG.ai
   */
  constructor({ apiKey, fetchImpl, config = APP_CONFIG.ai } = {}) {
    this.apiKey = apiKey || '';
    this.config = config;
    this.fetch = fetchImpl || ((...args) => globalThis.fetch(...args));
  }

  _headers(json = true) {
    const headers = { 'x-goog-api-key': this.apiKey };
    if (json) headers['content-type'] = 'application/json';
    return headers;
  }

  /** Comprueba la clave con una consulta barata (no gasta cuota de generación). */
  async testKey({ signal } = {}) {
    if (!this.apiKey) throw new AiError('no-key');
    const model = this.config.models[0];
    let res;
    try {
      res = await this.fetch(`${this.config.endpoint}/models/${model}`, { headers: this._headers(false), signal });
    } catch (error) {
      throw new AiError(error?.name === 'AbortError' ? 'aborted' : 'network');
    }
    if (res.ok) return { ok: true, model };
    let body = null;
    try { body = await res.json(); } catch { /* sin cuerpo */ }
    throw new AiError(classify(res.status, body), redact(body?.error?.message, this.apiKey));
  }

  /**
   * Analiza una presentación.
   * @param {object} input
   * @param {string} input.audioBase64  WAV mono en base64
   * @param {string} [input.mimeType]
   * @param {object} input.context      { brief, scenario, durationSec, targetSec, gestures }
   * @param {AbortSignal} [input.signal]
   * @param {Function} [input.onModel]  se llama con el nombre del modelo que se intenta
   * @returns {Promise<{analysis: object, model: string, usage: object|null, attempts: Array<{model: string, code: string}>}>}
   */
  async analyze({ audioBase64, mimeType = 'audio/wav', context, signal, onModel }) {
    if (!this.apiKey) throw new AiError('no-key');
    const approxMB = (audioBase64.length * 3) / 4 / 1048576;
    if (approxMB > this.config.maxRequestMB) throw new AiError('too-large');

    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{
        role: 'user',
        parts: [
          { text: buildUserText(context) },
          { inlineData: { mimeType, data: audioBase64 } },
        ],
      }],
      generationConfig: {
        temperature: this.config.temperature,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    };
    const payload = JSON.stringify(body);

    let lastError = null;
    const attempts = []; // modelos que fallaron antes de lograr una respuesta (para informarlo con transparencia)
    for (const model of this.config.models) {
      onModel?.(model);
      try {
        return { ...(await this._callOnce(model, payload, signal)), attempts };
      } catch (error) {
        lastError = error;
        attempts.push({ model, code: error.code });
        // Solo se prueba el siguiente modelo si el problema es de cuota, de disponibilidad o del servicio.
        const retryable = ['quota', 'model-unavailable', 'server', 'timeout'].includes(error.code);
        if (!retryable || error.code === 'aborted') throw error;
      }
    }
    throw lastError || new AiError('unknown');
  }

  async _callOnce(model, payload, externalSignal) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.config.timeoutMs);
    const onAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onAbort);
    try {
      let res;
      try {
        res = await this.fetch(`${this.config.endpoint}/models/${model}:generateContent`, {
          method: 'POST',
          headers: this._headers(true),
          body: payload,
          signal: controller.signal,
        });
      } catch (error) {
        if (timedOut) throw new AiError('timeout');
        if (error?.name === 'AbortError' || externalSignal?.aborted) throw new AiError('aborted');
        throw new AiError('network');
      }
      let json = null;
      try { json = await res.json(); } catch { /* cuerpo vacío o no JSON */ }
      if (!res.ok) throw new AiError(classify(res.status, json), redact(json?.error?.message, this.apiKey));

      const candidate = json?.candidates?.[0];
      if (!candidate) {
        const reason = json?.promptFeedback?.blockReason;
        throw new AiError(reason ? 'blocked' : 'bad-response', reason);
      }
      if (['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'].includes(candidate.finishReason)) {
        throw new AiError('blocked', candidate.finishReason);
      }
      const text = (candidate.content?.parts || []).filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('');
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new AiError('bad-response', candidate.finishReason);
      }
      let analysis;
      try {
        analysis = normalizeAnalysis(parsed);
      } catch (error) {
        throw new AiError('bad-response', error.message);
      }
      return { analysis, model, usage: json.usageMetadata || null };
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onAbort);
    }
  }
}
