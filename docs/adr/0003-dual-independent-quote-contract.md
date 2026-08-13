# ADR 0003: Contrato dual para cotizaciones independientes

## Estado

Aceptado para el Hito 2.

## Decisión

`Quote` soporta dos modalidades en el mismo agregado:

- histórica: `requestId`, `siteId` y la asignación conservan la trazabilidad de la solicitud;
- independiente: `requestId` es `null`, el cliente es obligatorio y la instalación, el equipo, la referencia de servicio y el contexto técnico son opcionales.

Los borradores independientes se crean y editan desde la aplicación, permanecen en `draft`/`not_generated` y no pueden invocar la emisión. La emisión histórica continúa usando las Functions existentes y no se modifica su contrato.

## Autorización

Las reglas conservan la rama histórica y agregan una rama independiente: administradores pueden crear; operadores solo pueden crear cuando el cliente está en su ACL. La aplicación limita instalación y equipo a la selección del cliente; la validación del registro histórico no incorpora los nuevos campos para conservar el margen del evaluador de reglas y la rama independiente mantiene una validación compacta por el límite de expresiones del emulador.

## Consecuencias

El flujo de cotización ya no depende de una solicitud para guardar o revisar un borrador. La emisión independiente queda explícitamente fuera del alcance del Hito 2 y deberá definirse junto con folio, documento y reglas de negocio en un hito posterior.
