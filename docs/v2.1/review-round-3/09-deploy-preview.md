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

No se ejecutó deploy de Hosting live. `https://enfriamatic-cotizador-de-420e5.web.app/` respondió y renderizó la pantalla de acceso en una comprobación read-only sin errores de consola.

El 5 de agosto de 2026 el revisor humano completó el smoke autenticado remoto en el preview. Resultaron aprobados el administrador promovido, el operador activo, el usuario inactivo y el usuario Auth sin perfil, incluyendo las restricciones de rutas, acciones administrativas y contenido privado correspondientes. El usuario sin perfil no aparece en `Usuarios y permisos`, conforme al contrato de no tener `users/{uid}`.

No se ejecutó cleanup de las cuentas de revisión ni regresión autenticada sobre Hosting live. La comprobación de live permaneció estrictamente read-only.
