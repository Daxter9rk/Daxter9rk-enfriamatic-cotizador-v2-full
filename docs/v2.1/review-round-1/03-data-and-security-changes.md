# Cambios de datos y seguridad

Todos los cambios de contrato son aditivos. No se borraron documentos DEV, no se alteraron índices y las reglas conservan `default-deny`.

## Contratos de datos

- Solicitudes: `scope` distingue `site` y `equipment`; `equipmentId` es nulo sólo para alcance general. La asignación conserva UID real y la reasignación exige motivo.
- Cotizaciones: `lastRejectionReason`, `lastRejectedAt` y `lastRejectedBy` facilitan lectura; `commercialHistory[]` conserva eventos previos. Una corrección crea una solicitud/cotización nueva y no desbloquea la emitida.
- Intervenciones: se agregan nombre y rol del responsable, sin reemplazar el historial append-only.
- Auditoría: `result` explicita éxito o fallo y la UI presenta actor, rol, motivo, fecha relativa/exacta y enlace; los objetos técnicos continúan restringidos a administradores.
- Archivos privados: metadata por colección (`siteFiles`, `equipmentFiles`, `catalogFiles`, `supportFiles`), rutas internas por recurso, nombre visible saneado y estado de persistencia controlado.

## Firestore Rules

- Valida existencia, estado activo y relación cliente → instalación → equipo al crear solicitudes.
- Valida que `assignedTo` sea un perfil activo con rol permitido.
- Autoriza configuración sólo a un perfil admin activo, tanto principal como promovido; operador e inactivo quedan denegados.
- Autoriza metadata privada según recurso y alcance; permite limpieza controlada del creador/admin sin abrir listados generales.
- Notificaciones sólo permiten al destinatario leer y cambiar `read/readAt`; no crear, borrar ni alterar el destino.
- Auditoría permanece inmutable para clientes.
- Las colecciones/rutas no declaradas permanecen denegadas.

## Storage Rules

- Sitios/equipos: JPEG, PNG, WebP y PDF, máximo 10 MiB.
- Catálogo/soporte: JPEG, PNG y WebP, máximo 5 MiB; SVG, HTML, ZIP, Office y ejecutables no coinciden con la allowlist.
- Se exige correspondencia de ruta con metadata, perfil activo y ACL del recurso.
- Admin principal y promovido comparten capacidad administrativa; operador sólo actúa dentro de asignación/política.
- Lectura privada y eliminación controlada; no se generan URLs públicas permanentes.

## Functions

- `assignRequest`: valida usuario activo, diferencia asignación/reasignación, exige motivo y registra before/after/actor/destinatario/resultado.
- `transitionQuote`: persiste motivo y actor del rechazo, agrega historial y notifica incluyendo el motivo.
- `createCorrection`: conserva el alcance de la solicitud vinculada.
- `auditDomainWrite`: completa el resultado del evento.

## Carga y compensación

La utilidad común valida antes de escribir, reserva un ID, sube el objeto, crea metadata y ejecuta cleanup si una etapa posterior falla. La UI bloquea envíos concurrentes y muestra mensajes normalizados en español; el diagnóstico interno contiene etapa, servicio, código y recurso sin credenciales ni payloads.

Limitación residual: la carga continúa siendo directa desde el cliente y Storage Rules no inspecciona magic bytes. La mitigación es bucket privado, pareja estricta extensión/MIME, límites en cliente y reglas, nombres internos no aportados por el usuario y entrega autenticada. Una validación real de firma requerirá una Function de ingestión o escaneo posterior.

## Auditoría adversarial de reglas

| Vector                                                                            | Resultado                                                |
| --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Acceso público o usuario sin perfil/inactivo                                      | Denegado                                                 |
| Lectura/escritura no autorizada y consultas sin límite/ACL                        | Denegado                                                 |
| Bypass por update, cambio de propietario/ACL o campos inmutables                  | Denegado                                                 |
| Escalamiento de rol o modificación del administrador principal                    | Denegado por reglas/Functions existentes y regresión E2E |
| Schema pollution, tipos/valores/timestamps inválidos y campos requeridos ausentes | Denegado por validadores y `hasOnly`                     |
| Transición de estado inválida y mutación de auditoría                             | Denegado                                                 |
| Ruta de Storage incorrecta, MIME/extensión/tamaño inválidos                       | Denegado                                                 |
| Acceso a subcolección/metadata huérfana fuera del alcance                         | Denegado; cleanup compensatorio probado                  |

Los casos negativos producen `PERMISSION_DENIED` esperado en el emulador. Algunos validadores complejos reportan el límite de expresiones al evaluar escrituras maliciosas; dichas escrituras terminan denegadas. Se conserva como riesgo bajo de mantenibilidad, no como autorización abierta.
