# Pruebas fallidas antes de la corrección

Se agregaron contratos antes de implementar el backend y de retirar la navegación técnica.

## Functions

```text
npm.cmd --prefix functions test -- --run src/catalog/imageValidation.test.ts src/catalog/imageWorkflow.test.ts
```

Resultado inicial esperado: 2 suites fallidas. No existían `imageValidation` ni `imageWorkflow`, y `sharp` aún no estaba instalado. Los contratos cubren JPEG/PNG/WebP, MIME falso, contenido truncado, límite real de 5 MB, compensación, cleanup pendiente e idempotencia.

## Frontend

```text
npm.cmd test -- --run src/features/commercial-catalog/CommercialCatalogPage.test.tsx src/layouts/AppShell.test.tsx src/utils/auditPresentation.test.ts
```

Resultado inicial: 5 fallos. La vista todavía llamaba `getBlob` directamente, no existían los controles Agregar/Cambiar/Eliminar, `Catálogos internos` seguía visible y los eventos de imagen no tenían traducción.

Estos fallos reproducen los contratos que debe satisfacer la corrección; no son fallos preexistentes ocultados.
