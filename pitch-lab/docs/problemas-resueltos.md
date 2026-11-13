# Problemas reales encontrados y resueltos

Todos ocurrieron durante el desarrollo y se detectaron con una **prueba automática, una captura de pantalla o un
error de consola**. Cada uno tiene causa, solución y comprobación. No hay problemas inventados.

## ★ Problema destacado para el informe: fuga de geometrías al cambiar de espacio

| | |
|---|---|
| **Qué pasó** | Al ir del hub a una sala y volver, el contador de geometrías del renderizador crecía **12 por cada ida y vuelta** (84 → 97 → 109 → 121), aunque el árbol de objetos de la escena se mantenía igual. En una sesión larga con varios reintentos eso acumula memoria de GPU. |
| **Cómo se detectó** | La prueba e2e «Medición de recursos 3D» compara `renderer.info.memory.geometries` al volver al hub y falló («geometrías 84 -> 109»). Luego se verificó con un contador de geometrías registradas/liberadas dentro del navegador. |
| **Causa** | Las tres geometrías de cilindro y el anillo del **pedestal de cada maqueta** (4 por maqueta × 3 maquetas = 12) se creaban sin registrarse en el `Kit` que libera los recursos del espacio, por lo que nunca se llamaba a `dispose()`. |
| **Solución** | En `js/scenes/maquette.js`, el ayudante `stand()` registra cada geometría con `kit.track({ dispose })`, igual que el resto de los objetos del espacio. |
| **Comprobación** | La misma prueba pasa: geometrías hub 84 → 85 tras volver (antes 84 → 109). Antes del arreglo: 84, 97, 109, 121; después: estable. El resultado queda en `tests/e2e/recursos-3d.json`. |

## Otros problemas resueltos

### 1. A-Frame evalúa los *getters* al registrar un componente
- **Síntoma**: la página no arrancaba; error de consola `Cannot read properties of undefined (reading 'querySelector')`.
- **Causa**: `walk-rig` definía `get camera()`; `AFRAME.registerComponent` recorre las propiedades de la definición y
  ejecutó el *getter* con `this` indefinido.
- **Solución**: reemplazar los *getters* por métodos (`getCamera()`, `isVR()`). Se dejó una nota en el código.
- **Comprobación**: la carga inicial no produce errores (prueba e2e 1).

### 2. El micrófono podía pedirse después de cancelar
- **Síntoma**: el test «Cancelar mientras se espera el permiso ignora la respuesta tardía» falló.
- **Causa**: `Session._startVoice()` difería `voice.start()` con `Promise.resolve().then(...)`; si la persona
  cancelaba en ese instante, la escucha igual se iniciaba (y el permiso se pedía fuera del gesto de la persona).
- **Solución**: llamar a `voice.start()` **de forma síncrona** dentro del gesto, y descartar respuestas tardías con
  un contador (`_voiceAttempt`). Además, solo se llama a `abort()`/`dispose()` sobre medios que realmente se iniciaron.
- **Comprobación**: pasa el test de unidad y la prueba e2e 7 (sin reintentos automáticos tras un rechazo).

### 3. Caminar con el teclado fallaba en silencio
- **Síntoma**: las teclas W A S D no movían la cámara; error de página `Cannot read properties of null (reading 'obstacles')`.
- **Causa**: cuando el entorno se creaba antes que el componente de movimiento, `walk-rig` tomaba el entorno
  pendiente pero no lo guardaba en `this.env`.
- **Solución**: guardar el entorno al aplicarlo (`this.env = env`).
- **Comprobación**: la prueba e2e 3 verifica que se avanza, que el atril bloquea el paso y que no se sale de la zona, y la 11
  repite el recorrido en el auditorio. (Antes del arreglo la prueba 11 podía pasar sin que hubiera movimiento, porque solo
  comprobaba límites; la 3 sí exige que la cámara avance.)

### 4. Una pieza del atril atravesaba los botones
- **Síntoma** (captura de pantalla): una barra opaca tapaba la fila inferior de botones del atril.
- **Causa**: el soporte bajo el plano inclinado sobresalía por encima de la superficie inclinada.
- **Solución**: rediseñar el soporte para que quede por debajo del plano.
- **Comprobación**: capturas posteriores (`capturas/`) y clics 3D reales sobre todos los botones del atril.

### 5. Botón de A-Frame para VR/pantalla completa seguía visible
- **Síntoma**: la prueba de accesibilidad «todos los botones tienen nombre» encontró un botón sin texto
  (`a-enter-vr-button`) y se veía un ícono en la esquina.
