# Publitón Pitch Lab

> **“Tu idea merece un buen pitch.”**

Simulador de presentación de ideas publicitarias con experiencia inmersiva **WebXR** (A-Frame).
La persona elige un espacio, recibe un brief ficticio, se prepara y presenta oralmente frente a una
audiencia virtual. Al terminar obtiene una devolución comprensible y puede volver a intentarlo.

Complementa el evento **Publitón** (TP4 de Diseño: experiencia inmersiva VR). Integrantes: Fiscina, Fuentes, Diaz y Tana.

- Enlace publicado: <https://cundix.github.io/sitioPubliton/pitch-lab/> — publicado y verificado el 2026-11-04; la **versión con IA y cámara** se publicó y verificó el 2026-11-13 (ver [`docs/pruebas.md`](docs/pruebas.md), «Verificación de la publicación»)
- Sitio del evento (sin cambios): <https://cundix.github.io/sitioPubliton/>

## Qué se puede hacer

1. **Inicio → tutorial (salteable) → elegir escenario** entre tres maquetas 3D.
2. **Brief** ficticio (**11 temáticas distintas**, editables; cada visita arranca con uno al azar y «Otro brief» los recorre) →
   **preparación** con tiempo ajustable → **presentación** con reloj visible.
3. Pausar, continuar, finalizar antes de tiempo o **cancelar con confirmación**.
4. **Voz opcional**: reconocimiento en español del navegador, con transcripción revisable.
   Sin micrófono se practica solo con temporizador y autoevaluación.
5. **Devolución** transparente: qué se midió, de dónde salió cada dato, uno o dos consejos, aspectos que
   requieren revisión humana, autoevaluación y *reintentar / cambiar de escenario*.
6. **Análisis con IA y cámara (opcional, desde 2026-11-13)**: con **tu propia clave** de la API de Gemini, una IA
   analiza el **audio** (la idea frente al brief y cómo se escucha la entrega) y, si activás la cámara, se miden
   **gestos de las manos en tu dispositivo**. Es una *interpretación*, no una medición. Detalle, cuota y privacidad:
   [`docs/analisis-con-ia.md`](docs/analisis-con-ia.md).

Los tres escenarios comparten la lógica y se diferencian en el **espacio**:

| Escenario | Tiempo | Espacio | Público |
|---|---|---|---|
| Sala de ensayo | 60 s | Cuarto pequeño, azul de marca | 3 oyentes a 2,4–2,6 m |
| Reunión con cliente | 90 s | Sala mediana con mesa larga | 5 personas a 2,1–5,1 m |
| Auditorio | 120 s | Escenario elevado, platea con rake, alas y balcón | 64 personas en 4 zonas, a 8,5–20 m |

La audiencia tiene movimiento ambiental suave (respiración, giro leve de cabeza). **No depende de lo que se
diga ni del puntaje y no es una evaluación del argumento.**

## Controles

| Acción | Computadora | Casco VR |
|---|---|---|
| Mirar | Arrastrar con el mouse | Mover la cabeza |
| Moverse | W A S D o flechas · girar con Q y E | Marcas del piso (teletransporte instantáneo). No hay desplazamiento continuo |
| Botones | Clic con el mouse sobre los botones 3D | Rayo del control + gatillo (o pellizco con manos) |
| Acción principal | Enter | Botón grande azul del atril |
| Pausar / continuar | P | Botón del atril |
| Finalizar | F | Botón del atril |
| Cancelar / volver | Esc | Botón del atril (pide confirmación) |
| Recentrar | R | Botón «Recentrar» del atril |
| Panel de texto accesible | T | — (no aparece dentro del casco) |
| Modo sentado | Ajustes o botón del atril | Botón «Sentado» del atril (eleva la vista) |
| Salir de VR | — | Botón «Salir de VR» del atril y el botón del sistema del casco |

El **panel de texto** (HTML) es un espejo accesible del espacio 3D: mismos textos y mismas acciones, con foco
visible, lector de pantalla y edición de la transcripción. La experiencia principal sucede en el espacio 3D.

