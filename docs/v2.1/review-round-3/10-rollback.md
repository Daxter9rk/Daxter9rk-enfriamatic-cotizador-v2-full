# Rollback no destructivo — ronda 3

1. Mantener PR #7 en borrador y detener la revisión sobre el canal afectado.
2. Crear `git revert` de los commits de ronda 3 en orden inverso; no usar reset, rebase ni force-push.
3. Ejecutar `npm.cmd run validate`, `npm.cmd run validate:emulators` y `npm.cmd run audit:all`.
4. Con Project ID explícito, desplegar la versión revertida sólo de `firestore:rules` y de las Functions `recordLogin`, `createUser`, `transitionQuote`, `auditDomainWrite`, `syncEquipmentIntervention` que corresponda restaurar.
5. Publicar el frontend revertido en otro canal preview. No desplegar Hosting live.
6. Dejar expirar o eliminar únicamente el canal temporal `v2-1-operational-round-3` cuando ya no sea evidencia útil.
7. No borrar intervenciones, cotizaciones, historiales, auditorías ni archivos DEV. Los campos de auditoría nuevos son aditivos.
8. Para usuarios de revisión, ejecutar `cleanup` sólo con el registro local y custom claims válidos; nunca borrar por correo/prefijo.

Si falla sólo un target, restaurar únicamente ese target. Confirmar health check y smoke antes de reabrir la revisión.
