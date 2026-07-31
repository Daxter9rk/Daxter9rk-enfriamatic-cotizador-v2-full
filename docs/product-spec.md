# Especificación de producto

El contrato funcional autoritativo es
`PROMPT_MAESTRO_CODEX_ENFRIAMATIC_V2_FULL.md`.

La aplicación conserva sólo dos roles literales (`admin`, `operator`), estados
en inglés y un flujo sin aprobación previa: solicitud asignada → trabajo en
progreso → borrador → vista previa → emisión → PDF privado y cotización
bloqueada.

Las correcciones no alteran originales. Crean solicitud y cotización nuevas,
referencian el origen, aumentan la revisión y reservan un folio diferente.

Valores DEV configurables: IVA 16 %, vigencia 15 días, MXN, prefijo COT,
watermark `DOCUMENTO DE PRUEBA - DEV`, sin firma y sin límite comercial fijo de
descuento más allá del importe disponible.
