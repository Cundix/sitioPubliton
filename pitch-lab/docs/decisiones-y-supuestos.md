# Registro de decisiones y supuestos

Decisiones tomadas durante el trabajo autónomo (sin poder consultar al equipo). Cada una tiene su motivo y
cómo revertirla o ajustarla.

## Decisiones técnicas

| # | Decisión | Motivo | Cómo cambiarla |
|---|---|---|---|
| D1 | **A-Frame 1.8.0 fijado e incluido en `vendor/`** (sin CDN) | Versión estable más reciente al momento (npm, blog oficial); evita depender de un servicio externo; funciona igual en GitHub Pages | Reemplazar el archivo y la etiqueta `<script>` de `index.html` |
| D2 | **Módulos ES sin build** | Un sitio estático simple de explicar; compatible con GitHub Pages | — |
| D3 | **Texto y botones 3D dibujados en `canvas`** (Anton/Barlow reales) en vez del componente `text` de A-Frame | `text` descarga fuentes MSDF de un CDN y no tiene Anton/Barlow; así se usan las tipografías del sitio y no hay dependencias remotas | `ui/panel-draw.js`, `ui/draw-button.js` |
| D4 | **Rayo de puntería con el *target ray* de WebXR** (`xr-ray`) en vez de `laser-controls` | `laser-controls` corrige la dirección según el modelo 3D del control (descarga remota); sin modelo el rayo queda mal orientado en cascos reales. El *target ray* lo informa el sistema, sirve para controles y manos y no descarga nada | `components/xr-support.js` |
| D5 | **Sin descargas de modelos o texturas remotas**: toda la geometría es procedural y las texturas son lienzos | Requisito de rendimiento/robustez | — |
| D6 | **Público con mallas instanciadas** | Pocas llamadas de dibujo aun con ~64 personas | `scenes/audience.js` |
| D7 | **Un modelo de pantalla (`screens.js`) dibujado por dos renderizadores** (3D y HTML) | Garantiza que el panel de texto y el espacio digan lo mismo y que cada botón sea válido en su estado (hay test) | — |
| D8 | **Máquina de estados como tabla de datos** (`FLOW`) | Estados y transiciones explícitos, fáciles de leer y de probar; rechaza eventos fuera de lugar | `core/state-machine.js` |
| D9 | **Tiempo por marcas de reloj, un único `setInterval`** | Exactitud con pausas y sin temporizadores duplicados | `core/session.js` |
| D10 | **Preferencias en `localStorage`; transcripciones y audio nunca** | Requisito de privacidad | `core/settings.js` |
| D11 | **Dependencias de desarrollo mínimas** (nada de esto llega al producto): `playwright-core` (usa el Edge/Chrome instalado, no descarga navegadores), `iwer` (emulador WebXR) y, solo para el QR del informe, `qrcode`, `jsqr` y `pngjs` | Pruebas reales sin sumar nada al producto | `package.json` |
| D12 | **Tipografías y favicon reutilizados de `../assets/`** (no se copian) | Reutilizar recursos reales del sitio; una sola copia | Si `pitch-lab/` se mueve a otro lado, copiar `assets/` y ajustar `css/pitch-lab.css` e `index.html` |
| D13 | **No se modificó ningún archivo existente del sitio** (ni el `README.md` raíz ni `index.html`) | Evitar regresiones y no pisar cambios ajenos | Opcional: agregar un enlace desde el sitio principal (ver «Próximos pasos») |

## Decisiones de la función de IA y cámara (2026-11-13)

Detalle completo en [`analisis-con-ia.md`](analisis-con-ia.md).

