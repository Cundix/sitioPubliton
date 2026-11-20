# Auditoría de UX para XR

_Revisión del proyecto con la guía **UX for XR** (Cornel Hillmann, 2.ª edición, Apress, 2025). Fechas: 2026-11-19 y 2026-11-20._

## Qué es y qué no es

- Es una **revisión de experto** (evaluación heurística) más **mediciones automáticas** hechas con la geometría real de
  la escena. Todo lo que dice «medido» salió de una prueba que se puede repetir (ver el final de este documento).
- **No es una prueba con personas ni en un casco físico.** No hay datos de uso, de comodidad ni de mareo. Lo que
  sigue sin comprobarse está en la sección «Lo que no se resolvió».
- De la guía se leyeron los capítulos que aplican a este producto: usabilidad y heurísticas de VR (2.3), convenciones
  de VR (3.3.4), interacción con los sentidos (4.4), diseño consciente (4.5), WebXR (7.3) y auditorías de UX (8.6). **No se
  leyó el libro completo.** Las referencias son paráfrasis, no citas.

## Resumen: qué se encontró y qué se hizo

| # | Criterio de la guía | Estado antes | Qué se hizo | Cómo se comprueba |
|---|---|---|---|---|
| 1 | **Evitar el texto chico** (3.3.4, «text readability») | El texto de los paneles bajaba hasta **0,5°** de altura de mayúsculas; el recordatorio del brief y las etiquetas del reloj de la pared, a **0,2–0,3°** | Mínimo de letra por superficie, contenido recortado en vez de letra achicada, reloj también en el atril, recordatorio con solo la marca | `tests/e2e/legibilidad.mjs` |
| 2 | **Giro por tramos («snap rotation»)** (2.3.6) | No existía: en VR no había ninguna forma de girar salvo con el cuerpo | Joystick de costado gira 15/30/45/90° (o se apaga); en el menú 3D y en el panel de texto | X8 en `tests/e2e/xr.mjs` |
| 3 | **Tacto como señal** (4.4, 3.3.4 «selection ray») | Ninguna vibración de los controles | Vibración corta al apuntar, al presionar, al teletransportarse y cuando algo no está disponible; se puede apagar | X9 |
| 4 | **Ajustes de entrada: altura, una mano** (2.3.6) | Solo «modo sentado» fijo (45 cm) | Corrección de altura de ±30 cm de a 5 cm; comprobado que alcanza con un solo control (cualquiera de los dos) | X7 y X10 |
| 5 | **Botones de mantener presionado para cambios grandes** (3.3.4, «long-press buttons») | «Finalizar» terminaba la presentación con un toque, pegado a «Pausar» | «Finalizar» pide mantener presionado 0,7 s con avance visible; la tecla F y el panel de texto siguen siendo inmediatos | X11, 4b y `tests/unit/settings-hold.test.js` |
| 6 | **Visibilidad del estado** (heurística 1) | Los avisos («mantené…», «la clave no se escribe en VR», errores) salían solo en el panel de texto, **invisible dentro del casco** | Los avisos cortos también se dibujan en el atril (6 s) | X11, 4b |
| 7 | **Reconocer en vez de recordar** (heurística 6) | En el auditorio el brief quedaba a la espalda y en el resto era ilegible desde el atril | Recordatorio de la marca legible en los tres espacios; el brief se puede releer en la pausa | legibilidad |
| 8 | **UI diegética primero** (3.3.4) | Reloj solo en la pared (a 5–10 m) | Reloj chico en el atril, a la vista de quien presenta, con etiqueta y aviso en palabras | legibilidad (el atril muestra el tiempo) |
| 9 | **Comodidad: zona de visión** (3.3.4) | Se cumplía (no se medía) | Se midió y se documenta: el panel ocupa casi toda la zona; **no se lo agranda más** | cuenta en la sección 2 |
| 10 | **Onboarding** (3.3.4 y 2.5.3) | Ya cumplía: tutorial corto, con progreso y salteable | Se actualizó el texto (giro, mantener presionado) | pruebas 3 y 13 |

Lo que **ya cumplía** y se conserva: teletransporte con fundido breve (sin deslizamientos que mareen), modo sentado, movimiento
reducido, ambos controles apuntan (sirve para zurdos y para una sola mano), panel de texto espejo para teclado y lectores
de pantalla, privacidad explicada antes de usar micrófono, cámara o IA, y ningún dato de la persona se guarda.

