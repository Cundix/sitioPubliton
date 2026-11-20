// Detalles de ambientación de los espacios: pisos con textura, afiches, ventanas y puertas con marco, zócalos,
// techo, parlantes y haces de luz. Todo es geometría procedural y texturas dibujadas en canvas (sin descargas).
// Los detalles repetidos se juntan en lotes (kit.batch) para no inflar las llamadas de dibujo.

import { mulberry32 } from '../core/layouts.js';
import { CanvasSurface } from '../ui/canvas-surface.js';
import { COLORS, FONT } from '../ui/draw.js';
import { DEG } from './scene-kit.js';

const PALETTE = ['#0047FF', '#FFC94A', '#FF006E', '#E9E4D4', '#181D16'];

/** Aclara (amt > 0) u oscurece (amt < 0) un color #RRGGBB. */
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function canvasTexture(kit, size, draw, repeat = [1, 1]) {
  const T = kit.T;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  draw(c.getContext('2d'), size);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = T.RepeatWrapping;
  t.wrapT = T.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  kit.track(t);
  return t;
}

const PATTERNS = {
  /** Alfombra modular: ruido fino y juntas de baldosas de 0,5 m (el lienzo cubre 1 m). */
  carpet(g, S, base) {
    const rand = mulberry32(11);
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
      g.fillRect(rand() * S, rand() * S, 1 + rand() * 2, 1 + rand() * 2);
    }
    g.fillStyle = 'rgba(0,0,0,0.28)';
    [0, S / 2].forEach((p) => { g.fillRect(p, 0, 2, S); g.fillRect(0, p, S, 2); });
  },
  /** Parquet de tablas anchas con vetas y juntas desfasadas. */
  wood(g, S, base) {
    const rand = mulberry32(23);
    const plankW = S / 6;
    for (let col = 0; col < 6; col++) {
      let y = -rand() * S * 0.5;
      while (y < S) {
        const len = S * (0.45 + rand() * 0.4);
        g.fillStyle = shade(base, (rand() - 0.5) * 0.18);
        g.fillRect(col * plankW, y, plankW, len);
        g.strokeStyle = 'rgba(0,0,0,0.30)'; g.lineWidth = 2;
        g.strokeRect(col * plankW, y, plankW, len);
        g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1;
        for (let k = 0; k < 4; k++) {
          const gx = col * plankW + 5 + rand() * (plankW - 10);
          g.beginPath(); g.moveTo(gx, y + 2); g.lineTo(gx + (rand() - 0.5) * 6, y + len - 2); g.stroke();
        }
        y += len;
      }
    }
  },
  /** Tablas de escenario: listones horizontales oscuros. */
  stage(g, S, base) {
    const rand = mulberry32(5);
    const h = S / 12;
    for (let i = 0; i < 12; i++) {
      g.fillStyle = shade(base, (rand() - 0.5) * 0.1);
      g.fillRect(0, i * h, S, h);
      g.fillStyle = 'rgba(0,0,0,0.42)'; g.fillRect(0, i * h, S, 2);
    }
  },
};

/**
 * Plano con textura de piso encima de una caja de piso.
 * @param {string} kind  'carpet' | 'wood' | 'stage'
 */
export function addFloor(kit, kind, { x, y, z, w, d, base, tile = 1 }) {
  const T = kit.T;
  const map = canvasTexture(kit, 256, (g, S) => PATTERNS[kind](g, S, base), [w / tile, d / tile]);
  const material = new T.MeshStandardMaterial({ map, roughness: kind === 'wood' ? 0.55 : 0.92 });
  kit.track(material);
  const geometry = new T.PlaneGeometry(w, d);
  kit.track({ dispose: () => geometry.dispose() });
  const mesh = new T.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  kit.group.add(mesh);
  return mesh;
}

/** Material del piso circular del vestíbulo: bandas, divisiones radiales y una rosa de los vientos tenue. */
export function radialFloorMaterial(kit) {
  const T = kit.T;
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#12160F'; g.fillRect(0, 0, S, S);
  const m = S / 2;
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.12)';
    g.beginPath(); g.arc(m, m, (i + 1) * 64, 0, Math.PI * 2); g.arc(m, m, i * 64, 0, Math.PI * 2, true); g.fill();
  }
  g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 2;
  for (let a = 0; a < 48; a++) {
    const t = (a / 48) * Math.PI * 2;
    g.beginPath(); g.moveTo(m + Math.cos(t) * 150, m + Math.sin(t) * 150); g.lineTo(m + Math.cos(t) * 505, m + Math.sin(t) * 505); g.stroke();
  }
  g.strokeStyle = 'rgba(255,201,74,0.16)'; g.lineWidth = 3;
  for (let a = 0; a < 8; a++) {
    const t = (a / 8) * Math.PI * 2 + Math.PI / 8;
    g.beginPath(); g.moveTo(m + Math.cos(t) * 60, m + Math.sin(t) * 60); g.lineTo(m + Math.cos(t) * 150, m + Math.sin(t) * 150); g.stroke();
  }
  const map = new T.CanvasTexture(c);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 8;
  const material = new T.MeshStandardMaterial({ map, roughness: 0.9 });
  kit.track(map); kit.track(material);
  return material;
}

