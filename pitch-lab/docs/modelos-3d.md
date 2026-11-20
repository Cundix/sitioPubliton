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
