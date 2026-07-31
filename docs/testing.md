# Estrategia de pruebas

## Capas

- Vitest: cálculos, redondeo, descuentos, transiciones, Zod, folios,
  idempotency key, login y generación PDF.
- Rules Unit Testing: visitantes, PII, ACL, roles, transición válida/inválida,
  issued lock, relaciones cruzadas, campos backend-only, IDs conocidos, audit
  append-only y Storage cerrado.
- Functions: módulos puros y PDF; callables se ejercitan en E2E con emulador.
- Playwright: flujo integral, estados de autenticación, rol no soportado y
  ataques por ID conocido contra callables en Chromium escritorio y 360 px.

## Ejecución

`npm run validate` no requiere emuladores. `npm run validate:emulators` compila
y ejecuta dos ambientes efímeros independientes: primero Firestore/Storage para
Rules y después todos los servicios con semilla limpia para E2E. El aislamiento
evita que los triggers de auditoría conviertan la preparación de Rules en datos
de producto.

No use producción como ambiente de prueba. Los proyectos `demo-*` de Emulator
Suite no representan recursos cloud.

## Evidencia

Playwright conserva trace y screenshot al fallar. Vitest muestra archivos y
casos. La salida final de cada comando debe adjuntarse a la revisión.
