# ADR 0002: Limites del modulo de cotizaciones en el monolito modular

## Estado

Aceptado para el Hito 1 de la reestructuracion MVP.

## Contexto y problema

La aplicacion mantiene las cotizaciones dentro de `features/quotes`, con calculos puros y utilidades de catalogo en `src/utils` y lecturas de Firestore mezcladas con la UI. El problema es la mezcla de responsabilidades y el costo de cambiar contratos compartidos sin una ruta de recuperacion. El baseline V2.1 debe conservar su comportamiento mientras se establece un punto de extension modular.

## Decision

Se establece `src/modules/quotes` como fachada publica del modulo, con capas `domain`, `application`, `infrastructure` y `ui`.

- `domain` contiene calculos y tipos puros, sin Firebase, React ni capas externas.
- `application` contiene casos de uso puros para convertir elementos activos del catalogo en entradas de cotizacion y generar snapshots.
- `infrastructure` contiene el adaptador de lectura de registros de cotizacion.
- `ui` contiene formatos presentacionales especificos del modulo.
- Las rutas historicas en `src/utils` permanecen como reexportaciones para evitar cambios funcionales durante la recuperacion.

Firebase permanece como infraestructura. Los eventos se reservaran para hechos que realmente requieran asincronia, reintentos o varios consumidores. No se introduciran microservicios: el MVP necesita consistencia transaccional, despliegue simple y una superficie operativa acotada. Tampoco se hara una reescritura completa; cada extraccion debe ser reversible y verificable contra el baseline.

No se modifican reglas, Functions criticas, contratos obligatorios ni flujos operativos fuera de Quotes.

## Reglas y criterios

Las nuevas dependencias de Quotes deben entrar por `src/modules/quotes/index.ts`. `shared` solo recibira conceptos estables, puros y usados por al menos dos modulos; no sera un deposito generico.

Una interfaz se creara solo cuando exista un consumidor real que necesite sustituir una dependencia o probar una frontera. Un evento se creara solo cuando haya un hecho de negocio persistente, mas de un consumidor o una necesidad clara de desacoplar tiempos de ejecucion; una llamada directa sigue siendo preferible en los demas casos.

Las fachadas heredadas podran retirarse en un hito posterior, cuando todos sus consumidores hayan migrado y exista evidencia de compatibilidad.

## Consecuencias

La estructura permite migrar gradualmente UI y persistencia sin romper el baseline. El costo temporal es mantener fachadas de compatibilidad y tipos historicos hasta que el contrato del MVP y el Hito 2 definan su retiro.
