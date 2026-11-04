// Escenarios. Los tres comparten la misma lógica de sesión y se diferencian
// por esta configuración: tiempos, tamaño del espacio y disposición del público.
//
// Sistema de coordenadas de cada escenario (en metros):
//   - El origen (0, 0, 0) es el ATRIL. La persona empieza detrás (z positivo)
//     mirando hacia -z, donde está el público.
//   - x: derecha (+) / izquierda (-). y: altura. z: hacia atrás (+) / adelante (-).
//   - room: límites de las paredes. walk: zona caminable con obstáculos.

export const SCENARIOS = [
  {
    id: 'sala',
    name: 'Sala de ensayo',
    short: 'Para aprender la mecánica',
    description: 'Un cuarto pequeño con tres oyentes cerca. Ambiente tranquilo para practicar.',
    spaceNote: 'Espacio chico · 3 oyentes · a unos 2 metros',
    durationSec: 60,
    prepSec: 45,
    room: { minX: -2.8, maxX: 2.8, minZ: -3.9, maxZ: 3.3, height: 2.8 },
    walk: {
      zones: [{ id: 'atril', y: 0, rect: { minX: -2.3, maxX: 2.3, minZ: -1.2, maxZ: 2.5 } }],
      obstacles: [{ minX: -0.8, maxX: 0.8, minZ: -0.45, maxZ: 0.5 }], // atril
    },
    spawn: { x: 0, z: 1.4, yawDeg: 0 },
    pads: [
      { id: 'atril', label: 'Atril', x: 0, z: 1.4, yawDeg: 0, zone: 'atril' },
    ],
    audience: {
      kind: 'sala',
      seats: [
        { x: -1.4, z: -2.15 }, { x: 0.05, z: -2.4 }, { x: 1.45, z: -2.1 },
      ],
    },
    theme: { wall: '#20261C', accent: '#0047FF', floor: '#14180F', lamp: '#FFC94A' },
  },
  {
    id: 'cliente',
    name: 'Reunión con cliente',
    short: 'Cercanía y foco en el beneficio',
    description: 'Una mesa de reunión con cinco personas muy cerca. Se nota cada mirada.',
    spaceNote: 'Sala mediana · mesa · 5 personas a 1 o 2 metros',
    durationSec: 90,
    prepSec: 60,
    room: { minX: -4.2, maxX: 4.2, minZ: -6.2, maxZ: 3.4, height: 3.0 },
    walk: {
      zones: [{ id: 'atril', y: 0, rect: { minX: -3.4, maxX: 3.4, minZ: -0.6, maxZ: 2.5 } }],
      obstacles: [
        { minX: -0.8, maxX: 0.8, minZ: -0.45, maxZ: 0.5 },     // atril
        { minX: -0.9, maxX: 0.9, minZ: -4.7, maxZ: -0.95 },     // mesa
      ],
    },
    spawn: { x: 0, z: 1.4, yawDeg: 0 },
    pads: [
      { id: 'atril', label: 'Atril', x: 0, z: 1.4, yawDeg: 0, zone: 'atril' },
    ],
    audience: {
      kind: 'cliente',
      seats: [
        { x: -1.2, z: -1.7, faceX: 0.2 }, { x: 1.2, z: -1.7, faceX: -0.2 },
        { x: -1.2, z: -3.1, faceX: 0.2 }, { x: 1.2, z: -3.1, faceX: -0.2 },
        { x: 0, z: -5.1, faceX: 0 },
      ],
    },
    theme: { wall: '#2A3225', accent: '#FF006E', floor: '#161B12', lamp: '#FFC94A' },
  },
  {
    id: 'auditorio',
    name: 'Auditorio',
    short: 'Escala grande y público repartido',
    description: 'Un escenario frente a una platea, dos alas laterales y un balcón.',
    spaceNote: 'Espacio grande · escenario elevado · público en 4 zonas',
    durationSec: 120,
    prepSec: 90,
    room: { minX: -15, maxX: 15, minZ: -26, maxZ: 5.2, height: 10 },
    walk: {
      zones: [{ id: 'atril', y: 0, rect: { minX: -5.2, maxX: 5.2, minZ: -1.9, maxZ: 3.6 } }],
      obstacles: [{ minX: -0.8, maxX: 0.8, minZ: -0.45, maxZ: 0.5 }], // atril
    },
    spawn: { x: 0, z: 1.4, yawDeg: 0 },
    pads: [
      { id: 'atril', label: 'Atril', x: 0, z: 1.4, yawDeg: 0, zone: 'atril' },
    ],
    audience: {
      kind: 'auditorio',
      // Zonas: [x0, z0, columnas, filas, separación x, separación z, inclinación por fila]
      zones: [
        { id: 'centro', x: -4.2, z: -8.5, cols: 9, rows: 6, dx: 1.05, dz: 1.15, rise: 0.22 },
        { id: 'izquierda', x: -12.6, z: -6.2, cols: 3, rows: 4, dx: 1.05, dz: 1.2, rise: 0.2 },
        { id: 'derecha', x: 9.4, z: -6.2, cols: 3, rows: 4, dx: 1.05, dz: 1.2, rise: 0.2 },
        { id: 'balcon', x: -5.0, z: -18.6, cols: 10, rows: 2, dx: 1.1, dz: 1.2, rise: 0.3, baseY: 3.2 },
      ],
      // Asiento libre desde el que se puede mirar el escenario (punto de teletransporte).
      viewSeat: { zone: 'centro', row: 4, col: 4, label: 'Ver desde el público' },
      // Fracción de asientos ocupados (el resto queda vacío, con un patrón fijo y repetible).
      occupancy: 0.72,
    },
    theme: { wall: '#1B2018', accent: '#0047FF', floor: '#10140D', lamp: '#FFC94A' },
  },
];

export function getScenario(id) {
  return SCENARIOS.find((s) => s.id === id) || null;
}
