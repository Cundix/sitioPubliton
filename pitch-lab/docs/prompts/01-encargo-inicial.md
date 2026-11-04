# Prompt 1 — Encargo inicial (texto completo, tal como se recibió)

- **Fecha de la sesión**: 2026-11-04
- **Herramienta**: Claude Code (aplicación de escritorio), modelo Sonnet 5.5
- **Enviado por**: la persona usuaria de la sesión (cuenta del equipo)
- **Carpeta de trabajo al inicio**: `Design5to` (material del curso, sin el repositorio)

El texto que sigue se reproduce **sin cambios**. Es el único prompt de esta sesión.

~~~text
Vas a trabajar de forma autónoma en el proyecto “Publitón Pitch Lab”. Voy a estar de viaje y no podré responder preguntas ni aprobar decisiones intermedias. Necesito que implementes, pruebes, documentes y dejes lista la experiencia completa, tomando decisiones razonables dentro del alcance indicado.
No te detengas después de presentar un plan. Ejecutá el trabajo hasta completar los criterios de aceptación o encontrar un impedimento externo real. La cantidad de tokens disponibles no es un objetivo: priorizá un producto sólido, comprensible y terminado.
CONTEXTO Y REPOSITORIO
Proyecto: Publitón.
Integrantes: Fiscina, Fuentes, Diaz y Tana.
Sitio actual: https://cundix.github.io/sitioPubliton/
Repositorio: https://github.com/Cundix/sitioPubliton
El sitio existente debe seguir funcionando. Implementá la experiencia en una carpeta independiente, preferentemente /pitch-lab/, accesible como:
https://cundix.github.io/sitioPubliton/pitch-lab/
Antes de empezar:

* Leé los archivos de instrucciones del repositorio.
* Inspeccioná su estructura y forma de publicación.
* Revisá el sitio y reutilizá sus recursos gráficos, tipografías y estilos cuando corresponda.
* No sobrescribas cambios ajenos ni borres archivos que no formen parte de tu trabajo.
* Si el repositorio no está disponible, creá el proyecto completo en una carpeta independiente y dejalo preparado para integrarlo.
* No dependas de poder entrar a Figma para avanzar.

CONSIGNA DEL TRABAJO
TP4: experiencia inmersiva VR del evento, desarrollada con WebXR.
Debe:

* Complementar el evento trabajado en los TPs anteriores.
* Mantener su marca e identidad.
* Situar a la persona como protagonista de una interacción espacial.
* Aprovechar el espacio y la interacción tridimensional.
* Funcionar en navegador de computadora con mouse y teclado.
* Estar preparada para ejecutarse en modo inmersivo con casco VR.
* Tener un entorno 3D navegable, piso, límites y ambientación.
* Incluir al menos tres objetos 3D dispuestos con intención.
* Tener al menos una mecánica central funcional.
* Publicarse mediante un enlace accesible.

La entrega también requiere:

* Investigación de referentes con imágenes, enlaces y análisis.
* Definición y justificación de la idea.
* Diseño del entorno, recorrido e interacción.
* Bitácora de prompts.
* Un problema efectivamente encontrado y resuelto.
* Una intervención manual del equipo sobre el código, explicada con antes/después.
* Informe visual horizontal 16:9, en versión interactiva de Figma y PDF.
* Exposición de cinco minutos con participación de los cuatro integrantes.

No inventes evidencia para cubrir requisitos que todavía no se hayan cumplido.
CONCEPTO
Nombre: Publitón Pitch Lab.
Frase principal: “Tu idea merece un buen pitch”.
Es un simulador de presentación de ideas publicitarias. La persona elige un entorno, recibe un brief ficticio, prepara una propuesta y la presenta oralmente ante una audiencia virtual. Al terminar, obtiene una devolución comprensible y puede volver a intentarlo.
Complementa Publitón porque permite ensayar la defensa de una campaña antes de presentarla.
La razón para usar VR es experimentar:

* Escala y profundidad del espacio.
* Presencia de una audiencia distribuida alrededor.
* Distancia respecto del público.
* Diferencias entre una reunión pequeña y un auditorio.
* Objetos y controles situados en el entorno.

