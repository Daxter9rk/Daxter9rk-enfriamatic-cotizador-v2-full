# Catálogos internos

- Encabezado unificado como `Catálogos internos`.
- Diccionarios visibles en español para tipos, prioridades y estados; los códigos Firestore no se migraron.
- Administradores pueden crear, editar nombre/valor, desactivar y volver a activar. No existe eliminación física.
- Operadores tienen acceso de lectura y no reciben botones administrativos.
- La UI rechaza duplicados normalizados por tipo/valor.
- Firestore mantiene esquema estricto, congela `type` durante update, permite lectura a usuarios activos y reserva toda mutación a administradores.
- El trigger global existente audita `catalogs.created` y `catalogs.updated` con presentación traducida.

Pasaron las pruebas de interfaz por rol y las reglas de crear/editar/desactivar/activar, cambio de tipo denegado y eliminación denegada.
