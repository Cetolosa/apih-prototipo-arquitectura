# Pruebas TI

Repite, con evidencia, la revisión técnica que hizo Arquitectura (informe del 27-10-2026, 17 hallazgos). Deja el resultado en el mismo formato: `#`, severidad, hallazgo, estado, evidencia.

```
npm run pruebas-ti            # genera pruebas-ti/informe.md e informe.json
npm run pruebas-ti -- --estricto   # además falla si algún hallazgo sigue ABIERTO
```

Requiere Postgres local (igual que `tools/test-sql.sh`).

## Estados
- **CERRADO**: la prueba reproduce el caso del informe y el servidor lo rechaza.
- **ABIERTO**: la prueba reproduce el caso y el servidor lo permite.
- **NO APLICA**: el hallazgo es del stack de Corporativo (Azure Functions, Bicep, pipeline de Azure DevOps); el motivo queda en la evidencia.
- **PENDIENTE**: aún no hay prueba automatizada para ese hallazgo.

## Método (el del informe)
1. Commit fijo: el informe declara el commit revisado; aquí queda en el encabezado de `informe.md`.
2. Reproducción en vivo de los casos de mayor riesgo contra el servidor (`checks/*.sql`).
3. Verificación estática del resto (búsquedas dirigidas por archivo).
4. Declarar lo que no se verificó.

## Cómo agregar una prueba
Un archivo en `checks/`. Si es `.sql`, imprime `TI|H<nn>|CERRADO|<evidencia>` o `TI|H<nn>|ABIERTO|<evidencia>` y nunca aborta. Si es `.js`, exporta `raiz => ({ estado, evidencia })`. Luego se apunta `check` en `hallazgos.json`. Toda prueba nueva debe tener un control negativo (forzar el fallo y ver ABIERTO).
