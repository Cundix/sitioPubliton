// Capturas del PITCH LIBRE (sin brief; la IA califica la idea y cómo se la vende).
//
// IMPORTANTE: NO llama a ninguna API. La devolución de la IA se INYECTA con un resultado de ejemplo escrito a mano
// (un pitch ficticio sobre una app para repartir gastos), pasado por el mismo normalizador que usa la aplicación.
// Sirve para mostrar la interfaz; las calificaciones de las capturas NO son una respuesta real de Gemini.
//
// Uso:  node tools/serve.mjs 8090   y después   PITCHLAB_URL=http://localhost:8090/pitch-lab/ node tools/shots-libre.mjs capturas

import fs from 'node:fs';
import path from 'node:path';
import { launch, openPage, waitReady } from './browser.mjs';
import { wait, state, waitState, dispatch, resetView, click3D } from '../tests/e2e/helpers.mjs';
import { normalizeFreeAnalysis } from '../js/ai/analysis-prompt.js';

const outDir = path.resolve(process.argv[2] || 'capturas');
fs.mkdirSync(outDir, { recursive: true });

const SAMPLE = normalizeFreeAnalysis({
  audible: true,
  rated: true,
  transcript: 'Hoy les vendo una aplicación para repartir los gastos entre amigos cuando salen de viaje juntos.',
  summary: 'Presenta una aplicación para repartir gastos entre amigos que viajan juntos.',
  topic: 'Una aplicación para repartir los gastos de un viaje entre amigos',
  idea: {
    problem: { rating: 4, quote: 'repartir los gastos entre amigos', note: 'Se entiende el problema: al final del viaje nadie sabe quién debe cuánto.' },
    proposal: { rating: 4, quote: 'una aplicación para repartir', note: 'Queda claro qué se vende; falta mostrar un ejemplo de uso.' },
    audience: { rating: 3, quote: '', note: 'Se nombra a los amigos que viajan, sin aclarar qué tipo de viaje.' },
    value: { rating: 3, quote: '', note: 'Se menciona evitar discusiones, sin compararlo con las planillas que ya se usan.' },
    close: { rating: 2, quote: '', note: 'No hay un siguiente paso: falta decir cómo conseguir la aplicación.' },
    rationale: 'La propuesta se entiende y el problema es cercano; falta la diferencia con lo que ya existe y un cierre concreto.',
  },
  selling: {
    structure: { rating: 3, note: 'Tiene principio y desarrollo, pero el final queda abierto.' },
    persuasion: { rating: 2, note: 'No usa ejemplos, datos ni una historia que apoyen lo que dice.' },
    pace: { rating: 4, note: 'Se percibe un ritmo parejo que permite seguir las ideas.' },
    clarity: { rating: 4, note: 'Se entiende casi todo; algunas palabras se pierden al final de las frases.' },
    voice: { rating: 3, note: 'La entonación varía poco y el volumen es parejo.' },
    pauses: { rating: 3, note: 'Hay pausas cortas entre ideas y dos «eh» a lo largo del discurso.' },
    rationale: 'Se entiende y se sigue bien, pero faltan ejemplos que hagan creíble el beneficio.',
  },
  strengths: ['Problema cercano y claro', 'Ritmo parejo'],
  improvements: [{ advice: 'Cerrá con un paso concreto: cómo se consigue la aplicación.', why: 'El cierre no aparece.' }],
  limitations: ['Solo se evaluó el audio.'],
});

const browser = await launch();
const { page, context } = await openPage(browser, { width: 1600, height: 900 });
try {
  await waitReady(page);
  await dispatch(page, 'START');
  if ((await state(page)) === 'tutorial') await dispatch(page, 'SKIP');
  await dispatch(page, 'PICK_SCENARIO', { id: 'sala' });
  await dispatch(page, 'ENTER');
  await waitState(page, 'brief');
  await resetView(page);
  await click3D(page, 'free-pitch'); // el botón del atril, con clic 3D real
  await wait(500);
  await page.screenshot({ path: path.join(outDir, '68-pitch-libre-brief.png') });

  await dispatch(page, 'PREPARE');
  await dispatch(page, 'SET_INPUT_MODE', { mode: 'timer' });
  await dispatch(page, 'BEGIN');
  await waitState(page, 'presenting');
  await wait(1500);
  await dispatch(page, 'FINISH');
  await waitState(page, 'feedback');
  await resetView(page);
  await dispatch(page, 'SET_PAGE', { page: 2 });
  await wait(400);
  await page.screenshot({ path: path.join(outDir, '72-pitch-libre-sin-ia.png') });

  // Se inyecta el resultado de ejemplo (sin ninguna llamada a la API).
  await page.evaluate((result) => {
    const { session } = window.pitchLab;
    session.capture.aiResult = result;
    session.data.ai = { status: 'done', error: null, model: result.model };
    session.emit('change');
  }, { model: 'ejemplo-sin-api', attempts: [], analysis: SAMPLE });
  await dispatch(page, 'SET_PAGE', { page: 3 });
  await wait(500);
  await page.screenshot({ path: path.join(outDir, '69-pitch-libre-ia-tu-idea.png') });
  await dispatch(page, 'SET_PAGE', { page: 4 });
  await wait(500);
  await page.screenshot({ path: path.join(outDir, '70-pitch-libre-ia-como-la-vendiste.png') });
  await dispatch(page, 'SET_PAGE', { page: 3 });
  await page.keyboard.press('t');
  await wait(500);
  await page.screenshot({ path: path.join(outDir, '71-pitch-libre-panel-de-texto.png') });
  console.log('capturas guardadas en', outDir);
} finally {
  await context.close();
  await browser.close();
}
