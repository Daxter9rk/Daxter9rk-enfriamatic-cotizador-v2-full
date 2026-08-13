# Hito 1 — Fundamentos del monolito modular

## Alcance implementado

- Se creó `src/modules/quotes` con capas de dominio, aplicación, infraestructura y UI.
- Se trasladaron los cálculos puros de cotización al dominio.
- Se extrajeron los casos de uso puros para snapshot y creación de partidas desde catálogo.
- Se añadió un adaptador de lectura de cotizaciones y una fachada pública única.
- Se conservaron fachadas en `src/utils` para compatibilidad durante la recuperación.
- Se añadieron pruebas de límites arquitectónicos.

## Contratos preservados

No se cambiaron campos obligatorios de cotizaciones, reglas de Firebase, Functions críticas, navegación, solicitudes, dashboard, soporte ni catálogos operativos. La lectura y las etiquetas visibles mantienen las mismas rutas y textos.

## Validación

La validación completa del frontend, Functions y emuladores se ejecuta antes de publicar la rama. Las suites existentes se consideran baseline; las pruebas arquitectónicas nuevas se reportan por separado.

## Deuda explícita

Algunos consumidores históricos todavía importan tipos desde `src/models/domain` y utilidades desde `src/utils`. Esas rutas son fachadas de compatibilidad intencionales y se migrarán sólo después de validar el baseline V2.1 y el contrato del MVP.
