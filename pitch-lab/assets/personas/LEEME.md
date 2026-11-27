# Docentes en 3D (modelos 3D del público)

Seis modelos 3D de **docentes del colegio del equipo**, sentados (`persona-01.glb` … `persona-06.glb`), que aparecen en el público de los tres espacios:
**cada persona del público tiene un 30 % de probabilidad de ser uno de estos seis** (el resto son las figuras genéricas de siempre).
Cómo se eligen y se dibujan: [`../../js/scenes/personas.js`](../../js/scenes/personas.js) y [`../../js/scenes/audience.js`](../../js/scenes/audience.js).

## De dónde salen

- Los modelos originales **los hizo la persona usuaria de la sesión para otro proyecto** (no son del equipo de Publitón ni representan a sus integrantes): un
  `.zip` con una carpeta por persona, con un modelo `.fbx` con esqueleto tipo Mixamo y su textura `.png` de 2048 × 2048. Los trajo el 2026-11-20.
- Los nombres internos de las mallas del original (`Meshy_AI_…`) indican que se **generaron con Meshy AI**. La herramienta no pudo comprobar
  con qué cuenta o plan, ni de qué imágenes o descripciones.
- Estos archivos **no son los originales**: se convirtieron con [`../../tools/preparar-personas/`](../../tools/preparar-personas/) (se sentó
  cada figura con su esqueleto, se bajó la cantidad de triángulos y se redujo la textura). El original no está en el repositorio.
- Los nombres de las carpetas del zip **no se copiaron** al repositorio ni al sitio: los archivos tienen nombres neutros.

## Permiso y licencia

1. **Permiso de las personas representadas**: son docentes reales. El 2026-11-27 la persona usuaria informó que **los docentes ya le dieron permiso**. La
   herramienta no puede verificarlo y **no hay constancia escrita en el repositorio**: conviene guardar un mensaje o una nota que lo deje asentado.
   Si alguno cambia de opinión, se saca su modelo borrando su archivo (o con `CAMEO_PROBABILITY = 0` en `js/scenes/personas.js` para sacarlos a todos).
2. **Licencia / atribución** (pendiente): Meshy da condiciones distintas según el plan con que se generó cada modelo (según su documentación, el gratuito
   puede exigir atribución). Verificarlo y, si corresponde, agregar la atribución en el sitio.

## Qué son (y qué no) dentro de la experiencia

Son figuras **decorativas**, igual que el resto del público: se mueven apenas (un balanceo y una respiración ambientales) y **no reaccionan
a lo que se dice ni al puntaje**. No representan opiniones de las personas reales a las que se parecen.

## Datos técnicos

| Persona | Triángulos cerca / lejos | Archivo |
|---|---|---|
| 01 | 4 403 / 794 | 446 KB |
| 02 | 2 999 / 789 | 252 KB |
| 03 | 3 000 / 794 | 341 KB |
| 04 | 3 000 / 798 | 254 KB |
| 05 | 3 926 / 797 | 446 KB |
| 06 | 3 321 / 787 | 291 KB |

- Cada archivo trae **dos mallas** que comparten el mismo archivo: `cerca` (con la textura de 1024 px, para las butacas a menos de 11 m del
  atril) y `lejos` (sin textura, con color por vértice, para las más lejanas).
- Altura equivalente de pie: 1,70 m (en el público se varía ±3 %). Sentadas, con la cadera a 0,495 m (la altura de las butacas) y los pies
  en el piso; para eso se alargó un poco la pantorrilla (los modelos originales tienen piernas cortas, de personaje estilizado).
- Total: ≈ 2,0 MB. Se cargan una sola vez al abrir la página, sin bloquear nada; si no cargan, el público queda con figuras genéricas.
