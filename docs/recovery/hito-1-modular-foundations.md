# Hito 1 - Fundamentos del monolito modular

- Rama: `feat/mvp-h1-modular-foundations`
- Commit base: `0db263a`
- Tag de recuperacion: `v2.1-preserved-before-mvp-restructure`

## Alcance implementado

- Se creo `src/modules/quotes` con capas de dominio, aplicacion, infraestructura y UI.
- Se trasladaron los calculos puros de cotizacion al dominio.
- Se extrajeron los casos de uso puros para snapshot y creacion de partidas desde catalogo.
- Se anadio un adaptador de lectura de cotizaciones y una fachada publica unica.
- Se conservaron fachadas en `src/utils` para compatibilidad durante la recuperacion.
- Se anadieron pruebas de limites arquitectonicos.

## Contratos preservados

No se cambiaron campos obligatorios de cotizaciones: `requestId`, `siteId` y `equipmentId` siguen en el contrato actual. Tampoco se cambiaron reglas de Firebase, Functions criticas, navegacion, solicitudes, dashboard, soporte ni catalogos operativos. La lectura y las etiquetas visibles mantienen las mismas rutas y textos. El desacoplamiento de `requestId` y `siteId` pertenece al Hito 2.

## Validacion

La validacion local paso formato, lint, typecheck, pruebas y build de frontend; lint, typecheck, pruebas y build de Functions; reglas Firestore/Storage (25 + 9); y E2E integral (15 pruebas). Las suites existentes se consideran baseline; las pruebas arquitectonicas nuevas se reportan por separado.

## Deuda explicita

Algunos consumidores historicos todavia importan tipos desde `src/models/domain` y utilidades desde `src/utils`. Esas rutas son fachadas de compatibilidad intencionales y se migraran solo despues de validar el baseline V2.1 y el contrato del MVP.

## Siguientes pasos

El Hito 2 puede definir el contrato de Cotizaciones independientes y sus repositorios solo despues de acordar que relacion conserva con Solicitudes y que campos dejan de ser obligatorios.

## Rollback

La recuperacion consiste en volver a `refactor/v2.2-modular-recovery` en `0db263a` o retirar la rama de este hito; el tag protegido permanece disponible y no se requieren migraciones ni cambios de datos.
