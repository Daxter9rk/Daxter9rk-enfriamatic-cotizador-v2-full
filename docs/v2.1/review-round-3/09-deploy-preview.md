# Deploy DEV y preview — ronda 3

Fecha: 5 de agosto de 2026, America/Mexico_City.

## Recursos desplegados

- Project ID explícito: `enfriamatic-cotizador-de-420e5`.
- Firestore Rules: compiladas y liberadas.
- Functions Node.js 22, `us-central1`: `recordLogin`, `createUser`, `transitionQuote`, `auditDomainWrite` y `syncEquipmentIntervention`.
- No se desplegaron Storage Rules, índices, otras Functions ni datos.

## Preview

- Canal: `v2-1-operational-round-3`.
- URL: `https://enfriamatic-cotizador-de-420e5--v2-1-operational-round-6btd8cyo.web.app`.
- Expira: 12 de agosto de 2026, 18:32:50 (hora informada por Firebase CLI).
- Pantalla de acceso renderizada y consola sin errores.
- `healthCheck`: HTTP 200, `ok: true`, servicio `enfriamatic-cotizador-v2`, ambiente `dev`.

## Live y smoke

No se ejecutó deploy de Hosting live. `https://enfriamatic-cotizador-de-420e5.web.app/` respondió y renderizó la pantalla de acceso en una comprobación read-only sin errores de consola. El smoke autenticado del preview y la regresión autenticada de live quedan pendientes por ausencia de credenciales `REVIEW_*` o sesión autorizada.