/** Degradado de cielo para ventanas (no recibe luz). */
export function skyMaterial(kit, { top = '#0B1A3A', mid = '#27406E', bottom = '#E39A52' } = {}) {
  const T = kit.T;
  const c = document.createElement('canvas');
  c.width = 8; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, top); grad.addColorStop(0.55, mid); grad.addColorStop(1, bottom);
  g.fillStyle = grad; g.fillRect(0, 0, 8, 128);
  const map = new T.CanvasTexture(c);
  map.colorSpace = T.SRGBColorSpace;
  const material = new T.MeshBasicMaterial({ map, toneMapped: false });
  kit.track(map); kit.track(material);
  return material;
}

/** Ventana con marco, travesaños y alféizar. El frente (+z local) mira hacia adentro de la sala. */
export function addWindow(kit, { x, y, z, rotY = 0, w, h, cols = 2, rows = 1, sky = null }) {
  const g = kit.group3([x, y, z], { rotY });
  const frame = '#0B0E09';
  const b = kit.batch();
  const t = 0.09;
  b.box([w + t * 2, t, 0.14], [0, h / 2 + t / 2, 0.03], frame);
  b.box([w + t * 2, t, 0.14], [0, -h / 2 - t / 2, 0.03], frame);
  b.box([t, h, 0.14], [-w / 2 - t / 2, 0, 0.03], frame);
  b.box([t, h, 0.14], [w / 2 + t / 2, 0, 0.03], frame);
  for (let i = 1; i < cols; i++) b.box([0.045, h, 0.1], [-w / 2 + (w * i) / cols, 0, 0.04], frame);
  for (let i = 1; i < rows; i++) b.box([w, 0.045, 0.1], [0, -h / 2 + (h * i) / rows, 0.04], frame);
  b.box([w + 0.34, 0.05, 0.26], [0, -h / 2 - t - 0.025, 0.1], '#3A4533', { rough: 0.7 }); // alféizar
  b.flush(g);
  kit.plane(w, h, [0, 0, 0], '#27406E', { parent: g, material: sky || skyMaterial(kit) });
  return g;
}

/** Puerta con marco, paneles y manija. El frente (+z local) mira hacia adentro. */
export function addDoor(kit, { x, z, rotY = 0, w = 0.95, h = 2.05 }) {
  const g = kit.group3([x, 0, z], { rotY });
  const b = kit.batch();
  const t = 0.07;
  b.box([w + t * 2, t, 0.12], [0, h + t / 2, 0.02], '#0B0E09');
  b.box([t, h + t, 0.12], [-w / 2 - t / 2, (h + t) / 2, 0.02], '#0B0E09');
  b.box([t, h + t, 0.12], [w / 2 + t / 2, (h + t) / 2, 0.02], '#0B0E09');
  b.box([w, h, 0.06], [0, h / 2, 0.0], '#1A1F15', { rough: 0.6 });
  b.box([w * 0.74, h * 0.36, 0.025], [0, h * 0.27, 0.04], '#232B1E');
  b.box([w * 0.74, h * 0.36, 0.025], [0, h * 0.7, 0.04], '#232B1E');
  b.box([w, 0.22, 0.07], [0, 0.11, 0.005], '#3A4533', { metal: 0.3 });               // zócalo de chapa
  b.box([0.05, 0.14, 0.04], [w / 2 - 0.12, 1.0, 0.06], '#FFC94A', { metal: 0.5 });   // manija
  b.box([0.09, 0.3, 0.02], [w / 2 - 0.12, 1.0, 0.045], '#2A3225');
  b.flush(g);
  return g;
}

