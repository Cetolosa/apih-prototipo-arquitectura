# Contrato de campos en el servidor

**Qué hace.** Las filas de proyectos, propuestas, riesgos, hitos, decisiones, compromisos, cambios, notas, documentos, bitácora y comités solo pueden traer claves del catálogo `apih_campos`. Una clave desconocida se rechaza con `APIH: campo desconocido «clave» en <lista>` (código 22023, el HINT trae el nombre de la clave).

**Qué no restringe.**
- Una clave que la fila ya traía (lo guardado antes y lo que escriben los comandos del servidor `apih_*`).
- Las listas sin catálogo: configuración, roles y claves.
- Los tipos y rangos de los campos conocidos: eso lo valida `apih_validar`.

**Dónde está.**
- `supabase/migrations/…001000_campos_permitidos.sql`: tabla, función y disparador.
- `supabase/migrations/…001100_campos_catalogo.sql`: catálogo (generado).
- `tests/contract/campos_permitidos.json`: el mismo catálogo, para las pruebas.
- `supabase/tests/80_campos.sql`: pruebas del servidor.

**Cuando la SPA agrega un campo.** El e2e falla con `campos fuera del catálogo del servidor: <lista>.<clave>`. Se regenera así:
```
CAPTURA_CLAVES=/tmp/claves.json node tools/correr-e2e.js
node tools/generar-campos.js /tmp/claves.json
```
Los campos que la app escribe en flujos que el e2e no recorre están en `EXTRAS` de `tools/generar-campos.js` y se revisan a mano.
