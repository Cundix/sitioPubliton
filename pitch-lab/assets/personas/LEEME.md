# Personas del equipo (modelos 3D del público)

Seis modelos 3D de personas sentadas (`persona-01.glb` … `persona-06.glb`) que aparecen en el público de los tres espacios:
**cada persona del público tiene un 30 % de probabilidad de ser una de estas seis** (el resto son las figuras genéricas de siempre).
Cómo se eligen y se dibujan: [`../../js/scenes/personas.js`](../../js/scenes/personas.js) y [`../../js/scenes/audience.js`](../../js/scenes/audience.js).

## De dónde salen

- Los modelos originales los **aportó la persona usuaria** de la sesión (un `.zip` con una carpeta por persona: modelo `.fbx` con esqueleto
  tipo Mixamo y su textura `.png` de 2048 × 2048), el 2026-11-20.
- Los nombres internos de las mallas del original (`Meshy_AI_…`) indican que se **generaron con Meshy AI**. La herramienta no pudo comprobar
  con qué cuenta o plan, ni de qué imágenes o descripciones.
- Estos archivos **no son los originales**: se convirtieron con [`../../tools/preparar-personas/`](../../tools/preparar-personas/) (se sentó
  cada figura con su esqueleto, se bajó la cantidad de triángulos y se redujo la textura). El original no está en el repositorio.
- Los nombres de las carpetas del zip **no se copiaron** al repositorio ni al sitio: los archivos tienen nombres neutros.

## Qué hay que confirmar antes de mostrarlos en público (pendiente del equipo)

1. **Consentimiento**: si los modelos están basados en personas reales, que cada una esté de acuerdo en aparecer en un sitio público.
   La herramienta no puede saberlo.
2. **Licencia / atribución**: Meshy da condiciones distintas según el plan con que se generó cada modelo (según su documentación, el gratuito
   puede exigir atribución). Verificarlo y, si corresponde, agregar la atribución en el sitio.

## Qué son (y qué no) dentro de la experiencia

Son figuras **decorativas**, igual que el resto del público: se mueven apenas (un balanceo y una respiración ambientales) y **no reaccionan
a lo que se dice ni al puntaje**. No representan asistentes reales ni opiniones de nadie.

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
