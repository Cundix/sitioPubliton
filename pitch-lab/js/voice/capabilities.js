// Detección de capacidades reales del navegador. No se asume nada: se pregunta.

export function getSpeechRecognitionCtor(win = globalThis) {
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function detectCapabilities(win = globalThis) {
  const nav = win.navigator || {};
  return {
    speech: !!getSpeechRecognitionCtor(win),
    mediaDevices: !!(nav.mediaDevices && nav.mediaDevices.getUserMedia),
    secureContext: win.isSecureContext !== false,
    webxr: !!nav.xr,
    audioContext: !!(win.AudioContext || win.webkitAudioContext),
  };
}

/**
 * ¿Se puede abrir una sesión inmersiva? Devuelve un motivo en español cuando no.
 * Importante: "soportado" no significa que se haya probado en un casco físico.
 */
export async function detectImmersive(win = globalThis) {
  const nav = win.navigator || {};
  if (win.isSecureContext === false) {
    return { supported: false, reason: 'El modo inmersivo requiere una conexión segura (HTTPS) o localhost.' };
  }
  if (!nav.xr) {
    return { supported: false, reason: 'Este navegador no ofrece WebXR. Podés usar la experiencia con mouse y teclado.' };
  }
  try {
    const ok = await nav.xr.isSessionSupported('immersive-vr');
    return ok
      ? { supported: true, reason: '' }
      : { supported: false, reason: 'No se detectó un casco VR compatible. Podés usar la experiencia con mouse y teclado.' };
  } catch (error) {
    return { supported: false, reason: 'No se pudo consultar el modo inmersivo en este navegador.' };
  }
}

/** Estado del permiso de micrófono sin disparar ningún pedido. 'unknown' si el navegador no lo informa. */
export async function queryMicPermission(win = globalThis) {
  try {
    const status = await win.navigator.permissions.query({ name: 'microphone' });
    return status.state; // 'granted' | 'denied' | 'prompt'
  } catch {
    return 'unknown';
  }
}
