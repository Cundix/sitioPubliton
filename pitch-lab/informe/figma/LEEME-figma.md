# Material para llevar el informe a Figma

> **Estado: el informe NO fue publicado en Figma.** No hubo acceso a Figma desde este entorno. Lo que hay acá es el
> material ordenado para que el equipo arme la versión interactiva. El PDF 16:9 ya está generado
> (`../informe-pitch-lab.pdf`), pero **la versión interactiva de Figma la tiene que armar el equipo**.

## Qué hay en esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `../informe-pitch-lab.pdf` | Informe completo, 21 páginas, horizontal 16:9 (1920 × 1080) |
| `../slides/slide-01.png … slide-21.png` | Cada diapositiva como imagen: **referencia visual** para reproducir el diseño en Figma |
| `contenido-diapositivas.md` | Texto de cada diapositiva, listo para copiar |
| `tokens.json` | Colores, tipografías y medidas del diseño |
| `assets/` | Capturas reales usadas en el informe (PNG) |
| `../informe-pitch-lab.html` | Fuente del informe (HTML/CSS); sirve para ajustar y volver a exportar con `node tools/build-informe.mjs` |

## Cómo armarlo en Figma (propuesta)

1. **Crear el archivo** y un marco de **1920 × 1080** por diapositiva (21 marcos). Nombrarlos con el número y el título (ver `contenido-diapositivas.md`).
2. **Estilos**: crear estilos de color y de texto con `tokens.json` (Anton para títulos, Barlow para el resto). Si Figma no tiene las
   fuentes, instalarlas desde `../../../assets/Anton-Regular.ttf` y `Barlow-*.ttf` (licencia SIL OFL).
3. **Imágenes**: arrastrar los PNG de `assets/` o de `../../capturas/` en cada marco. Dejar visible el pie de foto que dice
   «captura real» o «simulador de pruebas».
4. **Texto**: copiar desde `contenido-diapositivas.md`. Mantener las marcas de **«PENDIENTE»** donde figuren.
5. **Interacción (prototipo)**:
   - Conectar los marcos en orden con «Al hacer clic → navegar a el siguiente marco» (o con las flechas del teclado).
   - Agregar un vínculo de la diapositiva 20 al enlace publicado (cuando esté verificado).
   - Los enlaces de las diapositivas de referentes deben abrir las fuentes citadas en `../../docs/referentes.md`.
6. **Exportar a PDF** desde Figma para la entrega y comparar con `informe-pitch-lab.pdf`.

## Lo que el equipo debe completar (no inventar)

- **Imágenes de los referentes** (diapositivas 5 y 6): una captura por referente con cita y enlace (ver `../../docs/referentes.md`).
- **Intervención manual** (diapositiva 18): el antes/después real, cuando exista.
- **Bitácora de prompts** (diapositiva 16): prompts de los TPs anteriores y los que use el equipo.
- **Enlace y QR** (diapositiva 20): ya se agregan automáticamente solo si la publicación fue verificada; revisar que coincida.
- **Entrevistas o pruebas de uso**, si el equipo las hace: hoy el público es una hipótesis de diseño.

## Notas de diseño

- Marco: 1920 × 1080 px · márgenes 110 px laterales, 84 px arriba y 124 px abajo (pie con «PUBLITÓN® · PITCH LAB · TP4» y número).
- Portada sobre azul `#0047FF`; resto sobre `#181D16`; tarjetas `#20261C` con borde `#596151`; énfasis `#FFC94A`; acento `#FF006E`.
- Los avisos de pendiente usan borde rosa **punteado** (no depende solo del color).
