# V2.1 — evidencias

## Vista previa

- Canal: `v2-1-operational-redesign`.
- URL: https://enfriamatic-cotizador-de-420e5--v2-1-operational-redes-tldjx9c8.web.app
- Expiración: 3 de septiembre de 2026, 22:27:58 (America/Mexico_City).
- Hosting principal: no desplegado.
- PR en borrador: https://github.com/Daxter9rk/Daxter9rk-enfriamatic-cotizador-v2-full/pull/7

## Capturas reproducibles

Generadas contra Emulator Suite mediante `npm run evidence:emulators`:

- `docs/images/manual/01-login.png`
- `docs/images/manual/02-dashboard-administrador.png`
- `docs/images/manual/03-catalogo-comercial.png`
- `docs/images/manual/04-alta-guiada-cotizacion.png`
- `docs/images/manual/05-dashboard-operador-movil.png`

## Documentos

- `output/pdf/cotizacion-v2.1-prueba.pdf`
- `public/manuales/manual-administrador-v2.1.pdf`
- `public/manuales/manual-operador-v2.1.pdf`
- Fuentes reproducibles: `scripts/generate-pdf-evidence.mjs` y `scripts/generate_manual_pdfs.py`.

## Despliegue backend DEV

Comando ejecutado con Project ID explícito:

```text
npx -y firebase-tools@latest deploy --only firestore:rules,storage,functions --project enfriamatic-cotizador-de-420e5 --non-interactive
```

Resultado: Firestore Rules y Storage Rules publicadas; nueve Functions existentes actualizadas y cinco nuevas creadas (`recordActivity`, `claimPrimaryAdmin`, `transitionRequest`, `assignRequest`, `syncEquipmentIntervention`). No se eliminaron Functions ni índices.

Incidencia registrada: el `preflight:dev` previo al comando combinado detectó correctamente archivos de evidencia/CSS pendientes, pero el separador de PowerShell permitió que el deploy continuara. El backend ya tenía la suite integral verde y el propio deploy recompiló Rules y Functions. Después se confirmó el árbol limpio y `npm run preflight:dev` terminó correctamente antes del despliegue del preview.
