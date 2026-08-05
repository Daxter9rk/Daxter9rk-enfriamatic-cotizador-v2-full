# Despliegue DEV de la ronda 1

Fecha: 5 de agosto de 2026 (America/Mexico_City).

## Controles previos

- `npm run preflight:dev`: correcto con repositorio, proyecto y rama esperados y árbol limpio.
- Dry-run nominal: correcto; Firestore y Storage Rules compilaron, lint/build de Functions aprobaron.
- Proyecto explícito en todos los comandos: `enfriamatic-cotizador-de-420e5`.

## Recursos publicados

- Firestore Rules (`firestore:rules`).
- Storage Rules (`storage`).
- Functions Node.js 22 2nd Gen en `us-central1`: `assignRequest`, `transitionQuote`, `createCorrection` y `auditDomainWrite`.
- No se desplegaron índices; `firestore.indexes.json` no cambió.
- No se eliminaron Functions, datos, archivos ni recursos.

## Hosting preview

- Canal: `v2-1-operational-redesign`.
- URL: `https://enfriamatic-cotizador-de-420e5--v2-1-operational-redes-tldjx9c8.web.app`.
- Publicado: 5 de agosto de 2026, 15:46:49.
- Expira: 4 de septiembre de 2026, 15:46:45.
- Health check: HTTP 200, `ok: true`, servicio `enfriamatic-cotizador-v2`, ambiente `dev`.
- Preview: HTTP 200 y pantalla de acceso DEV renderizada correctamente.

## Hosting live

No se ejecutó un deploy live. `hosting:channel:list` conserva la última publicación live en **1 de agosto de 2026, 16:08:03**, mientras el preview tiene la publicación nueva del 5 de agosto. Live respondió HTTP 200.

## Smoke pendiente

El navegador disponible no tenía sesión existente. La credencial ficticia documentada para Emulator Suite fue rechazada por Firebase DEV, como corresponde si no existe o cambió en Auth real. No se intentó adivinar contraseñas, inspeccionar el gestor del navegador, exportar hashes de Auth ni crear tokens privilegiados.

Quedan pendientes, con una sesión autorizada proporcionada por la persona revisora, el smoke autenticado de preview y la regresión read-only de live: restauración, dashboard, usuarios/clientes/instalaciones, cotizaciones, PDF existente y consola. Este pendiente impide emitir el veredicto de “listo” aunque automatización, deploy y health checks estén verdes.
