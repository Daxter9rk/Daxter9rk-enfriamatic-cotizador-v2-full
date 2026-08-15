# V2.1 — revisión funcional, ronda 1 — preflight

Fecha: 5 de agosto de 2026 (America/Mexico_City).

- Repositorio: `C:\Users\Daxter_9rk\Desktop\enfriamatic-cotizador-v2-full`.
- Remoto: `Daxter9rk/Daxter9rk-enfriamatic-cotizador-v2-full`.
- Rama: `refactor/v2.1-operational-redesign`, limpia y sincronizada al iniciar.
- HEAD inicial local/remoto: `1546d4c012b13ea939cd639ced26c4d53a19d37c`.
- `main`, `origin/main` y `v2.0.0-dev.1`: `c4b94ff60cac9799fe91754b7aa104b010998d54`.
- Firebase DEV: `enfriamatic-cotizador-de-420e5`; Firestore Standard, Native, `us-central1`.
- PR #7: abierto, borrador, base `main`, checks `validate` y `emulator-tests` aprobados.
- Herramientas: Node 22.22.0, npm 10.9.4, Git 2.53.0.windows.2, Firebase CLI 15.25.1 y GitHub CLI 2.97.0.

## Línea base previa a cambios

- `npm run validate`: correcto; 18 pruebas web/scripts y 13 de Functions.
- `npm run validate:emulators`: correcto; 20 pruebas Firestore Rules, 5 Storage Rules y 12 Playwright.
- `npm run audit:all`: umbral alto correcto; frontend sin hallazgos y Functions con 7 avisos moderados transitivos de `uuid`. El arreglo `--force` propone un cambio mayor incompatible y no se aplicó.

Los `PERMISSION_DENIED` de la salida de reglas corresponden a casos negativos que aprobaron. Vite mantiene la advertencia conocida de tamaño del chunk Firebase.
