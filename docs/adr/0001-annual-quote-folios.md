# ADR 0001: folios anuales transaccionales

Estado: aceptado.

Se usa `counters/quotes-{year}` dentro de una transacción Admin SDK. El formato
configurable es `COT-AAAA-000001`. El folio se reserva al iniciar emisión y se
conserva si PDF falla; una corrección lo reserva al crearse. El documento
`issuanceAttempts/{uuid}` y `issuanceKey` impiden que reintentos concurrentes
generen dos documentos.

Se rechazó generar folios en navegador porque no garantiza unicidad,
monotonicidad ni autorización.