## Ejecutar localmente

Requisitos: Node.js 20 o superior (solo para servir archivos y correr pruebas). La experiencia en sí es un
sitio estático sin build.

```bash
cd sitioPubliton/pitch-lab
node tools/serve.mjs          # sirve la raíz del repo en http://localhost:8080
# abrir http://localhost:8080/pitch-lab/
```

> No se puede abrir `index.html` con doble clic (`file://`): los módulos ES y las fuentes requieren HTTP.
> `localhost` cuenta como contexto seguro, necesario para WebXR y micrófono.

Para simular exactamente la ruta de GitHub Pages (`/sitioPubliton/pitch-lab/`):

```bash
MSYS_NO_PATHCONV=1 node tools/serve.mjs 8081 /sitioPubliton   # en Git Bash de Windows
# http://localhost:8081/sitioPubliton/pitch-lab/
```

Probar en un casco: servir por HTTPS (la versión publicada en GitHub Pages ya lo es) y abrir el enlace desde
el navegador del casco. En Quest también se puede usar `adb reverse tcp:8080 tcp:8080` y abrir
`http://localhost:8080/pitch-lab/`.

## Publicar

El sitio se publica con **GitHub Pages desde la raíz de `main`** (configuración existente del repositorio).
`pitch-lab/` es una carpeta más: al subirla a `main` queda en `/sitioPubliton/pitch-lab/`. No hay paso de build.
Todas las rutas son relativas: los recursos propios van en `pitch-lab/` y las tipografías/favicon se reutilizan de
`../assets/`.

## Voz, privacidad y datos

- El **micrófono se pide solo después** de presionar «Comenzar presentación» con la opción «Con micrófono».
- Antes de activarlo se avisa que, en algunos navegadores (por ejemplo Chrome), **el audio se envía a un servicio
  externo del navegador** para reconocerlo. No se promete procesamiento local.
- **No se guarda audio ni transcripciones** (ni en disco ni en el navegador). Solo se guardan preferencias
  (volumen, movimiento reducido, modo sentado, tutorial visto) en `localStorage`. **Excepción, solo si activás la IA:**
  el audio se graba en la **memoria de la pestaña** hasta terminar el análisis y se **envía a Google** (API de Gemini)
  con el brief; se avisa antes de empezar. De la cámara solo salen cifras, **nunca video**.
- **La clave de la IA es tuya** (se pega en el panel de texto): vive en `sessionStorage` (se borra al cerrar la
  pestaña) o, si elegís «Recordar», en `localStorage`; **no está en el repositorio**. Con una clave de la capa
  gratuita, Google puede usar lo enviado para mejorar sus productos. El navegador solo deja que la página hable
  con ella misma y con `generativelanguage.googleapis.com` (política CSP).
- La **medición de nivel de audio** es opcional, está desactivada por defecto, usa un permiso aparte y solo mide
  el nivel de sonido en el dispositivo (no reconoce voz ni guarda nada). Al terminar o cancelar se liberan las pistas.
- Si se rechaza el permiso no se vuelve a pedir solo: se ofrece practicar sin micrófono o reintentar a pedido.
- Texto «Demostración»: la transcripción de ejemplo siempre se rotula así y nunca se presenta como voz reconocida.
- Detalle de cada métrica y de su fórmula: [`docs/metricas-y-puntaje.md`](docs/metricas-y-puntaje.md).

## Compatibilidad

| Entorno | Estado |
|---|---|
| Edge / Chrome de escritorio con mouse y teclado | **Verificado** con pruebas automáticas (Edge 156, WebGL por software) |
| Reconocimiento de voz del navegador | Se detecta en tiempo de ejecución; en el entorno de pruebas se verificó con **simulaciones** (no con voz real) |
| Navegadores sin `SpeechRecognition` | La opción de micrófono se deshabilita y se practica con temporizador (verificado simulando su ausencia). Con IA activada, el audio se graba igual y la IA lo transcribe |
| Análisis con IA (Gemini) | Verificado con la API **simulada** en navegador real y con llamadas reales a la API desde scripts (audio sintético). Voz humana real y límites diarios: pendiente |
| Cámara y manos (MediaPipe) | Modelo cargado y medición verificados con una cámara de prueba **sin manos**. Manos reales: pendiente |
| Modo inmersivo WebXR | **Verificado solo con un emulador** (IWER, Meta Quest 3 simulado). **No probado en un casco físico** |
| Safari, Firefox, celulares | No verificado |

