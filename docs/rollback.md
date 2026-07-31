# Rollback

1. Detenga nuevas emisiones comunicando la ventana operativa; no borre datos.
2. Identifique el commit y la release Hosting anterior.
3. Restaure Functions, Rules e índices desde un commit conocido mediante un PR
   de rollback. No reescriba historial.
4. Hosting puede volver a una release anterior desde Firebase Console.
5. No reduzca Rules de forma que datos nuevos queden públicos.
6. Verifique compatibilidad de documentos por `schemaVersion`.
7. Los PDF ya emitidos y audit logs permanecen intactos.

Antes de cambios de esquema cloud, exporte Firestore y registre conteos. Las
migraciones deben correr primero en dry-run, ser idempotentes y producir reporte
por fila.
