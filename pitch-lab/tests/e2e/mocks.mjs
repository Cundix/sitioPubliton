// Simulaciones para las pruebas automáticas. IMPORTANTE: son MOCKS controlados por el test.
// No son voz real: sirven para comprobar el recorrido, no el reconocimiento de voz del navegador.

/** Reconocimiento simulado que acepta el permiso y permite "decir" frases desde el test. */
export const MOCK_SPEECH_OK = `
(() => {
  const instances = [];
  class MockSpeechRecognition {
    constructor() { instances.push(this); this.running = false; }
    start() { this.running = true; window.__speech.starts++; setTimeout(() => this.onstart && this.onstart(), 20); }
    stop() { this.running = false; window.__speech.stops++; setTimeout(() => this.onend && this.onend(), 20); }
    abort() { this.running = false; window.__speech.aborts++; }
  }
  window.__speech = {
    starts: 0, stops: 0, aborts: 0, instances,
    say(text, isFinal = true) {
      const rec = instances.filter((i) => i.running).pop();
      if (!rec || !rec.onresult) return false;
      const result = Object.assign([{ transcript: text }], { isFinal });
      rec.onresult({ resultIndex: 0, results: [result] });
      return true;
    },
  };
  window.SpeechRecognition = MockSpeechRecognition;
  window.webkitSpeechRecognition = MockSpeechRecognition;
})();`;

/** Reconocimiento simulado que rechaza el permiso del micrófono. */
export const MOCK_SPEECH_DENIED = `
(() => {
  class MockSpeechRecognition {
    start() { window.__speech.starts++; setTimeout(() => this.onerror && this.onerror({ error: 'not-allowed' }), 20); }
    stop() {}
    abort() {}
  }
  window.__speech = { starts: 0 };
  window.SpeechRecognition = MockSpeechRecognition;
  window.webkitSpeechRecognition = MockSpeechRecognition;
})();`;

/** Navegador sin reconocimiento de voz. */
export const MOCK_SPEECH_ABSENT = `
(() => {
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
  Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
  Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
})();`;
