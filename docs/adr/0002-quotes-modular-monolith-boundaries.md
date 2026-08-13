# ADR 0002: Límites del módulo de cotizaciones en el monolito modular

## Estado

Aceptado para el Hito 1 de la reestructuración MVP.

## Contexto

La aplicación mantiene las cotizaciones dentro de `features/quotes`, con cálculos puros y utilidades de catálogo en `src/utils` y lecturas de Firestore mezcladas con la UI. El baseline V2.1 debe conservar su comportamiento mientras se establece un punto de extensión modular.

## Decisión

Se establece `src/modules/quotes` como fachada pública del módulo, con capas `domain`, `application`, `infrastructure` y `ui`.

- `domain` contiene cálculos y tipos puros, sin Firebase, React ni capas externas.
- `application` contiene casos de uso puros para convertir elementos activos del catálogo en entradas de cotización y generar snapshots.
- `infrastructure` contiene el adaptador de lectura de registros de cotización.
- `ui` contiene formatos presentacionales específicos del módulo.
- Las rutas históricas en `src/utils` permanecen como reexportaciones para evitar cambios funcionales durante la recuperación.

No se modifican reglas, Functions críticas, contratos obligatorios ni flujos operativos fuera de Quotes.

## Consecuencias

Las nuevas dependencias de Quotes deben entrar por `src/modules/quotes/index.ts`. Las fachadas heredadas podrán retirarse en un hito posterior, cuando todos sus consumidores hayan migrado y exista evidencia de compatibilidad.
