# Enfriamatic Cotizador V2 Full

SPA interna Mobile First para gestionar clientes, instalaciones, equipos,
solicitudes, cotizaciones industriales, emisión de PDF, notificaciones y
auditoría sobre Firebase.

## Requisitos

- Node.js 22
- Java 21 o compatible con Firebase Emulator Suite
- Firebase CLI 15.25.0

## Preparación local

```powershell
Copy-Item .env.example .env.local
npm ci
npm --prefix functions ci
npm run validate:env
```

`.env.local` ya está ignorado. Las variables `VITE_FIREBASE_*` son configuración
pública de la app web DEV; nunca agregue cuentas de servicio ni secretos.

## Comandos

```text
npm run dev
npm run build
npm run lint
npm run typecheck
npm test
npm run test:watch
npm run test:rules
npm run test:storage
npm run test:functions
npm run test:e2e
npm run format
npm run format:check
npm run validate
npm run validate:emulators
npm run emulators
npm run seed:emulators
```

`npm run validate:emulators` compila todo, levanta Auth, Firestore, Storage,
Functions y Hosting, aplica una semilla idempotente y ejecuta Rules + E2E.

## Cuentas ficticias del emulador

| Perfil            | Correo                        | Contraseña                |
| ----------------- | ----------------------------- | ------------------------- |
| Admin activo      | `admin@enfriamatic.local`     | `DevOnly!Enfriamatic2026` |
| Operador activo   | `operador@enfriamatic.local`  | `DevOnly!Enfriamatic2026` |
| Operador inactivo | `inactivo@enfriamatic.local`  | `DevOnly!Enfriamatic2026` |
| Auth sin perfil   | `sinperfil@enfriamatic.local` | `DevOnly!Enfriamatic2026` |

Estas credenciales son exclusivamente ficticias y el script se niega a correr
si no detecta todos los emuladores.

## Documentación

- [Arquitectura](docs/architecture.md)
- [Operación Firebase DEV](docs/firebase-dev-operations.md)
- [Seguridad y riesgos](docs/security-risks.md)
- [Pruebas](docs/testing.md)
- [Despliegue](docs/deployment.md)
- [Rollback](docs/rollback.md)
- [Manual administrador](docs/admin-manual.md)
- [Manual operador](docs/operator-manual.md)
