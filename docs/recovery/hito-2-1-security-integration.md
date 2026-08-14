# Hito 2.1 — Cierre de seguridad e integración

## Rama y base

- Rama: `fix/mvp-h2-1-rules-e2e`
- Commit base: `49cdb8df5ff897fc3574d5fa5632e46aa37ecace` (`feat(quotes): implement independent quote drafts`)
- Tag preservado: `v2.1-preserved-before-mvp-restructure`

## Problema y decisión

La autorización independiente podía conservar IDs operativos y la suite no cubría el recorrido real de alta, edición, preview, recarga y bloqueo de emisión. El contrato final define una cotización independiente por `requestId == null` y obliga `siteId == null` y `equipmentId == null`. El contexto operativo se captura en `serviceReference` y `technicalContext`.

## Rules antes y después

Antes, la rama independiente autorizaba el cliente y la asignación, pero no hacía explícita la nulidad de instalación/equipo; además, una validación amplia provocaba el límite práctico de 1000 expresiones. Después, la rama independiente comprueba directamente las tres referencias nulas, mantiene autenticación, usuario activo, ACL del cliente, estado inicial, auditoría y asignación, y no consulta Solicitud, Instalación ni Equipo. La rama histórica conserva `quoteMatchesRequest` y sus consultas relacionales.

## Cambios y pruebas

Se ajustaron creación, actualización, normalización y UI. Las relaciones quedan inmutables en edición. La normalización conserva referencias inesperadas al leer documentos históricos y la aplicación no persiste `undefined`.

La cobertura incluye dominio/application, componentes, Rules y E2E. El E2E integral independiente cubre admin y operador en Emulator Suite: cliente obligatorio, ausencia de selectores operativos, contexto, asignación, guardado, partida, preview, bloqueo de emisión y persistencia tras recarga. El E2E histórico existente se conserva.

## No regresión y resultados

Rules y Storage se ejecutan contra emuladores; Functions, frontend y build se validan sin Firebase real. No se modificaron emisión, PDF, descarga, correcciones, folios, Storage Rules ni datos reales. La validación integral debe reportarse con el resultado exacto de cada suite.

## Rollback

El rollback es reversible eliminando la rama H2.1 o revirtiendo sus commits nuevos; no requiere migración ni escritura de datos. El commit base y el tag protegido no se reescriben.

## Siguientes pasos

El siguiente hito puede definir el contrato de emisión independiente y adaptar folio, PDF y descarga. Instalaciones, Equipos y Solicitudes permanecen compatibles para registros históricos.
