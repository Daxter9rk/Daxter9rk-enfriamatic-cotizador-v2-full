# Usuarios DEV de revisión

Este script sólo acepta `enfriamatic-cotizador-de-420e5`, exige seleccionar `emulator` o `remote` y nunca imprime contraseñas. Las credenciales se leen exclusivamente de variables del proceso. La cuenta opcional sin perfil se omite cuando sus dos variables no están definidas.

En PowerShell, define localmente las variables descritas en `.env.example`. Después usa uno de estos comandos:

```powershell
npm.cmd run review-users:dev -- --target=emulator --action=provision
npm.cmd run review-users:dev -- --target=remote --action=provision --confirm-project=enfriamatic-cotizador-de-420e5
```

`disable` deshabilita en Auth las cuentas registradas y pone inactivos sus perfiles; `restore` vuelve a habilitarlas y restaura los roles/estados de revisión; `cleanup` elimina únicamente UIDs presentes en el registro local y que además llevan la custom claim `devReviewUser`. Para remoto se requieren Application Default Credentials. El archivo local de UIDs no contiene credenciales y está ignorado por Git.

El script nunca busca, modifica ni elimina al administrador principal. Si un correo ya pertenece a una cuenta no marcada por el script, se detiene.
