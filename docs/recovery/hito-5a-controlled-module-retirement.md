# Hito 5A — Retiro controlado de módulos de la interfaz

## Resultado

La experiencia activa del MVP queda reducida a Inicio, Clientes, Cotizaciones,
Catálogo comercial, Usuarios y Configuración, además de Manual y Soporte. Se
retiraron Solicitudes, Instalaciones, Equipos, Actividad y Catálogos internos de
la navegación y de las rutas activas. Los módulos retirados de la experiencia
activa no fueron eliminados destructivamente.

## Base y alcance

- Rama base: `feat/mvp-h4-independent-corrections`
- Commit base: `35336dcda98b2cb578f44aedb58a9e311796bc6f`
- Rama de trabajo: `feat/mvp-h5-final-closure`
- Tag de cierre: `v2.1-mvp-core-complete`, creado sobre el commit base y publicado
- Alcance: interfaz, navegación, guardas de rutas y evidencia automatizada

No se modificaron colecciones, datos, Functions, Firestore Rules, Storage Rules,
PDF, folios, cálculos, emisión, correcciones ni Firebase real.

## Inventario previo

| Área               | Implementación encontrada                                   | Decisión                                                                                     |
| ------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Solicitudes        | `src/features/requests/RequestsPage.tsx`, rutas `/requests` | Retirar de navegación y guardar ruta; conservar código, datos y compatibilidad histórica     |
| Instalaciones      | `MasterDataPage`/`EntityDetailPages`, rutas `/sites`        | Retirar de navegación y guardar ruta; conservar entidades y referencias históricas           |
| Equipos            | `MasterDataPage`/`EntityDetailPages`, rutas `/equipment`    | Retirar de navegación y guardar ruta; conservar entidades, adjuntos y referencias históricas |
| Actividad          | `src/features/activity/ActivityPage.tsx`, ruta `/activity`  | Retirar de navegación y guardar ruta; conservar auditoría y consultas                        |
| Catálogos internos | ruta legacy `/catalogs`                                     | Mantener fuera de la UI activa; conservar configuración y colección                          |
| Catálogo comercial | `CommercialCatalogPage`, `/commercial-catalog`              | Conservar como módulo activo                                                                 |
| Cotizaciones       | `QuotesPage`/`QuoteEditor`                                  | Conservar; las referencias históricas se muestran sin depender de enlaces activos retirados  |
| Dashboard          | métricas, accesos y consultas existentes                    | No rediseñar; sus enlaces legacy quedan protegidos por los guardas de ruta                   |

## Navegación final

La navegación de operación contiene:

- Inicio
- Clientes
- Cotizaciones
- Catálogo comercial

Administración conserva Usuarios y permisos y Configuración. Manual y Soporte
permanecen disponibles para ayuda. El operador no recibe Usuarios ni
Configuración.

## Guardas de rutas

Las rutas `/requests`, `/requests/:requestId`, `/sites`, `/sites/:siteId`,
`/equipment`, `/equipment/:equipmentId` y `/activity` redirigen a `/quotes`
cuando el usuario está autenticado. La ruta legacy `/catalogs` conserva su
redirección histórica a Configuración para administradores y al inicio para
operadores. Así, un enlace antiguo no produce una pantalla vacía, un error ni
una pantalla técnica de CRUD.

## Compatibilidad y seguridad

La eliminación es únicamente de experiencia activa. Se conservan:

- documentos y referencias históricas de Solicitud, Instalación y Equipo;
- validaciones y reglas de backend;
- auditoría y datos de actividad;
- colecciones, servicios, índices y semillas existentes;
- pantallas de cotización y su lectura de referencias históricas;
- Catálogo comercial y sus imágenes privadas.

No se agregaron accesos generales ni se relajaron permisos. La autenticación y
el perfil se evalúan antes de que se muestre cualquier ruta de aplicación.

## Archivos modificados y agregados

- `src/layouts/AppShell.tsx`: menú MVP reducido.
- `src/app/App.tsx`: guardas para rutas retiradas y eliminación de imports lazy
  de pantallas que ya no son destinos activos.
- `src/layouts/AppShell.test.tsx`: contrato de navegación administrativa.
- `tests/e2e/module-retirement.spec.ts`: navegación por rol, guardas directas y
  permanencia del Catálogo comercial.
- Este documento: inventario, decisión, compatibilidad y evidencia.

No se eliminaron archivos de módulos ni documentos de datos.

## Validación esperada

Se ejecutan las suites frontend, Functions, Rules/Storage y Emulator Suite
integral. La validación integral debe ejecutarse dos veces consecutivas sin
cambios de código entre ambas ejecuciones. Se conserva también el E2E histórico
existente para emisión, PDF, descarga, auditoría y corrección.

## Riesgos y rollback

El riesgo principal es que una URL antigua deje de abrir el CRUD que ya no forma
parte del MVP; la redirección a Cotizaciones es intencional y segura. El
rollback es volver a `35336dcda98b2cb578f44aedb58a9e311796bc6f` o revertir los
commits de Hito 5A, sin mover ni borrar los tags protegidos.

## Siguientes subfases

- 5B: simplificar o retirar infraestructura únicamente con inventario de uso y
  sin afectar históricos.
- 5C: revisar manuales y textos que todavía describen módulos retirados.
- 5D: auditoría final de navegación, permisos y rutas legacy.
- 5E: cierre de limpieza documental y decisión de mantenimiento.

La frase operativa de este hito es: módulos retirados de experiencia activa, no
eliminados destructivamente.
