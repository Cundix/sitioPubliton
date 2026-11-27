// Sirve el sitio con la IA siempre activa: la clave sale de pitch-lab/.env (GEMINI_API_KEY) y nunca llega al navegador.
process.env.PITCHLAB_PROXY = '1';
await import('./serve.mjs');
