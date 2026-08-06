# Pruebas de la ronda 3

Resultado final:

- `npm.cmd run validate`: verde; formato, lint, typecheck, build web, 49 pruebas web/scripts, lint/typecheck/build Functions y 16 pruebas Functions.
- `npm.cmd run validate:emulators`: verde; 25 Firestore + 9 Storage y 12 E2E.
- ciclo de usuarios DEV en emuladores: verde; 4 perfiles, 4 acciones, cleanup exacto.
- smoke autenticado remoto en preview, ejecutado manualmente por el revisor: administrador promovido, operador activo, usuario inactivo y usuario Auth sin perfil aprobados.
- `npm.cmd run audit:all`: exit 0; web 0 vulnerabilidades, Functions 7 moderadas transitivas de `uuid`, sin altas/críticas. El fix automático propone un cambio breaking/downgrade y no se aplicó.
- escaneo de secretos sobre el diff: sin API keys, private keys, tokens, bearer tokens ni contraseñas literales.

Una primera ejecución E2E detectó dos nodos con el mismo texto de acción (opción de filtro y tarjeta). Se centralizó una etiqueta nominal distinta para filtros. Un intento focalizado sirvió `dist` anterior por no reconstruir; la repetición integral con rebuild pasó y `test-results/.last-run.json` quedó en `passed`.

La CI remota del PR #7 quedó verde sobre `531a710`: `validate` y `emulator-tests` concluyeron correctamente. Git por HTTPS y `gh pr` funcionaron para publicar y consultar el PR.

La comprobación de perfiles remotos es evidencia de revisión humana y complementa, sin sustituir, las pruebas automatizadas y de emuladores. No se ejecutó cleanup remoto.
