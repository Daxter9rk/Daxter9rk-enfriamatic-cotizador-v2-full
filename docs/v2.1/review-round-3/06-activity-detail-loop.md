# Cierre del detalle desde Actividad

## Causa raíz

El modal se cerraba sólo en estado local. El parámetro `quote` seguía presente y el efecto de apertura volvía a seleccionar la misma cotización.

## Corrección

La URL es la fuente de verdad del detalle. Abrir agrega `quote` conservando otros parámetros; cerrar elimina únicamente `quote` mediante navegación `replace` y limpia la selección. La misma función de cierre atiende X, backdrop y Escape a través del modal existente. La apertura usa una entrada de historial, por lo que Atrás cierra el detalle; una URL directa válida abre una vez y una inválida muestra error controlado.

La prueba de utilidad conserva `status` y `view` al abrir/cerrar. Los 12 E2E, incluido el flujo Actividad/cotización, pasaron sin reintentos ocultos después del rebuild final.
