# V2.1 — plan de rollback

## Código y Hosting preview

- La línea base recuperable es `v2.0.0-dev.1` / `c4b94ff60cac9799fe91754b7aa104b010998d54`.
- El canal preview V2.1 puede expirar o eliminarse sin modificar Hosting live.
- Nunca usar reset destructivo ni mover el tag; para reconstruir la línea base se crea una rama nueva desde el tag.

## Backend aditivo

- Restaurar Rules, índices, Storage Rules y Functions desde el commit base y validar en emuladores antes de desplegar targets explícitos.
- No borrar documentos históricos ni colecciones V2.1. Los clientes V2.0 ignoran campos y colecciones aditivas.
- Si una Function V2.1 debe retirarse, verificar primero inventario y dependencias; no aceptar eliminaciones masivas sugeridas por CLI.
- Los campos `isPrimaryAdmin` y datos de trazabilidad no se eliminan durante rollback; conservarlos evita perder autoridad e historial.

## Verificación

Después de cualquier rollback comprobar autenticación, perfiles, solicitud, cotización emitida, descarga PDF, auditoría y reglas default-deny. Todo comando cloud deberá contener `--project enfriamatic-cotizador-de-420e5`.
