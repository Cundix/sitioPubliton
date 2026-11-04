// Panel de texto accesible (HTML). Es un ESPEJO del espacio 3D, no su reemplazo:
// muestra lo mismo que el panel y el atril, con botones reales de teclado, foco visible,
// región "aria-live" para lectores de pantalla y edición de la transcripción.
// La experiencia principal sucede en la escena 3D; este panel no aparece dentro del casco VR.

import { esc, renderBlock, renderAction } from './html-blocks.js';
import { S } from '../core/state-machine.js';
import { SOURCE_LABELS } from '../core/metrics.js';

const $ = (id) => document.getElementById(id);

export class HtmlOverlay {
  constructor({ session, settings, hub, onPress, onEnterVR, onExitVR, caps }) {
    this.session = session;
    this.settings = settings;
    this.hub = hub;
    this.onPress = onPress;
    this.onEnterVR = onEnterVR;
    this.onExitVR = onExitVR;
    this.caps = caps;
    this.drawer = $('drawer');
    this.body = $('drawer-body');
    this.btnDrawer = $('btn-drawer');
    this.btnVR = $('btn-vr');
    this.xrNote = $('xr-note');
    this.live = $('live');
    this.toastEl = $('toast');
    this.status = $('status-line');
    this.timerChip = $('timer-chip');
    this.transcriptBox = $('transcript-box');
    this.transcript = $('transcript-text');
    this.transcriptSource = $('transcript-source');
    this.transcriptCount = $('transcript-count');
    this.actions = new Map();
    this.lastState = null;
    this.lastKey = '';
    this._toastTimer = null;
    this._inputTimer = null;
    this.xr = { supported: false, reason: '', active: false };
    this.autoOpened = false; // el panel se abrió solo (revisión de transcripción)

    this._bind();
    this.render(hub.model);
    this._offs = [
      hub.on('model', (m) => this.render(m)),
      hub.on('clock', (c) => this.renderClock(c)),
      hub.on('hint', (l) => { this.status.textContent = `${l.status} · ${l.hint}`; }),
      session.on('warning', ({ level, view }) => this.announce(level === 'final' ? `Cuenta final: quedan ${view.remainingSec} segundos.` : `Quedan ${view.remainingSec} segundos.`)),
      session.on('notice', (n) => this.toast(n.text, n.kind)),
    ];
  }

