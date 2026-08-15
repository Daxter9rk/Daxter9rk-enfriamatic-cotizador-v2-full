# Hito 5C — Inventario previo

## Estado de partida

La rama parte de `feat/mvp-h5b-dashboard-simplification` en `1ed487364507979bf11cbb45282fd57e85b6f8f3`. El árbol estaba limpio y los tags protegidos permanecían sin cambios.

## Clasificación

| Área               | Hallazgo                                                                                                                       | Clasificación | Riesgo o deuda                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------- | -------------------------------------------------------------------------------------------- |
| Clientes           | `MasterDataPage` reutiliza `useCollection`, carga una ventana de 50 registros y filtra nombre/categoría/marca/serie en memoria | CORREGIR      | Clientes no tenía búsqueda por RFC/razón social, estado ni cursor                            |
| Clientes           | Operadores usan `operatorIds array-contains uid`                                                                               | CONSERVAR     | El alcance ya se aplica en la consulta y Rules                                               |
| Cotizaciones       | `QuotesPage` restringe al operador por `assignedTo`, pero aplica búsqueda/estado/cliente/creador/fecha en memoria              | CORREGIR      | No había paginación ni desempate determinista                                                |
| Cotizaciones       | El editor recibe hasta 100 conceptos activos y crea snapshots mediante `createQuoteItemFromCatalog`                            | REUTILIZAR    | El snapshot evita mutar partidas históricas                                                  |
| Catálogo comercial | `CommercialCatalogPage` permite filtros de texto, tipo, categoría y estado sobre hasta 100 artículos                           | EXTENDER      | Faltaban unidad, orden determinista y paginación; la búsqueda era sólo de la ventana cargada |
| Catálogo comercial | Operadores consultan `status == active`; administradores consultan la colección limitada                                       | CONSERVAR     | No ampliar permisos ni exponer inactivos al operador                                         |
| Imágenes           | Lectura/escritura mediante callables y Storage privado                                                                         | CONSERVAR     | Fuera de alcance; no se cambia Storage Rules                                                 |
| Módulos retirados  | No se encontraron filtros nuevos para Solicitudes, Instalaciones, Equipos, Actividad o catálogos internos en estas pantallas   | CONSERVAR     | No reintroducirlos                                                                           |

## Decisiones de implementación

Se reutiliza `useCollection` para formularios y relaciones pequeñas, y se agrega una consulta paginada genérica para los listados visibles. Cada página usa orden compuesto con su campo principal y `documentId` como desempate. La búsqueda de texto continúa siendo local sobre la página explícitamente cargada: Firestore no ofrece texto libre y el modelo no tiene índices de prefijo para Clientes o Cotizaciones. Los identificadores se documentan como exactos dentro de esa ventana; no se presenta la ventana como búsqueda global.
