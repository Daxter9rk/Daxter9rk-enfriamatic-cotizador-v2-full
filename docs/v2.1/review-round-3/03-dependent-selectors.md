# Selectores dependientes

## Causa raíz

`SearchableSelect` inicializaba el texto visible desde `value`, pero no lo resincronizaba cuando el padre limpiaba el ID después de cambiar cliente o instalación. El ID se vaciaba y la etiqueta anterior permanecía.

## Corrección

El componente escucha el valor controlado y la etiqueta de la opción seleccionada. Cuando el padre cambia o limpia el ID, limpia también la consulta visible. Un guard local conserva únicamente el texto que el usuario está escribiendo cuando el propio buscador solicita limpiar la selección; no crea una segunda fuente persistente de verdad.

La lógica relacional existente continúa limpiando `siteId`/`equipmentId` y las reglas siguen rechazando relaciones incompatibles. La prueba dirigida confirma que `Planta anterior` desaparece al pasar `value` a vacío y retirar opciones.