La experiencia central debe suceder dentro del espacio 3D. No resuelvas todo como un formulario 2D sobre un fondo tridimensional.
PÚBLICO
Participantes de Publitón que necesitan presentar y defender ideas creativas.
Si encontrás User Personas documentados en el repositorio, conectá la propuesta con sus características reales. Si no, documentá esta definición como hipótesis de diseño y dejá pendiente su validación; no inventes entrevistas ni investigación.
ALCANCE Y PRIORIDADES
Prioridad 1: recorrido completo, estable y presentable en computadora.
Prioridad 2: interacción preparada para WebXR, con controles espaciales.
Prioridad 3: reconocimiento de voz y devolución transparente.
Prioridad 4: tres escenarios terminados.
Prioridad 5: documentación, publicación y material de presentación.
Construí primero una versión completa con un escenario y después extendela. No abras muchos frentes incompletos.
No agregues multijugador, cuentas, pagos, rankings públicos, avatares personalizables ni servicios complejos. No reconstruyas el evento entero.
TECNOLOGÍA
Usá A-Frame, HTML, CSS y JavaScript, salvo que la estructura existente justifique claramente otra elección.

* Consultá documentación oficial actual y fijá versiones concretas.
* Mantené las dependencias al mínimo.
* El producto básico debe funcionar como sitio estático en GitHub Pages.
* Usá rutas compatibles con /sitioPubliton/pitch-lab/.
* No requieras backend para el recorrido principal.
* No incrustes claves ni secretos en archivos del cliente.
* No agregues servicios pagos, contrataciones ni nuevas cuentas.
* Si una integración requiere credenciales inexistentes, implementá una alternativa funcional y documentá la limitación.
* Usá componentes separados para escenas, sesión, voz, evaluación e interfaz.
* Priorizá código legible para que podamos explicarlo en clase.

IDENTIDAD VISUAL
Reutilizá los recursos reales del sitio y repositorio.
Paleta de referencia:

* Fondo: #181D16.
* Superficies: #20261C.
* Acción principal: #0047FF.
* Énfasis: #FFC94A.
* Acento: #FF006E.
* Texto claro con contraste suficiente.

Tipografías:

* Anton para títulos.
* Barlow para texto e interfaz.

Usá archivos locales cuando existan. No dependas de fuentes remotas si podés evitarlo.
Estética:

* Gráfica, expresiva y vinculada con creatividad publicitaria.
* Fondos oscuros.
* Títulos contundentes.
* Geometría 3D estilizada y liviana.
* Iluminación cuidada.
* Señalética integrada al espacio.
* Composición intencional, sin sectores vacíos por descuido.
* Evitá textos diminutos.

No inventes un logo nuevo. Si no encontrás el original, usá el nombre tipográfico de manera consistente.
ESCENARIOS
Implementá tres escenarios que compartan una misma lógica y difieran mediante configuración.

1. SALA DE ENSAYO

* Presentación de 60 segundos.
* Espacio pequeño.
* Tres oyentes estilizados.
* Atril, pantalla del brief y reloj.
* Ambiente tranquilo para aprender la mecánica.

2. REUNIÓN CON CLIENTE

* Presentación de 90 segundos.
* Mesa, audiencia pequeña y pantalla.
* Brief centrado en problema, propuesta y beneficio.
* Sensación de cercanía con quienes escuchan.

3. AUDITORIO

* Presentación de 120 segundos.
* Escenario y público distribuido en varias zonas.
* Mayor escala espacial.
* Audiencia con animaciones discretas.
* Sin abucheos ni reacciones humillantes.

Las diferencias deben percibirse en el espacio, no solamente en el color o el título.
BRIEFS
Incluí al menos tres briefs ficticios editables desde configuración, adecuados para una campaña breve.
Cada brief debe tener:

* Marca ficticia.
* Problema de comunicación.
* Público.
* Objetivo.
* Una restricción creativa.
* Una guía breve sobre qué presentar.

Identificá las marcas como ficticias. Evitá afirmaciones médicas, estadísticas inventadas y campañas dañinas.
RECORRIDO
Inicio → elegir escenario → conocer brief → preparación → presentación → devolución → reintentar o cambiar escenario.
Incluí:

* Tutorial breve y salteable.
* Explicación de controles.
* Preparación con tiempo configurable.
* Acción explícita para comenzar.
* Tiempo restante visible.
* Pausa y continuación.
* Finalizar antes de tiempo.
* Cancelar con confirmación durante una sesión activa.
* Volver y cambiar escenario.
* Reinicio limpio.
* Recuperación ante fallos del micrófono o reconocimiento.

