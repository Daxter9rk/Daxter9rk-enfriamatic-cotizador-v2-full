# Reproducción y pruebas inicialmente fallidas

La revisión humana de ronda 2 reprodujo cinco defectos: creación inicial de metadata privada, etiquetas dependientes obsoletas, auditoría incompleta/poco legible, gestión incompleta de catálogos internos y reapertura del detalle de cotización al cerrarlo con el parámetro `quote` aún presente.

Se agregaron pruebas dirigidas antes de la corrección para fijar esos contratos en el commit `f831eb5`. El resultado rojo confirmó:

- `createKnownDocument is not a function`: no existía una creación por ID sin lectura previa.
- `SearchableSelect` conservaba `Planta anterior` después de limpiar el valor controlado.
- no existían los módulos centrales `auditPresentation` y `domainEvent`.
- `/catalogs` exponía `priority`, `high` y `active`, sin acciones de edición/estado.
- no existía una normalización única para cerrar `?quote=...` conservando otros parámetros.

Pruebas rojas creadas: `src/services/firebase/data.test.ts`, `src/components/SearchableSelect.test.tsx`, `src/utils/auditPresentation.test.ts`, `src/features/catalogs/CatalogsPage.test.tsx`, `src/utils/detailNavigation.test.ts` y `functions/src/audit/domainEvent.test.ts`. Todas pasan después de las correcciones.
