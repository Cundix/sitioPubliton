# Métricas y puntaje: cómo se calculan, qué datos usan y qué límites tienen

Todo el cálculo está en `js/core/metrics.js` y `js/core/feedback.js` (funciones puras, con tests en
`tests/unit/metrics.test.js`). Los valores configurables están en `js/config/app-config.js`.

> **Nada de esto es una evaluación profesional ni del contenido.** Se miden datos concretos y se muestra de dónde
> sale cada uno. Cuando no hay datos suficientes se dice «Sin datos suficientes» y se ofrece la autoevaluación.

## Qué se mide

| Medida | Cómo se calcula | Datos que usa | Cuándo aparece |
|---|---|---|---|
| **Duración efectiva** | Milisegundos acumulados mientras se está en *presentando*, **sin pausas** (ni el diálogo de cancelar) | Cronómetro de la sesión (marcas de reloj) | Siempre que hubo tiempo registrado |
| **Uso del tiempo** | Duración efectiva ÷ tiempo del escenario (60/90/120 s) | Cronómetro + configuración del escenario | Solo con límite de tiempo (no en práctica libre) |
| **Palabras** | Secuencias de letras/números (con tildes, ñ y apóstrofes internos) | Transcripción final | Si hay transcripción de cualquier origen |
| **Palabras por minuto** | Palabras ÷ (duración efectiva en minutos) | Transcripción **del reconocimiento** + cronómetro | Solo si el texto proviene del reconocimiento y la duración es ≥ 10 s |
| **Muletillas** | Coincidencias por palabra completa (sin importar mayúsculas ni tildes) con la lista `APP_CONFIG.fillers` | Transcripción | Si hay transcripción |
| **Nivel de audio** (opcional) | Se muestrea el nivel (RMS) del micrófono cada 100 ms: segundos con sonido sobre el umbral y cantidad de pausas largas (≥ 2 s sin sonido) | Micrófono, **solo si se activó «Medir nivel de audio»** | Solo si se midió de verdad |

### Origen de la transcripción

Toda transcripción lleva su **origen**, que se muestra en la revisión y en la devolución:

| Origen | Qué es | Efecto en las medidas |
|---|---|---|
| `speech` | Texto del reconocimiento del navegador, sin cambios | Se calcula todo |
| `speech-edited` | Reconocimiento corregido por la persona | Se calcula, con aviso «texto editado» |
| `typed` | Escrito o pegado por la persona | Palabras y muletillas sí; **no** palabras por minuto ni indicador |
| `demo` | Texto de ejemplo («Demostración») | Palabras y muletillas sí; **no** palabras por minuto ni indicador; banner «DEMOSTRACIÓN» |
| `none` | Sin transcripción | Solo duración y uso del tiempo |

**No se atribuyen métricas acústicas a texto escrito.** Los silencios **no se estiman** a partir de la puntuación
de la transcripción: solo se muestran si el medidor de audio realmente los midió.

## Indicador técnico orientativo (0–100)

Es un puntaje **opcional y transparente**; la fórmula se muestra en la devolución.

```
Indicador = 40 % ritmo + 30 % muletillas + 30 % uso del tiempo
```

| Componente | Puntaje 1 (máximo) | Puntaje 0 |
|---|---|---|
| **Ritmo** | Entre 110 y 160 palabras por minuto | 60 o menos / 220 o más (baja linealmente) |
| **Muletillas** | 1 o menos cada 100 palabras | 8 o más cada 100 palabras (baja linealmente) |
| **Uso del tiempo** | Entre 70 % y 105 % del tiempo | 30 % o menos / 150 % o más |

- Si no hay límite de tiempo (práctica libre), el componente de uso del tiempo se omite y los pesos se reparten
  entre los otros dos.
- **Se calcula solo con datos suficientes**: transcripción del reconocimiento (original o editada), al menos
  **40 palabras** y **20 segundos** efectivos. Si no, muestra «Sin datos suficientes» y el motivo.
- **No es aleatorio**: mismos datos, mismo resultado (hay un test que lo comprueba).
- Los umbrales y pesos se pueden cambiar en `app-config.js` (`indicator`, `minimums`).

## Consejos

Hasta **dos** consejos, cada uno derivado de una regla sobre un dato medido y con el dato que lo motivó
(«Basado en: …»). Reglas actuales (`buildTips` en `feedback.js`):

1. **Ritmo**: por encima/dentro/por debajo del rango de referencia (110–160 palabras por minuto).
2. **Muletillas**: si hay 2 o más y más de 1 cada 100 palabras, nombra la más frecuente.
3. **Uso del tiempo**: si superó el 105 % o usó menos del 70 %.

Se ordenan por cuánto se alejan de lo esperado. Si no hay datos que permitan un consejo específico se dice así.

## Aspectos que requieren revisión humana

La devolución los lista siempre: si el problema se entiende, si la idea respeta la restricción creativa, si el
beneficio es creíble, si el cierre propone un siguiente paso y si la transcripción refleja lo dicho. La
**rúbrica de autoevaluación** (¿Presenté el problema? ¿Expliqué la idea? ¿Justifiqué el beneficio? ¿Cerré con una
propuesta clara?) la completa la persona; no entra en el indicador.

## Qué NO se mide (y por qué)

No se miden **confianza, ansiedad, emociones, contacto visual, persuasión ni calidad integral del discurso**: no hay
datos para hacerlo de forma honesta. La orientación del casco **no es seguimiento ocular** y no se usa como tal. La
audiencia virtual no reacciona al discurso.

## Limitaciones y errores de reconocimiento

- El reconocimiento de voz puede **equivocar palabras**, **omitir muletillas** («eh», «mm» casi nunca se transcriben)
  y **confundir** términos de marca. Eso altera palabras, palabras por minuto y muletillas. Por eso la transcripción
  es revisable antes de calcular.
- Algunas muletillas pueden ser palabras legítimas según el contexto («tipo de campaña»); por eso la lista
  predeterminada es conservadora y editable.
- Las **palabras por minuto** incluyen el tiempo de pausas breves de la persona (silencios dentro de la
  presentación); solo se excluyen las pausas de la sesión.
- La medición de **nivel de audio** depende del micrófono, su ganancia y el ruido ambiente; no distingue voz de ruido.
- Las medidas son un punto de partida para reflexionar, **no una calificación**.
