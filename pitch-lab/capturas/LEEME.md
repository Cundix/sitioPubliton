# Capturas reales de la experiencia

Generadas el 2026-11-04 con `node tools/qa-shots.mjs capturas 1600 900` y `node tools/shots-datos.mjs capturas`.

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

Para actualizarlas después de un cambio visual: levantar el servidor (`node tools/serve.mjs`) y volver a correr los
dos comandos de arriba.
