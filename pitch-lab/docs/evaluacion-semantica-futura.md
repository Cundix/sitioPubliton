# Evaluación con IA: qué existe hoy y qué falta validar

Hasta el 2026-11-04 la devolución **no evaluaba el contenido** y solo había una interfaz vacía. Desde el 2026-11-13
existe un **análisis con IA opcional** (ver [`analisis-con-ia.md`](analisis-con-ia.md)): Gemini analiza el audio frente
al brief y describe la entrega. Esa interfaz vacía (`semantic-evaluator.js`) se eliminó.

## Lo que quedó implementado

- Análisis del contenido (problema, idea, beneficio, cierre, restricción creativa) con cita textual.
- Observaciones de entrega *percibidas* (ritmo, claridad, entonación y volumen, pausas, muletillas), sin números ni emociones.
- Consejos concretos con su motivo, y límites del análisis declarados por la propia IA.
- Rotulado como «Evaluación asistida por IA» / «interpretación automática», **al lado** de la autoevaluación (no la
  reemplaza) y revisable por una persona.
- Recorrido completo sin IA: es opcional, con una alternativa funcional.
- Consentimiento explícito y aviso de adónde se envía el audio **antes** de empezar.

## Lo que se decidió distinto de la propuesta original

La propuesta del 2026-11-04 decía «hacerlo a través de un backend propio, nunca poner claves en el cliente». El
proyecto se publica como sitio estático (GitHub Pages) y **no tiene backend**. Por eso se adoptó el modelo **«cada
persona usa su propia clave»**: ninguna clave está en el código ni en el repositorio, pero la clave queda en el
navegador de quien la usa. Es un compromiso consciente (ver decisión D15 en
[`decisiones-y-supuestos.md`](decisiones-y-supuestos.md)). Un backend propio sería la mejora natural si el
producto saliera del ámbito del TP.

## Qué falta validar (no se hizo)

| Pendiente | Por qué importa |
|---|---|
| **Voz humana real** | Solo se probó con voz sintética (TTS) y con un tono de prueba. Acentos, ruido, micrófonos y muletillas reales pueden cambiar mucho el resultado |
| **Acierto del análisis** | No se comparó con la opinión de personas expertas. Habría que evaluar una muestra de presentaciones contra la devolución de docentes o pares |
| **Consistencia** | Una misma presentación puede recibir observaciones distintas en dos corridas (la temperatura es 0,3, no 0). No se midió esa variación |
| **Sesgos** | Un modelo de lenguaje puede tratar distinto acentos, velocidades o formas de hablar. No se evaluó; por eso la instrucción prohíbe inferir rasgos personales y la devolución insiste en revisarla con una persona |
| **Manos reales** | La detección con la cámara se verificó solo con una cámara de prueba sin manos |
| **Cuota diaria** | El límite diario real de la clave del equipo debe consultarse en AI Studio |

## Qué no debería hacer (se mantiene)

- Inventar medidas de confianza, emociones o persuasión.
- Presentarse como evaluación profesional o como calificación.
- Guardar audio o transcripciones sin una decisión explícita y visible de la persona.
- Cambiar el indicador técnico por una nota generada por la IA.
