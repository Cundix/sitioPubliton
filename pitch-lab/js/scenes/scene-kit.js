// Herramientas para armar geometría estilizada y liviana con three.js (la que trae A-Frame).
// Un Kit reúne materiales y geometrías reutilizadas y las libera todas juntas con dispose().

import { COLORS } from '../ui/draw.js';

export const DEG = Math.PI / 180;

export class Kit {
  constructor() {
    const T = globalThis.AFRAME.THREE;
    this.T = T;
    this.group = new T.Group();
    this.group.name = 'pitchlab-static';
    this._materials = new Map();
    this._geometries = new Map();
    this._extras = []; // objetos con dispose() propio (texturas, instancias)
  }

  /** Material estándar con sombreado plano, reutilizado por color/opciones. */
  mat(color, { rough = 0.85, metal = 0, emissive = null, emissiveIntensity = 1, opacity = 1, side = 'front', flat = true } = {}) {
    const key = JSON.stringify([color, rough, metal, emissive, emissiveIntensity, opacity, side, flat]);
    let m = this._materials.get(key);
    if (!m) {
      const T = this.T;
      m = new T.MeshStandardMaterial({
        color,
        roughness: rough,
        metalness: metal,
        flatShading: flat,
        transparent: opacity < 1,
        opacity,
        side: side === 'back' ? T.BackSide : side === 'double' ? T.DoubleSide : T.FrontSide,
      });
      if (emissive) { m.emissive = new T.Color(emissive); m.emissiveIntensity = emissiveIntensity; }
      this._materials.set(key, m);
    }
    return m;
  }

  /** Material que no recibe luz (señales luminosas, pantallas). */
  basic(color, { opacity = 1, side = 'front' } = {}) {
    const key = JSON.stringify(['basic', color, opacity, side]);
    let m = this._materials.get(key);
    if (!m) {
      const T = this.T;
      m = new T.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: side === 'double' ? T.DoubleSide : T.FrontSide, toneMapped: false });
      this._materials.set(key, m);
    }
    return m;
  }

  _geo(key, make) {
    let g = this._geometries.get(key);
    if (!g) { g = make(); this._geometries.set(key, g); }
    return g;
  }

  _place(mesh, pos, opts) {
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (opts.rotX) mesh.rotation.x = opts.rotX * DEG;
    if (opts.rotY) mesh.rotation.y = opts.rotY * DEG;
    if (opts.rotZ) mesh.rotation.z = opts.rotZ * DEG;
    return mesh;
  }

  /** Caja: size [ancho, alto, profundo], pos = centro. */
  box(size, pos, color, opts = {}) {
    const geo = this._geo(`box${size}`, () => new this.T.BoxGeometry(size[0], size[1], size[2]));
    const mesh = new this.T.Mesh(geo, opts.material || this.mat(color, opts));
    (opts.parent || this.group).add(this._place(mesh, pos, opts));
    return mesh;
  }

  cyl(rTop, rBottom, h, pos, color, opts = {}) {
    const seg = opts.seg || 16;
    const geo = this._geo(`cyl${rTop},${rBottom},${h},${seg}`, () => new this.T.CylinderGeometry(rTop, rBottom, h, seg));
    const mesh = new this.T.Mesh(geo, opts.material || this.mat(color, opts));
    (opts.parent || this.group).add(this._place(mesh, pos, opts));
    return mesh;
  }

  sphere(r, pos, color, opts = {}) {
    const geo = this._geo(`sph${r},${opts.seg || 12}`, () => new this.T.SphereGeometry(r, opts.seg || 12, opts.segH || 8));
    const mesh = new this.T.Mesh(geo, opts.material || this.mat(color, opts));
    (opts.parent || this.group).add(this._place(mesh, pos, opts));
    return mesh;
  }

  plane(w, h, pos, color, opts = {}) {
    const geo = this._geo(`pl${w},${h}`, () => new this.T.PlaneGeometry(w, h));
    const mesh = new this.T.Mesh(geo, opts.material || this.mat(color, { side: 'front', ...opts }));
    (opts.parent || this.group).add(this._place(mesh, pos, opts));
    return mesh;
  }

  group3(pos, opts = {}) {
    const g = new this.T.Group();
    g.position.set(pos[0], pos[1], pos[2]);
    if (opts.rotY) g.rotation.y = opts.rotY * DEG;
    (opts.parent || this.group).add(g);
    return g;
  }

  light(type, color, intensity, pos, opts = {}) {
    const T = this.T;
    let l;
    if (type === 'hemi') l = new T.HemisphereLight(color, opts.ground || COLORS.bg, intensity);
    else if (type === 'dir') l = new T.DirectionalLight(color, intensity);
    else if (type === 'spot') {
      l = new T.SpotLight(color, intensity, opts.distance || 0, (opts.angle || 40) * DEG, opts.penumbra ?? 0.5, opts.decay ?? 1.2);
      if (opts.target) { l.target.position.set(...opts.target); this.group.add(l.target); }
    } else l = new T.PointLight(color, intensity, opts.distance || 0, opts.decay ?? 1.4);
    l.position.set(pos[0], pos[1], pos[2]);
    this.group.add(l);
    return l;
  }

  track(disposable) {
    this._extras.push(disposable);
    return disposable;
  }

  dispose() {
    for (const e of this._extras) { try { e.dispose?.(); } catch { /* ya liberado */ } }
    for (const g of this._geometries.values()) g.dispose();
    for (const m of this._materials.values()) m.dispose();
    this.group.traverse((o) => { if (o.isLight && o.shadow?.map) o.shadow.map.dispose(); });
    this.group.removeFromParent();
    this._extras = [];
    this._geometries.clear();
    this._materials.clear();
  }
}
