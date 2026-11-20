// Maqueta de un escenario sobre un pedestal del hub.
// Muestra la forma del espacio y la cantidad de público, a una escala que entra en el pedestal.
// Es un objeto 3D interactivo: apuntarlo lo resalta y presionarlo elige el escenario.

import { DEG } from './scene-kit.js';
import { makeSign } from './furniture.js';
import { formatClock } from '../core/feedback.js';
import { app } from '../app-context.js';

const T = () => globalThis.AFRAME.THREE;

export class Maquette {
  /**
   * @param {Kit} kit
   * @param {object} sc   escenario resuelto (resolveScenario)
   * @param {object} opts { x, z, onPick }
   */
  constructor(kit, sc, { x, z, rotY = 0, onPick, onHover }) {
    const THREE = T();
    this.sc = sc;
    this.selected = false;
    this.interactive = false;
    this.hover = false;
    this.onPick = onPick;
    this.onHover = onHover;
    this.baseY = 1.12; // altura de la tapa del pedestal

    this.root = document.createElement('a-entity');
    this.root.object3D.position.set(x, 0, z);
    this.root.object3D.rotation.y = rotY * DEG;

    const g = new THREE.Group();
    this.group = g;
    const holder = new THREE.Group(); // gira lentamente (arranca vista desde el lado del público)
    holder.position.y = this.baseY;
    this.holder = holder;
    g.add(holder);

    // --- Pedestal ---
    const stand = (geo, color, pos, opts = {}) => {
      kit.track({ dispose: () => geo.dispose() }); // se libera junto con el resto del espacio
      const m = new THREE.Mesh(geo, kit.mat(color, opts));
      m.position.set(...pos);
      g.add(m);
      return m;
    };
    stand(new THREE.CylinderGeometry(0.46, 0.52, 0.12, 24), '#11160E', [0, 0.06, 0]);
    stand(new THREE.CylinderGeometry(0.34, 0.4, this.baseY - 0.2, 20), '#2A3225', [0, 0.12 + (this.baseY - 0.2) / 2, 0]);
    stand(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 28), '#11160E', [0, this.baseY - 0.04, 0]);
    const glow = stand(new THREE.TorusGeometry(0.53, 0.012, 6, 40), '#FFC94A', [0, 0.13, 0]);
    glow.rotation.x = Math.PI / 2;
    glow.material = kit.basic('#FFC94A');                                    // anillo luminoso al pie del pedestal
    this.rim = stand(new THREE.TorusGeometry(0.5, 0.012, 8, 40), '#FFC94A', [0, this.baseY, 0]);
    this.rim.rotation.x = Math.PI / 2;
    this.rim.material = new THREE.MeshBasicMaterial({ color: '#FFC94A', transparent: true, opacity: 0.35, toneMapped: false });
    kit.track({ dispose: () => this.rim.material.dispose() });

