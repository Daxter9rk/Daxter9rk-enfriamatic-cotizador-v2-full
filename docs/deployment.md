# Despliegue controlado a Firebase DEV

Proyecto único autorizado: `enfriamatic-cotizador-de-420e5`. No existe despliegue automático desde CI; la liberación se ejecuta manualmente desde `main` después de fusionar un PR verde.

## Gate obligatorio

1. Confirma que `main` esté limpio y sincronizado con `origin/main`.
2. Ejecuta `npm ci`, `npm --prefix functions ci`, `npm run validate`, `npm run validate:emulators` y `npm run audit:all`.
3. Ejecuta el preflight y el inventario con proyecto explícito:

   ```powershell
   npm run preflight:dev
   npm run inventory:dev -- --project enfriamatic-cotizador-de-420e5
   ```

4. Revisa `.artifacts/predeploy/<fecha>/inventory.json`, compara las Functions existentes con las nueve esperadas y detente si Firebase propone eliminar un recurso desconocido.
5. Confirma que `.firebaserc`, `.env.local` y el build identifican el mismo proyecto DEV. Nunca imprimas `.env.local` ni credenciales.

## Orden de despliegue

Cada comando vuelve a ejecutar el preflight y contiene el Project ID explícito:

```powershell
npm run deploy:dev:firestore
npm run deploy:dev:storage
npm run deploy:dev:functions
npm run deploy:dev:hosting
```

Functions esperadas en `us-central1`: `healthCheck`, `recordLogin`, `createUser`, `updateUser`, `issueQuote`, `createCorrection`, `transitionQuote`, `downloadQuotePdf` y `auditDomainWrite`. Si Eventarc o IAM aún se propaga, espera y reintenta el mismo comando; no amplíes permisos a ciegas.

## Semilla ficticia

La semilla usa Application Default Credentials, rechaza emuladores y cualquier proyecto distinto de DEV, y nunca escribe `users`:

```powershell
npm run seed:dev -- --project enfriamatic-cotizador-de-420e5 --dry-run
npm run seed:dev -- --project enfriamatic-cotizador-de-420e5 --confirm enfriamatic-cotizador-de-420e5
npm run seed:dev -- --project enfriamatic-cotizador-de-420e5 --confirm enfriamatic-cotizador-de-420e5
```

La segunda ejecución real debe reportar todos los documentos sin cambios. Para inspeccionar un rollback sin borrar:

```powershell
npm run rollback:dev-seed -- --project enfriamatic-cotizador-de-420e5 --dry-run
```

## Verificación posterior

- abre Hosting y confirma título/login, dashboard por rol, catálogo, editor y manuales;
- prueba una ruta SPA inexistente y confirma que sirve la aplicación;
- consulta `healthCheck` y el manifiesto de Functions;
- valida emisión y descarga de un PDF privado, seguimiento comercial, auditoría y notificaciones;
- vuelve a inventariar conteos, usuarios y PDFs;
- guarda capturas sin datos sensibles bajo `.artifacts/evidence/<fecha>`.

No despliegues a PROD, no cambies contraseñas de usuarios reales y no habilites App Check enforcement en este hito.
