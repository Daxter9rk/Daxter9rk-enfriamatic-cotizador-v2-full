# Archivos privados

## Causa raíz

`setKnownDocument` ejecutaba `getDoc` antes de crear metadata con ID reservado. Las reglas de lectura dependen de `resource.data`, por lo que la primera carga fallaba correctamente sobre un documento inexistente.

## Corrección

- `createKnownDocument` crea metadata `pending` con `setDoc` y campos de auditoría, sin lectura previa.
- Instalaciones, equipos y adjuntos de soporte usan esa ruta sólo para la creación inicial; actualización y eliminación conservan sus contratos existentes.
- La compensación elimina metadata si Storage falla y elimina objeto + metadata si falla el vínculo final.
- Los diagnósticos internos conservan etapa/servicio/código/recurso mediante `console.warn`; la UI muestra mensajes en español y nunca el texto de permisos de Firebase.
- La ruta física usa UUID interno. El nombre original sólo queda como metadata acotada.
- PDF se restringe a `document`, `plan` o `sketch`; catálogo comercial sigue limitado a imágenes.

## Verificación y riesgo residual

Pasaron las pruebas unitarias de creación sin prelectura, allowlist/tamaño/categoría y cleanup, además de 25 reglas Firestore, 9 Storage y los E2E. Las reglas siguen autorizando por padre, rol y asignación. No se implementó validación de magic bytes: se conserva como riesgo residual la confianza en MIME/tamaño declarados, sin afirmar análisis de contenido.
