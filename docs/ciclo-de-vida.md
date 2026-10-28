# Ciclo de vida de una iniciativa (V23)

Qué cambió y por qué: fase, estado y avance eran tres números que se editaban por separado (botones Fase/Estado/Aprobar, campo «Fase» en Editar, arrastrar en el tablero, % libre). Ahora hay **una** entrada para cambiar de etapa y **un** avance calculado.

## 1. Cambiar etapa (un solo diálogo)
- Botón **Cambiar etapa** (panel, ficha, tablero de fases). Reúne «Mover de fase» y «Cambiar estado» (Pausado, Stand By, Cancelado, Completado; en propuestas, Aprobar y crear proyecto).
- Arrastrar una tarjeta en el tablero abre este mismo diálogo, ya posicionado en esa fase. No existe escritura libre de `fase`/`estado`.
- El diálogo muestra las compuertas de la fase destino; Administra puede forzarlas con motivo (queda en bitácora).
- **Completado es automático**: al cerrar el último hito de la última fase (Cierre), si las compuertas de cierre se cumplen, el proyecto pasa a Completado con avance 100 % y fin real = hoy. También puede pedirse a mano desde el diálogo (misma validación).
- Servidor: RPC `apih_transicion(p_id, p_fase, p_estado, p_motivo, p_rev, p_forzar, p_nota)`. Las compuertas se evalúan en la base (`apih_faltan_transicion`).

## 2. Avance
- `avanceFaseCalc`: promedio de las unidades de la fase (cada subfase = hitos cerrados / hitos de la subfase; cada hito suelto = 0 ó 1). Fase sin unidades: 100 % si ya quedó atrás, 0 % si es la actual o futura.
- `avanceCalc`: promedio de las fases, ponderado por días **solo si todas tienen fechas explícitas**; si no, peso igual.
- `avanceManual` (0–100, campo «Salud y avance» de Editar) manda sobre el calculado y se muestra como ajuste. Las **compuertas siempre leen el calculado**.
- Proyectos anteriores a V23: su % guardado se conserva como `avanceManual` si difiere del calculado (no se pisa nada).
- Las subfases se mantienen y aportan al avance.

## 3. Fechas por fase
- `fasesFechas = {fase: {ini, fin}}`. `inicioPlan` y `finPlan` se derivan de ellas (mínimo y máximo).
- Al crear o cambiar el rango del plan, se reparte 15/55/15/15 (4 fases; partes iguales si no son 4) o se reescala lo existente. Un cambio aprobado de fecha fin alarga la última fase.
- «Editar fechas de las fases» en la tarjeta Fases; las subfases se acotan a su fase.

## 4. Cambio de compuertas
- **Transición** ya no exige «Avance ≥ 80 %» (un número manual): exige **«Hitos de las fases anteriores completados»**.
- Con servidor, el umbral de riesgo crítico es el de la organización (`umbralCritico`), no el personal.

## 5. Puerta lateral cerrada (servidor)
El trigger `apih_fila` rechaza a quien no sea Administra (ni proceso interno) que:
- cambie `fase`, `estado`, `estadoMotivo`, `estadoRev`, `faseDesde`, `proyecto` o `propuestaOrigen` con un UPDATE directo;
- cree una iniciativa fuera de la primera fase / estado inicial o con vínculo propuesta-proyecto.
Lo único válido es `apih_transicion`, `apih_aprobar_propuesta`, `apih_reabrir` y las demás RPC.

## 6. Pruebas
- Contratos compartidos app ↔ servidor: `tests/contract/avance_calc.json`, `gates_transicion.json` (e2e `ciclo-contract`, SQL `90_ciclo_de_vida.sql`).
- e2e `ciclo1`: diálogo, formulario sin fase, avance manual/calculado, proyecto anterior, fechas por fase, autocompletado, Stand By.
- SQL: permisos, compuertas, forzado, Stand By, estados finales, puerta lateral, rango del plan, autocompletado.

## Fuera de alcance (a propósito)
Fases propias por tipo de iniciativa (T1–T6 comparten fases). Es el siguiente paso natural.
