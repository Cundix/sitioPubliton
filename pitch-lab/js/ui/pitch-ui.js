// PitchUI: arma las superficies de interfaz del espacio (panel, atril, reloj, brief)
// y las mantiene sincronizadas con el modelo de pantalla (UIHub).
//
//  - Panel informativo: flota delante de la persona; contiene textos y opciones.
//  - Atril: cara inclinada con el estado y los botones principales de cada paso.
//  - Reloj: tiempo restante (o de preparación) con señales visuales de aviso.
//  - Brief: pantalla en la pared + recordatorio compacto.

import { CanvasSurface } from './canvas-surface.js';
import { ButtonPool } from './button3d.js';
import {
  PANEL, LECTERN, CLOCK, BRIEF,
  drawPanel, fitPanel, drawLecternFace, drawClock, drawBriefScreen, drawBriefCompact,
} from './panel-draw.js';
import { DEG } from '../scenes/scene-kit.js';

export const FACE_W = 1.3;
export const FACE_H = 0.56;
export const FACE_TILT = -22; // grados
export const FACE_POS = [0, 1.0301, 0.0250];

function makeEntity(parent, { pos = [0, 0, 0], rotX = 0, rotY = 0, scale = 1 } = {}) {
  const el = document.createElement('a-entity');
  el.object3D.position.set(pos[0], pos[1], pos[2]);
  el.object3D.rotation.set(rotX * DEG, rotY * DEG, 0);
  el.object3D.scale.setScalar(scale);
  parent.appendChild(el);
  return el;
}

export class PitchUI {
  /**
   * @param {object} deps
   * @param {Element} deps.parent    entidad A-Frame que contiene todo
   * @param {UIHub} deps.hub
   * @param {Function} deps.onPress  ejecuta una acción
   * @param {Function} deps.onDenied acción deshabilitada
   * @param {object} deps.settings
   * @param {object} deps.anchors    posiciones: lectern, panel, clock, brief, compact
   * @param {object} deps.scenarioName
   */
  constructor({ parent, hub, onPress, onDenied, settings, anchors, getScenarioName, getBrief, getEnv, getHasView }) {
    this.getHasView = getHasView;
    this.hub = hub;
    this.settings = settings;
    this.anchors = anchors;
    this.getScenarioName = getScenarioName;
    this.getBrief = getBrief;
    this.getEnv = getEnv;
    this.surfaces = [];
    this.pools = [];
    this.briefKey = '';
    this.root = makeEntity(parent);

    // ----- Atril -----
    const la = anchors.lectern;
    this.lecternEl = makeEntity(this.root, { pos: la.pos, rotY: la.rotY || 0 });
    this.faceEl = makeEntity(this.lecternEl, { pos: FACE_POS, rotX: FACE_TILT });
    this.faceSurface = this._surface(this.faceEl, FACE_W, FACE_H, 1000);
    this.lecternPool = this._pool(this.faceEl, onPress, onDenied);

    // ----- Panel -----
    if (anchors.panel) {
      const a = anchors.panel;
      this.panelEl = makeEntity(this.root, { pos: a.pos, rotY: a.rotY || 0, scale: a.scale || 1 });
      this.panelSurface = this._surface(this.panelEl, PANEL.W / 1024, PANEL.H / 1024, 1024);
      this.panelPool = this._pool(this.panelEl, onPress, onDenied);
    }

    // ----- Reloj -----
    if (anchors.clock) {
      const a = anchors.clock;
      this.clockEl = makeEntity(this.root, { pos: a.pos, rotY: a.rotY || 0, scale: a.scale || 1 });
      this.clockSurface = this._surface(this.clockEl, CLOCK.W / 1000, CLOCK.H / 1000, 1000);
    }

    // ----- Brief -----
    if (anchors.brief) {
      const a = anchors.brief;
      this.briefEl = makeEntity(this.root, { pos: a.pos, rotY: a.rotY || 0, scale: a.scale || 1 });
      this.briefSurface = this._surface(this.briefEl, BRIEF.W / 1000, BRIEF.H / 1000, 1000, 8);
    }
    if (anchors.compact) {
      const a = anchors.compact;
      this.compactEl = makeEntity(this.root, { pos: a.pos, rotY: a.rotY || 0, scale: a.scale || 1 });
      this.compactSurface = this._surface(this.compactEl, 1.2, 0.38, 1000);
    }

    this._off = [
      hub.on('model', (m) => this.renderAll(m)),
      hub.on('clock', (c) => this.renderClock(c)),
      hub.on('hint', (l) => this.renderLectern({ ...hub.model, lectern: l })),
    ];
    this.renderAll(hub.model);
  }

  _surface(parentEl, w, h, px, anisotropy = 4) {
    const s = new CanvasSurface(w, h, px, { anisotropy });
    parentEl.setObject3D('mesh', s.mesh);
    this.surfaces.push(s);
    return s;
  }

