# STATUS — Publitón Pitch Lab

_Última actualización: 2026-11-04 (trabajo autónomo en curso)_

## Terminado
- Estructura `pitch-lab/` creada dentro de la copia local del repo (`Design5to/sitioPubliton`), rama `main`, sin tocar archivos existentes.
- A-Frame 1.8.0 vendorizado en `vendor/` (sin CDN).
- Configuración editable: `js/config/` (app-config, briefs, scenarios).
- Lógica pura con tests: máquina de estados, sesión (reloj, pausa, cancelación, voz), métricas, indicador, devolución, rúbrica, layouts. **64 tests de unidad pasan** (`npm test`).

## En curso
- Componentes A-Frame (escenas, interfaz espacial, controles, audio) y HTML accesible.

## Falta
- Voz (envoltorio de Web Speech) y medidor de audio.
- Los tres escenarios 3D + hall de selección.
- Pruebas end-to-end con navegador, emulación WebXR y capturas.
- Documentación, informe 16:9 + PDF, guía de intervención manual, guion.
- Publicación y verificación en GitHub Pages.

## Bloqueos
- Ninguno por ahora. (Casco físico: no disponible; quedará como pendiente explícito.)

## Retomar
```bash
cd sitioPubliton/pitch-lab
npm test                 # tests de unidad
node tools/serve.mjs     # servidor estático en http://localhost:8080/pitch-lab/ (ver README)
```
