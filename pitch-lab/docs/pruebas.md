# Pruebas: resultados observados y pendientes

Se separan **tres niveles** que no deben confundirse:

| Nivel | Qué es | Dónde |
|---|---|---|
| **A. Revisión de código y pruebas de unidad** | Lógica sin navegador (Node) | `npm test` |
| **B. Navegador real automatizado** | Microsoft Edge 156 controlado con Playwright, **mouse y teclado reales**, WebGL por software (SwiftShader), voz con **simulaciones** | `tests/e2e/run.mjs` |
| **C. Emulación de WebXR** | Emulador IWER (Meta Quest 3 simulado). **No es un casco físico** | `tests/e2e/xr.mjs` |
| **B2. IA y cámara en navegador real** | Edge 156, micrófono y cámara **falsos** del navegador (un archivo de audio de prueba), MediaPipe real, API de Gemini **simulada** | `tests/e2e/ai.mjs` |
| **E. API real de Gemini** | Llamadas reales con una clave del equipo, **solo manual y desde una computadora de trabajo** | `tests/e2e/ia-real.mjs` y scripts de verificación |
| **D. Casco físico / voz real / personas usuarias** | **No realizado** | — |

Última ejecución de A, B, B2 y C: **2026-11-19**, con los modelos 3D mejorados y los briefs nuevos (B ya se había corrido el 2026-11-04 y el 2026-11-13). Salidas guardadas en `tests/e2e/ultimo-resultado.json` y
`tests/e2e/ultimo-resultado-xr.json`; mediciones de recursos 3D en `tests/e2e/recursos-3d.json`.

## Resumen

| Nivel | Resultado |
|---|---|
| A. Pruebas de unidad | **158 / 158** correctas (76 previas + 74 de IA y cámara + 2 de ambientación 3D + 6 de briefs; se eliminó 1 de una interfaz vacía) |
| B. Navegador real | **21 / 21** correctas (incluye una sesión real de 60 s), repetidas el 2026-11-13 con la función de IA presente |
| B2. IA y cámara en navegador real | **10 / 10** correctas (Gemini simulado) |
| C. Emulador WebXR | **8 / 8** correctas |
| D. Casco físico | **PENDIENTE** (sin casco disponible) |

## Checklist del encargo (16 puntos)

Leyenda: ✅ verificado con el nivel indicado · ⚠️ verificado parcialmente · ⏳ pendiente

| # | Punto | Estado | Cómo se verificó (y qué se observó) |
|---|---|---|---|
| 1 | Carga inicial | ✅ B | Prueba 1: la página llega a «inicio» sin errores de consola ni de red; Anton y Barlow cargan; **ningún recurso sale del origen propio** |
| 2 | Acceso a los tres escenarios | ✅ B | Prueba 2: se construye cada espacio, con 3, 5 y 64 personas; prueba 3b: elegir por **clic en la maqueta 3D** y por la opción del panel |
| 3 | Tutorial y navegación | ✅ B | Prueba 3: tutorial con clics 3D reales (3 pasos); W A S D avanzan, el atril **bloquea el paso**, no se sale de la zona, Q gira y R recentra |
| 4 | Inicio, pausa, continuación y finalización | ✅ B | Prueba 4 (clics 3D): en pausa el tiempo **no corre**; finalizar lleva a la devolución |
| 5 | Cancelación y reinicio sin estado residual | ✅ A+B | Pruebas 5 y de unidad: confirmación con tiempo detenido, `Esc` para cancelar/seguir, sin temporizador activo, transcripción vacía y tiempo en 0, **ninguna sesión continúa** |
| 6 | Temporizador correcto | ✅ A+B | Unidad: tiempo por marcas de reloj, sin pausas, un solo temporizador. e2e largo: **60 s reales**, avisos con 20 y 10 s restantes, cierre automático a los 60 s (59–64 s medidos) |
| 7 | Micrófono aceptado | ⚠️ B (simulado) | Prueba 6 con un **reconocedor simulado**: el permiso se pide solo al comenzar, hay aviso previo de servicio externo, la transcripción llega y es revisable/editable con origen. **Voz real: pendiente** |
| 8 | Micrófono rechazado | ⚠️ B (simulado) | Prueba 7: «Sin acceso al micrófono», **no vuelve a pedir** solo, se continúa con temporizador. Además, durante las capturas se observó con el navegador **real** (permiso de micrófono sin conceder) que la API de permisos informó `denied` y la app mostró «Sin acceso al micrófono» con la alternativa sin voz |
| 9 | Reconocimiento no disponible | ✅ B | Prueba 8 simulando su ausencia: la opción se deshabilita («Micrófono: no disponible»), el panel lo marca `aria-disabled`, se practica con temporizador |
| 10 | Sesión sin voz | ✅ B | Prueba 4: devolución con duración, «SIN VOZ», autoevaluación y «Sin datos suficientes» |
| 11 | Silencio o transcripción vacía | ✅ B | Prueba 9: aviso «No se reconoció voz», se puede cargar texto de **DEMOSTRACIÓN** (rotulado, sin palabras por minuto ni indicador) o continuar vacío |
| 12 | Devolución con y sin datos | ✅ A+B | Con datos (prueba larga): 54 palabras en 60 s → indicador calculado y fórmula visible; sin datos: «Sin datos suficientes». La captura con datos usa texto de un **simulador** |
| 13 | Reintento y cambio de escenario | ✅ B | Prueba 10: reintentar vuelve a la preparación **sin arrastrar transcripción**; cambiar de escenario reconstruye otro espacio con su tiempo (120 s) |
| 14 | Rutas y recursos desde la carpeta de GitHub Pages | ✅ B + sitio publicado | Prueba 16 sirviendo bajo **`/sitioPubliton/pitch-lab/`**: todos los recursos salen de `/sitioPubliton/` (incluida `../assets/Anton-Regular.ttf`). **Verificado además en el sitio publicado** (sección siguiente) |
| 15 | Controles espaciales preparados para VR | ⚠️ C (emulador) | Sesión inmersiva emulada: entra y sale; los controles tienen rayo y cursor; un control emulado **apunta al botón del atril y el gatillo lo activa**; teletransporte; modo sentado solo en VR. **Casco físico: pendiente** |
| 16 | Acceso al sitio anterior sin regresiones | ✅ B | Prueba 17: carga el sitio original (título, h1 y diálogo de reserva funcionan); `git status` solo muestra `pitch-lab/` como contenido nuevo (ningún archivo existente modificado) |

