# Preflight — ronda 3

- Ruta: `C:\Users\Daxter_9rk\Desktop\enfriamatic-cotizador-v2-full`.
- Rama: `refactor/v2.1-operational-redesign`.
- HEAD inicial: `a29ce80749534ad3bfd2fdf0c7efddd5dd837ad1`.
- `origin`: `https://github.com/Daxter9rk/Daxter9rk-enfriamatic-cotizador-v2-full.git`.
- Sincronización inicial: `HEAD == origin/refactor/v2.1-operational-redesign`.
- Línea base: `main`, `origin/main` y `v2.0.0-dev.1` en `c4b94ff60cac9799fe91754b7aa104b010998d54`.
- Árbol inicial: limpio.
- Firebase: `enfriamatic-cotizador-de-420e5`, Firestore `(default)` edición Standard, región `us-central1`.
- Herramientas: Node `v22.22.0`, npm `10.9.4`, GitHub CLI `2.97.0`.
- Firebase CLI: disponible mediante `firebase.cmd`/`npx.cmd`; PowerShell bloquea los wrappers `.ps1`.
- GitHub CLI: autenticación expirada. El conector GitHub tampoco tiene acceso al repositorio; CI remoto queda pendiente hasta restaurar autenticación.

## Línea base de pruebas

- `npm.cmd run validate`: correcto al repetir fuera del sandbox; 33 pruebas frontend/scripts y 14 de Functions.
- `npm.cmd run validate:emulators`: correcto; 23 Firestore + 9 Storage y 12 E2E.
- `npm.cmd run audit:all`: sin vulnerabilidades altas/críticas; 7 moderadas transitivas de `uuid` en Functions.
- Primer intento de `validate`: fallo ambiental de esbuild por acceso restringido a una ruta auxiliar; no fue un fallo del repositorio.

No se modificó Hosting live durante el preflight.
