# Hito 5B — Simplificación de Dashboard y navegación

## Contexto y base

- Rama: `feat/mvp-h5b-dashboard-simplification`
- Base: `feat/mvp-h5-final-closure`
- Commit base: `6e71e260c5e0b914b9198875e65f28c90fc14c4c`
- Tags protegidos verificados: `v2.1-preserved-before-mvp-restructure` y `v2.1-mvp-core-complete`.

## Inventario previo

Antes del cambio, `DashboardPage` consultaba `requests`, `quotes` y `users`. Mostraba métricas y enlaces de Solicitudes, Instalaciones, Equipos y actividad de operadores, además de acciones hacia módulos retirados. La navegación lateral ya había sido reducida por Hito 5A, pero el Dashboard conservaba el contrato visual anterior.

## Decisión

El Dashboard final del MVP sólo presenta acciones y actividad comercial: Cotizaciones, Clientes, Catálogo comercial, perfil/ayuda y cotizaciones recientes. No hace consultas, enlaces ni métricas para Solicitudes, Instalaciones, Equipos, Actividad global ni catálogos internos.

La única consulta del panel es una muestra acotada de 20 cotizaciones, ordenada por `updatedAt`; el operador la limita a sus asignaciones. Los indicadores se etiquetan explícitamente como recientes y no se presentan como totales históricos.

## Cambios

- Eliminadas las lecturas de `requests` y `users` del Dashboard.
- Eliminados enlaces y acciones a rutas retiradas.
- Conservadas las acciones de nueva cotización, cotizaciones, clientes, catálogo comercial y soporte.
- Conservado el alertado de documentos con fallo, limitado a la muestra reciente.
- Añadida restricción `newestUpdated` para reutilizar el índice vigente de cotizaciones.
- Actualizada la prueba responsive para la nueva acción principal.
- Añadidas pruebas unitarias del Dashboard y E2E admin/operador.

## Compatibilidad y límites

No se modificaron datos, colecciones, Functions, Firestore Rules, Storage Rules, emisión, PDF, descarga, folios ni correcciones. Las rutas retiradas siguen protegidas por los guards de Hito 5A; no se reintroducen en la interfaz activa.

## Evidencia

La evidencia detallada de comandos y resultados se completa en el informe de cierre de esta rama. La suite `npm run validate:emulators` debe ejecutarse dos veces consecutivas antes de publicar.

## Rollback

El rollback consiste en revertir los commits de Hito 5B o volver a `feat/mvp/h5-final-closure`; no requiere migración ni cambios en Firebase real.

## Siguientes pasos

Mantener el Dashboard comercial como superficie del MVP y tratar cualquier retiro adicional como cambio explícito de alcance, sin reactivar consultas o enlaces a módulos fuera de alcance.