## Modelos 3D y briefs (2026-11-19)

| Qué se verificó | Estado | Con qué y qué se observó |
|---|---|---|
| Los tres espacios y el vestíbulo se construyen y se liberan sin errores de consola ni fugas | ✅ B | Pruebas 2, 11, 12 y 15 de `tests/e2e/run.mjs` (geometrías y texturas del vestíbulo no crecen al ir y volver) |
| **Presupuesto de geometría** (< 200 llamadas y < 80.000 triángulos por espacio) | ✅ B | Prueba 15: vestíbulo 104 / 14 mil, sala 102 / 3,8 mil, reunión 124 / 6,4 mil, auditorio 131 / 42 mil (llamadas / triángulos) |
| Modo inmersivo con los modelos nuevos | ✅ C (emulador) | `tests/e2e/xr.mjs` 8 / 8 |
| Aspecto: público, salas, atril, auditorio y vestíbulo | ✅ capturas | Comparación antes/después con cámaras fijas en [`../capturas/3d/`](../capturas/3d/) |
| Briefs: 11 completos, ficticios, únicos, con largos que entran en pantalla; sorteo inicial y recorrido | ✅ A | `tests/unit/briefs.test.js` (6) y revisión visual de los 11 en el panel y en la pantalla de pared |
| **Rendimiento en un casco** con los modelos nuevos | ⏳ **No medido** | Con WebGL por software la versión nueva costó más; se recortó (ver `modelos-3d.md`) y quedó cerca de la anterior en vestíbulo y sala. No equivale a un casco |

## Análisis con IA y cámara (2026-11-13)

Función **opcional**; ver [`analisis-con-ia.md`](analisis-con-ia.md). Leyenda de la columna «Con qué»: **simulado** = la respuesta de Gemini
la controla la prueba; **real** = llamada a la API de Gemini con una clave del equipo (solo manual, desde una computadora de trabajo).

