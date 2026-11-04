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

## Registro de herramientas (no son defectos del producto)

- El emulador de WebXR (IWER) no se instala sobre el `navigator.xr` nativo de Edge sin `forceInstall: true`.
- En Git Bash de Windows, un argumento que empieza con `/` se convierte en una ruta de Windows; para el servidor con
  prefijo `/sitioPubliton` hay que anteponer `MSYS_NO_PATHCONV=1`.
