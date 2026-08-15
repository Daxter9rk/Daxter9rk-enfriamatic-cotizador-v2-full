# Evidencia de recuperación — Hito 2

## Alcance

Se implementó el contrato dual de Cotizaciones para permitir borradores independientes sin alterar la emisión, descarga PDF ni corrección históricas.

## Entregado

- Cliente obligatorio y solicitud opcional en el alta.
- En modalidad independiente, `requestId`, `siteId` y `equipmentId` se persisten siempre como `null`; la referencia de servicio y el contexto técnico son texto opcional.
- Normalización de referencias vacías a `null`.
- Casos de uso para crear, actualizar y validar borradores.
- Edición de contexto y notas desde el editor.
- Asignación directa por administrador y autoasignación por operador.
- Bloqueo visual y de flujo para emitir cotizaciones sin solicitud.
- Reglas y pruebas para autorización de cliente y operador; la UI no ofrece selectores de instalación/equipo en modalidad independiente.

## Preservación

No se modificaron `issueQuote`, `downloadQuotePdf`, `createCorrection`, Storage Rules, generación de PDF, folios, documentos emitidos ni snapshots de cálculo.

## Riesgos y deuda

La rama independiente usa referencias operativas nulas para no consultar Solicitud, Instalación ni Equipo y para permanecer dentro del límite de 1000 expresiones del evaluador. La rama histórica conserva su validador y referencias. La normalización de lectura no borra referencias inesperadas de documentos antiguos; la aplicación rechaza o fuerza `null` al crear registros nuevos. La emisión independiente permanece bloqueada hasta definir su contrato comercial y documental.

## Validación

La evidencia final debe incluir lint, typecheck, pruebas frontend, Rules, Storage, Functions, build y validación de emuladores. No se ejecuta deploy ni se escriben datos Firebase reales.
