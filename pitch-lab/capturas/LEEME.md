# Capturas reales de la experiencia

Las `01` a `41` se regeneraron el 2026-11-20 (después de la revisión con «UX for XR») con `node tools/qa-shots.mjs capturas 1600 900` y
`node tools/shots-datos.mjs capturas`. Las `50`, `51`, `52`, `56`, `57` y `58` (IA y cámara, API simulada) salen de `tools/shots-ia.mjs` y también se regeneraron;
las `53`, `54`, `55` y `59` son de **respuestas reales de Gemini** del 2026-11-13 y **no se pueden regenerar sin una clave**: muestran la interfaz **anterior** (letra más chica en el panel 3D).

**Cómo se hicieron**: Microsoft Edge 156 en modo *headless*, 1600 × 900, con **WebGL por software**. Sirven para
mostrar composición, legibilidad y recorrido. **No** representan la vista dentro de un casco ni sirven para medir
rendimiento.

**Importante sobre el texto «reconocido»**: las capturas `12-sala-revision-transcripcion`, `13…`, `40…` y `41…`
se hicieron con un **simulador** de reconocimiento de voz de las pruebas automáticas. Es texto de prueba, **no voz
real**. Si se usan en el informe o en la exposición hay que rotularlas así.

| Archivo | Qué muestra |
|---|---|
| `01-inicio` | Hub: título, atril de control, tres maquetas |
| `02…04-tutorial-*` | Tutorial de 3 pasos (moverse, botones, recorrido) |
| `05-elegir-escenario`, `06-escenario-elegido` | Elección de escenario |
| `07-sala-brief` … `17-sala-vista-general` | Sala de ensayo: brief, preparación, presentando, pausa, confirmación, revisión, devolución (3 páginas), pantalla del brief, vista general |
| `20-cliente-*` | Reunión con cliente: brief, presentando, vista general, pantalla |
| `30-auditorio-*`, `31-auditorio-desde-el-publico` | Auditorio: brief, presentando, vista general, pantalla, vista desde el público |
| `40…41-devolucion-con-datos-*` | Devolución **con datos suficientes** (sesión real de 60 s con reconocimiento simulado): indicador calculado y consejos |

### Capturas de la revisión con «UX for XR» (`60` a `63`)

| Archivo | Qué muestra |
|---|---|
| `60-ajustes-opciones-de-vr` | Ajustes en dos columnas: volumen, movimiento reducido, sentado, **giro con joystick**, **vibración**, **altura de la vista** |
| `61-finalizar-toque-corto-aviso-en-el-atril` | Un toque corto sobre «Finalizar» no termina: el aviso aparece **en el atril** (dentro del casco no hay panel de texto). También se ve el reloj chico del atril |
| `62-finalizar-manteniendo-avance` | A mitad de «mantené presionado»: el botón se va llenando |
| `63-pausa-con-el-brief` | La pausa permite releer la marca y la restricción creativa |

Navegador de pruebas con WebGL por software; sirven para revisar composición y legibilidad, no para medir comodidad en un casco.

### Capturas de los docentes en 3D en el público (`64` a `67`)

Se sacaron con un **azar fijo** (para poder repetirlas), con el navegador de pruebas y sin paneles de interfaz encima. En cada una, algunas personas
del público son modelos 3D con textura (los seis docentes en 3D) y el resto son las figuras genéricas; en el uso normal el azar cambia en cada visita
(30 % por persona).

| Archivo | Qué muestra |
|---|---|
| `64-publico-con-docentes-sala` | Sala de ensayo: un docente en 3D entre dos figuras genéricas (vista cercana) |
| `65-publico-con-docentes-reunion` | Reunión con cliente: dos docentes en 3D en la mesa (una al fondo, otra en primer plano) |
| `66-publico-con-docentes-auditorio-platea` | Auditorio visto desde la platea: unas veinte docentes en 3D mezcladas con las genéricas |
| `67-publico-con-docentes-auditorio-general` | Auditorio desde un costado: las butacas lejanas usan la versión liviana (color por vértice) |

### Comparación de modelos 3D (`3d/`)

Pares `antes-*.png` (versión publicada el 2026-11-13) y `despues-*.png` (regenerados el 2026-11-20, con el recordatorio de la marca colgado bajo el reloj del auditorio), con las **mismas cámaras** y sin paneles de interfaz
encima, generados con `node tools/shots-3d.mjs`. Navegador de pruebas con WebGL por software: sirven para ver composición y detalle,
no rendimiento. Detalle de lo que cambió: [`../docs/modelos-3d.md`](../docs/modelos-3d.md).

### Capturas de la función de IA y cámara (`50` a `59`)

| Archivo | Qué muestra | Origen |
|---|---|---|
| `50-ia-preparacion-con-ia` | Preparación con la IA y la cámara activadas (aviso de qué se envía) | API **simulada** |
| `51-ia-y-camara-configuracion` | Pantalla «IA y cámara» con ambos interruptores | API **simulada** |
| `52-ia-analizando` | Devolución mientras la IA analiza | API **simulada** (pedido en espera) |
| `53-ia-contenido-api-real` | «IA: contenido» (rúbrica claro/parcial/falta) | **API real de Gemini** sobre un audio **sintético** (voz generada, no humana) |
| `54-ia-entrega-api-real` | «IA: entrega» (observaciones de ritmo, claridad, entonación y volumen, pausas) | **API real** sobre audio **sintético** |
| `55-ia-panel-de-texto-entrega-api-real` | El mismo resultado en el panel de texto accesible | **API real** sobre audio **sintético** |
| `56-ia-camara-vista-previa` | Vista previa de la cámara en el panel de texto | Cámara **de prueba** del navegador (un patrón verde, **sin manos**) |
| `57-ia-presentando-con-camara` | Presentando con grabación para la IA y cámara activas | API simulada y cámara de prueba |
| `58-ia-error-reintentar` | Error de cuota con el botón «Reintentar análisis» | API **simulada** (responde 429) |
| `59-ia-clave-panel-de-texto` | Panel para cargar la clave: el campo se vacía al guardar y el estado no muestra la clave | Prueba **real** de la clave |

**Aclaración importante:** ninguna captura muestra voz humana ni manos reales. Las `53` a `55` son una respuesta **real** de Gemini, pero a
una presentación **sintética** (voz generada por un sistema de texto a voz); no demuestran qué tan bien analiza voces reales.

Para actualizarlas después de un cambio visual: levantar el servidor (`node tools/serve.mjs`) y volver a correr los
dos comandos de arriba.
