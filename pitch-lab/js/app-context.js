// Contexto compartido de la aplicación. Se completa en main.js ANTES de crear la escena,
// y los componentes de A-Frame lo leen. Evita variables globales sueltas.

export const app = {
  session: null,     // Session (estados y tiempos)
  settings: null,    // Settings (volumen, movimiento reducido, sentado)
  hub: null,         // UIHub (modelo de pantalla actual)
  caps: null,        // capacidades del navegador
  cues: null,        // avisos sonoros
  scene: null,       // <a-scene>
  haptics: null,     // vibración de los controles (Haptics)
  personas: null,    // docentes en 3D en el público: { ready(): Promise, setRandom(fn) } (para pruebas y capturas)
  walk: null,        // componente walk-rig
  stage: null,       // componente stage-controller (entorno vigente)
  overlay: null,     // panel de texto accesible (HtmlOverlay)
  xr: { supported: false, reason: '', active: false },
  /** Ejecuta una acción de botón (3D o HTML). La define main.js. */
  pressAction: () => {},
};
