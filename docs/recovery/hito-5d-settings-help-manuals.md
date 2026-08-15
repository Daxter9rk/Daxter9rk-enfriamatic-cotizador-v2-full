# Hito 5D — Configuración, ayuda, soporte y manuales

## Objetivo

Completar las funciones auxiliares del MVP sin inventar capacidades ni reactivar módulos retirados.

## Preflight

- Rama base: `feat/mvp-h5c-commercial-catalog-filters`
- HEAD base: `12f54dd7c5e347e035d886710a2878ca7a63bcaf`
- Rama de trabajo: `feat/mvp-h5d-settings-help-manuals`
- Tags protegidos conservados.
- No se realizó despliegue ni se modificó Firebase real.

## Inventario inicial

| Área          | Estado inicial                                                                                                          | Clasificación      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Configuración | Ya cargaba dos documentos y permitía edición administrativa, pero sin contrato central de validación ni estado de error | CORREGIR           |
| Manual        | Integrado por rol, pero describía Solicitudes, Instalaciones, Equipos, Actividad y PDFs descargables                    | REESCRIBIR         |
| Ayuda         | FAQ mezclada con soporte y referencias obsoletas                                                                        | CORREGIR           |
| Soporte       | Persistía `supportRequests` y subía adjuntos privados                                                                   | REESCRIBIR         |
| Navegación    | Manual y Soporte eran accesibles; Configuración sólo se ocultaba y protegía por ruta                                    | CONSERVAR/CORREGIR |
| Rules         | Operadores podían leer `settings/companyProfile` y `settings/quoteDefaults`                                             | CORREGIR           |

## Contrato de Configuración

Se conservaron exactamente `settings/companyProfile` y `settings/quoteDefaults`.

### `companyProfile`

| Campo         | Editable | Validación                        | Uso                                 |
| ------------- | -------: | --------------------------------- | ----------------------------------- |
| `companyName` |       Sí | Obligatorio, máximo 120           | Identidad empresarial del documento |
| `rfc`         |       Sí | RFC válido o vacío, máximo 13     | Datos empresariales                 |
| `address`     |       Sí | Texto, máximo 300                 | Datos empresariales                 |
| `phone`       |       Sí | Texto, máximo 30                  | Datos de contacto                   |
| `email`       |       Sí | Correo válido o vacío, máximo 254 | Datos de contacto                   |
| `legalText`   |       Sí | Texto, máximo 3000                | Texto legal/comercial               |

### `quoteDefaults`

| Campo              | Tipo   | Validación                           | Aplicación                                   |
| ------------------ | ------ | ------------------------------------ | -------------------------------------------- |
| `taxRate`          | número | Finito, 0 a 1                        | Nuevas operaciones según el contrato vigente |
| `validityDays`     | entero | 1 a 365                              | Nuevas cotizaciones                          |
| `currency`         | enum   | Sólo `MXN`                           | Nuevas cotizaciones                          |
| `folioPrefix`      | texto  | Letras, números y guiones, máximo 12 | Nuevos folios                                |
| textos comerciales | texto  | Límites del contrato Firestore       | Nuevos documentos                            |
| `devWatermark`     | texto  | Máximo 120                           | Documentos DEV nuevos                        |

La interfaz normaliza espacios, correo y mayúsculas del RFC/prefijo. Sólo envía los campos editables conocidos y usa actualización controlada con merge.

## Permisos y guardas

- Administradores: pueden leer y modificar ambos documentos después de reautenticarse.
- Operadores: no ven el enlace, son redirigidos desde `/settings` y las Rules rechazan la lectura y escritura directa.
- No se amplió el acceso de ninguna colección.

## Inmutabilidad histórica

Los cambios de Configuración no actualizan documentos emitidos, snapshots, PDFs, folios, Storage ni revisiones. Emisión y correcciones continúan tomando sus snapshots y contratos existentes.

## Manuales

`src/content/manuals.ts` contiene dos manuales integrados y filtrables por rol:

- Administrador: acceso, inicio, usuarios, Clientes, Cotizaciones, Catálogo comercial, Configuración, estados, correcciones y errores.
- Operador: acceso, inicio, Clientes, Cotizaciones, Catálogo comercial, correcciones, restricciones y errores.

No se presentan como funciones activas Solicitudes, Instalaciones, Equipos, Actividad ni catálogos internos. El acceso PDF anterior dejó de mostrarse para evitar enlazar contenido no sincronizado con el manual integrado; los artefactos históricos permanecen sin uso.

## Centro de ayuda y soporte

La ruta `/support` contiene cinco preguntas frecuentes sobre creación, emisión, PDF, correcciones, filtros y permisos.

El soporte es explícitamente simulado:

- no envía correo;
- no crea tickets externos;
- no persiste `supportRequests`;
- no sube adjuntos;
- no solicita contraseñas, tokens ni datos bancarios;
- valida y confirma únicamente la demostración local.

## Responsive y accesibilidad

Se conservaron los componentes responsive existentes. Manual usa encabezados, índice, acordeones nativos, búsqueda local y texto seleccionable. Soporte usa etiquetas asociadas, `required`, mensajes de estado y botones deshabilitados durante la validación.

## Pruebas

Se añadieron pruebas de contrato, Configuración, Manual, Soporte, Rules y E2E por rol. La validación final se registra en el informe del hito y debe ejecutarse dos veces consecutivas con `npm run validate:emulators`.

## Limitaciones y deuda

El soporte no tiene integración externa por decisión de alcance. La única deuda restante del roadmap es `5E`: validación integral, congelamiento y candidato MVP. No se inició 5E.

## Rollback

Revertir los commits de 5D en orden inverso restaura el comportamiento anterior sin modificar datos. No se requieren migraciones porque se conservaron colecciones y documentos.

## Veredicto

Pendiente de la validación integral final: `PASA`, `FALLA POR CÓDIGO`, `BLOQUEADA POR ENTORNO` o `NO EJECUTADA`.
