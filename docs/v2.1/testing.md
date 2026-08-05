# V2.1 — pruebas de cierre provisional

Fecha de cierre técnico: 4 de agosto de 2026 (America/Mexico_City).

## Validación local

| Comando                            | Resultado                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run validate`                 | Correcto: formato, lint, TypeScript, 18 pruebas frontend/scripts, build, 13 pruebas de Functions y build de Functions.                                                                      |
| `npm run validate:emulators`       | Correcto: 20 pruebas de Firestore Rules, 5 de Storage Rules y 12 escenarios Playwright.                                                                                                     |
| `npm run audit:all`                | Sin vulnerabilidades altas o críticas. Frontend: 0. Functions: 7 moderadas transitivas; `npm audit fix --force` propone una degradación mayor de `firebase-admin`, por lo que no se aplicó. |
| Escaneo de secretos con `git grep` | Sin patrones de claves privadas, tokens GitHub/Slack ni claves Google detectados.                                                                                                           |

Los mensajes `PERMISSION_DENIED` observados en la salida de Rules corresponden a casos negativos que terminaron aprobados. Vite conserva una advertencia no bloqueante por el chunk minificado de Firebase superior a 500 kB.

## Cobertura funcional E2E

- Acceso anónimo, perfil ausente, usuario inactivo, rol inválido, operador y administrador.
- Protección de rutas, cierre de sesión y navegación atrás segura.
- Ataques de alcance cruzado y relaciones incompatibles contra callables.
- Catálogo → cliente → instalación → equipo → solicitud → asignación → cotización → PDF → enviada → aceptada → corrección.
- Rechazo y cancelación comercial con motivo, auditoría y notificación.
- Responsive en 360, 390, 768, 1366 y 1920 px sin desbordamiento horizontal.
- Zoom 67 %, 80 %, 90 % y 100 % con acciones críticas operables.

## PDF

`functions/src/documents/pdf.test.ts` cubre firma/MIME, marca de agua DEV, textos extensos, acentos, descuentos, múltiples partidas y salto de página. `output/pdf/cotizacion-v2.1-prueba.pdf` fue renderizado e inspeccionado visualmente: cinco páginas, encabezados repetidos, filas completas y totales legibles.

Los manuales de administrador y operador también fueron renderizados e inspeccionados en sus cuatro páginas respectivas.

## Validación remota DEV

- `healthCheck`: HTTP 200 con `environment: dev`.
- Preview público: carga en español, título correcto, formulario de acceso presente, ancho de documento igual al viewport y consola sin errores/advertencias en la inspección inicial.
- GitHub CI del PR #7: `validate` aprobado en 1m39s y `emulator-tests` aprobado en 3m30s.
