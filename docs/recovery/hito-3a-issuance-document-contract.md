# Hito 3A — Contrato de emisión y documento

## Resultado

Hito 3A define el contrato técnico y funcional para habilitar, en un hito
posterior, la emisión documental de cotizaciones independientes. Este cambio
es exclusivamente documental: no modifica Functions, UI, Rules, Storage,
datos ni Firebase real.

## Rama y base

- Rama: `docs/mvp-h3a-issuance-contract`
- Base: `fix/mvp-h2-1-rules-e2e`
- Commit base: `acbffd340b1c3b871d53188b1310cf63df18e6c0`
- Tag protegido verificado: `v2.1-preserved-before-mvp-restructure`

## Inventario del flujo actual

La inspección de la implementación existente encontró lo siguiente:

1. `QuoteEditor` genera una clave UUID y llama a `issueQuote`, pero retorna
   temprano cuando `quote.requestId` es nulo. La descarga y la corrección
   también se invocan como callables desde el editor.
2. `issueQuote` valida `quoteId` e `idempotencyKey`, lee la cotización y crea
   `quotes/{quoteId}/issuanceAttempts/{idempotencyKey}`. Su reserva transaccional
   lee obligatoriamente `requests/{requestId}`, compara Cliente, Instalación,
   Equipo y asignación, reserva el contador anual, cambia el documento a
   `generating` y crea `documents/{quoteId}`.
3. La fase de generación vuelve a leer Cliente, Solicitud, Sitio, settings de
   cotización, perfil empresarial, partidas y administradores; lee Equipo si
   existe. Recalcula totales, genera PDF, calcula SHA-256, escribe Storage y
   finaliza la cotización como `issued`, `ready` y `locked`.
4. El final de emisión escribe auditoría `quote.issued` y notificaciones para
   administradores. Ante error, deja la cotización en `draft/failed`, marca el
   documento y el intento como fallidos y registra `quote.issue_failed`.
5. `downloadQuotePdf` exige `issued/ready`, revalida la coincidencia con
   Solicitud y devuelve bytes base64 después de comprobar ruta, tamaño y firma
   `%PDF-`. Storage no permite acceso directo a documentos de cotización.
6. `createCorrection` sólo acepta estados comerciales emitidos, lee la
   Solicitud original, reserva otro folio y crea una nueva Solicitud y una
   nueva cotización histórica.
7. `pdf.ts` recibe `siteName` y `siteAddress` como datos obligatorios del
   renderer y muestra el bloque “INSTALACIÓN / EQUIPO”. Esa interfaz no puede
   consumirse sin adaptar el modelo para el caso independiente.

## Dependencias operativas

La cotización vigente contiene `clientId`, referencias opcionales a Solicitud,
Instalación y Equipo, asignación, contexto textual, partidas con snapshot,
totales, vigencia, folio, estados documentales y auditoría. Cliente aporta
nombre, razón social, RFC y domicilio de facturación cuando existen. La
empresa y defaults provienen de `settings/companyProfile` y
`settings/quoteDefaults`; los defaults actuales incluyen prefijo de folio,
tasa, vigencia, forma de pago, garantía, exclusiones, texto legal y marca de
desarrollo.

La ruta histórica usa además `Request`, `Site` y opcionalmente `Equipment` para
componer el documento. La ruta independiente no tiene esos recursos y debe
usar `serviceReference` y `technicalContext` como contexto operativo.

## Contrato de emisión independiente

Una cotización es independiente únicamente si `requestId == null`. En ese caso
el backend debe exigir:

- Cliente existente, activo y autorizado para el actor;
- `siteId == null` y `equipmentId == null`;
- estado `draft`, desbloqueada y con al menos una partida válida;
- `documentStatus == not_generated` o un fallo reintentable definido por Hito
  3B;
- totales recalculados desde partidas, no confiados al cliente;
- `folio` vacío antes de la primera reserva, salvo un intento idempotente ya
  registrado;
- texto normalizado y dentro de límites;
- asignación válida según rol y política vigente.

La cotización histórica (`requestId != null`) conserva las comprobaciones
actuales de Solicitud, Cliente, Instalación, Equipo y asignación. No se deben
inventar relaciones para independientes ni borrar referencias históricas.

## Snapshot de Cliente

Antes de generar, Functions lee el Cliente autorizado y captura en el modelo
documental, como valores de emisión, el identificador, nombre, razón social,
RFC y los datos legales o de contacto que el documento requiera. La captura es
inmutable para esa emisión; cambios posteriores del Cliente no reescriben el
PDF listo. Si faltan datos opcionales, se omiten sin imprimir etiquetas vacías.

