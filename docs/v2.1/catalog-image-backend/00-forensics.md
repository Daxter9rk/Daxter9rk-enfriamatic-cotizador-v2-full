# Diagnóstico forense — imágenes del catálogo comercial

Fecha: 5 de agosto de 2026. Rama: `refactor/v2.1-operational-redesign`. HEAD de inicio: `26e705cf1bd400be252bb8d087dd718e914b708b`.

## Síntoma y punto de fallo

El navegador ejecuta `uploadBytes` desde `CommercialCatalogPage.tsx` y recibe HTTP 403 con `storage/unauthorized`. El diagnóstico acotado del cliente registra `stage: storage-upload`, `service: storage` y `resourceType: catalog`.

La ruta se construye en `privateFiles.ts` como:

```text
catalog/{catalogItemId}/{fileId}/{fileId}.{jpg|png|webp}
```

El build configura el proyecto `enfriamatic-cotizador-de-420e5` y el bucket `enfriamatic-cotizador-de-420e5.firebasestorage.app`.

## Condición de Rules involucrada

`storage.rules` condiciona `allow create` bajo `catalog/{code}/{fileId}/{fileName}` a que el solicitante tenga perfil activo y rol `admin`; el objeto mida como máximo 5 MB y declare JPEG, PNG o WebP; y `catalogItems/{code}` ya contenga `imageStatus: pending`, la misma ruta, MIME y tamaño.

El flujo escribe primero esa metadata en Firestore y falla después, durante el POST a Cloud Storage. La compensación restaura la metadata anterior; un artículo nuevo permanece creado sin imagen. La lectura vigente usa `getBlob` desde el navegador, no URL pública ni Base64 persistido.

Las pruebas de emulador del archivo local de Rules permiten el caso sintético, pero el preview remoto rechaza el mismo flujo. La evidencia de despliegue de la ronda 3 registra que Storage Rules no se desplegaron con ese preview. Por tanto existe una dependencia frágil entre metadata transitoria, reglas activas y escritura directa cuya deriva produce el 403.

## Decisión de arquitectura

No se relajarán ni desplegarán Storage Rules para restaurar la escritura directa. El Catálogo comercial usará callables Gen 2: autorización con perfil Firestore, validación real de bytes, escritura con Admin SDK, transacción de referencia/auditoría, compensación e idempotencia. La lectura privada se moverá al backend sólo para estas imágenes. Los demás flujos de archivos no cambian.