/** Zócalo alto (revestimiento de pared) y guarda en las paredes laterales y del fondo del público. */
export function addWainscot(kit, room, { color = '#2A3225', rail = '#FFC94A', height = 0.95, back = false, left = true, right = true } = {}) {
  const W = room.maxX - room.minX;
  const D = room.maxZ - room.minZ;
  const cx = (room.minX + room.maxX) / 2;
  const cz = (room.minZ + room.maxZ) / 2;
  const b = kit.batch();
  b.box([W, height, 0.04], [cx, height / 2, room.minZ + 0.02], color, { rough: 0.8 });
  b.box([W, 0.035, 0.06], [cx, height + 0.01, room.minZ + 0.03], rail);
  if (left) {
    b.box([0.04, height, D], [room.minX + 0.02, height / 2, cz], color, { rough: 0.8 });
    b.box([0.06, 0.035, D], [room.minX + 0.03, height + 0.01, cz], rail);
  }
  if (right) {
    b.box([0.04, height, D], [room.maxX - 0.02, height / 2, cz], color, { rough: 0.8 });
    b.box([0.06, 0.035, D], [room.maxX - 0.03, height + 0.01, cz], rail);
  }
  if (back) {
    b.box([W, height, 0.04], [cx, height / 2, room.maxZ - 0.02], color, { rough: 0.8 });
    b.box([W, 0.035, 0.06], [cx, height + 0.01, room.maxZ - 0.03], rail);
  }
  b.flush();
}

/** Techo: luz indirecta en el perímetro, vigas y rejillas de ventilación. */
export function addCeilingDetail(kit, room, H, { beams = true, cove = '#FFE7B0' } = {}) {
  const W = room.maxX - room.minX;
  const D = room.maxZ - room.minZ;
  const cx = (room.minX + room.maxX) / 2;
  const cz = (room.minZ + room.maxZ) / 2;
  const glow = kit.basic(cove);
  const b = kit.batch();
  b.box([W - 0.3, 0.03, 0.07], [cx, H - 0.025, room.minZ + 0.12], cove, { material: glow });
  b.box([W - 0.3, 0.03, 0.07], [cx, H - 0.025, room.maxZ - 0.12], cove, { material: glow });
  b.box([0.07, 0.03, D - 0.3], [room.minX + 0.12, H - 0.025, cz], cove, { material: glow });
  b.box([0.07, 0.03, D - 0.3], [room.maxX - 0.12, H - 0.025, cz], cove, { material: glow });
  if (beams) {
    const nz = Math.max(2, Math.round(D / 1.6));
    const nx = Math.max(2, Math.round(W / 1.8));
    for (let i = 1; i < nz; i++) b.box([W - 0.1, 0.1, 0.07], [cx, H - 0.05, room.minZ + (D * i) / nz], '#0B0E09');
    for (let i = 1; i < nx; i++) b.box([0.07, 0.09, D - 0.1], [room.minX + (W * i) / nx, H - 0.045, cz], '#0B0E09');
  }
  b.flush();
}

/**
 * Afiche enmarcado con arte geométrico de la marca (dibujado en canvas).
 * @param {{ entities: any[], disposers: Function[] }} bag  donde se registran la entidad y su liberación
 */
export function addPoster(kit, bag, { x, y, z, rotY = 0, w = 0.8, h = 1.1, style = 'sun', seed = 1 }) {
  const surface = new CanvasSurface(w, h, 300);
  surface.draw((ctx, W, H) => drawPoster(ctx, W, H, style, mulberry32(seed)));
  const el = document.createElement('a-entity');
  el.setObject3D('mesh', surface.mesh);
  el.object3D.position.set(x, y, z);
  el.object3D.rotation.y = rotY * DEG;
  bag.entities.push(el);
  bag.disposers.push(() => { el.removeObject3D('mesh'); surface.dispose(); el.remove(); });

  // Marco y paspartú: se ubican detrás del arte, apoyados en la pared
  const frame = kit.group3([x, y, z], { rotY });
  const b = kit.batch();
  const t = 0.045;
  b.box([w + t * 2, h + t * 2, 0.03], [0, 0, -0.018], '#0B0E09', { rough: 0.5 });
  b.box([w + t * 2, 0.02, 0.05], [0, -h / 2 - t + 0.01, -0.01], '#FFC94A');
  b.flush(frame);
}