- **Causa**: en A-Frame 1.8 el componente se llama `xr-mode-ui` (antes `vr-mode-ui`); la propiedad
  `vr-mode-ui="enabled: false"` se ignoraba.
- **Solución**: usar `xr-mode-ui="enabled: false"` y ofrecer el botón propio, accesible, «Entrar en VR».
- **Comprobación**: prueba e2e 13.

### 6. El rayo de los controles apuntaba mal sin el modelo del control
- **Síntoma**: con el emulador WebXR el rayo no alcanzaba los botones del atril.
- **Causa**: `laser-controls` corrige la dirección del rayo con datos del **modelo 3D** del control, que se descarga
  de un CDN; con `model: false` (para no depender de descargas) quedaba sin corrección y, en cascos reales con
  controles Touch, apuntaría desviado.
- **Solución**: componente `xr-ray`, que usa el **target ray** de WebXR (lo informa el sistema) y los eventos
  `selectstart`/`selectend`. Sirve para controles y para manos.
- **Comprobación**: prueba con emulador X4 («un control emulado apunta al botón y el gatillo lo activa»). **No se
  verificó en un casco físico.**

### 7. El atril bloqueaba el rayo hacia la marca de teletransporte lejana
- **Síntoma**: con el emulador, el rayo al apuntar a la marca del público (a ~13 m) chocaba primero con un elemento interactivo a 1,2 m de la mano, que corresponde al atril.
- **Causa**: el atril está entre la persona y el piso lejano; desde la altura del pecho el rayo pasa por el atril.
- **Solución**: sumar un botón **«Ver desde el público»** en el atril (el mismo teletransporte, alcanzable sin
  apuntar al piso) y mantener la marca del piso.
- **Comprobación**: prueba con emulador X5.

### 8. Texto demasiado chico y fantasma detrás del panel
- **Síntoma** (capturas): el texto del panel era difícil de leer a 1280×720 y se veía un cartel detrás del panel
  semitransparente.
- **Solución**: tipografías más grandes con ajuste automático al contenido (`fitPanel`), panel opaco y menos texto por página.
- **Comprobación**: capturas en `capturas/`.

## Problemas de la función de IA y cámara (2026-11-13)

### 9. MediaPipe enviaba telemetría a un servidor de Google
- **Síntoma**: la prueba de red «IA 7» (cámara) falló: además del propio sitio, la página contactó a
  `odml.pa.googleapis.com`. Contradecía lo que se promete en pantalla («de la cámara solo salen números»).
- **Cómo se detectó**: la prueba compara todos los *hosts* que pide la página; luego se capturó el pedido con un
  script aparte: `POST https://odml.pa.googleapis.com/v1/log`, protobuf de 141 bytes con la versión del paquete y
  contadores, sin imágenes. Ocurre al **cerrar** el modelo (vacía el registro de uso).
- **Causa**: `@mediapipe/tasks-vision` 1.2.3 incluye un registrador de uso que no se puede apagar por opciones.
- **Solución**: se desactivó el envío en el `vision_bundle.mjs` incluido en el sitio (único cambio, con aviso en el
  archivo y en `vendor/mediapipe/README-mediapipe.md`, como pide Apache-2.0) y se sumó una política CSP
  `connect-src` en `index.html` como segunda barrera.
- **Comprobación**: «IA 7» ahora exige que **ningún host externo** sea contactado, y «IA 10» comprueba que el
  navegador bloquee `odml.pa.googleapis.com` y cualquier otro sitio, y permita el propio y la API de Gemini.

### 10. El micrófono y la cámara podían quedar abiertos al cancelar mientras se esperaba el permiso
- **Síntoma**: la prueba «IA 9» (cancelar mientras se esperan los permisos) falló: 2,5 s después de cancelar seguían
  vivas las pistas de **audio y video**.
- **Causa**: `getUserMedia` es asíncrono; si la persona cancelaba justo antes de que el navegador concediera el
  permiso, `dispose()` no encontraba nada que soltar y el flujo llegaba **después**, quedando abierto (y la
  grabación arrancaba sola).
- **Solución**: un contador de generación en `AudioCapture` y `GestureTracker`. Al cancelar sube; si un permiso o un
  modelo llega con una generación vieja, se suelta de inmediato y se rechaza con `aborted`.
- **Comprobación**: pruebas de unidad con un navegador simulado (permiso que llega tarde, modelo que termina de
  cargar después de cerrar) y la prueba de navegador real «IA 9».