| # | Decisión | Motivo | Cómo cambiarla |
|---|---|---|---|
| D14 | **La IA analiza el audio** (Gemini, `gemini-3.5-flash-lite`, respaldo `gemini-3.1-flash-lite`) y devuelve un JSON con esquema fijo | El equipo pidió un análisis real de la idea y del tono, no solo transcripción; el modelo «flash-lite» de la capa gratuita tiene 15 pedidos/min y 250.000 tokens/min (dato informado por el equipo) y entiende audio de forma nativa | `js/config/app-config.js` → `ai.models` |
| D15 | **Cada persona usa su propia clave (BYOK)**, en `sessionStorage` (o `localStorage` si elige «Recordar»); nunca en el repositorio | GitHub Pages no tiene servidor donde guardar una clave. Un backend propio sería más seguro pero requiere hosting que el proyecto no tiene | Con un backend, reemplazar `GeminiClient` por un cliente que llame a ese servicio |
| D16 | **`generateContent` en vez del endpoint nuevo `/interactions`** | `/interactions` exige la cabecera `Api-Revision`, que el navegador no puede enviar por CORS; `generateContent` sigue soportado y acepta CORS | `js/ai/gemini-client.js` |
| D17 | **WAV mono de 16 kHz** como formato de envío | Formato soportado por la API, independiente del navegador (cada uno graba en un formato distinto) y de tamaño predecible | `js/ai/audio-capture.js` |
| D18 | **La IA es opcional y nunca bloquea**: corre en segundo plano, con reintento y degradación a la devolución sin IA | Un fallo de red, cuota o clave no puede romper una práctica | `core/session.js` |
| D19 | **Lo que dice la IA se rotula siempre como «interpretación»**, sin puntajes numéricos ni emociones; el indicador técnico no la usa | Requisito de transparencia del encargo: no inventar métricas de confianza, ansiedad o emociones | `core/feedback.js` (`AI_DISCLAIMER`), `ai/analysis-prompt.js` |
| D20 | **Gestos con MediaPipe en el dispositivo** (CPU, carga diferida, ≈22 MB incluidos en `vendor/`); solo salen cifras | El video nunca debe salir del dispositivo; sin CDN | `js/ai/gesture-tracker.js` |
| D21 | **Se modificó el `vision_bundle.mjs` de MediaPipe** para desactivar su telemetría hacia `odml.pa.googleapis.com` | Una prueba de red mostró un host externo no previsto; contradecía «nada sale del dispositivo». Es el único cambio y consta en el archivo y en su README (Apache-2.0) | `vendor/mediapipe/README-mediapipe.md` |
| D22 | **Política CSP `connect-src`** que limita las conexiones a sí mismo y a `generativelanguage.googleapis.com` | Defensa en profundidad: aunque una dependencia intentara enviar datos a otro lado, el navegador lo bloquea | `index.html` |
| D23 | **Se mantiene el tiempo de preparación ajustable de 0 a 300 s** (no se agregó un tope de 5 minutos) | El equipo lo descartó expresamente: «cada uno maneja su tiempo» | — |
| D24 | **Se eliminó el módulo vacío `semantic-evaluator.js`** | La función ahora existe con otro diseño; dejar la interfaz vacía confundiría | — |

## Decisiones de modelos 3D y briefs (2026-11-19)

| # | Decisión | Motivo | Cómo cambiarla |
|---|---|---|---|
| D25 | **Mejorar los modelos sin cambiar de técnica**: todo procedural, sin descargas | El requisito de no depender de modelos remotos sigue valiendo; se mantiene el estilo de la marca | `js/scenes/*` |
| D26 | **Lotes de geometría** (`Kit.batch()`) para detalles repetidos y **nivel de detalle** del público lejano | Más detalle sin subir proporcionalmente las llamadas de dibujo | `scene-kit.js`, `audience.js` (`NEAR_DIST`) |
| D27 | **Material difuso (Lambert) por defecto** en superficies mates; PBR solo con brillo o metal | Midió ~1,5–2× menos costo de dibujo por software con diferencia visual mínima | `Kit.mat` en `scene-kit.js` |
| D28 | **Presupuesto de geometría en una prueba** (< 200 llamadas y < 80.000 triángulos por espacio) | Que un cambio visual futuro no infle los espacios sin que se note. No es una medida de rendimiento en casco | prueba 15 de `tests/e2e/run.mjs` |
| D29 | **Cada visita empieza con un brief al azar** y el botón muestra «Otro brief N/total» | Con un solo brief a la vista parecía que la herramienta tenía una única temática | `briefStart` en `session.js` y `main.js` |
| D30 | **Largos máximos de los campos de un brief** exigidos por un test | Que un brief nuevo no desborde la pantalla de pared ni el panel | `tests/unit/briefs.test.js` |