  _bind() {
    // Un solo oyente para todos los botones generados
    this.drawer.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action-id]');
      if (!button) return;
      const action = this.actions.get(button.dataset.actionId);
      if (action) this.onPress(action);
    });
    this.btnDrawer.addEventListener('click', () => this.toggleDrawer());
    $('drawer-close').addEventListener('click', () => this.closeDrawer(true));
    this.btnVR.addEventListener('click', () => (this.xr.active ? this.onExitVR() : this.onEnterVR()));

    // Preferencias
    const vol = $('pref-volume');
    vol.value = Math.round(this.settings.get('volume') * 100);
    vol.addEventListener('input', () => this.settings.set('volume', Number(vol.value) / 100));
    const motion = $('pref-motion');
    motion.checked = this.settings.get('reducedMotion');
    motion.addEventListener('change', () => this.settings.set('reducedMotion', motion.checked));
    const seated = $('pref-seated');
    seated.checked = this.settings.get('seated');
    seated.addEventListener('change', () => this.settings.set('seated', seated.checked));
    this.settings.on('change', ({ key, value }) => {
      if (key === 'volume') vol.value = Math.round(value * 100);
      if (key === 'reducedMotion') motion.checked = value;
      if (key === 'seated') seated.checked = value;
      $('pref-volume-text').textContent = `${Math.round(this.settings.get('volume') * 100)}%`;
      document.documentElement.classList.toggle('reduce-motion', this.settings.get('reducedMotion'));
    });
    $('pref-volume-text').textContent = `${Math.round(this.settings.get('volume') * 100)}%`;
    document.documentElement.classList.toggle('reduce-motion', this.settings.get('reducedMotion'));

    // Transcripción editable
    this.transcript.addEventListener('input', () => {
      this.transcriptCount.textContent = this._wordCountText(this.transcript.value);
      clearTimeout(this._inputTimer);
      this._inputTimer = setTimeout(() => this.session.dispatch('SET_TRANSCRIPT', { text: this.transcript.value }), 200);
    });
    $('btn-reset').addEventListener('click', () => {
      if (!this.session.dispatch('RESET')) this.toast('Hay una sesión activa. Cancelala primero para reiniciar.', 'warn');
    });
  }

  _wordCountText(text) {
    const n = (text.match(/[\p{L}\p{N}]+/gu) || []).length;
    return `${n} palabra${n === 1 ? '' : 's'}`;
  }

  // ----- Panel -----
  get isOpen() { return !this.drawer.hidden; }

  openDrawer({ focus = false } = {}) {
    this.drawer.hidden = false;
    this.btnDrawer.setAttribute('aria-expanded', 'true');
    document.body.classList.add('drawer-open');
    if (focus) this.body.querySelector('h2')?.focus();
  }

  closeDrawer(returnFocus = false) {
    this.drawer.hidden = true;
    this.btnDrawer.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('drawer-open');
    if (returnFocus) this.btnDrawer.focus();
  }

  toggleDrawer() { this.autoOpened = false; this.isOpen ? this.closeDrawer(true) : this.openDrawer({ focus: true }); }

  // ----- Dibujo -----
  render(model) {
    const { panel, lectern } = model;
    const focusedId = document.activeElement?.dataset?.actionId;
    const hadFocusInside = this.drawer.contains(document.activeElement);
    this.actions.clear();

    const all = [...panel.options, ...lectern.actions];
    all.forEach((a) => this.actions.set(a.id, a));

    const title = panel.title.join(' ');
    const notice = model.notice
      ? `<div class="notice notice-info" role="status"><p>${esc(model.notice.text)}</p></div>`
      : '';
    this.body.innerHTML = `
      <p class="eyebrow">${esc(panel.eyebrow || lectern.status)}</p>
      <h2 tabindex="-1" id="drawer-title">${esc(title || lectern.status)}</h2>
      ${notice}
      ${panel.blocks.map(renderBlock).join('')}
      ${panel.options.length ? `<div class="options" role="group" aria-label="Opciones">${panel.options.map((a) => renderAction(a)).join('')}</div>` : ''}
      ${lectern.hint ? `<p class="hint">${esc(lectern.hint)}</p>` : ''}
      <div class="actions" role="group" aria-label="Acciones">${lectern.actions.map((a) => renderAction(a)).join('')}</div>`;

    this.status.textContent = `${lectern.status}${lectern.hint ? ` · ${lectern.hint}` : ''}`;
    this.renderClock(model.clock);
    this._renderTranscript();

    const state = this.session.state;
    const changed = state !== this.lastState;
    if (changed) {
      this.announce([panel.eyebrow, title, lectern.hint].filter(Boolean).join('. '));
      if (state === S.REVIEW && !this.isOpen) { this.openDrawer(); this.autoOpened = true; }
      else if (this.lastState === S.REVIEW && this.autoOpened) { this.closeDrawer(); this.autoOpened = false; }
    }
    if (hadFocusInside) {
      const target = !changed && focusedId ? this.body.querySelector(`[data-action-id="${CSS.escape(focusedId)}"]`) : null;
      (target || this.body.querySelector('h2'))?.focus({ preventScroll: true });
    }
    this.lastState = state;
  }

  renderClock(clock) {
    if (clock.mode === 'idle') {
      this.timerChip.hidden = true;
      return;
    }
    this.timerChip.hidden = false;
    this.timerChip.dataset.warning = clock.warning;
    this.timerChip.textContent = `${clock.label}: ${clock.time}${clock.warning === 'warning' || clock.warning === 'final' ? ` · ${clock.sub}` : ''}`;
  }

  _renderTranscript() {
    const show = this.session.state === S.REVIEW;
    this.transcriptBox.hidden = !show;
    if (!show) return;
    const t = this.session.getTranscript();
    this.transcriptSource.textContent = `Origen: ${SOURCE_LABELS[t.source]}`;
    this.transcriptSource.dataset.source = t.source;
    if (document.activeElement !== this.transcript) {
      this.transcript.value = t.text;
      this.transcriptCount.textContent = this._wordCountText(t.text);
    }
  }

  // ----- Avisos -----
  announce(text) {
    // Se vacía y se vuelve a llenar para que el lector repita mensajes iguales.
    this.live.textContent = '';
    requestAnimationFrame(() => { this.live.textContent = text; });
  }

  toast(text, kind = 'info') {
    this.toastEl.textContent = text;
    this.toastEl.dataset.kind = kind;
    this.toastEl.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this.toastEl.hidden = true; }, 6000);
    this.announce(text);
  }

  // ----- Modo inmersivo -----
  setXR(xr) {
    this.xr = xr;
    this.updateXR();
  }

  updateXR() {
    const { supported, reason, active } = this.xr;
    this.btnVR.hidden = !supported && !active;
    this.btnVR.textContent = active ? 'Salir de VR' : 'Entrar en VR';
    this.xrNote.textContent = supported || active
      ? ''
      : `Modo inmersivo no disponible. ${reason}`;
    this.xrNote.hidden = supported || active;
  }

  showFallback(message) {
    $('fallback').hidden = false;
    $('fallback-text').textContent = message;
    this.openDrawer();
  }

  hideLoading() {
    $('loading').hidden = true;
  }

  dispose() {
    this._offs.forEach((off) => off());
    clearTimeout(this._toastTimer);
    clearTimeout(this._inputTimer);
  }
}
