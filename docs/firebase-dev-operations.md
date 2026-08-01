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

Para cargar también productos/servicios ficticios y generar las capturas reproducibles de los manuales:

```powershell
npm run seed:emulators:functional
npm run evidence:emulators
```

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

## Semilla cloud y rollback selectivo

La semilla DEV se identifica simultáneamente con `dataOrigin: "dev-seed"`, `seedVersion: "functional-dev-v1"` y `seedTag: "enfriamatic-functional-demo-v1"`. Selecciona perfiles admin/operator activos sin modificarlos y se detiene si una ruta determinista ya pertenece a otro origen.

Ejecuta primero el dry-run y usa siempre `--project enfriamatic-cotizador-de-420e5`; consulta [deployment.md](deployment.md) para los comandos completos. El rollback sólo elimina rutas deterministas que conservan los marcadores requeridos, procesa primero subcolecciones y mantiene fuera de alcance usuarios y PDFs oficiales.
