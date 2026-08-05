# V2.1 — decisiones iniciales

1. Conservar contratos persistidos y agregar sólo campos/colecciones opcionales.
2. Usar Functions transaccionales para rol, estado, administrador principal, finalización y reapertura.
3. Mantener sólo `admin` y `operator`; las etiquetas visibles serán Administrador y Operador.
4. Implementar actividad reciente, no presencia exacta; ventana de cinco minutos y actualización con throttling.
5. Usar enlaces codificados de Google Maps, sin API key ni mapa de pago.
6. Almacenar archivos privados bajo rutas tipadas y autorizar mediante Firestore + Storage Rules; no exponer URLs permanentes.
7. Mantener cotizaciones emitidas inmutables y correcciones con nuevo folio.
8. Tratar los mockups como sistema visual de referencia: navy, azul de acción, tarjetas claras, mobile first.
9. Usar `Borrador sin solicitud vinculada` sólo cuando el modelo pruebe ausencia de solicitud; en el contrato actual toda cotización exige `requestId`, por lo que la etiqueta será `Borrador`.
10. No desplegar backend sin pruebas y rollback; Hosting se limitará a canal preview.
