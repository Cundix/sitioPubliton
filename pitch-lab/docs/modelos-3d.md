# Modelos 3D: qué se mejoró y cuánto cuestan (2026-11-19)

Todo el espacio es **geometría procedural** (cajas, cilindros, esferas) y **texturas dibujadas en canvas**: no hay modelos ni
texturas descargados, igual que antes. Se mantuvo el estilo «low poly» de la marca (colores planos, sombreado facetado). Las
mejoras buscan que los espacios y el público se lean como **lugares y personas**, no como maquetas abstractas.

> **Antes / después** (mismas cámaras, navegador de pruebas): carpeta [`../capturas/3d/`](../capturas/3d/) — archivos `antes-*.png`
> (versión publicada el 2026-11-13) y `despues-*.png`. Se generan con `node tools/shots-3d.mjs`.

## Qué cambió

| Pieza | Antes | Ahora |
|---|---|---|
| **Público** (`scenes/audience.js`) | Cono + esfera sobre un asiento | Figura sentada: torso, hombros, cuello, cabeza con **pelo** (corto/largo/calvo), **brazos con manos**, **muslos, piernas y zapatos**. Variedad determinista de altura, ancho, ropa, piel, pelo y **postura** (manos en el regazo, brazos cruzados, apoyados). Mismo movimiento ambiental suave de siempre |
| **Asientos** | Base + respaldo + una columna | Sillas con cuatro patas (sala y reunión) y butacas de teatro con **apoyabrazos** (auditorio) |
| **Atril** (`scenes/furniture.js`) | Caja + plano inclinado | Plinto, panel frontal con logotipo «PITCH LAB», moldura y **micrófono de cuello de cisne**. El plano de controles no cambió de lugar ni de tamaño |
| **Pisos** | Color liso | Textura propia por espacio: **alfombra modular** (sala), **parquet** (reunión), **tablas de escenario** (auditorio) y **piso radial** en el vestíbulo |
| **Paredes y techo** | Paredes lisas | Zócalo alto con guarda de color, **luz indirecta** en el perímetro del techo, vigas y paneles con marco |
| **Ventanas y puertas** | Cajas oscuras | Marcos, travesaños, alféizar, **cielo de atardecer** (degradado) y, en la reunión, **ciudad con ventanas encendidas**; puertas con marco, paneles y manija |
| **Afiches** | — | Cuatro estilos de arte geométrico de la marca dibujados en canvas, enmarcados |
| **Plantas y estantes** | Conos sueltos; libros | Plantas con 11 hojas en abanico, maceta con borde y tierra; estantes con libros inclinados, portarretrato y planta chica |
| **Reunión con cliente** | Mesa con cuatro patas | Mesa con **bases tipo pedestal**, canto, **laptops**, teléfono de conferencia, jarra y vasos |
| **Auditorio** | Escenario liso | **Parlantes**, **monitores de escenario**, **haces de los focos**, **listones acústicos** en las paredes laterales y borde luminoso del techo |
| **Vestíbulo** | Maquetas con esferas | Personas de las maquetas como figuras, **anillo luminoso** en el pie de los pedestales, **costillas** en la pared curva y óculo luminoso. La **franja amarilla** (9,6 m) se parte en tres tramos que siguen la curva: antes se salía de la pared y se cortaba |

## Cómo se mantuvo liviano

- **Lotes de geometría** (`Kit.batch()`): decenas de cajas del mismo material se funden en **una sola malla** (una llamada de dibujo).
- **Instanciado** para el público: cada parte del cuerpo es una malla instanciada para todas las personas.
- **Nivel de detalle** del público: a más de 11 m del atril no se dibujan cuello, manos, zapatos ni pelo largo (no se distinguen).
- **Material difuso** (Lambert) en las superficies mates (casi todas) en vez del PBR estándar: más barato y sin diferencia visible a
  esta escala. Se conserva el estándar donde hay brillo o metal (pisos de madera, piezas metálicas).