| # | Qué se verificó | Estado | Con qué y qué se observó |
|---|---|---|---|
| I1 | Cliente de la API: pedido (modelo, cabecera de la clave, audio en `inlineData`, esquema), respaldo ante 429/404/5xx/tiempo, sin reintento ante clave inválida, errores claros, la clave nunca aparece | ✅ A | 33 pruebas con `fetch` simulado (cliente, prompt, clave, gestos, audio) |
| I2 | Validación y saneamiento de la respuesta de la IA (recorte, valores fuera de lo permitido, HTML malicioso, **observaciones con emociones reemplazadas**) | ✅ A | Pruebas de unidad y de pantalla: todo el texto de la IA se escapa |
| I3 | Sesión con IA: permisos, grabación, pausa, resultado, fallos, reintento con la grabación en memoria, resultados tardíos ignorados, cancelación, reinicio | ✅ A | 25 pruebas con una IA falsa controlable |
| I4 | Captura de audio y de manos con permisos que llegan **después de cancelar**, modelo que termina de cargar tras cerrar, tope de duración, línea de tiempo al pausar | ✅ A | 16 pruebas con un navegador simulado (incluye dos fallos reales corregidos) |
| I5 | Recorrido completo en navegador real: micrófono de prueba → WAV 16 kHz mono con sonido → Gemini → devolución con pestañas nuevas; privacidad (clave solo en `sessionStorage`, nada en disco/IndexedDB, solo hosts permitidos); errores y reintento; respaldo; clave rechazada; cancelaciones; CSP | ✅ B2 (simulado) | `tests/e2e/ai.mjs` |
| I6 | Cámara: el modelo de manos y el runtime se cargan del propio sitio, se miden cuadros, se libera la cámara y **no se contacta a ningún host externo** | ⚠️ B2 | Cámara **de prueba** del navegador (patrón verde, **sin manos**): se verificó la tubería y las cifras (0 % de manos), **no** la detección de manos reales |
| I7 | Interfaz completa con la **API real**: clave escrita en el campo → prueba de la clave real → grabación → análisis real → devolución | ✅ E | 3 corridas de `tests/e2e/ia-real.mjs` sobre un audio **sintético** en español: ≈24–31 s; una cayó al modelo de respaldo por un 503 |
| I8 | Calidad y acierto del análisis, con **voz humana real** | ⏳ | **No verificado**: hace falta comparar con la opinión de personas expertas |
| I9 | Detección de **manos reales** y calibración de los umbrales de movimiento | ⏳ | **No verificado** |
| I10 | Grabación y cámara dentro de un **casco físico** (y que la clave se cargue antes de entrar) | ⏳ | **No verificado** |
| I11 | **Límite diario** de pedidos de la clave del equipo | ⏳ | Se ve solo en AI Studio con sesión iniciada |

Hallazgos de estas pruebas (corregidos, con su comprobación): [`problemas-resueltos.md`](problemas-resueltos.md), problemas 9 a 14.

## Verificación de la publicación (2026-11-04)

Se subió a `main` (commits sin `--force`) y GitHub Pages («legacy», raíz de `main`) construyó el commit `df6fd36`
con estado **built**. Verificado después con consultas HTTP y con el navegador automatizado contra el enlace real:

| Comprobación | Resultado |
|---|---|
| `https://cundix.github.io/sitioPubliton/pitch-lab/` y sus recursos (`js/main.js`, `vendor/aframe-1.8.0.min.js`, `css/pitch-lab.css`) | **200** con el tipo de contenido correcto |
| Tipografías y favicon reutilizados (`/assets/Anton-Regular.ttf`, `Barlow-Bold.ttf`, `favicon.svg`) | **200** |
| Informe PDF y capturas servidos desde `/pitch-lab/informe/` y `/pitch-lab/capturas/` | **200** |
| Sitio anterior `https://cundix.github.io/sitioPubliton/` | **200**, mismo tamaño que antes (13 845 bytes) |
| Pruebas e2e contra el **enlace publicado**: carga inicial, tres escenarios, tutorial y navegación, sesión sin voz, micrófono aceptado (simulado), teletransporte, panel de texto accesible y sitio anterior | **8 / 8** correctas (resultado en `tests/e2e/ultimo-resultado-publicado.json`) |

Sigue pendiente verificar el enlace publicado **dentro de un casco físico** y con **voz real**.

### Publicación de la versión con IA y cámara (2026-11-13)

Se subió a `main` sin `--force` (`39471ed..05013f3`, encima del rediseño del sitio que había subido el equipo) y Pages construyó el commit
`05013f3` («built»). Verificado con consultas HTTP y con el navegador automatizado contra el enlace real:

| Comprobación | Resultado |
|---|---|
| `js/main.js`, `js/ai/gemini-client.js`, `js/ai/analysis-service.js`, `vendor/mediapipe/vision_bundle.mjs`, `docs/analisis-con-ia.md` y una captura | **200** con el tipo de contenido correcto |
| `vendor/mediapipe/wasm/vision_wasm_internal.wasm` (14,7 MB) y `hand_landmarker.task` (7,8 MB) | **200**, `application/wasm` y `application/octet-stream` |
| `index.html` publicado | Incluye la política CSP `connect-src` |
| Pruebas e2e «IA 3» (grabación → WAV → devolución), «IA 7» (cámara con MediaPipe servido desde Pages, sin hosts externos) e «IA 10» (política de conexiones) contra el enlace publicado | **3 / 3** correctas |
| Sitio principal `https://cundix.github.io/sitioPubliton/` | **200** (con el rediseño del equipo; la prueba 17 se ajustó porque cambió el título) |

No se probó la API real de Gemini **desde el dominio publicado** (la clave temporal se borró); el CORS desde `cundix.github.io` se verificó
antes con llamadas reales. Para hacerlo: abrir el enlace, cargar una clave propia y presentar con la IA activada.

