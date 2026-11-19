# STATUS — Publitón Pitch Lab

_Última actualización: 2026-11-13 (se sumó el análisis con IA y la cámara)._

## Publicación

| Ítem | Estado |
|---|---|
| Código en el repositorio (`main`) | **Subido** a `main` sin `--force`; Pages construyó los commits subidos («built»). La verificación se hizo sobre `df6fd36` y sobre el último commit (`6316c7f`) |
| Enlace público | <https://cundix.github.io/sitioPubliton/pitch-lab/> — **publicado y verificado el 2026-11-04** (HTTP 200 en los recursos, 8/8 pruebas e2e contra el enlace real, sitio anterior intacto) |
| **Versión con IA y cámara (2026-11-13)** | **Publicada** (push a `main` sin `--force`, commit `05013f3`; Pages «built»). Verificado: HTTP 200 con el tipo correcto en los archivos nuevos (incluidos `hand_landmarker.task` y `vision_wasm_internal.wasm`) y 3 pruebas de navegador real contra el enlace publicado (recorrido de grabación y análisis con API simulada, cámara con MediaPipe servido desde Pages, política de conexiones). **No** se probó la API real desde el dominio publicado (la clave temporal ya se borró); el CORS desde `cundix.github.io` se había verificado antes con llamadas reales |
| Qué NO está verificado | Uso en un casco físico y voz real (ver «Falta») |

## Terminado (y cómo se comprobó)

- **Experiencia completa** en `pitch-lab/`: hub con maquetas, tres escenarios (Sala de ensayo 60 s, Reunión con cliente 90 s, Auditorio 120 s), tres briefs ficticios, tutorial salteable, preparación ajustable, presentación con reloj, pausa, finalizar, cancelar con confirmación, devolución y reintento. → pruebas de navegador real (21/21).
- **Voz opcional** con alternativas (sin micrófono, permiso rechazado, reconocimiento no disponible, silencio), transcripción revisable con origen, medición de nivel de audio opcional. → pruebas con **simulaciones** de voz (voz real: pendiente).
- **Devolución transparente**: medidas con su origen, «Indicador técnico orientativo» con fórmula visible y «Sin datos suficientes», rúbrica de autoevaluación, consejos basados en datos, revisión humana. → 77 pruebas de unidad.
- **WebXR**: botón «Entrar en VR», rayo de controles y manos (target ray), teletransporte, recentrado, modo sentado, salida de VR. → **emulador** (8/8). **Casco físico: pendiente.**
- **Accesibilidad**: panel de texto espejo, teclado completo, foco visible, `aria-live`, movimiento reducido, volumen.
- **Documentación** (`docs/`), **informe 16:9** (`informe/informe-pitch-lab.pdf`, 21 páginas), **material para Figma** (`informe/figma/`), **guion de 5 minutos**, **guía de intervención manual**, **capturas** (`capturas/`).

- **Análisis con IA y cámara (2026-11-13, opcional)**: la IA (Gemini, `gemini-3.5-flash-lite` con respaldo `gemini-3.1-flash-lite`) analiza el **audio** frente al brief y describe la entrega; la cámara mide **gestos de manos en el dispositivo** (MediaPipe). Clave **propia de cada persona**, nunca en el repositorio; audio solo en memoria; solo cifras de la cámara; política CSP. → 150 pruebas de unidad, 10 recorridos en navegador real con la API **simulada**, y **3 corridas con la API real** (audio sintético). Ver `docs/analisis-con-ia.md`.
- Se descartó el tope de 5 minutos de preparación (pedido de la persona usuaria): sigue de 0 a 300 s.

## En curso

Nada abierto en el código. Ver «Falta» para lo que no puede cerrar la herramienta.

## Falta (no lo puede cerrar la herramienta)

