# Seguridad y riesgos

## Controles implementados

- Default deny en Firestore y Storage.
- Perfil activo y rol válido en toda operación.
- Sin escritura cliente en usuarios, documentos, auditoría, contadores o PDF.
- Validadores de esquema tanto en create como update.
- Timestamps, ownership, campos inmutables, tamaños y rangos.
- Transiciones de solicitud explícitas.
- Cotización emitida inmutable.
- Folio transaccional e idempotencia por intento.
- PDF con hash SHA-256, firma `%PDF-`, límite 12 MiB y bucket privado.
- Auditoría append-only y mensajes de error sanitizados.
- Relaciones `quote → request → client/site/equipment` verificadas tanto por
  Rules como por los callables antes de que Admin SDK lea datos o genere un PDF.
- Metadatos de emisión y corrección iniciales reservados al backend.
- Lectura de `settings` limitada a IDs conocidos.

## Riesgos residuales

1. `operatorIds` conserva acceso histórico a maestros después de reasignar. Es
   deliberado para reconstruir historial; una política de revocación requerirá
   contar todas las solicitudes vigentes antes de retirar acceso.
2. App Check no tiene enforcement en DEV por contrato.
3. Los callables devuelven PDF en Base64; el límite reduce abuso, pero para
   documentos futuros mayores conviene streaming autenticado.
4. Rules son un prototipo sólido y probado contra los accesos actuales, pero
   deben revisarse de nuevo al agregar consultas o campos.
5. PDFKit incorpora `jpeg-exif` transitivamente, paquete sin soporte. La ruta
   usada sólo procesa logos oficiales versionados, no imágenes aportadas por
   usuarios; se mantiene documentado hasta sustituir el generador o eliminar esa
   dependencia.
6. Rules limita cada partida por esquema, tipos y tamaños, y la emisión procesa
   como máximo 100; no puede imponer por sí sola un conteo total de documentos
   en la subcolección. Un usuario autorizado podría crear partidas adicionales y
   consumir cuota. Antes de exposición amplia conviene App Check, alertas de
   presupuesto y, si se requiere límite estricto, mutación transaccional vía
   Function con contador.
7. El árbol compatible de `firebase-admin` conserva siete avisos moderados por
   `uuid < 11.1.1` dentro de `gaxios`/`teeny-request`; esas rutas generan UUID v4
   internos y no reciben buffers ni parámetros del usuario, por lo que no
   alcanzan la operación v3/v5/v6 descrita por GHSA-w5hq-g745-h8pq. `audit:all`
   falla ante severidad alta o crítica. No se fuerzan majors incompatibles para
   ocultar este aviso; debe retirarse cuando Google Cloud Storage actualice sus
   dependencias.

## Ataques revisados

- lectura pública, listados sin límite y PII cruzada;
- escalación de rol y perfil propio;
- bypass create/update, schema pollution y strings grandes;
- modificación de campos inmutables y ownership;
- saltos de estado y edición de cotización issued;
- escritura/lectura directa de PDF;
- replay/doble emisión y folio duplicado;
- rutas de Storage no previstas.
- IDs conocidos y relaciones cruzadas entre solicitud, cotización, maestros y
  callables con Admin SDK;
- perfiles inactivos, ausentes y rol `reader` no soportado;
- metadatos de emisión/corrección forjados y settings con IDs desconocidos.

Consulte también `docs/security-rules-audit.json`, generado tras las pruebas.
