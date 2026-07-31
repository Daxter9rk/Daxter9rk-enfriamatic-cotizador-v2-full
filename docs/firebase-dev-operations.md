# Operación Firebase DEV

Proyecto autorizado: `enfriamatic-cotizador-de-420e5`.

| Servicio                  | Región/puerto local  |
| ------------------------- | -------------------- |
| Firestore Standard Native | `us-central1` / 8080 |
| Functions Gen 2 Node 22   | `us-central1` / 5001 |
| Storage                   | `us-east1` / 9199    |
| Authentication            | 9099                 |
| Hosting SPA               | 5000                 |
| Emulator UI               | 4000                 |

## Desarrollo

1. Ejecute `npm ci` y `npm --prefix functions ci`.
2. Configure `.env.local` desde `.env.example`.
3. Ejecute `npm run emulators`.
4. En otra terminal ejecute `npm run seed:emulators`.
5. Abra `http://127.0.0.1:5000`.

La semilla exige las variables de host de Auth, Firestore y Storage Emulator.
Nunca debe apuntar al proyecto cloud.

## Bootstrap de un ambiente nuevo

El primer administrador no se crea desde la SPA. Debe crearse en Authentication
y su documento `users/{uid}` debe cargarse mediante una operación administrativa
controlada con `role: "admin"` y `status: "active"`. Después, ese administrador
crea cuentas con `createUser`.

No hay registro público. App Check queda preparado como control futuro; las
callables declaran `enforceAppCheck: false` para DEV. Habilitar enforcement
requiere registro de la app, monitoreo previo y autorización explícita.

## Observabilidad

Functions emite logs estructurados con actor, recurso, duración, código seguro
y tamaño del PDF, sin contraseña ni bytes. Configure alertas de presupuesto,
errores `quote.issue_failed`, latencia p95 y tasa de reintentos antes de ampliar
usuarios.
