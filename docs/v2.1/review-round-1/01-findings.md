# Hallazgos de la ronda 1

| ID         | Estado inicial | Hallazgo verificable                                                                                                                                        |
| ---------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V21-R1-001 | Bloqueante     | La subida crea metadata antes de Storage, pero no elimina objeto/metadata ante fallo final, no permite eliminación y expone el texto técnico crudo del SDK. |
| V21-R1-002 | Bloqueante     | El modal presupone proveedor password y reduce todos los códigos de Auth y el fallo posterior de Firestore al mismo mensaje.                                |
| V21-R1-003 | Bloqueante     | Catálogo comparte ausencia de compensación y genera nombres temporales derivados de extensión aportada.                                                     |
| V21-R1-004 | Incompleto     | La Function valida UID activo, pero la UI usa un `select` no buscable y la reasignación no exige motivo.                                                    |
| V21-R1-005 | Bloqueante     | La UI muestra todas las instalaciones/equipos y las reglas no verifican la relación cliente → instalación → equipo.                                         |
| V21-R1-006 | Bloqueante     | El motivo queda sólo en `commercialTransition`; el detalle no lo presenta y no existe historial acumulativo.                                                |
| V21-R1-007 | Incompleto     | La notificación se marca leída al abrir el panel; la navegación requiere una segunda acción genérica.                                                       |
| V21-R1-008 | Parcial        | La intervención ya es append-only y visible; falta la acción secundaria de edición desde el expediente.                                                     |
| V21-R1-009 | Incompleto     | La vista previa es una tarjeta, no una superficie documental comparable con el PDF.                                                                         |
| V21-R1-010 | Parcial        | Hay vista operativa y detalle admin, pero faltan resultado, motivo contextual, fecha relativa y detalle técnico suficiente.                                 |
| V21-R1-011 | Incompleto     | Cada módulo implementa filtros de forma distinta y varios carecen de búsqueda/orden/limpieza.                                                               |
| V21-R1-012 | Incompleto     | Soporte conserva lenguaje técnico y no captura automáticamente el contexto requerido ni adjunto privado.                                                    |

Los manuales PDF quedan fuera de esta ronda y se mantienen en sus rutas para no romper enlaces.
