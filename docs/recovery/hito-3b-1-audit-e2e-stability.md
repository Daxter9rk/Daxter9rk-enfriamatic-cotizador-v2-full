# Hito 3B.1 — Estabilización de auditoría y E2E histórico

## Resultado

Se corrigió la inestabilidad del E2E histórico causada por la consulta de `auditLogs`. La Actividad ahora usa un orden total (`createdAt` descendente y `documentId` descendente) y paginación real con cursor. No se modificaron emisión, PDF, descarga, correcciones, Rules, Storage ni Firebase real.

## Base y rama

- Rama base: `feat/mvp-h3b-independent-issuance`
- Commit base verificado: `c83f2b6a5e26593cdf0cf9e5c9f9d7e35e33f4a0`
- Rama de trabajo: `fix/mvp-h3b-1-audit-e2e-stability`
- Tag protegido conservado: `v2.1-preserved-before-mvp-restructure`

## Reproducción y causa

Antes del cambio, `ActivityPage` consultaba `auditLogs` con `limit()` sin `orderBy` ni cursor. El cliente ordenaba sólo por `createdAt` y “Cargar más” volvía a pedir los primeros N documentos. Cuando varios eventos tenían timestamps iguales o el orden de documentos variaba, el E2E histórico no encontraba de forma determinista el evento de envío o corrección en la primera página.

La causa se clasificó como `QUERY + PAGINATION + CURSOR + EXPECTATION`. No fue un fallo de emisión, auditoría de Functions, Rules ni del flujo de negocio. La hipótesis de una espera insuficiente fue descartada porque el evento faltante cambiaba entre corridas.

## Decisión y corrección

La consulta compartida `listAuditLogs` ahora:

1. ordena por `createdAt desc`;
2. desempata por `documentId desc`;
3. devuelve un cursor compuesto por ambos valores;
4. usa `startAfter(createdAt, documentId)` para páginas posteriores;
5. informa `hasMore` sin reconsultar el prefijo anterior.

`useAuditCollection` encapsula carga inicial, recarga y paginación. `ActivityPage` conserva el alcance por operador, aplica un orden total en la presentación y ya no depende de un límite creciente. No fue necesario modificar `firestore.indexes.json`; las tres corridas completas del emulador confirmaron que la consulta es válida.

## Pruebas y evidencia

- `npm run format:check`: PASA.
- `npm run lint`: PASA.
- `npm run typecheck`: PASA.
- `npm test`: PASA, 26 archivos y 62 pruebas.
- `npm run build`: PASA.
- `npm --prefix functions run lint`: PASA.
- `npm --prefix functions run typecheck`: PASA.
- `npm --prefix functions test`: PASA, 10 archivos y 33 pruebas.
- `npm --prefix functions run build`: PASA.
- E2E histórico aislado: PASA, 1 prueba.
- `npm run validate:emulators`, corrida 1: PASA, 17 E2E.
- `npm run validate:emulators`, corrida 2: PASA, 17 E2E.
- `npm run validate:emulators`, corrida 3: PASA, 17 E2E.

La prueba histórica se ejecutó sin el workaround que ampliaba artificialmente la primera página. El flujo confirmó catálogo, cotización, emisión histórica, PDF, descarga, transición a aceptada, corrección y eventos de Actividad.

## Compatibilidad y alcance

Se conserva el filtro histórico por operador y no se alteran los documentos de auditoría. Se mantienen los flujos de cotizaciones independientes e históricas. Las Rules y Storage Rules permanecen sin cambios. No se hizo migración, deploy ni escritura contra Firebase real.

## Rollback

El rollback consiste en revertir los commits de este hito en la rama publicada. El commit base y el tag protegido no se reescriben. La reversión no requiere migración de datos porque sólo cambia la consulta y la interacción de paginación.

## Deuda restante y siguientes pasos

No queda deuda de estabilidad para el problema auditado. La adaptación futura de correcciones independientes, si se aprueba, permanece fuera de este hito. El siguiente paso funcional puede continuar con la evolución planificada de emisión, PDF y descarga independientes, conservando este contrato de auditoría estable.
