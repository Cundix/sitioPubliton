# Intervención manual del equipo — guía (PENDIENTE)

> **Estado: NO realizada.** Este documento prepara la modificación; **ningún cambio de los descritos acá se aplicó
> al código.** La intervención tiene que hacerla el equipo a mano y documentar el antes/después real. La
> herramienta que generó el proyecto no puede completar este requisito por ustedes.

La consigna pide «una modificación pequeña pero significativa a mano». Abajo hay **una opción recomendada**
(aviso de tiempo proporcional) y **dos alternativas**. Elijan una, háganla entre todos, y completen la
plantilla de la última sección con lo que **realmente** hicieron.

---

## Opción A (recomendada): aviso de tiempo proporcional a la duración del escenario

### Dónde está hoy

Archivo: [`js/core/time-warnings.js`](../js/core/time-warnings.js), líneas 14–19:

```js
export function getTimeWarning(remainingSec, totalSec, thresholds = APP_CONFIG.timeWarnings) {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return 'none';
  if (remainingSec <= thresholds.finalSec) return 'final';
  if (remainingSec <= thresholds.warnSec) return 'warning';
  return 'ok';
}
```

Y los umbrales fijos, en [`js/config/app-config.js`](../js/config/app-config.js), alrededor de la línea 20:

```js
timeWarnings: {
  warnSec: 20,   // "quedan pocos segundos"
  finalSec: 10,  // "cuenta final"
},
```

Hoy el aviso es **el mismo número de segundos en los tres escenarios**: en la Sala de ensayo (60 s) el primer aviso
llega con el 33 % del tiempo restante; en el Auditorio (120 s), con el 17 %.

### Cambio propuesto

Hacer que los umbrales **dependan de la duración total** del escenario (por ejemplo, avisar cuando queda un
porcentaje del tiempo, con un mínimo de segundos para que nunca sea instantáneo). Ustedes deciden los porcentajes y
el mínimo; sugerencia de punto de partida: primer aviso al 25 % y cuenta final al 10 %, con un piso de 5 segundos.

Qué tocar:
1. `getTimeWarning` en `time-warnings.js`: calcular los umbrales a partir de `totalSec`.
2. `APP_CONFIG.timeWarnings` en `app-config.js`: reemplazar los segundos fijos por los porcentajes y el mínimo.
3. Actualizar el comentario del encabezado de `time-warnings.js`.

### Por qué es significativo

- Cambia la **lógica** (no solo un valor) y afecta a las **señales visuales y sonoras** (reloj, chip de la barra
  superior, avisos con sonido y anuncio para lectores de pantalla).
- Mejora la accesibilidad: el aviso deja de ser abrupto en presentaciones cortas y llega con margen en las largas.
- Tiene efectos que se pueden **medir y explicar** en la exposición.

### Cómo comprobarlo

1. **Pruebas de unidad**: `npm test`. Va a fallar la prueba «Aviso de tiempo: niveles según segundos restantes»
   (`tests/unit/metrics.test.js`) porque asume 20 y 10 s: actualícenla con los valores nuevos y agreguen un caso
   para cada duración (60, 90 y 120 s).
2. **Prueba larga e2e**: «Temporizador real: 60 s, avisos 20/10 s…» en `tests/e2e/run.mjs` espera avisos a los 20 y 10 s
   restantes; actualicen esos valores (con tolerancia de ±1 s).
3. **A mano**: elegir la Sala de ensayo, comenzar la presentación y mirar el reloj de la pared. Debe aparecer el
   borde cortado amarillo y el texto «POCO TIEMPO» en el momento que corresponde, y luego el borde rosa y «CUENTA
   FINAL». Repetir en el Auditorio (120 s) y comprobar que el aviso llega más tarde en segundos, no en proporción.
4. Actualizar [`configuracion.md`](configuracion.md) si cambia el significado de `timeWarnings`.

---

## Opción B: cambiar una regla de devolución

Archivo: [`js/core/feedback.js`](../js/core/feedback.js), función `buildTips`, líneas 88–109 (consejo de **ritmo**).
Hoy el rango de referencia sale de `APP_CONFIG.indicator.paceWpm` (110–160 palabras por minuto) y el texto del consejo
es fijo. Cambios posibles: usar rangos distintos por escenario (más lento en el Auditorio), o agregar una regla nueva
(por ejemplo, avisar si se usó menos del 50 % del tiempo y no hubo muletillas).

- **Motivo**: los consejos deben salir de una regla simple sobre un dato medido; cambiar la regla cambia el feedback
  que reciben las personas.
- **Cómo comprobarlo**: agregar o ajustar casos en `tests/unit/metrics.test.js` (los de `buildFeedback`) y mirar la
  página «3 · Consejos» de la devolución con una sesión real.

## Opción C: ajustar una interacción para mejorar la accesibilidad

Candidatos concretos:
- `js/main.js` (bloque de atajos de teclado, alrededor de la línea 139): cambiar el atajo de pausa o agregar uno para
  subir/bajar el volumen.
- `js/ui/draw-button.js`: grosor y color del resaltado cuando se apunta un botón 3D (hoy 6 px y amarillo).
- `js/ui/pitch-ui.js`: tamaño y separación de los botones del atril.

- **Motivo**: que el cambio responda a una dificultad que ustedes hayan observado probando la experiencia.
- **Cómo comprobarlo**: una prueba a mano con dos personas distintas y, si cambia un atajo, actualizar el texto de ayuda
  en `index.html` (tabla «Controles») y el tutorial (`js/core/screens.js`).

---

## Plantilla para registrar la intervención REAL (completar luego)

| Campo | Valor |
|---|---|
| Opción elegida | *(A / B / C u otra)* |
| Integrante(s) que la hicieron | *(nombres)* |
| Fecha | *(completar)* |
| Archivo(s) modificados | *(completar)* |
| Commit | *(enlace al commit del equipo)* |

**Antes** (pegar el fragmento real, con archivo y líneas):

```js
// completar
```

**Después** (pegar el fragmento real):

```js
// completar
```

**Por qué lo cambiamos**: *(completar con sus palabras)*

**Cómo lo comprobamos**: *(pruebas que corrieron, captura de pantalla, prueba a mano)*

**Qué aprendimos / qué cambiaríamos**: *(completar)*

> Cuando esté completa, copiar el antes/después a la diapositiva «Intervención manual» del informe y a la
> exposición. Mientras esté vacía, esa diapositiva debe seguir diciendo **«pendiente»**.
