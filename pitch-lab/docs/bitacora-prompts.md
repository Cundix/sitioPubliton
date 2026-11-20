# Bitácora de prompts

Registro de los prompts **realmente recibidos** durante el trabajo. No se agregaron conversaciones que no
ocurrieron. Si el equipo usa una herramienta de IA más adelante (por ejemplo para la intervención manual), debe
sumar acá esos prompts con su fecha y su resultado.

## Alcance de este registro

- Corresponde a **una sola sesión de trabajo** de Claude Code (aplicación de escritorio, modelo Sonnet 5.5), que
  empezó el **2026-11-04** de forma autónoma y continuó el **2026-11-13** con nuevos pedidos de la persona usuaria.
- Los prompts de los TPs anteriores (1 a 3) **no están en esta carpeta ni en el repositorio**; si el equipo los
  guardó, conviene adjuntarlos al informe.
- El 2026-11-04 **no hubo preguntas ni respuestas intermedias**: un solo encargo y trabajo sin interacción (la
  persona estaba de viaje, según el propio encargo). Los pedidos del 2026-11-13 sí fueron una conversación.

## Entradas

| # | Fecha | Autoría | Prompt | Resultado |
|---|---|---|---|---|
| 1 | 2026-11-04 | Persona usuaria de la sesión | **Encargo inicial** completo: [`prompts/01-encargo-inicial.md`](prompts/01-encargo-inicial.md) | Se inspeccionó el repositorio (sin archivos de instrucciones; solo `README.md`), se verificó que Pages publica la raíz de `main` y se construyó, probó y documentó la experiencia en `pitch-lab/` |
| 2 | 2026-11-13 | Persona usuaria de la sesión | «armá el informe ahí y completá todo lo que haya que completar, usá la skill/plugin de Figma» (con el enlace del archivo de Figma del equipo) | El plugin oficial de Figma no estaba habilitado en la cuenta; se preparó `informe/figma/slides-spec.json` y se dejó **pendiente** el armado en Figma |
| 3 | 2026-11-13 | Persona usuaria de la sesión | «me podés mostrar cómo está el juego sin los cositos VR» · «dónde está el link? Tipo quiero jugarlo» | Se mostró el recorrido en escritorio; se dio el enlace publicado |
| 4 | 2026-11-13 | Persona usuaria de la sesión | **Análisis real del audio con IA y cámara**, con 50 jugadas por día y sin tope de 5 minutos: [`prompts/02-analisis-con-ia.md`](prompts/02-analisis-con-ia.md) (la clave pegada en el chat se omite) | Función opcional con Gemini (`gemini-3.5-flash-lite`), gestos con MediaPipe, pruebas y documentación: [`analisis-con-ia.md`](analisis-con-ia.md) |
| 5 | 2026-11-19 | Persona usuaria de la sesión | «yes push, also make the 3D models better» · «dame el link para jugarlo» · «también quiero que añadas más temáticas de problemas, no solo la de Yerbita Sol» | Publicación de la versión con IA (verificada), mejora de los modelos 3D ([`modelos-3d.md`](modelos-3d.md)) y 8 briefs nuevos (11 en total) |
| 6 | 2026-11-19 | Persona usuaria de la sesión | «revisá todo el proyecto con esta guía. Fixeá todo lo que tengas que fixear» (con el PDF *UX for XR*, de Cornel Hillmann, que aportó la persona; no se incluye en el repositorio) | Auditoría con la guía y correcciones: legibilidad, giro con el joystick, vibración, altura, «mantené presionado», avisos dentro del casco, reloj en el atril. Ver [`auditoria-ux-xr.md`](auditoria-ux-xr.md) |
| 7 | 2026-11-20 | Persona usuaria de la sesión | «quiero que el público sean personas random de acá. Descomprimí el zip y agarrá todas las personas de acá» (un `.zip` con seis modelos 3D de personas) · «tipo no que sean todo el público, que cada persona tenga un 30 % de chance de ser uno de esos» | Se convirtieron los seis modelos (sentados, livianos, con dos niveles de detalle), se integraron al público con un 30 % por persona, con pruebas y documentación. Ver [`../assets/personas/LEEME.md`](../assets/personas/LEEME.md) |
| 8 | *(pendiente)* | *(equipo)* | *(agregar los prompts que el equipo use para la intervención manual u otras tareas)* | — |

## Resumen del prompt 1

- **Pedido**: experiencia WebXR «Publitón Pitch Lab» (simulador de presentación de ideas publicitarias), en
  `/pitch-lab/`, sin romper el sitio existente; tres escenarios, briefs ficticios, voz opcional con alternativas,
  devolución transparente, accesibilidad, pruebas, documentación, informe 16:9, guía de intervención manual y
  publicación.
- **Restricciones clave**: no inventar evidencia, investigación ni usuarios; separar lo probado de lo pendiente;
  no afirmar rendimiento en casco sin medirlo; no completar por el equipo la intervención manual; no afirmar
  publicación sin verificarla.

## Cómo usar la IA con honestidad en el informe

- Indicar qué partes generó la herramienta (código, documentación, informe) y qué hizo el equipo.
- La **intervención manual** debe ser realizada por el equipo: ver [`intervencion-manual.md`](intervencion-manual.md).
- Las capturas de las pruebas con voz «reconocida» salen de un **simulador** de pruebas, no de voz real: así debe
  decirse si se las muestra.
