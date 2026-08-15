# V2.1 — preflight de línea base

Fecha: 4 de agosto de 2026 (America/Mexico_City).

## Identidad autoritativa

| Verificación      | Resultado                                                                  |
| ----------------- | -------------------------------------------------------------------------- |
| Ruta              | `C:\Users\Daxter_9rk\Desktop\enfriamatic-cotizador-v2-full`                |
| Remoto            | `https://github.com/Daxter9rk/Daxter9rk-enfriamatic-cotizador-v2-full.git` |
| Rama base         | `main` limpia y sincronizada con `origin/main`                             |
| Commit base       | `c4b94ff60cac9799fe91754b7aa104b010998d54`                                 |
| Tag protegido     | `v2.0.0-dev.1` → `c4b94ff60cac9799fe91754b7aa104b010998d54`                |
| Proyecto Firebase | `enfriamatic-cotizador-de-420e5`                                           |
| Firestore         | `(default)`, Standard, Native, `us-central1`                               |
| Rama de trabajo   | `refactor/v2.1-operational-redesign`                                       |

## Herramientas

- Node.js `v22.22.0`
- npm `10.9.4`
- Firebase CLI `15.25.0`
- GitHub CLI `2.97.0`
- Git: identidad `Daxter9rk <115183738+Daxter9rk@users.noreply.github.com>`

Firebase CLI está autenticado y reconoce el proyecto DEV autorizado. GitHub CLI conserva una sesión configurada, pero el token es inválido; esto sólo bloquea push/PR y deberá resolverse antes del cierre.

## Validación base

- `npm run validate`: correcto.
  - Prettier, ESLint y TypeScript: correctos.
  - Frontend/scripts: 8 archivos, 18 pruebas.
  - Functions: 4 archivos, 7 pruebas.
  - Build frontend y Functions: correctos.
- `npm run validate:emulators`: correcto.
  - Firestore/Storage Rules: 2 archivos, 22 pruebas.
  - Playwright: 10 flujos E2E.
  - Servicios: Auth, Firestore, Storage, Functions y Hosting sobre `demo-enfriamatic`.

Observación no bloqueante: Vite advierte que el chunk de Firebase supera 500 kB minificado.

## Restricciones preservadas

- `main` y `v2.0.0-dev.1` permanecen intactos.
- No se ejecutó deploy ni escritura en Firestore DEV durante el preflight.
- No se leyó ni registró `.env.local`.
- No se accedió a PROD.