0. **Revocar la clave de Gemini que se pegó en el chat** (AI Studio → API keys) y crear otra solo para las pruebas del equipo. Se usó únicamente desde la computadora de trabajo y no está en el repositorio, pero quedó en el historial de la conversación.
0. **Consultar el límite diario (RPD)** de la clave en AI Studio → *Rate limits*: decide si alcanzan ~50 jugadas por día. Los límites por minuto/tokens los informó el equipo (15 pedidos/min, 250.000 tokens/min) y no se pudieron verificar desde aquí. Se midieron ≈2.350–2.460 tokens por jugada de 37 s.
0. **Probar el análisis con voz humana real** y con personas expertas que comparen la devolución; probar **manos reales** ante la cámara (solo se verificó con una cámara de prueba sin manos). Ver `docs/evaluacion-semantica-futura.md`.
1. **Probar en un casco físico** y anotar comodidad, legibilidad y altura (modo sentado). No se afirma rendimiento ni cuadros por segundo.
2. **Intervención manual del equipo** (antes/después reales): guía en `docs/intervencion-manual.md`.
3. **Informe interactivo en Figma**: armarlo con `informe/figma/` (el plugin oficial de Figma no estaba habilitado en la cuenta; está preparado `informe/figma/slides-spec.json`). El informe HTML/PDF ya refleja la función de IA (21 diapositivas).
4. **Imágenes de los referentes** para el informe (una captura por referente, con cita).
5. **Validar el público** (hoy es una hipótesis de diseño) con entrevistas o pruebas de uso.
6. **Voz real** en Chrome/Edge y pruebas en Firefox, Safari y celulares.
7. Bitácora de prompts: sumar los de los TPs anteriores y los que el equipo use (los de esta sesión están en `docs/bitacora-prompts.md`).
8. Opcional: enlace desde el sitio principal hacia `/pitch-lab/` (no se modificó ningún archivo existente).

## Bloqueos

- **Casco físico**: no disponible en este entorno (bloqueo externo; queda pendiente explícito).
- **Figma**: sin acceso desde este entorno (falta instalar y autorizar el plugin oficial de Figma).
- Ningún bloqueo técnico abierto.

## Próximos pasos concretos

1. Abrir el enlace publicado en un casco y recorrer una sesión completa; registrar lo observado en `docs/pruebas.md`.
2. Hacer la intervención manual (elegir A, B o C) y completar la plantilla de `docs/intervencion-manual.md`.
3. Armar el informe en Figma desde `informe/figma/` y completar las diapositivas marcadas «pendiente».
4. Ensayar la exposición con `docs/guion-exposicion.md` (plan B incluido).

## Comandos para retomar

```bash
cd sitioPubliton/pitch-lab
npm install                                           # solo la primera vez
npm test                                              # 150 pruebas de unidad
node tools/serve.mjs                                  # http://localhost:8080/pitch-lab/ (si el 8080 está ocupado: node tools/serve.mjs 8090 y PITCHLAB_URL)
MSYS_NO_PATHCONV=1 node tools/serve.mjs 8081 /sitioPubliton   # ruta de GitHub Pages (otra terminal)
npm run test:e2e                                      # 21 pruebas con navegador real (~2 min)
node tests/e2e/xr.mjs                                 # 8 pruebas con emulador WebXR
node tests/e2e/ai.mjs                                 # 10 pruebas de IA y cámara (API simulada, ≈5 min)
node tools/shots-ia.mjs capturas                      # capturas de estados de IA (API simulada)
# Manual con TU clave (gasta cuota): GEMINI_API_KEY_FILE=… PITCHLAB_FAKE_MIC=… node tests/e2e/ia-real.mjs
node tools/qa-shots.mjs capturas 1600 900             # capturas
node tools/build-informe.mjs                          # PDF + PNG del informe
```

## Mapa rápido

- Configuración editable: `js/config/` (briefs, escenarios, tiempos, muletillas).
- Lógica: `js/core/` · Voz: `js/voice/` · IA y cámara: `js/ai/` · Espacios: `js/scenes/` · Interfaz: `js/ui/` · Componentes A-Frame: `js/components/`.
- Documentos: `docs/` (arquitectura, métricas, decisiones, pruebas, problemas, prompts, intervención, guion, referentes, **análisis con IA**).
