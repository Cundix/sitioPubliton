// Aviso de tiempo durante la presentación.
//
// Devuelve un nivel según los segundos que quedan:
//   'ok'      -> hay tiempo
//   'warning' -> quedan pocos segundos
//   'final'   -> cuenta final
//   'none'    -> no hay límite de tiempo (práctica libre)
//
// El reloj, las señales visuales y los sonidos usan este nivel.
// Los umbrales salen de APP_CONFIG.timeWarnings (en segundos).

import { APP_CONFIG } from '../config/app-config.js';

export function getTimeWarning(remainingSec, totalSec, thresholds = APP_CONFIG.timeWarnings) {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return 'none';
  if (remainingSec <= thresholds.finalSec) return 'final';
  if (remainingSec <= thresholds.warnSec) return 'warning';
  return 'ok';
}

/** Texto corto y no dependiente del color para cada nivel. */
export const WARNING_LABELS = {
  none: 'SIN LÍMITE',
  ok: 'EN TIEMPO',
  warning: 'POCO TIEMPO',
  final: 'CUENTA FINAL',
};
