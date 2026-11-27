// Guarda la clave de la API de Gemini de la persona, SOLO en su navegador.
//
//  - Por defecto vive en sessionStorage: se borra al cerrar la pestaña.
//  - Con «Recordar en este dispositivo» se guarda en localStorage (opcional y avisado).
//  - La clave NUNCA se escribe en el código, en el repositorio, en la consola ni en mensajes de error.
//  - Se envía únicamente a generativelanguage.googleapis.com (ver gemini-client.js).

import { Emitter } from '../core/emitter.js';

const KEY = 'publiton-pitch-lab.clave-ia.v1';

export class AiKeyStore extends Emitter {
  constructor({ session = null, local = null } = {}) {
    super();
    this.session = session;
    this.local = local;
    this._key = '';
    this._remembered = false;
    this._load();
  }

  _read(storage) {
    try { return storage?.getItem(KEY) || ''; } catch { return ''; }
  }

  _load() {
    const fromLocal = this._read(this.local);
    const fromSession = this._read(this.session);
    if (fromSession) { this._key = fromSession; this._remembered = false; }
    else if (fromLocal) { this._key = fromLocal; this._remembered = true; }
  }

  /** La clave está en el servidor (modo `start:ia`): el navegador usa un marcador en memoria y nunca ve la clave real. */
  useServerKey() {
    this._key = `AIza${'s'.repeat(35)}`;
    this._server = true;
    this._remembered = false;
    this.emit('change', { hasKey: true });
  }

  get serverKey() { return !!this._server; }
  get hasKey() { return this._key.length > 0; }
  get remembered() { return this._remembered; }
  get value() { return this._key; }

  /** Últimos 4 caracteres, para mostrar «…ab12» sin revelar la clave. */
  get masked() { return this._server ? 'del servidor' : this._key ? `…${this._key.slice(-4)}` : ''; }

  /** Valida el formato básico (no garantiza que la API la acepte). */
  static looksValid(candidate) {
    return /^AIza[0-9A-Za-z_-]{30,60}$/.test(String(candidate || '').trim());
  }

  set(candidate, { remember = false } = {}) {
    const clean = String(candidate || '').trim();
    if (!AiKeyStore.looksValid(clean)) return false;
    this._key = clean;
    this._remembered = !!remember;
    try {
      if (remember) { this.local?.setItem(KEY, clean); this.session?.removeItem(KEY); }
      else { this.session?.setItem(KEY, clean); this.local?.removeItem(KEY); }
    } catch {
      /* sin almacenamiento: la clave queda solo en memoria hasta cerrar la pestaña */
    }
    this.emit('change', { hasKey: true });
    return true;
  }

  clear() {
    this._key = '';
    this._remembered = false;
    try { this.session?.removeItem(KEY); this.local?.removeItem(KEY); } catch { /* nada que borrar */ }
    this.emit('change', { hasKey: false });
  }
}
