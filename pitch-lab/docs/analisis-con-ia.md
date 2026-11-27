# Análisis con IA (Gemini) y gestos con la cámara

Esta función es **opcional**: sin clave y sin cámara, Pitch Lab funciona exactamente igual que antes. Se agregó el
2026-11-13 a pedido del equipo para que la devolución no se limite a transcribir y contar muletillas, sino que
**interprete la idea frente al brief y cómo se escucha la entrega**, y que mida los gestos de las manos con la cámara.

> **Es una interpretación, no una medición.** Lo que devuelve la IA puede equivocarse y se muestra siempre con esa
> advertencia. No hay «confianza», ni «ansiedad», ni «emociones»: está prohibido en el prompt y el esquema de respuesta no tiene lugar
> para eso (hay una prueba automática que lo verifica). **Con un brief tampoco hay puntaje numérico.** La única excepción es el
> **pitch libre** (desde 2026-11-27, a pedido de la persona usuaria): ahí la IA califica de 1 a 5, con las reglas de la sección «Pitch libre».

## Qué hace

| Pieza | Qué analiza | Dónde corre | Qué sale del dispositivo |
|---|---|---|---|
| **IA de voz** | Contenido frente al brief (problema, idea, beneficio, cierre, restricción creativa) y entrega (ritmo, claridad, entonación y volumen, pausas, muletillas), con citas textuales y consejos | Servidores de Google (API de Gemini) | El **audio** de la presentación + el brief + la duración |
| **Gestos con la cámara** | % del tiempo con manos a la vista, % con dos manos, nivel de movimiento (poco / moderado / mucho) | **En el dispositivo** (MediaPipe) | **Solo cifras** al resumen que ve la IA; **nunca video** |

Cómo se activa: en la preparación, botón **«IA y cámara»** → activar «Análisis de voz con IA» y/o «Gestos con la
cámara». La clave se carga en el **panel de texto** (tecla `T`) → «Análisis con IA (Gemini) y cámara».

Qué se ve en la devolución: dos pestañas nuevas, **«4 · IA: contenido»** y **«5 · IA: entrega»**, más los consejos
de la IA en la pestaña «Consejos». El panel 3D muestra un resumen; el panel de texto muestra el detalle completo
(citas, motivo de cada consejo y límites del análisis). Mientras la IA piensa (≈10–30 s) se puede seguir mirando
el resto de la devolución. Si falla, se explica por qué y, si la grabación sigue en memoria, se puede **reintentar
sin volver a presentar**.

## Modelo, API y cuota

- **Modelo principal:** `gemini-3.5-flash-lite` (estable). **Respaldo:** `gemini-3.1-flash-lite`. Si el principal
  devuelve cuota agotada (429), no disponible (404/5xx) o tarda demasiado, se prueba el respaldo automáticamente.
  Se configuran en `js/config/app-config.js` (`ai.models`).
- **Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent`, con la clave
  en la cabecera `x-goog-api-key`. Se eligió `generateContent` (y no el endpoint nuevo `/interactions`) porque el
  nuevo exige una cabecera `Api-Revision` que el navegador no puede enviar por CORS; `generateContent` sigue
  soportado y acepta CORS desde `https://cundix.github.io` (verificado con llamadas reales, 2026-11-13).
- **Entrada:** el audio se graba con `MediaRecorder`, se decodifica y se convierte a **WAV mono de 16 kHz** (formato
  soportado y sin depender del navegador) y se envía en línea (`inlineData`). Tope: 18 MB por pedido y 300 s de
  grabación. El audio cuenta ≈32 tokens por segundo (documentación oficial).
- **Salida estructurada:** `responseMimeType: application/json` + `responseSchema` (ver `js/ai/analysis-prompt.js`).
  La respuesta se **valida y recorta** antes de mostrarse (se trata como no confiable) y la interfaz **escapa** todo
  el texto (hay pruebas con HTML malicioso).

### ¿Alcanza para ~50 jugadas por día?

Datos y su origen:

