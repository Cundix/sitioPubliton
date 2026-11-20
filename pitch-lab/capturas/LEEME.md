# Capturas reales de la experiencia

Las `01` a `41` se regeneraron el 2026-11-13 (después de agregar la función de IA) con `node tools/qa-shots.mjs capturas 1600 900` y
`node tools/shots-datos.mjs capturas`. Las `50` a `59` (IA y cámara) salen de `tools/shots-ia.mjs` y de `tests/e2e/ia-real.mjs`.

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

### Comparación de modelos 3D (`3d/`)

Pares `antes-*.png` (versión publicada el 2026-11-13) y `despues-*.png` (2026-11-19), con las **mismas cámaras** y sin paneles de interfaz
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
