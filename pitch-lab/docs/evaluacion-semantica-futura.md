# Evaluación semántica con IA: interfaz preparada, NO implementada

La devolución actual **no evalúa el contenido** de lo que dijo la persona. Para una versión futura se dejó una
interfaz separada que el producto **no usa** y que **no simula** nada:

`js/ai/semantic-evaluator.js`

```js
export class SemanticEvaluator {
  get available() { return false; }                 // siempre false hasta que exista una implementación real
  async evaluate({ transcript, brief }) { throw new SemanticEvaluatorUnavailable(); }
}
```

## Qué mostrar hoy

La devolución dice expresamente: «La evaluación semántica con IA no está disponible en esta versión. Pedí una
opinión a una persona del equipo.» (página «Consejos» y panel de texto).

## Cómo se podría conectar (propuesta)

1. Implementar una clase con la misma forma (`evaluate` devuelve `{ rubric, notes }`, donde `rubric` responde las
   mismas cuatro preguntas: problema, idea, beneficio y cierre).
2. Hacerlo **a través de un backend propio**: nunca poner claves ni secretos en el cliente.
3. Pedir **consentimiento explícito** antes de enviar la transcripción y explicar qué servicio la recibe.
4. Rotular el resultado como «Evaluación asistida por IA», mostrarlo **al lado** de la autoevaluación (no
   reemplazarla) y marcarlo como revisable por una persona.
5. Mantener el recorrido completo sin IA: la función debe ser opcional, con una alternativa funcional.

## Qué no debería hacer

- Inventar medidas de confianza, emociones o persuasión.
- Presentarse como evaluación profesional.
- Guardar transcripciones sin una decisión explícita y visible de la persona.
