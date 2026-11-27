// Panel «Análisis con IA y cámara» del panel de texto: carga/prueba/borrado de la clave y vista previa de la cámara.
// La clave se escribe SOLO acá (no se puede escribir dentro de un casco VR).

import { AI_ERRORS, redact } from '../ai/gemini-client.js';
import { AiKeyStore } from '../ai/key-store.js';
import { S } from '../core/state-machine.js';

const $ = (id) => document.getElementById(id);

export class AiSettingsUI {
  constructor({ keyStore, service, session, overlay, onNotice }) {
    this.keyStore = keyStore;
    this.service = service;
    this.session = session;
    this.overlay = overlay;
    this.onNotice = onNotice;
    this.details = $('ai-settings');
    this.input = $('ai-key');
    this.remember = $('ai-remember');
    this.status = $('ai-key-status');
    this.camStatus = $('cam-status');
    this.camBtn = $('cam-test');
    this.float = $('cam-float');
    this.busy = false;

    $('ai-save').addEventListener('click', () => this.save());
    $('ai-test').addEventListener('click', () => this.testKey());
    $('ai-clear').addEventListener('click', () => this.clear());
    this.camBtn.addEventListener('click', () => this.toggleCamera());
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.save(); } });

    this.remember.checked = keyStore.remembered;
    keyStore.on('change', () => { this.syncCapabilities(); this.renderKeyState(); });
    session.on('change', () => this.syncFloat());
    session.on('state', ({ state }) => {
      const keepsCamera = [S.AI_SETUP, S.PREP, S.STARTING, S.PRESENTING, S.PAUSED, S.CONFIRM_CANCEL].includes(state);
      if (!keepsCamera && this.service.previewing && !session.cameraOn) this.stopPreview();
    });
    this.syncCapabilities();
    this.renderKeyState();
    this.renderCameraSupport();
  }

  /** Capacidades de la sesión según el navegador y si hay clave. */
  syncCapabilities() {
    const { recorder, camera } = this.service.support;
    this.session.setCapabilities({ ai: this.keyStore.hasKey && recorder, camera });
  }

  renderKeyState() {
    const { recorder } = this.service.support;
    if (!recorder) this.setStatus('Este navegador no puede grabar audio: el análisis con IA no está disponible.', 'bad');
    else if (this.keyStore.serverKey) this.setStatus('IA lista: ya viene incluida, no hace falta cargar nada.', 'ok');
    else if (this.keyStore.hasKey) this.setStatus(`Clave cargada (${this.keyStore.masked}${this.keyStore.remembered ? ', recordada en este dispositivo' : ', solo en esta pestaña'}).`, 'ok');
    else this.setStatus('Todavía no cargaste una clave.', '');
    this.input.value = '';
  }

  renderCameraSupport() {
    if (!this.service.support.camera) {
      this.camBtn.disabled = true;
      this.camStatus.textContent = 'Este navegador no ofrece cámara o WebAssembly.';
    }
  }

  setStatus(text, kind = '') {
    this.status.textContent = text;
    this.status.className = `hint ${kind === 'ok' ? 'status-ok' : kind === 'bad' ? 'status-bad' : ''}`;
  }

  setBusy(button, value) {
    button.setAttribute('aria-busy', value ? 'true' : 'false');
    button.disabled = !!value;
  }

  open() {
    this.overlay.openDrawer();
    this.details.open = true;
    this.input.focus({ preventScroll: false });
    this.details.scrollIntoView?.({ block: 'nearest' });
  }

  async save() {
    const value = this.input.value.trim();
    if (!value) { this.setStatus('Pegá tu clave en el campo y volvé a guardar.', 'bad'); return; }
    if (!AiKeyStore.looksValid(value)) { this.setStatus('La clave no tiene el formato esperado (empieza con «AIza» o «AQ.» y no lleva espacios).', 'bad'); return; }
    this.keyStore.set(value, { remember: this.remember.checked });
    await this.testKey();
  }

  async testKey() {
    if (this.busy) return;
    if (!this.keyStore.hasKey) { this.setStatus('Primero cargá una clave.', 'bad'); return; }
    this.busy = true;
    this.setStatus('Probando la clave con Google…', '');
    const button = $('ai-test');
    this.setBusy(button, true);
    try {
      const result = await this.service.testKey();
      const msg = `Clave válida: el modelo ${result.model} está disponible.`;
      this.setStatus(msg, 'ok');
      this.onNotice?.(msg, 'info');
    } catch (error) {
      const text = redact(AI_ERRORS[error.code] || error.message, this.keyStore.value);
      this.setStatus(text, 'bad');
      this.onNotice?.(text, 'warn');
    } finally {
      this.busy = false;
      this.setBusy(button, false);
    }
  }

  clear() {
    this.keyStore.clear();
    this.setStatus('Clave borrada de este navegador.', '');
  }

  // ----- Cámara -----
  async toggleCamera() {
    if (this.service.previewing) { this.stopPreview(); this.camStatus.textContent = 'Cámara apagada.'; return; }
    this.camBtn.setAttribute('aria-busy', 'true');
    this.camStatus.textContent = 'Pidiendo permiso y cargando el modelo de manos (solo la primera vez)…';
    try {
      await this.service.previewOn();
      this.camBtn.setAttribute('aria-pressed', 'true');
      this.camBtn.textContent = 'Apagar cámara';
      this.camStatus.textContent = 'Cámara lista. Si ves tus manos en la vista previa, el análisis funciona mejor. No se graba nada.';
      this.syncFloat();
    } catch (error) {
      this.camStatus.textContent = error.code === 'denied' ? 'El navegador no dio acceso a la cámara.' : error.code === 'no-camera' ? 'No se encontró una cámara.' : 'No se pudo iniciar la cámara o el modelo de manos.';
    } finally {
      this.camBtn.setAttribute('aria-busy', 'false');
    }
  }

  stopPreview() {
    this.service.previewOff();
    this.camBtn.setAttribute('aria-pressed', 'false');
    this.camBtn.textContent = 'Probar cámara';
    this.syncFloat();
  }

  syncFloat() {
    this.float.hidden = !(this.service.previewing || this.session.cameraOn);
  }
}
