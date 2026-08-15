# V2.1 — inventario técnico

## Arquitectura base

SPA React 19 + TypeScript estricto + Vite y `wouter`. Firebase Authentication restaura sesión; `users/{uid}` es la autoridad de rol/estado. Firestore Rules protege CRUD operativo y Functions Gen 2 usa Admin SDK para identidades, folios, emisión, PDF, auditoría y notificaciones.

## Rutas base

- `/`: Inicio.
- `/clients`, `/sites`, `/equipment`: datos maestros en vista compartida.
- `/requests` y `/requests/:requestId`: solicitudes.
- `/quotes`: cotizaciones y editor.
- `/commercial-catalog`: productos/servicios.
- `/activity`: auditoría.
- `/manual`: manual en aplicación.
- `/users`, `/catalogs`, `/settings`: administración.

## Colecciones base

`users`, `clients`, `sites`, `equipment`, `requests`, `quotes`, `quotes/{id}/items`, `quotes/{id}/issuanceAttempts`, `catalogItems`, `catalogs`, `settings`, `notifications`, `auditLogs`, `documents` y `counters`.

## Functions base

`healthCheck`, `recordLogin`, `createUser`, `updateUser`, `issueQuote`, `createCorrection`, `transitionQuote`, `downloadQuotePdf` y `auditDomainWrite` en `us-central1`.

## Seguridad y Storage

- Firestore: default deny, perfiles privados, ACL `operatorIds`, esquemas estrictos, transiciones y cotización emitida inmutable.
- Storage: default deny; PDFs sólo por Admin SDK y callable autenticada.
- PDF: PDFKit, hash SHA-256, firma y tamaño verificados, folio transaccional e idempotencia.

## CI/CD

GitHub Actions ejecuta validación local, auditoría de dependencias y suite completa de emuladores. El despliegue es manual; V2.1 sólo autoriza un canal preview de Hosting.

## Brechas V2.1 verificadas

- Sin `isPrimaryAdmin`, reautenticación ni protección transaccional del último admin.
- Sin `lastActivityAt` con throttling.
- Sin páginas de detalle conectadas para cliente, instalación y equipo.
- Sin archivos de instalación, intervenciones técnicas ni soporte.
- Solicitudes no permiten reapertura auditada y el detalle comparte página con la lista.
- Dashboard, actividad y notificaciones son funcionales pero limitados.
- Configuración no tiene el flujo explícito lectura → edición → confirmación/reauth.
- Catálogo no admite imagen privada opcional.
- Manuales existen, pero requieren integración visual, soporte y PDF por perfil.