## 1. Legibilidad del texto dentro del casco

**Por qué importa.** Dentro del casco no existe el panel de texto: lo único que se puede leer es lo que está dibujado en
el espacio 3D. La guía advierte que el texto chico es un problema histórico de VR y recomienda evitarlo y mantenerlo de
frente y con buen contraste.

**Cómo se mide.** `tests/e2e/legibilidad.mjs` recorre 39 pantallas (vestíbulo, tutorial, ajustes, y para cada uno de los tres
espacios: brief, preparación, IA y cámara, presentando, pausa, confirmar cancelación y las páginas de la devolución, con y sin
IA) y registra **cada texto** que se dibuja en el atril, el panel, el reloj, el brief y los botones. Para cada uno calcula,
con la posición real de la superficie y de la cabeza en el punto de inicio, cuántos grados ocupa la **altura de las
mayúsculas** (aproximada como 0,7 del tamaño de la letra, la proporción de Barlow), corregida por el ángulo de visión.

**Umbrales (criterio del proyecto con respaldo bibliográfico).** Mínimo **0,8°** y cómodo **1,2°**. Salen de la
bibliografía sobre lectura en VR resumida por Kilpeläinen y Häkkinen (2023, *Frontiers in Virtual Reality*,
doi 10.3389/frvir.2023.1243387): Solum (2019) propone 14–16 dmm (0,8–0,92°) como tamaño mínimo y 21–23 dmm (1,2–1,3°)
para lectura cómoda; otras fuentes piden más (1,375° y 1,8°). **No hay un estándar único**: son valores de referencia, y
la prueba falla si algún texto baja de 0,8°.

**Resultado (peor caso por superficie, altura de mayúsculas):**

| Superficie | Antes (sala) | Ahora (los tres espacios) |
|---|---|---|
| Recordatorio del brief (pared del público) | 0,18° | 0,82° |
| Reloj de la pared | 0,34° (etiquetas) | 2,2° (solo los números; ya no hay etiquetas) |
| Panel | 0,51° | 0,81° |
| Botones del panel | 0,56° | 1,0° |
| Pantalla del brief (pared de atrás) | 0,66° | 0,83° |
| Atril | 0,84° | 0,89° |
| Botones del atril | 0,88° | 0,89° |

«Antes» es la medición de la versión publicada el 2026-11-19 solo en la sala; «ahora» incluye sala, reunión y auditorio (y la revisión de la transcripción con un texto largo).
**Márgenes finos:** el peor caso del panel (0,81°) y del recordatorio (0,82°) está a un paso del mínimo, y 433 combinaciones de pantalla, superficie y tamaño
caen entre 0,8° y 1,2°: cumplen el mínimo pero **no llegan al valor cómodo**. La medición es de la versión de la tabla; cualquier cambio de tamaño o de distancia puede
hacer fallar la prueba, y eso es lo que se busca.

**Qué se cambió** (`js/ui/panel-draw.js`, `js/ui/draw-button.js`):

- Letra mínima de **46 px** en el panel (con el panel a escala 1,3) y **36 px** en el atril; los botones tampoco bajan de ahí.
- Si el contenido no entra, **se recorta el texto, no se achica la letra**: los bloques secundarios se marcan
  `optional3D`, se omiten y aparece «Más detalle: panel de texto (tecla T)». Cuando sobra lugar, el cuerpo del texto
  **crece** hasta 1,3 veces.
- Versiones cortas para el casco (`text3D`, `short`) de los avisos de privacidad, los consejos y la devolución; **los avisos
  conservan lo esencial** (qué se envía, que no se guarda nada, que la IA puede equivocarse). El panel de texto muestra
  siempre las versiones completas.
- La devolución muestra en 3D las cuatro medidas que alimentan el indicador en tarjetas grandes (las que no se pudieron
  calcular figuran como «Sin datos»); el detalle completo, con su origen, está en el panel de texto.
- Reloj de la pared: solo números (se miran a 5–10 m). El estado en palabras («poco tiempo», «cuenta final», «en pausa») está en
  el **reloj del atril**.
- Recordatorio del brief: la marca y la etiqueta «MARCA FICTICIA», grandes. El brief completo sigue en el panel y en la pared de atrás.

**Límites de esta medición.** Es una pantalla de computadora con la geometría del casco; la resolución real de un casco
(píxeles por grado), la óptica y el brillo cambian la legibilidad. El panel es plano: su borde queda ~30 % más lejos que el
centro, y por eso el peor caso de la tabla está en las esquinas. La guía recomienda **curvar** las pantallas grandes; no se
hizo (ver «Lo que no se resolvió»).

