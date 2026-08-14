# Hito 4 — Correcciones independientes

## Veredicto técnico

Implementación funcional sobre Emulator Suite. Una cotización independiente emitida puede crear una nueva revisión sin fabricar Solicitud, Instalación ni Equipo; la revisión conserva la raíz, recibe folio propio, copia partidas y contexto, puede editarse y volver a emitirse con PDF nuevo.

## Base y rama

- Rama base: `fix/mvp-h3b-1-audit-e2e-stability`
- HEAD base verificado: `e65f6faf34e9eceb797ee065aa0df3936302ec83`
- Rama: `feat/mvp-h4-independent-corrections`
- Tag protegido: `v2.1-preserved-before-mvp-restructure`

La detección de edición del proyecto Firestore real fue rechazada con HTTP 403 para el proyecto demo. No se ejecutaron operaciones reales; toda la validación funcional se hizo contra Emulator Suite.

## Contrato histórico encontrado

`createCorrection` histórico validaba estados `issued`, `sent`, `accepted` y `rejected`, comprobaba la coincidencia Cotización–Solicitud–Cliente–Instalación–Equipo, reservaba folio en transacción y creaba una nueva Solicitud y Cotización vinculadas. El proyecto usa `originalQuoteId` y `revisionNumber`; los documentos existentes inicializan `revisionNumber` en `1`, por lo que este hito conserva esa semántica y asigna la siguiente revisión desde una secuencia protegida.

La emisión ya usa `issuanceAttempts/{idempotencyKey}` y el contador anual de folios. La corrección reutiliza el patrón de clave idempotente, pero con `correctionAttempts/{idempotencyKey}` bajo la cotización fuente. La nueva revisión crea sus propios registros de partidas y comienza como `draft/not_generated/unlocked`.

## Implementación independiente

La callable `createCorrection` separa la rama por `requestId == null`:

- valida estado emitido, documento `ready`, bloqueo e integridad independiente;
- valida Cliente y autorización del operador sin consultar Solicitud, Instalación ni Equipo;
- resuelve la raíz común desde `originalQuoteId`;
- usa `quotes/{rootQuoteId}/correctionState/sequence` para serializar `revisionNumber`;
- consulta el máximo histórico sólo al inicializar la secuencia;
- reserva folio nuevo mediante el contador backend existente;
- copia partidas a nuevos documentos y recalcula descuentos y totales con las funciones de dominio;
- copia contexto textual, notas, moneda, tasa, vigencia y asignación;
- fuerza `requestId`, `siteId` y `equipmentId` a `null`;
- no modifica el documento original ni crea Solicitudes, Instalaciones o Equipos;
- registra `quote.correction_requested` y `quote.correction_created` con IDs deterministas;
- devuelve el mismo resultado lógico ante repetición de la misma clave.

La rama histórica conserva sus comprobaciones y la creación de Solicitud de corrección. La interfaz ahora abre la nueva revisión para ambos flujos y deshabilita la operación mientras está ocupada.

## Folio, documento y snapshots

El proyecto reserva folio al crear correcciones históricas; la corrección independiente conserva esa política sin reutilizar el folio original. No se copian `documents`, PDF, Storage path, hash, estado `issued`, `ready`, `locked`, `issuedAt`, `issuedBy` ni claves de emisión. La emisión posterior vuelve a generar snapshots y documento mediante `issueQuote`.

Las partidas se copian con identidad nueva, posición y snapshots de catálogo. Los totales se recalculan desde las partidas; no se confían los totales antiguos.

## Idempotencia y concurrencia

Cada solicitud de interfaz envía un UUID. El intento se registra debajo de la cotización fuente. Dos llamadas concurrentes con la misma clave devuelven el mismo `quoteId`; dos llamadas concurrentes con claves distintas compiten sobre la secuencia raíz y reciben revisiones diferentes.

Se añadió el índice `quotes(originalQuoteId ASC, revisionNumber DESC)` para la inicialización segura de secuencias existentes. No se modificaron Rules ni Storage Rules.

## UI

La acción `Crear corrección` conserva la pantalla existente, muestra progreso mediante el estado ocupado, evita doble envío, abre la revisión creada y deja disponible el editor, Preview y emisión. No se rediseñó la pantalla ni se retiraron módulos.

## Evidencia

- Frontend unitario: 26 archivos, 62 pruebas.
- Functions unitario: 10 archivos, 33 pruebas.
- Firestore Rules: 26 pruebas.
- Storage Rules: 9 pruebas.
- E2E independiente: 2 pruebas, incluyendo emisión, PDF, descarga, corrección, idempotencia y concurrencia.
- E2E histórico: 1 prueba, emisión, PDF, descarga y corrección histórica.
- Suite integral `validate:emulators`: Rules/Storage 35 pruebas y 17 E2E.

El E2E independiente verifica que la revisión mantiene referencias operativas nulas, obtiene folio distinto, conserva el contexto, copia y permite editar partidas, produce PDF nuevo y deja la cotización original emitida e inmutable. También verifica que no se fabrican entidades operativas porque la respuesta de la callable mantiene `requestId: null` y la revisión se abre sin contexto relacional.

## Seguridad y compatibilidad

No se debilitaron Firestore Rules ni Storage Rules. Las escrituras críticas permanecen en Functions. La emisión independiente existente, emisión histórica, PDF histórico, descarga histórica, corrección histórica y auditoría/paginación de Hito 3B.1 continúan pasando.

## Rollback

Revertir los commits del Hito 4 en la rama publicada y retirar la rama sin modificar `fix/mvp-h3b-1-audit-e2e-stability` ni el tag protegido. No requiere migración: los documentos creados en pruebas son sólo de Emulator Suite y la reversión de código no altera datos reales.

## Fuera de alcance

No hubo deploy, migraciones, datos reales, cambios de formato PDF, cambios de folio, aprobación previa, notificaciones externas, retiro de módulos ni edición de cotizaciones emitidas.
