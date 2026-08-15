# Causas raíz

## Archivos privados y catálogo

La operación distribuida Firestore → Storage → Firestore carecía de una máquina de etapas y compensación. Storage y Firestore además denegaban toda eliminación, por lo que un objeto subido no podía limpiarse si fallaba la transición a `ready`. La UI mostraba `error.message`, mezclando validación, permiso y persistencia.

## Reautenticación

El flujo construía siempre una credencial de correo/contraseña sin comprobar `providerData`. El `catch` descartaba `FirebaseError.code`, por lo que contraseña incorrecta, proveedor incompatible, sesión expirada y un fallo de escritura posterior parecían el mismo HTTP 400.

## Solicitudes

El formulario trataba clientes, instalaciones y equipos como listas independientes. La regla validaba tipos, pero no existencia, estado ni pertenencia. La asignación backend sí validaba el UID, aunque no distinguía asignación inicial de reasignación para exigir motivo.

## Cotización rechazada y notificaciones

La transición comercial reemplazaba un único objeto `commercialTransition`; no mantenía eventos acumulativos ni campos de lectura rápida. El centro de notificaciones separaba marcar y navegar, y su etiqueta de acción no indicaba el recurso.

## Experiencia transversal

Filtros, auditoría, preview y soporte evolucionaron localmente sin componentes o presentadores comunes. Esto produjo opciones incompletas y lenguaje técnico expuesto al usuario operativo.