## Otras verificaciones realizadas

| Tema | Resultado |
|---|---|
| Accesibilidad básica del panel de texto | Todos los botones tienen nombre accesible; recorrido **solo con teclado** hasta completar una sesión; foco visible (`outline` ≠ none); anuncios por `aria-live`; el recorrido completo funciona **solo con el panel HTML** |
| Atajos de teclado | Enter, P, F y Esc recorren toda una sesión (prueba 13b) |
| Preferencias | Volumen, movimiento reducido y modo sentado se aplican y **persisten** al recargar; solo se guardan preferencias (se comprueba que no hay transcripciones ni audio en el almacenamiento) |
| Medición de nivel de audio (opcional) | Con un micrófono falso del navegador: permiso aparte, medición real de segundos activos/sonido y **todas las pistas liberadas** al terminar (prueba 13c) |
| Pausa automática por pestaña oculta | Verificada (prueba 14) |
| Liberación de recursos 3D | Al volver al hub, geometrías 84 → 85 y texturas 18 → 18 (antes del arreglo crecían 12 por ciclo; ver `problemas-resueltos.md`) |
| Recursos por escenario (informativo) | Llamadas de dibujo: hub 87, sala 79, cliente 98, auditorio 96 (<400). Triángulos: 10,7 mil / 1,8 mil / 2,9 mil / 21,8 mil. **Medido en software de escritorio; no es un dato de rendimiento en casco** |

## Pendiente (explícito)

| Pendiente | Por qué | Qué hacer |
|---|---|---|
| **Prueba en un casco físico** (Quest u otro) | No hay casco disponible en este entorno | Abrir el enlace publicado en el navegador del casco, entrar en VR y recorrer una sesión; revisar comodidad, legibilidad del texto, alcance de los botones y altura (modo sentado) |
| **Rendimiento y tasa de cuadros** | No se midió en casco; las cifras de arriba son de un navegador con WebGL por software | Medir con herramientas del casco; **no afirmar cuadros por segundo** hasta entonces |
| **Reconocimiento de voz real** | La voz se verificó con simulaciones; el reconocimiento real depende del navegador y de un servicio externo | Probar con micrófono real en Chrome/Edge y anotar errores de transcripción y de permisos |
| **Navegadores y dispositivos** | Solo se probó Edge 156 de escritorio | Probar Firefox, Safari, Chrome en celular |
| **Validación con personas usuarias** | El público es una hipótesis de diseño | Ver `usuarios-hipotesis.md` |
| **Intervención manual del equipo** | Debe hacerla el equipo | Ver `intervencion-manual.md` |
| **IA con voz humana real; manos reales; límite diario; casco** | Solo se probó con audio sintético, cámara de prueba y la clave del equipo | Ver filas I8 a I11 de «Análisis con IA y cámara» y `analisis-con-ia.md` |
| **Publicación de la versión con IA** | Ver `STATUS.md` | Verificar el enlace público después de subirla |
| **Contraste automático (herramienta tipo axe)** | No se ejecutó un auditor automático | Correr una auditoría de accesibilidad sobre el panel de texto y revisar el contraste del espacio 3D |

## Cómo repetir las pruebas

```bash
cd pitch-lab
npm install
npm test                                              # nivel A
node tools/serve.mjs                                  # terminal 1 (http://localhost:8080)
MSYS_NO_PATHCONV=1 node tools/serve.mjs 8081 /sitioPubliton    # terminal 2 (ruta de GitHub Pages)
npm run test:e2e                                      # nivel B (≈ 2 minutos)
node tests/e2e/xr.mjs                                 # nivel C
node tests/e2e/ai.mjs                                 # nivel B2 (IA y cámara, ≈ 5 minutos; usar PITCHLAB_URL si el puerto 8080 está ocupado)
# Manual, gasta cuota de TU clave (ver el encabezado del archivo):
GEMINI_API_KEY_FILE=ruta/clave.txt PITCHLAB_FAKE_MIC=ruta/presentacion.wav node tests/e2e/ia-real.mjs
node tools/qa-shots.mjs capturas 1600 900             # capturas
```

Requisitos: Node 20+ y Microsoft Edge o Chrome instalado (`PITCHLAB_BROWSER=chrome` para usar Chrome).

Nota sobre `tests/e2e/recursos-3d.json`: es una medición **informativa**. Se conserva la del 2026-11-04. El 2026-11-13 la prueba
(que esperaba 700 ms fijos) dio en dos corridas valores atrasados por una carrera de tiempos con el render por software (el espacio
nuevo no se había dibujado); se corrigió esperando a que cambie el espacio y se completen 3 cuadros, y tres corridas posteriores
coincidieron con la medición original.
