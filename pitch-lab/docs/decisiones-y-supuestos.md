# Registro de decisiones y supuestos

Decisiones tomadas durante el trabajo autónomo (sin poder consultar al equipo). Cada una tiene su motivo y
cómo revertirla o ajustarla.

## Decisiones técnicas

| # | Decisión | Motivo | Cómo cambiarla |
|---|---|---|---|
| D1 | **A-Frame 1.8.0 fijado e incluido en `vendor/`** (sin CDN) | Versión estable más reciente al momento (npm, blog oficial); evita depender de un servicio externo; funciona igual en GitHub Pages | Reemplazar el archivo y la etiqueta `<script>` de `index.html` |
| D2 | **Módulos ES sin build** | Un sitio estático simple de explicar; compatible con GitHub Pages | — |
| D3 | **Texto y botones 3D dibujados en `canvas`** (Anton/Barlow reales) en vez del componente `text` de A-Frame | `text` descarga fuentes MSDF de un CDN y no tiene Anton/Barlow; así se usan las tipografías del sitio y no hay dependencias remotas | `ui/panel-draw.js`, `ui/draw-button.js` |
| D4 | **Rayo de puntería con el *target ray* de WebXR** (`xr-ray`) en vez de `laser-controls` | `laser-controls` corrige la dirección según el modelo 3D del control (descarga remota); sin modelo el rayo queda mal orientado en cascos reales. El *target ray* lo informa el sistema, sirve para controles y manos y no descarga nada | `components/xr-support.js` |
| D5 | **Sin descargas de modelos o texturas remotas**: toda la geometría es procedural y las texturas son lienzos | Requisito de rendimiento/robustez | — |
| D6 | **Público con mallas instanciadas** | Pocas llamadas de dibujo aun con ~64 personas | `scenes/audience.js` |
| D7 | **Un modelo de pantalla (`screens.js`) dibujado por dos renderizadores** (3D y HTML) | Garantiza que el panel de texto y el espacio digan lo mismo y que cada botón sea válido en su estado (hay test) | — |
| D8 | **Máquina de estados como tabla de datos** (`FLOW`) | Estados y transiciones explícitos, fáciles de leer y de probar; rechaza eventos fuera de lugar | `core/state-machine.js` |
| D9 | **Tiempo por marcas de reloj, un único `setInterval`** | Exactitud con pausas y sin temporizadores duplicados | `core/session.js` |
| D10 | **Preferencias en `localStorage`; transcripciones y audio nunca** | Requisito de privacidad | `core/settings.js` |
| D11 | **Dependencias de desarrollo mínimas**: `playwright-core` (usa el Edge/Chrome instalado, no descarga navegadores) e `iwer` (emulador WebXR) | Pruebas reales sin sumar nada al producto | `package.json` |
| D12 | **Tipografías y favicon reutilizados de `../assets/`** (no se copian) | Reutilizar recursos reales del sitio; una sola copia | Si `pitch-lab/` se mueve a otro lado, copiar `assets/` y ajustar `css/pitch-lab.css` e `index.html` |
| D13 | **No se modificó ningún archivo existente del sitio** (ni el `README.md` raíz ni `index.html`) | Evitar regresiones y no pisar cambios ajenos | Opcional: agregar un enlace desde el sitio principal (ver «Próximos pasos») |

## Decisiones de diseño y alcance

| # | Decisión | Motivo |
|---|---|---|
| E1 | **Hub con tres maquetas** para elegir escenario | Hace visible en el espacio la diferencia de escala y de cantidad de público *antes* de entrar; son los «objetos 3D con intención» del hub |
| E2 | **Controles esenciales en el atril 3D** (acción principal grande + secundarias) y opciones en un panel flotante | El requisito pide que no dependan de HTML; el HTML es solo espejo accesible |
| E3 | **Posición inicial detrás del atril, mirando al público**; la pantalla del brief queda atrás y el reloj frente a la persona | Escala humana, posición segura y referencia visual del tiempo, como en una sala real |
| E4 | **En VR solo teletransporte a marcas fijas** y «Recentrar»; sin desplazamiento continuo ni giros automáticos | Evitar mareo; ningún movimiento ocurre sin acción de la persona |
| E5 | **Un breve fundido a negro** al cambiar de lugar (se omite con movimiento reducido) | Comodidad en VR; no es un movimiento de cámara |
| E6 | **«Modo sentado» eleva la vista 0,45 m solo en VR** | En `local-floor` la vista sentada queda baja; valor configurable (`APP_CONFIG.movement.seatedOffsetM`) |
| E7 | **La preparación no inicia la presentación sola** | Requisito de acción explícita para comenzar |
| E8 | **Al cumplirse el tiempo la presentación termina sola** (con aviso previo visual y sonoro) | Evita presentaciones que se alargan sin que se note; en «práctica sin límite» no ocurre |
| E9 | **Pestaña en segundo plano → pausa automática** | El navegador puede detener el reconocimiento; evita medir tiempo en el que nadie hablaba |
| E10 | **Cancelar lleva al brief** (no a Inicio) con aviso | Permite reintentar enseguida sin volver a elegir escenario |
| E11 | **Si falla el WebGL o la escena tarda más de 15 s** se abre el panel de texto en «modo solo texto» | El recorrido puede completarse sin 3D |
| E12 | **Preguntas de práctica predefinidas**, solo en el panel de texto de la devolución y rotuladas como «predefinidas; no responden a lo que dijiste» | La audiencia no conversa ni finge comprender la voz; es una lista fija (`PRACTICE_QUESTIONS`) para reflexionar |
| E13 | **Briefs con marcas ficticias** rotuladas en pantalla, sin afirmaciones médicas ni estadísticas | Requisito del encargo |

## Supuestos

- **S1.** El público objetivo (participantes de Publitón que necesitan defender ideas creativas) se toma como
  **hipótesis de diseño**: en el repositorio no hay User Personas documentados. Ver [`usuarios-hipotesis.md`](usuarios-hipotesis.md).
- **S2.** Se asume que en el navegador de la persona el reconocimiento de voz puede procesarse **fuera del
  dispositivo**, y así se informa antes de activarlo.
- **S3.** Se asume que un casco compatible con WebXR ofrece `immersive-vr` con `local-floor` (Quest Browser). Se
  pidió `local-floor` como requerido y `bounded-floor` como opcional (configuración estándar de A-Frame).
- **S4.** Los umbrales de ritmo (110–160 palabras por minuto), de muletillas y de uso del tiempo son **valores de
  referencia razonables elegidos por el equipo de desarrollo**, no resultados de investigación. Son editables.
- **S5.** Las duraciones (60/90/120 s) y el tiempo de preparación por escenario (45/60/90 s) salen del encargo y
  de criterio de diseño; el tiempo de preparación se ajusta de 0 a 300 s.
- **S6.** El texto de demostración y las preguntas predefinidas están en `app-config.js` y son material de ejemplo.

## Límites de alcance respetados

Sin multijugador, cuentas, pagos, rankings, avatares personalizables, backend ni claves en el cliente. No se
reconstruyó el sitio del evento. No se simula evaluación con IA.
