# STATUS — Publitón Pitch Lab

_Última actualización: 2026-11-04._

## Publicación

| Ítem | Estado |
|---|---|
| Código en el repositorio (`main`) | **Subido** a `main` sin `--force`; Pages construyó los commits subidos («built»). La verificación se hizo sobre `df6fd36` y sobre el último commit (`6316c7f`) |
| Enlace público | <https://cundix.github.io/sitioPubliton/pitch-lab/> — **publicado y verificado el 2026-11-04** (HTTP 200 en los recursos, 8/8 pruebas e2e contra el enlace real, sitio anterior intacto) |
| Qué NO está verificado | Uso en un casco físico y voz real (ver «Falta») |

## Terminado (y cómo se comprobó)

- **Experiencia completa** en `pitch-lab/`: hub con maquetas, tres escenarios (Sala de ensayo 60 s, Reunión con cliente 90 s, Auditorio 120 s), tres briefs ficticios, tutorial salteable, preparación ajustable, presentación con reloj, pausa, finalizar, cancelar con confirmación, devolución y reintento. → pruebas de navegador real (21/21).
- **Voz opcional** con alternativas (sin micrófono, permiso rechazado, reconocimiento no disponible, silencio), transcripción revisable con origen, medición de nivel de audio opcional. → pruebas con **simulaciones** de voz (voz real: pendiente).
- **Devolución transparente**: medidas con su origen, «Indicador técnico orientativo» con fórmula visible y «Sin datos suficientes», rúbrica de autoevaluación, consejos basados en datos, revisión humana. → 77 pruebas de unidad.
- **WebXR**: botón «Entrar en VR», rayo de controles y manos (target ray), teletransporte, recentrado, modo sentado, salida de VR. → **emulador** (8/8). **Casco físico: pendiente.**
- **Accesibilidad**: panel de texto espejo, teclado completo, foco visible, `aria-live`, movimiento reducido, volumen.
- **Documentación** (`docs/`), **informe 16:9** (`informe/informe-pitch-lab.pdf`, 21 páginas), **material para Figma** (`informe/figma/`), **guion de 5 minutos**, **guía de intervención manual**, **capturas** (`capturas/`).

## En curso

Nada. El trabajo autónomo terminó con la publicación y su verificación (detalle en `docs/pruebas.md`, «Verificación de la publicación»).

## Falta (no lo puede cerrar la herramienta)

1. **Probar en un casco físico** y anotar comodidad, legibilidad y altura (modo sentado). No se afirma rendimiento ni cuadros por segundo.
2. **Intervención manual del equipo** (antes/después reales): guía en `docs/intervencion-manual.md`.
3. **Informe interactivo en Figma**: armarlo con `informe/figma/` (no hubo acceso a Figma).
4. **Imágenes de los referentes** para el informe (una captura por referente, con cita).
5. **Validar el público** (hoy es una hipótesis de diseño) con entrevistas o pruebas de uso.
6. **Voz real** en Chrome/Edge y pruebas en Firefox, Safari y celulares.
7. Bitácora de prompts: sumar los de los TPs anteriores y los que el equipo use.
8. Opcional: enlace desde el sitio principal hacia `/pitch-lab/` (no se modificó ningún archivo existente).

## Bloqueos

- **Casco físico**: no disponible en este entorno (bloqueo externo; queda pendiente explícito).
- **Figma**: sin acceso desde este entorno.
- Ningún bloqueo técnico abierto.

## Próximos pasos concretos

1. Abrir el enlace publicado en un casco y recorrer una sesión completa; registrar lo observado en `docs/pruebas.md`.
2. Hacer la intervención manual (elegir A, B o C) y completar la plantilla de `docs/intervencion-manual.md`.
3. Armar el informe en Figma desde `informe/figma/` y completar las diapositivas marcadas «pendiente».
4. Ensayar la exposición con `docs/guion-exposicion.md` (plan B incluido).

## Comandos para retomar

```bash
cd sitioPubliton/pitch-lab
npm install                                           # solo la primera vez
npm test                                              # 77 pruebas de unidad
node tools/serve.mjs                                  # http://localhost:8080/pitch-lab/
MSYS_NO_PATHCONV=1 node tools/serve.mjs 8081 /sitioPubliton   # ruta de GitHub Pages (otra terminal)
npm run test:e2e                                      # 21 pruebas con navegador real (~2 min)
node tests/e2e/xr.mjs                                 # 8 pruebas con emulador WebXR
node tools/qa-shots.mjs capturas 1600 900             # capturas
node tools/build-informe.mjs                          # PDF + PNG del informe
```

## Mapa rápido

- Configuración editable: `js/config/` (briefs, escenarios, tiempos, muletillas).
- Lógica: `js/core/` · Voz: `js/voice/` · Espacios: `js/scenes/` · Interfaz: `js/ui/` · Componentes A-Frame: `js/components/`.
- Documentos: `docs/` (arquitectura, métricas, decisiones, pruebas, problemas, prompts, intervención, guion, referentes).
