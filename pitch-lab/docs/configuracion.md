# Cómo editar briefs, tiempos y escenarios

Todo lo editable está en `js/config/`. No hace falta tocar la lógica. Después de editar, recargar la página
(el servidor local no guarda caché) y correr `npm test` para comprobar que no se rompió nada.

## Briefs — `js/config/briefs.js`

Cada brief es un objeto. Se pueden **agregar más** al arreglo `BRIEFS` (el botón «Otro brief» los recorre).

```js
{
  id: 'pausa',                         // identificador único
  brand: 'Yerbita Sol',                // marca FICTICIA
  brandNote: 'Marca ficticia · infusiones frías',   // debe empezar con «Marca ficticia · »
  problem: '…problema de comunicación…',
  audience: '…público…',
  objective: '…objetivo…',
  constraint: '…restricción creativa…',
  guide: '…qué presentar…',
}
```

Reglas del encargo (y de un test): marcas ficticias y rotuladas, sin afirmaciones médicas, sin estadísticas
inventadas, campañas inofensivas. El test `layouts.test.js` exige 7 campos completos y la palabra «ficticia».

## Escenarios y tiempos — `js/config/scenarios.js`

| Campo | Qué controla |
|---|---|
| `durationSec` | Tiempo de la presentación (60, 90, 120) |
| `prepSec` | Tiempo de preparación por defecto (se ajusta en pantalla de 0 a 300 s) |
| `room` | Límites de las paredes (`minX`, `maxX`, `minZ`, `maxZ`, `height`) |
| `walk.zones` / `walk.obstacles` | Dónde se puede caminar y qué no se puede atravesar |
| `spawn` / `pads` | Posición inicial y puntos de teletransporte |
| `audience.seats` o `audience.zones` | Posición del público (asientos sueltos o bloques con filas) |
| `audience.occupancy` | Fracción de asientos ocupados en bloques (patrón fijo y repetible) |
| `audience.viewSeat` | Asiento libre desde el cual se mira el escenario (auditorio) |

Sistema de coordenadas (en metros): el origen es el **atril**; `z` negativo es hacia el público; `x` positivo es la
derecha. Para un escenario **nuevo** hace falta además una función en `js/scenes/` (ver `docs/arquitectura.md`).

## Tiempos, avisos, muletillas y puntaje — `js/config/app-config.js`

```js
timeWarnings: { warnSec: 20, finalSec: 10 },   // avisos de tiempo (segundos restantes)
fillers: ['eh', 'ehh', 'em', 'mm', 'mmm', 'o sea', 'digamos', 'como que', 'básicamente', 'la verdad que'],
minimums: { metricsSeconds: 10, indicatorWords: 40, indicatorSeconds: 20 },
indicator: { weights: {…}, paceWpm: {…}, fillersPer100: {…}, timeUse: {…} },
prep: { minSec: 0, maxSec: 300, stepSec: 15 },
speech: { lang: 'es-AR', fallbackLang: 'es-ES', maxAutoRestarts: 6 },
audioMeter: { silenceRms: 0.015, longPauseSec: 2, sampleMs: 100 },
movement: { walkSpeed: 1.6, turnSpeedDeg: 70, seatedOffsetM: 0.45 },
```

Para agregar una muletilla basta con sumarla a `fillers` (palabra o frase, sin importar mayúsculas ni tildes).
La fórmula del indicador y sus límites están explicados en [`metricas-y-puntaje.md`](metricas-y-puntaje.md).

## Cosas que se rompen fácil

- Si cambian los asientos del público, revisar que **no queden dentro de una zona caminable**: hay un test
  (`layouts.test.js`) que lo comprueba.
- Si cambian los tiempos de aviso, actualizar los tests de `metrics.test.js` («Aviso de tiempo») y el e2e largo
  (`tests/e2e/run.mjs`, «Temporizador real»), que esperan avisos a los 20 y 10 s en el escenario de 60 s.
