# Hito 5C — Catálogo comercial y filtros indispensables

## Resultado

Se cerró el alcance de Clientes, Cotizaciones y Catálogo comercial sobre la rama `feat/mvp-h5c-commercial-catalog-filters`, partiendo de `1ed487364507979bf11cbb45282fd57e85b6f8f3`. Se agregó paginación acotada con cursores compuestos y se conservaron los alcances de Rules existentes.

## Inventario y contrato

| Módulo             | Búsqueda                                                               | Filtros                                                                  | Orden                               | Página | Cursor                              |
| ------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------- | ------ | ----------------------------------- |
| Clientes           | nombre, razón social, RFC, correo, teléfono                            | estado                                                                   | nombre ascendente                   | 25     | `name asc`, `documentId asc`        |
| Cotizaciones       | folio, cliente visible, referencia de servicio sobre la página cargada | estado comercial, estado documental, cliente, creador, asignación, desde | `updatedAt desc`, `documentId desc` | 25     | `updatedAt desc`, `documentId desc` |
| Catálogo comercial | código, nombre, descripción, categoría, marca y modelo usando tokens   | tipo, categoría, unidad y estado                                         | `name asc`, `documentId asc`        | 25     | `name asc`, `documentId asc`        |

La búsqueda de texto es local sobre una página explícitamente limitada. No se presenta como búsqueda global: Firestore no ofrece texto libre nativo y este hito no introduce migraciones ni un motor externo. Los filtros de estado se aplican en la consulta cuando existe un contrato seguro; los filtros secundarios se aplican sobre la página cargada y reinician el cursor.

## Semántica por campo

| Módulo       | Filtro o búsqueda | Campo real                                                                  | Semántica                                                        | Alcance                         |
| ------------ | ----------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------- |
| Clientes     | Búsqueda          | `name`, `legalName`, `rfc`, `email`, `phone`                                | coincidencia parcial local, normalizada a minúsculas             | página autorizada               |
| Clientes     | Estado            | `status`                                                                    | igualdad Firestore (`active`/`inactive`)                         | colección autorizada            |
| Cotizaciones | Folio/contexto    | `folio`, `serviceReference`, `clientId` resuelto con clientes autorizados   | coincidencia parcial local; folio inequívoco dentro de la página | página autorizada               |
| Cotizaciones | Estado comercial  | `status`                                                                    | igualdad Firestore                                               | colección autorizada            |
| Cotizaciones | Estado documental | `documentStatus`                                                            | igualdad Firestore                                               | colección autorizada            |
| Cotizaciones | Asignación        | `assignedTo`                                                                | igualdad Firestore; el operador no puede elegir usuario          | administrador u operador propio |
| Catálogo     | Búsqueda          | `code`, `name`, `description`, `category`, `brand`, `model`, `searchTokens` | tokens normalizados, todos deben aparecer en la página           | página autorizada               |
| Catálogo     | Estado            | `status`                                                                    | operador: sólo `active`; administrador: `active`/`inactive`      | permiso vigente                 |
| Catálogo     | Unidad            | `unit`                                                                      | igualdad local sobre la página                                   | página autorizada               |

## Implementación

`listDocumentsPage` y `usePaginatedCollection` agregan consultas acotadas, cursores, orden explícito, indicador de página y protección contra respuestas obsoletas. Cambiar búsqueda o filtro crea una clave de consulta nueva y vuelve a la primera página; `Limpiar filtros` restaura los valores iniciales. El desempate por `documentId` evita duplicados u omisiones entre páginas.

Clientes conserva el filtro de autorización `operatorIds array-contains` para operadores. Cotizaciones aplica `assignedTo` en servidor para operadores y no expone filtros de otros operadores. Catálogo aplica `status == active` para operadores. No se agregaron consultas ni filtros para Solicitudes, Instalaciones, Equipos, Actividad, Usuarios generales ni catálogos internos.

## Catálogo y partidas

El editor continúa recibiendo conceptos activos desde `catalogItems` y crea una copia mediante `createQuoteItemFromCatalog`/snapshot. Un concepto desactivado deja de estar disponible para nuevas partidas, pero las partidas existentes conservan sus campos y snapshot. Las imágenes siguen pasando por callables y Storage privado; no se cambiaron Storage Rules.

## Estados, accesibilidad y móvil

Las barras reutilizan etiquetas asociadas, controles nativos, búsqueda por teclado y botón de limpieza. Se distinguen “No existen registros todavía” de “No se encontraron coincidencias con los filtros actuales”; los errores conservan el panel y el botón de reintento. La paginación usa botones accesibles y no depende sólo del color. No se hizo un rediseño global; el layout existente sigue siendo el responsable de adaptación móvil.

## Índices

Se añadieron únicamente índices para consultas implementadas: `clients(status, name)`, `catalogItems(status, name)`, `quotes(status, updatedAt)` y `quotes(documentStatus, updatedAt)`. Las consultas por asignación reutilizan el índice existente de `assignedTo + updatedAt`; el desempate por nombre/fecha y `documentId` es parte del cursor de la consulta.

## Compatibilidad

Se mantienen `requestId`, `siteId`, `equipmentId`, `originalQuoteId` y `revisionNumber`, sin reinterpretación ni migración. Emisión, folios, PDF, descarga, correcciones, auditoría, Rules y Storage Rules no fueron modificados. Dashboard de 5B y navegación de 5A permanecen fuera de este cambio.

## Pruebas y limitaciones

Las pruebas de componentes cubren RFC/estado/empty state de Clientes, unidad/búsqueda/empty state de Catálogo y creación independiente de Cotizaciones; las pruebas existentes mantienen catálogo activo, operador de sólo lectura, snapshots y navegación. La consulta paginada está cubierta por typecheck y ejecución de los consumidores; la validación integral de Emulator Suite debe ejecutarse contra el entorno local de emuladores antes de publicar.

Limitaciones reales: búsqueda de texto y filtros secundarios sólo cubren la página cargada; no hay totales globales, no se promete búsqueda libre global y no se agregó estado en URL. La deuda restante se limita a futuras mejoras de filtros avanzados y soporte móvil detallado (5D/5E); no se inicia ninguno en Hito 5C.

## Rollback

El rollback es retirar la rama/commits de Hito 5C y volver a `feat/mvp-h5b-dashboard-simplification`; no requiere migración ni escrituras de datos. Los tags protegidos no se mueven.