| Dato | Valor | Origen |
|---|---|---|
| Límites de `gemini-3.5-flash-lite` en la capa gratuita | **15 pedidos/min y 250.000 tokens/min** | Los informó el equipo mirando AI Studio. **No pude verificarlos por mi cuenta**: los límites de la capa gratuita solo se ven con sesión iniciada en AI Studio |
| Pedidos por día (RPD) | **Desconocido** | Se ve en AI Studio → *Rate limits*. **Hay que mirarlo**: es el límite que decide si alcanzan 50 jugadas |
| Tokens por jugada (**medido**) | Presentación de 37 s: **≈1.630–1.680 de entrada** (≈940–960 de audio + ≈670–730 de texto) y **≈710–780 de salida**; **≈2.350–2.460 en total** | Contadores que devolvió la API en 3 corridas reales (`usageMetadata`), con `tests/e2e/ia-real.mjs`. Una presentación de 120 s tendría ≈3.800 de audio (32 tokens/s) |
| Tokens por 50 jugadas | ≈120.000 por día (presentaciones de ~40 s) a ≈265.000 (de 120 s) | Cálculo a partir de lo medido: repartidos en el día, muy por debajo del límite de 250.000 tokens **por minuto** |
| Costo en la capa paga (si se superara la gratuita) | USD 0,30 por millón de tokens de entrada y USD 2,50 por millón de salida | Página oficial de precios (2026-11-13). Con lo medido, una jugada ≈ USD 0,0023: **50 jugadas ≈ USD 0,12 por día** (cálculo, no facturado) |
| La suscripción **Google AI Plus/Pro** | **No da cuota de API** | La API se factura aparte; AI Plus/Pro son planes de consumo de la app Gemini |

**Observado con la API real:** el modelo principal respondió **503** en 1 de 3 corridas de la interfaz completa y la
app usó el de respaldo sin problema (ver `problemas-resueltos.md`, problema 13). Conviene contar con el respaldo.

Conclusión honesta: por minuto y por tokens **alcanza con holgura** (50 jugadas repartidas en un día están muy lejos
de 15 pedidos por minuto). Lo único incierto es el tope diario de la capa gratuita; si se agotara, el análisis falla
con un aviso claro, **el resto de la herramienta sigue funcionando**, y el respaldo (`gemini-3.1-flash-lite`) tiene
su propia cuota. Si hiciera falta, pasar el proyecto a facturación en AI Studio cuesta centavos por día. Los
límites cambian y dependen del proyecto: conviene revisarlos antes de una demostración.

## Clave de API: cada persona usa la suya (BYOK)

GitHub Pages es un sitio estático: **no hay servidor donde guardar una clave de forma segura**. Por eso:

