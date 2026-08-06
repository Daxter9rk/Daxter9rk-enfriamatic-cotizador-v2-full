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

El ciclo Emulator Suite procesó 4 cuentas en `provision`, `disable`, `restore` y `cleanup`, y eliminó exactamente esas 4. DEV remoto no se aprovisionó porque faltan las variables `REVIEW_*`; no se solicitaron ni almacenaron contraseñas.