- Todo se libera al cambiar de espacio (texturas, materiales y geometrías pasan por `kit.track`); la prueba de recursos lo comprueba.

## Presupuesto y mediciones

Presupuesto fijado en la prueba de recursos (`tests/e2e/run.mjs`, prueba 15): **< 200 llamadas de dibujo y < 80.000 triángulos por
espacio**. Medición en el navegador de pruebas (los números son de lo que se dibuja, no del rendimiento en casco):

| Espacio | Llamadas antes → ahora | Triángulos antes → ahora |
|---|---|---|
| Vestíbulo | 87 → 104 | 10,7 mil → 14,1 mil |
| Sala de ensayo | 79 → 102 | 1,8 mil → 3,8 mil |
| Reunión con cliente | 98 → 124 | 2,9 mil → 6,4 mil |
| Auditorio | 96 → 131 | 21,8 mil → 42,4 mil |

**Costo de dibujo con WebGL por software** (`node tools/bench-3d.mjs`, mismo equipo, mismas condiciones; es muy ruidoso y **solo sirve
para comparar versiones**): sin los cambios de material, la versión nueva tardaba ~1,5–2,5 veces más por cuadro; con el material
difuso, el vestíbulo y la sala quedaron a la par de la versión anterior, y el auditorio y la reunión algo por debajo (el público
nuevo es la parte más cara). **No se midió en un casco ni en una GPU real**: no se afirma ninguna tasa de cuadros. Antes de
usarlo en un casco conviene medir allí, empezando por el auditorio.

## Límites y pendientes

- Las caras no tienen rasgos (ojos, boca): es una decisión de estilo y de costo; las figuras no expresan emociones.
- El público sigue sin reaccionar a lo que se dice ni al puntaje (movimiento ambiental).
- Rendimiento en casco: **no medido**. Si el auditorio resultara pesado, las palancas son bajar la ocupación
  (`audience.occupancy` en `config/scenarios.js`), acercar `NEAR_DIST` en `audience.js` o quitar los haces de luz (`addLightBeam`).
- La mejora es visual: no cambia la lógica, los tiempos ni las zonas caminables (los obstáculos y límites son los mismos).

## Cambios posteriores por la revisión de UX para XR (2026-11-20)

Detalle en [`auditoria-ux-xr.md`](auditoria-ux-xr.md). Afectan a lo que se **lee** dentro de los espacios, no a los modelos:

- El panel flotante pasó de escala 1,2 a **1,3** en los cuatro espacios.
- El **reloj de la pared** muestra solo números (más grandes); la etiqueta y el aviso en palabras están en el reloj del atril.
- **Recordatorio de la marca** más grande en la sala (escala 1,1) y la reunión (1,5), y **nuevo en el auditorio**: colgado bajo el reloj, con su
  marco y dos varillas (suma un marco y dos cilindros; el presupuesto de la prueba 15 sigue cumpliéndose).

## Docentes en 3D en el público (2026-11-20)

La persona usuaria aportó seis modelos 3D de personas (un `.zip` con un `.fbx` con esqueleto y una textura de 2048 × 2048 por persona) y pidió que
**cada persona del público tenga un 30 % de probabilidad de ser una de ellas** (el resto sigue siendo la figura genérica de siempre). Origen, licencia y
consentimiento: [`../assets/personas/LEEME.md`](../assets/personas/LEEME.md). Decisiones D41–D47: [`decisiones-y-supuestos.md`](decisiones-y-supuestos.md).

**Cómo funciona**

- Al llenar un espacio, a cada persona del público se le tira un 30 %; las que salen elegidas reciben uno de los seis modelos, repartidos «de a bolsa»
  (ninguno se repite hasta haber salido todos; en un auditorio con ~20 elegidas cada modelo aparece 3 o 4 veces). El azar cambia en cada visita. La regla
  está en `pickCameos()` (`js/scenes/personas.js`) y tiene pruebas de unidad (proporción del 30 %, independencia entre personas, reparto parejo).
