# Hito 3B — Emisión, PDF y descarga de cotizaciones independientes

## 1. Resultado ejecutivo

Se implementó la emisión backend de cotizaciones independientes, la generación y almacenamiento privado de su PDF y la descarga autorizada. La ruta continúa siendo una sola callable `issueQuote`, con ramas por `requestId == null`.

## 2. Base y rama

- Base: `docs/mvp-h3a-issuance-contract`
- Commit base: `ca7b183b95df589014d70236722efa18cee78147`
- Rama: `feat/mvp-h3b-independent-issuance`
- Tag protegido conservado: `v2.1-preserved-before-mvp-restructure`

## 3. Decisión aplicada

Una cotización independiente no lee Solicitudes, Instalaciones ni Equipos. El documento usa Cliente, Empresa, partidas, totales, vigencia, referencia de servicio y contexto técnico. Una cotización histórica conserva la lectura y validación de sus relaciones existentes.

## 4. Cambios principales

- `QuoteDocumentModel` backend con snapshots de Cliente, Empresa y contexto operativo.
- `issueQuote` valida actor, cliente, partidas, totales y configuración; reserva folio, genera PDF, persiste Document, bloquea la cotización y registra auditoría/notificación.
- PDF independiente con bloque neutral de contexto operativo; PDF histórico conserva su flujo.
- `downloadQuotePdf` autoriza independientes por cliente/asignación y verifica firma, tamaño y SHA-256.
- UI habilita emisión independiente y mantiene ocultos los controles operativos históricos.
- Correcciones independientes siguen fuera de alcance; `createCorrection.ts` no fue modificado.

## 5. Seguridad y compatibilidad

La rama independiente no consulta entidades operativas. El backend rechaza referencias operativas en independientes y nunca confía en totales, folio, estado, bloqueo, documento ni Storage enviados por cliente. La rama histórica mantiene coincidencia de Solicitud–Cliente–Instalación–Equipo y la autorización del operador.

Firestore Rules y Storage Rules no cambiaron en este hito. Las pruebas existentes de Rules continúan pasando; los avisos del evaluador sobre el límite de expresiones pertenecen a reglas históricas ya existentes y no se reabrió su diseño en H3B.

## 6. Evidencia de pruebas

- Frontend: format, lint, typecheck, 26 archivos / 62 tests, build: PASA.
- Functions: lint, typecheck, 10 archivos / 33 tests, build: PASA.
- Rules y Storage: 26 pruebas Firestore + 9 pruebas Storage: PASA.
- E2E independiente: admin y operador, emisión, persistencia, preview y descarga: PASA.
- E2E histórico focalizado: emisión, descarga, transiciones y corrección: PASA.
- Seguridad callable: ataques de relación y alcance: PASA.
- `git diff --check`: PASA.

La orden `npm run validate:emulators` levantó correctamente los emuladores y pasó Rules/Storage, pero el conjunto completo conserva una falla intermitente en una aserción histórica de auditoría cuando el evento queda fuera de la primera página. El E2E histórico focalizado pasa cargando más auditoría. No se usó Firebase real.

## 7. No regresión

No se modificaron PDF histórico fuera del soporte de entrada común, descarga histórica, folios, correcciones, Storage Rules, colecciones ni datos. No hubo migraciones, deploy ni cambios en Firebase real.

## 8. Rollback

Revertir los commits de esta rama en orden inverso restaura el comportamiento anterior al Hito 3B. El commit base H3A y el tag protegido permanecen intactos.

## 9. Deuda y siguientes pasos

Permanece fuera de alcance la corrección independiente y la eventual adaptación de reglas históricas para reducir su complejidad. El siguiente hito puede endurecer idempotencia/observabilidad y definir correcciones independientes sin cambiar el contrato histórico.
