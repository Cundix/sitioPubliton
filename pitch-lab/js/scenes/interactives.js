// Objetos interactivos del entorno: marcas de teletransporte y maquetas del hub.
// Ambos reciben el cursor (mouse o láser del control) igual que los botones.

import { app } from '../app-context.js';
import { DEG } from './scene-kit.js';
import { makeSign } from './furniture.js';
import { CanvasSurface } from '../ui/canvas-surface.js';
import { drawButton } from '../ui/draw-button.js';

const T = () => globalThis.AFRAME.THREE;

/** Marca circular en el piso. Al apuntarla y presionar, la persona se teletransporta (sin deslizarse). */
export class TeleportPad {
  constructor(pad, { onTeleport, onHaptic }) {
    const THREE = T();
    this.pad = pad;
    this.hover = false;
    this.root = document.createElement('a-entity');
    this.root.object3D.position.set(pad.x, pad.y + 0.015, pad.z);

    this.ringMat = new THREE.MeshBasicMaterial({ color: '#FFC94A', transparent: true, opacity: 0.9, toneMapped: false });
    this.ringGeo = new THREE.RingGeometry(0.32, 0.42, 40);
    this.ring = new THREE.Mesh(this.ringGeo, this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.fillMat = new THREE.MeshBasicMaterial({ color: '#FFC94A', transparent: true, opacity: 0.14, toneMapped: false });
    this.fillGeo = new THREE.CircleGeometry(0.32, 32);
    this.fill = new THREE.Mesh(this.fillGeo, this.fillMat);
    this.fill.rotation.x = -Math.PI / 2;
    this.fill.position.y = -0.002;
    this.group = new THREE.Group();
    this.group.add(this.ring, this.fill);

    // Zona de impacto un poco más grande que la marca (más fácil de apuntar con el control)
    this.hitGeo = new THREE.CircleGeometry(0.62, 24);
    this.hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    this.hit = new THREE.Mesh(this.hitGeo, this.hitMat);
    this.hit.rotation.x = -Math.PI / 2;
    this.hit.position.y = 0.004;

    this.visual = document.createElement('a-entity');
    this.visual.setObject3D('mesh', this.group);
    this.hitEl = document.createElement('a-entity');
    this.hitEl.classList.add('ui');
    this.hitEl.setObject3D('mesh', this.hit);
    this.root.append(this.visual, this.hitEl);

    // Rótulo apoyado en el piso, delante de quien se para en la marca (legible desde esa posición)
    this.label = makeSign({ text: pad.label.toUpperCase(), w: 1.5, h: 0.34, bg: '#11160E', size: 0.62, px: 400 });
    this.label.el.object3D.rotation.x = -Math.PI / 2;
    this.label.el.object3D.position.set(0, 0.002, -0.78);
    this.labelHolder = document.createElement('a-entity');
    this.labelHolder.object3D.rotation.y = (pad.yawDeg || 0) * DEG;
    this.labelHolder.appendChild(this.label.el);
    this.root.appendChild(this.labelHolder);

    this._enter = (e) => { this.hover = true; this.refresh(); onHaptic?.('hover', e); };
    this._leave = () => { this.hover = false; this.refresh(); };
    this._click = (e) => { onHaptic?.('teleport', e); onTeleport(pad); };
    this.hitEl.addEventListener('mouseenter', this._enter);
    this.hitEl.addEventListener('mouseleave', this._leave);
    this.hitEl.addEventListener('click', this._click);
  }

  refresh() {
    this.ringMat.opacity = this.hover ? 1 : 0.9;
    this.fillMat.opacity = this.hover ? 0.35 : 0.14;
    this.ring.scale.setScalar(this.hover ? 1.12 : 1);
  }

  dispose() {
    this.hitEl.removeEventListener('mouseenter', this._enter);
    this.hitEl.removeEventListener('mouseleave', this._leave);
    this.hitEl.removeEventListener('click', this._click);
    this.visual.removeObject3D('mesh');
    this.hitEl.removeObject3D('mesh');
    [this.ringGeo, this.fillGeo, this.hitGeo, this.ringMat, this.fillMat, this.hitMat].forEach((x) => x.dispose());
    this.label.dispose();
    this.root.remove();
  }
}

/** Botón flotante 3D independiente (por ejemplo, "Volver al atril" en el asiento del público). */
export class FloatingButton {
  constructor({ action, pos, rotY = 0, w = 0.8, h = 0.2, onPress, onHaptic }) {
    this.action = action;
    this.hover = false;
    this.surface = new CanvasSurface(w, h, 800);
    this.el = document.createElement('a-entity');
    this.el.classList.add('ui');
    this.el.setObject3D('mesh', this.surface.mesh);
    this.el.object3D.position.set(...pos);
    this.el.object3D.rotation.y = rotY * DEG;
    this._enter = (e) => { this.hover = true; this.draw(); onHaptic?.('hover', e); };
    this._leave = () => { this.hover = false; this.draw(); };
    this._click = (e) => { onHaptic?.('press', e); onPress(this.action); };
    this.el.addEventListener('mouseenter', this._enter);
    this.el.addEventListener('mouseleave', this._leave);
    this.el.addEventListener('click', this._click);
    this.draw();
  }

  draw() {
    this.surface.draw((ctx, W, H) => drawButton(ctx, W, H, this.action, { hover: this.hover }));
  }

  dispose() {
    this.el.removeEventListener('mouseenter', this._enter);
    this.el.removeEventListener('mouseleave', this._leave);
    this.el.removeEventListener('click', this._click);
    this.el.removeObject3D('mesh');
    this.surface.dispose();
    this.el.remove();
  }
}

export { app };
