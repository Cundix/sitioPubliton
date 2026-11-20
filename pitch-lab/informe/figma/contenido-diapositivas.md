# Texto de cada diapositiva (para copiar a Figma)

Generado automáticamente desde `informe-pitch-lab.html`. Cada marco de Figma mide **1920 × 1080 px**.

## Diapositiva 1

Archivo de referencia: `slides/slide-01.png`

```text
TP4 · DISEÑO · EXPERIENCIA INMERSIVA VR (WEBXR)

PUBLITÓN
PITCH LAB

Tu idea merece un buen pitch.

Simulador de presentación de ideas publicitarias.
Complemento inmersivo del evento Publitón — Hackeando el mensaje.

Fiscina · Fuentes · Diaz · Tana  |  2026
```

## Diapositiva 2

Archivo de referencia: `slides/slide-02.png`

```text
01 / PROBLEMA Y OPORTUNIDAD

PRESENTAR UNA IDEA
TAMBIÉN SE ENSAYA.

Publitón lleva a las personas del brief al pitch. Pero el momento de defender la idea en voz alta es el que menos se puede practicar antes del evento.

OPORTUNIDAD

Un espacio donde ensayar la defensa de una campaña sin que nadie juzgue, con control del tiempo y una devolución concreta para repetir.

OBSERVACIÓN DE DISEÑO, NO INVESTIGACIÓN

Esta formulación del problema es una hipótesis del equipo a partir del concepto del evento. No se hicieron entrevistas ni pruebas con personas usuarias: la validación está pendiente (ver diapositiva 3).

Ensayar a solas, sin público real
Saber si se pasan de tiempo
Practicar en espacios de distinta escala
```

## Diapositiva 3

Archivo de referencia: `slides/slide-03.png`

```text
02 / RELACIÓN CON PUBLITÓN Y EL PÚBLICO

DEL BRIEF
AL PITCH.
CÓMO COMPLEMENTA AL EVENTO
Mantiene la identidad: Anton + Barlow, fondo #181D16, azul #0047FF, amarillo #FFC94A y rosa #FF006E
Retoma el paso «Compartir la propuesta / Pitch» del programa del sitio
Usa el nombre tipográfico PUBLITÓN®; no se inventó un logo
Briefs con marcas ficticias rotuladas
HIPÓTESIS DE DISEÑO · VALIDACIÓN PENDIENTE
PÚBLICO

Participantes de Publitón que necesitan presentar y defender ideas creativas, solos o en equipo de 4–5 personas.

En el repositorio no hay User Personas documentados. No se inventaron entrevistas. Siguiente paso: alinear con las personas de los TPs anteriores o hacer 3–5 pruebas de uso. Detalle: docs/usuarios-hipotesis.md
```

## Diapositiva 4

Archivo de referencia: `slides/slide-04.png`

```text
03 / IDEA Y ALCANCE

ELEGÍS, TE PREPARÁS,
PRESENTÁS Y MEJORÁS.
QUÉ ES
Tres espacios: Sala de ensayo (60 s), Reunión con cliente (90 s) y Auditorio (120 s)
Once briefs ficticios de temáticas distintas, editables
Voz opcional en español, con alternativa sin micrófono
Opcional: la IA (Gemini, con tu clave) interpreta el audio y la cámara mide las manos en el dispositivo
Devolución transparente: qué se midió, de dónde sale y qué requiere revisión humana
QUÉ NO ES
No mide confianza, emociones ni persuasión; el contenido solo lo interpreta la IA opcional
La IA es opcional y con clave propia: sin clave, no hay IA
El público no reacciona al discurso
No guarda audio ni transcripciones (con IA, el audio viaja a Google y se avisa antes); sin cuentas, pagos ni multijugador
```

## Diapositiva 5

Archivo de referencia: `slides/slide-05.png`

```text
04 / REFERENTES (1 DE 2) · CONSULTADOS EL 2026-11-04

QUÉ MIRAMOS
Y QUÉ TOMAMOS.
VIRTUALSPEECH

virtualspeech.com/about

Entrenamiento ante una audiencia virtual: del pitch 1 a 1 a un escenario de conferencias. Práctica en navegador, tablet o casco. Puntajes y debrief con un coach de IA.

Tomamos: ensayar ante una audiencia simulada y que funcione también en pantalla.
Distinto: la IA es opcional y se rotula como interpretación; sin puntajes de calidad; lo medido va separado de lo interpretado.

OVATION

Reseña: roadtovr.com/ovation-vr-public-speaking-training-simulator

Escenas desde una sala de reuniones hasta un salón de conferencias; herramientas dentro del espacio (puntero láser, control de presentación); devolución sobre muletillas, mirada y manos. Menús con láser «poco pulidos» según la reseña.

Tomamos: escala distinta + herramientas en el espacio.
Distinto: no medimos mirada ni manos; botones grandes.

POWERPOINT SPEAKER COACH

support.microsoft.com (Rehearse with Coach)

Devolución sobre ritmo, muletillas y más; informe de ensayo con estadísticas y sugerencias. Es una función en la nube: las emisiones de voz se envían a Microsoft; pide micrófono, conexión y cuenta.

Tomamos: informe con medidas concretas y declarar qué se envía antes de activar el micrófono.
Distinto: sin cuenta, sin guardar nada.
```