    // --- Maqueta ---
    const { room } = sc;
    const W = room.maxX - room.minX;
    const D = room.maxZ - room.minZ;
    const s = 0.86 / Math.max(W, D);
    const cx = (room.minX + room.maxX) / 2;
    const cz = (room.minZ + room.maxZ) / 2;
    const m = new THREE.Group();
    m.position.set(0, 0.02, 0);
    holder.add(m);
    const at = (px, py, pz) => [(px - cx) * s, py * s, (pz - cz) * s];
    const box = (w, h, d, pos, color, opts = {}) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w * s, h * s, d * s), kit.mat(color, opts));
      mesh.position.set(...at(...pos));
      m.add(mesh);
      mesh.geometry.userData.own = true;
      kit.track({ dispose: () => mesh.geometry.dispose() });
      return mesh;
    };

    // Piso y paredes bajas
    box(W, 0.12, D, [cx, -0.06, cz], '#2a3325');
    const wallH = Math.min(room.height, 3.2) * (sc.id === 'auditorio' ? 1.3 : 0.9);
    const wallColor = '#596151';
    box(W, wallH, 0.2, [cx, wallH / 2, room.maxZ], sc.theme.accent);          // pared de la pantalla
    box(0.2, wallH * 0.3, D, [room.minX, wallH * 0.15, cz], wallColor);
    box(0.2, wallH * 0.3, D, [room.maxX, wallH * 0.15, cz], wallColor);

    // Atril
    box(0.9, 1.0, 0.5, [0, 0.5, 0], '#FFC94A');

    if (sc.id === 'auditorio') {
      box(14, 0.6, 7.2, [0, -0.3 + 0.0, 1.4], '#3a4533'); // escenario
      sc.audience.zones.forEach((z) => {
        for (let r = 0; r < z.rows; r++) {
          const y = (z.baseY ?? -0.6) + z.rise * r;
          box(z.cols * z.dx, Math.max(0.1, y + 0.6), z.dz * 0.95, [z.x + (z.cols - 1) * z.dx / 2, (y - 0.6) / 2, z.z - r * z.dz], '#20261C');
        }
      });
    } else if (sc.id === 'cliente') {
      box(1.6, 0.1, 3.7, [0, 0.76, -2.8], '#8A6A45');
    } else {
      box(3.4, 0.04, 2.0, [0, 0.02, -2.5], '#0B2A8A');
    }

    // Personas: figuras chicas (cuerpo cónico + cabeza), instanciadas. El tamaño está exagerado para que se vean.
    const people = sc.seats.filter((p) => p.occupied);
    const dot = Math.max(0.045, (sc.id === 'auditorio' ? 0.5 : 0.24) * s * 1.1);
    const bodyGeo = new THREE.ConeGeometry(dot * 0.8, dot * 2.0, 7);
    const headGeo = new THREE.SphereGeometry(dot * 0.52, 8, 6);
    const bodies = new THREE.InstancedMesh(bodyGeo, kit.mat('#FFFFFF', { flat: true }), Math.max(1, people.length));
    const heads = new THREE.InstancedMesh(headGeo, kit.mat('#FFFFFF', { flat: true }), Math.max(1, people.length));
    const colors = ['#0047FF', '#FFC94A', '#FF006E', '#E9E4D4', '#7C9070'];
    const skins = ['#E9C9A6', '#C69C74', '#8D5F3C', '#F3D9C0'];
    const dummy = new THREE.Object3D();
    const c = new THREE.Color();
    people.forEach((p, i) => {
      const pos = at(p.x, p.y + 1.1, p.z);
      dummy.position.set(pos[0], pos[1] - dot * 1.5, pos[2]);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);
      bodies.setColorAt(i, c.set(colors[i % colors.length]));
      dummy.position.set(...pos);
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
      heads.setColorAt(i, c.set(skins[(i * 3) % skins.length]));
    });
    bodies.count = people.length;
    heads.count = people.length;
    m.add(bodies, heads);
    kit.track({ dispose: () => { bodyGeo.dispose(); headGeo.dispose(); bodies.dispose(); heads.dispose(); } });

    // --- Zona de impacto ---
    const hitGeo = new THREE.CylinderGeometry(0.58, 0.58, 1.55, 16);
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    this.hit = new THREE.Mesh(hitGeo, hitMat);
    this.hit.position.y = 0.78;
    kit.track({ dispose: () => { hitGeo.dispose(); hitMat.dispose(); } });

    this.visual = document.createElement('a-entity');
    this.visual.setObject3D('mesh', g);
    this.hitEl = document.createElement('a-entity');
    this.hitEl.setObject3D('mesh', this.hit);
    this.root.append(this.visual, this.hitEl);

    // --- Cartel con nombre, duración y público ---
    const people_n = people.length;
    this.sign = makeSign({
      text: sc.name.toUpperCase(),
      sub: `${formatClock(sc.durationSec)} · ${people_n} personas`,
      w: 0.95, h: 0.3, size: 0.5, px: 520,
    });
    this.sign.el.object3D.position.set(0, 0.58, 0.46);
    this.sign.el.object3D.rotation.x = -40 * DEG;
    this.root.appendChild(this.sign.el);

    this._enter = (e) => { this.hover = true; this.onHover?.(this, true, e); this.refresh(); if (this.interactive) app.haptics?.fromEvent(e, 'hover'); };
    this._leave = () => { this.hover = false; this.onHover?.(this, false); this.refresh(); };
    this._click = (e) => { if (this.interactive) { app.haptics?.fromEvent(e, 'press'); this.onPick(this.sc.id); } };
    this.hitEl.addEventListener('mouseenter', this._enter);
    this.hitEl.addEventListener('mouseleave', this._leave);
    this.hitEl.addEventListener('click', this._click);
  }

  /** Solo se puede elegir cuando el estado lo permite. */
  setInteractive(value) {
    this.interactive = value;
    if (value) this.hitEl.classList.add('ui');
    else this.hitEl.classList.remove('ui');
    this.refresh();
  }

  setSelected(value) {
    this.selected = value;
    this.refresh();
  }

  refresh() {
    const lit = this.selected || (this.hover && this.interactive);
    this.rim.material.opacity = this.selected ? 1 : lit ? 0.85 : 0.35;
    this.rim.scale.setScalar(this.selected ? 1.08 : 1);
    this.holder.position.y = this.baseY + (this.selected ? 0.06 : 0);
  }

  /** Giro lento de la maqueta (se detiene con movimiento reducido). */
  update(timeSec, reduced) {
    this.holder.rotation.y = Math.PI + (reduced ? 0 : timeSec * 0.25 * (this.selected ? 1.6 : 1));
  }

  dispose() {
    this.hitEl.removeEventListener('mouseenter', this._enter);
    this.hitEl.removeEventListener('mouseleave', this._leave);
    this.hitEl.removeEventListener('click', this._click);
    this.visual.removeObject3D('mesh');
    this.hitEl.removeObject3D('mesh');
    this.sign.dispose();
    this.root.remove();
  }
}