Implementá estados explícitos y transiciones claras. Evitá temporizadores duplicados, controles que queden activos en una pantalla equivocada o sesiones que continúen después de cancelarse.
ESPACIO E INTERACCIÓN

* Piso y límites coherentes.
* Escala humana aproximada.
* Atril, pantalla del brief, reloj y panel de resultados con funciones claras.
* Posición inicial segura.
* Navegación en computadora con mouse y teclado.
* Controles de movimiento documentados.
* Impedí atravesar objetos importantes mediante límites sencillos o zonas navegables controladas.
* Interacciones con mouse en escritorio y raycasting con controladores en VR.
* Los controles esenciales deben existir dentro de la escena.
* No dependas exclusivamente de paneles HTML que puedan desaparecer al entrar en modo inmersivo.
* Botón para entrar en VR cuando el dispositivo sea compatible.
* Mensaje claro cuando el modo inmersivo no esté disponible.
* Modo sentado.
* Recentrado cuando sea técnicamente posible.
* Evitá movimientos automáticos de cámara.
* En VR, priorizá posiciones fijas o puntos de teletransporte antes que desplazamientos que puedan marear.
* No bloquees la salida de la experiencia.

AUDIO Y RECONOCIMIENTO DE VOZ
La voz debe mejorar la experiencia, pero su compatibilidad no puede impedir completar el recorrido.

* Detectá las capacidades reales del navegador.
* Pedí micrófono solo después de una acción explícita.
* Usá reconocimiento de voz en español cuando esté disponible.
* Explicá antes de activarlo si el reconocimiento puede procesarse mediante servicios externos del navegador.
* No prometas procesamiento totalmente local si no está garantizado.
* Mostrá una transcripción revisable.
* Informá errores y ofrecé reintentar.
* Incluí una alternativa sin micrófono: práctica con temporizador y autoevaluación.
* No grabes ni guardes audio por defecto.
* No guardes transcripciones por defecto.
* Liberá las pistas y recursos de audio al terminar, cancelar o salir.
* No solicites permisos repetidamente después de un rechazo.
* Separá claramente permisos, transcripción y medición de audio.

Si incorporás una transcripción de ejemplo para comprobar el recorrido, marcala siempre como “Demostración”. Nunca la presentes como voz reconocida realmente.
Si el usuario edita o pega una transcripción después, identificá ese origen. No atribuyas métricas acústicas a texto escrito.
DEVOLUCIÓN Y PUNTUACIÓN
Quiero una evaluación útil y transparente.
Métricas posibles, cuando existan datos suficientes:

* Duración efectiva de presentación, excluyendo pausas.
* Cantidad de palabras.
* Palabras por minuto.
* Muletillas detectadas mediante una lista configurable.

Documentá:

* Cómo se calcula cada métrica.
* Qué datos utiliza.
* Qué limitaciones tiene.
* Cómo pueden afectar los errores de reconocimiento.

No calcules silencios acústicos a partir de la puntuación de la transcripción. Solo mostralos si realmente se midieron.
No inventes medidas de:

* Confianza.
* Ansiedad.
* Emociones.
* Contacto visual.
* Persuasión.
* Calidad integral del discurso.

La orientación del casco no equivale a seguimiento ocular.
Para el contenido, incluí una rúbrica de autoevaluación:

* ¿Presenté el problema?
* ¿Expliqué la idea?
* ¿Justifiqué el beneficio?
* ¿Cerré con una propuesta clara?

Si agregás un puntaje, llamalo “Indicador técnico orientativo”, mostrale al usuario su fórmula y calculalo solamente con datos suficientes. No generes números aleatorios ni lo presentes como una evaluación profesional.
Si no hay información suficiente, mostrá “Sin datos suficientes” y ofrecé la autoevaluación.
La devolución debe incluir:

* Qué se pudo medir.
* Uno o dos consejos concretos basados en esos datos.
* Aspectos que requieren revisión humana.
* Reintentar.
* Cambiar escenario.

Dejá preparada una interfaz separada para una futura evaluación semántica con IA, pero no hagas depender el producto de ella ni simules que ya existe.
AUDIENCIA

