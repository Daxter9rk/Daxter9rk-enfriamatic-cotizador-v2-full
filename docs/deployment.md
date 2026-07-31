# Despliegue controlado DEV

No existe despliegue automático en CI y este documento no autoriza ejecutarlo.

## Gate obligatorio

1. `npm ci` y `npm --prefix functions ci`.
2. `npm run validate`.
3. `npm run validate:emulators`.
4. `npm run audit:all` y revisión de alcanzabilidad.
5. Buscar secretos y confirmar `.firebaserc`.
6. Confirmar proyecto activo `enfriamatic-cotizador-de-420e5`.
7. Obtener aprobación humana.

Sólo después:

```powershell
firebase deploy --only hosting,firestore:rules,firestore:indexes,storage,functions `
  --project enfriamatic-cotizador-de-420e5
```

Validar login, health check, flujo corto de borrador y descarga en DEV. Nunca
ejecutar contra PROD ni habilitar App Check enforcement durante esta entrega.