- Los modelos originales **no se usan tal cual**: tienen 13 000–15 600 triángulos, un esqueleto de 28–52 huesos y piernas cortas. Con
  [`tools/preparar-personas/`](../tools/preparar-personas/) se sentó cada figura con su esqueleto (manos en el regazo, pies en el piso), se la escaló a 1,70 m de pie
  alargando solo la pantorrilla para que la cadera quede a la altura de la butaca (0,495 m), se «horneó» la pose (sin esqueleto) y se bajó la cantidad de triángulos.
- Cada archivo (`assets/personas/persona-0N.glb`, 250–450 KB) trae **dos versiones**: `cerca`, con textura de 1024 px (3 000 a 4 400 triángulos), y `lejos`,
  sin textura y con color por vértice (~800 triángulos). Las butacas a menos de 11 m del atril usan la primera; las demás, la segunda (a esa distancia no se distinguen).
- Se dibujan **instanciadas**: una malla por modelo y por nivel de detalle (a lo sumo 12 llamadas de dibujo más por espacio). Se cargan una sola vez al abrir
  la página, sin bloquear; si no cargan (o aún no cargaron), el público queda con figuras genéricas. Al salir del espacio se libera su copia en la tarjeta gráfica.
- Se mueven apenas (un balanceo de ~0,7° y una respiración de ~0,4 %) y se quedan quietas con «movimiento reducido». **No giran la cabeza** como las genéricas
  (son una malla fija) y **no reaccionan** a lo que se dice ni al puntaje.

**Costo** (navegador de pruebas, lo que se dibuja con un azar fijo; `tests/e2e/run.mjs`, prueba 15; **no es rendimiento en casco**):

| Espacio | Llamadas de dibujo | Triángulos | Sin los docentes en 3D |
|---|---|---|---|
| Sala de ensayo (3 personas) | 102 | 3,8 mil | 3,8 mil |
| Reunión con cliente (5 personas, 2 docentes en 3D en esta medición) | 126 | 12,2 mil | 6,4 mil |
| Auditorio (64 personas, 13 docentes en 3D en esta medición) | 148 | 62,0 mil | 42,5 mil |
| *Extremo, solo informativo: las 64 del auditorio son docentes en 3D* | 136 | 107,3 mil | — |

- El presupuesto de la prueba 15 (< 200 llamadas y < 80 000 triángulos por espacio) se cumple con el azar fijo. Con el 30 % por persona, el auditorio
  llega al límite solo si salen muchas más de las esperadas (unas 30 de 64 o más, cuando lo esperable son ~19: alrededor de 1 en mil). El caso extremo (todas) **supera** el presupuesto: no ocurre con el 30 %.
- Una versión de una sola malla de ~4 500 triángulos por persona dejaba el auditorio en **122 mil** triángulos; por eso se hicieron los dos niveles de detalle.
- Los tres modelos con más costuras de textura (01, 05 y 06) no bajan de ~3 300–4 400 triángulos en la versión cercana sin deformar la textura; la lejana sí llega a ~800.

**Límites**

- Una sola pose por persona (manos en el regazo): con las seis aparecen repetidas varias veces en un auditorio.
- Las seis figuras tienen un estilo (textura detallada, proporciones de personaje estilizado) distinto al del resto del público (colores planos): es lo que se pidió, y se nota el contraste.
- La pose se calculó automáticamente (esqueleto + geometría); la unión de la pierna con el muslo puede verse algo deformada de cerca.
- Costo en casco: **no medido**. Palancas si fuera pesado: bajar `CAMEO_PROBABILITY`, acercar `NEAR_DIST`, bajar `TRIS`/`TRIS_LEJOS` en la herramienta o usar solo la versión liviana.
