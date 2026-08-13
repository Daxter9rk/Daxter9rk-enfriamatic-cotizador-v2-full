# Evidencia de recuperación — Hito 2

## Alcance

Se implementó el contrato dual de Cotizaciones para permitir borradores independientes sin alterar la emisión, descarga PDF ni corrección históricas.

## Entregado

- Cliente obligatorio y solicitud opcional en el alta.
- Instalación, equipo, referencia de servicio y contexto técnico opcionales.
- Normalización de referencias vacías a `null`.
- Casos de uso para crear, actualizar y validar borradores.
- Edición de contexto y notas desde el editor.
- Asignación directa por administrador y autoasignación por operador.
- Bloqueo visual y de flujo para emitir cotizaciones sin solicitud.
- Reglas y pruebas para autorización de cliente y operador; la UI filtra instalación y equipo por cliente.

## Preservación

No se modificaron `issueQuote`, `downloadQuotePdf`, `createCorrection`, Storage Rules, generación de PDF, folios, documentos emitidos ni snapshots de cálculo.

## Riesgos y deuda

La rama independiente mantiene una validación de forma compacta porque el emulador de Firestore limita a 1000 expresiones por evaluación. La validación histórica conserva exactamente su validador baseline; los campos nuevos se validan en la rama mutable de borradores. La pertenencia de instalación/equipo queda respaldada por filtros de UI y normalización de aplicación, y requiere endurecimiento adicional en Rules en un hito posterior. La emisión independiente permanece bloqueada hasta definir su contrato comercial y documental.

## Validación

La evidencia final debe incluir lint, typecheck, pruebas frontend, Rules, Storage, Functions, build y validación de emuladores. No se ejecuta deploy ni se escriben datos Firebase reales.