Si el navegador no ofrece modo inmersivo se muestra un mensaje claro y la experiencia sigue funcionando en pantalla.

## Estructura

```text
pitch-lab/
├─ index.html              Página de entrada (barra superior, panel de texto, carga)
├─ css/pitch-lab.css       Estilos de la capa HTML (fuentes locales de ../assets)
├─ vendor/                 A-Frame 1.8.0 y MediaPipe (incluidos, sin CDN) y sus licencias
├─ js/
│  ├─ main.js              Arranque: capacidades, sesión, escena, teclado, VR
│  ├─ config/              ★ Configuración editable: briefs, escenarios, tiempos, muletillas
│  ├─ core/                Lógica pura (sin DOM): estados, sesión, métricas, devolución
│  ├─ voice/               Reconocimiento de voz, medidor de audio, capacidades del navegador
│  ├─ ai/                  Análisis con IA (Gemini), grabación de audio y gestos con la cámara (opcionales)
│  ├─ scenes/              Geometría de los espacios (hub y tres escenarios), público, maquetas
│  ├─ components/          Componentes de A-Frame: stage-controller, walk-rig, xr-support
│  └─ ui/                  Paneles 3D, botones, reloj, panel de texto accesible
├─ tests/                  Pruebas de unidad (node:test) y de extremo a extremo (Playwright)
├─ tools/                  Servidor local, capturas y ayudantes de pruebas
├─ docs/                   Documentación del proyecto (ver abajo)
├─ informe/                Informe visual 16:9 (HTML, PDF, PNG) y material para Figma
├─ capturas/               Capturas reales de la experiencia
└─ STATUS.md               Estado del trabajo y cómo retomarlo
```

## Configuración editable

Sin tocar la lógica se pueden cambiar:

- **Briefs** → `js/config/briefs.js` (marca, problema, público, objetivo, restricción, guía).
- **Escenarios y tiempos** → `js/config/scenarios.js` (duración, preparación, tamaño del espacio, asientos).
- **Muletillas, umbrales, fórmula del indicador, avisos de tiempo** → `js/config/app-config.js`.

Guía paso a paso: [`docs/configuracion.md`](docs/configuracion.md).

## Pruebas

```bash
cd pitch-lab
npm install            # solo la primera vez (dependencias de desarrollo: pruebas y QR; el producto no usa ninguna)
npm test               # pruebas de unidad (no necesitan navegador)
node tools/serve.mjs   # en otra terminal (y el de /sitioPubliton en el puerto 8081)
npm run test:e2e       # recorrido completo con un navegador real
node tests/e2e/ai.mjs  # análisis con IA y cámara (API de Gemini simulada, micrófono y cámara falsos)
node tools/bench-3d.mjs # costo de dibujo por espacio (solo para comparar versiones; no es rendimiento de casco)
node tools/shots-3d.mjs capturas-3d # capturas con cámaras fijas, para comparar antes y después de un cambio visual
node tests/e2e/xr.mjs  # modo inmersivo con emulador WebXR
```

Prueba **manual** con la API real (gasta cuota de TU clave; ver el encabezado de `tests/e2e/ia-real.mjs`):

```bash
GEMINI_API_KEY_FILE=ruta/a/mi-clave.txt PITCHLAB_FAKE_MIC=ruta/a/presentacion.wav node tests/e2e/ia-real.mjs
```