  _pool(parentEl, onPress, onDenied) {
    const p = new ButtonPool(parentEl, { onPress, onDenied });
    this.pools.push(p);
    return p;
  }

  renderAll(model) {
    this.renderLectern(model);
    this.renderPanel(model);
    this.renderClock(model.clock);
    this.renderBrief();
  }

  // ----- Atril -----
  renderLectern(model) {
    const l = model.lectern;
    this.faceSurface.draw((ctx, W, H) => drawLecternFace(ctx, W, H, l));

    const px = (x, y, w, h) => ({ x: (x + w / 2 - LECTERN.W / 2) / 1000, y: (LECTERN.H / 2 - (y + h / 2)) / 1000, w: w / 1000, h: h / 1000 });
    const items = [];
    const [primary, ...rest] = l.actions;
    if (primary) items.push({ key: `L-${primary.id}`, action: primary, ...px(34, 196, 940, 170) });
    const n = rest.length;
    const gap = 16;
    const rw = n ? (940 - gap * (n - 1)) / n : 0;
    rest.forEach((a, i) => items.push({ key: `L-${a.id}`, action: a, ...px(34 + i * (rw + gap), 384, rw, 140) }));

    // Utilidades siempre disponibles
    const env = this.getEnv();
    const hasViewSeat = !!this.getHasView?.();
    const util = [
      { id: 'u-recenter', label: 'Recentrar', kind: 'secondary', ui: 'recenter' },
      ...(hasViewSeat ? [{ id: 'u-view', label: 'Ver desde el público', kind: 'secondary', ui: 'teleport-view' }] : []),
      { id: 'u-seated', label: `Sentado: ${this.settings.get('seated') ? 'SÍ' : 'NO'}`, kind: 'secondary', ui: 'toggle-seated', on: this.settings.get('seated') },
      env.vr
        ? { id: 'u-exit', label: 'Salir de VR', kind: 'danger', ui: 'exit-vr' }
        : { id: 'u-text', label: 'Panel de texto', kind: 'secondary', ui: 'toggle-drawer' },
    ];
    const slot = (LECTERN.H - 68 - (util.length - 1) * 14) / util.length;
    util.forEach((a, i) => items.push({ key: `U-${a.id}`, action: a, ...px(1036, 34 + i * (slot + 14), 236, slot) }));
    this.lecternPool.sync(items);
  }

  // ----- Panel -----
  renderPanel(model) {
    if (!this.panelSurface) return;
    const p = model.panel;
    this.panelEl.object3D.visible = p.visible;
    if (!p.visible) { this.panelPool.clear(); return; }

    const hasOptions = p.options.length > 0;
    let endY = 0;
    this.panelSurface.draw((ctx, W, H) => {
      const k = fitPanel(ctx, W, H, p, hasOptions);
      endY = drawPanel(ctx, W, H, p, { hasOptions, k });
      this.lastFit = { state: model.state, k, endY };
    });
    if (endY > PANEL.H - 40) console.warn(`[pitch-ui] contenido del panel desborda en "${model.state}" (${Math.round(endY)} px)`);

    const items = [];
    if (hasOptions) {
      const n = p.options.length;
      const rubricMode = p.options.some((o) => o.kind === 'rubric');
      const top = 190;
      const avail = PANEL.H - top - 90;
      const gap = 18;
      const h = Math.min(rubricMode ? 150 : 124, (avail - gap * (n - 1)) / n);
      const total = n * h + (n - 1) * gap;
      const startY = top + (rubricMode || n > 4 ? 0 : (avail - total) / 2);
      p.options.forEach((a, i) => {
        const x = PANEL.optionsX, y = startY + i * (h + gap), w = PANEL.optionsW;
        items.push({
          key: `P-${a.id}`,
          action: a,
          x: (x + w / 2 - PANEL.W / 2) / 1024,
          y: (PANEL.H / 2 - (y + h / 2)) / 1024,
          w: w / 1024,
          h: h / 1024,
        });
      });
    }
    this.panelPool.sync(items);
  }

  // ----- Reloj -----
  renderClock(clock) {
    if (!this.clockSurface) return;
    this.clockSurface.draw((ctx, W, H) => drawClock(ctx, W, H, clock));
  }

  // ----- Brief -----
  renderBrief() {
    const brief = this.getBrief();
    const key = `${brief.id}|${this.getScenarioName()}`;
    if (key === this.briefKey) return;
    this.briefKey = key;
    this.briefSurface?.draw((ctx, W, H) => drawBriefScreen(ctx, W, H, brief, this.getScenarioName()));
    this.compactSurface?.draw((ctx, W, H) => drawBriefCompact(ctx, W, H, brief));
  }

  dispose() {
    this._off.forEach((off) => off());
    this.pools.forEach((p) => p.dispose());
    this.surfaces.forEach((s) => s.dispose());
    this.root.remove();
  }
}