## 2. Comodidad y zona de visión

La guía describe una zona cómoda de unos 70° en horizontal y 40° en vertical (la frase es ambigua; aquí se la toma como
ángulos totales). Medido desde el punto de inicio, el panel (2,6 m de ancho a unos 1,9 m, centrado a 2,05 m de altura) ocupa unos
**69° × 40°**: está **al límite**. Por eso no se lo agranda más: lo que se mejora es el contenido. El atril queda unos 22° por
debajo de la mirada (inclinado hacia la persona) y los relojes entre +5° y +22°.

## 3. Opciones de VR («el estándar de Alyx»)

La guía toma a *Half-Life: Alyx* como referencia: ofrecer opciones de locomoción, de giro y de configuración inicial.

| Opción | Estado | Nota |
|---|---|---|
| Teletransporte con fundido | Ya estaba | Se omite con «movimiento reducido» |
| Locomoción continua | **No se ofrece, a propósito** | La experiencia es de pie frente a un atril; hay marcas de teletransporte y se camina de verdad con espacio |
| **Giro por tramos** | **Nuevo** | 15 / 30 / 45 / 90° o desactivado. Gira sobre la cabeza (no desplaza). Un empujón = un giro. Funciona con cualquiera de los dos joysticks. **Por defecto: 30°** |
| Modo sentado | Ya estaba | +45 cm |
| **Altura de la vista** | **Nuevo** | ±30 cm de a 5 cm, solo en VR |
| Izquierda / derecha / una mano | Verificado | Los dos controles apuntan y presionan; todo se alcanza con uno solo (X10) |
| **Vibración** | **Nuevo** | 5 intensidades según el evento; se apaga en Ajustes |

Decisión a revisar con personas: la guía dice que el giro por tramos debe **estar disponible**, aunque empiece apagado.
Acá empieza **encendido a 30°** porque quien presenta sentado no puede girar el cuerpo hacia las alas del auditorio ni hacia el
brief de la pared de atrás; el costo es un giro involuntario si se empuja el joystick sin querer. Se apaga con un botón.

**Sin joystick no hay giro**: con manos (sin controles) quedan el giro del cuerpo, las marcas del piso y «Recentrar».

## 4. Prevención de errores: «mantené presionado»

«Finalizar» es un cambio grande que no se deshace (la presentación termina y no se puede continuar). Estaba al lado de
«Pausar» y se activaba con un toque. Ahora hay que **mantenerlo 0,7 s** (`js/ui/hold.js`): se ve el avance en el botón; si se
suelta antes, no pasa nada y el atril explica cómo hacerlo (aviso de 6 s, sonido y vibración de «no disponible»). «Cancelar»
ya tenía confirmación aparte. La tecla **F**, la tecla **Enter** y el panel de texto no piden mantener: ahí no hay riesgo de
gatillo accidental.

El tiempo (0,7 s) es una **estimación**: hay que ajustarlo con personas usando controles reales (ver la sección 7).

## 5. Heurísticas de Nielsen aplicadas a VR (2.3.10)

| Heurística | Evaluación |
|---|---|
| 1. Visibilidad del estado | **Corregido**: los avisos ya se ven dentro del casco; el tiempo está en el atril. Pendiente: el aviso de permisos del navegador (micrófono, cámara) no se pudo verificar dentro de un casco |
| 2. Coincidencia con el mundo real | Bien: atril, reloj, pantalla del brief, público sentado |
| 3. Control y libertad | Bien: pausar, cancelar con confirmación, recentrar, salir de VR siempre a la vista |
| 4. Consistencia | Bien: mismas acciones en 3D, teclado y panel de texto; gatillo para activar |
| 5. Prevención de errores | **Mejorado**: «Finalizar» pide mantener; «Cancelar» confirma |
| 6. Reconocer antes que recordar | **Mejorado**: marca legible en los tres espacios; el brief se relee en la pausa |
| 7. Flexibilidad y eficiencia | Bien: atajos de teclado, una mano, giro y altura a medida |
| 8. Diseño minimalista | **Corregido**: el contenido del casco se recortó para poder usar letra legible |
| 9. Ayudar a recuperarse de errores | Bien: pantallas de problema de voz con salida; mensajes concretos |
| 10. Ayuda y documentación | Bien: tutorial salteable y «Ver controles»; actualizados |