## Snapshot empresarial

Functions lee `settings/companyProfile` y `settings/quoteDefaults` con la misma
autoridad backend. El snapshot debe incluir al menos razón social/RFC,
domicilio, teléfono, correo, texto legal, prefijo, moneda, tasa, vigencia,
forma de pago, garantía, exclusiones y watermark configurados. La emisión
registra la versión lógica disponible en ese momento; no se requiere una nueva
colección para guardar configuración histórica en Hito 3A.

## QuoteDocumentModel propuesto

El modelo intermedio será un contrato interno de Functions, no un documento
Firestore público:

```text
QuoteDocumentModel
  quote: { quoteId, folio, issuedAt, currency, validityDays }
  modality: independent | historical
  client: { clientId, name, legalName?, rfc?, billingAddress? }
  context: { serviceReference?, technicalContext?, notes? }
  operation: { requestId?, siteName?, siteAddress?, equipmentName? }
  company: { companyName, rfc, address, phone, email, legalText }
  commercial: { taxRate, discountDisplayMode, paymentMethod?, warranty?, exclusions? }
  items: persisted quote-item snapshots with validated calculations
  totals: { subtotalOriginal, discountTotal, subtotalFinal, taxTotal, grandTotal }
```

En la modalidad independiente, `operation.requestId`, `siteName`,
`siteAddress` y `equipmentName` son ausentes o nulos; no son IDs con nombres
inventados. En la histórica se conservan los datos actuales y sus validaciones.

## Estados y transiciones

La secuencia documental objetivo es:

| Estado de cotización | Estado de documento | Significado                                           |
| -------------------- | ------------------- | ----------------------------------------------------- |
| `draft`              | `not_generated`     | editable y aún no reservado                           |
| `draft`              | `generating`        | reserva/idempotencia en curso                         |
| `issued`             | `ready`             | PDF persistido, hash y metadata listos; `locked=true` |
| `draft`              | `failed`            | fallo controlado; sin emisión final                   |

Una repetición idempotente de una emisión lista devuelve el mismo folio y
documento. Los estados comerciales posteriores (`sent`, `accepted`,
`rejected`, `cancelled`) siguen requiriendo documento listo y conservan la
política histórica.

## Autorización y responsabilidades

Functions autoriza actor activo, modalidad, Cliente, asignación, partidas,
estado, totales y lectura de configuración. Rules mantiene mínimo privilegio:
deniega escrituras directas de `documents`, `counters`, `issuanceAttempts` y
Storage de documentos; permite lectura sólo según el perfil y la cotización.
No debe duplicar la cadena completa de generación ni consultar Solicitud,
Instalación o Equipo en la rama independiente.

El frontend sólo solicita la operación y presenta el resultado. Nunca decide
folio, `issuedAt`, hash, `documentStatus`, `locked`, `issuedBy`, `validUntil` ni
el contenido definitivo del PDF.

## Folios e idempotencia

El contador anual `counters/quotes-{year}` continúa protegido y se incrementa
en transacción. `formatFolio` sigue siendo el único formateador. La clave UUID
del request identifica el intento anidado bajo la cotización. La respuesta
idempotente debe ser estable para el mismo intento; una solicitud nueva no
puede saltarse la validación ni reutilizar silenciosamente un folio de otro
intento.

Si la generación falla después de reservar, el folio no se libera ni se
reutiliza automáticamente. Se registra el fallo, se conserva trazabilidad y
el retry queda sujeto a una política explícita de Hito 3B.

## PDF

El renderer debe aceptar contexto operativo opcional y tener una presentación
válida sin Instalación/Equipo. Debe incluir Cliente, referencia de servicio,
contexto técnico, partidas, descuentos, totales, vigencia y datos empresariales
cuando existan. Se mantienen firma `%PDF-`, límite de tamaño, hash SHA-256,
paginación, moneda MXN y watermark actuales.

## Storage y Documents

Se conserva `documents/{quoteId}` como metadata privada y la ruta
`quotes/{quoteId}/documents/{documentId}.pdf`. La callable usa Admin SDK para
escribir; `storage.rules` continúa denegando acceso directo. Metadata mínima:
tipo, estado, ruta, nombre, MIME, tamaño, hash, páginas, timestamps, actor de
generación, intento y versión de esquema.

## Descarga

La descarga independiente valida actor activo, cotización `issued`, documento
`ready`, coincidencia `quoteId`, ruta privada, tamaño, MIME/firma y permisos de
Cliente/asignación. No consulta Solicitud, Sitio ni Equipo. La histórica
mantiene la revalidación actual contra Solicitud y la asignación histórica.