function drawPoster(ctx, W, H, style, rand) {
  const pick = () => PALETTE[Math.floor(rand() * 4)];
  if (style === 'sun') {
    ctx.fillStyle = '#FFC94A'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0047FF'; ctx.beginPath(); ctx.arc(W / 2, H * 0.62, W * 0.36, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#FF006E';
    for (let i = 0; i < 4; i++) ctx.fillRect(0, H * (0.64 + i * 0.07), W, H * 0.035);
    ctx.fillStyle = '#181D16'; ctx.font = `400 ${H * 0.11}px ${FONT.display}`; ctx.textAlign = 'center';
    ctx.fillText('MENOS RUIDO', W / 2, H * 0.14);
  } else if (style === 'blocks') {
    ctx.fillStyle = '#181D16'; ctx.fillRect(0, 0, W, H);
    const cols = 3; const rows = 4; const cw = W / cols; const ch = H / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = pick();
        const x = c * cw; const y = r * ch;
        const kind = Math.floor(rand() * 3);
        if (kind === 0) ctx.fillRect(x + 4, y + 4, cw - 8, ch - 8);
        else if (kind === 1) { ctx.beginPath(); ctx.arc(x + cw / 2, y + ch / 2, Math.min(cw, ch) / 2 - 6, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(x + 4, y + ch - 4); ctx.lineTo(x + cw - 4, y + ch - 4); ctx.lineTo(x + 4, y + 4); ctx.closePath(); ctx.fill(); }
      }
    }
  } else if (style === 'type') {
    ctx.fillStyle = '#181D16'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'left';
    [['MÁS', '#FFFFFF'], ['IDEAS', '#FFC94A'], ['QUE', '#FF006E'], ['RUIDO.', '#FFFFFF']].forEach(([t, c], i) => {
      ctx.fillStyle = c; ctx.font = `400 ${H * 0.2}px ${FONT.display}`; ctx.fillText(t, W * 0.08, H * (0.24 + i * 0.22));
    });
    ctx.fillStyle = '#0047FF'; ctx.fillRect(W * 0.08, H * 0.93, W * 0.5, H * 0.025);
  } else {
    ctx.fillStyle = '#0047FF'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#FFC94A'; ctx.lineWidth = H * 0.012;
    for (let k = 0; k < 9; k++) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 4) {
        const y = H * (0.12 + k * 0.1) + Math.sin(x / W * Math.PI * 2 * (1 + k * 0.15) + k) * H * 0.035;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#FF006E'; ctx.beginPath(); ctx.arc(W * 0.72, H * 0.24, W * 0.12, 0, Math.PI * 2); ctx.fill();
  }
}

/** Torre de parlantes: gabinete, dos woofers y una bocina. Frente hacia +z local. */
export function addSpeaker(kit, { x, y = 0, z, rotY = 0, scale = 1 }) {
  const g = kit.group3([x, y, z], { rotY });
  const b = kit.batch();
  b.box([1.0 * scale, 2.1 * scale, 0.75 * scale], [0, 1.05 * scale, 0], '#0E120B', { rough: 0.55 });
  b.box([1.04 * scale, 0.06 * scale, 0.79 * scale], [0, 2.1 * scale, 0], '#2A3225');
  [0.55, 1.15].forEach((yy) => {
    b.cyl(0.31 * scale, 0.31 * scale, 0.05 * scale, [0, yy * scale, 0.385 * scale], '#1B2016', { rotX: 90, seg: 18 });
    b.cyl(0.12 * scale, 0.19 * scale, 0.08 * scale, [0, yy * scale, 0.4 * scale], '#2F392B', { rotX: 90, seg: 14 });
  });
  b.box([0.7 * scale, 0.22 * scale, 0.06 * scale], [0, 1.7 * scale, 0.385 * scale], '#1B2016');
  b.box([0.74 * scale, 0.02 * scale, 0.04 * scale], [0, 1.55 * scale, 0.4 * scale], '#FFC94A');
  b.flush(g);
  return g;
}

/** Cuña de monitor de escenario (apunta hacia quien presenta). */
export function addMonitorWedge(kit, { x, y = 0, z, rotY = 0 }) {
  const g = kit.group3([x, y, z], { rotY });
  const b = kit.batch();
  b.box([0.8, 0.3, 0.45], [0, 0.17, 0], '#0E120B', { rotX: 28 });
  b.box([0.66, 0.04, 0.3], [0, 0.31, 0.04], '#1B2016', { rotX: 28 });
  b.flush(g);
  return g;
}

/** Haz de luz suave (cono translúcido que no recibe luz) desde un foco hacia el piso. */
export function addLightBeam(kit, { from, to, radius = 1.2, opacity = 0.07, color = '#FFF1C9' }) {
  const T = kit.T;
  const a = new T.Vector3(...from);
  const b = new T.Vector3(...to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const geometry = new T.ConeGeometry(radius, len, 20, 1, true);
  geometry.translate(0, -len / 2, 0); // el vértice queda en el origen y la base hacia -Y
  const material = new T.MeshBasicMaterial({ color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false });
  kit.track({ dispose: () => { geometry.dispose(); material.dispose(); } });
  const mesh = new T.Mesh(geometry, material);
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), dir.normalize());
  kit.group.add(mesh);
  return mesh;
}

export { COLORS };