Los objetivos de usabilidad que cita la guía (aprendizaje, eficiencia, memoria, prevención de errores y satisfacción) **no se
midieron con personas**.

## 6. Diseño consciente (4.5)

Se mantienen: transparencia de privacidad antes de usar micrófono, cámara o IA; ningún dato se guarda ni se envía a un servidor
propio; las preferencias se guardan solo en el navegador; accesibilidad (movimiento reducido, modo sentado, panel de texto);
«Pausa» y «Salir de VR» siempre a mano; y **ninguna métrica de emoción, ansiedad ni confianza**. No hay límites de uso ni
recordatorios de descanso porque las sesiones duran de 1 a 2 minutos más la preparación.

## 7. Lo que no se resolvió

- **Casco físico**: nada de esto se probó en uno. La fuerza de la vibración (0,12–0,8 y 18–120 ms), el tiempo de mantener
  presionado (0,7 s), el ángulo de giro por defecto (30°) y la altura del panel son **estimaciones** que hay que ajustar con
  personas. La legibilidad se midió en pantalla.
- **Panel curvo**: la guía recomienda curvar las pantallas grandes para mantener una distancia constante. El panel es plano y
  sus esquinas quedan más lejos (es lo que limita el tamaño del texto en los bordes).
- **Permisos del navegador dentro del casco**: no se pudo verificar si el aviso del micrófono o la cámara aparece estando en VR.
  Si no aparece, la sesión queda en «esperando permisos» (hay botón para cancelar). Conviene dar los permisos **antes de entrar**.
- **Manos sin controles**: no tienen joystick (sin giro por tramos).
- **Audio espacial**: los avisos sonoros no tienen posición en el espacio. La guía lo señala como una ayuda de orientación.
- **Locomoción libre sobre el escenario**: solo hay marcas de teletransporte («Atril», y «Ver desde el público» en el auditorio).
- **Teléfonos y tabletas**: la experiencia en pantalla táctil no se probó.
- **El texto 3D es un resumen**: en la devolución con IA el detalle completo solo está en el panel de texto (fuera de VR).

## 8. Cómo probar esto con personas (protocolo, sin resultados todavía)

La guía propone medir: **abandono** (sesiones que se cortan antes de terminar), **éxito de tareas**, **tiempo por tarea**,
**problemas y fricciones** (por ejemplo, cuántos pasos de menú hacen falta para cambiar una opción) y **satisfacción**; con
entrevistas antes y después y tiempo extra para que la persona se acostumbre a los controles. Propuesta para este proyecto:

| Tarea | Éxito si… | Qué anotar |
|---|---|---|
| Empezar una práctica en el espacio elegido | Llega a «Presentando» sin ayuda | Tiempo, dudas, pasos |
| Cambiar el giro, la vibración o la altura | Encuentra el menú y lo cambia | Pasos de menú, errores |
| Terminar la presentación a propósito | Mantiene «Finalizar» a la primera | Intentos, si el aviso se entiende |
| Releer el brief durante la práctica | Lo encuentra (pausa o recordatorio) | Si lo busca donde está |
| Leer la devolución | Dice qué se midió y qué no | Qué texto no pudo leer |

Preguntas de entrada y salida: experiencia previa con VR, comodidad (escala simple), qué le costó leer, si giró sin querer, si
la vibración le molestó. Recomendaciones de la guía: probar el enlace publicado con el **emulador** (Immersive Web Emulator, de la misma
familia que el IWER que se usa en las pruebas) para revisar flujos antes de pedir un casco, y **reservar casco y tiempo** para ver
distancias, alturas y legibilidad reales. Con personas que no conocen VR, esperar más dudas con los controles que con el producto.

## 9. Cómo repetir las mediciones

```powershell
cd sitioPubliton/pitch-lab
node tools/serve.mjs 8090                                     # en otra terminal
$env:PITCHLAB_URL = 'http://localhost:8090/pitch-lab/'
node tests/e2e/legibilidad.mjs                                # mide cada texto 3D; falla por debajo de 0,8°
node tests/e2e/xr.mjs                                         # opciones de VR con el emulador (13 pruebas)
```

`LEGIBILIDAD_SCENARIOS=sala` limita la auditoría a un espacio y `LEGIBILIDAD_INFO=1` solo informa (no falla).
El resultado queda en `tests/e2e/ultimo-resultado-legibilidad.json`.