## Diapositiva 6

Archivo de referencia: `slides/slide-06.png`

```text
04 / REFERENTES (2 DE 2)

HALLAZGOS
Y BASE TÉCNICA.
HALLAZGOS QUE GUIARON EL DISEÑO
La presentación sucede dentro de un espacio con público y herramientas
La devolución muestra medidas y requisitos de privacidad
Ninguno separa claro medición de interpretación: Pitch Lab separa «qué se midió», «consejos» y «revisión humana»
Los menús con puntero piden botones grandes y separados
REFERENCIAS TÉCNICAS

MDN · Web Speech API (el audio puede enviarse a un servicio web en algunos navegadores)
API de Gemini (documentación oficial, aistudio.google.com/docs) · MediaPipe Hand Landmarker (Google)
A-Frame 1.8.0 (three.js r184) · WebXR Samples (immersive-web.github.io)

IMÁGENES: PENDIENTE DEL EQUIPO

No se reutilizaron imágenes de terceros. Para llevar el informe a Figma, el equipo debe sumar una captura por referente, con cita y enlace:

VirtualSpeech: sección «Public speaking» de la página
Ovation: imagen de la ficha oficial en la tienda del casco (la ficha oficial no se pudo verificar)
Speaker Coach: pantalla del informe de ensayo (página de soporte de Microsoft)

Detalle y análisis completo: docs/referentes.md
```

## Diapositiva 7

Archivo de referencia: `slides/slide-07.png`

```text
05 / POR QUÉ VR

LO QUE CAMBIA
ES EL ESPACIO.
Escala y profundidad: del cuarto de 5,6 m al auditorio de 30 m
Presencia del público alrededor: 3, 5 o 64 personas repartidas
Distancia respecto del público: 2,4 m · 2,1–5,1 m · 8,5–20 m
Reunión chica vs. auditorio: se siente, no solo se lee
Objetos y controles situados: atril, reloj, pantalla del brief, marcas de teletransporte

Funciona igual con mouse y teclado: la VR es un complemento, no un requisito.

Auditorio visto desde un asiento del público (captura real, navegador de escritorio)
```

## Diapositiva 8

Archivo de referencia: `slides/slide-08.png`

```text
06 / RECORRIDO

UN CAMINO CON SALIDAS CLARAS.
1
Inicio y tutorial salteable
2
Elegir escenario (maquetas)
3
Brief ficticio
4
Preparación (tiempo ajustable)
5
Presentación con reloj
6
Devolución
CONTROL
Pausa y continuación
Finalizar antes de tiempo
Cancelar con confirmación
Reinicio limpio
RECUPERACIÓN
Micrófono rechazado → sin voz
Reconocimiento no disponible → sin voz
Silencio → reintentar, texto o continuar
DESPUÉS
Reintentar el mismo escenario
Cambiar de escenario
Revisar la transcripción
```

## Diapositiva 9

Archivo de referencia: `slides/slide-09.png`

```text
07 / DISEÑO ESPACIAL · 1 DE 3

SALA DE ENSAYO
60 s · espacio chico
3 oyentes a 2,4–2,6 m
Atril, pantalla del brief (pared azul de marca) y reloj enfrentado
Alfombra, ventana, puerta y estantes: ambiente tranquilo

Para aprender la mecánica sin presión.

Presentando: reloj en la pared, atril con botones, tres oyentes (captura real)
```

## Diapositiva 10

Archivo de referencia: `slides/slide-10.png`

```text
07 / DISEÑO ESPACIAL · 2 DE 3

REUNIÓN CON CLIENTE
90 s · sala mediana
Mesa larga y 5 personas a 2,1–5,1 m: se nota cada mirada
Pantalla ancha del brief y ventanal con ciudad
Quien presenta está de pie en la cabecera

Cercanía: foco en problema, propuesta y beneficio.

Reunión con cliente (captura real)
```

## Diapositiva 11