## Decisiones de la revisión con «UX for XR» (2026-11-19 y 2026-11-20)

Detalle y evidencia: [`auditoria-ux-xr.md`](auditoria-ux-xr.md).

| # | Decisión | Motivo | Cómo cambiarla |
|---|---|---|---|
| D31 | **Mínimo de legibilidad medido**: 0,8° de altura de mayúsculas (cómodo: 1,2°); la prueba falla por debajo | Dentro del casco solo se lee lo dibujado en 3D. Los valores salen de bibliografía de lectura en VR; no son un estándar único | `MIN_DEG` en `tests/e2e/legibilidad.mjs`; `MIN_FONT_*` en `panel-draw.js` |
| D32 | **Si el texto no entra, se recorta; no se achica la letra.** Bloques secundarios `optional3D` + aviso «Más detalle: panel de texto» | Achicar fue lo que dejó textos de 0,5° | `fitPanel` en `panel-draw.js` |
| D33 | **El panel 3D queda en escala 1,3** (≈ 69° × 40° desde el atril) y no se agranda más | La guía da una zona cómoda de ~70° × 40°; ya la ocupa | `anchors.panel.scale` en cada espacio |
| D34 | **Reloj en el atril** (etiqueta, tiempo y aviso en palabras) y **reloj de la pared solo con números** | Lo que se mira a 5–10 m solo puede llevar texto muy grande; el estado en palabras va donde se lee | `drawLecternClock`, `drawClock` |
| D35 | **Giro con el joystick por tramos, encendido a 30°** (15/30/45/90° o apagado) | Quien presenta sentado no puede girar el cuerpo. La guía pide tenerlo disponible; acá además empieza encendido: **a revisar con personas** | `snapTurnDeg` en `settings.js` |
| D36 | **Vibración corta de los controles, apagable**, nunca como única señal | El tacto confirma que algo se tocó o se presionó; siempre hay también señal visual y sonido | `HAPTIC_PULSES` en `xr-support.js` |
| D37 | **«Finalizar» pide mantener presionado 0,7 s** (solo botones 3D; F, Enter y panel de texto son inmediatos) | Es un cambio grande que no se deshace y estaba al lado de «Pausar». 0,7 s es una **estimación** | `HOLD_MS` en `hold.js`; `hold: true` en `screens.js` |
| D38 | **Los avisos cortos también se dibujan en el atril** | Los avisos salían solo en el panel de texto, que no existe dentro del casco | `showFlash` en `pitch-ui.js` |
| D39 | **Sin locomoción continua, a propósito** | La experiencia es de pie frente a un atril; el teletransporte con fundido ya evita el mareo por movimiento | `walk-rig.js` |
| D40 | **Ajustes en dos columnas** (ocho opciones) | Entran las opciones nuevas con letra legible | `layout: 'grid'` en `screens.js` |

## Decisiones de diseño y alcance