- **No hay ninguna clave en el código, en el repositorio ni en los registros.** Cada persona pega **su propia clave**
  (se obtiene gratis en <https://aistudio.google.com/apikey>) en el panel de texto.
- Por defecto vive en `sessionStorage` (se borra al cerrar la pestaña). Con «Recordar en este dispositivo» pasa a
  `localStorage` (aviso explícito). Se puede **borrar** con un botón. Se muestra enmascarada («…ab12»).
- Se envía **únicamente** a `generativelanguage.googleapis.com`, en la cabecera `x-goog-api-key`; nunca en la URL.
- La clave queda legible para el navegador y sus extensiones de esa persona: por eso es **su propia clave**, nunca
  la de otra persona ni una de producción. Recomendación: crear una clave solo para esta práctica y borrarla después.
- Una alternativa más segura (un servidor propio que guarde la clave y haga de intermediario) requiere hosting con
  backend; no se hizo porque el proyecto se publica como sitio estático.
- En un **casco VR no se puede escribir** la clave: se carga en el panel de texto antes de entrar (la clave
  sobrevive mientras no se cierre la pestaña). Dentro del casco, el botón «Cargar la clave» lo explica.

## Privacidad: qué sale del dispositivo y cuándo

1. **Nada se envía hasta que la persona activa la IA** y presiona «Comenzar presentación». Se avisa **antes**, en la
   pantalla de preparación y en «IA y cámara» (`AI_DISCLOSURE` en `js/core/screens.js`).
2. El micrófono se abre **recién al comenzar** (no al configurar) y se **libera** al terminar, cancelar o salir.
   Un permiso que el navegador conceda *después* de cancelar se suelta de inmediato (prueba automática).
3. El audio vive **solo en la memoria de la pestaña**: no se guarda en disco, `localStorage` ni IndexedDB. Se descarta
   al terminar el análisis, al reintentar la práctica, al cancelar o al reiniciar. Solo se conserva mientras el
   análisis falle y se pueda reintentar.
4. Al terminar, se envía a Google **el audio (WAV), el brief, el escenario y la duración**, más las **cifras** de gestos
   si se activó la cámara. **No se envía video, imágenes, nombre ni ningún dato personal.**
5. **Capa gratuita:** según las condiciones de la API de Gemini, con una clave sin facturación Google puede usar lo
   enviado **para mejorar sus productos** (con facturación activa, no). Se advierte en la interfaz. Conviene no
   presentar datos reales de terceros.
6. **Política de contenido (CSP)** en `index.html`: el navegador solo permite que la página se conecte a sí misma y a
   `generativelanguage.googleapis.com` (`connect-src`). Hay una prueba que lo comprueba.
7. **Hallazgo y corrección — telemetría de MediaPipe.** El paquete `@mediapipe/tasks-vision` 1.2.3 envía por su
   cuenta un registro de uso (protobuf de ≈140 bytes, sin video ni imágenes) a `odml.pa.googleapis.com` al cerrar el
   modelo. Lo detecté con una prueba de red (aparecía un host externo no previsto). Se **desactivó** el envío en el
   `vision_bundle.mjs` incluido en el sitio (único cambio; consta en el encabezado del archivo y en
   `vendor/mediapipe/README-mediapipe.md`, como exige la licencia Apache-2.0), y la CSP lo bloquearía igualmente.
   La prueba «IA 7» verifica que, con la cámara, no se contacte a ningún host externo.

## Cómo funciona por dentro

```text
js/ai/
├─ gemini-client.js    Pedido a la API: modelos en orden, tiempo máximo, errores claros, clave redactada
├─ analysis-prompt.js  Instrucciones, esquema de respuesta, texto de contexto y validación/saneamiento
├─ audio-capture.js    MediaRecorder → WAV 16 kHz mono (base64); tope de duración; libera el micrófono
├─ gesture-tracker.js  MediaPipe Hand Landmarker (CPU, carga diferida) y muestreo a 8 cuadros/s
├─ gesture-metrics.js  Matemática pura: manos visibles y movimiento (se prueba sin cámara)
├─ key-store.js        Clave en sessionStorage / localStorage (opcional) con máscara
└─ analysis-service.js Une todo detrás de la interfaz que usa la Sesión
```

- La **Sesión** (`core/session.js`) pide los permisos de forma **síncrona dentro del gesto de la persona**, ignora los
  resultados tardíos con *tokens* de intento y nunca depende de la IA: si algo falla, la práctica sigue.
- Estado nuevo `ai-setup` en la tabla de estados (`core/state-machine.js`); estados de análisis: `off | analyzing |
  done | error`.
- La devolución usa la transcripción del **navegador** si hay reconocimiento de voz; si no (por ejemplo, en un casco),
  usa la **transcripción de la IA** y la rotula «Transcripción de la IA (Gemini), a partir del audio».

### Defensas del prompt

- El audio y su contenido son **datos, no instrucciones** (se ignoran pedidos como «poné la nota máxima»).
- Citas **textuales y cortas**; sin evidencia, vacías. Se puede marcar `[inaudible]`.
- **Prohibido** inferir emociones, ánimo, ansiedad, personalidad, salud, edad, género u origen. Solo la entrega, con
  rasgos que se oyen; **ni siquiera como elogio** («tono entusiasta»). Además, la validación reemplaza por un aviso
  cualquier observación de la entrega que nombre una emoción o actitud (`EMOTION_PATTERN`).
- **Sin puntajes numéricos con un brief.** Rúbrica en tres niveles (claro / parcial / falta) con cita y nota. (El pitch libre califica de 1 a 5: ver abajo.)
- Si casi no hay voz: `audible=false` y se explica en `limitations`.

## Pitch libre: la IA califica la idea y cómo la vendés (desde 2026-11-27)

**Qué es.** Un modo sin brief: la persona elige qué vender (un producto, un servicio, un proyecto o una idea, real o inventado) y, si activó la IA,
esta califica **la idea** y **la forma de venderla**. Se activa en el paso del brief con el botón **«Pitch libre: NO/SÍ»** del atril (en el lugar de
«Ajustes», porque el atril admite como máximo cuatro botones); «Usar un brief» o «Otro brief» vuelven a los briefs ficticios. Sin IA se practica igual
(temporizador, medidas, autoevaluación), pero la preparación y la devolución avisan que **la calificación necesita la IA, que es opcional**.

**Qué se califica** (escala entera de 1 a 5 por criterio; 1 = no aparece, 3 = se entiende pero es general, 5 = claro, concreto y bien sostenido):

| Dimensión | Criterios |
|---|---|
| **Tu idea** (lo que se dice) | Problema o necesidad · Propuesta · Público · Beneficio o diferencial · Cierre. Cada uno con una **cita textual** corta y una nota |
| **Cómo la vendiste** | Orden y hilo · Recursos para convencer (ejemplos, datos, comparaciones, una historia) · Ritmo · Claridad al hablar · Entonación y volumen · Pausas y muletillas |

**Reglas de diseño (para que no sea una caja negra):**

- **El promedio de cada dimensión lo calcula la aplicación** (una cifra decimal, p. ej. «3,2 / 5»); la IA **no inventa un puntaje total**. En la devolución
  se dice «promedio de 5 criterios, calculado por la aplicación».
- **Sin evidencia no hay 4 ni 5** en los criterios de la idea: si la IA no trae una cita textual, la aplicación baja la nota a 3 (`normalizeFreeAnalysis`).
- Se califica **cómo está planteada y explicada** la idea, **no si funcionaría** ni si es un buen negocio (lo dice el aviso y lo exige el prompt).
- Si hay muy poca voz, no se entiende o lo que se vende promueve daño, la IA devuelve `rated = false` y **no se muestra ninguna nota**: queda «Sin calificar» y el motivo.
- Todo se rotula **«Calificación orientativa de la IA: interpretación del audio, no una medición ni una nota oficial. Puede equivocarse»**.
- Siguen todas las reglas anteriores: el audio es **dato y no instrucciones**; no se evalúan emociones, ánimo ni personalidad; las observaciones de la **voz** (ritmo,
  claridad, entonación, pausas) que nombren una emoción o actitud se reemplazan por un aviso (`EMOTION_PATTERN`; en el contenido no se aplica, porque «genera confianza»
  puede ser parte del mensaje que se vende).
- **No se envía ningún brief**: el pedido solo dice «pitch libre», el escenario, la duración medida y, si se activó, los números de la cámara.

**Honestidad sobre los límites.** Una calificación de un modelo de lenguaje **no es una medición validada**: puede variar entre dos corridas con el mismo audio, depende de lo que el
modelo entienda del audio y de cómo interprete la escala, y **no se contrastó con la opinión de personas ni se calibró**. La escala y los criterios son una propuesta de diseño del equipo.
Por eso la devolución del pitch libre pide una revisión humana (si la idea es viable, si las calificaciones son justas, si la transcripción es fiel).

**Cómo está en el código:** `FREE_BRIEF` (`config/briefs.js`), evento `TOGGLE_FREE_PITCH` (`core/state-machine.js`), `FREE_SYSTEM_INSTRUCTION`, `FREE_RESPONSE_SCHEMA`,
`normalizeFreeAnalysis` y `analysisSetupFor` (`ai/analysis-prompt.js`), `buildAiSection` (`core/feedback.js`), pantallas en `core/screens.js` y detalle en `ui/html-blocks.js`.
Pruebas: `tests/unit/free-pitch.test.js`, `tests/e2e/ai.mjs` (IA 11 y 12) y la auditoría de legibilidad.

## Gestos con la cámara: qué se mide y qué no

- **Se mide:** % de cuadros con al menos una mano, % con dos manos, velocidad media del centro de la mano (en anchos
  de imagen por segundo), resumida como poco / moderado / mucho.
- **No se mide:** si el gesto fue adecuado, expresividad, emociones ni contacto visual. **Más movimiento no es
  «mejor».**
- Los umbrales (`gestures.moveLowMax` = 0,12; `moveHighMin` = 0,45) son **provisorios y sin calibrar con datos
  reales**. Para considerar la medición se necesitan ≥ 8 cuadros y ≥ 3 s.
- Depende de que la persona esté en cuadro, de la luz y del ángulo. A 8 cuadros/s la detección va por CPU
  (WebAssembly); en la computadora de pruebas (render por software) se lograron ≈3 cuadros/s.
- La descarga del modelo y del runtime (≈22 MB) solo ocurre si se activa la cámara (carga diferida).

## Pruebas y lo que NO se verificó

Ver [`pruebas.md`](pruebas.md), sección «Análisis con IA». Resumen:

- **Verificado:** cliente de la API, prompt, clave, gestos y audio con `fetch` simulado (33 pruebas), sesión con IA simulada, pantallas, escape de
  HTML, captura de audio y gestos con un navegador simulado, y 10 recorridos con un navegador real (micrófono falso
  con un audio de prueba → grabación → WAV 16 kHz → Gemini **simulado** → devolución; cámara falsa con MediaPipe real;
  cancelaciones; clave; CSP).
- **Verificado con la API real (con una clave del equipo, solo desde mi máquina):** acceso al modelo, CORS desde
  `cundix.github.io`, y **3 corridas de la interfaz completa** (clave escrita en el campo → micrófono de prueba con un
  audio en español → grabación → WAV → Gemini real → devolución): ≈24–31 s por análisis, una con caída automática al
  modelo de respaldo por un 503. Todas sobre una presentación **sintética** (voz generada por TTS).
- **NO verificado:** análisis de **voz humana real**; calidad/acierto del análisis de tono; detección de **manos reales**
  (la cámara de prueba no muestra manos); grabación y cámara dentro de un casco físico; límite diario real de la clave.

## Si algo falla

| Mensaje | Causa probable | Qué hacer |
|---|---|---|
| «La API rechazó la clave» | Clave mal copiada, borrada o con restricciones | Generar otra en AI Studio |
| «Se alcanzó el límite de uso…» | Cuota por minuto o por día | Esperar; o usar otra clave/proyecto; el respaldo ya se intentó |
| «El modelo de IA no está disponible…» | El nombre del modelo cambió o la clave no lo permite | Editar `ai.models` en `app-config.js` |
| «No se pudo conectar…» | Sin internet o red que bloquea Google | Revisar la conexión |
| «La IA devolvió una respuesta que no se pudo leer» | Respuesta fuera del esquema | Reintentar el análisis |
| «No se pudo grabar el audio para la IA» | Permiso de micrófono denegado | La práctica sigue sin IA; dar el permiso y reintentar |

**Consejos y muletillas (2026-11-27).** Cada criterio y aspecto trae un `tip` para subir esa nota (página 6 en VR; en el panel de texto, junto a cada nota) y `selling.fillers` cuenta las muletillas. **Limitación:** la transcripción de un modelo de audio tiende a «limpiar» los «eeeh»; con un audio sintético (voz en inglés) no detectó ninguna, así que **la detección de muletillas no está verificada con voz humana real**.
