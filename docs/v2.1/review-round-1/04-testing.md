# Pruebas de la ronda 1

## Línea base

Antes de cambiar código: `npm run validate` correcto; `npm run validate:emulators` correcto con 20 Firestore Rules, 5 Storage Rules y 12 E2E; `npm run audit:all` sin vulnerabilidades altas/críticas.

## Cobertura agregada

- Unitarias: pareja extensión/MIME, límites, rutas internas, saneamiento, compensación, relaciones y alcance, rutas de notificación y mapeo de errores Auth.
- Componentes: reautenticación, campana accionable, preview multipágina (23 partidas: 10/10/3 y caso vacío), soporte y regresión de cotizaciones.
- Functions: reasignación con motivo y políticas existentes de cotización/auditoría.
- Firestore Rules: perfiles principal/promovido/operador/inactivo/sin perfil, configuración, asignación/relaciones, metadata, notificaciones y auditoría append-only.
- Storage Rules: permisos por perfil/recurso, lectura privada, create/delete, ruta, MIME, tamaño y operador fuera de alcance.
- E2E: flujo comercial, asignación concreta, alcance, intervención, preview/PDF, emisión/rechazo/corrección, notificaciones, auditoría, responsive 360/390/768/1366/1920 y zoom 67/80/90/100.

## Resultados de cierre local

| Comando                   | Resultado                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm run validate`        | Correcto: 16 archivos/33 pruebas web y 6 archivos/14 pruebas Functions; lint, tipos y builds aprobados |
| Firestore + Storage Rules | 23 + 9 = 32/32 aprobados en la corrida oficial final                                                   |
| Playwright                | 12/12 aprobados dentro del mismo `npm run validate:emulators` final                                    |
| `npm run audit:all`       | Frontend 0; Functions 7 moderadas transitivas en `uuid`; 0 altas/críticas                              |
| `git diff --check`        | Correcto                                                                                               |

La prueba antes intermitente no se cerró con reintento: se identificó una carrera real. El mensaje de éxito podía cerrar el modal antes de completar `onChanged`; una recarga tardía lo reabría. La UI ahora espera la recarga y sólo después confirma/cierra. El flujo aislado y después los 12 E2E completos aprobaron.

La advertencia de Vite por el chunk de Firebase (aprox. 558 kB) es de rendimiento, no un fallo funcional. El `npm audit fix --force` de Functions propone un downgrade mayor incompatible de `firebase-admin`; no se aplicó.

## Validación humana/preview

Health check, preview y live respondieron HTTP 200; el canal correcto fue renovado y la fecha de release live no cambió. El smoke autenticado y la regresión read-only de live quedan pendientes por ausencia de una sesión/credencial DEV autorizada en el navegador disponible. No se sustituyó este control con una sesión privilegiada artificial.