Archivo de referencia: `slides/slide-11.png`

```text
07 / DISEÑO ESPACIAL · 3 DE 3

AUDITORIO
120 s · gran escala
Escenario elevado, platea con rake, dos alas y un balcón
64 personas en 4 zonas, a 8,5–20 m
Reloj colgante sobre la platea y pantalla gigante
Marca «Ver desde el público» para mirar el escenario

Animaciones discretas; sin abucheos ni reacciones humillantes.

Auditorio visto desde el escenario (captura real)
```

## Diapositiva 12

Archivo de referencia: `slides/slide-12.png`

```text
08 / MECÁNICA CENTRAL

EL ATRIL ES EL CONTROL.
Una acción principal grande por estado; secundarias con menos énfasis
Reloj visible con aviso visual (borde, ícono, texto) y sonoro
Preparación que no empieza sola
Cancelar pide confirmación y detiene el tiempo

Computadora: mouse + W A S D, Enter, P, F, Esc, R, T.
VR: rayo del control + gatillo, marcas de teletransporte, joystick para girar por tramos, «Recentrar», «Sentado», altura de la vista y vibración ajustables, «Salir de VR». «Finalizar» pide mantener presionado. Sin desplazamiento continuo.

Preparación: opciones en el panel, acción principal en el atril (captura real)
```

## Diapositiva 13

Archivo de referencia: `slides/slide-13.png`

```text
09 / DEVOLUCIÓN TRANSPARENTE

QUÉ SE MIDIÓ.
Duración sin pausas · palabras · palabras por minuto · muletillas (lista configurable)
Indicador técnico orientativo = 40 % ritmo + 30 % muletillas + 30 % uso del tiempo; solo con ≥ 40 palabras y ≥ 20 s de reconocimiento
Sin datos: «Sin datos suficientes» y autoevaluación
Texto escrito o de demostración: rotulado y sin medidas de voz
NO SE MIDE

Confianza, ansiedad, emociones, contacto visual, persuasión ni calidad del discurso.

Devolución con datos. Texto generado por un simulador de reconocimiento de pruebas, no es voz real. Con la IA opcional se suman las pestañas 4 y 5: interpretación rotulada, sin puntajes.
```

## Diapositiva 14

Archivo de referencia: `slides/slide-14.png`

```text
10 / IDENTIDAD Y ACCESIBILIDAD

GRÁFICA, PERO LEGIBLE.
IDENTIDAD
#181D16 fondo
#20261C superficies
#0047FF acción
#FFC94A énfasis
#FF006E acento

ANTON para títulos y Barlow para texto: archivos locales del sitio, sin fuentes remotas. Señalética integrada al espacio (cartel de sala, «Salida», «Atril»).

ACCESIBILIDAD
Modo sin voz completo y tiempo de preparación ajustable
Sin límite de tiempo, volumen regulable y movimiento reducido
Nada se comunica solo con color (íconos, texto, trazos)
Panel de texto con foco visible y lector de pantalla; recorrido completo solo con teclado
Modo sentado y recentrado; salida de VR siempre disponible

Falta una auditoría automática de contraste (pendiente).
```

## Diapositiva 15

Archivo de referencia: `slides/slide-15.png`

```text
11 / ARQUITECTURA

LA LÓGICA NO SABE
NADA DE 3D.
SESIÓN
Tabla de estados, un solo temporizador, pausa, cancelación, voz
core/state-machine.js · session.js
EVALUACIÓN
Métricas, indicador, consejos, rúbrica: funciones puras
core/metrics.js · feedback.js
VOZ, IA Y CÁMARA
Web Speech y medidor; opcional: Gemini (clave propia) y manos con MediaPipe en el dispositivo
voice/* · ai/*
MODELO DE PANTALLA
Qué se muestra y qué acciones hay en cada estado (dos renderizadores)
core/screens.js
ESCENAS
Hub, sala, cliente y auditorio; público instanciado
scenes/* · components/stage-controller.js
INTERFAZ
Panel, atril, reloj y botones 3D + panel de texto accesible
ui/* · components/xr-support.js (xr-ray)

A-Frame 1.8.0 incluido (sin CDN) · sitio estático para GitHub Pages · 183 pruebas de unidad, 32 de navegador real, 13 con emulador WebXR y una auditoría de legibilidad del texto 3D. Detalle: docs/arquitectura.md
```

## Diapositiva 16

Archivo de referencia: `slides/slide-16.png`

