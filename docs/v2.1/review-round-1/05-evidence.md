# Evidencia de la ronda 1

La evidencia verificable reside en código, pruebas y salidas de CI; no se almacenan contraseñas, tokens, API keys completas, payloads sensibles ni datos reales.

| Defecto    | Evidencia principal                                                                                       | Riesgo residual / rollback                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| V21-R1-001 | `src/utils/privateFiles.test.ts`, `tests/firestore.rules.test.ts`, `tests/storage.rules.test.ts`          | Sin magic bytes en carga directa; revertir utilidad/reglas y redeploy de targets explícitos   |
| V21-R1-002 | `src/components/ReauthenticationModal.test.tsx`, `src/utils/authErrors.test.ts`, matriz settings en Rules | Proveedor no-password requiere volver a iniciar sesión; revertir modal/settings               |
| V21-R1-003 | pruebas de archivos privados y Storage catálogo                                                           | Misma limitación de firma; revertir FileManager de catálogo/reglas                            |
| V21-R1-004 | `requestPolicy.test.ts`, E2E full-flow                                                                    | Directorio activo depende de perfiles correctos; revertir selector/Function                   |
| V21-R1-005 | `requestRelations.test.ts`, Firestore Rules, E2E                                                          | Validadores de reglas complejos; revertir campos aditivos/regla                               |
| V21-R1-006 | Functions, `QuoteEditor.test.ts`, commercial E2E                                                          | Historial array acotado por tamaño de documento a largo plazo; migrar a subcolección si crece |
| V21-R1-007 | `notifications.test.ts`, `NotificationCenter.test.tsx`, E2E                                               | Tipos futuros quedan no accionables por allowlist; extender builder explícitamente            |
| V21-R1-008 | E2E full-flow y UI de expediente                                                                          | Adjuntos heredan política privada                                                             |
| V21-R1-009 | `QuoteEditor.test.ts`, PDF/E2E                                                                            | Preview HTML y PDF son motores distintos aunque comparten datos/cálculos                      |
| V21-R1-010 | Rules append-only y E2E actividad                                                                         | Registros históricos sin snapshot de nombre pueden depender del perfil actual                 |
| V21-R1-011 | E2E responsive/zoom y módulos con `FilterBar`                                                             | Filtrado es cliente sobre lote actual; escalaría a consultas/indexes con mayor volumen        |
| V21-R1-012 | `SupportPage.test.tsx` y reglas privadas                                                                  | No existe aún flujo externo de mesa de ayuda                                                  |

La matriz de cambios está en `01-findings.md`, causas en `02-root-causes.md`, controles en `03-data-and-security-changes.md`, resultados en `04-testing.md`, despliegue en `06-deploy.md` y rollback en `07-rollback.md`.
