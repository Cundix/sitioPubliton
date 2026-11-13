# Investigación de referentes

Consultados el **2026-11-04** en las páginas indicadas. Solo se registran hechos que figuran en esas fuentes.
**No se reutilizan imágenes** de terceros: para cada referente se indica qué captura debe incorporar el equipo (con
cita de la fuente) al llevar el informe a Figma.

> Lo que no se pudo confirmar en la fuente está marcado como «no verificado». No se inventaron citas ni resultados.

## Resumen

| # | Referente | Tipo | Qué aporta a Pitch Lab |
|---|---|---|---|
| 1 | VirtualSpeech | Entrenamiento de presentaciones en VR / navegador | Practicar ante una audiencia virtual, en casco o en el navegador |
| 2 | Ovation | Simulador de oratoria en VR | Escenas de escala distinta (sala chica / sala de conferencias) y herramientas dentro del espacio |
| 3 | Microsoft PowerPoint Speaker Coach | Devolución de ensayos | Informe con medidas concretas, requisitos y privacidad explícitos |
| 4 | Web Speech API (MDN) | Referencia técnica | Qué se puede (y qué no) prometer sobre el reconocimiento de voz |
| 5 | A-Frame 1.8.0 + WebXR Samples | Referencia técnica | Base tecnológica abierta y estándar para la experiencia |

## 1. VirtualSpeech

- **Fuente**: <https://virtualspeech.com/about>
- **Qué hace (según la página)**: entrenamiento en presentaciones frente a una audiencia virtual, «desde un pitch
  1 a 1 hasta un escenario de conferencias»; práctica en el navegador, en tablet o en casco (VR y AR);
  puntajes y una devolución con un coach de IA después de cada sesión.
- **No verificado en la página**: ambientes concretos, comportamiento de la audiencia y métricas específicas
  (ritmo, muletillas).
- **Qué tomamos**: la idea central de **ensayar ante una audiencia simulada** y que la experiencia **funcione también
  en pantalla**, no solo en casco.
- **En qué nos diferenciamos**: la IA es **opcional** (con la clave de cada persona) y se rotula como interpretación;
  no damos «puntajes» de calidad; separamos lo medido, lo interpretado y lo que requiere revisión humana. Sin cuentas ni pagos.
- **Captura sugerida para el informe**: la sección «Public speaking» de la página (con cita y enlace).

## 2. Ovation

- **Fuente verificada**: reseña de Road to VR: <https://www.roadtovr.com/ovation-vr-public-speaking-training-simulator/>
- **Qué hace (según la reseña)**: escenas que van desde un grupo chico en una sala de reuniones hasta una multitud
  en un salón de conferencias; materiales dentro del espacio (tarjetas, teleprompter, diapositivas en pantallas);
  herramientas como micrófono, puntero láser y control de presentación; devolución en tiempo real sobre muletillas,
  distribución de la mirada, distancia del micrófono y movimiento de manos; el menú se usa con puntero láser, algo
  que el revisor encontró poco pulido.
- **No verificado**: la ficha oficial de la aplicación (el equipo debe buscarla en la tienda del casco).
- **Qué tomamos**: **cambiar la escala del espacio** (sala chica, mesa de reunión, auditorio) y poner **las
  herramientas dentro del espacio** (atril, pantalla, reloj), usando puntero láser para los menús.
- **En qué nos diferenciamos**: no medimos mirada, manos ni emociones (no tenemos datos para hacerlo de forma
  honesta); la audiencia es ambiental y no reacciona al discurso; el menú del atril usa botones grandes para
  evitar el problema de menús poco pulidos que señala la reseña.
- **Captura sugerida**: imagen de prensa o de la tienda oficial de las escenas (con cita).

## 3. Microsoft PowerPoint Speaker Coach

- **Fuente**: <https://support.microsoft.com/en-us/office/rehearse-your-slide-show-with-speaker-coach-cd7fc941-5c3b-498c-a225-83ef3f64f07b>
- **Qué hace (según la página)**: da devolución sobre ritmo, tono, muletillas, lenguaje informal, lenguaje
  inclusivo y si se lee el texto de la diapositiva; al salir del ensayo abre un **informe con estadísticas y
  sugerencias** (que desaparece al cerrarse); es una función con servicio en la nube: **las emisiones de voz se
  envían a Microsoft**; requiere micrófono, conexión y cuenta; solo en inglés.
- **Qué tomamos**: el **informe de ensayo con medidas concretas** y, sobre todo, **declarar de entrada qué se envía y
  qué se requiere** (privacidad y requisitos explícitos antes de activar el micrófono).
- **En qué nos diferenciamos**: español, sin cuenta, sin guardar audio ni texto; transparencia sobre la fórmula y sobre qué
  no se puede medir (la IA opcional avisa antes qué se envía); alternativa sin voz completa.
- **Captura sugerida**: pantalla del informe de «Rehearse with Coach» (cita de la página de soporte).

## 4. Web Speech API (MDN)

- **Fuente**: <https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition>
- **Hechos relevantes**: disponibilidad limitada (no es *Baseline*); en algunos navegadores, incluido Chrome, **el
  audio se envía a un servicio web para reconocerlo**, por lo que no funciona sin conexión; `lang`, `continuous` e
  `interimResults` configuran el idioma, la escucha continua y los resultados parciales.
- **Decisiones que de ahí salen**: detectar capacidades en tiempo de ejecución, **no prometer procesamiento
  local**, avisar antes de activar el micrófono y ofrecer siempre una alternativa sin voz.

## 5. A-Frame 1.8.0 y WebXR Samples

- **Fuentes**: <https://aframe.io/blog/aframe-v1.8.0/> y <https://immersive-web.github.io/webxr-samples/>
- **Hechos relevantes**: A-Frame 1.8.0 usa three.js r184 e incluye más de 20 correcciones y 15 mejoras para
  periféricos y controles. Los *WebXR Samples* son páginas de ejemplo del uso del WebXR Device API.
- **Qué tomamos**: tecnología abierta, estable y estándar; sin motores propietarios ni servicios pagos.

## Hallazgos comunes que guiaron el diseño

1. Los referentes de VR **ponen la presentación dentro de un espacio con público y herramientas**, no en un formulario.
2. Los de devolución **muestran medidas concretas y requisitos de privacidad** (qué se envía y dónde).
3. Ninguno de los consultados deja claro qué parte de su análisis es una **medición** y cuál una **interpretación**:
   Pitch Lab separa «qué se midió», «consejos» y «revisión humana».
4. Los menús con puntero necesitan **botones grandes y separados** (observación de la reseña de Ovation).

## Para completar en Figma (pendiente del equipo)

- Incorporar una captura por referente con su cita y enlace.
- Revisar que las afirmaciones del informe coincidan con lo que figura en cada fuente (las páginas pueden cambiar).