* Avatares estilizados y livianos.
* Animaciones sutiles e independientes del puntaje.
* Las reacciones ambientales no deben presentarse como evaluación real del argumento.
* No agregues respuestas conversacionales falsas que aparenten comprender la voz.
* Si incluís preguntas, pueden ser preguntas predefinidas y deben identificarse como tales.

ACCESIBILIDAD Y UI

* Una acción principal clara por estado.
* Acciones secundarias con menor énfasis.
* Botones grandes, separados y legibles.
* No transmitir información únicamente por color.
* Instrucciones breves.
* Alternativa sin voz.
* Volumen regulable.
* Reducción de movimiento.
* Texto accesible en escritorio.
* Foco visible en controles HTML.
* Señales visuales además de audio.
* Tiempo de preparación ajustable.
* Opción de práctica sin límite de tiempo.
* Feedback respetuoso y constructivo.

RENDIMIENTO

* Geometría sencilla.
* Cantidad moderada de luces, materiales y sombras.
* Sin descargas grandes innecesarias.
* Sin modelos o texturas remotos frágiles como requisito del recorrido.
* Gestioná listeners, temporizadores y recursos correctamente.
* Evitá errores de consola y promesas rechazadas sin manejar.
* No afirmes una tasa de cuadros ni rendimiento en casco sin medirlo.

PRUEBAS
Verificá, según las herramientas disponibles:

1. Carga inicial.
2. Acceso a los tres escenarios.
3. Tutorial y navegación.
4. Inicio, pausa, continuación y finalización.
5. Cancelación y reinicio sin estado residual.
6. Temporizador correcto.
7. Micrófono aceptado.
8. Micrófono rechazado.
9. Reconocimiento no disponible.
10. Sesión sin voz.
11. Sesión con silencio o transcripción vacía.
12. Devolución con y sin datos.
13. Reintento y cambio de escenario.
14. Rutas y recursos desde la carpeta de GitHub Pages.
15. Controles espaciales preparados para VR.
16. Acceso al sitio anterior sin regresiones.

Si tenés navegador automatizable, usalo para probar y capturar las pantallas principales. Los permisos o APIs de voz que no puedas verificar deben quedar explícitamente pendientes.
No confundas revisión de código, emulación y prueba en un casco físico. Indicá por separado qué se verificó realmente.
Incluí pruebas pequeñas y significativas para los cálculos y las transiciones de estado. No gastes el trabajo en tests triviales mientras el recorrido esté incompleto.
DOCUMENTACIÓN Y ENTREGABLES
Dejá organizado:

1. Código completo de la experiencia.
2. README con instrucciones de ejecución, publicación, controles, compatibilidad y limitaciones.
3. Explicación breve de arquitectura y estados.
4. Configuración editable de briefs, tiempos y escenarios.
5. Checklist de pruebas con resultados observados y pendientes.
6. Registro de decisiones y supuestos.
7. Bitácora de prompts realmente recibidos durante el trabajo. No inventes conversaciones.
8. Registro de al menos un problema real encontrado y resuelto, si efectivamente ocurrió, con causa, solución y comprobación.
9. Capturas reales de la experiencia, si podés generarlas.
10. Informe visual horizontal 16:9 exportado a PDF si las herramientas disponibles lo permiten.
11. Material organizado para trasladar el informe a Figma, sin afirmar que fue publicado allí si no tenés acceso.
12. Guion de exposición de cinco minutos dividido entre Fiscina, Fuentes, Diaz y Tana.

El informe debe incluir:

* Portada.
* Problema y oportunidad.
* Relación con Publitón y el público.
* Referentes: al menos tres, con enlaces, análisis y fuentes.
* Justificación de VR.
* Recorrido.
* Diseño espacial de los tres escenarios.
* Mecánica.
* Identidad y accesibilidad.
* Arquitectura.
* Bitácora de prompts.
* Problema real resuelto.
* Intervención manual: pendiente hasta que el equipo la realice.
* Pruebas y limitaciones.
* Enlace y QR de la experiencia publicada, solo cuando exista y esté verificado.
* Próximos pasos.

