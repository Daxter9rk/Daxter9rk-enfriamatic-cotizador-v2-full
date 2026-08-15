# ADR 0004: Contrato documental para emitir cotizaciones independientes

## Estado

Aceptado para el Hito 3A; implementación reservada para el Hito 3B.

## Contexto

El Hito 2.1 permite guardar y revisar una cotización independiente cuando
`requestId`, `siteId` y `equipmentId` son `null`. La ruta de emisión vigente no
comparte todavía ese contrato: `issueQuote` construye la autorización y el PDF
leyendo una Solicitud, una Instalación y, cuando aplica, un Equipo. La descarga
repite la validación contra Solicitud y la corrección histórica crea una nueva
Solicitud.

La consecuencia es que una cotización puede ser un borrador válido sin tener
una ruta de emisión documental válida. Hito 3A define el límite y la forma del
contrato; Hito 3B implementará el cambio sin alterar la compatibilidad de los
registros históricos.

## Decisión

La emisión será una operación backend autorizada sobre el agregado `Quote` y
su subcolección de partidas. La modalidad se determina exclusivamente por el
valor persistido de `requestId`:

- `requestId != null`: ruta histórica; conserva la validación de Solicitud,
  Cliente, Instalación, Equipo y asignación.
- `requestId == null`: ruta independiente; no consulta Solicitud, Instalación
  ni Equipo y usa Cliente, contexto textual y snapshots documentales.

En ambas rutas, Functions será la única autoridad para folio, totales finales,
estado de emisión, documento, Storage, auditoría e idempotencia. El cliente no
escribe esos resultados ni invoca Firestore directamente para emitir.

## Modelo documental

La emisión independiente debe construir un `QuoteDocumentModel` inmutable para
la generación. Como mínimo contiene:

- identidad: `quoteId`, `folio`, `issuedAt`, `currency`;
- cliente: `clientId`, `name` y los datos legales disponibles al momento de
  emitir;
- contexto: `serviceReference`, `technicalContext` y `notes`;
- empresa: snapshot de `settings/companyProfile` y valores comerciales de
  `settings/quoteDefaults`;
- partidas validadas y snapshots del catálogo ya persistidos en cada partida;
- totales recalculados en backend, tasa fiscal y vigencia;
- referencias históricas sólo cuando la modalidad sea histórica.

Los campos de Instalación y Equipo no se inventan para una cotización
independiente. El renderer debe representar la ausencia de esos datos de forma
neutral y no mostrar etiquetas vacías.

## Snapshot de Cliente y empresa

El documento se genera con los datos actuales y autorizados de Cliente y de la
empresa, pero esos valores quedan materializados en la metadata de la
emisión/documento para que una descarga posterior no dependa de que el nombre,
RFC, domicilio o texto legal siga igual. El Quote original mantiene sus campos
operativos y no se migra.

## Folios e idempotencia

La reserva de folio continúa siendo transaccional y usa el contador anual y
`formatFolio`. La clave `idempotencyKey` identifica el intento dentro de
`quotes/{quoteId}/issuanceAttempts/{idempotencyKey}`. Una repetición con una
emisión lista devuelve el resultado existente; una ejecución concurrente o en
proceso no puede emitir dos documentos ni consumir una segunda emisión lógica.

El folio reservado no se reutiliza automáticamente tras un fallo de generación.
La cotización vuelve a `draft` con `documentStatus: failed`, conservando el
folio reservado para trazabilidad; el reintento debe ser explícito y sus reglas
se implementarán en Hito 3B.

## Estados y seguridad

La transición documental propuesta es:

`draft/not_generated` -> `draft/generating` -> `issued/ready`.

Un error de preparación o generación termina en `draft/failed` y no deja la
cotización bloqueada. Sólo la transacción final del backend puede establecer
`issued`, `ready`, `locked`, `issuedAt`, `issuedBy` y `validUntil`. Las Rules
continúan negando escrituras directas de `documents`, intentos de emisión,
folios y contadores; su función es impedir falsificación y mutaciones del
cliente, no duplicar la lógica completa de Functions.

## PDF, Storage y descarga

El PDF se genera en backend desde `QuoteDocumentModel`, se valida por firma,
tamaño y hash, y se guarda en el prefijo privado existente
`quotes/{quoteId}/documents/{documentId}.pdf`. `documents/{quoteId}` es metadata
controlada por backend. Storage permanece con lectura y escritura directas
denegadas para documentos de cotización.

La descarga seguirá siendo una callable: comprueba actor activo, estado de la
cotización, metadata lista, ruta perteneciente al `quoteId`, tamaño, firma PDF
y autorización. Para la ruta independiente no reconsulta Solicitud, Sitio ni
Equipo; para la histórica conserva la revalidación actual.

## Auditoría, notificaciones y eventos

La emisión registra un evento explícito `quote.issued` con actor, modalidad,
folio, totales, hash, tamaño y documento. Los fallos registran
`quote.issue_failed` sin exponer mensajes internos. La notificación conserva
el patrón actual para administradores autorizados. No se agrega un bus de
eventos: el flujo transaccional existente es suficiente y los eventos sólo se
producen para auditoría/notificación.

## Correcciones

La corrección histórica mantiene su contrato: crea Solicitud y cotización
relacionadas. La corrección de una cotización independiente no se implementa
en Hito 3A. Hito 3B deberá decidir si crea una nueva cotización independiente
con `originalQuoteId` o si exige una operación explícita separada; no debe
fabricar una Solicitud para satisfacer el contrato antiguo.

## Alternativas rechazadas

1. Mantener Solicitud obligatoria: contradice el contrato independiente del
   Hito 2.1.
2. Crear una Solicitud artificial: contamina trazabilidad y revive dependencias
   que el MVP pretende retirar.
3. Generar el PDF en frontend: permitiría falsificar folio, totales o contenido
   y no protege el documento.
4. Escribir la emisión directamente en Firestore desde el cliente: omite la
   autoridad transaccional, Storage e idempotencia del backend.
5. Mover independientes a otra colección: duplica Rules, consultas, UI y
   compatibilidad sin resolver la necesidad documental.
6. Mantener dos contratos de PDF implícitos: produciría documentos con campos
   divergentes y haría frágil la descarga y corrección.

## Consecuencias

La emisión independiente comparte folio, ciclo documental, seguridad y
auditoría con la histórica, pero no depende de su contexto operativo. Hito 3B
deberá implementar el modelo, adaptar el renderer para contexto opcional,
separar las lecturas por modalidad y ampliar pruebas de callable, Rules,
Storage, descarga e idempotencia. No se requieren migraciones de datos ni
modificaciones de colecciones.
