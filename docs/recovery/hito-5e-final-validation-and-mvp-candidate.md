# Hito 5E — Validación final y candidato MVP

## Objetivo y base

La rama candidata parte de `feat/mvp-h5d-settings-help-manuals` en `3ef63ae835f7d8a84b1d5711400372386b765848`.
La rama de cierre es `release/mvp-v2.1-rc1`.

## Alcance final

El MVP visible incluye Inicio, Clientes, Cotizaciones, Catálogo comercial, Usuarios y permisos,
Configuración, Manual y Soporte simulado. Solicitudes, Instalaciones, Equipos, Actividad y
Catálogos internos no aparecen como módulos activos. Las referencias de registros históricos se
conservan únicamente al consultar documentos antiguos.

La creación nueva es independiente: `requestId`, `siteId` y `equipmentId` se persisten como
`null`, con Cliente obligatorio, referencia de servicio y contexto técnico opcionales. Se retiró
el selector legacy de Solicitud de la creación nueva.

## Rutas y perfiles

Administrador: `/`, `/clients`, `/quotes`, `/commercial-catalog`, `/users`, `/settings`,
`/manual`, `/support`.

Operador: `/`, `/clients`, `/quotes`, `/commercial-catalog`, `/manual`, `/support`.

Las rutas `/requests`, `/sites`, `/equipment`, `/activity` y `/catalogs` redirigen de forma
segura; las rutas administrativas conservan guardas por rol.

## Matriz funcional

| Función                      | Administrador  | Operador           | Resultado |
| ---------------------------- | -------------- | ------------------ | --------- |
| Autenticación y logout       | Sí             | Sí                 | PASA      |
| Clientes y filtros           | Sí             | Alcance autorizado | PASA      |
| Catálogo comercial y filtros | CRUD permitido | Consulta activa    | PASA      |
| Cotización independiente     | Sí             | Sí, autoasignada   | PASA      |
| Emisión, PDF y descarga      | Sí             | Sí, según alcance  | PASA      |
| Correcciones                 | Sí             | Según autorización | PASA      |
| Configuración                | Sí             | Bloqueado          | PASA      |
| Manual                       | Administrador  | Operador           | PASA      |
| Soporte                      | Simulado       | Simulado           | PASA      |

## Auditoría y corrección aplicada

Se encontró un defecto visible en `QuotesPage`: aún se mostraban selector y mensajes de Solicitud,
Instalación y Equipo, además de un mensaje que negaba las cotizaciones libres. Se corrigió para
que el formulario nuevo sea exclusivamente independiente. La regresión está cubierta por la
prueba de componente y el flujo integral E2E.

## Configuración y documentos

Configuración usa reautenticación, validación centralizada y escritura sólo administrativa.
El prefijo de folio permanece protegido por backend. El campo de logo conserva su contrato de
referencia y no publica Storage. Los snapshots de cotizaciones emitidas, PDF, folios y documentos
históricos permanecen inmutables.

## Seguridad

Firestore Rules: 26/26. Storage Rules: 9/9. Functions conservan autenticación, rol, alcance,
idempotencia, auditoría, folios y documentos privados. Los cuatro warnings `no-explicit-any` de
`functions/src/quotes/createCorrection.ts` son preexistentes y no bloquean la validación.

## Responsive, consola y red

La suite E2E cubre móvil de 360 px y los flujos principales de escritorio; las vistas se mantienen
sin errores funcionales reportados. Los negativos de Rules generan `PERMISSION_DENIED` esperado.
Las llamadas observadas usan Emulator Suite; soporte no hace solicitudes externas. El warning de
Application Default Credentials pertenece al entorno de Functions Emulator y no produjo escrituras
fuera del proyecto demo.

## Validación automática

| Validación                                      | Resultado                       |
| ----------------------------------------------- | ------------------------------- |
| Format, lint, typecheck, tests y build frontend | PASA                            |
| Functions lint, typecheck, tests y build        | PASA                            |
| Firestore Rules                                 | PASA — 26/26                    |
| Storage Rules                                   | PASA — 9/9                      |
| E2E dirigido Hito 5D                            | PASA — 3/3                      |
| Emulator Suite corrida 1                        | PASA — 35 Rules/Storage, 26 E2E |
| Emulator Suite corrida 2                        | PASA — 35 Rules/Storage, 26 E2E |
| Emulator Suite corrida 3                        | PASA — 35 Rules/Storage, 26 E2E |
| `git diff --check`                              | PASA                            |

## Deudas no bloqueantes

- DEUDA TÉCNICA: cuatro warnings `no-explicit-any` preexistentes.
- LIMITACIÓN CONOCIDA: búsqueda local de algunas listas opera sobre la página cargada.
- MEJORA FUTURA: soporte externo real no está implementado.
- AJUSTE POSTERIOR AL MVP: manuales PDF históricos permanecen preservados, sin enlace activo.
- MEJORA VISUAL: existe un warning de tamaño de chunk Vite preexistente.

## Archivos, commits y congelamiento

Corrección de código: `src/features/quotes/QuotesPage.tsx`, su prueba y
`tests/e2e/full-flow.spec.ts`, commit `6532ee8 fix: remove retired modules from quote creation`.

La documentación final de alcance, limitaciones y revisión se añade en este cierre. Después de la
tercera corrida no se modifica código, dependencias, seeds ni reglas.

## Estado final

No se realizó despliegue, migración ni escritura en Firebase real. El candidato queda preparado
para revisión manual antes de autorizar un deploy DEV.

**Veredicto: PASA**  
**Confianza: ALTA**
