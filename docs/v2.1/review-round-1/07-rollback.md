# Rollback no destructivo de la ronda 1

1. Mantener PR #7 en borrador y detener pruebas humanas sobre el preview afectado.
2. Crear commits `git revert <commit-ronda>` en orden inverso sobre `refactor/v2.1-operational-redesign`; no rebase, reset, force-push ni alteración de tags.
3. Ejecutar `npm run validate`, `npm run validate:emulators` y `npm run audit:all`.
4. Con el Project ID explícito `enfriamatic-cotizador-de-420e5`, restaurar únicamente los targets que se hayan publicado: Firestore Rules, Storage Rules y las Functions nominales de la ronda. No desplegar índices si no cambiaron.
5. Volver a desplegar el commit revertido a un canal preview temporal. No ejecutar `firebase deploy --only hosting` contra live.
6. Ejecutar health check, smoke autenticado y compatibilidad read-only V2.0.
7. Conservar documentos/campos aditivos, historial, objetos y metadata creados; no borrar datos DEV para “volver atrás”. Las versiones anteriores ignoran campos adicionales.
8. Si sólo falla el frontend, retirar/dejar expirar el canal preview y conservar backend; si falla una Function, restaurar sólo esa Function; si falla autorización, restaurar sólo la versión previa de las reglas.

El rollback de archivos nunca borra lotes por prefijo: se identifica un objeto exacto y su metadata antes de cualquier limpieza. Los fallos de carga nuevos usan compensación y son recuperables sin barrido destructivo.