Investigá referentes en fuentes oficiales. No inventes enlaces, citas, imágenes ni resultados de investigación. Si no podés reutilizar una imagen, dejá un enlace y explicá qué captura debe incorporar el equipo.
INTERVENCIÓN MANUAL OBLIGATORIA DEL EQUIPO
Este requisito no lo podés completar por nosotros.
Prepará una guía para que hagamos una modificación pequeña pero significativa a mano. Por ejemplo:

* Modificar la lógica de aviso de tiempo.
* Cambiar una regla de devolución.
* Ajustar una interacción para mejorar accesibilidad.

Identificá el archivo y fragmento actual. Explicá el cambio propuesto, su motivo y cómo comprobarlo.
No apliques esa modificación específica ni la presentes como realizada por los estudiantes. Dejá un espacio para agregar después el antes/después real.
PUBLICACIÓN
Tenés autorización para preparar y publicar esta experiencia en el repositorio indicado, conservando el sitio existente, si las credenciales y permisos ya están disponibles.

* Inspeccioná el flujo de publicación existente.
* Comprobá los cambios antes de subirlos.
* Hacé commits claros y limitados al trabajo.
* No uses force push ni reescribas historial.
* No modifiques secretos, facturación, propietarios ni permisos.
* No elimines contenido existente para resolver un problema de publicación.
* Verificá la URL final si tenés conexión.
* No afirmes que está publicado si únicamente generaste archivos o subiste código.

Si falta autenticación o una aprobación externa, dejá todo preparado, registrá exactamente qué falta y continuá con las demás tareas. No intentes eludir permisos.
AUTONOMÍA MIENTRAS ESTOY DE VIAJE

* No me hagas preguntas sobre decisiones visuales o técnicas rutinarias.
* Elegí opciones razonables y documentalas.
* No esperes aprobación entre etapas.
* Si una dependencia falla, intentá una alternativa sencilla dentro del alcance.
* Si un servicio externo bloquea una función, entregá una alternativa local claramente identificada.
* Continuá con las tareas independientes de cualquier bloqueo.
* No te quedes repitiendo intentos que fallan por la misma causa.
* No agregues funciones grandes fuera del alcance.
* No termines con un simple plan o una lista de cosas que podrías hacer.
* No fabriques pruebas con usuarios ni resultados.
* No describas una función como terminada hasta comprobar su recorrido.
* No confundas gasto de tokens con progreso.

Mantené un archivo STATUS.md actualizado con:

* Qué está terminado.
* Qué estás haciendo.
* Qué falta.
* Bloqueos.
* Próximos pasos concretos.
* Comandos necesarios para retomar.

Si se agota tu contexto y tu entorno permite continuar, usá ese archivo para retomar sin rehacer lo ya completado.
ORDEN DE EJECUCIÓN

1. Inspección del repositorio, recursos e instrucciones.
2. Plan breve y criterios de aceptación.
3. Un escenario 3D navegable y seleccionable.
4. Recorrido completo con temporizador y devolución básica.
5. Voz y alternativas de recuperación.
6. Otros dos escenarios.
7. Identidad visual, accesibilidad y rendimiento.
8. Pruebas y correcciones.
9. Documentación e informe.
10. Publicación y verificación, cuando los permisos lo permitan.

CRITERIOS DE ACEPTACIÓN
El trabajo se considera completo cuando:

* Los tres escenarios cargan.
* Se puede completar una sesión y volver a intentarla.
* Se puede terminar el recorrido sin micrófono.
* La devolución utiliza datos reales o identifica expresamente su carácter manual o demostrativo.
* Los controles principales funcionan en computadora y tienen su equivalente espacial para VR.
* La experiencia tiene modo inmersivo WebXR preparado.
* No quedan errores conocidos que impidan el recorrido principal.
* El sitio anterior sigue funcionando.
* La documentación distingue lo probado de lo pendiente.
* La guía de intervención manual está lista.
* La experiencia está publicada y verificada, o existe un paquete completo con el impedimento externo de publicación claramente documentado.

Al terminar, entregá un resumen breve con:

* Qué construiste.
* Enlace real, si está publicado.
* Cómo ejecutarlo localmente.
* Qué verificaste.
* Qué queda pendiente, especialmente casco físico e intervención manual del equipo.
* Ubicación del informe, documentación y capturas.

Empezá ahora. Inspeccioná lo disponible y avanzá hasta dejar el producto completo y presentable.
~~~