## Auditoría, notificaciones y eventos

Se conserva el evento explícito `quote.issued`, añadiendo modalidad y datos del
documento al metadata seguro. Los fallos usan `quote.issue_failed` sin filtrar
errores internos. La notificación de emisión mantiene destinatarios y acceso
actuales. No se agrega un bus: la transacción y los triggers de auditoría
existentes son suficientes.

## Errores y rollback lógico

Errores esperados deben mapearse a `not-found`, `permission-denied`,
`failed-precondition`, `already-exists` o `resource-exhausted` según la etapa.
Errores internos deben devolver un mensaje seguro y registrar etapa, código
sanitizado, duración e intento. No existe rollback físico de un folio ya
reservado; el rollback lógico deja el borrador editable, documento fallido y
auditoría del intento.

## Compatibilidad histórica

La rama histórica no cambia: sigue leyendo Solicitud, comparando Cliente,
Instalación y Equipo, genera el mismo formato funcional, descarga con la misma
autorización y crea correcciones mediante Solicitud. La separación se hace
antes de las lecturas operativas, usando `requestId` como discriminador.

## Impacto en correcciones

No se modifica `createCorrection` en Hito 3A. En Hito 3B, una corrección
independiente debe conservar `originalQuoteId`, no crear una Solicitud
artificial y usar el mismo contrato independiente, sujeto a una decisión
explícita sobre asignación y folio.

## Casos de uso propuestos para Hito 3B

- `issueIndependentQuote(quoteId, idempotencyKey)` o una única callable con
  rama interna por modalidad;
- `buildQuoteDocumentModel(quote, items, client, settings, historicalContext?)`;
- `reserveQuoteIssuance` y `finalizeQuoteDocument` transaccionales;
- `downloadQuotePdf` con autorización independiente/histórica separada;
- adaptación de corrección independiente sin fabricar Solicitud.

La recomendación es mantener una única callable pública `issueQuote`, porque
preserva el contrato de frontend y centraliza idempotencia; la separación debe
ser interna y explícita, no una segunda colección ni un bypass.

## Matriz de pruebas para Hito 3B

| Área       | Independiente                                        | Histórica                  | Seguridad/fallo                           |
| ---------- | ---------------------------------------------------- | -------------------------- | ----------------------------------------- |
| emisión    | Cliente + contexto + partidas produce `issued/ready` | flujo actual sin cambios   | sin Cliente, partida o asignación rechaza |
| lecturas   | no lee Request/Site/Equipment                        | conserva coincidencias     | no permite referencias inventadas         |
| documento  | PDF sin etiquetas operativas vacías                  | PDF con contexto histórico | firma, hash, tamaño y MIME                |
| folio      | reserva única e idempotente                          | reserva actual             | agotamiento y concurrencia                |
| descarga   | autorización sin Solicitud                           | autorización histórica     | ruta cruzada y documento no listo         |
| fallo      | `draft/failed`, retry explícito                      | mismo rollback lógico      | auditoría sin secretos                    |
| comercial  | transiciones sólo con PDF listo                      | regresión completa         | Rules y callable sin bypass               |
| corrección | no crea Request artificial                           | conserva corrección actual | origen y asignación verificables          |

## Plan Hito 3B

1. Extraer el modelo documental interno y las lecturas por modalidad.
2. Adaptar el PDF a contexto operativo opcional y validar snapshots.
3. Implementar la rama independiente dentro de la callable existente.
4. Adaptar descarga, metadata, auditoría e idempotencia.
5. Diseñar corrección independiente con decisión de negocio documentada.
6. Añadir pruebas unitarias, Functions, Rules, Storage, E2E independiente y
   regresión histórica completa.
7. Ejecutar validación integral en Emulator Suite; no desplegar hasta cerrar
   la evidencia.

## Rollback

Como Hito 3A sólo añade documentación, el rollback consiste en revertir sus
dos commits documentales o eliminar la rama sin tocar `fix/mvp-h2-1-rules-e2e`
ni el tag protegido. Hito 3B deberá conservar feature flag o reversión de
backend antes de activar emisión independiente en frontend.

## Validación de Hito 3A

Se ejecutarán las suites estáticas y de pruebas del frontend y Functions. La
validación de Emulator Suite no es necesaria para este hito porque no hay
cambios funcionales; queda registrada como:

`NO EJECUTADO: MISIÓN DOCUMENTAL SIN CAMBIOS FUNCIONALES`

No se hicieron deploys, escrituras en Firebase real, migraciones ni cambios en
Rules, Storage, emisión, PDF, descarga, folios o correcciones.
