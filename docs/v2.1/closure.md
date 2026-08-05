# V2.1 — cierre provisional

## Veredicto

**LISTO PARA REVISIÓN HUMANA**, sujeto a que el usuario valide el preview y a publicar la rama/PR cuando se renueve la autenticación de GitHub si el push actual no dispone de credenciales válidas.

## Estado

- Rama: `refactor/v2.1-operational-redesign`.
- Base preservada: `v2.0.0-dev.1` → `c4b94ff60cac9799fe91754b7aa104b010998d54`.
- Firebase DEV: `enfriamatic-cotizador-de-420e5`.
- Backend DEV: Rules, Storage Rules y Functions V2.1 desplegados.
- Hosting: sólo canal preview temporal; `live` sin cambios.
- Índices: sin cambios ni despliegue.
- Datos: sin borrados ni migración destructiva.

## Entrega funcional

- Shell mobile-first, navegación agrupada, textos visibles en español y notificaciones accionables.
- Dashboard accionable, actualización manual y actividad reciente con ventana de cinco minutos y throttling.
- Administrador principal, reautenticación real, políticas transaccionales y auditoría.
- Detalles conectados de clientes, instalaciones y equipos; archivos privados e intervenciones técnicas.
- Solicitudes con asignación, stepper, finalización, cancelación y reapertura controlada.
- Cotizaciones con vistas, filtros, inmutabilidad y corrección por nuevo folio.
- PDF corregido con paginación estable y marca de agua DEV.
- Catálogo producto/servicio con imagen opcional privada.
- Actividad paginada/filtrada con actor y rol legibles.
- Configuración en lectura por defecto, manuales por perfil y soporte básico.

## Riesgos residuales

- Crítico: ninguno conocido.
- Alto: ninguno conocido; auditoría npm sin hallazgos altos/críticos.
- Medio: siete avisos transitivos moderados de `uuid` en la cadena de Functions; no existe corrección automática compatible. El bootstrap inicial del administrador principal debe ejecutarse y verificarse una sola vez con una cuenta autorizada si DEV aún no contiene `isPrimaryAdmin`.
- Bajo: advertencia de tamaño del chunk Firebase; actividad reciente no equivale a presencia exacta; la captura `fullPage` móvil muestra la barra fija sobre el punto de scroll, aunque el contenido dispone de espacio inferior y las pruebas de viewport no detectan desbordamiento.

## Decisiones pendientes

- Revisión humana del preview.
- Renovar autenticación de GitHub sólo si el push/PR no puede realizarse con las credenciales Git existentes.