| # | Decisión | Motivo |
|---|---|---|
| E1 | **Hub con tres maquetas** para elegir escenario | Hace visible en el espacio la diferencia de escala y de cantidad de público *antes* de entrar; son los «objetos 3D con intención» del hub |
| E2 | **Controles esenciales en el atril 3D** (acción principal grande + secundarias) y opciones en un panel flotante | El requisito pide que no dependan de HTML; el HTML es solo espejo accesible |
| E3 | **Posición inicial detrás del atril, mirando al público**; la pantalla del brief queda atrás y el reloj frente a la persona | Escala humana, posición segura y referencia visual del tiempo, como en una sala real |
| E4 | **En VR solo teletransporte a marcas fijas** y «Recentrar»; sin desplazamiento continuo ni giros automáticos | Evitar mareo; ningún movimiento ocurre sin acción de la persona |
| E5 | **Un breve fundido a negro** al cambiar de lugar (se omite con movimiento reducido) | Comodidad en VR; no es un movimiento de cámara |
| E6 | **«Modo sentado» eleva la vista 0,45 m solo en VR** | En `local-floor` la vista sentada queda baja; valor configurable (`APP_CONFIG.movement.seatedOffsetM`) |
| E7 | **La preparación no inicia la presentación sola** | Requisito de acción explícita para comenzar |
| E8 | **Al cumplirse el tiempo la presentación termina sola** (con aviso previo visual y sonoro) | Evita presentaciones que se alargan sin que se note; en «práctica sin límite» no ocurre |
| E9 | **Pestaña en segundo plano → pausa automática** | El navegador puede detener el reconocimiento; evita medir tiempo en el que nadie hablaba |
| E10 | **Cancelar lleva al brief** (no a Inicio) con aviso | Permite reintentar enseguida sin volver a elegir escenario |
| E11 | **Si falla el WebGL o la escena tarda más de 15 s** se abre el panel de texto en «modo solo texto» | El recorrido puede completarse sin 3D |
| E12 | **Preguntas de práctica predefinidas**, solo en el panel de texto de la devolución y rotuladas como «predefinidas; no responden a lo que dijiste» | La audiencia no conversa ni finge comprender la voz; es una lista fija (`PRACTICE_QUESTIONS`) para reflexionar |
| E13 | **Briefs con marcas ficticias** rotuladas en pantalla, sin afirmaciones médicas ni estadísticas | Requisito del encargo |

## Supuestos

- **S1.** El público objetivo (participantes de Publitón que necesitan defender ideas creativas) se toma como
  **hipótesis de diseño**: en el repositorio no hay User Personas documentados. Ver [`usuarios-hipotesis.md`](usuarios-hipotesis.md).
- **S2.** Se asume que en el navegador de la persona el reconocimiento de voz puede procesarse **fuera del
  dispositivo**, y así se informa antes de activarlo.
- **S3.** Se asume que un casco compatible con WebXR ofrece `immersive-vr` con `local-floor` (Quest Browser). Se
  pidió `local-floor` como requerido y `bounded-floor` como opcional (configuración estándar de A-Frame).
- **S4.** Los umbrales de ritmo (110–160 palabras por minuto), de muletillas y de uso del tiempo son **valores de
  referencia razonables elegidos por el equipo de desarrollo**, no resultados de investigación. Son editables.
- **S5.** Las duraciones (60/90/120 s) y el tiempo de preparación por escenario (45/60/90 s) salen del encargo y
  de criterio de diseño; el tiempo de preparación se ajusta de 0 a 300 s.
- **S6.** El texto de demostración y las preguntas predefinidas están en `app-config.js` y son material de ejemplo.
- **S7.** Los límites de la capa gratuita de Gemini (15 pedidos/min, 250.000 tokens/min) los informó el equipo; **no
  se pudieron verificar** desde aquí y **el tope diario se desconoce**. Cambian con el tiempo y por proyecto.
- **S8.** Los umbrales de movimiento de manos (`gestures.moveLowMax`, `moveHighMin`) son **provisorios, sin calibrar**
  con datos reales.
- **S9.** Se asume que cada persona cuida su propia clave y que es una clave creada solo para esta práctica.

## Límites de alcance respetados

Sin multijugador, cuentas, pagos, rankings, avatares personalizables ni backend. **No hay claves en el código ni en
el repositorio** (la clave de la IA la aporta cada persona en su navegador). No se reconstruyó el sitio del evento.
La evaluación con IA es **real pero opcional**; no se simula nada: sin clave, esa parte no existe.
