# Usuarios DEV de revisión

El mecanismo está en `scripts/dev-review-users/` y exige `--target=emulator|remote` y `--action=provision|disable|restore|cleanup`.

Controles:

- sólo acepta `enfriamatic-cotizador-de-420e5`;
- remoto exige además `--confirm-project=enfriamatic-cotizador-de-420e5` y ADC;
- contraseñas sólo por variables de proceso, mínimo 12 caracteres, nunca impresas;
- `.env.example` no contiene valores;
- cada cuenta lleva custom claim `devReviewUser` y UID en registro local ignorado;
- una cuenta preexistente no marcada provoca detención;
- cleanup requiere claim + registro y nunca toca al administrador principal;
- la cuenta opcional sin perfil existe sólo en Auth.

El ciclo Emulator Suite procesó 4 cuentas en `provision`, `disable`, `restore` y `cleanup`, y eliminó exactamente esas 4.

## Smoke autenticado remoto

El 5 de agosto de 2026 el revisor humano confirmó manualmente en el Hosting preview:

- administrador promovido: aprobado; conserva los accesos administrativos permitidos y no puede modificar destructivamente al administrador principal;
- operador activo: aprobado; sólo tiene acceso operativo y no puede abrir rutas ni ejecutar acciones administrativas;
- usuario inactivo: aprobado; muestra `Cuenta inactiva` y no accede al contenido privado;
- usuario Auth sin perfil: aprobado; muestra `Perfil no configurado` y no accede al contenido privado.

También se confirmó que el usuario sin perfil no aparece en `Usuarios y permisos`, comportamiento esperado porque sólo existe en Firebase Authentication y no tiene documento `users/{uid}`.

Esta evidencia fue proporcionada por el revisor humano; no se registraron contraseñas, tokens, cookies ni UID en Git. Las cuentas remotas se conservan: por instrucción expresa no se ejecutó `cleanup`.
