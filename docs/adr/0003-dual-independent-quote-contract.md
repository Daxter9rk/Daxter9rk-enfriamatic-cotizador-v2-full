# ADR 0003: Contrato dual para cotizaciones independientes

## Estado

Aceptado para el Hito 2.

## Decisión

`Quote` soporta dos modalidades en el mismo agregado:

- histórica: `requestId`, `siteId` y la asignación conservan la trazabilidad de la solicitud;
- independiente: `requestId`, `siteId` y `equipmentId` son `null`, el cliente es obligatorio y la referencia de servicio y el contexto técnico son opcionales.

Los borradores independientes se crean y editan desde la aplicación, permanecen en `draft`/`not_generated` y no pueden invocar la emisión. La emisión histórica continúa usando las Functions existentes y no se modifica su contrato.

## Autorización

Las reglas conservan la rama histórica y agregan una rama independiente: administradores pueden crear; operadores solo pueden crear cuando el cliente está en su ACL. La rama independiente comprueba directamente las tres referencias nulas y no consulta Solicitud, Instalación ni Equipo. La aplicación y la UI impiden agregar relaciones posteriormente; la normalización conserva referencias históricas durante la lectura.

## Consecuencias

El flujo de cotización ya no depende de una solicitud para guardar o revisar un borrador. La emisión independiente queda explícitamente fuera del alcance del Hito 2 y deberá definirse junto con folio, documento y reglas de negocio en un hito posterior.
