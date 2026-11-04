# Guion de exposición — 5 minutos, cuatro voces

Reparto sugerido (se puede cambiar; lo importante es que **hablen los cuatro**). Los tiempos suman 5:00.
Las diapositivas son las del informe (`informe/informe-pitch-lab.pdf`).

| Tiempo | Quién | Tema | Diapositivas |
|---|---|---|---|
| 0:00 – 0:55 | **Fiscina** | Problema, oportunidad, relación con Publitón y público | 1–4 (portada, problema, Publitón y público, idea) |
| 0:55 – 1:55 | **Fuentes** | Referentes, por qué VR y recorrido | 5–8 (referentes ×2, por qué VR, recorrido) |
| 1:55 – 3:35 | **Diaz** | Espacios, demo en vivo, mecánica, devolución e identidad/accesibilidad | 9–14 (los tres espacios, mecánica, devolución, identidad y accesibilidad) |
| 3:35 – 4:40 | **Tana** | Arquitectura, bitácora, problema resuelto, intervención manual, pruebas y límites | 15–19 (arquitectura, bitácora, problema, intervención, pruebas) |
| 4:40 – 5:00 | **Todos** (cierra Fiscina) | Enlace y próximos pasos | 20–21 |

---

## Fiscina — 0:55 · «Por qué»

> «Publitón propone ir **del brief al pitch**. Pero hay un momento que casi nadie puede ensayar: **presentar la idea
> en voz alta ante gente**. Nosotros armamos **Publitón Pitch Lab: “Tu idea merece un buen pitch”**.»
>
> «Es un simulador: elegís un espacio, recibís un brief ficticio, te preparás, presentás y recibís una devolución
> para volver a intentarlo. Complementa el evento porque permite **ensayar la defensa de la campaña antes del día
> del evento**.»
>
> «¿Para quién? Para participantes de Publitón que tienen que defender ideas creativas. **Ojo: esto es una hipótesis
> de diseño**; no hicimos entrevistas todavía, y está marcado como pendiente de validar.»

## Fuentes — 1:00 · «Cómo y por qué en VR»

> «Miramos referentes: **VirtualSpeech** y **Ovation** para ensayar ante audiencias virtuales, y **Speaker Coach de
> PowerPoint** para la devolución. De ellos tomamos dos ideas: el **espacio cambia la experiencia** y la
> **privacidad se explica antes de activar el micrófono**.»
>
> «¿Por qué VR? Porque lo que cambia es la **escala y la distancia**: una sala de ensayo con tres oyentes a dos
> metros no se siente igual que un auditorio con 64 personas repartidas en cuatro zonas. Eso no se logra con un
> formulario.»
>
> «El recorrido: inicio, tutorial salteable, elegir escenario en tres maquetas, brief, preparación, presentación,
> devolución, reintentar o cambiar de escenario.»

## Diaz — 1:40 · Demo en vivo («Mecánica central»)

Guion de la demo (dejar el navegador ya abierto en el enlace publicado; **plan B** abajo):

1. *«Estamos en el hall: tres maquetas.»* Elegir **Reunión con cliente** apuntando a la maqueta.
2. *«Recibimos el brief —marca ficticia— y vamos a preparar.»* Mostrar el panel de preparación y señalar el aviso de
   micrófono: *«antes de activarlo nos avisa que el navegador puede enviar el audio a un servicio externo.»*
3. **Comenzar presentación**: aceptar el micrófono, hablar ~20 s. Señalar el **reloj** de la pared y el atril.
4. **Pausar** y **Continuar** (el tiempo no corre en pausa). **Finalizar**.
5. *«La transcripción es revisable, indica su origen.»* **Ver devolución**.
6. *«Mostramos solo lo que se midió: duración, palabras, palabras por minuto, muletillas. El indicador técnico
   orientativo muestra su fórmula y solo aparece con datos suficientes; si no, dice “Sin datos suficientes”.»*
7. Mostrar la **autoevaluación** y **Reintentar**.

> «Todo se puede hacer **sin micrófono**: practicás con temporizador y autoevaluás. Y el audio **no se guarda**.»

## Tana — 1:05 · «Cómo está hecho y qué falta»

> «Arquitectura: **A-Frame** más JavaScript, sitio estático. La lógica —estados, sesión, métricas— no sabe nada de
> 3D y está probada: **77 pruebas de unidad** y un recorrido completo con navegador real.»
>
> «**Un problema real que encontramos**: al cambiar de espacio se acumulaban geometrías en la GPU, 12 por cada ida
> y vuelta. Lo detectó una prueba automática, lo rastreamos hasta los pedestales de las maquetas que no se
> liberaban y lo arreglamos; ahora el conteo se mantiene estable.»
>
> *[Cuando esté hecha] «Nuestra **intervención manual**: …»* — completar con `docs/intervencion-manual.md`.
> **Mientras esté pendiente, decir «pendiente» y no inventarla.**
>
> «Lo que **no** probamos: **un casco físico**. Probamos el modo inmersivo con un **emulador**, y la voz con
> **simulaciones**; por eso no afirmamos rendimiento ni comodidad en VR.»

## Cierre (todos) — 0:20

> **Fiscina**: «Próximos pasos: probar en un casco real, validar el público con entrevistas y, más adelante,
> evaluación asistida por IA —que hoy **no existe**—.»
> **Todos**: «Pueden probarlo con este enlace.» *(mostrar el QR cuando esté publicado y verificado)*

---

## Plan B de la demo

- **Sin micrófono o sin permiso**: elegir «Solo temporizador» y completar la devolución con autoevaluación; es un
  camino completo y es parte del diseño, no un fallo.
- **Sin conexión o enlace caído**: correr local (`node tools/serve.mjs`) y abrir `http://localhost:8080/pitch-lab/`.
- **Sin 3D / navegador sin WebGL**: abrir el panel de texto (tecla **T**); el recorrido se completa igual.
- **Texto de demostración**: si hace falta mostrar una devolución sin hablar, usar «Cargar texto de DEMOSTRACIÓN»
  y **decir en voz alta que no es voz reconocida**.

## Qué no decir

- «Está probado en VR/en casco» (no lo está).
- «Evalúa la calidad del discurso / la confianza / la persuasión» (no lo hace).
- «Usa IA» (no la usa).
- «Las personas del público reaccionan a lo que decís» (no reaccionan).
- «Hicimos entrevistas» (no se hicieron).