```text
12 / BITÁCORA DE PROMPTS

LO QUE REALMENTE SE PIDIÓ.
PROMPT 1 · 2026-11-04

Encargo inicial completo a Claude Code (modelo Sonnet 5.5): construir, probar, documentar y publicar la experiencia de forma autónoma, sin inventar evidencia.

Texto íntegro en docs/prompts/01-encargo-inicial.md. Fue el único prompt de esa sesión: no hubo preguntas intermedias.

PEDIDOS DEL 2026-11-13

Informe en Figma (pendiente), ver el juego sin VR y el análisis real del audio con IA y cámara: docs/prompts/02-analisis-con-ia.md (la clave pegada en el chat se omite).

PENDIENTE DEL EQUIPO
Prompts de los TPs 1 a 3 (no están en el repositorio)
Prompts que el equipo use para la intervención manual
Aclarar qué hizo la herramienta y qué hizo el equipo
```

## Diapositiva 17

Archivo de referencia: `slides/slide-17.png`

```text
13 / PROBLEMA REAL RESUELTO

UNA FUGA QUE
UNA PRUEBA ENCONTRÓ.

Al ir del hub a una sala y volver, las geometrías en la GPU crecían 12 por cada ida y vuelta.

Causa: los pedestales de las maquetas (4 geometrías × 3) no se registraban para liberarse.

Solución: registrarlos con kit.track() en scenes/maquette.js.

Comprobación: la prueba «recursos 3D» pasa: 84 → 85 al volver.

GEOMETRÍAS AL VOLVER AL HUB

Antes del arreglo

Inicio
84
1.ª vuelta
97
2.ª vuelta
109
3.ª vuelta
121

Después del arreglo

Inicio → vuelta
84
85

Otros problemas reales (8) en docs/problemas-resueltos.md.
```

## Diapositiva 18

Archivo de referencia: `slides/slide-18.png`

```text
14 / INTERVENCIÓN MANUAL DEL EQUIPO

PENDIENTE.
NO REALIZADA TODAVÍA

La modificación a mano la hace el equipo. La herramienta solo dejó una guía; no aplicó ningún cambio ni lo presenta como hecho por estudiantes.

Propuesta A: aviso de tiempo proporcional a la duración del escenario (js/core/time-warnings.js). Alternativas: una regla de devolución o una mejora de accesibilidad.

Guía: docs/intervencion-manual.md

ANTES (CÓDIGO REAL)

— completar con el fragmento original, archivo y líneas —

DESPUÉS (CÓDIGO REAL)

— completar con el cambio hecho por el equipo, motivo y cómo lo comprobaron —
```

## Diapositiva 19

Archivo de referencia: `slides/slide-19.png`

```text
15 / PRUEBAS Y LIMITACIONES

LO PROBADO,
LO PENDIENTE.
VERIFICADO
NIVEL	RESULTADO
Pruebas de unidad	183 / 183
Navegador real (Edge 156, mouse y teclado, 60 s reales)	22 / 22
IA y cámara en navegador real (Gemini simulado, micrófono y cámara falsos)	10 / 10
Modo inmersivo con emulador WebXR	13 / 13
Texto 3D: ninguno bajo 0,8° (medido)	OK
Rutas de GitHub Pages y sitio anterior	OK
PENDIENTE / NO VERIFICADO
Casco físico y comodidad en VR (ajustes de VR sin probar)
Rendimiento y cuadros por segundo (no medidos)
Voz real: se probó con simulaciones; el servicio es del navegador
IA con voz humana real y manos reales ante la cámara; límite diario de la clave
Firefox, Safari y celulares
Validación con personas usuarias
Auditoría automática de contraste

Detalle: docs/pruebas.md
```

## Diapositiva 20

Archivo de referencia: `slides/slide-20.png`

```text
16 / ENLACE DE LA EXPERIENCIA

PROBALA VOS.

PUBLICADO Y VERIFICADO

https://cundix.github.io/sitioPubliton/pitch-lab/

Verificado con una consulta HTTP y una carga en navegador el día de la publicación.

CÓMO EJECUTARLA
node tools/serve.mjs y abrir localhost:8080/pitch-lab/
Sin micrófono también funciona
Casco: abrir el enlace en su navegador (no probado)
```

## Diapositiva 21

Archivo de referencia: `slides/slide-21.png`

```text
17 / PRÓXIMOS PASOS

LO QUE SIGUE.
VALIDAR
Probar en un casco real
Entrevistas y pruebas de uso con el público objetivo
Medir rendimiento en el casco
MEJORAR
Intervención manual del equipo
Más briefs y un cuarto escenario
Auditoría de accesibilidad automática
EXPLORAR
Validar la IA con voz real y con personas expertas; backend propio para la clave
Enlace desde el sitio de Publitón
```