### 11. La duración medida de los gestos se reiniciaba al pausar
- **Síntoma**: no se vio en pantalla; apareció al revisar el código mientras se escribían las pruebas del seguimiento.
- **Causa**: al retomar, el seguimiento reiniciaba su reloj interno en 0: una presentación de 8 s con una pausa
  figuraba como 4 s y podía no alcanzar el mínimo de 3 s para considerarse medida.
- **Solución**: la línea de tiempo continúa donde quedó (las pausas no cuentan).
- **Comprobación**: la prueba «pausar y retomar NO reinicia la línea de tiempo» **falla con el código anterior**
  (duración 4 en lugar de ≈8; se comprobó revirtiendo el cambio) y pasa con la corrección.

### 12. El endpoint nuevo de Gemini no se puede usar desde el navegador
- **Síntoma**: con el endpoint nuevo (`/v1beta/interactions`) el navegador bloqueaba el pedido en la verificación
  previa de CORS (*preflight*).
- **Causa**: ese endpoint exige la cabecera `Api-Revision`, y el servidor solo autoriza `content-type` y
  `x-goog-api-key` desde el navegador.
- **Solución**: usar `generateContent`, que sigue soportado y acepta CORS desde `https://cundix.github.io`.
- **Comprobación**: llamadas reales (preflight y pedido) con la clave del equipo, 2026-11-13.

### 13. El modelo principal a veces responde 503 y la devolución no lo decía
- **Síntoma**: en la primera llamada real el resultado vino del modelo de respaldo sin explicación visible. En una
  corrida posterior de la prueba manual con la API real se **observó directamente**: el modelo principal
  (`gemini-3.5-flash-lite`) respondió **HTTP 503** y la app usó `gemini-3.1-flash-lite`, que respondió bien. De las
  ejecuciones reales de la interfaz completa, **1 de 3** terminó en el respaldo por un 503 del principal (muestra
  chica: es un dato observado, no una tasa).
- **Causa**: indisponibilidad momentánea del modelo principal (503). La cuota agotada (429) es otra causa posible.
- **Solución**: el cliente registra qué modelo falló y por qué (`attempts`) y la devolución lo informa («Antes se
  intentó con … (error del servicio)»), en vez de ocultarlo. El respaldo ya estaba previsto; esto lo confirma en la
  práctica.
- **Comprobación**: pruebas de unidad del cliente y de la pantalla, la prueba de navegador «IA 5» y la corrida real.

### 14. La IA describía un estado emocional («tono entusiasta»)
- **Síntoma**: en la primera respuesta real de la IA, la observación de entonación decía «se percibe un tono
  entusiasta». Eso es una inferencia emocional, que las instrucciones prohíben y que la herramienta no evalúa.
- **Causa**: el campo se llamaba «energía», lo que invita a hablar de ánimo, y la instrucción no daba ejemplos de qué
  vocabulario evitar.
- **Solución** (tres capas): (1) la instrucción pide describir solo rasgos que se oyen (velocidad, volumen, variación
  de entonación, claridad, pausas) y prohíbe palabras de emociones o actitudes «ni siquiera como elogio»; (2) el campo
  se muestra como «Entonación y volumen» y su descripción en el esquema lo aclara; (3) la validación
  (`EMOTION_PATTERN`) **reemplaza por un aviso** cualquier observación de la entrega que nombre una emoción o actitud.
  El filtro no se aplica al contenido (por ejemplo «genera confianza» puede ser parte del mensaje de la marca).
- **Comprobación**: pruebas de unidad (la observación emocional se reemplaza; el contenido no se toca; el esquema
  no tiene campos emocionales). Con el prompt reforzado, **dos respuestas reales** describieron solo rasgos audibles
  (0 de 5 observaciones omitidas). Es una muestra de 2: la capa 3 es la que garantiza el resultado.

## Registro de herramientas (no son defectos del producto)

- El puerto 8080 de esta computadora estaba ocupado por otra aplicación (un servidor ajeno respondía 403): las
  pruebas de IA se corrieron sobre los puertos 8090 y 8091 (`PITCHLAB_URL`).
- MediaPipe escribe un aviso **informativo** («Created TensorFlow Lite XNNPACK delegate for CPU») por
  `console.error`; las pruebas lo permiten explícitamente.
- Con dos navegadores en paralelo y render por software, la carga de la página superó los 30 s en una corrida:
  se amplió el margen de `page.goto` a 60 s en `tools/browser.mjs`.

- El emulador de WebXR (IWER) no se instala sobre el `navigator.xr` nativo de Edge sin `forceInstall: true`.
- En Git Bash de Windows, un argumento que empieza con `/` se convierte en una ruta de Windows; para el servidor con
  prefijo `/sitioPubliton` hay que anteponer `MSYS_NO_PATHCONV=1`.
