// Cálculo de posiciones de asientos, puntos de teletransporte y zonas caminables.
// Es matemática pura: la usan el constructor de escenas y los tests.

/** Generador pseudoaleatorio con semilla: mismo resultado en cada carga. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Giro (rad) sobre Y para que el frente de un objeto (-z local) mire hacia (tx, tz). */
export function yawToward(x, z, tx = 0, tz = 0) {
  return Math.atan2(-(tx - x), -(tz - z));
}

function seatFloorY(zone, row) {
  return (zone.baseY ?? -0.6) + zone.rise * row;
}

/** Lista de asientos de un escenario con posición, altura de piso, giro y ocupación. */
export function buildSeats(scenario) {
  const a = scenario.audience;
  const seats = [];
  if (a.zones) {
    const rand = mulberry32(2026);
    for (const zone of a.zones) {
      for (let r = 0; r < zone.rows; r++) {
        for (let c = 0; c < zone.cols; c++) {
          const x = zone.x + c * zone.dx;
          const z = zone.z - r * zone.dz;
          const isViewSeat = a.viewSeat && a.viewSeat.zone === zone.id && a.viewSeat.row === r && a.viewSeat.col === c;
          const occupied = !isViewSeat && rand() < (a.occupancy ?? 1);
          seats.push({
            id: `${zone.id}-${r}-${c}`,
            zone: zone.id,
            x, z,
            y: seatFloorY(zone, r),
            yaw: yawToward(x, z, 0, 0),
            occupied,
            view: isViewSeat,
          });
        }
      }
    }
  } else {
    a.seats.forEach((s, i) => {
      seats.push({
        id: `${a.kind}-${i}`,
        zone: a.kind,
        x: s.x, z: s.z, y: 0,
        yaw: yawToward(s.x, s.z, s.faceX ?? 0, s.faceZ ?? 0),
        occupied: true,
        view: false,
      });
    });
  }
  return seats;
}

/** Devuelve el escenario con asientos, zonas y puntos de teletransporte ya resueltos. */
export function resolveScenario(scenario) {
  const seats = buildSeats(scenario);
  const zones = scenario.walk.zones.map((z) => ({ ...z }));
  const pads = scenario.pads.map((p) => ({ ...p, y: p.y ?? 0 }));
  const view = seats.find((s) => s.view);
  if (view) {
    const half = 0.45;
    zones.push({ id: 'publico', y: view.y, rect: { minX: view.x - half, maxX: view.x + half, minZ: view.z - half, maxZ: view.z + half } });
    pads.push({
      id: 'publico',
      label: scenario.audience.viewSeat.label || 'Ver desde el público',
      x: view.x, z: view.z, y: view.y,
      yawDeg: (yawToward(view.x, view.z, 0, 0) * 180) / Math.PI,
      zone: 'publico',
    });
  }
  return { ...scenario, seats, walk: { ...scenario.walk, zones }, pads };
}

// ---------- Zonas caminables ----------

export function insideRect(x, z, r) {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

/** ¿Es válida la posición? Dentro de la zona y fuera de cualquier obstáculo. */
export function isWalkable(x, z, zone, obstacles = []) {
  if (!insideRect(x, z, zone.rect)) return false;
  return !obstacles.some((o) => insideRect(x, z, o));
}

/**
 * Mueve de (x, z) a (nx, nz) respetando límites. Si el paso directo no es válido,
 * prueba deslizarse por un solo eje. Si tampoco, se queda.
 */
export function constrainMove(from, to, zone, obstacles = []) {
  if (isWalkable(to.x, to.z, zone, obstacles)) return { x: to.x, z: to.z };
  if (isWalkable(to.x, from.z, zone, obstacles)) return { x: to.x, z: from.z };
  if (isWalkable(from.x, to.z, zone, obstacles)) return { x: from.x, z: to.z };
  return { x: from.x, z: from.z };
}
