# Rollback selectivo de Firebase DEV

Proyecto único autorizado: `enfriamatic-cotizador-de-420e5`. Todo comando de escritura debe incluir `--project enfriamatic-cotizador-de-420e5`. No ejecutar contra PROD.

## Principios

- Restaurar por recurso; no borrar el proyecto.
- Conservar usuarios reales, UID, correos, roles y estados.
- Conservar documentos PDF oficiales ya existentes.
- No aceptar la eliminación de Functions desconocidas.
- Usar el inventario privado `.artifacts/predeploy/<timestamp>/` y el commit base aprobado.
- Registrar comandos, resultado y responsable en el reporte de liberación.

## Hosting

1. Identificar la última versión sana con la consola o `npx -y firebase-tools@latest hosting:channel:list --project enfriamatic-cotizador-de-420e5`.
2. Preferir clonar/promover una versión verificada al canal live cuando esté disponible.
3. Alternativa reproducible: cambiar al commit anterior, ejecutar build con variables DEV y desplegar sólo Hosting:

   ```powershell
   npx -y firebase-tools@latest deploy --only hosting --project enfriamatic-cotizador-de-420e5
   ```

4. Comprobar título, login, ruta SPA y ausencia de la landing antigua.

## Firestore Rules

1. Recuperar `firestore.rules` desde el inventario previo o commit anterior.
2. Ejecutar las pruebas de Rules contra emulador.
3. Desplegar únicamente Rules:

   ```powershell
   npx -y firebase-tools@latest deploy --only firestore:rules --project enfriamatic-cotizador-de-420e5
   ```

4. Confirmar que visitantes, perfiles inactivos y escrituras sensibles sigan bloqueados.

## Índices

1. Recuperar `firestore.indexes.json` anterior.
2. Comparar el diff; no eliminar índices ajenos sin evidencia.
3. Desplegar sólo índices:

   ```powershell
   npx -y firebase-tools@latest deploy --only firestore:indexes --project enfriamatic-cotizador-de-420e5
   ```

4. Esperar hasta que todos reporten estado listo antes de cerrar el rollback.

## Storage Rules

1. Recuperar `storage.rules` anterior.
2. Ejecutar `npm run test:storage`.
3. Desplegar sólo Storage Rules:

   ```powershell
   npx -y firebase-tools@latest deploy --only storage --project enfriamatic-cotizador-de-420e5
   ```

4. Confirmar que el bucket siga privado y la descarga autorizada continúe funcionando.

## Functions

1. Comparar la lista desplegada con el inventario.
2. Volver al commit anterior, instalar dependencias y ejecutar `npm --prefix functions run validate`.
3. Desplegar por nombres/grupos conocidos; no aceptar prompts de eliminación:

   ```powershell
   npx -y firebase-tools@latest deploy --only functions:healthCheck,functions:recordLogin,functions:createUser,functions:updateUser,functions:issueQuote,functions:createCorrection,functions:downloadQuotePdf,functions:auditDomainWrite --project enfriamatic-cotizador-de-420e5
   ```

4. Verificar lista, región y `healthCheck`. Si el fallo es propagación conocida de Eventarc/IAM, reintentar de forma controlada sin cambiar permisos a ciegas.

## Semilla DEV

Primero ejecutar dry-run:

```powershell
npm run rollback:dev-seed -- --project enfriamatic-cotizador-de-420e5 --dry-run
```

Sólo si el resumen es correcto:

```powershell
npm run rollback:dev-seed -- --project enfriamatic-cotizador-de-420e5 --confirm enfriamatic-cotizador-de-420e5
```

El script inspecciona rutas deterministas y elimina únicamente documentos que cumplan simultáneamente `dataOrigin == 'dev-seed'` y `seedTag == 'enfriamatic-functional-demo-v1'`. `users` nunca forma parte del plan. Las partidas se eliminan antes que su cotización. Los documentos ajenos se preservan.

## Criterio de rollback completo

Sólo restaurar todos los recursos si la liberación no puede repararse razonablemente. Después, validar login, panel, solicitud, cotización existente, descarga PDF, auditoría y ausencia de errores de consola. Documentar cualquier riesgo residual sin presentar el rollback como exitoso hasta completar esas pruebas.