Resultados observados y lo que sigue pendiente: [`docs/pruebas.md`](docs/pruebas.md).

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/arquitectura.md`](docs/arquitectura.md) | Módulos, flujo de datos y diagrama de estados |
| [`docs/decisiones-y-supuestos.md`](docs/decisiones-y-supuestos.md) | Decisiones, supuestos y límites de alcance |
| [`docs/metricas-y-puntaje.md`](docs/metricas-y-puntaje.md) | Cómo se calcula cada medida, datos que usa y limitaciones |
| [`docs/pruebas.md`](docs/pruebas.md) | Checklist de pruebas: observado / pendiente |
| [`docs/problemas-resueltos.md`](docs/problemas-resueltos.md) | Problemas reales encontrados y resueltos |
| [`docs/bitacora-prompts.md`](docs/bitacora-prompts.md) | Prompts realmente recibidos |
| [`docs/intervencion-manual.md`](docs/intervencion-manual.md) | Guía para la modificación manual del equipo (pendiente) |
| [`docs/guion-exposicion.md`](docs/guion-exposicion.md) | Guion de 5 minutos para los 4 integrantes |
| [`docs/referentes.md`](docs/referentes.md) | Investigación de referentes con fuentes |
| [`docs/usuarios-hipotesis.md`](docs/usuarios-hipotesis.md) | Público objetivo como hipótesis de diseño |
| [`docs/analisis-con-ia.md`](docs/analisis-con-ia.md) | Análisis con IA y cámara: modelo, cuota, clave, privacidad, límites |
| [`docs/modelos-3d.md`](docs/modelos-3d.md) | Mejora de los modelos 3D (público, salas, atril), presupuesto y mediciones |
| [`docs/evaluacion-semantica-futura.md`](docs/evaluacion-semantica-futura.md) | Qué falta validar y mejorar de la evaluación con IA |
| [`docs/configuracion.md`](docs/configuracion.md) | Cómo editar briefs, tiempos y escenarios |

## Limitaciones conocidas

- **No se probó en un casco físico.** No se afirma ninguna tasa de cuadros ni comodidad en VR. Los modelos 3D mejorados (2026-11-19) dibujan
  más geometría que los anteriores (ver [`docs/modelos-3d.md`](docs/modelos-3d.md)): **no se midió su costo en un casco**.
- El reconocimiento de voz depende del navegador y de un servicio externo; puede equivocarse y omitir muletillas.
- Los silencios solo se informan si se activó la medición de nivel de audio (y miden nivel de sonido, no habla).
- El «Indicador técnico orientativo» no evalúa contenido, creatividad ni persuasión; no hay medidas de confianza,
  ansiedad, emociones ni contacto visual.
- **El análisis con IA es una interpretación, puede equivocarse y es opcional.** Se verificó con audio sintético y con la
  API simulada; **no se validó con voz humana real** ni contra la opinión de personas. Necesita una clave propia y
  conexión; la capa gratuita tiene límites por minuto y por día (el diario hay que consultarlo en AI Studio).
- **Gestos con la cámara**: se verificó el modelo y las cifras con una cámara de prueba **sin manos**; la detección con
  manos reales **no está verificada**. Los umbrales de movimiento son provisorios.
- La clave no se puede escribir dentro de un casco VR (se carga antes en el panel de texto).
- La investigación con usuarios no se hizo: el público es una hipótesis de diseño.

## Licencias y créditos

- Tipografías **Anton** y **Barlow** (SIL Open Font License), reutilizadas de `../assets/` del sitio de Publitón.
- **A-Frame 1.8.0** (MIT) incluido en `vendor/`; usa three.js r184.
- **MediaPipe Tasks Vision 1.2.3** y el modelo *Hand Landmarker* (Apache-2.0, Google) en `vendor/mediapipe/`; se
  descargan solo si se activa la cámara. **Se modificó un archivo** para desactivar su envío de registros de uso
  (aviso en el propio archivo y en `vendor/mediapipe/README-mediapipe.md`).
- Las marcas de los briefs (Yerbita Sol, Pedal Vecino, Páginas al Paso, Gota Justa, Remendar, Feria Cerquita, Casa Memoria, Click Abuelo,
  Plaza Viva, Cable a Tierra y Charla Tándem) son **ficticias**; los datos de cada brief son inventados para practicar.
