# Auditoría global

## Emisión

- Se añadió un contrato central con `eventCode`, `sourceEventId`, timestamps, snapshots del actor/rol/recurso, resultado, motivo, cambios, ruta y versión de esquema.
- El ID de `auditLogs` es SHA-256 determinista de evento fuente + código. Los reintentos de triggers sobrescriben el mismo documento.
- `syncEquipmentIntervention` actualiza el expediente y crea `equipment.intervention_created` en un batch.
- `transitionQuote` escribe `quote.rejected` y las demás transiciones comerciales dentro de la misma transacción, con motivo e historial local. El trigger genérico omite esas transiciones para evitar duplicados.
- El trigger genérico también usa el ID de evento Firestore y snapshots legibles.

## Presentación

Un diccionario central traduce acciones, filtros, recursos y roles. La tarjeta principal muestra nombre, rol, recurso y motivo; el UID y código técnico quedan dentro de `Detalles técnicos`. Las rutas internas se validan antes de mostrarse.

## Datos anteriores

No se ejecutó backfill. La intervención y el rechazo existentes se conservaron sin modificación; los eventos globales enriquecidos se garantizan para acciones nuevas. Esta opción evita inferir actores o claves idempotentes históricas sin una fuente verificable.
