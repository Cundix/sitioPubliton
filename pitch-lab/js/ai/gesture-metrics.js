// Resumen de gestos de las manos a partir de puntos de referencia (landmarks) detectados en el dispositivo.
// Matemática pura (sin cámara ni DOM): se prueba en Node.
//
// QUÉ SE MIDE (solo si la persona activó la cámara):
//   - manos visibles: % de cuadros en los que se detectó al menos una mano;
//   - movimiento de manos: velocidad media del centro de cada mano (en anchos de imagen por segundo).
// QUÉ NO SE MIDE: emociones, expresividad, "calidad" del gesto ni intención. Un movimiento mayor no es "mejor".
// LIMITACIONES: depende de que la persona esté en cuadro, de la luz y del ángulo de la cámara; los umbrales
// de "poco / moderado / mucho" son una referencia provisoria, sin calibrar con datos reales.

import { APP_CONFIG } from '../config/app-config.js';

// Puntos de la muñeca y la base de cada dedo (MediaPipe Hands: 0, 5, 9, 13, 17).
const PALM_POINTS = [0, 5, 9, 13, 17];

export function handCenter(landmarks) {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const i of PALM_POINTS) {
    const p = landmarks[i];
    if (p) { x += p.x; y += p.y; n += 1; }
  }
  return n ? { x: x / n, y: y / n } : null;
}

export const MOVEMENT_LABELS = { low: 'poco', moderate: 'moderado', high: 'mucho' };

export class GestureAccumulator {
  /**
   * @param {object} opts
   * @param {number} opts.aspect  alto / ancho de la imagen (para medir distancias en anchos de imagen)
   */
  constructor({ aspect = 9 / 16, config = APP_CONFIG.gestures } = {}) {
    this.aspect = aspect;
    this.config = config;
    this.frames = 0;
    this.framesWithHands = 0;
    this.framesWithTwoHands = 0;
    this.speedSum = 0;
    this.speedCount = 0;
    this._prev = null; // { t, centers }
    this.firstT = null;
    this.lastT = null;
  }

  /** Corta la continuidad (por ejemplo, al pausar) para no medir movimiento a través de la pausa. */
  breakContinuity() { this._prev = null; }

  /**
   * @param {number} tSec   tiempo del cuadro en segundos
   * @param {Array<Array<{x:number,y:number}>>} hands  puntos de cada mano detectada (puede ser [])
   */
  addFrame(tSec, hands) {
    this.frames += 1;
    if (this.firstT == null) this.firstT = tSec;
    this.lastT = tSec;
    const centers = (hands || []).map(handCenter).filter(Boolean);
    if (centers.length > 0) this.framesWithHands += 1;
    if (centers.length > 1) this.framesWithTwoHands += 1;

    const prev = this._prev;
    if (prev && centers.length > 0 && prev.centers.length > 0) {
      const dt = tSec - prev.t;
      if (dt > 0 && dt <= this.config.maxGapSec) {
        // Se empareja cada mano actual con la más cercana del cuadro anterior.
        for (const c of centers) {
          let best = Infinity;
          for (const p of prev.centers) {
            const d = Math.hypot(c.x - p.x, (c.y - p.y) * this.aspect);
            if (d < best) best = d;
          }
          // Un salto enorme es casi seguro un cambio de mano o una detección errónea: se descarta.
          if (best < 0.6) { this.speedSum += best / dt; this.speedCount += 1; }
        }
      }
    }
    this._prev = { t: tSec, centers };
  }

  /** Resumen. `measured` es false si no hay cuadros suficientes (menos de 3 segundos de datos). */
  summary() {
    const { moveLowMax, moveHighMin } = this.config;
    const durationSec = this.firstT == null ? 0 : this.lastT - this.firstT;
    const measured = this.frames >= 8 && durationSec >= 3;
    const meanSpeed = this.speedCount > 0 ? this.speedSum / this.speedCount : 0;
    const level = meanSpeed < moveLowMax ? 'low' : meanSpeed > moveHighMin ? 'high' : 'moderate';
    return {
      measured,
      frames: this.frames,
      durationSec: Math.round(durationSec * 10) / 10,
      handsVisibleShare: this.frames ? this.framesWithHands / this.frames : 0,
      twoHandsShare: this.frames ? this.framesWithTwoHands / this.frames : 0,
      meanSpeed: Math.round(meanSpeed * 1000) / 1000,
      movementSamples: this.speedCount,
      movementLevel: level,
      movementLabel: MOVEMENT_LABELS[level],
    };
  }
}
