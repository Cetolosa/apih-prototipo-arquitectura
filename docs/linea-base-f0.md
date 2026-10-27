# Línea base F0 (27-oct-2026)

Origen: Prototipo de `Cetolosa/apih` main e37f84e, copiado sin Corporativo ni datos reales.

## Pruebas e2e (Playwright, modo demo, datos sintéticos de `docs/seed`)
| Prueba | Estado | Nota |
| --- | --- | --- |
| xss1, imp3, fin1, fz1 | OK | |
| t13, t43, t44, cap2, r1, c4, imp1, imp2 | Ejecutan sin errores | Sin aserción de OK/FALLA propia |
| ps1, sf1 | Reajustadas (F4) | Fecha fija y datos construidos sobre el plan sintético; ya corren en la suite |
| ia1 | Se elimina en F1 | Prueba de la sección IA |
| t10 | Fuera de la línea base | Requiere red hacia Supabase |

## Datos
- `tools/generar-seed.js` genera `docs/seed/iniciativas-sinteticas.json` (determinista, sin datos reales).
- `apih-config.js` queda sin URL ni clave: se completa con el proyecto Supabase de pruebas.
