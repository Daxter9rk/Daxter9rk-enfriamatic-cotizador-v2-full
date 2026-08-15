# Limitaciones conocidas del MVP V2.1

- Functions conserva cuatro warnings `no-explicit-any` preexistentes en `createCorrection.ts`.
- Algunas búsquedas son locales a la página cargada y no búsquedas globales.
- Soporte sólo valida y simula; no envía correos ni crea tickets.
- Los manuales PDF históricos permanecen preservados, pero no son el manual activo de la interfaz.
- Vite informa un warning de tamaño de chunk; el build continúa correctamente.
- No existe aprobación de producción: este tag es sólo un release candidate para revisión DEV.
